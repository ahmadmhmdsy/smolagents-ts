import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  listChildren,
  resumeBackgroundChild,
  startBackgroundChild,
  type ChildRow,
} from "../src/agent/background-child.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { ChildLimitError } from "../src/errors.js";
import { FinalAnswerStep, stepToJSON } from "../src/memory/steps.js";
import { RUN_RECORD_VERSION, translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore, type RunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

function answer(value: unknown): ToolCallRequest {
  return { id: "answer", name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer: value }) };
}

function turn(...calls: ToolCallRequest[]): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return { content: "", finishReason: "tool_calls", toolCalls: calls };
}

function childAgent(value: unknown, store: RunStore): ToolCallingAgent {
  return new ToolCallingAgent({ model: new MockModel([turn(answer(value))]), store });
}

function emptyAgent(): ToolCallingAgent {
  return new ToolCallingAgent({ model: new MockModel([]) });
}

/** A store that keeps the parent-record commits it saw, then delegates. */
class RecordingStore implements RunStore {
  readonly commits: RunRecord[] = [];
  private readonly inner = new MemoryRunStore();

  async commit(runId: string, record: RunRecord, expectedGeneration?: number): Promise<void> {
    if (runId === "parent-run") this.commits.push(record);
    await this.inner.commit(runId, record, expectedGeneration);
  }

  load(runId: string): ReturnType<MemoryRunStore["load"]> {
    return this.inner.load(runId);
  }

  claim(runId: string, expectedGeneration: number, owner: string): RunRecord {
    return this.inner.claim(runId, expectedGeneration, owner);
  }

  latestForConversation(conversationId: string): RunRecord | undefined {
    return this.inner.latestForConversation(conversationId);
  }

  watch(runId: string, listener: (record: RunRecord) => void): () => void {
    return this.inner.watch(runId, listener);
  }
}

function parentRecord(runId: string, children: readonly ChildRow[]): RunRecord {
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

function row(overrides: Partial<ChildRow>): ChildRow {
  return {
    runId: "child-a",
    parentRunId: "parent-run",
    agentName: "child",
    task: "do the thing",
    phase: "provisioning",
    startedAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
    ...overrides,
  };
}

async function rowOf(
  store: RunStore,
  parentRunId: string,
  runId: string,
): Promise<ChildRow | undefined> {
  const rows = await listChildren(store, parentRunId);
  return rows.find((entry) => entry.runId === runId);
}

async function settle(
  store: RunStore,
  parentRunId: string,
  runId: string,
): Promise<ChildRow> {
  const deadline = Date.now() + 2_000;
  for (;;) {
    const found = await rowOf(store, parentRunId, runId);
    if (found !== undefined && (found.phase === "completed" || found.phase === "failed")) return found;
    if (Date.now() > deadline) throw new Error("the child's row never settled");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

describe("a bounded background child", () => {
  it("writes provisioning and then completed rows, and the child names its parent", async () => {
    const store = new RecordingStore();
    await store.commit("parent-run", parentRecord("parent-run", []));

    const handle = await startBackgroundChild({
      store,
      parentRunId: "parent-run",
      agent: childAgent("child answer", store),
      agentName: "researcher",
      task: "find the answer",
    });
    await handle.done;
    const settled = await settle(store, "parent-run", handle.runId);

    expect(settled.phase).toBe("completed");
    expect(settled.report?.stopReason).toBe("success");
    expect(settled.report?.value).toBe("child answer");

    const phases = store.commits
      .flatMap((record) => record.children ?? [])
      .filter((entry) => entry.runId === handle.runId)
      .map((entry) => entry.phase);
    expect(phases).toContain("provisioning");
    expect(phases).toContain("completed");

    const child = store.load(handle.runId);
    expect(child).toBeDefined();
    if (child === undefined) return;
    expect(translateRecord(child, handle.runId).parentRunId).toBe("parent-run");
  });

  it("refuses a start over the cap with a typed error", async () => {
    const store = new MemoryRunStore();
    await store.commit(
      "parent-run",
      parentRecord("parent-run", [row({ runId: "child-a", phase: "active" })]),
    );

    await expect(
      startBackgroundChild({
        store,
        parentRunId: "parent-run",
        agent: childAgent("unused", store),
        task: "second child",
        maxConcurrent: 1,
      }),
    ).rejects.toBeInstanceOf(ChildLimitError);

    // The refusal wrote nothing: the record still holds exactly the one row.
    const rows = await listChildren(store, "parent-run");
    expect(rows.map((entry) => entry.runId)).toEqual(["child-a"]);
  });

  it("lists rows without resuming or claiming anything", async () => {
    const store = new RecordingStore();
    await store.commit(
      "parent-run",
      parentRecord("parent-run", [row({ runId: "child-a", phase: "completed" })]),
    );

    const first = await listChildren(store, "parent-run");
    const second = await listChildren(store, "parent-run");

    expect(first).toEqual(second);
    expect(first.map((entry) => entry.runId)).toEqual(["child-a"]);
    expect(store.commits).toHaveLength(1);
  });

  it("adopts a child record behind a provisioning row and fails a row with no record", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run", [row({ runId: "child-a" })]));
    await store.commit("child-a", {
      schemaVersion: RUN_RECORD_VERSION,
      runId: "child-a",
      status: "completed",
      generation: 0,
      memory: { steps: [stepToJSON(new FinalAnswerStep("adopted answer"))] },
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:00.000Z",
    });

    const adopted = await resumeBackgroundChild(store, "parent-run", "child-a", emptyAgent());
    expect(adopted.report.stopReason).toBe("success");
    expect(adopted.report.value).toBe("adopted answer");
    expect((await rowOf(store, "parent-run", "child-a"))?.phase).toBe("completed");

    await store.commit(
      "parent-run",
      { ...parentRecord("parent-run", [row({ runId: "child-b" })]), generation: 2 },
    );
    const failed = await resumeBackgroundChild(store, "parent-run", "child-b", emptyAgent());
    expect(failed.report.stopReason).toBe("failure");
    expect(failed.report.failure?.kind).toBe("agent");
    expect((await rowOf(store, "parent-run", "child-b"))?.phase).toBe("failed");
  });

  it("stores the child's typed report on its row", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run", []));
    const strict = new ToolCallingAgent({
      model: new MockModel([turn(answer({ n: "not a number" }))]),
      outputSchema: z.object({ n: z.number() }),
      store,
    });

    const handle = await startBackgroundChild({
      store,
      parentRunId: "parent-run",
      agent: strict,
      task: "return a number",
    });
    await expect(handle.done).rejects.toThrow();
    const settled = await settle(store, "parent-run", handle.runId);

    expect(settled.phase).toBe("failed");
    expect(settled.report?.stopReason).toBe("failure");
    expect(["AgentGuardrailError", "AgentGenerationError"]).toContain(settled.report?.failure?.name);
    expect(settled.report?.failure?.message.length).toBeLessThanOrEqual(300);
  });
});
