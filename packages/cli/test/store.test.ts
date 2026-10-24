import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { FileRunStore, RUN_RECORD_VERSION, translateRecord, type RunRecord } from "@smolagents-ts/core";
import { DEFAULT_STATE_DIRECTORY, nodeRunFileSystem } from "../src/store.js";

const directories: string[] = [];

afterAll(async () => {
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
});

function record(runId: string): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "running",
    generation: 0,
    memory: { steps: [] },
  };
}

describe("nodeRunFileSystem", () => {
  it("round-trips a record through a real temporary directory", async () => {
    const directory = await mkdtemp(join(tmpdir(), "smolagents-cli-store-"));
    directories.push(directory);
    const store = new FileRunStore(nodeRunFileSystem(directory));

    await store.commit("run-1", record("run-1"));

    const loaded = await store.load("run-1");
    if (loaded === undefined) throw new Error("the record was not stored");
    expect(translateRecord(loaded).runId).toBe("run-1");
    const names = await readdir(directory);
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/\.json$/);
    expect(await nodeRunFileSystem(directory).list()).toHaveLength(1);
  });

  it("creates the directory on the first write and reads it back from a fresh binding", async () => {
    const parent = await mkdtemp(join(tmpdir(), "smolagents-cli-store-"));
    directories.push(parent);
    const directory = join(parent, "nested", "state");
    await new FileRunStore(nodeRunFileSystem(directory)).commit("run-2", record("run-2"));

    const reopened = new FileRunStore(nodeRunFileSystem(directory));
    const loaded = await reopened.load("run-2");
    if (loaded === undefined) throw new Error("the record was not stored");
    expect(translateRecord(loaded).status).toBe("running");
  });

  it("refuses a file name that could leave the directory", async () => {
    const files = nodeRunFileSystem(join(tmpdir(), "smolagents-never-created"));
    await expect(files.read("../escape.json")).rejects.toThrow(/flat/);
    await expect(files.write("nested/record.json", "{}")).rejects.toThrow(/flat/);
  });

  it("names the default state directory", () => {
    expect(DEFAULT_STATE_DIRECTORY).toBe(".smolagents");
  });
});
