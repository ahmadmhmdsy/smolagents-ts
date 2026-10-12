// packages/core/test/run-result.test.ts
import { describe, expect, it } from "vitest";
import { makeRunResult } from "../src/agent/run-result.js";
import { FinalAnswerStep, TaskStep } from "../src/memory/steps.js";

describe("makeRunResult", () => {
  it("reports success and the final answer", () => {
    const steps = [new TaskStep("q"), new FinalAnswerStep(42)];
    const result = makeRunResult({
      runId: "r1",
      output: 42,
      steps,
      start: 1000,
      end: 1500,
      tokenUsage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
    });
    expect(result.state).toBe("success");
    expect(result.output).toBe(42);
    expect(result.runId).toBe("r1");
  });

  it("computes the duration from start and end", () => {
    const result = makeRunResult({
      runId: "r1",
      output: null,
      steps: [],
      start: 1000,
      end: 1500,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    expect(result.timing).toEqual({ start: 1000, end: 1500, durationMs: 500 });
  });

  it("exposes a defensive copy of steps", () => {
    const steps = [new TaskStep("q")];
    const result = makeRunResult({
      runId: "r1",
      output: null,
      steps,
      start: 0,
      end: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    steps.push(new TaskStep("late"));
    expect(result.steps).toHaveLength(1);
  });
});
