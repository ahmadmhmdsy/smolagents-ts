import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import type { ApprovalHandler } from "../src/agent/approval.js";
import {
  RunAlreadySettledError,
  RunApprovalMismatchError,
  RunRequestExpiredError,
  RunRequestMismatchError,
} from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import { translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { digestOf } from "../src/utils/digest.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

const TASK = "release the report";
const RUN = "run-1";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function gatedTurn(args: unknown, id = "call-1") {
  return { content: "", finishReason: "tool_calls" as const, toolCalls: [call("secret", args, id)] };
}

function answerTurn(value: unknown) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: value }, "call-answer")],
  };
}

function parkedRun() {
  const counter = vi.fn();
  const store = new MemoryRunStore();
  const secret = tool({
    name: "secret",
    description: "Do the gated thing.",
    inputSchema: z.object({ value: z.number() }),
    execute: (input: { value: number }) => {
      counter(input);
      return "secret-" + String(input.value);
    },
  });
  const park: ApprovalHandler = (request) => ({
    requestId: request.requestId,
    digest: request.digest,
    outcome: "pending",
  });
  return { counter, store, secret, park };
}

function eventTypes(events: readonly AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

function recordOf(store: MemoryRunStore): RunRecord {
  const stored = store.load(RUN);
  if (stored === undefined) throw new Error("no record");
  return translateRecord(stored, RUN);
}

describe("a run parks on a pending approval", () => {
  it("commits waiting with the request id and digest, and runs no tool", async () => {
    const { counter, store, secret, park } = parkedRun();
    const agent = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.stream(TASK, { runId: RUN })) events.push(event);

    const types = eventTypes(events);
    expect(types.filter((type) => type === "run.waiting")).toHaveLength(1);
    expect(types).not.toContain("run.failed");
    expect(counter).not.toHaveBeenCalled();

    const waiting = events.find((event) => event.type === "run.waiting");
    if (waiting?.type !== "run.waiting") throw new Error("no run.waiting event");
    expect(waiting.result.state).toBe("waiting");
    expect(waiting.result.pending).toMatchObject({
      kind: "approval",
      requestId: "call-1",
      toolName: "secret",
    });

    const record = recordOf(store);
    expect(record.status).toBe("waiting");
    expect(record.pending).toMatchObject({
      kind: "approval",
      requestId: "call-1",
      toolName: "secret",
      stepIndex: 0,
    });
    expect(record.pending?.argsDigest).toBe(digestOf({ value: 1 }));
    // Everything before the unfinished step is durable, and the unfinished step is not.
    expect(record.memory.steps.map((step) => step.kind)).toEqual(["task", "system_prompt"]);
  });
});

describe("resuming a parked run", () => {
  it("settles the request once, re-enters the step, and finishes", async () => {
    const { counter, store, secret, park } = parkedRun();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });
    const parked = await first.run(TASK, { runId: RUN });
    const requestId = parked.pending?.requestId;
    expect(requestId).toBe("call-1");

    const askAgain: ApprovalHandler = () => {
      throw new Error("the resumed run asked for a decision instead of honouring the settlement");
    };
    const second = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 }, "call-9"), answerTurn("done")]),
      tools: [secret],
      store,
      approve: askAgain,
    });

    const events: AgentEvent[] = [];
    for await (const event of second.stream(TASK, {
      runId: RUN,
      resume: { requestId: requestId as string, outcome: "allowed-once" },
    })) {
      events.push(event);
    }

    const types = eventTypes(events);
    expect(types.filter((type) => type === "run.resumed")).toHaveLength(1);
    const resumedAt = types.indexOf("run.resumed");
    const resultAt = types.indexOf("action.result");
    expect(resumedAt).toBeGreaterThan(-1);
    expect(resultAt).toBeGreaterThan(resumedAt);

    expect(counter).toHaveBeenCalledTimes(1);
    expect(counter).toHaveBeenCalledWith({ value: 1 });
    const completed = events.find((event) => event.type === "run.completed");
    expect(completed?.type).toBe("run.completed");

    const record = recordOf(store);
    expect(record.status).toBe("completed");
    expect(record.pending).toBeUndefined();
    expect(record.settlements).toHaveLength(1);
    expect(record.settlements?.[0]).toMatchObject({
      requestId: "call-1",
      outcome: "allowed-once",
      argsDigest: digestOf({ value: 1 }),
      stepIndex: 0,
    });
  });

  it("settles a request once: a second resume reports the settled state and runs nothing", async () => {
    const { counter, store, secret, park } = parkedRun();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });
    await first.run(TASK, { runId: RUN });

    const second = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 }, "call-9"), answerTurn("done")]),
      tools: [secret],
      store,
    });
    await second.run(TASK, {
      runId: RUN,
      resume: { requestId: "call-1", outcome: "allowed-once" },
    });

    // A third agent has no model turns left: any model call would throw.
    const third = new ToolCallingAgent({ model: new MockModel([]), tools: [secret], store });
    await expect(
      third.run(TASK, { runId: RUN, resume: { requestId: "call-1", outcome: "allowed-once" } }),
    ).rejects.toBeInstanceOf(RunAlreadySettledError);
    expect(counter).toHaveBeenCalledTimes(1);
    expect(recordOf(store).settlements).toHaveLength(1);
  });

  it("refuses a resume that names another request", async () => {
    const { counter, store, secret, park } = parkedRun();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });
    await first.run(TASK, { runId: RUN });

    const second = new ToolCallingAgent({ model: new MockModel([]), tools: [secret], store });
    await expect(
      second.run(TASK, { runId: RUN, resume: { requestId: "not-the-call", outcome: "allowed-once" } }),
    ).rejects.toBeInstanceOf(RunRequestMismatchError);
    expect(counter).not.toHaveBeenCalled();
  });

  it("refuses a resumed step that asks for other arguments", async () => {
    const { counter, store, secret, park } = parkedRun();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });
    await first.run(TASK, { runId: RUN });

    // The model request is journaled and replayed, so the resumed step asks again for exactly what
    // it asked before; a mismatch can only come from a record whose settlement was bound to other
    // arguments. Rebind it to stand in for that record.
    const waiting = store.load(RUN);
    if (waiting === undefined || waiting.pending === undefined) throw new Error("no waiting record");
    store.commit(RUN, {
      ...waiting,
      pending: { ...waiting.pending, argsDigest: digestOf({ value: 999 }) },
    });

    const second = new ToolCallingAgent({ model: new MockModel([]), tools: [secret], store });
    await expect(
      second.run(TASK, { runId: RUN, resume: { requestId: "call-1", outcome: "allowed-once" } }),
    ).rejects.toBeInstanceOf(RunApprovalMismatchError);
    expect(counter).not.toHaveBeenCalled();
  });

  it("refuses a request past its expiry", async () => {
    const { counter, store, secret, park } = parkedRun();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secret],
      store,
      approve: park,
    });
    await first.run(TASK, { runId: RUN });

    const record = recordOf(store);
    await store.commit(RUN, {
      ...record,
      pending: { ...(record.pending as NonNullable<RunRecord["pending"]>), expiresAt: "2020-01-01T00:00:00.000Z" },
    });

    const second = new ToolCallingAgent({ model: new MockModel([]), tools: [secret], store });
    await expect(
      second.run(TASK, { runId: RUN, resume: { requestId: "call-1", outcome: "allowed-once" } }),
    ).rejects.toBeInstanceOf(RunRequestExpiredError);
    expect(counter).not.toHaveBeenCalled();
  });
});
