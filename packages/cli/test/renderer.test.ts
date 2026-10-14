import type { AgentEvent, RunResult } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { display, renderEvent, supportsColor } from "../src/renderer.js";

const quiet = { verbosity: 0, color: false };
const normal = { verbosity: 1, color: false };
const verbose = { verbosity: 2, color: false };
const colored = { verbosity: 1, color: true };

function runResult(output: unknown): RunResult {
  return {
    output,
    steps: [],
    messages: [],
    tokenUsage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
    timing: { start: 0, end: 1, durationMs: 1 },
    state: "success",
    runId: "run-1",
  };
}

function event<T extends AgentEvent["type"]>(value: Extract<AgentEvent, { type: T }>): AgentEvent {
  return value;
}

describe("renderEvent", () => {
  it("keeps the final answer at the quiet level", () => {
    const text = renderEvent(event({ type: "run.completed", result: runResult("42") }), quiet);

    expect(text).toContain("Final answer: 42");
  });

  it("keeps a failure at the quiet level", () => {
    const text = renderEvent(
      event({ type: "run.failed", error: { name: "AgentError", message: "boom", code: "AGENT_ERROR" } }),
      quiet,
    );

    expect(text).toContain("Run failed: boom");
  });

  it("hides the step frame when quiet and shows it at level one", () => {
    expect(renderEvent(event({ type: "step.started", stepIndex: 0 }), quiet)).toBeUndefined();
    expect(renderEvent(event({ type: "step.started", stepIndex: 0 }), normal)).toContain("[step 1]");
  });

  it("shows the task and the model at level one", () => {
    const text = renderEvent(
      event({ type: "run.started", runId: "r1", task: "do it", modelId: "m" }),
      normal,
    );

    expect(text).toContain("do it");
    expect(text).toContain("m");
  });

  it("shows an observation but not the final observation at level one", () => {
    expect(
      renderEvent(
        event({ type: "observation.completed", stepIndex: 0, text: "done", isFinalAnswer: true }),
        normal,
      ),
    ).toBeUndefined();
    expect(
      renderEvent(
        event({ type: "observation.completed", stepIndex: 0, text: "partial", isFinalAnswer: false }),
        normal,
      ),
    ).toContain("partial");
  });

  it("hides the advisory deltas until level two", () => {
    expect(renderEvent(event({ type: "code.delta", stepIndex: 0, text: "x" }), normal)).toBeUndefined();
    expect(renderEvent(event({ type: "code.delta", stepIndex: 0, text: "x" }), verbose)).toBe("x");
  });

  it("shows the extracted code and usage at level two", () => {
    expect(
      renderEvent(event({ type: "code.completed", stepIndex: 0, code: "final_answer(1)" }), verbose),
    ).toContain("final_answer(1)");
    expect(
      renderEvent(
        event({ type: "usage.updated", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
        normal,
      ),
    ).toBeUndefined();
    expect(
      renderEvent(
        event({ type: "usage.updated", usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 } }),
        verbose,
      ),
    ).toContain("tokens: in 1, out 2, total 3");
  });

  it("clamps a level outside the three it knows", () => {
    expect(renderEvent(event({ type: "step.started", stepIndex: 0 }), { verbosity: -5, color: false })).toBeUndefined();
    expect(renderEvent(event({ type: "step.started", stepIndex: 0 }), { verbosity: 9, color: false })).toContain("[step 1]");
  });

  it("emits escape codes only when color is on", () => {
    const plain = renderEvent(event({ type: "step.started", stepIndex: 0 }), normal) ?? "";
    const painted = renderEvent(event({ type: "step.started", stepIndex: 0 }), colored) ?? "";

    expect(plain).not.toContain("\u001b[");
    expect(painted).toContain("\u001b[");
    expect(painted).toContain("[step 1]");
  });

  it("renders the terminal states at every level", () => {
    expect(renderEvent(event({ type: "run.maxStepsReached", steps: 3 }), quiet)).toContain("3");
    expect(renderEvent(event({ type: "run.cancelled" }), quiet)).toContain("cancelled");
  });
});

describe("supportsColor", () => {
  it("needs a terminal and a cooperating environment", () => {
    expect(supportsColor(true, {})).toBe(true);
    expect(supportsColor(false, {})).toBe(false);
    expect(supportsColor(undefined, {})).toBe(false);
    expect(supportsColor(true, { NO_COLOR: "1" })).toBe(false);
    expect(supportsColor(true, { TERM: "dumb" })).toBe(false);
    expect(supportsColor(true, { NO_COLOR: "" })).toBe(true);
  });
});

describe("display", () => {
  it("prints a string as itself and anything else as JSON", () => {
    expect(display("hello")).toBe("hello");
    expect(display({ a: 1 })).toBe('{\n  "a": 1\n}');
    expect(display(undefined)).toBe("undefined");
  });
});
