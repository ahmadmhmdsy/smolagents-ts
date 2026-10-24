/**
 * The file-backed store: one JSON file per run, written to a temporary name and renamed into
 * place. The filesystem is an injected seam, so core stays isomorphic and the tests drive an
 * in-memory double without touching a disk.
 */
import { describe, expect, it } from "vitest";
import { RunNotFoundError, StaleWriterError } from "../src/errors.js";
import { FileRunStore, type RunFileSystem } from "../src/session/file-run-store.js";
import { RUN_RECORD_VERSION, translateRecord, type RunRecord } from "../src/session/run-store.js";

class MemoryFiles implements RunFileSystem {
  readonly files = new Map<string, string>();
  failRename = false;
  renames = 0;

  async read(path: string): Promise<string | undefined> {
    return this.files.get(path);
  }

  async write(path: string, data: string): Promise<void> {
    this.files.set(path, data);
  }

  async rename(from: string, to: string): Promise<void> {
    this.renames += 1;
    if (this.failRename) throw new Error("torn write: the rename never happened");
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

async function loadRecord(store: FileRunStore, runId: string): Promise<RunRecord> {
  const stored = await store.load(runId);
  if (stored === undefined) throw new Error("the store holds no record for run " + runId);
  return translateRecord(stored);
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

describe("FileRunStore", () => {
  it("keeps one file per run and loads the newest commit", async () => {
    const files = new MemoryFiles();
    const store = new FileRunStore(files);

    await store.commit("run-1", record("run-1", { generation: 0 }));
    await store.commit("run-1", record("run-1", { generation: 1, status: "waiting" }));

    const names = await files.list();
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\.json$/);
    const stored = await loadRecord(store, "run-1");
    expect(stored.status).toBe("waiting");
    expect(stored.generation).toBe(1);
  });

  it("refuses a commit from a writer the claim has passed", async () => {
    const files = new MemoryFiles();
    const store = new FileRunStore(files);
    await store.commit("run-1", record("run-1"));

    const claimed = await store.claim("run-1", 0, "owner-a");
    expect(claimed.generation).toBe(1);
    expect(claimed.owner).toBe("owner-a");

    await expect(store.commit("run-1", record("run-1", { generation: 0 }), 0)).rejects.toBeInstanceOf(
      StaleWriterError,
    );
    expect((await loadRecord(store, "run-1")).generation).toBe(1);
  });

  it("leaves the previous record untouched when the rename never happens", async () => {
    const files = new MemoryFiles();
    const store = new FileRunStore(files);
    await store.commit("run-1", record("run-1", { status: "running" }));

    files.failRename = true;
    await expect(
      store.commit("run-1", record("run-1", { status: "completed" }), 0),
    ).rejects.toThrow(/rename/);

    expect((await loadRecord(store, "run-1")).status).toBe("running");
    // The temporary file may remain, but it is never served as the record.
    expect((await files.list()).filter((name) => name.endsWith(".json"))).toHaveLength(1);
  });

  it("loads undefined for an unknown run and refuses to claim it", async () => {
    const store = new FileRunStore(new MemoryFiles());
    expect(await store.load("missing")).toBeUndefined();
    await expect(store.claim("missing", 0, "owner-a")).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("keeps a run id with path characters in one flat file", async () => {
    const files = new MemoryFiles();
    const store = new FileRunStore(files);
    await store.commit("nested/run id", record("nested/run id"));

    const names = await files.list();
    expect(names).toHaveLength(1);
    expect(names[0]).not.toContain("/");
    expect((await loadRecord(store, "nested/run id")).runId).toBe("nested/run id");
  });
});
