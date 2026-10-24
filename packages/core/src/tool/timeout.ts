import { AgentCancelledError, ToolTimeoutError } from "../errors.js";

/**
 * The deadline every tool gets when its definition names none. Finite on purpose: a tool that
 * never settles would otherwise hold a step until the run's own deadline, and a step has none.
 * A managed agent is a tool too, so the default is generous rather than tight.
 */
export const DEFAULT_TOOL_TIMEOUT_MS = 120_000;

/** A limit of 0 disables the deadline; any other value must be a positive number of milliseconds. */
export function resolveToolTimeout(limitMs: number | undefined): number {
  return limitMs ?? DEFAULT_TOOL_TIMEOUT_MS;
}

/**
 * Race a tool call against its deadline. The timer replaces a result only when its own timer
 * fired: a value that settled first wins, and a late rejection from the losing side is swallowed
 * so it cannot surface as an unhandled rejection.
 *
 * Cancellation is kept apart from the deadline. An abort lets the tool's own handler settle
 * first — a transport that watches the signal already reports its own cancellation, and that
 * report is the one the caller needs. Only a tool that stays silent through the abort gets the
 * wrapper's `AgentCancelledError`, and a timer that fires on an aborted run is classified as
 * cancellation rather than as a timeout.
 */
export function withToolTimeout<T>(
  tool: string,
  limitMs: number,
  signal: AbortSignal,
  run: () => Promise<T> | T,
): Promise<T> {
  if (limitMs <= 0 || !Number.isFinite(limitMs)) return Promise.resolve().then(run);
  return new Promise<T>((resolve, reject) => {
    const state: { settled: boolean; timer?: ReturnType<typeof setTimeout> } = { settled: false };
    const finish = (apply: () => void): void => {
      if (state.settled) return;
      state.settled = true;
      if (state.timer !== undefined) clearTimeout(state.timer);
      signal.removeEventListener("abort", onAbort);
      apply();
    };
    const onAbort = (): void => {
      // A tool that watches the signal rejects in the same turn; give it that turn before the
      // wrapper's fallback speaks, so its own cancellation error is never masked by this one.
      setTimeout(() => {
        finish(
          () => reject(new AgentCancelledError("The run was aborted while tool " + tool + " was running.")),
        );
      }, 0);
    };
    state.timer = setTimeout(() => {
      finish(() =>
        reject(
          signal.aborted
            ? new AgentCancelledError("The run was aborted while tool " + tool + " was running.")
            : ToolTimeoutError.forTool(tool, limitMs),
        ),
      );
    }, limitMs);
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    let pending: Promise<T>;
    try {
      pending = Promise.resolve(run());
    } catch (error) {
      finish(() => reject(error));
      return;
    }
    pending.then(
      (value) => {
        finish(() => resolve(value));
      },
      (error: unknown) => {
        finish(() => reject(error));
      },
    );
  });
}
