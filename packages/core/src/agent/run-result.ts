import type { AnyAgentStep } from "../memory/steps.js";
import type { PendingApproval } from "../session/run-record.js";
import type { ChatMessage, Timing, TokenUsage } from "../types.js";
import type { RunBudget } from "../session/budget.js";

export type RunState = "success" | "max_steps_reached" | "waiting";

export interface RunResult<TOut = unknown> {
  readonly output: TOut;
  readonly steps: readonly AnyAgentStep[];
  readonly messages: readonly ChatMessage[];
  readonly tokenUsage: TokenUsage;
  readonly timing: Timing;
  readonly state: RunState;
  readonly runId: string;
  /** What the run was allowed to spend and what it spent. Absent only on a result built by hand. */
  readonly budget?: Readonly<RunBudget>;
  /** The request the run parked on, when `state` is `waiting`. */
  readonly pending?: PendingApproval;
}

export interface MakeRunResultInput<TOut> {
  runId: string;
  output: TOut;
  steps: readonly AnyAgentStep[];
  messages?: readonly ChatMessage[];
  start: number;
  end: number;
  tokenUsage: TokenUsage;
  state?: RunState;
  budget?: Readonly<RunBudget>;
  pending?: PendingApproval;
}

export function makeRunResult<TOut>(input: MakeRunResultInput<TOut>): RunResult<TOut> {
  return {
    output: input.output,
    steps: [...input.steps],
    messages: [...(input.messages ?? [])],
    tokenUsage: input.tokenUsage,
    timing: { start: input.start, end: input.end, durationMs: input.end - input.start },
    state: input.state ?? "success",
    runId: input.runId,
    ...(input.budget === undefined ? {} : { budget: { ...input.budget } }),
    ...(input.pending === undefined ? {} : { pending: input.pending }),
  };
}
