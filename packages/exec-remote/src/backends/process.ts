import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { SandboxError } from "../errors.js";
import { buildStepLoopSource, parseFrameLine } from "../shim-source.js";
import type {
  RemoteSandbox,
  SandboxCapabilities,
  SandboxFrame,
  SandboxOutput,
  SandboxRunOptions,
  SandboxRunResult,
  SandboxStartOptions,
  SandboxToolCall,
} from "../sandbox.js";
import { encodeValue } from "../serialize.js";

export interface ProcessSandboxOptions {
  /** The interpreter. Defaults to `python` on Windows and `python3` elsewhere. */
  readonly program?: string;
  /** Extra interpreter arguments, before the script. `-u` is added unless it is already present. */
  readonly args?: readonly string[];
  /** How long dispose() waits after closing stdin before it kills the child. */
  readonly gracePeriodMs?: number;
  /**
   * Extra host variables the child inherits, on top of `DEFAULT_ENV_PASSTHROUGH`. A name the
   * host does not define is skipped.
   */
  readonly envPassthrough?: readonly string[];
  /**
   * Explicit overrides, applied after the inherited allow-list. A name set to `undefined` is
   * removed from the child's environment instead of inherited.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

const DEFAULT_GRACE_PERIOD_MS = 2_000;

/**
 * What a Python child needs to run at all, plus the locale and temp-directory names that make
 * its behaviour match the host's. Everything else in the host's environment is withheld: a
 * model-written step must not be able to read this host's credentials by default.
 * `PYTHONUNBUFFERED` is not inherited — `childEnvironment` always sets it to "1", because the
 * frame protocol needs the child's stdout line-buffered.
 */
const DEFAULT_ENV_PASSTHROUGH: readonly string[] = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TZ",
  "LANG",
  "LC_ALL",
];

interface PendingRun {
  resolve: (result: SandboxRunResult) => void;
  reject: (error: unknown) => void;
  readonly startedAt: number;
  readonly options: SandboxRunOptions;
  readonly frames: SandboxFrame[];
  readonly outputs: SandboxOutput[];
  settled: boolean;
}

function defaultProgram(): string {
  return process.platform === "win32" ? "python" : "python3";
}

/** A Windows child writes CRLF; the line the host sees must not carry the carriage return. */
function stripCarriageReturn(line: string): string {
  return line.endsWith("\r") ? line.slice(0, -1) : line;
}

/**
 * Build the child's environment: the fixed allow-list plus any names the caller passes
 * through, with `PYTHONUNBUFFERED` forced so the frame protocol stays line-buffered, and the
 * caller's explicit overrides applied last. Inheriting all of `process.env` would hand a
 * model-written step every secret this host holds.
 */
function childEnvironment(options: ProcessSandboxOptions): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const name of [...DEFAULT_ENV_PASSTHROUGH, ...(options.envPassthrough ?? [])]) {
    const value = process.env[name];
    if (value !== undefined) env[name] = value;
  }
  env["PYTHONUNBUFFERED"] = "1";
  for (const [name, value] of Object.entries(options.env ?? {})) {
    if (value === undefined) delete env[name];
    else env[name] = value;
  }
  return env;
}

/**
 * A real local interpreter in a child process. This is not a sandbox: the guest runs with the
 * host user's privileges, in this host's filesystem, with this host's network — so `network`
 * is "direct", not "none". `timers` is false because the guest can monopolise its own CPU and
 * this package enforces no in-guest timer; the host still owns the child, so dispose() closes
 * stdin and then kills, which is what makes a deadline enforceable at the run level.
 *
 * The child's environment is an allow-list rather than the host's environment, so a step cannot
 * read this host's credentials unless `envPassthrough` or `env` names them.
 */
export class ProcessSandbox implements RemoteSandbox {
  readonly capabilities: SandboxCapabilities = {
    isolation: "process",
    network: "direct",
    timers: false,
    toolRoundTrip: true,
  };

  private readonly options: ProcessSandboxOptions;
  private child: ChildProcessWithoutNullStreams | undefined;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private pending: PendingRun | undefined;
  private queue: Promise<void> = Promise.resolve();
  private disposed = false;
  private exited: number | null = null;
  private startError: unknown;

  constructor(options: ProcessSandboxOptions = {}) {
    this.options = options;
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  get isRunning(): boolean {
    return this.child !== undefined && this.exited === null;
  }

  async start(options: SandboxStartOptions): Promise<void> {
    if (this.disposed) throw new SandboxError("This process sandbox has been disposed; one sandbox serves one run.");
    if (this.child !== undefined) throw new SandboxError("This process sandbox has already started.");
    // The prelude is the program, not a script on stdin: CPython reads a piped program to EOF
    // before it executes a line, so a stdin program would never run. The appended step loop is
    // what then reads each step from stdin and keeps the interpreter alive between steps.
    const prelude = options.shimSource + buildStepLoopSource();
    const args = ["-u", "-c", prelude, ...(this.options.args ?? [])];
    const env = childEnvironment(this.options);
    const child = spawn(this.options.program ?? defaultProgram(), args, { stdio: "pipe", env, windowsHide: true });
    this.child = child;
    const spawned = new Promise<void>((resolve, reject) => {
      child.once("spawn", () => resolve());
      child.once("error", (error) =>
        reject(new SandboxError("The interpreter could not be started.", { cause: error })),
      );
    });
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    // A stdin failure is a lost step: settle the pending run instead of dropping it and
    // leaving the caller to wait for its deadline.
    child.stdin.on("error", (error) => this.failPendingWrite(error));
    child.stdout.on("data", (chunk: string) => this.onChunk("stdout", chunk));
    child.stderr.on("data", (chunk: string) => this.onChunk("stderr", chunk));
    child.on("error", (error) => {
      this.startError = error;
      const pending = this.pending;
      if (pending !== undefined) {
        this.finish(pending, new SandboxError("The interpreter could not be started.", { cause: error }));
      }
    });
    child.on("close", (code) => {
      this.exited = code ?? 0;
      // Flush what is left of a partial line before settling.
      if (this.stdoutBuffer !== "") {
        const rest = this.stdoutBuffer;
        this.stdoutBuffer = "";
        this.queue = this.queue.then(() => this.handleLine("stdout", stripCarriageReturn(rest)));
      }
      if (this.stderrBuffer !== "") {
        const rest = this.stderrBuffer;
        this.stderrBuffer = "";
        this.queue = this.queue.then(() => this.handleLine("stderr", stripCarriageReturn(rest)));
      }
      this.queue = this.queue.then(() => this.settleAfterExit());
    });
    await spawned;
  }

  async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    if (this.disposed) throw new SandboxError("This process sandbox has been disposed.");
    if (this.startError !== undefined) {
      throw new SandboxError("The interpreter could not be started.", { cause: this.startError });
    }
    if (this.child === undefined) throw new SandboxError("This process sandbox has not been started.");
    if (this.exited !== null) {
      throw new SandboxError("The interpreter exited before this step with code " + String(this.exited) + ".");
    }
    if (this.pending !== undefined) throw new SandboxError("A step is already running on this process sandbox.");
    const pending: PendingRun = {
      resolve: () => undefined,
      reject: () => undefined,
      startedAt: Date.now(),
      options,
      frames: [],
      outputs: [],
      settled: false,
    };
    const result = new Promise<SandboxRunResult>((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.pending = pending;
    this.queue = this.queue.then(() => {
      this.write(JSON.stringify({ type: "step", code: options.code }) + "\n");
    });
    return result;
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    const child = this.child;
    this.child = undefined;
    if (child !== undefined && this.exited === null) {
      child.stdin.end();
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = (): void => {
          if (done) return;
          done = true;
          clearTimeout(timer);
          resolve();
        };
        const timer = setTimeout(() => {
          child.kill("SIGKILL");
          finish();
        }, this.options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS);
        child.once("close", finish);
      });
    }
    const pending = this.pending;
    if (pending !== undefined) this.finish(pending, undefined, this.exited);
  }

  private write(text: string): void {
    const child = this.child;
    if (child === undefined || this.exited !== null || child.stdin.destroyed) {
      this.failPendingWrite(new SandboxError("The interpreter's stdin is not writable."));
      return;
    }
    try {
      child.stdin.write(text, (error?: Error | null) => {
        if (error !== null && error !== undefined) this.failPendingWrite(error);
      });
    } catch (error) {
      this.failPendingWrite(error);
    }
  }

  /** A write that never reached the interpreter would leave the step waiting for its deadline. */
  private failPendingWrite(error: unknown): void {
    const pending = this.pending;
    if (pending === undefined) return;
    this.finish(
      pending,
      error instanceof SandboxError
        ? error
        : new SandboxError("Writing to the interpreter failed.", { cause: error }),
    );
  }

  private onChunk(stream: "stdout" | "stderr", chunk: string): void {
    if (stream === "stdout") {
      const combined = this.stdoutBuffer + chunk;
      const lines = combined.split("\n");
      this.stdoutBuffer = lines.pop() ?? "";
      for (const line of lines) this.queue = this.queue.then(() => this.handleLine("stdout", stripCarriageReturn(line)));
      return;
    }
    const combined = this.stderrBuffer + chunk;
    const lines = combined.split("\n");
    this.stderrBuffer = lines.pop() ?? "";
    for (const line of lines) this.queue = this.queue.then(() => this.handleLine("stderr", stripCarriageReturn(line)));
  }

  private async handleLine(stream: "stdout" | "stderr", line: string): Promise<void> {
    const pending = this.pending;
    if (stream === "stderr") {
      if (pending !== undefined) this.pushOutput(pending, line, "stderr");
      return;
    }
    let frame: SandboxFrame | undefined;
    try {
      frame = parseFrameLine(line, { allowPickle: pending?.options.allowPickle === true });
    } catch (error) {
      if (pending !== undefined) this.finish(pending, error);
      return;
    }
    if (frame === undefined) {
      if (pending !== undefined) this.pushOutput(pending, line, "stdout");
      return;
    }
    if (pending === undefined) return;
    pending.frames.push(frame);
    if (frame.type === "step_end") {
      this.finish(pending, undefined);
      return;
    }
    if (frame.type === "tool_call") await this.answerToolCall(pending, frame);
  }

  private async answerToolCall(
    pending: PendingRun,
    frame: { callId: string; name: string; args: unknown },
  ): Promise<void> {
    const call: SandboxToolCall = { callId: frame.callId, name: frame.name, args: frame.args };
    const callTool = pending.options.callTool;
    let reply: { ok: boolean; value?: unknown; error?: string };
    if (callTool === undefined) {
      reply = { ok: false, error: "This backend has no tool-call channel." };
    } else {
      try {
        reply = { ok: true, value: encodeValue(await callTool(call)) };
      } catch (error) {
        reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    this.write(JSON.stringify(reply) + "\n");
  }

  private pushOutput(pending: PendingRun, text: string, stream: "stdout" | "stderr"): void {
    const output: SandboxOutput = { stream, text };
    pending.outputs.push(output);
    pending.options.onOutput?.(output);
  }

  private settleAfterExit(): void {
    const pending = this.pending;
    if (pending !== undefined) this.finish(pending, undefined, this.exited);
  }

  private finish(pending: PendingRun, error?: unknown, exitStatus: number | null = null): void {
    if (pending.settled) return;
    pending.settled = true;
    if (this.pending === pending) this.pending = undefined;
    if (error !== undefined) {
      pending.reject(error);
      return;
    }
    pending.resolve({
      frames: pending.frames,
      outputs: pending.outputs,
      exitStatus,
      durationMs: Date.now() - pending.startedAt,
    });
  }
}
