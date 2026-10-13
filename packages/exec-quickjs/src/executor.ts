import {
  AgentCancelledError,
  AgentExecutionError,
  AgentTimeoutError,
  AgentToolCallError,
  type AgentErrorInfo,
  type CodeExecutor,
  type CodeResult,
  type ExecuteOptions,
  type ExecutorCapabilities,
  type Logger,
  type ToolContext,
} from "@smolagents-ts/core";
import {
  newQuickJSWASMModuleFromVariant,
  type QuickJSContext,
  type QuickJSHandle,
  type QuickJSRuntime,
  type QuickJSWASMModule,
} from "quickjs-emscripten-core";
import variant from "@jitl/quickjs-wasmfile-release-sync";
import {
  CALL_TOOL_GLOBAL,
  FINAL_ANSWER_GLOBAL,
  LOG_GLOBAL,
  buildGuestSource,
} from "./guest-source.js";
import { serializeToolResult, toErrorInfo } from "./marshal.js";

/** The guest heap cap (design 9.1). */
const DEFAULT_MEMORY_LIMIT_BYTES = 64 * 1024 * 1024;
/** The guest stack cap. Deep recursion in generated code is a bug, not a workload. */
const DEFAULT_MAX_STACK_SIZE_BYTES = 1024 * 1024;

export interface QuickJSExecutorOptions {
  /** Guest heap cap in bytes. Defaults to 64 MiB. */
  memoryLimitBytes?: number;
  /** Guest stack cap in bytes. Defaults to 1 MiB. */
  maxStackSizeBytes?: number;
  /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
  fetch?: typeof globalThis.fetch;
}

/** The runtime and context this executor owns, once they exist. */
interface Guest {
  readonly runtime: QuickJSRuntime;
  readonly context: QuickJSContext;
}

/** One execute() call's mutable state. The interrupt handler reads the current one. */
interface RunState {
  readonly options: ExecuteOptions;
  readonly logs: string[];
  toolCalls: number;
  callCounter: number;
  answered: boolean;
  value: unknown;
  deadline: number | undefined;
  timedOut: boolean;
  aborted: boolean;
}

/**
 * Runs agent-authored JavaScript in a QuickJS-WASM realm (design spec section 9).
 *
 * One instance serves one agent run: the context is created on the first execute() and reused
 * for every later step, so a variable defined in step 1 is visible in step 2 (decision D-21).
 * Tools run in the host; the guest awaits a promise the host settles, and this class drives
 * the runtime's job queue until that promise settles, because the engine is synchronous.
 *
 * dispose() releases the realm and must be called once the run ends.
 */
export class QuickJSExecutor implements CodeExecutor {
  readonly language = "javascript" as const;
  readonly capabilities: ExecutorCapabilities;

  private readonly memoryLimitBytes: number;
  private readonly maxStackSizeBytes: number;
  private readonly fetchImpl: typeof globalThis.fetch;
  private modulePromise: Promise<QuickJSWASMModule> | undefined;
  private runtime: QuickJSRuntime | undefined;
  private context: QuickJSContext | undefined;
  private run: RunState | undefined;
  private lastLogger: Logger | undefined;
  private disposed = false;

  constructor(options: QuickJSExecutorOptions = {}) {
    this.memoryLimitBytes = options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES;
    this.maxStackSizeBytes = options.maxStackSizeBytes ?? DEFAULT_MAX_STACK_SIZE_BYTES;
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.capabilities = {
      language: "javascript",
      isolation: "wasm",
      // The engine is synchronous, but the host drives its job queue, so the guest can await
      // a tool that returns a promise. The spike in the plan measured exactly this.
      asyncToolCalls: true,
      timers: true,
      network: "host-mediated",
      memoryLimitBytes: this.memoryLimitBytes,
      // No separate CPU budget: the caller's per-execute timeoutMs is the only one, and
      // reporting a second number here would be a claim nothing enforces.
    };
  }

  async execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    if (this.disposed) {
      throw new AgentExecutionError(
        "This QuickJS executor has been disposed; one instance serves one run.",
        { stepIndex: options.stepIndex },
      );
    }
    this.lastLogger = options.logger;
    const guest = await this.ensureGuest();
    const run: RunState = {
      options,
      logs: [],
      toolCalls: 0,
      callCounter: 0,
      answered: false,
      value: undefined,
      deadline: options.timeoutMs > 0 ? Date.now() + options.timeoutMs : undefined,
      timedOut: false,
      aborted: false,
    };
    this.run = run;
    const startedAt = Date.now();
    options.logger.debug("Running code in QuickJS", {
      stepIndex: options.stepIndex,
      tools: options.tools.size,
    });

    this.installShims(guest.context, run);
    const source = buildGuestSource({
      code,
      toolNames: options.tools.list().map((entry) => entry.name),
    });
    const evaluated = guest.context.evalCode(source, "agent-code.js");
    if (evaluated.error !== undefined) {
      // A syntax error, or a throw before the first await: no promise was ever created.
      const failure = this.describeError(guest.context, evaluated.error, run);
      evaluated.error.dispose();
      return this.buildResult(run, startedAt, failure);
    }
    const promise = guest.context.unwrapResult(evaluated);
    const failure = await this.drain(guest, promise, run);
    promise.dispose();
    return this.buildResult(run, startedAt, failure);
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const { context, runtime } = this;
    this.context = undefined;
    this.runtime = undefined;
    this.run = undefined;
    // The context must go first, and the release build asserts on a leaked handle by aborting
    // the whole WASM module. That abort is a catchable exception, and a caller cannot act on
    // it, so it is reported through the last logger and swallowed.
    try {
      context?.dispose();
    } catch (error) {
      this.warn("Disposing the QuickJS context aborted", error);
    }
    try {
      runtime?.dispose();
    } catch (error) {
      this.warn("Disposing the QuickJS runtime aborted", error);
    }
  }

  /** Load the engine once and create the realm once, so state survives between steps. */
  private async ensureGuest(): Promise<Guest> {
    this.modulePromise ??= newQuickJSWASMModuleFromVariant(variant);
    const module = await this.modulePromise;
    if (this.runtime === undefined || this.context === undefined) {
      const runtime = module.newRuntime();
      runtime.setMemoryLimit(this.memoryLimitBytes);
      runtime.setMaxStackSize(this.maxStackSizeBytes);
      runtime.setInterruptHandler(() => this.interrupted());
      this.runtime = runtime;
      this.context = runtime.newContext();
    }
    return { runtime: this.runtime, context: this.context };
  }

  /**
   * Install this call's shims. Every handle is disposed right after setProp, which copies the
   * reference; a handle that outlives the runtime aborts the module.
   */
  private installShims(context: QuickJSContext, run: RunState): void {
    const log = context.newFunction(LOG_GLOBAL, (lineHandle) => {
      const line = context.getString(lineHandle);
      run.logs.push(line);
      run.options.onLog?.(line);
    });
    context.setProp(context.global, LOG_GLOBAL, log);
    log.dispose();

    const callTool = context.newFunction(CALL_TOOL_GLOBAL, (nameHandle, argsHandle) => {
      const name = context.getString(nameHandle);
      const raw = context.getString(argsHandle);
      return context.newPromise(this.runTool(context, name, raw, run)).handle;
    });
    context.setProp(context.global, CALL_TOOL_GLOBAL, callTool);
    callTool.dispose();

    const finalAnswer = context.newFunction(FINAL_ANSWER_GLOBAL, (valueHandle) => {
      if (run.answered) return;
      run.answered = true;
      run.value = context.dump(valueHandle);
      run.options.finalAnswer.submit(run.value);
    });
    context.setProp(context.global, FINAL_ANSWER_GLOBAL, finalAnswer);
    finalAnswer.dispose();
  }

  /**
   * One tool call. The guest awaited this, so every failure rejects the host promise and
   * arrives in the guest as an ordinary Error it can catch.
   */
  private async runTool(
    context: QuickJSContext,
    name: string,
    raw: string,
    run: RunState,
  ): Promise<QuickJSHandle> {
    const options = run.options;
    run.toolCalls += 1;
    run.callCounter += 1;
    const callId = "call_" + String(run.callCounter);
    const fail = (message: string): Error => {
      const error = new AgentToolCallError(message, { stepIndex: options.stepIndex });
      options.onToolCall?.({ type: "failed", callId, name, error: error.info });
      return new Error(message);
    };

    const tool = options.tools.get(name);
    if (tool === undefined) throw fail("Unknown tool: " + name);

    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      throw fail("Arguments for " + name + " were not JSON");
    }

    const parsed = tool.inputSchema.safeParse(input);
    if (!parsed.success) {
      throw fail("Invalid arguments for " + name + ": " + parsed.error.message);
    }

    options.onToolCall?.({ type: "requested", callId, name, args: parsed.data });
    const startedAt = Date.now();
    const toolContext: ToolContext = {
      signal: options.signal,
      fetch: this.fetchImpl,
      callId,
      stepIndex: options.stepIndex,
      logger: options.logger,
    };
    try {
      const output = await tool.execute(parsed.data, toolContext);
      options.onToolCall?.({
        type: "result",
        callId,
        name,
        output,
        durationMs: Date.now() - startedAt,
      });
      return context.newString(serializeToolResult(output));
    } catch (error) {
      const info = toErrorInfo(error, "AGENT_TOOL_CALL", options.stepIndex);
      options.onToolCall?.({ type: "failed", callId, name, error: info });
      throw new Error('Tool "' + name + '" failed: ' + info.message, { cause: error });
    }
  }

  /**
   * Drive the runtime until the guest's promise settles. This loop is the bridge: the engine
   * is synchronous, so a host promise only moves when its jobs are executed, and the host
   * needs its own macrotasks between rounds or the promise never resolves.
   */
  private async drain(
    guest: Guest,
    promise: QuickJSHandle,
    run: RunState,
  ): Promise<AgentErrorInfo | undefined> {
    for (;;) {
      const ran = guest.runtime.executePendingJobs();
      if (ran.error !== undefined) {
        const failure = this.describeError(guest.context, ran.error, run);
        ran.dispose();
        return failure;
      }
      ran.dispose();

      const state = guest.context.getPromiseState(promise);
      if (state.type === "fulfilled") {
        state.value.dispose();
        return undefined;
      }
      if (state.type === "rejected") {
        const failure = this.describeError(guest.context, state.error, run);
        state.error.dispose();
        return failure;
      }
      // Nothing left to run and no settlement: the guest is waiting on a host promise that
      // never resolves. The handler cannot fire while the runtime is idle, so stop here.
      if (this.interrupted()) return this.interruptInfo(run);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  /**
   * Whether this run should stop. The runtime calls this while guest code runs (that is the
   * CPU-limit mechanism), and the drain loop calls it between jobs.
   */
  private interrupted(): boolean {
    const run = this.run;
    if (run === undefined) return false;
    if (run.options.signal.aborted) {
      run.aborted = true;
      return true;
    }
    if (run.deadline !== undefined && Date.now() > run.deadline) {
      run.timedOut = true;
      return true;
    }
    return false;
  }

  private interruptInfo(run: RunState): AgentErrorInfo {
    if (run.timedOut) {
      return new AgentTimeoutError(
        "Code execution timed out after " + String(run.options.timeoutMs) + " ms",
        { stepIndex: run.options.stepIndex },
      ).info;
    }
    return new AgentCancelledError("Code execution was cancelled", {
      stepIndex: run.options.stepIndex,
    }).info;
  }

  /** A guest error, unless the stop was ours: then the reason is the timeout or the signal. */
  private describeError(
    context: QuickJSContext,
    handle: QuickJSHandle,
    run: RunState,
  ): AgentErrorInfo {
    if (run.timedOut || run.aborted) return this.interruptInfo(run);
    const dumped = context.dump(handle) as { name?: unknown; message?: unknown } | undefined;
    const name = typeof dumped?.name === "string" ? dumped.name : "Error";
    const message = typeof dumped?.message === "string" ? dumped.message : String(dumped);
    return { name, message, code: "AGENT_EXECUTION", stepIndex: run.options.stepIndex };
  }

  private buildResult(
    run: RunState,
    startedAt: number,
    failure: AgentErrorInfo | undefined,
  ): CodeResult {
    return {
      logs: run.logs.join("\n"),
      isFinalAnswer: run.answered,
      ...(run.answered ? { value: run.value } : {}),
      ...(failure === undefined ? {} : { error: failure }),
      durationMs: Date.now() - startedAt,
      toolCallCount: run.toolCalls,
    };
  }

  private warn(message: string, error: unknown): void {
    this.lastLogger?.warn(message, error);
  }
}
