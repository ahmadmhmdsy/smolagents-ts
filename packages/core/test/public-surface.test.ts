import { describe, expect, it } from "vitest";
import * as core from "../src/index.js";

/**
 * Every runtime value the package promises. Adding a name here is a deliberate act;
 * removing one is a breaking change and should be visible in a diff.
 */
const RUNTIME_EXPORTS = [
  // package metadata
  "VERSION",
  // errors
  "AgentError",
  "AgentParsingError",
  "AgentExecutionError",
  "AgentGenerationError",
  "AgentMaxStepsError",
  "AgentToolCallError",
  "AgentTimeoutError",
  "AgentCancelledError",
  // logging
  "noopLogger",
  "consoleLogger",
  // events
  "isAdvisory",
  "isTerminal",
  "assertNever",
  "describeEvent",
  // model and execution seams
  "modelCapabilities",
  "collectCompletion",
  // The adapter contract's version and the shim that accepts a model written before it.
  "MODEL_ADAPTER_VERSION",
  "upgradeModelAdapter",
  // Published beside collectCompletion: an adapter that reassembles a streamed answer in
  // its own generate() needs the same accumulator the built-in helper uses.
  "ToolCallAccumulator",
  // tools
  "tool",
  "ToolDefinitionError",
  "ToolRegistry",
  "ToolPolicyDeniedError",
  "ToolHostedError",
  // prompts
  "populateTemplate",
  "templateVariables",
  "TemplateError",
  "buildCodeAgentSystemPrompt",
  "buildToolCallingAgentSystemPrompt",
  "CODE_FENCE",
  // memory and accounting
  "AgentMemory",
  // The abstract base of the step hierarchy. Public on purpose: the package already publishes
  // every subclass and the `AnyAgentStep` union, so the base belongs on the promised surface.
  "AgentStep",
  "TaskStep",
  "SystemPromptStep",
  "PlanningStep",
  "ActionStep",
  "MessageStep",
  "FinalAnswerStep",
  "Monitor",
  // observability: fold an event stream into an OTel-shaped trace, and score a run against a fixture
  "buildTrace",
  "TraceBuilder",
  // the opt-in export seam: a finished tree as an OTLP payload, and an HTTP exporter that sends it
  "toOtlpExport",
  "createOtlpHttpExporter",
  // cost accounting: a dated price table, the lookup, the integer cost, and its budget counter
  "PRICE_TABLE_DATE",
  "DEFAULT_PRICE_TABLE",
  "findModelPrice",
  "deriveCost",
  "formatMicroUsd",
  "spendCostBudget",
  "scoreRun",
  // checkpointing: a run's steps as plain objects, and the store seam that holds them
  "stepToJSON",
  "stepFromJSON",
  "MemoryRunStore",
  "FileRunStore",
  "waitForRun",
  "translateSnapshot",
  "RUN_SNAPSHOT_VERSION",
  "RunSnapshotVersionError",
  // a run record: the identity, the fence and the terminal status the store keeps
  "translateRecord",
  "RUN_RECORD_VERSION",
  "RunRecordVersionError",
  "ToolApprovalPendingError",
  "RunNotFoundError",
  "RunNotWaitingError",
  "RunRequestMismatchError",
  "RunRequestExpiredError",
  "RunAlreadySettledError",
  "RunApprovalMismatchError",
  "RunClaimedError",
  "StaleWriterError",
  "EffectOutcomeUnknownError",
  "RunMessageRefusedError",
  // messages: an ordinary record entry a send appends, and the delivery the run performs
  "sendRunMessage",
  // budget: limits, a caller-held handle that continues one budget, and its typed stop reason
  "RUN_LIMITS_CEILING",
  "resolveBudget",
  "createBudgetHandle",
  "spendBudget",
  "budgetSeedFromSteps",
  // runtime
  "MultiStepAgent",
  "CodeAgent",
  "ToolCallingAgent",
  "managedAgent",
  "MANAGED_AGENT_INPUT_SCHEMA",
  // delegation report: a child's answer as a validated value or a typed failure
  "runManagedAgent",
  // memory: the condensation step a read-time projection hides
  "CondensationStep",
  // the event log: a reconnecting reader resumes after the last seq it saw
  "readEvents",
  // claim board: rows with a revision token, blockers, tombstones and advisory scopes
  "createTask",
  "claimTask",
  "updateTask",
  "completeTask",
  "deleteTask",
  "listBoard",
  "TaskStaleRevisionError",
  "TaskBlockedError",
  "TaskDeletedError",
  // background children: a row on the parent's record, and the typed cap refusal
  "startBackgroundChild",
  "listChildren",
  "resumeBackgroundChild",
  "ChildLimitError",
  // transfer: a handover the model declares, and the signal the loop recognises
  "transferTool",
  "transferToolName",
  "isTransferSignal",
  "TRANSFER_INPUT_SCHEMA",
  // approval seam: gate a tool call before it runs
  "withApproval",
  "ToolApprovalError",
  // guardrail seam: tripwires and an output schema
  "AgentGuardrailError",
  "ToolTimeoutError",
  "AgentSession",
  "FINAL_ANSWER_TOOL_NAME",
  "makeRunResult",
  "composeMiddleware",
  // utilities
  "extractCodeBlock",
  "extractThought",
  "hasFinalAnswerCall",
  "createAsyncQueue",
  // testing doubles, published on purpose
  "MockModel",
  "ScriptedExecutor",
  "finalAnswerResult",
  // value helpers
  "addTokenUsage",
  "EMPTY_TOKEN_USAGE",
] as const;

describe("public surface", () => {
  for (const name of RUNTIME_EXPORTS) {
    it("exports " + name, () => {
      expect(core).toHaveProperty(name);
      expect((core as Record<string, unknown>)[name]).toBeDefined();
    });
  }

  it("keeps the total export count honest", () => {
    const unexpected = Object.keys(core).filter(
      (name) => !(RUNTIME_EXPORTS as readonly string[]).includes(name),
    );
    expect(unexpected).toEqual([]);
  });

  it("exports exactly one final_answer constant", () => {
    expect(core.FINAL_ANSWER_TOOL_NAME).toBe("final_answer");
  });
});

/**
 * Coverage required by the Task 1 review (MINOR-1): errors.test.ts only exercises the parsing
 * and max-steps subclasses, so one it() per error type pins the whole hierarchy's contract:
 * instanceof, name, code, and the info/cause pair (design spec 6.6).
 */
const ERROR_CASES: {
  readonly Ctor: new (message: string, options?: core.AgentErrorOptions) => core.AgentError;
  readonly name: string;
  readonly code: core.AgentErrorCode;
}[] = [
  { Ctor: core.AgentError, name: "AgentError", code: "AGENT_ERROR" },
  { Ctor: core.AgentParsingError, name: "AgentParsingError", code: "AGENT_PARSING" },
  { Ctor: core.AgentExecutionError, name: "AgentExecutionError", code: "AGENT_EXECUTION" },
  { Ctor: core.AgentGenerationError, name: "AgentGenerationError", code: "AGENT_GENERATION" },
  { Ctor: core.AgentMaxStepsError, name: "AgentMaxStepsError", code: "AGENT_MAX_STEPS" },
  { Ctor: core.AgentToolCallError, name: "AgentToolCallError", code: "AGENT_TOOL_CALL" },
  { Ctor: core.AgentTimeoutError, name: "AgentTimeoutError", code: "AGENT_TIMEOUT" },
  { Ctor: core.AgentCancelledError, name: "AgentCancelledError", code: "AGENT_CANCELLED" },
  { Ctor: core.AgentGuardrailError, name: "AgentGuardrailError", code: "AGENT_GUARDRAIL" },
  { Ctor: core.ToolPolicyDeniedError, name: "ToolPolicyDeniedError", code: "AGENT_TOOL_POLICY" },
  { Ctor: core.ToolHostedError, name: "ToolHostedError", code: "AGENT_TOOL_HOSTED" },
];

describe("error hierarchy", () => {
  for (const entry of ERROR_CASES) {
    it(entry.name + " carries the documented name, code, step and cause", () => {
      const cause = new Error("the underlying failure");
      const error = new entry.Ctor("the message", { stepIndex: 2, cause });
      expect(error).toBeInstanceOf(core.AgentError);
      expect(error.name).toBe(entry.name);
      expect(error.code).toBe(entry.code);
      const info = error.info;
      expect(info.name).toBe(entry.name);
      expect(info.code).toBe(entry.code);
      expect(info.stepIndex).toBe(2);
      expect(info.cause).toBe("the underlying failure");
      expect(error.cause).toBe(cause);
    });
  }
});
