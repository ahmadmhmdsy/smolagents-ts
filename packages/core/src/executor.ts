import type { AgentErrorInfo } from "./errors.js";
import type { Logger } from "./logger.js";
import type { ToolRegistry } from "./tool/registry.js";

export type ExecutorLanguage = "javascript" | "python";
export type ExecutorIsolation = "wasm" | "process" | "vm" | "remote" | "none";
export type ExecutorNetwork = "none" | "host-mediated" | "direct";

export interface ExecutorCapabilities {
  readonly language: ExecutorLanguage;
  readonly isolation: ExecutorIsolation;
  /**
   * Whether guest code may await a tool that returns a Promise. This is the single
   * most consequential capability: design spec 9.3 describes how QuickJS implements it
   * and what happens if a given build cannot.
   */
  readonly asyncToolCalls: boolean;
  readonly timers: boolean;
  readonly network: ExecutorNetwork;
  readonly memoryLimitBytes?: number;
  readonly cpuTimeLimitMs?: number;
}

/** The sink the guest calls to finish the run. */
export interface FinalAnswerSink {
  readonly name: string;
  submit(value: unknown): void;
}

export type ToolCallEvent =
  | { type: "requested"; callId: string; name: string; args: unknown }
  | { type: "result"; callId: string; name: string; output: unknown; durationMs: number }
  | { type: "failed"; callId: string; name: string; error: AgentErrorInfo };

export interface ExecuteOptions {
  readonly tools: ToolRegistry;
  readonly finalAnswer: FinalAnswerSink;
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly stepIndex: number;
  readonly logger: Logger;
  readonly onToolCall?: (event: ToolCallEvent) => void;
  readonly onLog?: (line: string) => void;
}

export interface CodeResult {
  readonly logs: string;
  readonly isFinalAnswer: boolean;
  readonly value?: unknown;
  readonly error?: AgentErrorInfo;
  readonly durationMs: number;
  readonly toolCallCount: number;
}

/**
 * The code execution seam (design spec section 9). S4 provides the QuickJS
 * implementation; every other executor is expected to satisfy exactly this contract.
 *
 * Lifetime (design spec decision D-21): one executor instance serves one agent run, so a
 * variable defined in one execute() call is visible in the next. That is exactly what the
 * system prompt's rule 10 promises the model, and it is why rule 10 tells the model to
 * console.log() anything the transcript must carry. dispose() releases the guest at the end
 * of the run. An adapter that cannot honour this must say so in ExecutorCapabilities rather
 * than silently dropping state between steps.
 */
export interface CodeExecutor {
  readonly language: ExecutorLanguage;
  readonly capabilities: ExecutorCapabilities;
  execute(code: string, options: ExecuteOptions): Promise<CodeResult>;
  dispose?(): Promise<void>;
}
