import { describe, expect, it } from "vitest";
import { RUN_STORE_CHECKS } from "./contract/run-store.contract.js";
import { FileRunStore, type RunFileSystem } from "../src/session/file-run-store.js";
import {
  RUN_RECORD_VERSION,
  translateRecord,
  type RunRecord,
} from "../src/session/run-record.js";
import { MemoryRunStore, type RunStore } from "../src/session/run-store.js";
import { waitForRun } from "../src/session/wait.js";

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

/** A store that delegates everything and counts the writes, claims and unsubscribes it saw. */
class CountingStore implements RunStore {
  claims = 0;
  commits = 0;
  unsubscribes = 0;
  private readonly inner = new MemoryRunStore();

  commit(runId: string, saved: RunRecord, expectedGeneration?: number): void {
    this.commits += 1;
    this.inner.commit(runId, saved, expectedGeneration);
  }

  load(runId: string): ReturnType<MemoryRunStore["load"]> {
    return this.inner.load(runId);
  }

  claim(runId: string, expectedGeneration: number, owner: string): RunRecord {
    this.claims += 1;
    return this.inner.claim(runId, expectedGeneration, owner);
  }

  latestForConversation(conversationId: string): RunRecord | undefined {
    return this.inner.latestForConversation(conversationId);
  }

  watch(runId: string, listener: (record: RunRecord) => void): () => void {
    const stop = this.inner.watch(runId, listener);
    return () => {
      this.unsubscribes += 1;
      stop();
    };
  }
}

class MemoryFiles implements RunFileSystem {
  readonly files = new Map<string, string>();

  async read(name: string): Promise<string | undefined> {
    return this.files.get(name);
  }

  async write(name: string, data: string): Promise<void> {
    this.files.set(name, data);
  }

  async rename(from: string, to: string): Promise<void> {
    const data = this.files.get(from);
    if (data === undefined) throw new Error("rename source does not exist: " + from);
    this.files.delete(from);
    this.files.set(to, data);
  }

  async delete(name: string): Promise<void> {
    this.files.delete(name);
  }

  async list(): Promise<string[]> {
    return [...this.files.keys()];
  }
}

describe("waiting for a run", () => {
  it("resolves on the first edge after the call and carries that record", async () => {
    const store = new MemoryRunStore();
    await store.commit("run-1", record("run-1"));

    const pending = waitForRun(store, "run-1");
    await Promise.resolve();
    const moved = { ...record("run-1", { status: "completed", updatedAt: "2026-10-24T01:00:00.000Z" }) };
    await store.commit("run-1", moved);

    const result = await pending;
    expect(result.settled).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.noProgress).toBe(false);
    expect(result.aborted).toBe(false);
    expect(result.record?.updatedAt).toBe("2026-10-24T01:00:00.000Z");
  });

  it("reports noProgress at once for a terminal record and never claims", async () => {
    const store = new CountingStore();
    await store.commit(
      "run-1",
      record("run-1", { status: "completed", updatedAt: "2026-10-24T01:00:00.000Z" }),
    );

    const result = await waitForRun(store, "run-1", { timeoutMs: 1_000 });

    expect(result.noProgress).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.settled).toBe(true);
    expect(result.record?.status).toBe("completed");
    expect(store.claims).toBe(0);
    expect(store.commits).toBe(1);
  });

  it("times out without claiming and releases its edge", async () => {
    const store = new CountingStore();
    await store.commit("run-1", record("run-1"));

    const result = await waitForRun(store, "run-1", { timeoutMs: 10 });

    expect(result.timedOut).toBe(true);
    expect(result.settled).toBe(false);
    expect(store.claims).toBe(0);
    expect(store.unsubscribes).toBe(1);
  });

  it("aborts on its signal and never writes or claims", async () => {
    const store = new CountingStore();
    await store.commit("run-1", record("run-1"));
    const controller = new AbortController();
    const pending = waitForRun(store, "run-1", { signal: controller.signal });
    controller.abort();

    const result = await pending;
    expect(result.aborted).toBe(true);
    expect(result.settled).toBe(false);
    expect(store.claims).toBe(0);
    expect(store.commits).toBe(1);
    // Repeating the wait on the same record shows the generation did not move.
    const stored = store.load("run-1");
    expect(stored !== undefined && translateRecord(stored).generation).toBe(0);
  });

  it("certifies the contract's watch mode on the memory and file stores", async () => {
    const check = RUN_STORE_CHECKS.find((entry) => entry.mode === "watch");
    expect(check).toBeDefined();
    if (check === undefined) return;

    const memory = new MemoryRunStore();
    await check.check(memory);
    const file = new FileRunStore(new MemoryFiles());
    await check.check(file);
  });
});
