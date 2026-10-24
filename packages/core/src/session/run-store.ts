import { RunSnapshotVersionError } from "../errors.js";
import type { StepJSON } from "../memory/steps.js";

/** The format version a snapshot is written in. One integer per format change. */
export const RUN_SNAPSHOT_VERSION = 1;

/** A run's durable state: the steps, in order, plus the format version they are written in. */
export interface RunSnapshot {
  readonly formatVersion: number;
  readonly steps: readonly StepJSON[];
}

/**
 * What a store hands back. A snapshot written before the envelope existed is a bare step
 * array, so a store that still holds one returns it and the agent translates it.
 */
export type StoredRunSnapshot = RunSnapshot | readonly StepJSON[];

/**
 * Read a stored value as a snapshot. A bare array is the version-0 form and translates to the
 * current envelope; a note of a newer version is refused rather than half-read.
 */
export function translateSnapshot(stored: StoredRunSnapshot): RunSnapshot {
  if (Array.isArray(stored)) return { formatVersion: RUN_SNAPSHOT_VERSION, steps: stored };
  const envelope = stored as RunSnapshot;
  if (envelope.formatVersion > RUN_SNAPSHOT_VERSION) {
    throw RunSnapshotVersionError.forVersion(envelope.formatVersion, RUN_SNAPSHOT_VERSION);
  }
  return { formatVersion: RUN_SNAPSHOT_VERSION, steps: envelope.steps };
}

/**
 * Where a run's checkpoint lives. The agent writes the snapshot after each step and reads it back
 * to resume, and the caller supplies the store — so persistence stays outside the core, and a run
 * in a browser, a worker or a server all use the same seam.
 */
export interface RunStore {
  save(checkpoint: string, snapshot: RunSnapshot): void | Promise<void>;
  load(checkpoint: string): StoredRunSnapshot | undefined | Promise<StoredRunSnapshot | undefined>;
}

/** The one implementation the seam ships with: a run's steps held in memory. */
export class MemoryRunStore implements RunStore {
  private readonly snapshots = new Map<string, RunSnapshot>();

  save(checkpoint: string, snapshot: RunSnapshot): void {
    this.snapshots.set(checkpoint, snapshot);
  }

  load(checkpoint: string): RunSnapshot | undefined {
    return this.snapshots.get(checkpoint);
  }

  has(checkpoint: string): boolean {
    return this.snapshots.has(checkpoint);
  }

  delete(checkpoint: string): boolean {
    return this.snapshots.delete(checkpoint);
  }
}
