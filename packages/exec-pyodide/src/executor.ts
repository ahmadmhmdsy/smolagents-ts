import {
  AgentCancelledError,
  AgentError,
  AgentExecutionError,
  AgentTimeoutError,
  type AgentErrorInfo,
  type CodeExecutor,
  type CodeResult,
  type ExecuteOptions,
  type ExecutorCapabilities,
  type Logger,
} from "@smolagents-ts/core";

import { ToolBridge } from "./bridge.js";
import {
  FINAL_ANSWER_RAISED_GLOBAL,
  FINAL_ANSWER_VALUE_GLOBAL,
  TOOL_CALL_GLOBAL,
  buildGuestSource,
} from "./guest-source.js";
import { DEFAULT_AUTHORIZED_IMPORTS, installImportGuard } from "./imports.js";
import { defaultPyodideLoader, type PyodideLoader, type PyodideRuntime } from "./loader.js";
import { PyodideSession } from "./runtime.js";
import { LogStream } from "./streams.js";

export interface PyodideExecutorOptions {
  /**
   * Replaces the runtime loader. A test stands a fake in here; a page passes a loader that
   * fetches the runtime from its own CDN base.
   */
  loader?: PyodideLoader;
  /** The indexURL handed to the loader, so the WASM and stdlib come from one base. */
  indexURL?: string;
  /** Extra modules for the import guard, appended to upstream's default list. */
  additionalAuthorizedImports?: readonly string[];
  /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
  fetch?: typeof globalThis.fetch;
}

/** One execute() call's mutable state. */
interface RunState {
  readonly options: ExecuteOptions;
  readonly logs: LogStream;
  readonly bridge: ToolBridge;
}

type StopReason = "timeout" | "cancelled";

type Attempt =
  | { kind: "done"; value: unknown }
  | { kind: "error"; error: unknown }
  | { kind: "stopped"; reason: StopReason };

/**
 * Runs agent-authored Python on WASM CPython (Pyodide) in this process, on Node and in the
 * browser (decision 0016).
 *
 * One instance serves one agent run: the runtime is loaded on the first execute() and reused,
 * so a variable assigned in step 1 is visible in step 2. Unlike a worker-backed adapter there
 * is no interrupt: the JS thread is the Python thread, so a synchronous guest loop cannot be
 * preempted and the host only learns of a deadline or an abort when the guest next yields.
 * When that happens the run is abandoned and the runtime is poisoned, because live Python on
 * a runtime cannot be unwound safely; the next execute() pays one cold start.
 */
export class PyodideExecutor implements CodeExecutor {
  readonly language = "python" as const;
  readonly capabilities: ExecutorCapabilities;

  private readonly loader: PyodideLoader;
  private readonly indexURL: string | undefined;
  private readonly authorizedImports: readonly string[];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly session: PyodideSession;
  private activeRun: RunState | undefined;
  private guardedRuntime: PyodideRuntime | undefined;
  private lastLogger: Logger | undefined;
  private disposed = false;

  constructor(options: PyodideExecutorOptions = {}) {
    this.loader = options.loader ?? defaultPyodideLoader;
    this.indexURL = options.indexURL;
    this.authorizedImports = [
      ...DEFAULT_AUTHORIZED_IMPORTS,
      ...(options.additionalAuthorizedImports ?? []),
    ];
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.session = new PyodideSession({
      loader: this.loader,
      indexURL: this.indexURL,
      onStdout: (text) => {
        this.activeRun?.logs.write(text);
      },
      onStderr: (text) => {
        this.activeRun?.logs.write(text);
      },
    });
    this.capabilities = {
      language: "python",
      isolation: "wasm",
      // Probe A (2026-10-14): a Python guest under runPythonAsync awaits a host callable whose
      // JS implementation returns a promise settled by a real timer, and receives the value.
      asyncToolCalls: true,
      // There is no host scheduler wired into the guest and no way to interrupt a synchronous
      // loop, so the guest is not offered timers even though Pyodide's own asyncio loop works.
      timers: false,
      network: "host-mediated",
      // No optional limit: Pyodide exposes neither a memory cap nor a CPU budget to this seam,
      // and reporting a number nothing enforces would be a claim, not a capability.
    };
  }

  async execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    if (this.disposed) {
      throw new AgentExecutionError(
        "This Pyodide executor has been disposed; one instance serves one run.",
        { stepIndex: options.stepIndex },
      );
    }
    this.lastLogger = options.logger;

    const startedAt = Date.now();
    const bridge = new ToolBridge({
      tools: options.tools,
      signal: options.signal,
      stepIndex: options.stepIndex,
      logger: options.logger,
      fetch: this.fetchImpl,
      ...(options.agentPath === undefined ? {} : { agentPath: options.agentPath }),
      ...(options.onToolCall === undefined ? {} : { onToolCall: options.onToolCall }),
    });
    const run: RunState = { options, logs: new LogStream(options.onLog), bridge };
    this.activeRun = run;

    if (options.signal.aborted) {
      this.activeRun = undefined;
      return this.buildResult(run, startedAt, this.stopInfo(run, "cancelled"));
    }

    const runtime = await this.ensureGuest(options.stepIndex);
    options.logger.debug("Running code in Pyodide", {
      stepIndex: options.stepIndex,
      tools: options.tools.size,
      version: runtime.version,
    });

    // Re-set the dispatcher every run: a bridge from a previous or abandoned run must never
    // serve this one.
    runtime.globals.set(TOOL_CALL_GLOBAL, bridge.call);

    const toolNames = options.tools.list().map((entry) => entry.name);
    const source = buildGuestSource({ code, toolNames });
    const attempt = await this.runAttempt(runtime, source, run);

    if (attempt.kind === "stopped") {
      this.abandon(runtime, bridge, attempt.reason);
      return this.buildResult(run, startedAt, this.stopInfo(run, attempt.reason));
    }
    this.activeRun = undefined;
    // The step is over, but a guest coroutine it scheduled (asyncio.ensure_future) can still
    // hold the dispatcher; retire it so that call cannot run a tool on a finished step's
    // signal and report into its onToolCall. The next run installs a fresh bridge.
    bridge.disable();
    // final_answer records the value and then raises _FinalAnswerSignal, so the answer arrives
    // as this attempt's error. The flag, not the signal's survival, is the authority: the
    // signal is a BaseException a guest may still catch, and the flag is what says an answer
    // was recorded. Read it before the error, or every final_answer call reports a failure.
    const raised = runtime.globals.get(FINAL_ANSWER_RAISED_GLOBAL) === true;
    if (raised) {
      const value = toPlainValue(runtime.globals.get(FINAL_ANSWER_VALUE_GLOBAL));
      run.options.finalAnswer.submit(value);
      return this.buildResult(run, startedAt, undefined, true, value);
    }
    if (attempt.kind === "error") {
      return this.buildResult(run, startedAt, this.describeGuestError(attempt.error, run));
    }
    return this.buildResult(run, startedAt, undefined);
  }

  async dispose(): Promise<void> {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    this.activeRun?.bridge.disable();
    this.activeRun = undefined;
    this.guardedRuntime = undefined;
    await this.session.dispose();
  }

  /** Load the runtime once and install the guard once, so state survives between steps. */
  private async ensureGuest(stepIndex: number): Promise<PyodideRuntime> {
    try {
      const runtime = await this.session.get();
      if (this.guardedRuntime !== runtime) {
        // The prelude's own imports must run before the guard replaces __import__, or the
        // guard refuses json on the first run.
        runtime.runPython(buildGuestSource({ toolNames: [] }));
        installImportGuard(runtime, this.authorizedImports);
        this.guardedRuntime = runtime;
      }
      return runtime;
    } catch (error) {
      if (error instanceof AgentError) {
        throw error;
      }
      // rules/components/exec-pyodide.md: a host with no usable runtime fails with a typed
      // executor error, and it never falls back to evaluating guest code in the host.
      throw new AgentExecutionError("The Pyodide runtime could not be loaded.", {
        stepIndex,
        cause: error,
      });
    }
  }

  /**
   * Race the run against its clock and its abort signal. The guest and the host share one
   * thread, so the stop can only win while the guest is at an await boundary; a synchronous
   * guest runs to completion first, and the post-run wall-clock check reports the stop then.
   */
  private async runAttempt(
    runtime: PyodideRuntime,
    source: string,
    run: RunState,
  ): Promise<Attempt> {
    const options = run.options;
    const deadline = options.timeoutMs > 0 ? Date.now() + options.timeoutMs : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const stopped = new Promise<Attempt>((resolve) => {
      if (deadline !== undefined) {
        timer = setTimeout(
          () => resolve({ kind: "stopped", reason: "timeout" }),
          Math.max(0, deadline - Date.now()),
        );
      }
      if (options.signal.aborted) {
        resolve({ kind: "stopped", reason: "cancelled" });
        return;
      }
      onAbort = () => resolve({ kind: "stopped", reason: "cancelled" });
      options.signal.addEventListener("abort", onAbort, { once: true });
    });

    // The attempt observes its own rejection, so a poisoned run's abandoned promise is inert
    // rather than an unhandled rejection.
    const attempt: Promise<Attempt> = runtime.runPythonAsync(source).then(
      (value) => ({ kind: "done" as const, value }),
      (error) => ({ kind: "error" as const, error }),
    );
    const outcome = await Promise.race([attempt, stopped]);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    if (onAbort !== undefined) {
      options.signal.removeEventListener("abort", onAbort);
    }
    if (outcome.kind !== "stopped") {
      if (deadline !== undefined && Date.now() > deadline) {
        return { kind: "stopped", reason: "timeout" };
      }
      if (options.signal.aborted) {
        return { kind: "stopped", reason: "cancelled" };
      }
    }
    return outcome;
  }

  /**
   * Stop using a runtime that still has live Python on it. The session drops it so the next
   * execute() loads a fresh one, the bridge is disabled so dead code cannot reach a tool, and
   * the dead runtime's handlers are replaced with no-ops so its late output cannot land in a
   * later run's buffer.
   */
  private abandon(runtime: PyodideRuntime, bridge: ToolBridge, reason: StopReason): void {
    this.activeRun = undefined;
    bridge.disable();
    this.session.invalidate();
    this.guardedRuntime = undefined;
    const discard = (): void => undefined;
    try {
      runtime.setStdout({ batched: discard });
      runtime.setStderr({ batched: discard });
    } catch (error) {
      this.warn("Could not detach the abandoned Pyodide runtime's stream handlers", error);
    }
    this.warn(
      reason === "timeout"
        ? "Abandoned the Pyodide runtime after a timeout; the next step loads a new one"
        : "Abandoned the Pyodide runtime after a cancellation; the next step loads a new one",
    );
  }

  private stopInfo(run: RunState, reason: StopReason): AgentErrorInfo {
    if (reason === "timeout") {
      return new AgentTimeoutError(
        "Code execution timed out after " + String(run.options.timeoutMs) + " ms",
        { stepIndex: run.options.stepIndex },
      ).info;
    }
    return new AgentCancelledError("Code execution was cancelled", {
      stepIndex: run.options.stepIndex,
    }).info;
  }

  /**
   * A guest failure. Pyodide's PythonError carries the Python exception class in its type and
   * the traceback in its message; a JS error that escaped the bridge arrives the same way.
   */
  private describeGuestError(error: unknown, run: RunState): AgentErrorInfo {
    const candidate = error as { type?: unknown } | undefined;
    const name =
      typeof candidate?.type === "string"
        ? candidate.type
        : error instanceof Error
          ? error.name
          : "PythonError";
    const message = error instanceof Error ? error.message : String(error);
    return { name, message, code: "AGENT_EXECUTION", stepIndex: run.options.stepIndex };
  }

  private buildResult(
    run: RunState,
    startedAt: number,
    failure: AgentErrorInfo | undefined,
    answered = false,
    value?: unknown,
  ): CodeResult {
    return {
      logs: run.logs.text,
      isFinalAnswer: answered,
      ...(answered ? { value } : {}),
      ...(failure === undefined ? {} : { error: failure }),
      durationMs: Date.now() - startedAt,
      toolCallCount: run.bridge.toolCallCount,
    };
  }

  private warn(message: string, error?: unknown): void {
    if (error === undefined) {
      this.lastLogger?.warn(message);
      return;
    }
    this.lastLogger?.warn(message, error);
  }
}

/**
 * A value the guest handed back. Primitives cross natively; a Python container arrives as a
 * PyProxy, which is unwrapped into plain data and then destroyed so the proxy table does not
 * grow one answer per step.
 */
function toPlainValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  const type = typeof value;
  if (type !== "object" && type !== "function") {
    return value;
  }
  const proxy = value as { toJs?: (options?: unknown) => unknown; destroy?: () => void };
  if (typeof proxy.toJs !== "function") {
    return value;
  }
  try {
    return proxy.toJs({ create_pyproxies: false });
  } catch {
    return String(value);
  } finally {
    try {
      proxy.destroy?.();
    } catch {
      // The proxy is already gone; there is nothing left to release.
    }
  }
}
