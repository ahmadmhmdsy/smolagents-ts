/**
 * The stores the seam ships with, certified by the shared contract in
 * \`run-store.contract.ts\`. The file-backed double stands in for the durable store Phase 1.5
 * ships: it writes one JSON file per run under a fresh temporary directory and reads it back.
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import { RunClaimedError, RunNotFoundError, StaleWriterError } from "../../src/errors.js";
import {
  MemoryRunStore,
  type RunStore,
  type StoredRun,
} from "../../src/session/run-store.js";
import type { RunRecord } from "../../src/session/run-record.js";
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

  private pathFor(runId: string): string {
    return join(this.directory, encodeURIComponent(runId) + ".json");
  }

  commit(runId: string, record: RunRecord, expectedGeneration?: number): void {
    const path = this.pathFor(runId);
    if (expectedGeneration !== undefined && existsSync(path)) {
      const stored = JSON.parse(readFileSync(path, "utf8")) as RunRecord;
      if (stored.generation !== expectedGeneration) {
        throw new StaleWriterError(
          "The record for run " +
            runId +
            " is at generation " +
            String(stored.generation) +
            ", not " +
            String(expectedGeneration) +
            ".",
        );
      }
    }
    writeFileSync(path, JSON.stringify(record), "utf8");
  }

  claim(runId: string, expectedGeneration: number, owner: string): RunRecord {
    const stored = this.load(runId);
    if (stored === undefined) {
      throw new RunNotFoundError("The store holds no record for run " + runId + " to claim.");
    }
    const record = stored as RunRecord;
    if (record.generation !== expectedGeneration) {
      throw new RunClaimedError(
        "Run " +
          runId +
          " is at generation " +
          String(record.generation) +
          ", not " +
          String(expectedGeneration) +
          "; another writer holds it.",
      );
    }
    const claimed: RunRecord = {
      ...record,
      generation: record.generation + 1,
      owner,
      updatedAt: new Date().toISOString(),
    };
    this.commit(runId, claimed);
    return claimed;
  }

  load(runId: string): StoredRun | undefined {
    const path = this.pathFor(runId);
    if (!existsSync(path)) return undefined;
    return JSON.parse(readFileSync(path, "utf8")) as RunRecord;
  }
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

runStoreContract("a temporary-file store", () => new TemporaryFileRunStore());
