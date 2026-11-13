import type { AgentErrorInfo } from "@smolagents-ts/core";

/**
 * The messages between `PyodideWorkerExecutor` and its worker script (decision 0041). Every
 * field survives structured clone: the tools, the signal and the logger stay on the host, and
 * only names, strings and plain values cross.
 */

/** What the worker builds its in-process executor from, sent once before the first step. */
export interface WorkerInitMessage {
  readonly kind: "init";
  readonly indexURL?: string;
  readonly additionalAuthorizedImports: readonly string[];
}

export interface WorkerExecuteMessage {
  readonly kind: "execute";
  readonly runId: number;
  readonly code: string;
  readonly toolNames: readonly string[];
  readonly stepIndex: number;
}

/** The host bridge's envelope for one tool call, returned to the guest unchanged. */
export interface WorkerToolResultMessage {
  readonly kind: "tool-result";
  readonly runId: number;
  readonly callId: number;
  readonly envelope: string;
}

export type HostToWorkerMessage = WorkerInitMessage | WorkerExecuteMessage | WorkerToolResultMessage;

export interface WorkerLogMessage {
  readonly kind: "log";
  readonly runId: number;
  readonly line: string;
}

export interface WorkerToolCallMessage {
  readonly kind: "tool-call";
  readonly runId: number;
  readonly callId: number;
  readonly name: string;
  readonly argsJson: string;
}

export interface WorkerWarnMessage {
  readonly kind: "warn";
  readonly message: string;
}

/** A step the guest finished, with or without an answer or an error. */
export interface WorkerDoneMessage {
  readonly kind: "done";
  readonly runId: number;
  readonly isFinalAnswer: boolean;
  readonly value?: unknown;
  readonly error?: AgentErrorInfo;
}

/** The runtime failed to load (runId 0, answering init) or a step could not run at all. */
export interface WorkerFailedMessage {
  readonly kind: "failed";
  readonly runId: number;
  readonly name: string;
  readonly message: string;
}

/** The runtime loaded and the guard is installed; the host starts a step's clock after this. */
export interface WorkerReadyMessage {
  readonly kind: "ready";
}

export type WorkerToHostMessage =
  | WorkerReadyMessage
  | WorkerLogMessage
  | WorkerToolCallMessage
  | WorkerWarnMessage
  | WorkerDoneMessage
  | WorkerFailedMessage;
