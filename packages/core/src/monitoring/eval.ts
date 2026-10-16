import type { RunResult, RunState } from "../agent/run-result.js";
import type { AgentEvent } from "../events.js";

/** What a recorded transcript promises a run will produce. Every field is optional. */
export interface TranscriptExpectation {
  readonly output?: unknown;
  readonly state?: RunState;
  readonly actionSteps?: number;
  readonly eventTypes?: readonly string[];
}

/** One assertion an eval made, with the detail a failure needs to be readable. */
export interface EvalCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

/** The eval outcome: `pass` when every check held. */
export interface EvalScore {
  readonly pass: boolean;
  readonly checks: readonly EvalCheck[];
}

/**
 * Score one completed run against a transcript's expectations — output, state, action-step count
 * and the event-type sequence. The whole check list is returned rather than a bare boolean, so a
 * failing fixture says which part diverged. Compares by JSON value, which is enough for the
 * scalar and array shapes a transcript records.
 */
export function scoreRun(
  actual: { readonly result: RunResult; readonly events: readonly AgentEvent[] },
  expected: TranscriptExpectation,
): EvalScore {
  const checks: EvalCheck[] = [];
  const add = (name: string, ok: boolean, detail: string): void => {
    checks.push({ name, ok, detail });
  };

  if ("output" in expected) {
    const ok = sameValue(actual.result.output, expected.output);
    add("output", ok, ok ? "matches" : describe("output", expected.output, actual.result.output));
  }
  if (expected.state !== undefined) {
    const ok = actual.result.state === expected.state;
    add("state", ok, ok ? "matches" : describe("state", expected.state, actual.result.state));
  }
  if (expected.actionSteps !== undefined) {
    const count = actual.result.steps.filter((step) => step.kind === "action").length;
    const ok = count === expected.actionSteps;
    add("actionSteps", ok, ok ? "matches" : describe("actionSteps", expected.actionSteps, count));
  }
  if (expected.eventTypes !== undefined) {
    const wanted = expected.eventTypes;
    const got = actual.events.map((event) => event.type);
    const ok = got.length === wanted.length && got.every((type, index) => type === wanted[index]);
    add("eventTypes", ok, ok ? "matches" : describe("eventTypes", wanted.join(", "), got.join(", ")));
  }

  return { pass: checks.every((check) => check.ok), checks };
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function describe(name: string, expected: unknown, actual: unknown): string {
  return name + ": expected " + JSON.stringify(expected) + ", got " + JSON.stringify(actual);
}
