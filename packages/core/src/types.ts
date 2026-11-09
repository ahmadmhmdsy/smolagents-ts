/** Roles accepted by every model adapter. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** The image types a message may carry; `MEDIA_TYPES` holds the same list at run time. */
export type ImageMediaType = "image/png" | "image/jpeg" | "image/webp" | "image/gif";

/** The audio types a message may carry; `MEDIA_TYPES` holds the same list at run time. */
export type AudioMediaType = "audio/wav" | "audio/mpeg";

export interface TextPart {
  type: "text";
  text: string;
}

/** An image as bytes. There is no URL form: the framework never hands a provider an address. */
export interface ImagePart {
  type: "image";
  mediaType: ImageMediaType;
  bytes: Uint8Array;
  /** How closely a provider that offers the choice should look. */
  detail?: "auto" | "low" | "high";
  /** A description for a person reading the transcript; never sent to the model. */
  alt?: string;
}

/** An audio clip as bytes. `format` is the name a provider's wire asks for. */
export interface AudioPart {
  type: "audio";
  mediaType: AudioMediaType;
  bytes: Uint8Array;
  format: "wav" | "mp3";
}

export type ContentPart = TextPart | ImagePart | AudioPart;

/** What a message says: a string for text alone, parts once media is involved. */
export type MessageContent = string | readonly ContentPart[];

/** Media named without its bytes, which is the only form a snapshot, event or trace may hold. */
export interface MediaRef {
  id: string;
  mediaType: ImageMediaType | AudioMediaType;
  byteLength: number;
  alt?: string;
  detail?: ImagePart["detail"];
}

/** A task's part as memory and a checkpoint hold it: text as it is, media by reference. */
export type TaskPart = TextPart | { type: "ref"; ref: MediaRef };

/** A single turn handed to a model. Provider-neutral by construction. */
export interface ChatMessage {
  role: ChatRole;
  content: MessageContent;
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
  /**
   * The part of `inputTokens` the provider billed as a cache read. A provider that reports no
   * cache split leaves it absent, which is not the same fact as a reported zero.
   */
  readonly cachedInputTokens?: number;
  /** The part of `inputTokens` the provider billed as a cache write; absent when unreported. */
  readonly cacheWriteInputTokens?: number;
}

export const EMPTY_TOKEN_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

/** Sum two usages. A split half stays absent until one side reports it, then sums what is known. */
export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  const cached =
    a.cachedInputTokens === undefined && b.cachedInputTokens === undefined
      ? undefined
      : (a.cachedInputTokens ?? 0) + (b.cachedInputTokens ?? 0);
  const cacheWrite =
    a.cacheWriteInputTokens === undefined && b.cacheWriteInputTokens === undefined
      ? undefined
      : (a.cacheWriteInputTokens ?? 0) + (b.cacheWriteInputTokens ?? 0);
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
    ...(cached === undefined ? {} : { cachedInputTokens: cached }),
    ...(cacheWrite === undefined ? {} : { cacheWriteInputTokens: cacheWrite }),
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
