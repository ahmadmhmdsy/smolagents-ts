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
} from "@smolagents-ts/core";

import type { RemoteSandbox, RemoteSandboxFactory, SandboxOutput, SandboxToolCall } from "./sandbox.js";
import { buildShimSource } from "./shim-source.js";
import { LogStream } from "./streams.js";

/**
 * The `CodeExecutor` every backend subpath shares. It owns the host half of the frame protocol:
 * it installs the shim on the first step with the step index's tool specs, answers each tool frame
 * through the registry, folds `final_answer` into `CodeResult.value`, and turns every other
 * failure into `AGENT_EXECUTION`.
 *
 * One instance serves one agent run. `start` is deferred to the first `execute`, and a stop that
 * wins the deadline race disposes the losing run and, when a factory was given, makes the next
 * step a fresh sandbox.
 */

export interface RemoteExecutorOptions {
  /** An unstarted sandbox, or a factory that makes one on demand (used after a stop). */
  readonly sandbox: RemoteSandbox | RemoteSandboxFactory;
  /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
  readonly fetch?: typeof globalThis.fetch;
  /**
   * Carry a `pickle:` payload as raw bytes. False by default: the host never executes pickle
   * opcodes, so a payload that needs unpickling is refused with a typed error instead.
   */
  readonly allowPickle?: boolean;
}

type StopReason = "timeout" | "cancelled";

type Attempt =
  | { readonly kind: "answer"; readonly value: unknown }
  | { readonly kind: "done" }
  | { readonly kind: "failure"; readonly error: AgentErrorInfo };

type Outcome = Attempt | { readonly kind: "stopped"; readonly reason: StopReason };

export class RemoteExecutor implements CodeExecutor {
  readonly language = "python" as const;
  readonly capabilities: ExecutorCapabilities;

  private readonly factory: RemoteSandboxFactory | undefined;
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly allowPickle: boolean;
  private sandbox: RemoteSandbox;
  private started = false;
  private disposed = false;

  constructor(options: RemoteExecutorOptions) {
    if (typeof options.sandbox === "function") {
      this.factory = options.sandbox;
      this.sandbox = options.sandbox();
    } else {
      this.factory = undefined;
      this.sandbox = options.sandbox;
    }
    this.fetchImpl = options.fetch ?? globalThis.fetch;
    this.allowPickle = options.allowPickle === true;
    this.capabilities = {
      language: "python",
      isolation: this.sandbox.capabilities.isolation,
      // The guest blocks on a tool call and the host answers it; a tool that returns a Promise
      // is awaited here, so the guest itself never awaits one.
      asyncToolCalls: false,
      timers: this.sandbox.capabilities.timers,
      network: this.sandbox.capabilities.network,
    };
  }

  async execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    const startedAt = Date.now();
    let toolCallCount = 0;
    const logs = new LogStream(options.onLog);
    if (this.disposed) {
      return {
        logs: logs.text,
        isFinalAnswer: false,
        error: new AgentExecutionError("This executor has been disposed.", {
          stepIndex: options.stepIndex,
        }).info,
        durationMs: Date.now() - startedAt,
        toolCallCount: 0,
      };
    }

    const attempt: Promise<Attempt> = this.attempt(code, options, logs, () => {
      toolCallCount += 1;
    }).then(
      (value) => value,
      (error): Attempt => ({ kind: "failure", error: this.describeHostError(error, options) }),
    );
    const outcome = await this.race(attempt, options);

    if (outcome.kind === "stopped") {
      await this.stopSandbox();
      return {
        logs: logs.text,
        isFinalAnswer: false,
        error: this.stopInfo(options, outcome.reason),
        durationMs: Date.now() - startedAt,
        toolCallCount,
      };
    }
    if (outcome.kind === "answer") {
      return {
        logs: logs.text,
        isFinalAnswer: true,
        value: outcome.value,
        durationMs: Date.now() - startedAt,
        toolCallCount,
      };
    }
    if (outcome.kind === "failure") {
      return {
        logs: logs.text,
        isFinalAnswer: false,
        error: outcome.error,
        durationMs: Date.now() - startedAt,
        toolCallCount,
      };
    }
    return {
      logs: logs.text,
      isFinalAnswer: false,
      durationMs: Date.now() - startedAt,
      toolCallCount,
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.started = false;
    await this.sandbox.dispose();
  }

  private async attempt(
    code: string,
    options: ExecuteOptions,
    logs: LogStream,
    countToolCall: () => void,
  ): Promise<Attempt> {
    await this.ensureStarted(options);
    const outcome = await this.sandbox.run({
      code,
      onOutput: (output: SandboxOutput) => {
        logs.write(output.text);
      },
      callTool: (call: SandboxToolCall) => {
        countToolCall();
        return this.runTool(call, options);
      },
      timeoutMs: options.timeoutMs,
      signal: options.signal,
      allowPickle: this.allowPickle,
    });
    let answer: { readonly value: unknown } | undefined;
    let failure: AgentErrorInfo | undefined;
    for (const frame of outcome.frames) {
      if (frame.type === "final_answer") {
        answer = { value: frame.value };
      } else if (frame.type === "error") {
        failure ??= {
          name: frame.name,
          message: frame.message,
          code: "AGENT_EXECUTION",
          stepIndex: options.stepIndex,
        };
      }
    }
    if (answer !== undefined) return { kind: "answer", value: answer.value };
    if (failure !== undefined) return { kind: "failure", error: failure };
    return { kind: "done" };
  }

  /** Install the prelude once, with this step's tool specs, before the first guest step runs. */
  private async ensureStarted(options: ExecuteOptions): Promise<void> {
    if (this.started) return;
    const shimSource = buildShimSource({
      tools: options.tools.toSpecs(),
      allowToolCalls: this.sandbox.supportsToolRoundTrip,
    });
    await this.sandbox.start({ shimSource });
    this.started = true;
  }

  private async runTool(call: SandboxToolCall, options: ExecuteOptions): Promise<unknown> {
    const tool = options.tools.get(call.name);
    if (tool === undefined) {
      const error: AgentErrorInfo = {
        name: "ToolNotFoundError",
        message: 'The guest called the tool "' + call.name + '", which is not registered with this executor.',
        code: "AGENT_EXECUTION",
        stepIndex: options.stepIndex,
      };
      options.onToolCall?.({ type: "failed", callId: call.callId, name: call.name, error });
      throw new Error(error.message);
    }
    options.onToolCall?.({ type: "requested", callId: call.callId, name: call.name, args: call.args });
    const startedAt = Date.now();
    try {
      const output = await tool.execute(call.args as never, {
        signal: options.signal,
        fetch: this.fetchImpl,
        callId: call.callId,
        stepIndex: options.stepIndex,
        logger: options.logger,
      });
      options.onToolCall?.({
        type: "result",
        callId: call.callId,
        name: call.name,
        output,
        durationMs: Date.now() - startedAt,
      });
      return output;
    } catch (error) {
      const info: AgentErrorInfo =
        error instanceof AgentError
          ? error.info
          : {
              name: error instanceof Error ? error.name : "ToolError",
              message: error instanceof Error ? error.message : String(error),
              code: "AGENT_EXECUTION",
              stepIndex: options.stepIndex,
            };
      options.onToolCall?.({ type: "failed", callId: call.callId, name: call.name, error: info });
      throw error;
    }
  }

  /** Race the run against its clock and its abort signal, exactly as the Pyodide executor does. */
  private async race(attempt: Promise<Attempt>, options: ExecuteOptions): Promise<Outcome> {
    const deadline = options.timeoutMs > 0 ? Date.now() + options.timeoutMs : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const stopped = new Promise<Outcome>((resolve) => {
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

    const outcome = await Promise.race([attempt, stopped]);
    if (timer !== undefined) clearTimeout(timer);
    if (onAbort !== undefined) options.signal.removeEventListener("abort", onAbort);
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

  /** Dispose a run that lost the race, and let a factory make the next step a fresh sandbox. */
  private async stopSandbox(): Promise<void> {
    this.started = false;
    const sandbox = this.sandbox;
    if (this.factory !== undefined) this.sandbox = this.factory();
    try {
      await sandbox.dispose();
    } catch {
      // The losing backend was already torn down; the next step gets a fresh one.
    }
  }

  private stopInfo(options: ExecuteOptions, reason: StopReason): AgentErrorInfo {
    if (reason === "timeout") {
      return new AgentTimeoutError(
        "Code execution timed out after " + String(options.timeoutMs) + " ms",
        { stepIndex: options.stepIndex },
      ).info;
    }
    return new AgentCancelledError("Code execution was cancelled", {
      stepIndex: options.stepIndex,
    }).info;
  }

  private describeHostError(error: unknown, options: ExecuteOptions): AgentErrorInfo {
    if (error instanceof AgentError) return error.info;
    return {
      name: error instanceof Error ? error.name : "SandboxError",
      message: describeErrorMessage(error),
      code: "AGENT_EXECUTION",
      stepIndex: options.stepIndex,
    };
  }
}

/**
 * Describe a thrown value together with a bounded chain of its `cause` links: a live backend
 * failure should name the reason it failed, and a vendor SDK can nest several causes, so the walk
 * stops after three links and as soon as a link adds nothing new.
 */
function describeErrorMessage(error: unknown): string {
  let message = error instanceof Error ? error.message : String(error);
  let current: unknown = error;
  for (let link = 0; link < 3; link += 1) {
    current = current instanceof Error ? current.cause : undefined;
    if (!(current instanceof Error) || message.includes(current.message)) break;
    message = message + ": " + current.message;
  }
  return message;
}
