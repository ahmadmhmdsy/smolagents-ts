import { RunClaimedError, RunNotFoundError, StaleWriterError } from "../errors.js";
import type { RunRecord, StoredRun } from "./run-record.js";

// The record types and translators live in run-record.ts; re-exported here so the store seam has
// one import site.
export {
  translateRecord,
  RUN_RECORD_VERSION,
  RUN_SNAPSHOT_VERSION,
  translateSnapshot,
  type ApprovalSettlement,
  type CompletedStep,
  type JournalEntry,
  type JournalState,
  type OpenStep,
  type PendingApproval,
  type RunRecord,
  type RunStatus,
  type RunSnapshot,
  type StoredRun,
  type StoredRunSnapshot,
} from "./run-record.js";

/**
 * Where a run's record lives. The agent commits after each boundary and reads it back to resume,
 * and the caller supplies the store — so persistence stays outside the core, and a run in a
 * browser, a worker or a server all use the same seam. The store never decides a commit boundary;
 * it stores what the loop hands it.
 */
export interface RunStore {
  /**
   * Write the record. When `expectedGeneration` is given the store compare-and-sets the fence it
   * read: a commit written by a writer whose claim was overtaken is refused with
   * `StaleWriterError` and the stored record is left untouched.
   */
  commit(runId: string, record: RunRecord, expectedGeneration?: number): void | Promise<void>;
  load(runId: string): StoredRun | undefined | Promise<StoredRun | undefined>;
  /**
   * Take ownership of a run: bump its generation, record the owner, and return the claimed record.
   * A claim whose expected generation is no longer current loses with `RunClaimedError`; a run
   * the store does not hold is `RunNotFoundError`.
   */
  claim(runId: string, expectedGeneration: number, owner: string): RunRecord | Promise<RunRecord>;
}

/** The one implementation the seam ships with: a run's records held in memory. */
export class MemoryRunStore implements RunStore {
  private readonly records = new Map<string, RunRecord>();

  // The store is a boundary, so it copies on the way in and on the way out: a caller that
  // mutates the record it committed, or the one it loaded, cannot reach the stored run. A record
  // is JSON-safe by definition, so a JSON round-trip is a faithful deep copy.
  commit(runId: string, record: RunRecord, expectedGeneration?: number): void {
    const stored = this.records.get(runId);
    if (expectedGeneration !== undefined && stored !== undefined && stored.generation !== expectedGeneration) {
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
    this.records.set(runId, copy(record));
  }

  claim(runId: string, expectedGeneration: number, owner: string): RunRecord {
    const stored = this.records.get(runId);
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
      ...copy(stored),
      generation: stored.generation + 1,
      owner,
      updatedAt: new Date().toISOString(),
    };
    this.records.set(runId, claimed);
    return copy(claimed);
  }

  load(runId: string): RunRecord | undefined {
    const stored = this.records.get(runId);
    return stored === undefined ? undefined : copy(stored);
  }

  has(runId: string): boolean {
    return this.records.has(runId);
  }

  delete(runId: string): boolean {
    return this.records.delete(runId);
  }
}

function copy(record: RunRecord): RunRecord {
  return JSON.parse(JSON.stringify(record)) as RunRecord;
}
