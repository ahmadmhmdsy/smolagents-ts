/** Roles accepted by every model adapter. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single turn handed to a model. Provider-neutral by construction. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Set when role is "tool": which call this message answers. */
  toolCallId?: string;
  /** Optional tool name, for providers that require it on tool results. */
  name?: string;
  /** The calls an assistant turn asked for, when it asked for any. */
  toolCalls?: readonly ToolCallRequest[];
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export const EMPTY_TOKEN_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export interface Timing {
  readonly start: number;
  readonly end: number;
  readonly durationMs: number;
}

/** A tool call the model asked for. arguments is the raw JSON string the provider returned. */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

/** One tool invocation, as recorded in an ActionStep. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
}
