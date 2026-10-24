import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { ApprovalHandler } from "../src/agent/approval.js";
import { RunMessageRefusedError } from "../src/errors.js";
import { FileRunStore, type RunFileSystem } from "../src/session/file-run-store.js";
import { sendRunMessage } from "../src/session/messages.js";
import {
  RUN_RECORD_VERSION,
  translateRecord,
  type RunRecord,
} from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
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

function record(runId: string, overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "running",
    generation: 0,
    memory: { steps: [] },
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

function secretTool() {
  return tool({
    name: "secret",
    description: "Do the gated thing.",
    inputSchema: z.object({ value: z.number() }),
    execute: (input: { value: number }) => "secret-" + String(input.value),
  });
}

const park: ApprovalHandler = (request) => ({
  requestId: request.requestId,
  digest: request.digest,
  outcome: "pending",
});

function recordOf(store: MemoryRunStore, runId = RUN): RunRecord {
  const stored = store.load(runId);
  if (stored === undefined) throw new Error("the store holds no record for run " + runId);
  return translateRecord(stored, runId);
}

class MemoryFiles implements RunFileSystem {
  readonly files = new Map<string, string>();

  async read(path: string): Promise<string | undefined> {
    return this.files.get(path);
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async rename(from: string, to: string): Promise<void> {
    const data = this.files.get(from);
    if (data === undefined) throw new Error("rename source does not exist: " + from);
    this.files.delete(from);
    this.files.set(to, data);
  }

  async delete(path: string): Promise<void> {
    this.files.delete(path);
  }

  async list(): Promise<string[]> {
    return [...this.files.keys()];
  }
}

describe("sending a run a message", () => {
  it("appends an entry with the sender and returns an accepted receipt", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secretTool()],
      store,
      approve: park,
    });
    await agent.run(TASK, { runId: RUN });
    const before = recordOf(store);

    const receipt = await sendRunMessage(store, RUN, { from: "user", text: "hurry up" });

    expect(receipt.accepted).toBe(true);
    expect(receipt.runId).toBe(RUN);
    const after = recordOf(store);
    expect(after.messages).toHaveLength(1);
    expect(after.messages?.[0]).toMatchObject({
      id: receipt.messageId,
      from: "user",
      text: "hurry up",
    });
    expect(after.messages?.[0]?.deliveredAt).toBeUndefined();
    expect(after.status).toBe(before.status);
    expect(after.generation).toBe(before.generation);
  });

  it("delivers the text at the target's next step and marks it on the record", async () => {
    const store = new MemoryRunStore();
    const notify = tool({
      name: "notify",
      description: "Tell the caller the header changed.",
      inputSchema: z.object({}),
      async execute() {
        await sendRunMessage(store, RUN, { from: "user", text: "header updated" });
        return "noted";
      },
    });
    const model = new MockModel([
      { content: "", finishReason: "tool_calls", toolCalls: [call("notify", {}, "n1")] },
      answerTurn("done"),
    ]);
    const agent = new ToolCallingAgent({ model, tools: [notify], store });

    const result = await agent.run(TASK, { runId: RUN });

    const messageSteps = result.steps.filter((step) => step.kind === "message");
    expect(messageSteps).toHaveLength(1);
    expect(messageSteps[0]).toMatchObject({ from: "user", text: "header updated" });
    // The step that followed the send saw the message as an ordinary user turn.
    const secondTranscript = model.calls[1] ?? [];
    expect(secondTranscript.some((turn) => turn.content === "user: header updated")).toBe(true);

    const stored = recordOf(store);
    expect(stored.messages).toHaveLength(1);
    expect(stored.messages?.[0]?.deliveredAt).toBeDefined();
    expect(stored.messages?.[0]?.deliveredStep).toBe(1);
  });

  it("delivers a message sent to a parked run on the resumed step", async () => {
    const store = new MemoryRunStore();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secretTool()],
      store,
      approve: park,
    });
    const parked = await first.run(TASK, { runId: RUN });
    const requestId = parked.pending?.requestId as string;
    await sendRunMessage(store, RUN, { from: "user", text: "approved out of band" });

    const second = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 }, "call-9"), answerTurn("done")]),
      tools: [secretTool()],
      store,
      approve: () => {
        throw new Error("the resumed run asked instead of honouring the settlement");
      },
    });
    const result = await second.run(TASK, {
      runId: RUN,
      resume: { requestId, outcome: "allowed-once" },
    });

    const messageSteps = result.steps.filter((step) => step.kind === "message");
    expect(messageSteps).toHaveLength(1);
    expect(messageSteps[0]).toMatchObject({ from: "user", text: "approved out of band" });
    const stored = recordOf(store);
    expect(stored.messages?.[0]?.deliveredAt).toBeDefined();
    expect(stored.messages?.[0]?.deliveredStep).toBe(0);
  });

  it("does not deliver an entry that is already marked delivered", async () => {
    const store = new MemoryRunStore();
    const first = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 })]),
      tools: [secretTool()],
      store,
      approve: park,
    });
    const parked = await first.run(TASK, { runId: RUN });
    const requestId = parked.pending?.requestId as string;
    const receipt = await sendRunMessage(store, RUN, { from: "user", text: "already seen" });
    // A delivery whose commit landed leaves this stamp; the resumed run must not repeat it.
    const waiting = recordOf(store);
    await store.commit(
      RUN,
      {
        ...waiting,
        messages: (waiting.messages ?? []).map((message) =>
          message.id === receipt.messageId
            ? { ...message, deliveredAt: "2026-10-24T00:00:00.000Z", deliveredStep: 0 }
            : message,
        ),
      },
      waiting.generation,
    );

    const second = new ToolCallingAgent({
      model: new MockModel([gatedTurn({ value: 1 }, "call-9"), answerTurn("done")]),
      tools: [secretTool()],
      store,
      approve: () => {
        throw new Error("the resumed run asked instead of honouring the settlement");
      },
    });
    const result = await second.run(TASK, {
      runId: RUN,
      resume: { requestId, outcome: "allowed-once" },
    });

    expect(result.steps.filter((step) => step.kind === "message")).toHaveLength(0);
    expect(recordOf(store).messages?.[0]?.deliveredStep).toBe(0);
  });

  it("refuses an unknown run and a finished one with a typed error", async () => {
    const store = new MemoryRunStore();
    await expect(
      sendRunMessage(store, "missing", { from: "user", text: "hello" }),
    ).rejects.toBeInstanceOf(RunMessageRefusedError);

    await store.commit(
      RUN,
      record(RUN, {
        status: "completed",
        memory: { steps: [{ id: "s1", createdAt: 0, kind: "task", task: TASK }] },
      }),
    );
    await expect(
      sendRunMessage(store, RUN, { from: "user", text: "too late" }),
    ).rejects.toBeInstanceOf(RunMessageRefusedError);
    expect(recordOf(store).messages).toBeUndefined();
  });

  it("round-trips the message through the file store", async () => {
    const files = new MemoryFiles();
    const store = new FileRunStore(files);
    await store.commit(RUN, record(RUN));

    const receipt = await sendRunMessage(store, RUN, { from: "supervisor", text: "status?" });

    const stored = await store.load(RUN);
    if (stored === undefined) throw new Error("the file store lost the record");
    const loaded = translateRecord(stored, RUN);
    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages?.[0]).toMatchObject({
      id: receipt.messageId,
      from: "supervisor",
      text: "status?",
    });
    expect(loaded.messages?.[0]?.sentAt).toBeDefined();
  });
});
