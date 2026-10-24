import type { ActionOutcome } from "./agent/action.js";
import type { AgentEventPayload } from "./events.js";
import type { Logger } from "./logger.js";
import type { AgentMemory } from "./memory/memory.js";
import type { AnyAgentStep } from "./memory/steps.js";

/** Everything a middleware may read about the step it is wrapping. */
export interface MiddlewareContext {
  readonly runId: string;
  readonly task: string;
  readonly stepIndex: number;
  readonly step: AnyAgentStep;
  readonly signal: AbortSignal;
  readonly logger: Logger;
  readonly memory: AgentMemory;
  /** Per-run scratch space, shared by every middleware in the chain. */
  readonly state: Map<string, unknown>;
}

/**
 * Wraps action execution. Return the terminal's outcome, or your own to short-circuit.
 *
 * Use yield* next() rather than awaiting a promise: that is what lets a middleware
 * observe, filter, or inject events while they are still flowing.
 */
export type AgentMiddleware = (
  ctx: MiddlewareContext,
  next: () => AsyncGenerator<AgentEventPayload, ActionOutcome>,
) => AsyncGenerator<AgentEventPayload, ActionOutcome>;

export type TerminalAction = () => AsyncGenerator<AgentEventPayload, ActionOutcome>;

/**
 * Koa-style composition over async generators. Calling next() twice within one
 * middleware is a programming error and throws.
 */
export function composeMiddleware(
  middleware: readonly AgentMiddleware[],
): (ctx: MiddlewareContext, terminal: TerminalAction) => AsyncGenerator<AgentEventPayload, ActionOutcome> {
  return (ctx, terminal) => {
    let lastIndex = -1;
    const dispatch = (index: number): AsyncGenerator<AgentEventPayload, ActionOutcome> => {
      if (index <= lastIndex) {
        throw new Error("next() called twice inside a single middleware");
      }
      lastIndex = index;
      const current = middleware[index];
      return current === undefined ? terminal() : current(ctx, () => dispatch(index + 1));
    };
    return dispatch(0);
  };
}
