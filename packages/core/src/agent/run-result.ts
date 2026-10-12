import type { AnyAgentStep } from "../memory/steps.js";
import type { ChatMessage, Timing, TokenUsage } from "../types.js";

export type RunState = "success" | "max_steps_reached";

export interface RunResult<TOut = unknown> {
  readonly output: TOut;
  readonly steps: readonly AnyAgentStep[];
  readonly messages: readonly ChatMessage[];
  readonly tokenUsage: TokenUsage;
  readonly timing: Timing;
  readonly state: RunState;
  readonly runId: string;
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
  };
}
