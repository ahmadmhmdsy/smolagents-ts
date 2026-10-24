import { describe, expect, it } from "vitest";
import {
  claimTask,
  completeTask,
  createTask,
  deleteTask,
  listBoard,
  updateTask,
  type BoardTask,
} from "../src/session/claim-board.js";
import { TaskBlockedError, TaskDeletedError, TaskStaleRevisionError } from "../src/errors.js";
import { RUN_RECORD_VERSION, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";

function parentRecord(runId: string): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "running",
    generation: 0,
    memory: { steps: [] },
    createdAt: "2026-10-24T00:00:00.000Z",
    updatedAt: "2026-10-24T00:00:00.000Z",
  };
}

async function rowOf(
  store: MemoryRunStore,
  parentRunId: string,
  taskId: string,
): Promise<BoardTask | undefined> {
  return (await listBoard(store, parentRunId)).find((row) => row.id === taskId);
}

describe("the claim board", () => {
  it("bumps the revision on create, claim, update, complete and tombstone", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));

    const created = await createTask(store, "parent-run", { id: "task-1", title: "Write the doc" });
    expect(created.status).toBe("open");
    expect(created.revision).toBe(0);

    const claimed = await claimTask(store, "parent-run", "task-1", "lead", 0);
    expect(claimed.status).toBe("claimed");
    expect(claimed.owner).toBe("lead");
    expect(claimed.revision).toBe(1);

    const updated = await updateTask(store, "parent-run", "task-1", { title: "Write the guide" }, 1);
    expect(updated.title).toBe("Write the guide");
    expect(updated.revision).toBe(2);

    const completed = await completeTask(store, "parent-run", "task-1", 2);
    expect(completed.status).toBe("done");
    expect(completed.revision).toBe(3);

    const tombstoned = await deleteTask(store, "parent-run", "task-1", 3);
    expect(tombstoned.status).toBe("deleted");
    expect(tombstoned.revision).toBe(4);

    const rows = await listBoard(store, "parent-run");
    expect(rows.map((row) => [row.id, row.revision, row.status])).toEqual([
      ["task-1", 4, "deleted"],
    ]);
  });

  it("refuses a stale revision typed and leaves the row untouched", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    await createTask(store, "parent-run", { id: "task-1", title: "Write the doc" });
    await claimTask(store, "parent-run", "task-1", "lead", 0);

    await expect(claimTask(store, "parent-run", "task-1", "other", 0)).rejects.toBeInstanceOf(
      TaskStaleRevisionError,
    );
    await expect(updateTask(store, "parent-run", "task-1", { title: "x" }, 0)).rejects.toBeInstanceOf(
      TaskStaleRevisionError,
    );

    const row = await rowOf(store, "parent-run", "task-1");
    expect(row?.revision).toBe(1);
    expect(row?.owner).toBe("lead");
    expect(row?.title).toBe("Write the doc");
  });

  it("refuses a claim while a blocker is unfinished, then allows it", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    await createTask(store, "parent-run", { id: "task-a", title: "Ship it", blockers: ["task-b"] });
    await createTask(store, "parent-run", { id: "task-b", title: "Test it" });

    await expect(claimTask(store, "parent-run", "task-a", "lead", 0)).rejects.toBeInstanceOf(
      TaskBlockedError,
    );
    await completeTask(store, "parent-run", "task-b", 0);
    const claimed = await claimTask(store, "parent-run", "task-a", "lead", 0);
    expect(claimed.status).toBe("claimed");
    expect(claimed.revision).toBe(1);
  });

  it("keeps a deleted row as a tombstone that refuses every mutation", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    await createTask(store, "parent-run", { id: "task-1", title: "Drop it" });
    await deleteTask(store, "parent-run", "task-1", 0);

    await expect(claimTask(store, "parent-run", "task-1", "lead", 1)).rejects.toBeInstanceOf(
      TaskDeletedError,
    );
    await expect(updateTask(store, "parent-run", "task-1", { title: "x" }, 1)).rejects.toBeInstanceOf(
      TaskDeletedError,
    );
    await expect(deleteTask(store, "parent-run", "task-1", 1)).rejects.toBeInstanceOf(
      TaskDeletedError,
    );

    const rows = await listBoard(store, "parent-run");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe("task-1");
    expect(rows[0]?.status).toBe("deleted");
  });

  it("records advisory write scopes and carries no payload field", async () => {
    const store = new MemoryRunStore();
    await store.commit("parent-run", parentRecord("parent-run"));
    const created = await createTask(store, "parent-run", {
      id: "task-1",
      title: "Touch two places",
      writeScopes: ["packages/core/src", "docs/"],
    });

    expect(created.writeScopes).toEqual(["packages/core/src", "docs/"]);
    expect(Object.keys(created).sort()).toEqual([
      "blockers",
      "id",
      "revision",
      "status",
      "title",
      "updatedAt",
      "writeScopes",
    ]);
    expect("payload" in created).toBe(false);
    expect("data" in created).toBe(false);

    // Scopes are recorded, not enforced: a claim from another owner still succeeds.
    const claimed = await claimTask(store, "parent-run", "task-1", "someone-else", 0);
    expect(claimed.writeScopes).toEqual(["packages/core/src", "docs/"]);
    expect(claimed.owner).toBe("someone-else");
  });
});
