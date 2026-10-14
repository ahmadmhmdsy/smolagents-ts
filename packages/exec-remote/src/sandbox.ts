import type { ExecutorIsolation, ExecutorNetwork } from "@smolagents-ts/core";

/** One stream the guest wrote on. */
export type SandboxOutputStream = "stdout" | "stderr";

/** One line of guest output, surfaced live and collected into the run result. */
export interface SandboxOutput {
  readonly stream: SandboxOutputStream;
  readonly text: string;
}

/** One guest tool call, decoded from the host-owned frame channel. */
export interface SandboxToolCall {
  readonly callId: string;
  readonly name: string;
  readonly args: unknown;
}

/**
 * The host-owned sentinel frames. One format serves all three backends: a backend that reads
 * stdout (process), a Jupyter iopub channel (Docker) and a one-shot log string (E2B) all parse
 * the same lines.
 */
export type SandboxFrame =
  | { readonly type: "final_answer"; readonly value: unknown }
  | { readonly type: "tool_call"; readonly callId: string; readonly name: string; readonly args: unknown }
  | { readonly type: "error"; readonly name: string; readonly message: string; readonly traceback?: string }
  | { readonly type: "step_end" };

/** What this backend honestly offers the core's `ExecutorCapabilities`. */
export interface SandboxCapabilities {
  readonly isolation: ExecutorIsolation;
  readonly network: ExecutorNetwork;
  readonly timers: boolean;
}

/** What a sandbox needs once, at start: the generated Python prelude. */
export interface SandboxStartOptions {
  readonly shimSource: string;
}

/** What one step needs. The host's `callTool` answers a guest frame mid-run. */
export interface SandboxRunOptions {
  readonly code: string;
  readonly onOutput?: (output: SandboxOutput) => void;
  readonly callTool?: (call: SandboxToolCall) => unknown | Promise<unknown>;
  readonly timeoutMs: number;
  readonly signal: AbortSignal;
  readonly allowPickle?: boolean;
}

/** One step's outcome, as the backend saw it. */
export interface SandboxRunResult {
  readonly frames: readonly SandboxFrame[];
  readonly outputs: readonly SandboxOutput[];
  /** The child's exit code, or null while the interpreter is still alive. */
  readonly exitStatus: number | null;
  readonly durationMs: number;
}

/**
 * The one seam every backend satisfies. `supportsToolRoundTrip` is false only where the
 * backend has no mid-run channel the host can answer on.
 */
export interface RemoteSandbox {
  readonly supportsToolRoundTrip: boolean;
  readonly capabilities: SandboxCapabilities;
  start(options: SandboxStartOptions): Promise<void>;
  run(options: SandboxRunOptions): Promise<SandboxRunResult>;
  dispose(): Promise<void>;
}

/** A fresh sandbox per agent run; the executor holds the factory, not the sandbox. */
export type RemoteSandboxFactory = () => RemoteSandbox;
