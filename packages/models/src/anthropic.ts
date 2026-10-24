import {
  EMPTY_TOKEN_USAGE,
  modelCapabilities,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type FinishReason,
  type GenerateOptions,
  type Model,
  type ModelCapabilities,
  type TokenUsage,
  type ToolCallRequest,
  type ToolSpec,
} from "@smolagents-ts/core";
import { parseSse } from "./sse.js";
import { joinUrl, postJson, resolveFetch, streamError, type FetchLike } from "./transport.js";

export interface AnthropicOptions {
  /** The provider's model id, for example "claude-sonnet-4-5". */
  model: string;
  apiKey?: string;
  /** Everything before "/v1/messages". Defaults to the Anthropic endpoint. */
  baseUrl?: string;
  fetch?: FetchLike;
  headers?: Readonly<Record<string, string>>;
  capabilities?: Partial<ModelCapabilities>;
  systemPrompt?: string;
  temperature?: number;
  /** The wire requires a limit, so this defaults to 4096 rather than being omitted. */
  maxTokens?: number;
  /** Reported as the model's provider; defaults to "anthropic". */
  provider?: string;
  /** The dated API version header; defaults to "2023-06-01". */
  version?: string;
}

interface WireTextBlock {
  type: "text";
  text: string;
}

interface WireToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface WireToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type WireBlock = WireTextBlock | WireToolUseBlock | WireToolResultBlock;

interface WireMessage {
  role: "user" | "assistant";
  content: WireBlock[];
}

interface WireUsage {
  input_tokens?: number;
  output_tokens?: number;
  /** Prompt tokens read from the cache, billed at the cached rate and excluded from input_tokens. */
  cache_read_input_tokens?: number;
  /** Prompt tokens written to the cache, excluded from input_tokens the same way. */
  cache_creation_input_tokens?: number;
}

interface WireResponse {
  content?: WireBlock[];
  stop_reason?: string | null;
  usage?: WireUsage;
}

/** One named event of the streamed form: the pieces arrive split across several events. */
interface WireStreamEvent {
  index?: number;
  message?: { usage?: WireUsage };
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string | null };
  usage?: WireUsage;
  /** Set on an `error` event, which the provider sends mid-stream, e.g. overloaded_error. */
  error?: { type?: string; message?: string };
}

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/** The wire wants an object here, and a transcript may carry an empty or unparseable string. */
function toInput(raw: string): unknown {
  if (raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function toWireTools(tools: readonly ToolSpec[]): unknown[] {
  return tools.map((spec) => ({
    name: spec.name,
    description: spec.description,
    input_schema: spec.inputSchema,
  }));
}

/** The transcript as blocks, with every tool result folded into the user turn after its call. */
function toWireMessages(
  messages: readonly ChatMessage[],
  systemPrompt?: string,
): { system?: string; messages: WireMessage[] } {
  const system: string[] = [];
  if (systemPrompt !== undefined) system.push(systemPrompt);
  const wire: WireMessage[] = [];
  let results: WireToolResultBlock[] = [];
  const flush = (): void => {
    if (results.length > 0) {
      wire.push({ role: "user", content: results });
      results = [];
    }
  };

  for (const message of messages) {
    if (message.role === "system") {
      if (message.content !== "") system.push(message.content);
      continue;
    }
    if (message.role === "tool") {
      results.push({
        type: "tool_result",
        tool_use_id: message.toolCallId ?? "",
        content: message.content,
      });
      continue;
    }
    flush();
    if (message.role === "assistant") {
      const blocks: WireBlock[] = [];
      if (message.content !== "") blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: toInput(call.arguments),
        });
      }
      if (blocks.length > 0) wire.push({ role: "assistant", content: blocks });
      continue;
    }
    wire.push({ role: "user", content: [{ type: "text", text: message.content }] });
  }
  flush();
  return { ...(system.length === 0 ? {} : { system: system.join("\n\n") }), messages: wire };
}

function fromWireContent(content: WireBlock[] | undefined): {
  content: string;
  toolCalls: ToolCallRequest[];
} {
  let text = "";
  const toolCalls: ToolCallRequest[] = [];
  for (const block of content ?? []) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        name: block.name,
        arguments: JSON.stringify(block.input ?? {}),
      });
    }
  }
  return { content: text, toolCalls };
}

function toFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "end_turn":
    case "stop_sequence":
      return "stop";
    default:
      return "other";
  }
}

function fromWireUsage(usage: WireUsage | undefined): TokenUsage {
  if (usage === undefined) return EMPTY_TOKEN_USAGE;
  const cacheRead = usage.cache_read_input_tokens;
  const cacheWrite = usage.cache_creation_input_tokens;
  // The wire counts cache reads and writes apart from input_tokens; the budget's prompt count is
  // all three, and the split is kept so a caller can price each at its own rate.
  const inputTokens = (usage.input_tokens ?? 0) + (cacheRead ?? 0) + (cacheWrite ?? 0);
  const outputTokens = usage.output_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    ...(cacheRead === undefined ? {} : { cachedInputTokens: cacheRead }),
    ...(cacheWrite === undefined ? {} : { cacheWriteInputTokens: cacheWrite }),
  };
}

/** Anthropic's Messages API: a top-level system prompt, content blocks, a required limit. */
export class AnthropicModel implements Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly headers: Readonly<Record<string, string>> | undefined;
  private readonly systemPrompt: string | undefined;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number;
  private readonly version: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicOptions) {
    if (options.model.trim() === "") {
      throw new Error("AnthropicModel needs a model id");
    }
    this.id = options.model;
    this.provider = options.provider ?? "anthropic";
    this.capabilities = modelCapabilities({ toolCalls: true, ...options.capabilities });
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.systemPrompt = options.systemPrompt;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.version = options.version ?? DEFAULT_VERSION;
    this.fetchImpl = resolveFetch(options.fetch);
  }

  async generate(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<ChatCompletion> {
    const response = await this.post(this.payload(messages, options, false), options.signal);
    const body = (await response.json()) as WireResponse;
    const parsed = fromWireContent(body.content);
    return {
      content: parsed.content,
      toolCalls: parsed.toolCalls,
      usage: fromWireUsage(body.usage),
      finishReason: toFinishReason(body.stop_reason),
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncGenerator<ChatCompletionChunk> {
    const response = await this.post(
      this.payload(messages, options, true),
      options.signal,
      "text/event-stream",
    );
    if (response.body === null) {
      throw new Error("The provider returned no body to stream");
    }
    // The input count and the cache split arrive once at the start; the output count at the end.
    let inputTokens = 0;
    let cachedInputTokens: number | undefined;
    let cacheWriteInputTokens: number | undefined;
    for await (const event of parseSse(response.body)) {
      let parsed: WireStreamEvent;
      try {
        parsed = JSON.parse(event.data) as WireStreamEvent;
      } catch {
        continue; // a keep-alive that is not JSON
      }
      switch (event.event) {
        case "message_start": {
          const usage = parsed.message?.usage;
          cachedInputTokens = usage?.cache_read_input_tokens;
          cacheWriteInputTokens = usage?.cache_creation_input_tokens;
          inputTokens =
            (usage?.input_tokens ?? 0) + (cachedInputTokens ?? 0) + (cacheWriteInputTokens ?? 0);
          break;
        }
        case "content_block_start":
          if (parsed.content_block?.type === "tool_use") {
            yield {
              delta: "",
              toolCallDelta: {
                index: parsed.index ?? 0,
                ...(parsed.content_block.id === undefined ? {} : { id: parsed.content_block.id }),
                ...(parsed.content_block.name === undefined
                  ? {}
                  : { name: parsed.content_block.name }),
              },
            };
          }
          break;
        case "content_block_delta": {
          const delta = parsed.delta;
          if (delta?.type === "text_delta" && delta.text !== undefined) {
            yield { delta: delta.text };
          } else if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
            yield {
              delta: "",
              toolCallDelta: { index: parsed.index ?? 0, argumentsDelta: delta.partial_json },
            };
          }
          break;
        }
        case "message_delta": {
          const chunk: ChatCompletionChunk = { delta: "" };
          const reason = parsed.delta?.stop_reason;
          if (reason !== undefined && reason !== null) chunk.finishReason = toFinishReason(reason);
          const outputTokens = parsed.usage?.output_tokens;
          if (outputTokens !== undefined) {
            chunk.usage = {
              inputTokens,
              outputTokens,
              totalTokens: inputTokens + outputTokens,
              ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
              ...(cacheWriteInputTokens === undefined ? {} : { cacheWriteInputTokens }),
            };
          }
          yield chunk;
          break;
        }
        case "message_stop":
          return;
        case "error":
          // The stream began with a 200, so this is the only sign the turn did not finish;
          // dropping it would hand the loop a truncated answer as if it were whole.
          throw streamError("Anthropic", parsed.error);
        default:
          break;
      }
    }
  }

  protected payload(
    messages: readonly ChatMessage[],
    options: GenerateOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const transcript = toWireMessages(messages, options.systemPrompt ?? this.systemPrompt);
    const tools = options.tools;
    const temperature = options.temperature ?? this.temperature;
    const stopSequences = options.stopSequences;
    return {
      model: this.id,
      max_tokens: options.maxTokens ?? this.maxTokens,
      ...transcript,
      stream,
      ...(tools === undefined || tools.length === 0 ? {} : { tools: toWireTools(tools) }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(stopSequences === undefined || stopSequences.length === 0
        ? {}
        : { stop_sequences: stopSequences }),
    };
  }

  private async post(
    body: unknown,
    signal?: AbortSignal,
    accept?: string,
  ): Promise<Response> {
    const url = joinUrl(this.baseUrl, "/v1/messages");
    return postJson(
      this.fetchImpl,
      url,
      body,
      {
        "anthropic-version": this.version,
        ...(accept === undefined ? {} : { accept }),
        ...(this.apiKey === undefined ? {} : { "x-api-key": this.apiKey }),
        ...this.headers,
      },
      signal,
    );
  }
}
