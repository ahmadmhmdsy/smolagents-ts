import { useEffect, useState } from "react";
import {
  readEvents,
  type AgentEvent,
  type RunEventLog,
  type RunStore,
} from "@smolagents-ts/core";

/** What the hook returns: the events delivered so far, the next cursor, and the truncation flag. */
export interface RunEventsState {
  readonly events: readonly AgentEvent[];
  /** The last seq delivered; pass it back as `fromSeq` to resume after a reconnect. */
  readonly cursor: number;
  /** True when the requested cursor was older than the tail the record still holds. */
  readonly truncated: boolean;
}

/**
 * Read a run's event tail and follow it: the first read starts at `fromSeq` (0 means the whole
 * retained tail), and every store commit appends only the events after the last seq delivered.
 * A reconnect is the same hook with the cursor the caller kept. Reading writes nothing.
 */
export function useRunEvents(
  store: RunStore,
  runId: string,
  options: { readonly fromSeq?: number } = {},
): RunEventsState {
  const fromSeq = options.fromSeq ?? 0;
  const [state, setState] = useState<RunEventsState>({
    events: [],
    cursor: fromSeq,
    truncated: false,
  });

  useEffect(() => {
    let cancelled = false;
    let cursor = fromSeq;
    setState({ events: [], cursor: fromSeq, truncated: false });

    const append = (log: RunEventLog): void => {
      if (cancelled) return;
      cursor = log.cursor;
      setState((previous) => {
        const known = new Set(previous.events.map((event) => event.seq));
        const added = log.events.filter((event) => !known.has(event.seq));
        if (added.length === 0 && !log.truncated) {
          return previous.cursor === log.cursor ? previous : { ...previous, cursor: log.cursor };
        }
        return {
          events: added.length === 0 ? previous.events : [...previous.events, ...added],
          cursor: log.cursor,
          truncated: previous.truncated || log.truncated,
        };
      });
    };

    void readEvents(store, runId, fromSeq).then(append, () => undefined);
    const stop = store.watch(runId, () => {
      void readEvents(store, runId, cursor).then(append, () => undefined);
    });
    return () => {
      cancelled = true;
      stop();
    };
  }, [store, runId, fromSeq]);

  return state;
}
