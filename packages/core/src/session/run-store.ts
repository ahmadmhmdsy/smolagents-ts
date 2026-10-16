import type { StepJSON } from "../memory/steps.js";

/** A run's durable state: its steps, in order. The unit a store checkpoints. */
export type RunSnapshot = readonly StepJSON[];

/**
 * Where a run's checkpoint lives. The agent writes the snapshot after each step and reads it back
 * to resume, and the caller supplies the store — so persistence stays outside the core, and a run
 * in a browser, a worker or a server all use the same seam.
 */
export interface RunStore {
  save(checkpoint: string, snapshot: RunSnapshot): void | Promise<void>;
  load(checkpoint: string): RunSnapshot | undefined | Promise<RunSnapshot | undefined>;
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
