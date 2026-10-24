/**
 * The stores the seam ships with, certified by the shared contract in
 * \`run-store.contract.ts\`. The file-backed store stands in for the durable store that Phase 1.5
 * has not built yet: it writes one JSON file per checkpoint under a fresh temporary directory and
 * reads it back, which is exactly the shape a real file store will have.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import type { StepJSON } from "../../src/memory/steps.js";
import {
  MemoryRunStore,
  type RunSnapshot,
  type RunStore,
  type StoredRunSnapshot,
} from "../../src/session/run-store.js";
import { runStoreContract } from "./run-store.contract.js";

const directories: string[] = [];

afterAll(() => {
  for (const directory of directories) rmSync(directory, { recursive: true, force: true });
});

class TemporaryFileRunStore implements RunStore {
  private readonly directory: string;

  constructor() {
    this.directory = mkdtempSync(join(tmpdir(), "smolagents-run-store-"));
    directories.push(this.directory);
  }

  private pathFor(checkpoint: string): string {
    return join(this.directory, encodeURIComponent(checkpoint) + ".json");
  }

  save(checkpoint: string, snapshot: RunSnapshot): void {
    writeFileSync(this.pathFor(checkpoint), JSON.stringify(snapshot), "utf8");
  }

  load(checkpoint: string): StoredRunSnapshot | undefined {
    const path = this.pathFor(checkpoint);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as { formatVersion: number; steps: StepJSON[] };
  }
}

runStoreContract("MemoryRunStore", () => new MemoryRunStore());

runStoreContract("a store that answers asynchronously", async () => {
  const inner = new MemoryRunStore();
  return {
    save: async (checkpoint, snapshot) => {
      await Promise.resolve();
      inner.save(checkpoint, snapshot);
    },
    load: async (checkpoint) => await Promise.resolve(inner.load(checkpoint)),
  };
});

runStoreContract("a temporary-file store", () => new TemporaryFileRunStore());
