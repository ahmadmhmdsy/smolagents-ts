import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import { AgentCancelledError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const idleExecutor = new ScriptedExecutor({
  handler: () => ({ logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 }),
});

function buildAgent(responses: unknown[], executor = idleExecutor) {
  return new CodeAgent({ model: new MockModel(responses as never), executor });
}

describe("AgentSession", () => {
  it("starts idle with a frozen snapshot", () => {
    const session = new AgentSession(buildAgent([]));
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("idle");
    expect(snapshot.isRunning).toBe(false);
    expect(snapshot.steps).toEqual([]);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("returns the identical snapshot object until something changes", () => {
    const session = new AgentSession(buildAgent([]));
    const first = session.getSnapshot();
    expect(session.getSnapshot()).toBe(first);
    expect(session.getSnapshot()).toBe(first);
  });

  it("respects the useSyncExternalStore contract: getSnapshot is cheap and stable", () => {
    const session = new AgentSession(buildAgent([]));
    let reads = 0;
    const getSnapshot = () => {
      reads += 1;
      return session.getSnapshot();
    };
    const a = getSnapshot();
    const b = getSnapshot();
    expect(a).toBe(b);
    expect(reads).toBe(2);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const executor = new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } });
    const session = new AgentSession(buildAgent([fenced("final_answer(1)")], executor));
    let calls = 0;
    const off = session.subscribe(() => {
      calls += 1;
    });
    await session.send("Q");
    expect(calls).toBeGreaterThan(0);
    off();
    const before = calls;
    session.reset();
    expect(calls).toBe(before);
  });

  it("drives the agent and returns the RunResult", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(9)")], new ScriptedExecutor({ results: { "final_answer(9)": finalAnswerResult(9) } })),
    );
    const result = await session.send("Q");
    expect(result.output).toBe(9);
  });

  it("exposes steps, code, logs and the observation in the snapshot", async () => {
    const executor = new ScriptedExecutor({
      handler: (code, options) => {
        if (code === "final_answer(34)") return finalAnswerResult(34, "34");
        options.onLog?.("34");
        return { logs: "34", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const session = new AgentSession(buildAgent([fenced("compute()"), fenced("final_answer(34)")], executor));
    await session.send("Q");
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("success");
    expect(snapshot.output).toBe(34);
    expect(snapshot.steps).toHaveLength(2);
    expect(snapshot.steps[0]).toMatchObject({ code: "compute()", logs: "34\n", observation: "34" });
    expect(snapshot.steps[1]).toMatchObject({ code: "final_answer(34)", isFinalAnswer: true });
  });

  it("lets the authoritative .completed event overwrite an advisory delta", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { thought: string }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "message.delta", text: "half" });
    apply.apply({ type: "message.delta", text: "-baked" });
    expect(apply.getSnapshot().steps[0]?.thought).toBe("half-baked");

    apply.apply({ type: "message.completed", text: "fully baked" });
    expect(apply.getSnapshot().steps[0]?.thought).toBe("fully baked");
  });

  it("tracks tool calls from pending to complete", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { toolCalls: unknown[] }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "action.requested", callId: "c1", name: "get_weather", args: { city: "Paris" } });
    expect(apply.getSnapshot().steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "get_weather", args: { city: "Paris" }, status: "pending" },
    ]);

    apply.apply({ type: "action.result", callId: "c1", name: "get_weather", output: "sunny", durationMs: 3 });
    expect(apply.getSnapshot().steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "get_weather", args: { city: "Paris" }, status: "ok", output: "sunny", durationMs: 3 },
    ]);
  });

  it("marks a failed tool call as an error", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { toolCalls: { status: string; error?: string }[] }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "action.requested", callId: "c1", name: "boom", args: {} });
    apply.apply({
      type: "action.failed",
      callId: "c1",
      name: "boom",
      error: { name: "AgentToolCallError", message: "tool exploded", code: "AGENT_TOOL_CALL" },
    });
    expect(apply.getSnapshot().steps[0]?.toolCalls[0]).toMatchObject({ status: "error", error: "tool exploded" });
  });

  it("refuses to start a second run while one is in flight", async () => {
    const session = new AgentSession(buildAgent([fenced("final_answer(1)"), fenced("final_answer(2)")]));
    const first = session.send("Q");
    await expect(session.send("Q")).rejects.toThrow(/already running/i);
    await first.catch(() => undefined);
  });

  it("cancels the run and reports it in the snapshot", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(1)")], new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } })),
    );
    const promise = session.send("Q");
    session.cancel();
    await expect(promise).rejects.toBeInstanceOf(AgentCancelledError);
    expect(session.getSnapshot().status).toBe("cancelled");
    expect(session.getSnapshot().isRunning).toBe(false);
  });

  it("resets back to idle", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(1)")], new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } })),
    );
    await session.send("Q");
    session.reset();
    expect(session.getSnapshot().status).toBe("idle");
    expect(session.getSnapshot().steps).toEqual([]);
  });
});
