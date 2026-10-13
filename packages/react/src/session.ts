import { useSyncExternalStore } from "react";
import type { AgentSession, AgentSessionSnapshot } from "@smolagents-ts/core";

/**
 * Subscribe to the session's store. React's contract is subscribe plus getSnapshot, and the
 * session caches its snapshot, so a render reads the same object until the run moves. The
 * methods are wrapped in closures rather than passed directly: they are not bound to the
 * instance.
 */
export function useAgentSession<TOut = unknown>(
  session: AgentSession<TOut>,
): AgentSessionSnapshot {
  return useSyncExternalStore(
    (listener) => session.subscribe(listener),
    () => session.getSnapshot(),
    () => session.getSnapshot(),
  );
}
