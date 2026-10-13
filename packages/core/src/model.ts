import { type TokenUsage, EMPTY_TOKEN_USAGE } from "./types.js";
import type { ChatMessage, ToolCallRequest } from "./types.js";

/** A tool as advertised to the model: JSON Schema, provider-neutral. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
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

export interface ModelCapabilities {
  streaming: boolean;
  toolCalls: boolean;
  images: boolean;
  structuredOutput: boolean;
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

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  toolCalls: false,
  images: false,
  structuredOutput: false,
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
