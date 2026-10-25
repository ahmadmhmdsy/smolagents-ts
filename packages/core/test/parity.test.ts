/**
 * S1.5 — the Python-to-TypeScript parity harness.
 *
 * Every scenario in scripts/parity/scenarios is replayed through our CodeAgent here and
 * compared with the trace scripts/parity/record.py recorded from the installed upstream
 * 1.14.0. The comparison is structural and normalized: the step kinds, the position of the
 * code-execution call, each step's error presence, the final-answer value, and the roles of
 * the messages each side sent its model. Prompt text, code source and observation text are
 * never compared.
 *
 * The recordings are committed rather than produced here, because the Python leg is not in
 * CI. Re-record them with the parity re-recording runbook when the pinned upstream changes.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { CodeAgent } from "../src/agent/code-agent.js";
import type { AgentErrorInfo } from "../src/errors.js";
import { finalAnswerResult, ScriptedExecutor } from "../src/testing/scripted-executor.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ChatMessage } from "../src/types.js";

/** The one upstream release this harness records against. */
const PINNED_UPSTREAM_VERSION = "1.14.0";

/** The label both sides' code-execution call normalizes to. */
const CODE_LABEL = "code";

interface ParityTurn {
  readonly intent: "code" | "final-answer" | "text";
  readonly py: string;
  readonly ts: string;
  readonly observation?: string;
  readonly error?: AgentErrorInfo;
  readonly value?: unknown;
}

interface ParityExpectation {
  readonly parity: "equal" | "divergent";
  readonly differsOn?: readonly string[];
  readonly why?: string;
  readonly ourTrace?: Readonly<Record<string, unknown>>;
}

interface ParityScenario {
  readonly id: string;
  readonly task: string;
  readonly tools: readonly string[];
  readonly planningInterval: number;
  readonly maxSteps: number;
  /** The plan the model returns before each turn the cadence plans at, in order. */
  readonly plans?: readonly { readonly py: string; readonly ts: string }[];
  readonly turns: readonly ParityTurn[];
  readonly expect: ParityExpectation;
}

interface ParityTrace {
  readonly scenario: string;
  readonly outcome: string;
  readonly finalAnswer: unknown;
  readonly steps: readonly string[];
  readonly actions: readonly { readonly toolCalls: readonly string[]; readonly error: boolean }[];
  readonly modelCalls: readonly (readonly string[])[];
}

interface Recording {
  readonly meta: {
    readonly upstreamVersion: string;
    readonly pythonVersion: string;
    readonly recordedAt: string;
    readonly recorder: string;
  };
  readonly trace: ParityTrace;
}

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const SCENARIOS = join(ROOT, "scripts", "parity", "scenarios");
const RECORDINGS = join(ROOT, "scripts", "parity", "recordings");

const scenarioIds = readdirSync(SCENARIOS)
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -".json".length))
  .sort();

function readJson<T>(path: string, what: string): T {
  if (!existsSync(path)) {
    throw new Error(
      "Missing " + what + " at " + path + "; re-run the parity recorder, then this suite.",
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function readScenario(id: string): ParityScenario {
  const scenario = readJson<ParityScenario>(join(SCENARIOS, id + ".json"), "parity scenario");
  if (scenario.id !== id) throw new Error("Scenario " + id + " declares the id " + scenario.id);
  if (!Array.isArray(scenario.tools)) throw new Error("Scenario " + id + " declares no tools list");
  if (scenario.tools.length > 0) {
    throw new Error(
      "Scenario " + id + " declares tools, and neither leg wires them: both runs would ignore them"
        + " and compare equal. Support them in both readers first.",
    );
  }
  if (!Array.isArray(scenario.turns) || scenario.turns.length === 0) {
    throw new Error("Scenario " + id + " has no turns");
  }
  for (const [index, turn] of scenario.turns.entries()) {
    if (typeof turn.ts !== "string" || turn.ts.length === 0) {
      throw new Error("Scenario " + id + " turn " + index + " has no TypeScript script");
    }
    if (turn.intent !== "code" && turn.intent !== "final-answer" && turn.intent !== "text") {
      throw new Error("Scenario " + id + " turn " + index + " has the unknown intent " + turn.intent);
    }
  }
  if (scenario.expect.parity !== "equal" && scenario.expect.parity !== "divergent") {
    throw new Error("Scenario " + id + " declares no expectation");
  }
  for (const [index, plan] of (scenario.plans ?? []).entries()) {
    if (typeof plan.ts !== "string" || plan.ts.length === 0) {
      throw new Error("Scenario " + id + " plan " + index + " has no TypeScript script");
    }
  }
  return scenario;
}

/**
 * The scripted replies in call order: a plan before each turn the cadence plans at, which is
 * the same interleave scripts/parity/record.py hands upstream. A plan the cadence never asks
 * for would shift every later reply by one, so it is refused rather than left unused.
 */
function scriptedReplies(scenario: ParityScenario): string[] {
  const plans = scenario.plans ?? [];
  let planIndex = 0;
  const replies: string[] = [];
  for (const [index, turn] of scenario.turns.entries()) {
    if (
      scenario.planningInterval > 0 &&
      index % scenario.planningInterval === 0 &&
      planIndex < plans.length
    ) {
      replies.push(plans[planIndex]?.ts ?? "");
      planIndex += 1;
    }
    replies.push(turn.ts);
  }
  if (planIndex < plans.length) {
    throw new Error(
      "Scenario " +
        scenario.id +
        " declares " +
        String(plans.length - planIndex) +
        " plan(s) the cadence never asks for",
    );
  }
  return replies;
}

/**
 * The canonical role vocabulary. Our transcript renders an observation as a `user` message
 * where upstream uses `tool-response`, and an upstream `tool-call` folds into the assistant
 * turn it belongs to; consecutive duplicates then collapse, because the two sides split that
 * turn differently.
 */
function normalizeRoles(messages: readonly ChatMessage[]): string[] {
  const roles: string[] = [];
  for (const message of messages) {
    const content = typeof message.content === "string" ? message.content : "";
    let canonical: string | undefined;
    if (message.role === "system") canonical = "system";
    else if (message.role === "user") canonical = content.startsWith("Observation:") ? "observation" : "user";
    else if (message.role === "assistant") canonical = "assistant";
    else if (message.role === "tool") canonical = "observation";
    if (canonical === undefined) continue;
    if (roles[roles.length - 1] === canonical) continue;
    roles.push(canonical);
  }
  return roles;
}

async function replay(scenario: ParityScenario): Promise<ParityTrace> {
  // Only the turns that produce an action reach the executor, in scenario order: a
  // prose turn is recorded by the loop as a parsing error and never executes.
  const executing = scenario.turns.filter((turn) => turn.intent !== "text");
  let index = 0;
  const model = new MockModel(scriptedReplies(scenario));
  const executor = new ScriptedExecutor({
    handler: (code, options) => {
      const turn = executing[index];
      index += 1;
      if (turn === undefined) {
        throw new Error("Scenario " + scenario.id + " executed more steps than it scripts: " + code);
      }
      if (turn.intent === "final-answer") {
        options.finalAnswer.submit(turn.value);
        return finalAnswerResult(turn.value, turn.observation ?? "");
      }
      if (turn.error !== undefined) {
        return { logs: "", isFinalAnswer: false, error: turn.error, durationMs: 0, toolCallCount: 0 };
      }
      return { logs: turn.observation ?? "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
    },
  });

  const agent = new CodeAgent({
    model,
    executor,
    maxSteps: scenario.maxSteps,
    planningInterval: scenario.planningInterval,
  });

  let outcome = "error";
  let finalAnswer: unknown = null;
  for await (const event of agent.stream(scenario.task)) {
    if (event.type === "run.completed") {
      outcome = "final-answer";
      finalAnswer = event.result.output;
    } else if (event.type === "run.maxStepsReached") {
      outcome = "max-steps";
      finalAnswer = null;
    } else if (event.type === "run.failed") {
      outcome = "error";
      finalAnswer = null;
    } else if (event.type === "run.cancelled") {
      outcome = "cancelled";
      finalAnswer = null;
    }
  }

  const steps: string[] = [];
  const actions: { toolCalls: string[]; error: boolean }[] = [];
  // The same read the recorder makes of upstream's memory.steps: T-20 made it public.
  for (const step of agent.steps) {
    if (step.kind === "planning") {
      steps.push("planning");
      continue;
    }
    if (step.kind !== "action") continue;
    steps.push("action");
    const action = step;
    // Upstream records the code-execution call as python_interpreter on tool_calls; our loop
    // records it on codeAction. Both normalize to one label.
    const toolCalls = action.codeAction === null ? [] : [CODE_LABEL];
    for (const call of action.toolCalls) toolCalls.push(call.name);
    actions.push({ toolCalls, error: action.error !== undefined });
  }

  return {
    scenario: scenario.id,
    outcome,
    finalAnswer,
    steps,
    actions,
    modelCalls: model.calls.map(normalizeRoles),
  };
}

function differs(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

describe("S1.5 parity with upstream smolagents", () => {
  it("records every scenario", () => {
    const recorded = new Set(
      readdirSync(RECORDINGS)
        .filter((file) => file.endsWith(".json"))
        .map((file) => file.slice(0, -".json".length)),
    );
    expect(scenarioIds.filter((id) => !recorded.has(id))).toEqual([]);
  });

  it.each(scenarioIds)("%s replays to the recorded trace", async (id) => {
    const scenario = readScenario(id);
    const recording = readJson<Recording>(
      join(RECORDINGS, id + ".json"),
      "parity recording",
    );

    // A recording made against another upstream would silently compare the wrong thing.
    expect(recording.meta.upstreamVersion).toBe(PINNED_UPSTREAM_VERSION);

    const ours = await replay(scenario);

    // A divergent scenario cannot compare some fields, so it pins our side's values instead.
    for (const [field, expected] of Object.entries(scenario.expect.ourTrace ?? {})) {
      expect((ours as unknown as Record<string, unknown>)[field]).toEqual(expected);
    }

    if (scenario.expect.parity === "equal") {
      expect(ours).toEqual(recording.trace);
      return;
    }

    const fields = Object.keys(recording.trace).filter((field) => field !== "scenario");
    const differing = fields.filter(
      (field) => differs((ours as unknown as Record<string, unknown>)[field], (recording.trace as unknown as Record<string, unknown>)[field]),
    );
    expect(differing.sort()).toEqual([...(scenario.expect.differsOn ?? [])].sort());
  });
});
