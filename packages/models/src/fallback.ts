import {
  MODEL_ADAPTER_VERSION,
  upgradeModelAdapter,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type GenerateOptions,
  type Model,
  type ModelAdapterV2,
  type ModelCapabilities,
} from "@smolagents-ts/core";

/** What `onFallback` hears each time the wrapper leaves one model for the next. */
export interface FallbackEvent {
  /** The model that failed. */
  from: Model;
  /** The model the wrapper tries next. */
  to: Model;
  /** The failure that caused the move. */
  error: unknown;
  /** The position of `from` in `models`, counting from zero. */
  index: number;
}

export interface FallbackModelOptions {
  /** The models to try, in order. The first is the one every call starts with. */
  models: readonly Model[];
  /** Defaults to `fallback(<first id>,<second id>,...)`. */
  id?: string;
  /**
   * Called before each move, so a move is never silent: a fallback adds latency and spends a
   * second provider's tokens. A throw from here is not caught.
   */
  onFallback?: (event: FallbackEvent) => void;
  /**
   * Decides whether a failure moves to the next model. Defaults to `isRetryableModelError`.
   * The wrapper never moves after the caller's signal aborts, whatever this returns.
   */
  isRetryable?: (error: unknown) => boolean;
}

/** HTTP statuses a second provider could answer differently: timeout, conflict, rate limit. */
const RETRYABLE_STATUSES = new Set([408, 409, 429]);

/** Error codes Node and undici give a request that never reached an answer. */
const NETWORK_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ECONNABORTED",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ENETUNREACH",
  "EHOSTUNREACH",
  "EAI_AGAIN",
  "EPIPE",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED",
]);

function field(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * The default move rule (decision 0038): a network error, a timeout, or HTTP 408, 409, 429 or
 * 5xx moves; any other HTTP status, an abort, and a failure this function cannot classify do not.
 * It reads `status` from the error (the adapters' `HttpError` carries one, as do most provider
 * SDKs' errors) and `code` from the error or its `cause`.
 */
export function isRetryableModelError(error: unknown): boolean {
  const name = field(error, "name");
  if (name === "TimeoutError") return true;
  if (name === "AbortError") return false;

  const status = field(error, "status") ?? field(error, "statusCode");
  if (typeof status === "number") return RETRYABLE_STATUSES.has(status) || (status >= 500 && status <= 599);

  for (let current: unknown = error, depth = 0; current !== undefined && depth < 4; depth += 1) {
    const code = field(current, "code");
    if (typeof code === "string" && NETWORK_CODES.has(code)) return true;
    current = field(current, "cause");
  }
  // fetch rejects with a bare TypeError when the request never got a response.
  return error instanceof TypeError && /fetch failed|network|failed to fetch/i.test(error.message);
}

function intersect(models: readonly Model[]): ModelCapabilities {
  const all = (key: keyof ModelCapabilities): boolean => models.every((model) => model.capabilities[key]);
  return { streaming: all("streaming"), toolCalls: all("toolCalls"), images: all("images"), audio: all("audio") };
}

function exhausted(models: readonly Model[], errors: readonly unknown[]): AggregateError {
  return new AggregateError(
    errors,
    "All " + String(models.length) + " models failed: " + models.map((model) => model.id).join(", "),
  );
}

/**
 * A `Model` over an ordered list of models (decision 0038). Every call starts with the first; on
 * a failure a retry could fix it moves to the next, and reports the move through `onFallback`.
 * It does not move on another 4xx, which the next provider would answer the same way, nor after
 * an abort. A stream that has yielded a chunk is never moved, because a second provider cannot
 * continue another's partial answer: its failure reaches the caller as it is.
 *
 * Its capabilities are the intersection of its members', so a run never asks for something one
 * member cannot do. When every model fails with a movable error, it throws an `AggregateError`
 * holding each one, in order. It is a policy over named models, not a router: there is no cost
 * table, health probe or load balancing.
 */
export class FallbackModel implements ModelAdapterV2 {
  readonly id: string;
  readonly provider = "fallback";
  readonly capabilities: ModelCapabilities;
  readonly adapterVersion = MODEL_ADAPTER_VERSION;
  /** The members, in order, as given. */
  readonly models: readonly Model[];

  private readonly members: readonly ModelAdapterV2[];
  private readonly onFallback: ((event: FallbackEvent) => void) | undefined;
  private readonly isRetryable: (error: unknown) => boolean;

  constructor(options: FallbackModelOptions) {
    if (options.models.length === 0) throw new Error("A FallbackModel needs at least one model");
    this.models = [...options.models];
    this.members = this.models.map((model) => upgradeModelAdapter(model));
    this.id = options.id ?? "fallback(" + this.models.map((model) => model.id).join(",") + ")";
    this.capabilities = intersect(this.members);
    this.onFallback = options.onFallback;
    this.isRetryable = options.isRetryable ?? isRetryableModelError;
  }

  async generate(messages: readonly ChatMessage[], options: GenerateOptions = {}): Promise<ChatCompletion> {
    const errors: unknown[] = [];
    for (const [index, member] of this.members.entries()) {
      try {
        return await member.generate(messages, options);
      } catch (error) {
        errors.push(error);
        this.moveOrThrow(index, error, options.signal, errors);
      }
    }
    throw exhausted(this.models, errors);
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncIterable<ChatCompletionChunk> {
    if (!this.capabilities.streaming) {
      throw new Error("FallbackModel " + this.id + " cannot stream: a member does not stream");
    }
    const errors: unknown[] = [];
    for (const [index, member] of this.members.entries()) {
      let yielded = false;
      try {
        for await (const chunk of member.generateStream(messages, options)) {
          yielded = true;
          yield chunk;
        }
        return;
      } catch (error) {
        if (yielded) throw error;
        errors.push(error);
        this.moveOrThrow(index, error, options.signal, errors);
      }
    }
    throw exhausted(this.models, errors);
  }

  /** Returns when the wrapper should try the next model; throws the error when it should not. */
  private moveOrThrow(index: number, error: unknown, signal: AbortSignal | undefined, errors: unknown[]): void {
    if (signal?.aborted === true || !this.isRetryable(error)) throw error;
    const next = this.models[index + 1];
    if (next === undefined) throw exhausted(this.models, errors);
    this.onFallback?.({ from: this.models[index] as Model, to: next, error, index });
  }
}
