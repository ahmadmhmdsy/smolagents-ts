import type { SettledApprovalOutcome } from "../agent/approval.js";
import { RunRecordVersionError, RunSnapshotVersionError } from "../errors.js";
import type { StepJSON } from "../memory/steps.js";
import type { TokenUsage } from "../types.js";

/** The format version a run record is written in. One integer per format change. */
export const RUN_RECORD_VERSION = 2;

/** The version 1 envelope, kept readable while a store may still hold one. */
export const RUN_SNAPSHOT_VERSION = 1;

/**
 * What a run is doing. `waiting` means it is parked on a pending request, `interrupted` means the
 * process that owned it died mid-step. A human pause is `waiting`, never `interrupted` (0023).
 */
export type RunStatus = "running" | "waiting" | "completed" | "failed" | "interrupted";

/**
 * A request a parked run is waiting on. One shape with a `kind` now, so input and external pauses
 * are added as values rather than as second mechanisms (design brief D4).
 */
export interface PendingApproval {
  readonly kind: "approval";
  /** The request id a resume names. It is the call id the ask was recorded with. */
  readonly requestId: string;
  readonly toolName: string;
  /** The digest of the validated arguments; a resumed call is bound to this, not to a call id. */
  readonly argsDigest: string;
  readonly stepIndex: number;
  readonly createdAt: string;
  readonly expiresAt?: string;
}

/** One resolution of a pending request. The list is appended to and never truncated. */
export interface ApprovalSettlement {
  readonly requestId: string;
  readonly argsDigest: string;
  readonly stepIndex: number;
  readonly outcome: SettledApprovalOutcome;
  readonly at: string;
}

/** The step the run was executing when its last commit was written. */
export interface OpenStep {
  readonly index: number;
  readonly stepId: string;
  readonly startedAt: string;
}

/**
 * One finished step. `interrupted` is the synthetic closer a repair appends for the open step of a
 * record whose process died: the step is kept, never rewritten, and never run again silently.
 */
export interface CompletedStep {
  readonly stepId: string;
  readonly index: number;
  readonly state: "completed" | "interrupted";
  readonly result?: unknown;
  readonly usage?: TokenUsage;
  readonly finishedAt: string;
}

/**
 * A run as its store keeps it: one identity, one status, one fence number, and the memory the loop
 * replays. Later durability items extend this type with the fields they introduce.
 */
export interface RunRecord {
  readonly schemaVersion: number;
  readonly runId: string;
  readonly status: RunStatus;
  /** The ownership fence. Every claim bumps it; a commit at another generation is refused. */
  readonly generation: number;
  /** The live holder of the claim, cleared by a terminal commit. */
  readonly owner?: string;
  /** The step in flight when the record was written; a repair closes it as interrupted. */
  readonly step?: OpenStep;
  /** Every finished step, appended to and never truncated. */
  readonly completed?: readonly CompletedStep[];
  readonly memory: { readonly steps: readonly StepJSON[] };
  /** Present while the run is parked. It is what a resume settles and what a UI renders. */
  readonly pending?: PendingApproval;
  /** Every settlement appended so far, so a second resolution can report the first. */
  readonly settlements?: readonly ApprovalSettlement[];
  readonly createdAt?: string;
  readonly updatedAt?: string;
}

/** The version 1 shape: a format version and the steps. Read-only compatibility. */
export interface RunSnapshot {
  readonly formatVersion: number;
  readonly steps: readonly StepJSON[];
}

/** A value a store may hold: the current record, the version 1 envelope, or a bare step array. */
export type StoredRun = RunRecord | RunSnapshot | readonly StepJSON[];

/** The version 1 value alone, for the translator that still reads it. */
export type StoredRunSnapshot = RunSnapshot | readonly StepJSON[];

/**
 * Read a stored value as the version 1 envelope. A bare array is the version 0 form; a note of a
 * newer format is refused rather than half-read.
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
 * Read a stored value as a run record. A current record passes through; the version 1 envelope and
 * the version 0 bare array translate forward as a run whose process died (`interrupted`, no
 * owner, generation 0). A record from a newer runtime is refused with the number it carries.
 */
export function translateRecord(stored: StoredRun, runId = ""): RunRecord {
  if (isRecord(stored)) {
    if (stored.schemaVersion > RUN_RECORD_VERSION) {
      throw RunRecordVersionError.forVersion(stored.schemaVersion, RUN_RECORD_VERSION);
    }
    return stored;
  }
  const legacy = translateSnapshot(stored as StoredRunSnapshot);
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId,
    status: "interrupted",
    generation: 0,
    memory: { steps: legacy.steps },
  };
}

function isRecord(stored: StoredRun): stored is RunRecord {
  return !Array.isArray(stored) && typeof (stored as Partial<RunRecord>).schemaVersion === "number";
}
