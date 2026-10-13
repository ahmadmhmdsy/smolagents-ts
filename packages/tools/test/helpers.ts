import { noopLogger, type ToolContext } from "@smolagents-ts/core";

/** The context the loop hands a tool. A unit test supplies one because no agent is running. */
export function toolContext(overrides: Partial<ToolContext> = {}): ToolContext {
  return {
    signal: new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: noopLogger,
    ...overrides,
  };
}
