import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentEventType } from "../src/events.js";
import { assertNever, isAdvisory, isTerminal } from "../src/events.js";

const SAMPLES: Record<AgentEventType, AgentEvent> = {
  "run.started": { type: "run.started", runId: "r", task: "t", modelId: "m" },
  "planning.started": { type: "planning.started", stepIndex: 0 },
  "planning.delta": { type: "planning.delta", stepIndex: 0, text: "x" },
  "planning.completed": { type: "planning.completed", stepIndex: 0, text: "x" },
  "step.started": { type: "step.started", stepIndex: 0 },
  "code.delta": { type: "code.delta", stepIndex: 0, text: "x" },
  "code.completed": { type: "code.completed", stepIndex: 0, code: "x" },
  "action.requested": { type: "action.requested", callId: "c", name: "n", args: {} },
  "action.result": { type: "action.result", callId: "c", name: "n", output: 1, durationMs: 2 },
  "action.failed": {
    type: "action.failed", callId: "c", name: "n",
    error: { name: "AgentError", message: "m", code: "AGENT_TOOL_CALL" },
  },
  "toolcalls.requested": { type: "toolcalls.requested", stepIndex: 0, calls: [] },
  "logs.appended": { type: "logs.appended", stepIndex: 0, text: "log" },
  "observation.completed": { type: "observation.completed", stepIndex: 0, text: "o", isFinalAnswer: false },
  "message.delta": { type: "message.delta", text: "x" },
  "message.completed": { type: "message.completed", text: "x" },
  "usage.updated": { type: "usage.updated", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  "run.completed": {
    type: "run.completed",
    result: {
      output: 1, steps: [], messages: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      timing: { start: 0, end: 1, durationMs: 1 },
      state: "success", runId: "r",
    },
  },
  "run.failed": { type: "run.failed", error: { name: "AgentError", message: "m", code: "AGENT_ERROR" } },
  "run.maxStepsReached": { type: "run.maxStepsReached", steps: 10 },
  "run.cancelled": { type: "run.cancelled" },
};

describe("the event contract is complete", () => {
  it("covers every declared AgentEventType", () => {
    const declared = Object.keys(SAMPLES).sort();
    expect(declared).toHaveLength(20);
  });

  it("classifies exactly the delta events as advisory", () => {
    const advisory = (Object.keys(SAMPLES) as AgentEventType[]).filter(isAdvisory).sort();
    expect(advisory).toEqual(["code.delta", "message.delta", "planning.delta"]);
  });

  it("classifies exactly the four terminal events", () => {
    const terminal = (Object.keys(SAMPLES) as AgentEventType[]).filter(isTerminal).sort();
    expect(terminal).toEqual(["run.cancelled", "run.completed", "run.failed", "run.maxStepsReached"]);
  });

  it("treats every completed event as authoritative", () => {
    for (const [type, event] of Object.entries(SAMPLES)) {
      if (type.endsWith(".completed")) {
        expect(isAdvisory(type as AgentEventType)).toBe(false);
        expect(event.type).toBe(type);
      }
    }
  });
});

describe("assertNever", () => {
  it("throws with the offending value", () => {
    expect(() => assertNever({ type: "unknown" } as never)).toThrow(/Unhandled event/);
  });
});
