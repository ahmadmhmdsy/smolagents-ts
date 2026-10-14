/** `@smolagents-ts/exec-remote/process`: a real local interpreter in a child process. */
import type { CodeExecutor } from "@smolagents-ts/core";

import { ProcessSandbox, type ProcessSandboxOptions } from "./backends/process/index.js";
import { RemoteExecutor } from "./executor.js";

export { ProcessSandbox, type ProcessSandboxOptions } from "./backends/process/index.js";
export { FRAME_PREFIX } from "./shim-source.js";

export interface ProcessExecutorOptions extends ProcessSandboxOptions {
  /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
  readonly fetch?: typeof globalThis.fetch;
}

/** The `CodeExecutor` the process backend offers, with the tool channel the kernel guarantees. */
export function createProcessExecutor(options: ProcessExecutorOptions = {}): CodeExecutor {
  const { fetch, ...sandboxOptions } = options;
  return new RemoteExecutor({
    // A thunk, so a step that loses the deadline race gets a fresh interpreter.
    sandbox: () => new ProcessSandbox(sandboxOptions),
    ...(fetch === undefined ? {} : { fetch }),
  });
}
