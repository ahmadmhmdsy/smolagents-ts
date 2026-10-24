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
  "approval.decided": {
    type: "approval.decided", requestId: "c", digest: "v1:0", name: "n",
    stepIndex: 0, outcome: "allowed-once",
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
  "run.limitReached": { type: "run.limitReached", reason: "limitTotalTokens" },
  "run.cancelled": { type: "run.cancelled" },
  "run.waiting": {
    type: "run.waiting",
    result: {
      output: undefined, steps: [], messages: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      timing: { start: 0, end: 1, durationMs: 1 },
      state: "waiting", runId: "r",
      pending: {
        kind: "approval", requestId: "c", argsDigest: "v1:0", toolName: "n",
        stepIndex: 0, createdAt: "2026-10-24T00:00:00.000Z",
      },
    },
  },
  "run.resumed": { type: "run.resumed", runId: "r", requestId: "c", outcome: "allowed-once" },
  "run.transferred": {
    type: "run.transferred",
    result: {
      output: undefined, steps: [], messages: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      timing: { start: 0, end: 1, durationMs: 1 },
      state: "success", runId: "r",
      transfer: { target: "researcher" },
    },
  },
};

describe("the event contract is complete", () => {
  it("covers every declared AgentEventType", () => {
    const declared = Object.keys(SAMPLES).sort();
    expect(declared).toHaveLength(25);
  });

  it("classifies exactly the delta events as advisory", () => {
    const advisory = (Object.keys(SAMPLES) as AgentEventType[]).filter(isAdvisory).sort();
    expect(advisory).toEqual(["code.delta", "message.delta", "planning.delta"]);
  });

  it("classifies exactly the seven terminal events", () => {
    const terminal = (Object.keys(SAMPLES) as AgentEventType[]).filter(isTerminal).sort();
    expect(terminal).toEqual([
      "run.cancelled",
      "run.completed",
      "run.failed",
      "run.limitReached",
      "run.maxStepsReached",
      "run.transferred",
      "run.waiting",
    ]);
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
