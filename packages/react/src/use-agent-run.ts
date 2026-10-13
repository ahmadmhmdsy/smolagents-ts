import { useCallback, useMemo } from "react";
import {
  AgentSession,
  type AgentSessionSnapshot,
  type MultiStepAgent,
  type RunResult,
} from "@smolagents-ts/core";
import { useAgentSession } from "./session.js";

export interface AgentRunHandle<TOut = unknown> {
  readonly session: AgentSession<TOut>;
  readonly snapshot: AgentSessionSnapshot;
  run(task: string, options?: { signal?: AbortSignal }): Promise<RunResult<TOut>>;
  cancel(): void;
  reset(): void;
}

/**
 * Own one run. The session is memoised on the agent, so re-rendering with the same agent
 * keeps the store and its history, while a new agent starts a fresh session — which means
 * the agent has to be stable across renders, like any other value a hook depends on.
 * Constructing one inline re-creates the session, and the symptom is not an error but a
 * snapshot that stays behind the run.
 */
export function useAgentRun<TOut = unknown>(agent: MultiStepAgent<TOut>): AgentRunHandle<TOut> {
  const session = useMemo(() => new AgentSession<TOut>(agent), [agent]);
  const snapshot = useAgentSession(session);
  const run = useCallback(
    (task: string, options?: { signal?: AbortSignal }) => session.send(task, options),
    [session],
  );
  const cancel = useCallback(() => session.cancel(), [session]);
  const reset = useCallback(() => session.reset(), [session]);
  return useMemo(
    () => ({ session, snapshot, run, cancel, reset }),
    [session, snapshot, run, cancel, reset],
  );
}
