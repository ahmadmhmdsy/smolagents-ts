import type { RunRecord, StoredRun } from "./run-record.js";

// The record types and translators live in run-record.ts; re-exported here so the store seam has
// one import site.
export {
  translateRecord,
  RUN_RECORD_VERSION,
  RUN_SNAPSHOT_VERSION,
  translateSnapshot,
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
  commit(runId: string, record: RunRecord): void | Promise<void>;
  load(runId: string): StoredRun | undefined | Promise<StoredRun | undefined>;
}

/** The one implementation the seam ships with: a run's records held in memory. */
export class MemoryRunStore implements RunStore {
  private readonly records = new Map<string, RunRecord>();

  // The store is a boundary, so it copies on the way in and on the way out: a caller that
  // mutates the record it committed, or the one it loaded, cannot reach the stored run. A record
  // is JSON-safe by definition, so a JSON round-trip is a faithful deep copy.
  commit(runId: string, record: RunRecord): void {
    this.records.set(runId, copy(record));
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
