/**
 * The stores the seam ships with, certified by the shared contract in
 * \`run-store.contract.ts\`. The file-backed double stands in for the durable store Phase 1.5
 * ships: it writes one JSON file per run under a fresh temporary directory and reads it back.
 */
import { readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { FileRunStore, type RunFileSystem } from "../../src/session/file-run-store.js";
import { MemoryRunStore } from "../../src/session/run-store.js";
import { runStoreContract } from "./run-store.contract.js";

const directories: string[] = [];

afterAll(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

/** The Node seam the CLI ships, reproduced in the test so core is certified over a real disk. */
class NodeFiles implements RunFileSystem {
  readonly directory: string;

  constructor() {
    this.directory = join(tmpdir(), "smolagents-run-store-" + crypto.randomUUID());
    directories.push(this.directory);
    mkdirSync(this.directory, { recursive: true });
  }

  private pathFor(name: string): string {
    if (name.includes("/") || name.includes("\\") || name === "." || name === "..") {
      throw new Error("a record file name must be flat, got: " + name);
    }
    return join(this.directory, name);
  }

  async read(name: string): Promise<string | undefined> {
    const path = this.pathFor(name);
    if (!existsSync(path)) return undefined;
    return readFile(path, "utf8");
  }

  async write(name: string, data: string): Promise<void> {
    await writeFile(this.pathFor(name), data, "utf8");
  }

  async rename(from: string, to: string): Promise<void> {
    await rename(this.pathFor(from), this.pathFor(to));
  }

  async delete(name: string): Promise<void> {
    await unlink(this.pathFor(name)).catch(() => undefined);
  }

  async list(): Promise<string[]> {
    return readdir(this.directory);
  }
}

function temporaryFileStore(): FileRunStore {
  return new FileRunStore(new NodeFiles());
}

runStoreContract("MemoryRunStore", () => new MemoryRunStore());

runStoreContract("a store that answers asynchronously", async () => {
  const inner = new MemoryRunStore();
  return {
    commit: async (runId, record, expectedGeneration) => {
      await Promise.resolve();
      inner.commit(runId, record, expectedGeneration);
    },
    claim: async (runId, expectedGeneration, owner) => {
      await Promise.resolve();
      return inner.claim(runId, expectedGeneration, owner);
    },
    load: async (runId) => await Promise.resolve(inner.load(runId)),
  };
});

runStoreContract("the shipped FileRunStore over a temporary directory", () => temporaryFileStore());
