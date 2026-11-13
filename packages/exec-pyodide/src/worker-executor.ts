import {
  AgentCancelledError,
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
import { LogStream } from "./streams.js";
import type { HostToWorkerMessage, WorkerToHostMessage } from "./worker-protocol.js";

/**
 * The host's handle on one worker: whatever runs the worker script, reduced to the four calls
 * the executor makes. A page whose bundler cannot resolve the shipped script returns one of
 * these from `createWorker`.
 */
export interface PyodideWorkerHandle {
  postMessage(message: unknown): void;
  onMessage(listener: (message: unknown) => void): void;
  /** Called when the worker dies on its own: an uncaught error, or an exit the host did not ask for. */
  onError(listener: (error: unknown) => void): void;
  terminate(): unknown;
}

export interface PyodideWorkerExecutorOptions {
  /** The indexURL handed to the worker's loader, so the WASM and stdlib come from one base. */
  indexURL?: string;
  /** Extra modules for the import guard, appended to upstream's default list. */
  additionalAuthorizedImports?: readonly string[];
  /** The fetch handed to tools through ToolContext. Tools run on the host, not in the worker. */
  fetch?: typeof globalThis.fetch;
  /**
   * The wall-clock bound on one step, in milliseconds, reported as `capabilities.cpuTimeLimitMs`.
   * A step stops at this bound or at its own `timeoutMs`, whichever is shorter. Defaults to
   * 30,000, the agents' default execution timeout.
   */
  cpuTimeLimitMs?: number;
  /** Where the worker script is. Defaults to `pyodide-worker.js` beside this module. */
  workerUrl?: URL | string;
  /** Replaces how the worker is started; takes precedence over `workerUrl`. */
  createWorker?: () => PyodideWorkerHandle;
}

export const DEFAULT_WORKER_CPU_TIME_LIMIT_MS = 30_000;

type StopReason = "timeout" | "cancelled";

interface ActiveRun {
  readonly runId: number;
  readonly bridge: ToolBridge;
  readonly logs: LogStream;
  readonly settle: (outcome: RunOutcome) => void;
}

/** How a worker's start ended: loaded, failed to load, or died while loading. */
type Startup =
  | { kind: "ready" }
  | { kind: "failed"; name: string; message: string }
  | { kind: "crashed"; error: unknown };

interface WorkerSlot {
  readonly handle: PyodideWorkerHandle;
  readonly ready: Promise<Startup>;
}

type RunOutcome =
  | { kind: "done"; isFinalAnswer: boolean; value?: unknown; error?: AgentErrorInfo }
  | { kind: "failed"; name: string; message: string }
  | { kind: "stopped"; reason: StopReason }
  | { kind: "crashed"; error: unknown };

/**
 * Runs agent-authored Python in a Pyodide worker the host can terminate (decision 0041).
 *
 * The worker runs the in-process `PyodideExecutor`, so the import guard, the tool envelope and
 * the final-answer path are the same code. What the worker adds is a stop that works on a
 * synchronous loop: at the step's deadline, or on an abort, the host terminates the worker and
 * returns the same timeout or cancellation error the in-process executor does. The guest's
 * globals are lost with it, and the next `execute()` starts a fresh worker and pays one cold
 * start. Every tool call is a message round trip to the host, where the real tool runs, so a
 * tool's arguments and result cross as JSON.
 *
 * The termination is the bound; the worker is not a security boundary, and the import
 * allow-list is fidelity, exactly as in process.
 */
export class PyodideWorkerExecutor implements CodeExecutor {
  readonly language = "python" as const;
  readonly capabilities: ExecutorCapabilities;

  private readonly indexURL: string | undefined;
  private readonly additionalAuthorizedImports: readonly string[];
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly cpuTimeLimitMs: number;
  private readonly createWorker: () => PyodideWorkerHandle;
  private worker: WorkerSlot | undefined;
  private active: ActiveRun | undefined;
  private lastRunId = 0;
  private lastLogger: Logger | undefined;
  private disposed = false;

  constructor(options: PyodideWorkerExecutorOptions = {}) {
    this.indexURL = options.indexURL;
    this.additionalAuthorizedImports = options.additionalAuthorizedImports ?? [];
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    const limit = options.cpuTimeLimitMs ?? DEFAULT_WORKER_CPU_TIME_LIMIT_MS;
    if (!Number.isFinite(limit) || limit <= 0) {
      throw new Error("cpuTimeLimitMs must be a positive number of milliseconds");
    }
    this.cpuTimeLimitMs = limit;
    const workerUrl = options.workerUrl;
    this.createWorker =
      options.createWorker ?? (() => defaultCreateWorker(workerUrl));
    this.capabilities = {
      language: "python",
      isolation: "wasm",
      asyncToolCalls: true,
      timers: false,
      network: "host-mediated",
      cpuTimeLimitMs: limit,
    };
  }

  async execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    if (this.disposed) {
      throw new AgentExecutionError(
        "This Pyodide worker executor has been disposed; one instance serves one run.",
        { stepIndex: options.stepIndex },
      );
    }
    if (this.active !== undefined) {
      throw new AgentExecutionError("A Pyodide worker step is already running.", {
        stepIndex: options.stepIndex,
      });
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
    const logs = new LogStream(options.onLog);
    const result = (failure?: AgentErrorInfo, answered = false, value?: unknown): CodeResult => ({
      logs: logs.text,
      isFinalAnswer: answered,
      ...(answered ? { value } : {}),
      ...(failure === undefined ? {} : { error: failure }),
      durationMs: Date.now() - startedAt,
      toolCallCount: bridge.toolCallCount,
    });

    if (options.signal.aborted) {
      return result(stopInfo("cancelled", options));
    }

    const slot = this.ensureWorker();
    // The clock starts once the runtime is loaded, so a cold start is never charged to a step;
    // an abort still wins while the worker loads.
    const startup = await raceAbort(slot.ready, options.signal);
    if (startup === "aborted") {
      this.terminate("Terminated the loading Pyodide worker after a cancellation");
      return result(stopInfo("cancelled", options));
    }
    if (startup.kind !== "ready" || this.worker !== slot) {
      this.terminate();
      throw new AgentExecutionError(
        startup.kind === "failed"
          ? "The Pyodide runtime could not be loaded in the worker."
          : "The Pyodide worker stopped before its runtime loaded.",
        {
          stepIndex: options.stepIndex,
          cause:
            startup.kind === "failed"
              ? new Error(startup.name + ": " + startup.message)
              : startup.kind === "crashed"
                ? startup.error
                : undefined,
        },
      );
    }
    const worker = slot.handle;
    this.lastRunId += 1;
    const runId = this.lastRunId;
    const bound =
      options.timeoutMs > 0 ? Math.min(options.timeoutMs, this.cpuTimeLimitMs) : this.cpuTimeLimitMs;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const outcome = await new Promise<RunOutcome>((resolve) => {
      this.active = { runId, bridge, logs, settle: resolve };
      timer = setTimeout(() => resolve({ kind: "stopped", reason: "timeout" }), bound);
      onAbort = () => resolve({ kind: "stopped", reason: "cancelled" });
      options.signal.addEventListener("abort", onAbort, { once: true });
      options.logger.debug("Running code in a Pyodide worker", {
        stepIndex: options.stepIndex,
        tools: options.tools.size,
        boundMs: bound,
      });
      this.post(worker, {
        kind: "execute",
        runId,
        code,
        toolNames: options.tools.list().map((entry) => entry.name),
        stepIndex: options.stepIndex,
      });
    });
    clearTimeout(timer);
    if (onAbort !== undefined) options.signal.removeEventListener("abort", onAbort);
    this.active = undefined;
    // A late tool call from this step must not reach a tool, its signal or its onToolCall.
    bridge.disable();

    switch (outcome.kind) {
      case "stopped":
        this.terminate(
          outcome.reason === "timeout"
            ? "Terminated the Pyodide worker after a timeout; the next step starts a new one"
            : "Terminated the Pyodide worker after a cancellation; the next step starts a new one",
        );
        return result(stopInfo(outcome.reason, options));
      case "crashed":
        this.terminate();
        throw new AgentExecutionError("The Pyodide worker stopped unexpectedly.", {
          stepIndex: options.stepIndex,
          cause: outcome.error,
        });
      case "failed":
        this.terminate();
        throw new AgentExecutionError("The Pyodide worker could not run the step.", {
          stepIndex: options.stepIndex,
          cause: new Error(outcome.name + ": " + outcome.message),
        });
      case "done":
        if (outcome.isFinalAnswer) {
          options.finalAnswer.submit(outcome.value);
          return result(undefined, true, outcome.value);
        }
        return result(outcome.error);
    }
  }

  /** Terminate the worker, which reclaims its runtime. Idempotent. */
  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.active?.settle({ kind: "stopped", reason: "cancelled" });
    this.terminate();
  }

  private ensureWorker(): WorkerSlot {
    if (this.worker !== undefined) return this.worker;
    const handle = this.createWorker();
    let settleStartup: (startup: Startup) => void = () => undefined;
    const ready = new Promise<Startup>((resolve) => {
      settleStartup = resolve;
    });
    const slot: WorkerSlot = { handle, ready };
    this.worker = slot;
    handle.onMessage((message) => {
      if (this.worker !== slot) return;
      const typed = message as WorkerToHostMessage;
      if (typed.kind === "ready") {
        settleStartup({ kind: "ready" });
      } else if (typed.kind === "failed" && typed.runId === 0) {
        settleStartup({ kind: "failed", name: typed.name, message: typed.message });
      } else {
        this.receive(handle, typed);
      }
    });
    handle.onError((error) => {
      if (this.worker !== slot) return;
      this.worker = undefined;
      settleStartup({ kind: "crashed", error });
      this.active?.settle({ kind: "crashed", error });
    });
    this.post(handle, {
      kind: "init",
      additionalAuthorizedImports: this.additionalAuthorizedImports,
      ...(this.indexURL === undefined ? {} : { indexURL: this.indexURL }),
    });
    return slot;
  }

  private receive(worker: PyodideWorkerHandle, message: WorkerToHostMessage): void {
    if (message.kind === "warn") {
      this.lastLogger?.warn(message.message);
      return;
    }
    if (message.kind === "ready") return;
    const run = this.active;
    if (run?.runId !== message.runId) {
      // A finished step's coroutine called a tool after its step reported; refuse it the way the
      // in-process bridge refuses a late call.
      if (message.kind === "tool-call") {
        this.post(worker, {
          kind: "tool-result",
          runId: message.runId,
          callId: message.callId,
          envelope: JSON.stringify({ ok: false, error: "Code execution was cancelled" }),
        });
      }
      return;
    }
    switch (message.kind) {
      case "log":
        run.logs.write(message.line);
        return;
      case "tool-call":
        void run.bridge.call(message.name, message.argsJson).then((envelope) => {
          if (this.worker?.handle === worker) {
            this.post(worker, {
              kind: "tool-result",
              runId: message.runId,
              callId: message.callId,
              envelope,
            });
          }
        });
        return;
      case "done":
        run.settle({
          kind: "done",
          isFinalAnswer: message.isFinalAnswer,
          ...(message.value === undefined ? {} : { value: message.value }),
          ...(message.error === undefined ? {} : { error: message.error }),
        });
        return;
      case "failed":
        run.settle({ kind: "failed", name: message.name, message: message.message });
        return;
    }
  }

  private post(worker: PyodideWorkerHandle, message: HostToWorkerMessage): void {
    worker.postMessage(message);
  }

  private terminate(warning?: string): void {
    const slot = this.worker;
    this.worker = undefined;
    if (slot === undefined) return;
    try {
      void Promise.resolve(slot.handle.terminate()).catch(() => undefined);
    } catch (error) {
      this.lastLogger?.warn("Could not terminate the Pyodide worker", error);
    }
    if (warning !== undefined) this.lastLogger?.warn(warning);
  }
}

/** The startup, or "aborted" if the signal fires first. */
function raceAbort(ready: Promise<Startup>, signal: AbortSignal): Promise<Startup | "aborted"> {
  if (signal.aborted) return Promise.resolve("aborted");
  return new Promise((resolve) => {
    const onAbort = (): void => resolve("aborted");
    signal.addEventListener("abort", onAbort, { once: true });
    void ready.then((startup) => {
      signal.removeEventListener("abort", onAbort);
      resolve(startup);
    });
  });
}

function stopInfo(reason: StopReason, options: ExecuteOptions): AgentErrorInfo {
  if (reason === "timeout") {
    return new AgentTimeoutError("Code execution timed out after " + String(options.timeoutMs) + " ms", {
      stepIndex: options.stepIndex,
    }).info;
  }
  return new AgentCancelledError("Code execution was cancelled", { stepIndex: options.stepIndex }).info;
}

interface NodeWorker {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: unknown) => void): void;
  on(event: "error", listener: (error: unknown) => void): void;
  on(event: "exit", listener: (code: number) => void): void;
  terminate(): Promise<number>;
  unref(): void;
}

/**
 * Start the shipped worker script: a `worker_threads` worker on Node, a module `Worker` in a
 * browser. Node's builtin is reached through `process.getBuiltinModule`, so this module names
 * no Node builtin in an import and the barrel stays isomorphic.
 */
function defaultCreateWorker(workerUrl: URL | string | undefined): PyodideWorkerHandle {
  const nodeProcess = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process;
  const workerThreads = nodeProcess?.getBuiltinModule?.("node:worker_threads") as
    | { Worker: new (url: URL | string) => NodeWorker }
    | undefined;
  if (workerThreads !== undefined) {
    const worker = new workerThreads.Worker(workerUrl ?? new URL("./pyodide-worker.js", import.meta.url));
    // An idle worker between steps must not keep the host process alive.
    worker.unref();
    let terminating = false;
    return {
      postMessage: (message) => worker.postMessage(message),
      onMessage: (listener) => worker.on("message", listener),
      onError: (listener) => {
        worker.on("error", listener);
        worker.on("exit", (exitCode) => {
          if (!terminating) listener(new Error("The Pyodide worker exited with code " + String(exitCode)));
        });
      },
      terminate: () => {
        terminating = true;
        return worker.terminate();
      },
    };
  }
  if (typeof Worker !== "function") {
    throw new AgentExecutionError("This host has neither worker_threads nor a Web Worker; pass createWorker.");
  }
  // Written as one expression so a bundler that follows `new Worker(new URL(...))` ships the script.
  const worker =
    workerUrl === undefined
      ? new Worker(new URL("./pyodide-worker.js", import.meta.url), { type: "module" })
      : new Worker(workerUrl, { type: "module" });
  return {
    postMessage: (message) => worker.postMessage(message),
    onMessage: (listener) => worker.addEventListener("message", (event) => listener(event.data)),
    onError: (listener) => worker.addEventListener("error", (event) => listener(event)),
    terminate: () => worker.terminate(),
  };
}
