import { type TokenUsage, EMPTY_TOKEN_USAGE } from "./types.js";
import type { ChatMessage, ToolCallRequest } from "./types.js";

/** A tool as advertised to the model: JSON Schema, provider-neutral. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Present on a tool its provider runs itself; the host never executes it. */
  kind?: "hosted";
  /** The provider's payload for a hosted tool, passed through for an adapter to render. */
  hosted?: { provider: string; spec: Readonly<Record<string, unknown>> };
}

export type FinishReason = "stop" | "tool_calls" | "length" | "other";

export interface ChatCompletion {
  content: string;
  toolCalls: ToolCallRequest[];
  usage: TokenUsage;
  finishReason: FinishReason;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

export interface ChatCompletionChunk {
  delta: string;
  toolCallDelta?: ToolCallDelta;
  finishReason?: FinishReason;
  /**
   * Present on a stream's final chunk when the provider reports usage. Without it a
   * streamed run cannot account for tokens at all.
   */
  usage?: TokenUsage;
}

/** Accumulates streamed tool-call deltas into whole calls, in index order. */
export class ToolCallAccumulator {
  private readonly open = new Map<number, ToolCallRequest>();

  accept(delta: ToolCallDelta): void {
    const existing = this.open.get(delta.index) ?? { id: "", name: "", arguments: "" };
    if (delta.id !== undefined) existing.id = delta.id;
    if (delta.name !== undefined) existing.name = delta.name;
    if (delta.argumentsDelta !== undefined) existing.arguments += delta.argumentsDelta;
    this.open.set(delta.index, existing);
  }

  finish(): ToolCallRequest[] {
    return [...this.open.entries()].sort(([a], [b]) => a - b).map(([, call]) => call);
  }
}

/**
 * The capability bag. The design record's section 7 spells this `supports`; the
 * name here is `capabilities`, for the same reason the executor seam's bag is
 * `ExecutorCapabilities`. Decision 0011 owns the choice.
 */
export interface ModelCapabilities {
  streaming: boolean;
  toolCalls: boolean;
  images: boolean;
}

export interface GenerateOptions {
  systemPrompt?: string;
  tools?: readonly ToolSpec[];
  stopSequences?: readonly string[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * The model seam (design spec section 7). Every provider is reachable through this
 * interface, so core never learns a provider name.
 */
export interface Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  generate(messages: readonly ChatMessage[], options?: GenerateOptions): Promise<ChatCompletion>;
  generateStream(
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk>;
}

/**
 * The version of the adapter contract the loop speaks. An adapter declares the version it was
 * written against; a later breaking change bumps this number, and `upgradeModelAdapter` keeps an
 * adapter written for the previous version working. Nothing here is provider-specific.
 */
export const MODEL_ADAPTER_VERSION = 1 as const;

/** The adapter contract at its numbered version: `Model` plus the version the adapter implements. */
export interface ModelAdapterV1 extends Model {
  readonly adapterVersion: typeof MODEL_ADAPTER_VERSION;
}

/** Whether a model already declares the current contract version. */
function declaresAdapterVersion(model: Model): model is ModelAdapterV1 {
  return (model as { adapterVersion?: unknown }).adapterVersion === MODEL_ADAPTER_VERSION;
}

/**
 * The upgrade shim for a model written before the contract was numbered: it supplies the version
 * on the model's behalf and forwards both calls unchanged, so an adapter that has not been
 * rewritten keeps working. When the contract moves to a new version, this is the one place that
 * translates the previous version's options.
 */
export function upgradeModelAdapter(model: Model): ModelAdapterV1 {
  if (declaresAdapterVersion(model)) return model;
  return {
    id: model.id,
    provider: model.provider,
    capabilities: model.capabilities,
    adapterVersion: MODEL_ADAPTER_VERSION,
    generate: (messages, options) => model.generate(messages, options),
    generateStream: (messages, options) => model.generateStream(messages, options),
  };
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  toolCalls: false,
  images: false,
};

export function modelCapabilities(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return { ...DEFAULT_CAPABILITIES, ...overrides };
}

/**
 * Drains a chunk stream into a single completion. An adapter that only speaks
 * non-streaming HTTP can implement generateStream by yielding one chunk, and an
 * adapter that streams can reuse this to satisfy generate().
 */
export async function collectCompletion(
  chunks: AsyncIterable<ChatCompletionChunk>,
  usage?: TokenUsage,
): Promise<ChatCompletion> {
  let content = "";
  let finishReason: FinishReason = "stop";
  let streamUsage: TokenUsage | undefined;
  const accumulator = new ToolCallAccumulator();

  for await (const chunk of chunks) {
    content += chunk.delta;
    if (chunk.toolCallDelta !== undefined) accumulator.accept(chunk.toolCallDelta);
    if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
    if (chunk.usage !== undefined) streamUsage = chunk.usage;
  }

  // The caller's total wins when it has one; otherwise the stream's own report is used.
  const total = usage ?? streamUsage ?? EMPTY_TOKEN_USAGE;
  return { content, toolCalls: accumulator.finish(), usage: { ...total }, finishReason };
}
