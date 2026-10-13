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

export interface Recorder {
  fetch: typeof globalThis.fetch;
  urls: string[];
}

/** A fetch double that answers every request with one body and records the URLs it saw. */
export function recorder(body: string, contentType = "application/json", status = 200): Recorder {
  const urls: string[] = [];
  const fetchImpl = ((url: string | URL | Request) => {
    urls.push(String(url));
    return Promise.resolve(
      new Response(body, { status, headers: { "content-type": contentType } }),
    );
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, urls };
}
