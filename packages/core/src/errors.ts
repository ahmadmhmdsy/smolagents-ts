export type AgentErrorCode =
  | "AGENT_ERROR"
  | "AGENT_PARSING"
  | "AGENT_EXECUTION"
  | "AGENT_GENERATION"
  | "AGENT_MAX_STEPS"
  | "AGENT_TOOL_CALL"
  | "AGENT_TIMEOUT"
  | "AGENT_CANCELLED"
  | "AGENT_GUARDRAIL"
  | "AGENT_SNAPSHOT_VERSION"
  | "AGENT_RUN_RECORD_VERSION"
  | "AGENT_TOOL_TIMEOUT"
  | "AGENT_RUN_NOT_FOUND"
  | "AGENT_RUN_NOT_WAITING"
  | "AGENT_RUN_REQUEST_MISMATCH"
  | "AGENT_RUN_REQUEST_EXPIRED"
  | "AGENT_RUN_ALREADY_SETTLED"
  | "AGENT_RUN_APPROVAL_MISMATCH"
  | "AGENT_RUN_CLAIMED"
  | "AGENT_RUN_STALE_WRITER"
  | "AGENT_EFFECT_UNKNOWN";

/** The serialisable form of an error. Errors travel in events, so they must be plain data. */
export interface AgentErrorInfo {
  name: string;
  message: string;
  code: string;
  stepIndex?: number;
  cause?: string;
}

export interface AgentErrorOptions {
  code?: AgentErrorCode;
  stepIndex?: number;
  cause?: unknown;
}

export class AgentError extends Error {
  readonly code: AgentErrorCode;
  readonly stepIndex: number | undefined;

  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message);
    this.name = "AgentError";
    this.code = options.code ?? "AGENT_ERROR";
    this.stepIndex = options.stepIndex;
    if (options.cause !== undefined) {
      this.cause = options.cause;
    }
  }

  get info(): AgentErrorInfo {
    const info: AgentErrorInfo = { name: this.name, message: this.message, code: this.code };
    if (this.stepIndex !== undefined) info.stepIndex = this.stepIndex;
    if (this.cause !== undefined) {
      info.cause = this.cause instanceof Error ? this.cause.message : String(this.cause);
    }
    return info;
  }

  static from(error: unknown, code: AgentErrorCode = "AGENT_ERROR", stepIndex?: number): AgentError {
    if (error instanceof AgentError) return error;
    const message = error instanceof Error ? error.message : String(error);
    return new AgentError(message, stepIndex === undefined ? { code, cause: error } : { code, stepIndex, cause: error });
  }

  /**
   * Rebuild a throwable from the plain-data form that travels in events. The code picks the
   * subclass, so an `instanceof` check on the rebuilt error agrees with the one that was raised.
   */
  static fromInfo(info: AgentErrorInfo): AgentError {
    const options: AgentErrorOptions = { code: info.code as AgentErrorCode };
    if (info.stepIndex !== undefined) options.stepIndex = info.stepIndex;
    if (info.cause !== undefined) options.cause = info.cause;
    const Subclass = SUBCLASS_FOR_CODE[info.code];
    const error = Subclass === undefined ? new AgentError(info.message, options) : new Subclass(info.message, options);
    error.name = info.name;
    return error;
  }
}

export class AgentParsingError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_PARSING" });
    this.name = "AgentParsingError";
  }
}

export class AgentExecutionError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_EXECUTION" });
    this.name = "AgentExecutionError";
  }
}

export class AgentGenerationError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_GENERATION" });
    this.name = "AgentGenerationError";
  }
}

export class AgentMaxStepsError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_MAX_STEPS" });
    this.name = "AgentMaxStepsError";
  }
}

export class AgentToolCallError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_TOOL_CALL" });
    this.name = "AgentToolCallError";
  }
}

export class AgentTimeoutError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_TIMEOUT" });
    this.name = "AgentTimeoutError";
  }
}

export class AgentCancelledError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_CANCELLED" });
    this.name = "AgentCancelledError";
  }
}

/** Raised when a guardrail tripwire or the output schema stops a run. */
export class AgentGuardrailError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_GUARDRAIL" });
    this.name = "AgentGuardrailError";
  }
}

/** Raised when a store holds a run snapshot written in a format this runtime cannot read. */
export class RunSnapshotVersionError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_SNAPSHOT_VERSION" });
    this.name = "RunSnapshotVersionError";
  }

  /** The refusal for a snapshot whose format version is newer than this runtime's. */
  static forVersion(found: unknown, expected: number): RunSnapshotVersionError {
    const shown = typeof found === "number" ? String(found) : "unknown";
    return new RunSnapshotVersionError(
      "The run snapshot declares format version " +
        shown +
        ", and this runtime reads version " +
        String(expected) +
        " only.",
    );
  }
}

/** Raised when a store holds a run record written in a format this runtime cannot read. */
export class RunRecordVersionError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_RECORD_VERSION" });
    this.name = "RunRecordVersionError";
  }

  /** The refusal for a record whose schema version is newer than this runtime's. */
  static forVersion(found: unknown, expected: number): RunRecordVersionError {
    const shown = typeof found === "number" ? String(found) : "unknown";
    return new RunRecordVersionError(
      "The run record declares schema version " +
        shown +
        ", and this runtime reads version " +
        String(expected) +
        " only. A newer runtime wrote it; open it there rather than half-reading it here.",
    );
  }
}

/** Raised when a resume names a run the store does not hold. No run is created implicitly. */
export class RunNotFoundError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_NOT_FOUND" });
    this.name = "RunNotFoundError";
  }
}

/** Raised when a run names a record that is not parked on a request, so there is nothing to resume. */
export class RunNotWaitingError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_NOT_WAITING" });
    this.name = "RunNotWaitingError";
  }
}

/** Raised when a resume names a request id that is not the record's pending request. */
export class RunRequestMismatchError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_REQUEST_MISMATCH" });
    this.name = "RunRequestMismatchError";
  }
}

/** Raised when a record's pending request is past its expiry; the pause can no longer be settled. */
export class RunRequestExpiredError extends AgentError {
  readonly expiresAt: string;

  constructor(message: string, options: AgentErrorOptions = {}, expiresAt = "") {
    super(message, { ...options, code: "AGENT_RUN_REQUEST_EXPIRED" });
    this.name = "RunRequestExpiredError";
    this.expiresAt = expiresAt;
  }
}

/** Raised when a request is settled a second time. It carries what the first settlement was. */
export class RunAlreadySettledError extends AgentError {
  readonly settledOutcome: string;

  constructor(message: string, options: AgentErrorOptions = {}, settledOutcome = "") {
    super(message, { ...options, code: "AGENT_RUN_ALREADY_SETTLED" });
    this.name = "RunAlreadySettledError";
    this.settledOutcome = settledOutcome;
  }
}

/**
 * Raised when a resumed step asks for a call that does not match the settlement it was resumed
 * for. A resumed step generates fresh call ids, so the binding is the argument digest and the
 * step index, not the call id; a call with other arguments is refused, never quietly approved.
 */
export class RunApprovalMismatchError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_APPROVAL_MISMATCH" });
    this.name = "RunApprovalMismatchError";
  }
}

/**
 * Raised when an effect stopped in doubt: the record says it was announced but holds no result.
 * The run refuses to guess; only a tool declared idempotent may be retried, once.
 */
export class EffectOutcomeUnknownError extends AgentError {
  readonly toolName: string;
  readonly callId: string;

  constructor(
    message: string,
    options: AgentErrorOptions = {},
    toolName = "",
    callId = "",
  ) {
    super(message, { ...options, code: "AGENT_EFFECT_UNKNOWN" });
    this.name = "EffectOutcomeUnknownError";
    this.toolName = toolName;
    this.callId = callId;
  }
}

/** Raised when a live claim loses the generation race; another writer owns the run. */
export class RunClaimedError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_CLAIMED" });
    this.name = "RunClaimedError";
  }
}

/** Raised when a commit names a generation another claim has already moved past. */
export class StaleWriterError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_RUN_STALE_WRITER" });
    this.name = "StaleWriterError";
  }
}

/** Raised when a tool does not settle inside its deadline. */
export class ToolTimeoutError extends AgentError {
  constructor(message: string, options: AgentErrorOptions = {}) {
    super(message, { ...options, code: "AGENT_TOOL_TIMEOUT" });
    this.name = "ToolTimeoutError";
  }

  /** The refusal for a tool that outlived its deadline. */
  static forTool(tool: string, limitMs: number): ToolTimeoutError {
    return new ToolTimeoutError(
      'Tool "' + tool + '" did not finish within its ' + String(limitMs) + " ms deadline.",
    );
  }
}

type AgentErrorSubclass = new (message: string, options?: AgentErrorOptions) => AgentError;

/** The subclass each code is raised as, read by `AgentError.fromInfo`. */
const SUBCLASS_FOR_CODE: Readonly<Partial<Record<string, AgentErrorSubclass>>> = {
  AGENT_PARSING: AgentParsingError,
  AGENT_EXECUTION: AgentExecutionError,
  AGENT_GENERATION: AgentGenerationError,
  AGENT_MAX_STEPS: AgentMaxStepsError,
  AGENT_TOOL_CALL: AgentToolCallError,
  AGENT_TIMEOUT: AgentTimeoutError,
  AGENT_CANCELLED: AgentCancelledError,
  AGENT_GUARDRAIL: AgentGuardrailError,
  AGENT_SNAPSHOT_VERSION: RunSnapshotVersionError,
  AGENT_RUN_RECORD_VERSION: RunRecordVersionError,
  AGENT_TOOL_TIMEOUT: ToolTimeoutError,
  AGENT_RUN_NOT_FOUND: RunNotFoundError,
  AGENT_RUN_NOT_WAITING: RunNotWaitingError,
  AGENT_RUN_REQUEST_MISMATCH: RunRequestMismatchError,
  AGENT_RUN_REQUEST_EXPIRED: RunRequestExpiredError,
  AGENT_RUN_ALREADY_SETTLED: RunAlreadySettledError,
  AGENT_RUN_APPROVAL_MISMATCH: RunApprovalMismatchError,
  AGENT_RUN_CLAIMED: RunClaimedError,
  AGENT_RUN_STALE_WRITER: StaleWriterError,
  AGENT_EFFECT_UNKNOWN: EffectOutcomeUnknownError,
};
