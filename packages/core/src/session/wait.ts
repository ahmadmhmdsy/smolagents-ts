import { translateRecord, type RunRecord } from "./run-record.js";
import type { RunStore } from "./run-store.js";

export interface WaitForRunOptions {
  /** How long to wait, in milliseconds. Absent waits until a change or the signal aborts. */
  readonly timeoutMs?: number;
  /** Cancellation: an aborted wait reports `aborted` and releases its edge. */
  readonly signal?: AbortSignal;
}

/** What a wait learned. Exactly one of the four outcomes is true, and a change carries its record. */
export interface WaitForRunResult {
  /** A record different from the one the call read arrived; `record` is that record. */
  readonly settled: boolean;
  readonly timedOut: boolean;
  readonly noProgress: boolean;
  readonly aborted: boolean;
  readonly record?: RunRecord;
}

/**
 * Wait for a run to move. The baseline is the record read at call time; the wait resolves on the
 * first notification whose record differs, and it never writes, claims or converts a wait into a
 * resume. A wait on a run the store does not hold, or on one that already ended, has nothing to
 * wait for and reports `noProgress` at once.
 */
export async function waitForRun(
  store: RunStore,
  runId: string,
  options: WaitForRunOptions = {},
): Promise<WaitForRunResult> {
  const stored = await store.load(runId);
  const baseline = stored === undefined ? undefined : translateRecord(stored, runId);
  if (baseline === undefined) {
    return { settled: false, timedOut: false, noProgress: true, aborted: false };
  }
  if (baseline.status === "completed" || baseline.status === "failed") {
    return { settled: true, timedOut: false, noProgress: true, aborted: false, record: baseline };
  }
  if (options.signal?.aborted === true) {
    return { settled: false, timedOut: false, noProgress: false, aborted: true, record: baseline };
  }

  const baselineKey = recordKey(baseline);
  return new Promise<WaitForRunResult>((resolve) => {
    let finished = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = store.watch(runId, (record) => {
      if (finished || recordKey(record) === baselineKey) return;
      finish({ settled: true, timedOut: false, noProgress: false, aborted: false, record });
    });
    const onAbort = (): void => {
      finish({ settled: false, timedOut: false, noProgress: false, aborted: true, record: baseline });
    };
    options.signal?.addEventListener("abort", onAbort, { once: true });
    if (options.timeoutMs !== undefined) {
      timer = setTimeout(() => {
        finish({ settled: false, timedOut: true, noProgress: false, aborted: false, record: baseline });
      }, options.timeoutMs);
    }

    function finish(result: WaitForRunResult): void {
      if (finished) return;
      finished = true;
      stop();
      options.signal?.removeEventListener("abort", onAbort);
      if (timer !== undefined) clearTimeout(timer);
      resolve(result);
    }
  });
}

/**
 * The cheap identity of a record for this wait: a commit always refreshes `updatedAt`, and the
 * fence, status and step move the rest. Comparing the whole memory would charge a wait for a step
 * it never reads.
 */
function recordKey(record: RunRecord): string {
  return [
    record.status,
    String(record.generation),
    record.updatedAt,
    record.step?.stepId ?? "",
    String(record.completed?.length ?? 0),
    String(record.messages?.length ?? 0),
  ].join("|");
}
