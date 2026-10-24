import type { RunResult } from "./agent/run-result.js";
import type { AgentErrorInfo } from "./errors.js";
import type { TokenUsage, ToolCall } from "./types.js";
import type { ApprovalOutcome } from "./agent/approval.js";
import type { LimitStopReason } from "./session/budget.js";

/**
 * Every observable thing that happens during a run.
 *
 * CONTRACT (design spec 6.3): an event whose type ends in ".delta" is ADVISORY.
 * A stream may be coalesced, retried, or replayed, so consumers must converge on the
 * matching ".completed" event. AgentSession implements this rule and never lets a delta
 * mutate its authoritative snapshot.
 */
export type AgentEventPayload =
  | {
      type: "run.started";
      runId: string;
      task: string;
      modelId: string;
      /** The adapter family that answers this run, when the model names one. */
      provider?: string;
    }
  | { type: "planning.started"; stepIndex: number }
  | { type: "planning.delta"; stepIndex: number; text: string }
  | { type: "planning.completed"; stepIndex: number; text: string }
  | { type: "step.started"; stepIndex: number }
  | { type: "code.delta"; stepIndex: number; text: string }
  | { type: "code.completed"; stepIndex: number; code: string }
  | { type: "action.requested"; callId: string; name: string; args: unknown }
  | { type: "action.progress"; callId: string; name: string; progress: unknown }
  | { type: "action.result"; callId: string; name: string; output: unknown; durationMs: number }
  | { type: "action.failed"; callId: string; name: string; error: AgentErrorInfo }
  | { type: "approval.decided"; requestId: string; digest: string; name: string; stepIndex: number; outcome: ApprovalOutcome; reason?: string }
  | { type: "toolcalls.requested"; stepIndex: number; calls: ToolCall[] }
  | {
      type: "tool.policy";
      stepIndex: number;
      advertised: readonly string[];
      hidden: readonly { name: string; reason?: string }[];
      forced: readonly string[];
      required: readonly { tool: string; reason: string }[];
    }
  | { type: "tool.requirementUnmet"; stepIndex: number; tool: string; reason: string }
  | { type: "logs.appended"; stepIndex: number; text: string }
  | { type: "observation.completed"; stepIndex: number; text: string; isFinalAnswer: boolean }
  | { type: "message.delta"; text: string }
  | { type: "message.completed"; text: string }
  | {
      type: "memory.condensed";
      forgotten: readonly string[];
      summary: string;
      trigger: "soft" | "hard";
    }
  | { type: "usage.updated"; usage: TokenUsage }
  | { type: "run.completed"; result: RunResult }
  | { type: "run.failed"; error: AgentErrorInfo }
  | { type: "run.maxStepsReached"; steps: number }
  | { type: "run.limitReached"; reason: LimitStopReason }
  | { type: "run.cancelled" }
  | { type: "run.waiting"; result: RunResult }
  | { type: "run.transferred"; result: RunResult }
  | { type: "run.resumed"; runId: string; requestId: string; outcome: ApprovalOutcome };

/**
 * Every event a run emits, carrying the path of the agents that produced it and its position in
 * the run's stream. The root run's path is empty; a managed child appends its own name to its
 * parent's path. `seq` is assigned once, by the loop's emit helper, and never rewritten: a client
 * that kept the last seq it saw can ask for everything after it.
 */
export type AgentEvent = AgentEventPayload & {
  readonly agentPath?: readonly string[];
  readonly seq: number;
};

export type AgentEventType = AgentEventPayload["type"];

/** Extract the event variant for a given type, so consumers can narrow precisely. */
export type AgentEventOf<T extends AgentEventType> = Extract<AgentEventPayload, { type: T }> & {
  readonly agentPath?: readonly string[];
};

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
    type === "run.limitReached" ||
    type === "run.cancelled" ||
    type === "run.transferred" ||
    // A parked run ends this stream too: no further event arrives until a resume starts a new one.
    type === "run.waiting"
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
    case "action.progress": return event.name + " progress";
    case "action.result": return event.name + " done";
    case "action.failed": return event.name + " failed";
    case "approval.decided": return event.outcome === "allowed-once" ? "approval granted" : "approval " + event.outcome;
    case "toolcalls.requested": return String(event.calls.length) + " tool call(s)";
    case "tool.policy": return "tools for this step";
    case "tool.requirementUnmet": return event.tool + " required";
    case "logs.appended": return "output";
    case "observation.completed": return event.isFinalAnswer ? "final answer" : "observation";
    case "message.delta": return "message";
    case "message.completed": return "message";
    case "memory.condensed": return "memory condensed";
    case "usage.updated": return "usage";
    case "run.completed": return "run completed";
    case "run.failed": return "run failed";
    case "run.maxStepsReached": return "max steps reached";
    case "run.limitReached": return "budget limit reached";
    case "run.cancelled": return "run cancelled";
    case "run.waiting": return "run waiting for a decision";
    case "run.transferred": return "run transferred";
    case "run.resumed": return "run resumed";
    default: return assertNever(event);
  }
}
