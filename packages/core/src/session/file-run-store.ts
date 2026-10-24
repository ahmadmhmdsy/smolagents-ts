import { RunClaimedError, RunNotFoundError, StaleWriterError } from "../errors.js";
import type { RunRecord, StoredRun } from "./run-record.js";
import type { RunStore } from "./run-store.js";

/**
 * The filesystem a {@link FileRunStore} writes through. Paths are flat names inside one directory
 * chosen by the binding, never caller-supplied paths, so core stays isomorphic and the Node
 * binding owns the directory and the traversal guard.
 */
export interface RunFileSystem {
  /** The file's text, or undefined when it does not exist. */
  read(name: string): Promise<string | undefined>;
  /** Create or replace a file's text. The store writes a temporary name, never the record's own. */
  write(name: string, data: string): Promise<void>;
  /** Atomically replace `to` with `from`. The store relies on this to publish a whole record. */
  rename(from: string, to: string): Promise<void>;
  delete(name: string): Promise<void>;
  /** Every file the store may own, for lookups across runs. */
  list(): Promise<string[]>;
}

export interface FileRunStoreOptions {
  /** The extension of a record file, so a binding can tell records from its own bookkeeping. */
  readonly extension?: string;
}

/**
 * A store that keeps one JSON file per run, written to a temporary name and renamed into place.
 * A crash between the write and the rename leaves the previous record in force; a reader never
 * sees half a record. The seam is injected, so this class is isomorphic and the binding supplies
 * the directory (see the CLI's `nodeRunFileSystem`).
 */
export class FileRunStore implements RunStore {
  private readonly fs: RunFileSystem;
  private readonly extension: string;

  constructor(fs: RunFileSystem, options: FileRunStoreOptions = {}) {
    this.fs = fs;
    this.extension = options.extension ?? ".json";
  }

  /** The file name a run id maps to. Path characters are escaped, so every id stays one file. */
  nameFor(runId: string): string {
    return encodeURIComponent(runId) + this.extension;
  }

  async commit(runId: string, record: RunRecord, expectedGeneration?: number): Promise<void> {
    if (expectedGeneration !== undefined) {
      const stored = await this.read(runId);
      if (stored !== undefined && stored.generation !== expectedGeneration) {
        throw new StaleWriterError(
          "The record for run " +
            runId +
            " is at generation " +
            String(stored.generation) +
            ", not " +
            String(expectedGeneration) +
            "; the commit was refused and the stored record is unchanged.",
        );
      }
    }
    const name = this.nameFor(runId);
    const temporary = name + "." + crypto.randomUUID() + ".tmp";
    try {
      await this.fs.write(temporary, JSON.stringify(record));
      await this.fs.rename(temporary, name);
    } catch (error) {
      // A write that never reached its rename must not leave a stray file behind.
      try {
        await this.fs.delete(temporary);
      } catch {
        // The previous record is still the truth; cleanup is best effort.
      }
      throw error;
    }
  }

  load(runId: string): Promise<StoredRun | undefined> {
    return this.read(runId);
  }

  async claim(runId: string, expectedGeneration: number, owner: string): Promise<RunRecord> {
    const stored = await this.read(runId);
    if (stored === undefined) {
      throw new RunNotFoundError("The store holds no record for run " + runId + " to claim.");
    }
    if (stored.generation !== expectedGeneration) {
      throw new RunClaimedError(
        "Run " +
          runId +
          " is at generation " +
          String(stored.generation) +
          ", not " +
          String(expectedGeneration) +
          "; another writer holds it.",
      );
    }
    const claimed: RunRecord = {
      ...stored,
      generation: stored.generation + 1,
      owner,
      updatedAt: new Date().toISOString(),
    };
    await this.commit(runId, claimed);
    return claimed;
  }

  private async read(runId: string): Promise<RunRecord | undefined> {
    const text = await this.fs.read(this.nameFor(runId));
    if (text === undefined) return undefined;
    return JSON.parse(text) as RunRecord;
  }
}
