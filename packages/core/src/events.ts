import type { RunResult } from "./agent/run-result.js";
import type { AgentErrorInfo } from "./errors.js";
import type { TokenUsage, ToolCall } from "./types.js";

/**
 * Every observable thing that happens during a run.
 *
 * CONTRACT (design spec 6.3): an event whose type ends in ".delta" is ADVISORY.
 * A stream may be coalesced, retried, or replayed, so consumers must converge on the
 * matching ".completed" event. AgentSession implements this rule and never lets a delta
 * mutate its authoritative snapshot.
 */
export type AgentEvent =
  | { type: "run.started"; runId: string; task: string; modelId: string }
  | { type: "planning.started"; stepIndex: number }
  | { type: "planning.delta"; stepIndex: number; text: string }
  | { type: "planning.completed"; stepIndex: number; text: string }
  | { type: "step.started"; stepIndex: number }
  | { type: "code.delta"; stepIndex: number; text: string }
  | { type: "code.completed"; stepIndex: number; code: string }
  | { type: "action.requested"; callId: string; name: string; args: unknown }
  | { type: "action.result"; callId: string; name: string; output: unknown; durationMs: number }
  | { type: "action.failed"; callId: string; name: string; error: AgentErrorInfo }
  | { type: "toolcalls.requested"; stepIndex: number; calls: ToolCall[] }
  | { type: "logs.appended"; stepIndex: number; text: string }
  | { type: "observation.completed"; stepIndex: number; text: string; isFinalAnswer: boolean }
  | { type: "message.delta"; text: string }
  | { type: "message.completed"; text: string }
  | { type: "usage.updated"; usage: TokenUsage }
  | { type: "run.completed"; result: RunResult }
  | { type: "run.failed"; error: AgentErrorInfo }
  | { type: "run.maxStepsReached"; steps: number }
  | { type: "run.cancelled" };

export type AgentEventType = AgentEvent["type"];

/** Extract the event variant for a given type, so consumers can narrow precisely. */
export type AgentEventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>;

/** True for advisory events: progressive enhancement only, never authoritative. */
export function isAdvisory(type: AgentEventType): boolean {
  return type.endsWith(".delta");
}

/** True for the events after which no further event for this run will arrive. */
export function isTerminal(type: AgentEventType): boolean {
  return (
    type === "run.completed" ||
    type === "run.failed" ||
    type === "run.maxStepsReached" ||
    type === "run.cancelled"
  );
}

/** Compile-time exhaustiveness guard. */
export function assertNever(value: never): never {
  throw new Error("Unhandled event: " + JSON.stringify(value));
}

/** Human-readable label, used by devtools and the React step list. */
export function describeEvent(event: AgentEvent): string {
  switch (event.type) {
    case "run.started": return "run started";
    case "planning.started": return "planning";
    case "planning.delta": return "planning";
    case "planning.completed": return "plan";
    case "step.started": return "step " + String(event.stepIndex + 1);
    case "code.delta": return "writing code";
    case "code.completed": return "code";
    case "action.requested": return event.name;
    case "action.result": return event.name + " done";
    case "action.failed": return event.name + " failed";
    case "toolcalls.requested": return String(event.calls.length) + " tool call(s)";
    case "logs.appended": return "output";
    case "observation.completed": return event.isFinalAnswer ? "final answer" : "observation";
    case "message.delta": return "message";
    case "message.completed": return "message";
    case "usage.updated": return "usage";
    case "run.completed": return "run completed";
    case "run.failed": return "run failed";
    case "run.maxStepsReached": return "max steps reached";
    case "run.cancelled": return "run cancelled";
    default: return assertNever(event);
  }
}
