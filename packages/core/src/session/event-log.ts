import type { AgentEvent } from "../events.js";
import { translateRecord, type RunEventEntry } from "./run-record.js";
import type { RunStore } from "./run-store.js";

/** What a reader gets back: the events after its cursor, the record's last seq, and the truncation. */
export interface RunEventLog {
  readonly events: readonly AgentEvent[];
  /** The last seq the record holds; 0 when it holds none. A client keeps it as its next cursor. */
  readonly cursor: number;
  /** True when the requested cursor is older than the retained tail; the events start at its base. */
  readonly truncated: boolean;
}

/**
 * Read a run's recorded event tail after a cursor. Reading writes nothing and resumes nothing: it
 * is the delivery half of the stream, for a client that reconnects with the last seq it saw. When
 * the cursor is older than what the record retains, the answer starts at the retained base and says
 * so, rather than silently skipping the gap.
 */
export async function readEvents(
  store: RunStore,
  runId: string,
  fromSeq = 0,
): Promise<RunEventLog> {
  const stored = await store.load(runId);
  const record = stored === undefined ? undefined : translateRecord(stored, runId);
  const entries: readonly RunEventEntry[] = record?.events ?? [];
  const base = entries[0]?.seq ?? 0;
  const cursor = entries[entries.length - 1]?.seq ?? 0;
  return {
    events: entries.filter((entry) => entry.seq > fromSeq).map((entry) => entry.event),
    cursor,
    // Seqs start at 1, so a base of 1 means nothing was dropped yet; cursor 0 means "nothing seen".
    truncated: entries.length > 0 && base > 1 && fromSeq < base,
  };
}
