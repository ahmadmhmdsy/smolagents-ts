import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import type { RunResult, RunState } from "../src/agent/run-result.js";
import type { AgentEvent } from "../src/events.js";
import type { CodeResult } from "../src/executor.js";
import { scoreRun } from "../src/monitoring/eval.js";
import { buildTrace } from "../src/monitoring/trace.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor } from "../src/testing/scripted-executor.js";

interface Transcript {
  task: string;
  turns: { thought: string; code: string }[];
  logs: Record<string, string>;
  finalAnswer: number;
  expected: { output: number; state: RunState; actionSteps: number; eventTypes: string[] };
}

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

function loadTranscript(): Transcript {
  return JSON.parse(
    readFileSync(new URL("./golden/fibonacci.transcript.json", import.meta.url), "utf8"),
  ) as Transcript;
}

/** The same recorded run the golden replay test uses, driven once and recorded as events. */
async function runTranscript(transcript: Transcript): Promise<{
  events: AgentEvent[];
  result: RunResult;
}> {
  const model = new MockModel(transcript.turns.map((turn) => fenced(turn.thought, turn.code)));
  const executor = new ScriptedExecutor({
    handler: (code, options): CodeResult => {
      const index = transcript.turns.findIndex((turn) => turn.code === code);
      const logs = transcript.logs[String(index)] ?? "";
      if (logs !== "") options.onLog?.(logs);
      if (code.startsWith("final_answer(")) options.finalAnswer.submit(transcript.finalAnswer);
      return { logs, isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
    },
  });

  const events: AgentEvent[] = [];
  let result: RunResult | undefined;
  for await (const event of new CodeAgent<number>({ model, executor }).stream(transcript.task)) {
    events.push(event);
    if (event.type === "run.completed") result = event.result;
  }
  if (result === undefined) throw new Error("the run did not complete");
  return { events, result };
}

describe("buildTrace", () => {
  it("folds a recorded run into a run span with one child span per step", async () => {
    const transcript = loadTranscript();
    const { events } = await runTranscript(transcript);
    // A monotonic fake clock keeps the replay deterministic.
    let tick = 0;
    const trace = buildTrace(events, () => (tick += 1));

    expect(trace.name).toBe("run");
    expect(trace.status).toBe("ok");
    expect(trace.attributes.task).toBe(transcript.task);
    expect(trace.attributes).toEqual(expect.objectContaining({ modelId: expect.any(String) }));
    expect(trace.attributes.state).toBe("success");

    const steps = trace.children.filter((child) => child.name.startsWith("step."));
    expect(steps.map((child) => child.name)).toEqual(["step.0", "step.1"]);
    expect(steps[0]?.attributes.code).toContain("fib");
    expect(steps[1]?.attributes.isFinalAnswer).toBe(true);
    for (const child of trace.children) {
      expect(child.endTimeMs).toBeGreaterThanOrEqual(child.startTimeMs);
    }
  });

  it("marks the run span as an error when the stream ends failed", () => {
    const trace = buildTrace(
      [
        { type: "run.started", runId: "r1", task: "t", modelId: "m" },
        {
          type: "run.failed",
          error: { name: "AgentGenerationError", code: "AGENT_GENERATION", message: "boom" },
        },
      ],
      () => 0,
    );
    expect(trace.status).toBe("error");
    expect(trace.attributes.error).toEqual(expect.objectContaining({ message: "boom" }));
  });
});

describe("scoreRun", () => {
  it("passes the golden transcript, checking every promised field", async () => {
    const transcript = loadTranscript();
    const { events, result } = await runTranscript(transcript);

    const score = scoreRun({ result, events }, transcript.expected);

    expect(score.pass).toBe(true);
    expect(score.checks.map((check) => check.name)).toEqual([
      "output",
      "state",
      "actionSteps",
      "eventTypes",
    ]);
    expect(score.checks.every((check) => check.ok)).toBe(true);
  });

  it("fails and names the divergence when the run does not match", async () => {
    const transcript = loadTranscript();
    const { events, result } = await runTranscript(transcript);

    const score = scoreRun({ result, events }, { ...transcript.expected, actionSteps: 99 });

    expect(score.pass).toBe(false);
    const failedCheck = score.checks.find((check) => !check.ok);
    expect(failedCheck?.name).toBe("actionSteps");
    expect(failedCheck?.detail).toContain("expected 99, got 2");
  });
});
