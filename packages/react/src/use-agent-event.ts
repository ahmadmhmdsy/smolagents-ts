import { useEffect, useRef } from "react";
import type { AgentEvent, AgentEventType, MultiStepAgent } from "@smolagents-ts/core";

/**
 * Call `handler` for every event of `type` the agent emits, for the life of the mount. The
 * handler lives in a ref, so an inline arrow function does not re-subscribe on every render,
 * and the subscription follows the agent and the type.
 */
export function useAgentEvent(
  agent: MultiStepAgent,
  type: AgentEventType,
  handler: (event: AgentEvent) => void,
): void {
  const handlerRef = useRef(handler);
  useEffect(() => {
    handlerRef.current = handler;
  });
  useEffect(
    () =>
      agent.on((event) => {
        if (event.type === type) handlerRef.current(event);
      }),
    [agent, type],
  );
}
