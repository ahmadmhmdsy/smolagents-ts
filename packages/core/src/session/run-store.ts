import { RunClaimedError, RunNotFoundError, StaleWriterError } from "../errors.js";
import { isNewerRecord, type RunRecord, type StoredRun } from "./run-record.js";

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
  /**
   * The newest record tagged with a conversation, or undefined when the store holds none. Order
   * is `updatedAt` then run id, so the answer does not depend on storage order.
   */
  latestForConversation(
    conversationId: string,
  ): RunRecord | undefined | Promise<RunRecord | undefined>;
  /**
   * Watch one run: the listener is called on every commit or claim that lands after it is
   * registered, with the record that landed. The returned function unsubscribes and stops
   * delivery; a listener a store no longer holds is never called again. Watching never writes.
   */
  watch(runId: string, listener: RunRecordListener): () => void;
}

/** What a watcher is handed: the record a commit or claim just published. */
export type RunRecordListener = (record: RunRecord) => void;

/** The one implementation the seam ships with: a run's records held in memory. */
export class MemoryRunStore implements RunStore {
  private readonly records = new Map<string, RunRecord>();
  private readonly watchers = new Map<string, Set<RunRecordListener>>();

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
    this.notify(runId, record);
  }

  watch(runId: string, listener: RunRecordListener): () => void {
    let listeners = this.watchers.get(runId);
    if (listeners === undefined) {
      listeners = new Set();
      this.watchers.set(runId, listeners);
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) this.watchers.delete(runId);
    };
  }

  private notify(runId: string, record: RunRecord): void {
    for (const listener of this.watchers.get(runId) ?? []) {
      // A listener that throws is the watcher's bug; it must not fail the write it observed.
      try {
        listener(record);
      } catch {
        continue;
      }
    }
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
    this.notify(runId, claimed);
    return copy(claimed);
  }

  load(runId: string): RunRecord | undefined {
    const stored = this.records.get(runId);
    return stored === undefined ? undefined : copy(stored);
  }

  latestForConversation(conversationId: string): RunRecord | undefined {
    let newest: RunRecord | undefined;
    for (const record of this.records.values()) {
      if (record.conversationId !== conversationId) continue;
      if (newest === undefined || isNewerRecord(record, newest)) newest = record;
    }
    return newest === undefined ? undefined : copy(newest);
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
