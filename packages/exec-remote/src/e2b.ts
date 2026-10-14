/** `@smolagents-ts/exec-remote/e2b`: a hosted E2B sandbox with no mid-run call channel. */
import type { CodeExecutor } from "@smolagents-ts/core";

import { E2BSandbox, type E2BSandboxOptions } from "./backends/e2b/index.js";
import { RemoteExecutor } from "./executor.js";

export {
  E2BSandbox,
  E2B_NODE_FLOOR,
  satisfiesNodeFloor,
  type E2BClient,
  type E2BExecution,
  type E2BExecutionError,
  type E2BRunOptions,
  type E2BSandboxLike,
  type E2BSandboxOptions,
} from "./backends/e2b/index.js";

export interface E2BExecutorOptions extends E2BSandboxOptions {
  /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
  readonly fetch?: typeof globalThis.fetch;
}

/** The `CodeExecutor` the E2B backend offers; its shim refuses every tool but `final_answer`. */
export function createE2BExecutor(options: E2BExecutorOptions = {}): CodeExecutor {
  const { fetch, ...sandboxOptions } = options;
  return new RemoteExecutor({
    // A thunk, so a step that loses the deadline race gets a fresh sandbox.
    sandbox: () => new E2BSandbox(sandboxOptions),
    ...(fetch === undefined ? {} : { fetch }),
  });
}
