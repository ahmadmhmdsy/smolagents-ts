/**
 * Free functions the agent loop calls, split out of `multi-step-agent.ts` (T-73) with no change of
 * behaviour. They hold no agent state; nothing here is part of the package's public API.
 */
import { AgentError, AgentGuardrailError, MediaMissingError } from "../errors.js";
import { hasMedia, messageText } from "../media.js";
import { type AudioPart, type ChatMessage, type ImagePart, type MediaRef } from "../types.js";
import { type LimitStopReason, type RunBudget } from "../session/budget.js";

/** The step ceiling a planning update tells the planner it still has, as upstream does. */
export function remainingStepsAfter(stepIndex: number, maxSteps: number): number {
  return maxSteps - stepIndex - 1;
}

/** The default size estimate: a quarter of the transcript's characters, rounded up. */
export function estimatedTokens(messages: readonly ChatMessage[]): number {
  let characters = 0;
  for (const message of messages) characters += messageText(message).length;
  return Math.ceil(characters / 4);
}

/** A tool's result once its bytes are in the store: the only form a journal holds. */
export interface AdmittedToolMedia {
  readonly kind: "tool-media";
  readonly text: string;
  readonly refs: readonly MediaRef[];
}

export function isAdmittedToolMedia(value: unknown): value is AdmittedToolMedia {
  return typeof value === "object" && value !== null && (value as { kind?: unknown }).kind === "tool-media";
}

/** The part a reference names, from the bytes a store gave back. Wrong bytes are no bytes. */
export function partFromRef(ref: MediaRef, bytes: Uint8Array | undefined): ImagePart | AudioPart {
  if (bytes?.byteLength !== ref.byteLength) {
    throw new MediaMissingError("The media store cannot produce " + ref.id, { mediaId: ref.id });
  }
  if (ref.mediaType === "audio/wav" || ref.mediaType === "audio/mpeg") {
    const format = ref.mediaType === "audio/wav" ? "wav" : "mp3";
    return { type: "audio", mediaType: ref.mediaType, bytes, format };
  }
  return {
    type: "image",
    mediaType: ref.mediaType,
    bytes,
    ...(ref.detail === undefined ? {} : { detail: ref.detail }),
    ...(ref.alt === undefined ? {} : { alt: ref.alt }),
  };
}

/** A request as a digest sees it: bytes become their length, and text-only messages stay as they are. */
export function withoutBytes(messages: readonly ChatMessage[]): readonly unknown[] {
  return messages.map((message) => {
    if (!hasMedia(message) || typeof message.content === "string") return message;
    const content = message.content.map((part) => {
      if (part.type === "text") return part;
      const { bytes, ...described } = part;
      return { ...described, byteLength: bytes.byteLength };
    });
    return { ...message, content };
  });
}

/** The summary a hard trigger uses when no summarizer is configured, or it throws. */
export function deterministicSummary(count: number): string {
  return "Condensed " + String(count) + " earlier step" + (count === 1 ? "" : "s") + ".";
}

/** A guardrail that throws has still stopped the run; it fails as a guardrail, not as a crash. */
export function guardrailError(which: "input" | "output", error: unknown, stepIndex?: number): AgentGuardrailError {
  const message = "The " + which + " guardrail threw: " + (error instanceof Error ? error.message : String(error));
  return new AgentGuardrailError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}

/** The limit a budget has already crossed, if any. Used before a resumed run spends a turn. */
export function exhaustedBudget(budget: RunBudget): LimitStopReason | undefined {
  if (budget.turns >= budget.maxTurns) return "limitTurns";
  if (budget.outputTokens >= budget.maxOutputTokens) return "limitOutputTokens";
  if (budget.totalTokens >= budget.maxTotalTokens) return "limitTotalTokens";
  if (budget.costMicroUsd >= budget.maxCostMicroUsd) return "limitCostUsd";
  return undefined;
}

export function storeError(operation: "load" | "commit", error: unknown, stepIndex?: number): AgentError {
  const message =
    "The run store failed to " + operation + " the run record: " + (error instanceof Error ? error.message : String(error));
  return new AgentError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}
