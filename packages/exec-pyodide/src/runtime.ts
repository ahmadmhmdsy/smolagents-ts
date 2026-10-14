import { AgentExecutionError } from "@smolagents-ts/core";

import type { PyodideLoader, PyodideRuntime } from "./loader.js";

/** The options a session needs; the executor supplies the live log sink. */
export interface PyodideSessionOptions {
  readonly loader: PyodideLoader;
  readonly indexURL: string | undefined;
  readonly onStdout: (text: string) => void;
  readonly onStderr: (text: string) => void;
}

/**
 * Owns the one runtime an executor reuses across steps.
 *
 * The runtime is created on the first `get()`, the stdout and stderr handlers are installed
 * at that moment and never replaced, and every later `get()` returns the same runtime. There
 * is no way to unload Pyodide, so `dispose()` only drops the reference; the decision record
 * owns that limitation rather than this file pretending otherwise.
 *
 * `invalidate()` is the poisoning path. A run whose await boundary let the deadline or the
 * abort win is abandoned mid-flight, and the only sound thing to do with a runtime that has
 * live Python on it is to stop using it: the next `get()` pays one cold start instead.
 */
export class PyodideSession {
  private runtimePromise: Promise<PyodideRuntime> | undefined;
  private disposed = false;

  constructor(private readonly options: PyodideSessionOptions) {}

  /** The current runtime, loading one on the first call. */
  get(): Promise<PyodideRuntime> {
    if (this.disposed) {
      return Promise.reject(
        new AgentExecutionError("The Pyodide session has been disposed; one session serves one run."),
      );
    }
    this.runtimePromise ??= this.create();
    return this.runtimePromise;
  }

  /** Drop the loaded runtime, if any, without loading another. */
  invalidate(): void {
    this.runtimePromise = undefined;
  }

  /**
   * Drop the reference to the runtime and refuse further loads. Idempotent: the second call
   * is quiet, because a clean-up path that throws on the second call is a trap.
   */
  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.runtimePromise = undefined;
  }

  private async create(): Promise<PyodideRuntime> {
    const runtime = await this.options.loader(
      this.options.indexURL === undefined ? undefined : { indexURL: this.options.indexURL },
    );
    runtime.setStdout({ batched: this.options.onStdout });
    runtime.setStderr({ batched: this.options.onStderr });
    return runtime;
  }
}
