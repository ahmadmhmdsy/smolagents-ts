import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ApprovalHandler } from "../src/agent/approval.js";
import {
  listChildren,
  resumeBackgroundChild,
  startBackgroundChild,
  type ChildRow,
} from "../src/agent/background-child.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { TaskStaleRevisionError } from "../src/errors.js";
import { FileRunStore, type RunFileSystem } from "../src/session/file-run-store.js";
import { claimTask, createTask, listBoard } from "../src/session/claim-board.js";
import { sendRunMessage } from "../src/session/messages.js";
import { RUN_RECORD_VERSION, translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore, type RunStore } from "../src/session/run-store.js";
import { waitForRun } from "../src/session/wait.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function answer(value: unknown, id = "answer"): ToolCallRequest {
  return call(FINAL_ANSWER_TOOL_NAME, { answer: value }, id);
}

function turn(...calls: ToolCallRequest[]): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return { content: "", finishReason: "tool_calls", toolCalls: calls };
}

function parentRecord(runId: string, children: readonly ChildRow[] = []): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "completed",
    generation: 0,
    memory: { steps: [] },
    ...(children.length === 0 ? {} : { children }),
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };
}

async function settle(store: RunStore, parentRunId: string, runId: string): Promise<ChildRow> {
  const deadline = Date.now() + 2_000;
  for (;;) {
    const rows = await listChildren(store, parentRunId);
    const found = rows.find((entry) => entry.runId === runId);
    if (found !== undefined && (found.phase === "completed" || found.phase === "failed")) return found;
    if (Date.now() > deadline) throw new Error("the child's row never settled");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

const park: ApprovalHandler = (request) => ({
  requestId: request.requestId,
  digest: request.digest,
  outcome: "pending",
});

function secretTool() {
  return tool({
    name: "secret",
    description: "Do the gated thing.",
    inputSchema: z.object({ value: z.number() }),
    execute: (input: { value: number }) => "secret-" + String(input.value),
  });
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

describe("Phase 2 exit criterion", () => {
  it("re-attaches to a child's typed result after the parent ended", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    const child = new ToolCallingAgent({
      model: new MockModel([turn(answer("forty-two"))]),
      store,
    });

    const handle = await startBackgroundChild({
      store,
      parentRunId: "parent-run",
      agent: child,
      agentName: "computer",
      task: "compute the answer",
    });
    const result = await handle.done;
    expect(result.state).toBe("success");
    const row = await settle(store, "parent-run", handle.runId);
    expect(row.phase).toBe("completed");

    // A later call re-attaches with a fresh agent that must not run again.
    const reattached = await resumeBackgroundChild(
      store,
      "parent-run",
      handle.runId,
      new ToolCallingAgent({ model: new MockModel([]) }),
    );
    expect(reattached.report).toMatchObject({ stopReason: "success", value: "forty-two" });

    const stored = store.load(handle.runId);
    expect(stored).toBeDefined();
    const childRecord = translateRecord(stored as RunRecord, handle.runId);
    expect(childRecord.parentRunId).toBe("parent-run");
  });

  it("delivers a message to a running child at its next step and to a parked one on resume", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));

    // A running child sends itself a message mid-run; the next step sees it.
    const notify = tool({
      name: "notify",
      description: "Tell the caller the header changed.",
      inputSchema: z.object({}),
      async execute() {
        await sendRunMessage(store, "child-live", { from: "user", text: "header updated" });
        return "noted";
      },
    });
    const live = new ToolCallingAgent({
      model: new MockModel([turn(call("notify", {}, "n1")), turn(answer("done"))]),
      tools: [notify],
      store,
    });
    const liveResult = await live.run("release the report", {
      runId: "child-live",
      parentRunId: "parent-run",
      agentPath: ["reporter"],
    });
    expect(liveResult.steps.filter((step) => step.kind === "message")).toHaveLength(1);

    // A parked child accepts the message and delivers it on the resumed step.
    const first = new ToolCallingAgent({
      model: new MockModel([turn(call("secret", { value: 1 }, "call-1"))]),
      tools: [secretTool()],
      store,
      approve: park,
    });
    const parked = await first.run("release the report", {
      runId: "child-parked",
      parentRunId: "parent-run",
      agentPath: ["reporter"],
    });
    const requestId = parked.pending?.requestId as string;
    await sendRunMessage(store, "child-parked", { from: "user", text: "approved out of band" });

    const second = new ToolCallingAgent({
      model: new MockModel([
        turn(call("secret", { value: 1 }, "call-9")),
        turn(answer("done")),
      ]),
      tools: [secretTool()],
      store,
      approve: () => {
        throw new Error("the resumed run asked instead of honouring the settlement");
      },
    });
    const resumed = await second.run("release the report", {
      runId: "child-parked",
      parentRunId: "parent-run",
      agentPath: ["reporter"],
      resume: { requestId, outcome: "allowed-once" },
    });
    const messageSteps = resumed.steps.filter((step) => step.kind === "message");
    expect(messageSteps).toHaveLength(1);
    expect(messageSteps[0]).toMatchObject({ from: "user", text: "approved out of band" });
  });

  it("waits without claiming when nothing can move", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));

    const ended = await waitForRun(store, "parent-run");
    expect(ended.noProgress).toBe(true);
    expect(ended.settled).toBe(true);
    expect(ended.record?.runId).toBe("parent-run");

    const missing = await waitForRun(store, "no-such-run");
    expect(missing.noProgress).toBe(true);
    expect(missing.settled).toBe(false);
    expect(store.load("no-such-run")).toBeUndefined();
  });

  it("keeps a transfer on the record across a restart", async () => {
    const files = new MemoryFiles();
    const writer = new ToolCallingAgent({ model: new MockModel([]) });
    const parent = new ToolCallingAgent({
      model: new MockModel([
        turn(call("transfer_to_writer", { reason: "it writes the draft" }, "t1")),
      ]),
      transfers: [{ name: "writer", description: "Writes the draft.", agent: writer }],
      store: new FileRunStore(files),
    });

    const result = await parent.run("Write the draft.", { runId: "parent-run" });
    expect(result.transfer?.target).toBe("writer");

    // A second store over the same files is what a restart looks like.
    const restarted = new FileRunStore(files);
    const stored = await restarted.load("parent-run");
    expect(stored).toBeDefined();
    const record = translateRecord(stored as RunRecord, "parent-run");
    expect(record.transfer?.target).toBe("writer");
    expect(record.transfer?.reason).toBe("it writes the draft");
  });

  it("filters a nested child's events by their path", async () => {
    const grandchild = new ToolCallingAgent({
      model: new MockModel([turn(answer("draft", "writer"))]),
    });
    const child = new ToolCallingAgent({
      model: new MockModel([
        turn(call("writer", { task: "draft it" }, "delegate")),
        turn(answer("report", "researcher")),
      ]),
      managedAgents: [{ name: "writer", description: "Writes the draft.", agent: grandchild }],
    });
    const parent = new ToolCallingAgent({
      model: new MockModel([
        turn(call("researcher", { task: "research it" }, "delegate")),
        turn(answer("final", "parent")),
      ]),
      managedAgents: [{ name: "researcher", description: "Researches the topic.", agent: child }],
    });

    const nested: AgentEvent[] = [];
    grandchild.on((event) => {
      nested.push(event);
    });
    await parent.run("Produce the final answer.");

    expect(nested.length).toBeGreaterThan(0);
    for (const event of nested) expect(event.agentPath).toEqual(["researcher", "writer"]);
  });

  it("refuses a board mutation at a stale revision", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    const created = await createTask(store, "parent-run", { id: "task-1", title: "Write it" });
    await claimTask(store, "parent-run", "task-1", "lead", created.revision);

    await expect(claimTask(store, "parent-run", "task-1", "other", created.revision)).rejects.toBeInstanceOf(
      TaskStaleRevisionError,
    );
    const rows = await listBoard(store, "parent-run");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.revision).toBe(1);
    expect(rows[0]?.owner).toBe("lead");
  });
});
