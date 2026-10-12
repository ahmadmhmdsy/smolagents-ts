# S1 — Core Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a CodeAgent run end to end against a scripted model, emitting a deterministic, asserted event stream and producing a RunResult — with no network, no model provider, and no sandbox.

**Architecture:** Everything lives in packages/core and depends only on zod. The runtime is a pull-based agent loop: AgentMemory holds typed steps, MultiStepAgent drives the ReAct cycle and emits AgentEvent objects into an AsyncIterable, and AgentSession is a framework-agnostic observable view over that stream. Code execution is behind the CodeExecutor interface; S1 ships a scripted fake so the loop is testable before S4 exists.

**Tech Stack:** TypeScript 5.x strict · Vitest · zod 4 (a runtime dependency of core, first used in Task 11 for schema-first tools, because TypeScript types are erased at runtime) · no other runtime dependency

**Spec:** [../design/2026-10-12-smolagents-ts-v1-design.md](../design/2026-10-12-smolagents-ts-v1-design.md)
**Depends on:** [2026-10-12-s0-foundations-plan.md](./2026-10-12-s0-foundations-plan.md)

**Ordering rule:** tasks are ordered so that every file a task imports already exists. Do not reorder.

---

## Spec coverage

Every S1 requirement in the design spec maps to a task here. Anything absent from this table is a
deliberate later stage, listed underneath.

| design spec section | implemented by |
|---|---|
| 6.1 Public API | Task 19 — `src/index.ts` plus the exact-export test |
| 6.2 The agent loop | Task 15 (the ReAct loop), Task 16 (CodeAgent), Task 17 (ToolCallingAgent) |
| 6.3 The event contract | Task 4 (the union), Task 15 (emission order and the one-`usage.updated`-per-turn invariant), Task 18 (subscription) |
| 6.4 Memory and steps | Task 2 (the step classes), Task 5 (AgentMemory) |
| 6.5 RunResult | Task 3 (the type), Task 15 (construction on the success path) |
| 6.6 Error model | Task 1 (the hierarchy), Task 15 (raising it from the loop) |
| 6.7 AgentSession | Task 18 |
| 6.8 Prompt templates | Task 7 (populateTemplate), Task 8 (code template and builder), Task 17 (tool-calling template and builder) |
| 8 Tool system | Task 11 |
| 9.1 The CodeExecutor contract | Task 12 (the interface and ScriptedExecutor) |
| 5.4 Runtime constraints | Task 19, enforced by the S0 architecture tests rather than by review |
| 11 Testing and validation | Task 10 and Task 12 (test doubles), Task 6 (Monitor), Task 16 (golden transcript), Task 19 (surface and integration) |

Deliberately **not** in S1: 3.x provenance and the NOTICE/attribution artefacts (S6, release), 5.2 distribution
shape (S6), 7 model layer (S3), 9.2–9.4 executors (S4), 10 React layer (S5). Sections 12–16 are cross-cutting
and are satisfied by S0 tooling or by the documents themselves.

---

## File structure

```text
packages/core/
├─ src/
│  ├─ index.ts                          the public surface (Task 19)
│  ├─ version.ts                        (S0)
│  ├─ types.ts                          ChatMessage, TokenUsage, Timing, ToolCall (Task 1)
│  ├─ errors.ts                         AgentError hierarchy + AgentErrorInfo (Task 1, extended in Task 15)
│  ├─ logger.ts                         Logger, noopLogger, consoleLogger (Task 11)
│  ├─ events.ts                         AgentEvent union + helpers (Task 4)
│  ├─ model.ts                          Model interface (Task 9)
│  ├─ executor.ts                       the CodeExecutor contract (Task 12)
│  ├─ middleware.ts                     AgentMiddleware + composeMiddleware (Task 14)
│  ├─ memory/
│  │  ├─ steps.ts                       TaskStep .. FinalAnswerStep (Task 2)
│  │  └─ memory.ts                      AgentMemory (Task 5)
│  ├─ monitoring/
│  │  └─ monitor.ts                     Monitor (Task 6)
│  ├─ prompts/
│  │  ├─ populate-template.ts           populateTemplate (Task 7)
│  │  ├─ templates.ts                   the ported prompt text (Task 8, extended in Task 17)
│  │  └─ system-prompt.ts               the two prompt builders (Task 8, extended in Task 17)
│  ├─ tool/
│  │  ├─ tool.ts                        Tool interface + tool() (Task 11)
│  │  └─ registry.ts                    ToolRegistry (Task 11)
│  ├─ agent/
│  │  ├─ action.ts                      InterpretedAction, ActionOutcome, FINAL_ANSWER_TOOL_NAME (Task 14)
│  │  ├─ run-result.ts                  RunResult (Task 3)
│  │  ├─ multi-step-agent.ts            the ReAct loop (Task 15)
│  │  ├─ code-agent.ts                  CodeAgent (Task 16)
│  │  └─ tool-calling-agent.ts          ToolCallingAgent (Task 17)
│  ├─ session/
│  │  └─ agent-session.ts               AgentSession (Task 18)
│  ├─ utils/
│  │  ├─ parse-code-blocks.ts           extractCodeBlock, extractThought, hasFinalAnswerCall (Task 13)
│  │  └─ async-queue.ts                 the callback-to-async-iterator bridge (Task 16)
│  └─ testing/                          published on purpose: the documented way to test an agent
│     ├─ mock-model.ts                  MockModel, the scripted model (Task 10)
│     └─ scripted-executor.ts           ScriptedExecutor, the scripted executor (Task 12)
└─ test/
   ├─ architecture.test.ts              (S0)
   ├─ architecture-guard.test.ts        (S0)
   ├─ smoke.test.ts                     (S0)
   ├─ golden/
   │  └─ fibonacci.transcript.json      the recorded model script (Task 16)
   └─ *.test.ts                         one or more per task
```

---

## Task 1: Types and errors

**Files:**
- Create: packages/core/src/types.ts
- Create: packages/core/src/errors.ts
- Test: packages/core/test/types.test.ts
- Test: packages/core/test/errors.test.ts

- [ ] **Step 1: Write the failing test for types**

```ts
// packages/core/test/types.test.ts
import { describe, expect, it } from "vitest";
import { addTokenUsage, EMPTY_TOKEN_USAGE } from "../src/types.js";

describe("token usage arithmetic", () => {
  it("starts empty", () => {
    expect(EMPTY_TOKEN_USAGE).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("adds two usages field by field", () => {
    const a = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    const b = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
    expect(addTokenUsage(a, b)).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18 });
  });

  it("is not mutated by adding", () => {
    const a = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    addTokenUsage(a, EMPTY_TOKEN_USAGE);
    expect(a.inputTokens).toBe(10);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/types.test.ts
Expected: FAIL, because `../src/types.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

**Note on this pattern (A-55).** Every "watch it fail" step in this plan is phrased this way deliberately: the check fails because the specifier cannot be resolved, and the error names it. Do not require a particular wording beyond that. The same failure prints `Cannot find module '<specifier>'` on Vitest 5.0.3's Node path and `Failed to resolve import '<specifier>'` on Vite's, so a quotation would be a coin flip. A resolution error naming the specifier means the step behaved as intended. (The earlier revision quoted one of those two messages in all 21 steps; measured against the command the steps themselves give, it printed the other.)

- [ ] **Step 3: Write src/types.ts**

```ts
/** Roles accepted by every model adapter. */
export type ChatRole = "system" | "user" | "assistant" | "tool";

/** A single turn handed to a model. Provider-neutral by construction. */
export interface ChatMessage {
  role: ChatRole;
  content: string;
  /** Set when role is "tool": which call this message answers. */
  toolCallId?: string;
  /** Optional tool name, for providers that require it on tool results. */
  name?: string;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly totalTokens: number;
}

export const EMPTY_TOKEN_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

export function addTokenUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

export interface Timing {
  readonly start: number;
  readonly end: number;
  readonly durationMs: number;
}

/** One tool invocation, as recorded in an ActionStep. */
export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
  result?: unknown;
  error?: string;
  durationMs?: number;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/types.test.ts
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the failing test for errors**

```ts
// packages/core/test/errors.test.ts
import { describe, expect, it } from "vitest";
import {
  AgentError,
  AgentExecutionError,
  AgentMaxStepsError,
  AgentParsingError,
} from "../src/errors.js";

describe("AgentError", () => {
  it("is an Error", () => {
    expect(new AgentError("boom")).toBeInstanceOf(Error);
  });

  it("carries the requested code", () => {
    expect(new AgentError("boom", { code: "AGENT_TIMEOUT" }).code).toBe("AGENT_TIMEOUT");
  });

  it("defaults to AGENT_ERROR", () => {
    expect(new AgentError("boom").code).toBe("AGENT_ERROR");
  });

  it("serialises to info without undefined keys", () => {
    const info = new AgentError("boom").info;
    expect(info).toEqual({ name: "AgentError", message: "boom", code: "AGENT_ERROR" });
    expect(Object.keys(info)).not.toContain("stepIndex");
  });

  it("includes stepIndex and cause when present", () => {
    const info = new AgentError("boom", { stepIndex: 3, cause: new Error("inner") }).info;
    expect(info.stepIndex).toBe(3);
    expect(info.cause).toBe("inner");
  });

  it("keeps the subclass name and code", () => {
    expect(new AgentParsingError("bad").name).toBe("AgentParsingError");
    expect(new AgentParsingError("bad").code).toBe("AGENT_PARSING");
    expect(new AgentParsingError("bad")).toBeInstanceOf(AgentError);
  });

  it("survives instanceof across subclasses", () => {
    const error: AgentError = new AgentMaxStepsError("too many", { stepIndex: 10 });
    expect(error).toBeInstanceOf(AgentMaxStepsError);
    expect(error).toBeInstanceOf(AgentError);
  });
});

describe("AgentError.from", () => {
  it("passes an existing AgentError through unchanged", () => {
    const original = new AgentExecutionError("nope");
    expect(AgentError.from(original)).toBe(original);
  });

  it("wraps a plain Error and keeps it as the cause", () => {
    const wrapped = AgentError.from(new Error("plain"));
    expect(wrapped.message).toBe("plain");
    expect(wrapped.cause).toBeInstanceOf(Error);
  });

  it("wraps a non-Error value", () => {
    expect(AgentError.from("just a string").message).toBe("just a string");
  });
});
```

- [ ] **Step 6: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/errors.test.ts
Expected: FAIL, because `../src/errors.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 7: Write src/errors.ts**

```ts
export type AgentErrorCode =
  | "AGENT_ERROR"
  | "AGENT_PARSING"
  | "AGENT_EXECUTION"
  | "AGENT_GENERATION"
  | "AGENT_MAX_STEPS"
  | "AGENT_TOOL_CALL"
  | "AGENT_TIMEOUT"
  | "AGENT_CANCELLED";

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
```

- [ ] **Step 8: Run the tests and the typecheck**

Run: pnpm vitest run packages/core/test/types.test.ts packages/core/test/errors.test.ts
Expected: PASS, 13 tests.

Run: pnpm typecheck
Expected: exit 0.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src/types.ts packages/core/src/errors.ts packages/core/test/types.test.ts packages/core/test/errors.test.ts
git commit -m "feat(core): add provider-neutral types and the AgentError hierarchy"
```

---

## Task 2: Memory steps

**Files:**
- Create: packages/core/src/memory/steps.ts
- Test: packages/core/test/steps.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/steps.test.ts
import { describe, expect, it } from "vitest";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from "../src/memory/steps.js";

describe("memory steps", () => {
  it("each step reports its kind", () => {
    expect(new TaskStep("do it").kind).toBe("task");
    expect(new SystemPromptStep("you are").kind).toBe("system_prompt");
    expect(new PlanningStep("plan").kind).toBe("planning");
    expect(new ActionStep("model said this").kind).toBe("action");
    expect(new FinalAnswerStep(42).kind).toBe("final_answer");
  });

  it("assigns a unique id and a creation timestamp", () => {
    const a = new TaskStep("a");
    const b = new TaskStep("b");
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBeGreaterThan(0);
  });

  it("keeps the payload it was given", () => {
    expect(new TaskStep("do it").task).toBe("do it");
    expect(new SystemPromptStep("you are").systemPrompt).toBe("you are");
    expect(new PlanningStep("plan").plan).toBe("plan");
    expect(new FinalAnswerStep({ n: 1 }).output).toEqual({ n: 1 });
  });

  it("defaults ActionStep fields to null and an empty call list", () => {
    const step = new ActionStep("raw output");
    expect(step.modelOutput).toBe("raw output");
    expect(step.codeAction).toBeNull();
    expect(step.observations).toBeNull();
    expect(step.toolCalls).toEqual([]);
    expect(step.error).toBeUndefined();
  });

  it("allows ActionStep fields to be filled in after construction", () => {
    const step = new ActionStep("raw output");
    step.codeAction = "final_answer(1)";
    step.observations = "1";
    step.isFinalAnswer = false;
    expect(step.codeAction).toBe("final_answer(1)");
    expect(step.observations).toBe("1");
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/steps.test.ts
Expected: FAIL, because `../src/memory/steps.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/memory/steps.ts**

```ts
import type { AgentErrorInfo } from "../errors.js";
import type { Timing, TokenUsage, ToolCall } from "../types.js";

export type AgentStepKind = "task" | "system_prompt" | "planning" | "action" | "final_answer";

/**
 * One unit of agent memory. Ported from upstream smolagents memory.py, with the
 * pydantic models replaced by plain classes.
 */
export abstract class AgentStep {
  abstract readonly kind: AgentStepKind;
  readonly id: string;
  readonly createdAt: number;
  timing: Timing | undefined = undefined;
  tokenUsage: TokenUsage | undefined = undefined;

  protected constructor() {
    // crypto.randomUUID is available in Node, Bun, Deno and Workers. In browsers it is
    // secure-context only (HTTPS or localhost), which every real deployment satisfies.
    this.id = crypto.randomUUID();
    this.createdAt = Date.now();
  }
}

export class TaskStep extends AgentStep {
  override readonly kind = "task";
  readonly task: string;

  constructor(task: string) {
    super();
    this.task = task;
  }
}

export class SystemPromptStep extends AgentStep {
  override readonly kind = "system_prompt";
  readonly systemPrompt: string;

  constructor(systemPrompt: string) {
    super();
    this.systemPrompt = systemPrompt;
  }
}

export class PlanningStep extends AgentStep {
  override readonly kind = "planning";
  readonly plan: string;
  hasError = false;

  constructor(plan: string) {
    super();
    this.plan = plan;
  }
}

export class ActionStep extends AgentStep {
  override readonly kind = "action";
  /** The raw text the model produced, if any. */
  modelOutput: string | null;
  /** The code the model asked to run, if it asked to run any. */
  codeAction: string | null = null;
  toolCalls: ToolCall[] = [];
  /** Everything the executor printed. */
  observations: string | null = null;
  error: AgentErrorInfo | undefined = undefined;
  isFinalAnswer = false;

  constructor(modelOutput: string | null = null) {
    super();
    this.modelOutput = modelOutput;
  }
}

export class FinalAnswerStep extends AgentStep {
  override readonly kind = "final_answer";
  readonly output: unknown;

  constructor(output: unknown) {
    super();
    this.output = output;
  }
}

export type AnyAgentStep =
  | TaskStep
  | SystemPromptStep
  | PlanningStep
  | ActionStep
  | FinalAnswerStep;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/steps.test.ts
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/memory/steps.ts packages/core/test/steps.test.ts
git commit -m "feat(core): add the typed memory step hierarchy"
```

---

## Task 3: RunResult

**Files:**
- Create: packages/core/src/agent/run-result.ts
- Test: packages/core/test/run-result.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/run-result.test.ts
import { describe, expect, it } from "vitest";
import { makeRunResult } from "../src/agent/run-result.js";
import { FinalAnswerStep, TaskStep } from "../src/memory/steps.js";

describe("makeRunResult", () => {
  it("reports success and the final answer", () => {
    const steps = [new TaskStep("q"), new FinalAnswerStep(42)];
    const result = makeRunResult({
      runId: "r1",
      output: 42,
      steps,
      start: 1000,
      end: 1500,
      tokenUsage: { inputTokens: 5, outputTokens: 3, totalTokens: 8 },
    });
    expect(result.state).toBe("success");
    expect(result.output).toBe(42);
    expect(result.runId).toBe("r1");
  });

  it("computes the duration from start and end", () => {
    const result = makeRunResult({
      runId: "r1",
      output: null,
      steps: [],
      start: 1000,
      end: 1500,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    expect(result.timing).toEqual({ start: 1000, end: 1500, durationMs: 500 });
  });

  it("exposes a defensive copy of steps", () => {
    const steps = [new TaskStep("q")];
    const result = makeRunResult({
      runId: "r1",
      output: null,
      steps,
      start: 0,
      end: 1,
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    });
    steps.push(new TaskStep("late"));
    expect(result.steps).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/run-result.test.ts
Expected: FAIL, because `../src/agent/run-result.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/agent/run-result.ts**

```ts
import type { AnyAgentStep } from "../memory/steps.js";
import type { ChatMessage, Timing, TokenUsage } from "../types.js";

export type RunState = "success" | "max_steps_reached";

export interface RunResult<TOut = unknown> {
  readonly output: TOut;
  readonly steps: readonly AnyAgentStep[];
  readonly messages: readonly ChatMessage[];
  readonly tokenUsage: TokenUsage;
  readonly timing: Timing;
  readonly state: RunState;
  readonly runId: string;
}

export interface MakeRunResultInput<TOut> {
  runId: string;
  output: TOut;
  steps: readonly AnyAgentStep[];
  messages?: readonly ChatMessage[];
  start: number;
  end: number;
  tokenUsage: TokenUsage;
  state?: RunState;
}

export function makeRunResult<TOut>(input: MakeRunResultInput<TOut>): RunResult<TOut> {
  return {
    output: input.output,
    steps: [...input.steps],
    messages: [...(input.messages ?? [])],
    tokenUsage: input.tokenUsage,
    timing: { start: input.start, end: input.end, durationMs: input.end - input.start },
    state: input.state ?? "success",
    runId: input.runId,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/run-result.test.ts
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/agent/run-result.ts packages/core/test/run-result.test.ts
git commit -m "feat(core): add RunResult"
```

---

## Task 4: The event contract

**Files:**
- Create: packages/core/src/events.ts
- Test: packages/core/test/events.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/events.test.ts
import { describe, expect, it } from "vitest";
import type { AgentEvent, AgentEventType } from "../src/events.js";
import { assertNever, isAdvisory, isTerminal } from "../src/events.js";

const SAMPLES: Record<AgentEventType, AgentEvent> = {
  "run.started": { type: "run.started", runId: "r", task: "t", modelId: "m" },
  "planning.started": { type: "planning.started", stepIndex: 0 },
  "planning.delta": { type: "planning.delta", stepIndex: 0, text: "x" },
  "planning.completed": { type: "planning.completed", stepIndex: 0, text: "x" },
  "step.started": { type: "step.started", stepIndex: 0 },
  "code.delta": { type: "code.delta", stepIndex: 0, text: "x" },
  "code.completed": { type: "code.completed", stepIndex: 0, code: "x" },
  "action.requested": { type: "action.requested", callId: "c", name: "n", args: {} },
  "action.result": { type: "action.result", callId: "c", name: "n", output: 1, durationMs: 2 },
  "action.failed": {
    type: "action.failed", callId: "c", name: "n",
    error: { name: "AgentError", message: "m", code: "AGENT_TOOL_CALL" },
  },
  "toolcalls.requested": { type: "toolcalls.requested", stepIndex: 0, calls: [] },
  "logs.appended": { type: "logs.appended", stepIndex: 0, text: "log" },
  "observation.completed": { type: "observation.completed", stepIndex: 0, text: "o", isFinalAnswer: false },
  "message.delta": { type: "message.delta", text: "x" },
  "message.completed": { type: "message.completed", text: "x" },
  "usage.updated": { type: "usage.updated", usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
  "run.completed": {
    type: "run.completed",
    result: {
      output: 1, steps: [], messages: [],
      tokenUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      timing: { start: 0, end: 1, durationMs: 1 },
      state: "success", runId: "r",
    },
  },
  "run.failed": { type: "run.failed", error: { name: "AgentError", message: "m", code: "AGENT_ERROR" } },
  "run.maxStepsReached": { type: "run.maxStepsReached", steps: 10 },
  "run.cancelled": { type: "run.cancelled" },
};

describe("the event contract is complete", () => {
  it("covers every declared AgentEventType", () => {
    const declared = Object.keys(SAMPLES).sort();
    expect(declared).toHaveLength(20);
  });

  it("classifies exactly the delta events as advisory", () => {
    const advisory = (Object.keys(SAMPLES) as AgentEventType[]).filter(isAdvisory).sort();
    expect(advisory).toEqual(["code.delta", "message.delta", "planning.delta"]);
  });

  it("classifies exactly the four terminal events", () => {
    const terminal = (Object.keys(SAMPLES) as AgentEventType[]).filter(isTerminal).sort();
    expect(terminal).toEqual(["run.cancelled", "run.completed", "run.failed", "run.maxStepsReached"]);
  });

  it("treats every completed event as authoritative", () => {
    for (const [type, event] of Object.entries(SAMPLES)) {
      if (type.endsWith(".completed")) {
        expect(isAdvisory(type as AgentEventType)).toBe(false);
        expect(event.type).toBe(type);
      }
    }
  });
});

describe("assertNever", () => {
  it("throws with the offending value", () => {
    expect(() => assertNever({ type: "unknown" } as never)).toThrow(/Unhandled event/);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/events.test.ts
Expected: FAIL, because `../src/events.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/events.ts**

```ts
import type { RunResult } from "./agent/run-result.js";
import type { AgentErrorInfo } from "./errors.js";
import type { TokenUsage, ToolCall } from "./types.js";

/**
 * Every observable thing that happens during a run.
 *
 * CONTRACT (design spec 6.3): an event whose type ends in ".delta" is ADVISORY.
 * A stream may be coalesced, retried, or replayed, so consumers must converge on the
 * matching ".completed" event. AgentSession implements this rule and never lets a delta
 * mutate its authoritative snapshot.
 */
export type AgentEvent =
  | { type: "run.started"; runId: string; task: string; modelId: string }
  | { type: "planning.started"; stepIndex: number }
  | { type: "planning.delta"; stepIndex: number; text: string }
  | { type: "planning.completed"; stepIndex: number; text: string }
  | { type: "step.started"; stepIndex: number }
  | { type: "code.delta"; stepIndex: number; text: string }
  | { type: "code.completed"; stepIndex: number; code: string }
  | { type: "action.requested"; callId: string; name: string; args: unknown }
  | { type: "action.result"; callId: string; name: string; output: unknown; durationMs: number }
  | { type: "action.failed"; callId: string; name: string; error: AgentErrorInfo }
  | { type: "toolcalls.requested"; stepIndex: number; calls: ToolCall[] }
  | { type: "logs.appended"; stepIndex: number; text: string }
  | { type: "observation.completed"; stepIndex: number; text: string; isFinalAnswer: boolean }
  | { type: "message.delta"; text: string }
  | { type: "message.completed"; text: string }
  | { type: "usage.updated"; usage: TokenUsage }
  | { type: "run.completed"; result: RunResult }
  | { type: "run.failed"; error: AgentErrorInfo }
  | { type: "run.maxStepsReached"; steps: number }
  | { type: "run.cancelled" };

export type AgentEventType = AgentEvent["type"];

/** Extract the event variant for a given type, so consumers can narrow precisely. */
export type AgentEventOf<T extends AgentEventType> = Extract<AgentEvent, { type: T }>;

/** True for advisory events: progressive enhancement only, never authoritative. */
export function isAdvisory(type: AgentEventType): boolean {
  return type.endsWith(".delta");
}

/** True for the events after which no further event for this run will arrive. */
export function isTerminal(type: AgentEventType): boolean {
  return (
    type === "run.completed" ||
    type === "run.failed" ||
    type === "run.maxStepsReached" ||
    type === "run.cancelled"
  );
}

/** Compile-time exhaustiveness guard. */
export function assertNever(value: never): never {
  throw new Error("Unhandled event: " + JSON.stringify(value));
}

/** Human-readable label, used by devtools and the React step list. */
export function describeEvent(event: AgentEvent): string {
  switch (event.type) {
    case "run.started": return "run started";
    case "planning.started": return "planning";
    case "planning.delta": return "planning";
    case "planning.completed": return "plan";
    case "step.started": return "step " + String(event.stepIndex + 1);
    case "code.delta": return "writing code";
    case "code.completed": return "code";
    case "action.requested": return event.name;
    case "action.result": return event.name + " done";
    case "action.failed": return event.name + " failed";
    case "toolcalls.requested": return String(event.calls.length) + " tool call(s)";
    case "logs.appended": return "output";
    case "observation.completed": return event.isFinalAnswer ? "final answer" : "observation";
    case "message.delta": return "message";
    case "message.completed": return "message";
    case "usage.updated": return "usage";
    case "run.completed": return "run completed";
    case "run.failed": return "run failed";
    case "run.maxStepsReached": return "max steps reached";
    case "run.cancelled": return "run cancelled";
    default: return assertNever(event);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/events.test.ts
Expected: PASS, 5 tests. If the "covers every declared AgentEventType" test fails with a different count,
reconcile the union against the sample map — the union is the source of truth.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/events.ts packages/core/test/events.test.ts
git commit -m "feat(core): add the AgentEvent contract with the advisory/authoritative rule"
```

---

## Task 5: AgentMemory

**Files:**
- Create: packages/core/src/memory/memory.ts
- Test: packages/core/test/memory.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/memory.test.ts
import { describe, expect, it } from "vitest";
import { AgentMemory } from "../src/memory/memory.js";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from "../src/memory/steps.js";

function seeded(): AgentMemory {
  const memory = new AgentMemory();
  memory.addStep(new TaskStep("What is 2 + 2?"));
  memory.addStep(new SystemPromptStep("You are a helpful agent."));
  return memory;
}

describe("AgentMemory", () => {
  it("starts empty", () => {
    expect(new AgentMemory().steps).toEqual([]);
  });

  it("appends steps in order", () => {
    const memory = seeded();
    expect(memory.steps.map((s) => s.kind)).toEqual(["task", "system_prompt"]);
  });

  it("exposes the task and the system prompt", () => {
    const memory = seeded();
    expect(memory.task).toBe("What is 2 + 2?");
    expect(memory.systemPrompt).toBe("You are a helpful agent.");
  });

  it("resets to empty", () => {
    const memory = seeded();
    memory.reset();
    expect(memory.steps).toEqual([]);
    expect(memory.task).toBeUndefined();
  });

  it("returns a frozen snapshot, so a caller cannot mutate memory", () => {
    const memory = seeded();
    const snapshot = memory.steps;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as TaskStep[]).push(new TaskStep("sneaky"));
    }).toThrow();
    expect(memory.steps).toHaveLength(2);
  });
});

describe("toMessages", () => {
  it("puts the system prompt first, then the task", () => {
    const memory = seeded();
    expect(memory.toMessages()).toEqual([
      { role: "system", content: "You are a helpful agent." },
      { role: "user", content: "What is 2 + 2?" },
    ]);
  });

  it("renders a planning step as an assistant turn plus a nudge", () => {
    const memory = seeded();
    memory.addStep(new PlanningStep("Step 1: add."));
    const messages = memory.toMessages();
    expect(messages[2]).toEqual({ role: "assistant", content: "Plan:\nStep 1: add." });
    expect(messages[3]).toEqual({ role: "user", content: "Now proceed with the plan." });
  });

  it("renders an action step as the model output plus the observation", () => {
    const memory = seeded();
    const action = new ActionStep("Thought: I will compute.\nCode: console.log(4)");
    action.observations = "4";
    memory.addStep(action);
    const messages = memory.toMessages();
    expect(messages[2]).toEqual({ role: "assistant", content: "Thought: I will compute.\nCode: console.log(4)" });
    expect(messages[3]).toEqual({ role: "user", content: "Observation:\n4" });
  });

  it("omits an action step with no model output", () => {
    const memory = seeded();
    memory.addStep(new ActionStep(null));
    expect(memory.toMessages()).toHaveLength(2);
  });

  it("stops at the final answer", () => {
    const memory = seeded();
    memory.addStep(new FinalAnswerStep(4));
    expect(memory.toMessages()).toHaveLength(2);
  });
});

describe("toChatMessages", () => {
  it("renders the task as a user turn and the final answer as an assistant turn", () => {
    const memory = seeded();
    memory.addStep(new ActionStep("thinking"));
    memory.addStep(new FinalAnswerStep(4));
    expect(memory.toChatMessages()).toEqual([
      { role: "user", content: "What is 2 + 2?" },
      { role: "assistant", content: "thinking" },
      { role: "assistant", content: "4" },
    ]);
  });

  it("stringifies a non-string final answer", () => {
    const memory = seeded();
    memory.addStep(new FinalAnswerStep({ a: 1 }));
    expect(memory.toChatMessages()[1]).toEqual({ role: "assistant", content: '{"a":1}' });
  });
});
```

Note: the first file contains a small helper type alias to keep the "not mutable" test honest; if the
engineer finds it clumsy, replacing it with a direct cast is fine. The assertion that matters is that
`memory.steps` is a readonly view.

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/memory.test.ts
Expected: FAIL, because `../src/memory/memory.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/memory/memory.ts**

```ts
import type { ChatMessage } from "../types.js";
import {
  type ActionStep,
  type AnyAgentStep,
  type FinalAnswerStep,
  type SystemPromptStep,
  type TaskStep,
} from "./steps.js";

export interface ToMessagesOptions {
  /** Overrides the stored system prompt, for callers that render it themselves. */
  systemPrompt?: string;
}

/**
 * The agent's memory: an ordered list of typed steps, plus the views derived from it.
 * Ported from upstream smolagents memory.py.
 */
export class AgentMemory {
  private readonly items: AnyAgentStep[] = [];

  /**
   * A frozen snapshot, rebuilt on access, so callers can never mutate memory through it.
   * A run holds only a handful of steps, so the copy is cheap and the guarantee is real.
   */
  get steps(): readonly AnyAgentStep[] {
    return Object.freeze([...this.items]);
  }

  addStep(step: AnyAgentStep): void {
    this.items.push(step);
  }

  reset(): void {
    this.items.length = 0;
  }

  get systemPrompt(): string | undefined {
    return this.items.find((s): s is SystemPromptStep => s.kind === "system_prompt")?.systemPrompt;
  }

  get task(): string | undefined {
    return this.items.find((s): s is TaskStep => s.kind === "task")?.task;
  }

  get finalAnswerStep(): FinalAnswerStep | undefined {
    return this.items.find((s): s is FinalAnswerStep => s.kind === "final_answer");
  }

  get actionSteps(): readonly ActionStep[] {
    return this.items.filter((s): s is ActionStep => s.kind === "action");
  }

  /**
   * The transcript handed to the model. Mirrors upstream's to_messages() semantics:
   * the system prompt, the task, then one assistant turn plus one observation turn
   * per action, in order.
   */
  toMessages(options: ToMessagesOptions = {}): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const systemPrompt = options.systemPrompt ?? this.systemPrompt;
    if (systemPrompt !== undefined) {
      messages.push({ role: "system", content: systemPrompt });
    }
    for (const step of this.items) {
      switch (step.kind) {
        case "task":
          messages.push({ role: "user", content: step.task });
          break;
        case "planning":
          messages.push({ role: "assistant", content: "Plan:\n" + step.plan });
          messages.push({ role: "user", content: "Now proceed with the plan." });
          break;
        case "action":
          if (step.modelOutput !== null) {
            messages.push({ role: "assistant", content: step.modelOutput });
          }
          if (step.observations !== null) {
            messages.push({ role: "user", content: "Observation:\n" + step.observations });
          }
          break;
        case "final_answer":
        case "system_prompt":
          break;
        default:
          break;
      }
    }
    return messages;
  }

  /**
   * The derived chat view used by the React shell (design spec 5.3, layer L1).
   * Deliberately lossy: it is a conversation, not a run.
   */
  toChatMessages(): ChatMessage[] {
    const messages: ChatMessage[] = [];
    const task = this.task;
    if (task !== undefined) {
      messages.push({ role: "user", content: task });
    }
    for (const step of this.items) {
      if (step.kind === "action" && step.modelOutput !== null) {
        messages.push({ role: "assistant", content: step.modelOutput });
      } else if (step.kind === "final_answer") {
        messages.push({ role: "assistant", content: stringifyOutput(step.output) });
      }
    }
    return messages;
  }
}

function stringifyOutput(output: unknown): string {
  if (typeof output === "string") return output;
  try {
    return JSON.stringify(output) ?? String(output);
  } catch {
    return String(output);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/memory.test.ts
Expected: PASS, 12 tests.

Note: the invariants are enforced, not merely typed. `steps` returns a frozen copy and
asserts the frozen state in Step 4, so mutating memory from outside the class is a runtime error rather
than a code-review convention.d.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/memory/memory.ts packages/core/test/memory.test.ts
git commit -m "feat(core): add AgentMemory with model-transcript and chat views"
```

---

## Task 6: Monitoring

**Files:**
- Create: packages/core/src/monitoring/monitor.ts
- Test: packages/core/test/monitor.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/monitor.test.ts
import { describe, expect, it } from "vitest";
import { Monitor } from "../src/monitoring/monitor.js";

const usage = (inputTokens: number, outputTokens: number) => ({
  inputTokens,
  outputTokens,
  totalTokens: inputTokens + outputTokens,
});

describe("Monitor", () => {
  it("returns undefined for an unrecorded key", () => {
    expect(new Monitor().get("anything")).toBeUndefined();
  });

  it("accumulates counts, tokens and duration per key", () => {
    const monitor = new Monitor();
    monitor.record("generate", usage(10, 5), 100);
    monitor.record("generate", usage(4, 1), 50);
    expect(monitor.get("generate")).toEqual({
      callCount: 2,
      inputTokens: 14,
      outputTokens: 6,
      totalTokens: 20,
      totalDurationMs: 150,
    });
  });

  it("keeps keys separate", () => {
    const monitor = new Monitor();
    monitor.record("generate", usage(10, 5), 100);
    monitor.record("plan", usage(2, 2), 20);
    expect(monitor.get("plan")?.totalTokens).toBe(4);
    expect(monitor.total.totalTokens).toBe(19);
  });

  it("totals across every key", () => {
    const monitor = new Monitor();
    monitor.record("a", usage(1, 2), 3);
    monitor.record("b", usage(4, 5), 6);
    expect(monitor.total).toEqual({ inputTokens: 5, outputTokens: 7, totalTokens: 12 });
  });

  it("reports zero totals when nothing was recorded", () => {
    expect(new Monitor().total).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("measures elapsed time from the injected start", () => {
    const monitor = new Monitor(1000);
    expect(monitor.elapsedMs(1600)).toBe(600);
  });

  it("snapshots every stat as a plain object", () => {
    const monitor = new Monitor();
    monitor.record("a", usage(1, 1), 10);
    expect(monitor.snapshot()).toEqual({
      a: { callCount: 1, inputTokens: 1, outputTokens: 1, totalTokens: 2, totalDurationMs: 10 },
    });
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/monitor.test.ts
Expected: FAIL, because `../src/monitoring/monitor.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/monitoring/monitor.ts**

```ts
import { type ChatMessage, type TokenUsage, EMPTY_TOKEN_USAGE, addTokenUsage } from "../types.js";

export interface MonitorStat {
  callCount: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  totalDurationMs: number;
}

/**
 * Token and timing accounting, ported from upstream smolagents monitoring.py.
 * Injected clock so that the tests are deterministic.
 */
export class Monitor {
  private readonly stats = new Map<string, MonitorStat>();
  private readonly startedAt: number;

  constructor(startedAt: number = Date.now()) {
    this.startedAt = startedAt;
  }

  record(key: string, usage: TokenUsage, durationMs: number): void {
    const previous = this.stats.get(key);
    this.stats.set(key, {
      callCount: (previous?.callCount ?? 0) + 1,
      inputTokens: (previous?.inputTokens ?? 0) + usage.inputTokens,
      outputTokens: (previous?.outputTokens ?? 0) + usage.outputTokens,
      totalTokens: (previous?.totalTokens ?? 0) + usage.totalTokens,
      totalDurationMs: (previous?.totalDurationMs ?? 0) + durationMs,
    });
  }

  get(key: string): MonitorStat | undefined {
    const stat = this.stats.get(key);
    return stat === undefined ? undefined : { ...stat };
  }

  get total(): TokenUsage {
    let total: TokenUsage = EMPTY_TOKEN_USAGE;
    for (const stat of this.stats.values()) {
      total = addTokenUsage(total, {
        inputTokens: stat.inputTokens,
        outputTokens: stat.outputTokens,
        totalTokens: stat.totalTokens,
      });
    }
    return total;
  }

  elapsedMs(now: number = Date.now()): number {
    return now - this.startedAt;
  }

  snapshot(): Record<string, MonitorStat> {
    const out: Record<string, MonitorStat> = {};
    for (const [key, stat] of this.stats) {
      out[key] = { ...stat };
    }
    return out;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/monitor.test.ts
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/monitoring/monitor.ts packages/core/test/monitor.test.ts
git commit -m "feat(core): add the Monitor token and timing accountant"
```

---

## Task 7: Template population

**Files:**
- Create: packages/core/src/prompts/populate-template.ts
- Test: packages/core/test/populate-template.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/populate-template.test.ts
import { describe, expect, it } from "vitest";
import { TemplateError, populateTemplate } from "../src/prompts/populate-template.js";

describe("populateTemplate", () => {
  it("substitutes a variable", () => {
    expect(populateTemplate("Hello {{ name }}!", { name: "world" })).toBe("Hello world!");
  });

  it("substitutes without surrounding whitespace", () => {
    expect(populateTemplate("{{a}}{{b}}", { a: "1", b: "2" })).toBe("12");
  });

  it("substitutes every occurrence", () => {
    expect(populateTemplate("{{x}} and {{x}}", { x: "y" })).toBe("y and y");
  });

  it("accepts numbers", () => {
    expect(populateTemplate("max {{n}} steps", { n: 10 })).toBe("max 10 steps");
  });

  it("names the missing variable", () => {
    expect(() => populateTemplate("Hello {{ who }}", {})).toThrow(TemplateError);
    expect(() => populateTemplate("Hello {{ who }}", {})).toThrow(/who/);
  });

  it("leaves single braces alone", () => {
    expect(populateTemplate("a { b } c", {})).toBe("a { b } c");
  });

  it("leaves a non-identifier placeholder alone", () => {
    expect(populateTemplate("{{ not a name }}", {})).toBe("{{ not a name }}");
  });

  it("leaves an unterminated placeholder alone", () => {
    expect(populateTemplate("start {{ name", {})).toBe("start {{ name");
  });

  it("does not interpret replacement patterns inside a value", () => {
    expect(populateTemplate("{{x}}", { x: "$& $1 $' " })).toBe("$& $1 $' ");
  });

  it("reports the name of the first missing variable", () => {
    expect(() => populateTemplate("{{ok}} {{missing}}", { ok: "1" })).toThrow(/missing/);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/populate-template.test.ts
Expected: FAIL, because `../src/prompts/populate-template.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/prompts/populate-template.ts**

```ts
export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

const OPEN = "{{";
const CLOSE = "}}";
const VALID_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

/**
 * Replaces a *subset* of upstream smolagents' populate_template. Upstream delegates to Jinja2 and so has
 * loops, conditionals, filters and dotted paths; this scanner handles flat identifier placeholders only and
 * passes anything else through untouched, which is the only sane behaviour for JavaScript source embedded in
 * a template string. The parts of upstream's templates that needed a loop (the tool list and the
 * managed-agent list) are pre-rendered by the caller instead.
 *
 * An unknown *identifier* still throws, so a genuine template typo is loud rather than silent.
 *
 * Deliberately not built on String.prototype.replace: a value containing "$&" or "$1"
 * must be inserted literally, and a hand-written scanner guarantees that.
 */
export function populateTemplate(
  template: string,
  variables: Record<string, string | number>,
): string {
  let out = "";
  let cursor = 0;

  for (;;) {
    const start = template.indexOf(OPEN, cursor);
    if (start === -1) {
      out += template.slice(cursor);
      return out;
    }
    const end = template.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) {
      out += template.slice(cursor);
      return out;
    }
    const name = template.slice(start + OPEN.length, end).trim();
    if (!VALID_NAME.test(name)) {
      // Not a placeholder we own; copy it through untouched.
      out += template.slice(cursor, end + CLOSE.length);
      cursor = end + CLOSE.length;
      continue;
    }
    const value = variables[name];
    if (value === undefined) {
      throw new TemplateError("Missing value for template variable: " + name);
    }
    out += template.slice(cursor, start) + String(value);
    cursor = end + CLOSE.length;
  }
}

/** The placeholders a template declares, in order of first appearance. */
export function templateVariables(template: string): string[] {
  const found: string[] = [];
  let cursor = 0;
  for (;;) {
    const start = template.indexOf(OPEN, cursor);
    if (start === -1) return found;
    const end = template.indexOf(CLOSE, start + OPEN.length);
    if (end === -1) return found;
    const name = template.slice(start + OPEN.length, end).trim();
    if (VALID_NAME.test(name) && !found.includes(name)) found.push(name);
    cursor = end + CLOSE.length;
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/populate-template.test.ts
Expected: PASS, 10 tests.

- [ ] **Step 5: Add a drift test for templateVariables**

Append to the same test file:

```ts
describe("templateVariables", () => {
  it("lists each placeholder once, in order", () => {
    expect(templateVariables("{{a}} {{b}} {{a}}")).toEqual(["a", "b"]);
  });

  it("ignores non-placeholders", () => {
    expect(templateVariables("{ x } {{ ok }}")).toEqual(["ok"]);
  });
});
```

Add the import:

```ts
import { TemplateError, populateTemplate, templateVariables } from "../src/prompts/populate-template.js";
```

Run: pnpm vitest run packages/core/test/populate-template.test.ts
Expected: PASS, 12 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/prompts/populate-template.ts packages/core/test/populate-template.test.ts
git commit -m "feat(core): add populateTemplate with strict variable checking"
```

---

## Task 8: Prompt templates and the system prompt builder

**Files:**
- Create: packages/core/src/prompts/templates.ts
- Create: packages/core/src/prompts/system-prompt.ts
- Test: packages/core/test/system-prompt.test.ts

**Layering note:** this module deliberately does not import the tool module. It receives an already-rendered
`toolDescriptions` string, so the prompt layer has zero dependencies and the tool layer can evolve without
touching prompt code. The agent (Task 15) wires the two together.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/system-prompt.test.ts
import { describe, expect, it } from "vitest";
import { templateVariables } from "../src/prompts/populate-template.js";
import { buildCodeAgentSystemPrompt } from "../src/prompts/system-prompt.js";
import { CODE_AGENT_SYSTEM_TEMPLATE, CODE_FENCE } from "../src/prompts/templates.js";

describe("CODE_AGENT_SYSTEM_TEMPLATE", () => {
  it("declares exactly the variables the builder supplies", () => {
    expect(templateVariables(CODE_AGENT_SYSTEM_TEMPLATE).sort()).toEqual([
      "codeFence",
      "customInstructions",
      "language",
      "toolDescriptions",
    ]);
  });

  it("names the final answer contract", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain("final_answer");
  });

  it("requires an Observation before the next step", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toMatch(/Observation/);
  });

  it("carries all six upstream examples", () => {
    const tasks = [
      "oldest person in this document",
      "5 + 3 + 1294.678",
      "variable 'question' about the image",
      "Stanislaus Ulam",
      "Guangzhou or Shanghai",
      "current age of the pope",
    ];
    for (const task of tasks) {
      expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain(task);
    }
  });

  it("carries all eleven numbered rules", () => {
    const rules = [
      "1. Always provide a 'Thought:'",
      "2. Use only variables that you have defined",
      "3. Always use the right arguments for the tools",
      "4. For tools WITHOUT JSON output schema",
      "5. For tools WITH JSON output schema",
      "6. Call a tool only when needed",
      "7. Don't name any new variable with the same name as a tool",
      "8. Never create any notional variables",
      "9. There is no module system",
      "10. The state persists between code executions",
      "11. Don't give up!",
    ];
    for (const rule of rules) {
      expect(CODE_AGENT_SYSTEM_TEMPLATE).toContain(rule);
    }
  });

  it("keeps upstream's notional-tools disclaimer", () => {
    expect(CODE_AGENT_SYSTEM_TEMPLATE).toMatch(/Above examples were using notional tools/);
  });
});

describe("buildCodeAgentSystemPrompt", () => {
  it("leaves no placeholder behind", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "- get_weather(city)" });
    expect(prompt).not.toContain("{{");
  });

  it("includes the tool descriptions", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "- get_weather(city)" });
    expect(prompt).toContain("- get_weather(city)");
  });

  it("defaults the language to JavaScript and the fence to the code fence", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none" });
    expect(prompt).toContain("JavaScript");
    expect(prompt).toContain(CODE_FENCE);
  });

  it("honours an explicit language", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none", language: "Python" });
    expect(prompt).toContain("Python");
  });

  it("says so when there are no tools", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "" });
    expect(prompt).toMatch(/no tools/i);
  });

  it("inserts custom instructions after the rules and before the closing line", () => {
    const prompt = buildCodeAgentSystemPrompt({
      toolDescriptions: "none",
      customInstructions: "Always answer in French.",
    });
    // Upstream places custom_instructions after the rules and before "Now Begin!".
    expect(prompt).toContain("Always answer in French.");
    expect(prompt.indexOf("Always answer in French.")).toBeGreaterThan(prompt.indexOf("Don't give up!"));
    expect(prompt.trimEnd().endsWith("Now Begin!")).toBe(true);
  });

  it("omits custom instructions cleanly when none are given", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: "none" });
    expect(prompt.trimEnd().endsWith("Now Begin!")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/system-prompt.test.ts
Expected: FAIL, because `../src/prompts/templates.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/prompts/templates.ts**

Full re-authoring of upstream `src/smolagents/prompts/code_agent.yaml` in the JavaScript dialect. Upstream's system
prompt is 173 lines: six worked examples plus eleven numbered rules. Port **all six examples** and **all
eleven rules**, keeping the wording as close to upstream as the dialect allows.

The six examples, in upstream order, and what each one teaches the model:

| # | upstream task | teaches |
|---|---|---|
| 1 | "Generate an image of the oldest person in this document." | a two-tool chain ending in `final_answer(image)` |
| 2 | "What is the result of the following operation: 5 + 3 + 1294.678?" | pure computation, no tools at all |
| 3 | the French `question`/`image` task | additional arguments arrive as pre-defined variables; string concatenation in the answer |
| 4 | the 1979 Stanislaus Ulam interview | a failed tool call, a broadened retry, a loop over two URLs with a printed separator, then a one-word answer |
| 5 | "Which city has the highest population: Guangzhou or Shanghai?" | a loop calling one tool for several inputs, then comparing the printed results in a later step |
| 6 | "What is the current age of the pope, raised to the power 0.36?" | a cross-check between two tools, then arithmetic over the retrieved value |

Three rules are adapted rather than translated, and every adaptation is called out in the prompt itself:

- **Rule 3** cannot be translated literally. Upstream says "DO NOT pass the arguments as a dict … use the
  arguments directly", because Python tools take keyword arguments. JavaScript has none: a tool takes exactly
  one object literal, and that object *is* the argument list. The JS rule therefore demands one object literal
  whose keys are the declared parameter names, and forbids both positional arguments and an extra wrapping
  object.
- **Rule 9** confines imports to an allow-list. The QuickJS guest has no module system at all, so the JS rule
  states that instead of listing modules, and upstream's `{{authorized_imports}}` variable has no counterpart.
- **Rule 11** ("don't give up") keeps its wording, and rule 10's warning to `console.log()` is sharpened: the
  guest persists state, but a value that is never printed is invisible in the transcript.

**Managed agents:** upstream's prompt carries a managed-agents section between the tool list and the rules. S1
has no managed agents — they are deferred to S2 and recorded as such in the design spec — so the section is
omitted here. When they land, the template gains one pre-rendered `{{managedAgents}}` variable in exactly that
position, alongside `{{toolDescriptions}}`, using the same caller-pre-renders-the-block scheme.

**Variable note:** upstream's third example writes `{{question}}` and `{{image}}` because Jinja substitutes them
from the task's additional arguments. Our renderer substitutes only variables the template *declares* and
passes unknown placeholders through untouched (Task 7), so they appear here as plain prose. That also means
every `{{`-looking sequence in this template must be a declared variable, or the "leaves no placeholder
behind" test below fails.

````ts
/** The fence the model must use for its action code. */
export const CODE_FENCE = "```";

/**
 * The CodeAgent system prompt, re-authored from upstream's
 * src/smolagents/prompts/code_agent.yaml. All six worked examples and all
 * eleven numbered rules are present; the fidelity test in Step 1 asserts them.
 *
 * Divergences from the YAML, every one forced by the language change:
 * - {{codeFence}} replaces Jinja's {{code_block_opening_tag}} / _closing_tag.
 * - {{language}} replaces the hard-coded "Python".
 * - {{toolDescriptions}} replaces the {% for tool in tools.values() %} loop.
 * - No managed-agents section: S1 has no managed agents (deferred to S2).
 * - No {{ placeholders in prose: the renderer substitutes only declared
 *   variables and passes the rest through, so an undeclared one would survive
 *   into the prompt and fail the drift test.
 */
export const CODE_AGENT_SYSTEM_TEMPLATE = `You are an expert assistant who can solve any task by writing {{language}} code. You will be given a task to solve as best you can.
To do so, you have been given access to a list of tools: these tools are functions which you can call with code.
To solve the task, you must plan forward to proceed in a series of steps, in a cycle of Thought, Code, and Observation sequences.

At each step, in the 'Thought:' sequence, you should first explain your reasoning towards solving the task and the tools that you want to use.
Then in the Code sequence you should write the code in simple {{language}}. The code sequence must be opened with '{{codeFence}}', and closed with '{{codeFence}}'.
During each intermediate step, you can use 'console.log()' to save whatever important information you will then need.
These print outputs will then appear in the 'Observation:' field, which will be available as input for the next step.
In the end you have to return a final answer using the final_answer tool.

Here are a few examples using notional tools:
---
Task: "Generate an image of the oldest person in this document."

Thought: I will proceed step by step and use the following tools: document_qa to find the oldest person in the document, then image_generator to generate an image according to the answer.
{{codeFence}}javascript
const answer = await document_qa({ document, question: "Who is the oldest person mentioned?" });
console.log(answer);
{{codeFence}}
Observation: "The oldest person in the document is John Doe, a 55 year old lumberjack living in Newfoundland."

Thought: I will now generate an image showcasing the oldest person.
{{codeFence}}javascript
const image = await image_generator({ prompt: "A portrait of John Doe, a 55-year-old man living in Canada." });
final_answer(image);
{{codeFence}}

---
Task: "What is the result of the following operation: 5 + 3 + 1294.678?"

Thought: I will use {{language}} code to compute the result of the operation and then return the final answer using the final_answer tool.
{{codeFence}}javascript
const result = 5 + 3 + 1294.678;
final_answer(result);
{{codeFence}}

---
Task: "Answer the question in the variable 'question' about the image stored in the variable 'image'. The question is in French. You must answer in the same language as the question."

Thought: I will use the following tools: translator to translate the question into English and then image_qa to answer the question on the input image.
{{codeFence}}javascript
const translatedQuestion = await translator({ question, src_lang: "French", tgt_lang: "English" });
console.log("The translated question is " + translatedQuestion + ".");
const answer = await image_qa({ image, question: translatedQuestion });
final_answer("The answer is " + answer + ".");
{{codeFence}}
Observation: The translated question is "What animal is in the image?" and the answer is "a cat".

---
Task: "In a 1979 interview, Stanislaus Ulam discusses with Martin Sherwin about other great physicists of his time, including Oppenheimer. What does he say was the consequence of Einstein learning too much math on his creativity, in one word?"

Thought: I need to find and read the 1979 interview of Stanislaus Ulam with Martin Sherwin.
{{codeFence}}javascript
const pages = await web_search({ query: "1979 interview Stanislaus Ulam Martin Sherwin physicists Einstein" });
console.log(pages);
{{codeFence}}
Observation: No result found for query "1979 interview Stanislaus Ulam Martin Sherwin physicists Einstein".

Thought: The query was maybe too restrictive and did not find any results. Let's try again with a broader query.
{{codeFence}}javascript
const pages = await web_search({ query: "1979 interview Stanislaus Ulam" });
console.log(pages);
{{codeFence}}
Observation: Found 6 pages:
[Stanislaus Ulam 1979 interview](https://ahf.nuclearmuseum.org/voices/oral-histories/stanislaus-ulams-interview-1979/)
[Ulam discusses Manhattan Project](https://ahf.nuclearmuseum.org/manhattan-project/ulam-manhattan-project/)
(truncated)

Thought: I will read the first 2 pages to know more.
{{codeFence}}javascript
for (const url of ["https://ahf.nuclearmuseum.org/voices/oral-histories/stanislaus-ulams-interview-1979/", "https://ahf.nuclearmuseum.org/manhattan-project/ulam-manhattan-project/"]) {
  const wholePage = await visit_webpage({ url });
  console.log(wholePage);
  console.log("\n" + "=".repeat(80) + "\n"); // Print separator between pages
}
{{codeFence}}
Observation: Manhattan Project Locations: Los Alamos, NM. Stanislaus Ulam was a Polish-American mathematician. He worked on the Manhattan Project at Los Alamos and later helped design the hydrogen bomb. (truncated)

Thought: I now have the final answer: from the webpages visited, Stanislaus Ulam says of Einstein: "He learned too much mathematics and sort of diminished, it seems to me personally, it seems to me his purely physics creativity." Let's answer in one word.
{{codeFence}}javascript
final_answer("diminished");
{{codeFence}}

---
Task: "Which city has the highest population: Guangzhou or Shanghai?"

Thought: I need to get the populations for both cities and compare them: I will use the tool web_search to get the population of both cities.
{{codeFence}}javascript
for (const city of ["Guangzhou", "Shanghai"]) {
  console.log("Population " + city + ":", await web_search({ query: city + " population" }));
}
{{codeFence}}
Observation:
Population Guangzhou: ['Guangzhou has a population of 15 million inhabitants as of 2021.']
Population Shanghai: '26 million (2019)'

Thought: Now I know that Shanghai has the highest population.
{{codeFence}}javascript
final_answer("Shanghai");
{{codeFence}}

---
Task: "What is the current age of the pope, raised to the power 0.36?"

Thought: I will use the tool wikipedia_search to get the age of the pope, and confirm that with a web search.
{{codeFence}}javascript
const popeAgeWiki = await wikipedia_search({ query: "current pope age" });
console.log("Pope age as per wikipedia:", popeAgeWiki);
const popeAgeSearch = await web_search({ query: "current pope age" });
console.log("Pope age as per google search:", popeAgeSearch);
{{codeFence}}
Observation: Pope age: "The pope Francis is currently 88 years old."

Thought: I know that the pope is 88 years old. Let's compute the result using {{language}} code.
{{codeFence}}javascript
const popeCurrentAge = 88 ** 0.36;
final_answer(popeCurrentAge);
{{codeFence}}

Above examples were using notional tools that might not exist for you. On top of performing computations in the {{language}} code snippets that you create, you only have access to these tools, behaving like regular functions:
{{toolDescriptions}}

Here are the rules you should always follow to solve your task:
1. Always provide a 'Thought:' sequence, and a 'Code:' sequence, and the code must be a single {{codeFence}} block opened and closed with {{codeFence}}, else you will fail.
2. Use only variables that you have defined!
3. Always use the right arguments for the tools. Each tool takes exactly one object literal whose keys are the parameter names declared for it, as in get_weather({ city: "Paris" }). Do not pass positional arguments, and do not wrap the arguments in a further object as in get_weather({ args: { city: "Paris" } }).
4. For tools WITHOUT JSON output schema: Take care to not chain too many sequential tool calls in the same code block, as their output format is unpredictable. For instance, a call to web_search without a JSON output schema has an unpredictable return format, so do not have another tool call that depends on its output in the same block: rather output results with console.log() to use them in the next block.
5. For tools WITH JSON output schema: You can confidently chain multiple tool calls and directly access structured output fields in the same code block! When a tool has a JSON output schema, you know exactly what fields and data types to expect, allowing you to write robust code that directly accesses the structured response (e.g. result.fieldName) without needing intermediate console.log() statements.
6. Call a tool only when needed, and never re-do a tool call that you previously did with the exact same parameters.
7. Don't name any new variable with the same name as a tool: for instance don't name a variable 'final_answer'.
8. Never create any notional variables in our code, as having these in your logs will derail you from the true variables.
9. There is no module system in the code you write: you cannot use 'import' or 'require', and you cannot read files or reach the network directly. Everything you need is already in scope: the tools listed above and the standard JavaScript built-ins.
10. The state persists between code executions: so if in one step you've created variables or defined functions, these will all persist. Don't forget to use 'console.log()' to save important information, as it is the only way to pass data from one step to the next.
11. Don't give up! You're in charge of solving the task, not providing directions to solve it.

{{customInstructions}}

Now Begin!
`;

/** Variables the template declares; asserted by the drift test in Step 1. */
export const CODE_AGENT_TEMPLATE_VARIABLES = [
  "codeFence",
  "customInstructions",
  "language",
  "toolDescriptions",
] as const;
````

- [ ] **Step 4: Write src/prompts/system-prompt.ts**

```ts
import { populateTemplate } from "./populate-template.js";
import { CODE_AGENT_SYSTEM_TEMPLATE, CODE_FENCE } from "./templates.js";

export interface BuildCodeAgentSystemPromptOptions {
  /**
   * Pre-rendered tool documentation, one line per tool. An empty string means
   * "no tools", which the prompt states explicitly rather than leaving a blank.
   */
  toolDescriptions: string;
  /** Defaults to "JavaScript". */
  language?: string;
  /** Appended verbatim at the end of the prompt. */
  customInstructions?: string;
}

export function buildCodeAgentSystemPrompt(options: BuildCodeAgentSystemPromptOptions): string {
  const toolDescriptions =
    options.toolDescriptions.trim() === ""
      ? "(no tools are available; solve the task with code alone)"
      : options.toolDescriptions;
  return populateTemplate(CODE_AGENT_SYSTEM_TEMPLATE, {
    language: options.language ?? "JavaScript",
    codeFence: CODE_FENCE,
    toolDescriptions,
    customInstructions: options.customInstructions ?? "",
  });
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/system-prompt.test.ts
Expected: PASS, 13 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/prompts/templates.ts packages/core/src/prompts/system-prompt.ts packages/core/test/system-prompt.test.ts
git commit -m "feat(core): port the code agent prompt to the JavaScript dialect"
```

---

## Task 9: The Model interface

**Files:**
- Create: packages/core/src/model.ts
- Test: packages/core/test/model.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/model.test.ts
import { describe, expect, it } from "vitest";
import { collectCompletion } from "../src/model.js";
import type { ChatCompletionChunk } from "../src/model.js";

async function* from(chunks: ChatCompletionChunk[]): AsyncIterable<ChatCompletionChunk> {
  for (const chunk of chunks) yield chunk;
}

describe("collectCompletion", () => {
  it("joins text deltas", async () => {
    const completion = await collectCompletion(from([{ delta: "Hel" }, { delta: "lo" }]));
    expect(completion.content).toBe("Hello");
  });

  it("returns an empty completion for an empty stream", async () => {
    const completion = await collectCompletion(from([]));
    expect(completion.content).toBe("");
    expect(completion.toolCalls).toEqual([]);
    expect(completion.finishReason).toBe("stop");
  });

  it("reassembles a tool call split across chunks", async () => {
    const completion = await collectCompletion(
      from([
        { delta: "", toolCallDelta: { index: 0, id: "call_1", name: "get_weather", argumentsDelta: '{"ci' } },
        { delta: "", toolCallDelta: { index: 0, argumentsDelta: 'ty":"Paris"}' } },
      ]),
    );
    expect(completion.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
  });

  it("keeps interleaved tool calls apart and in index order", async () => {
    const completion = await collectCompletion(
      from([
        { delta: "", toolCallDelta: { index: 1, id: "b", name: "second", argumentsDelta: "{}" } },
        { delta: "", toolCallDelta: { index: 0, id: "a", name: "first", argumentsDelta: "{}" } },
      ]),
    );
    expect(completion.toolCalls.map((c) => c.name)).toEqual(["first", "second"]);
  });

  it("carries the finish reason from the last chunk that set one", async () => {
    const completion = await collectCompletion(
      from([{ delta: "x", finishReason: "tool_calls" }, { delta: "y" }]),
    );
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("passes the supplied usage through", async () => {
    const usage = { inputTokens: 3, outputTokens: 4, totalTokens: 7 };
    const completion = await collectCompletion(from([{ delta: "x" }]), usage);
    expect(completion.usage).toEqual(usage);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/model.test.ts
Expected: FAIL, because `../src/model.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/model.ts**

```ts
import { type TokenUsage, EMPTY_TOKEN_USAGE } from "./types.js";
import type { ChatMessage } from "./types.js";

/** A tool as advertised to the model: JSON Schema, provider-neutral. */
export interface ToolSpec {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** A tool call the model asked for. arguments is the raw JSON string the provider returned. */
export interface ToolCallRequest {
  id: string;
  name: string;
  arguments: string;
}

export type FinishReason = "stop" | "tool_calls" | "length" | "other";

export interface ChatCompletion {
  content: string;
  toolCalls: ToolCallRequest[];
  usage: TokenUsage;
  finishReason: FinishReason;
}

export interface ToolCallDelta {
  index: number;
  id?: string;
  name?: string;
  argumentsDelta?: string;
}

export interface ChatCompletionChunk {
  delta: string;
  toolCallDelta?: ToolCallDelta;
  finishReason?: FinishReason;
}

export interface ModelCapabilities {
  streaming: boolean;
  toolCalls: boolean;
  images: boolean;
  structuredOutput: boolean;
}

export interface GenerateOptions {
  systemPrompt?: string;
  tools?: readonly ToolSpec[];
  stopSequences?: readonly string[];
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * The model seam (design spec section 7). Every provider is reachable through this
 * interface, so core never learns a provider name.
 */
export interface Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  generate(messages: readonly ChatMessage[], options?: GenerateOptions): Promise<ChatCompletion>;
  generateStream(
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk>;
}

const DEFAULT_CAPABILITIES: ModelCapabilities = {
  streaming: true,
  toolCalls: false,
  images: false,
  structuredOutput: false,
};

export function modelCapabilities(overrides: Partial<ModelCapabilities> = {}): ModelCapabilities {
  return { ...DEFAULT_CAPABILITIES, ...overrides };
}

/**
 * Drains a chunk stream into a single completion. An adapter that only speaks
 * non-streaming HTTP can implement generateStream by yielding one chunk, and an
 * adapter that streams can reuse this to satisfy generate().
 */
export async function collectCompletion(
  chunks: AsyncIterable<ChatCompletionChunk>,
  usage: TokenUsage = EMPTY_TOKEN_USAGE,
): Promise<ChatCompletion> {
  let content = "";
  let finishReason: FinishReason = "stop";
  const openCalls = new Map<number, ToolCallRequest>();

  for await (const chunk of chunks) {
    content += chunk.delta;
    const delta = chunk.toolCallDelta;
    if (delta !== undefined) {
      const existing = openCalls.get(delta.index) ?? { id: "", name: "", arguments: "" };
      if (delta.id !== undefined) existing.id = delta.id;
      if (delta.name !== undefined) existing.name = delta.name;
      if (delta.argumentsDelta !== undefined) existing.arguments += delta.argumentsDelta;
      openCalls.set(delta.index, existing);
    }
    if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
  }

  const toolCalls = [...openCalls.entries()]
    .sort(([a], [b]) => a - b)
    .map(([, call]) => call);

  return { content, toolCalls, usage, finishReason };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/model.test.ts
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/model.ts packages/core/test/model.test.ts
git commit -m "feat(core): add the Model interface and stream collection"
```

---

## Task 10: MockModel — the scripted test double

**Files:**
- Create: packages/core/src/testing/mock-model.ts
- Test: packages/core/test/mock-model.test.ts

Every behavioural test in this plan and in S4–S5 depends on this file. It is deliberately shipped from
`src/testing` (not `test`) so that consumers and the React package's storybook can script runs too.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/mock-model.test.ts
import { describe, expect, it } from "vitest";
import { MockModel } from "../src/testing/mock-model.js";

describe("MockModel", () => {
  it("returns scripted responses in order", async () => {
    const model = new MockModel(["first", "second"]);
    expect((await model.generate([])).content).toBe("first");
    expect((await model.generate([])).content).toBe("second");
  });

  it("records every transcript it was given", async () => {
    const model = new MockModel(["ok"]);
    await model.generate([{ role: "user", content: "hello" }]);
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]).toEqual([{ role: "user", content: "hello" }]);
  });

  it("records a copy, so later mutation of the caller array does not leak in", async () => {
    const model = new MockModel(["ok"]);
    const messages = [{ role: "user" as const, content: "hello" }];
    await model.generate(messages);
    messages.push({ role: "user", content: "sneaky" });
    expect(model.calls[0]).toHaveLength(1);
  });

  it("fails loudly when the script is exhausted", async () => {
    const model = new MockModel(["only"]);
    await model.generate([]);
    await expect(model.generate([])).rejects.toThrow(/exhausted/i);
  });

  it("streams the response in chunks so delta handling is exercised", async () => {
    const model = new MockModel({ responses: ["abcdefghij"], chunkSize: 4 });
    const pieces: string[] = [];
    for await (const chunk of model.generateStream([])) pieces.push(chunk.delta);
    expect(pieces).toEqual(["abcd", "efgh", "ij"]);
    expect(pieces.join("")).toBe("abcdefghij");
  });

  it("returns the whole response in one chunk by default", async () => {
    const model = new MockModel(["whole"]);
    const pieces: string[] = [];
    for await (const chunk of model.generateStream([])) pieces.push(chunk.delta);
    expect(pieces).toEqual(["whole"]);
  });

  it("supports scripted tool calls", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: "get_weather", arguments: '{"city":"Paris"}' }], finishReason: "tool_calls" },
    ]);
    const completion = await model.generate([]);
    expect(completion.toolCalls).toHaveLength(1);
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("counts one response per generate and per generateStream call", async () => {
    const model = new MockModel(["a", "b"]);
    await model.generate([]);
    for await (const _ of model.generateStream([])) { /* consume */ }
    expect(model.callCount).toBe(2);
    await expect(model.generate([])).rejects.toThrow(/exhausted/i);
  });

  it("reports mock capabilities and identifiers", () => {
    const model = new MockModel(["x"]);
    expect(model.provider).toBe("mock");
    expect(model.id).toBe("mock");
    expect(model.capabilities.toolCalls).toBe(true);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/mock-model.test.ts
Expected: FAIL, because `../src/testing/mock-model.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/testing/mock-model.ts**

```ts
import { AgentGenerationError } from "../errors.js";
import { type ChatCompletion, type ChatCompletionChunk, type FinishReason, type GenerateOptions, type Model, type ToolCallRequest, modelCapabilities } from "../model.js";
import { type TokenUsage, EMPTY_TOKEN_USAGE } from "../types.js";
import type { ChatMessage } from "../types.js";

export interface MockTurn {
  content?: string;
  toolCalls?: ToolCallRequest[];
  usage?: TokenUsage;
  finishReason?: FinishReason;
}

export type MockTurnInput = string | MockTurn;

export interface MockModelOptions {
  responses: MockTurnInput[];
  id?: string;
  /** Split streamed content into chunks of this many characters. 0 means one chunk. */
  chunkSize?: number;
}

/**
 * A deterministic scripted model. Every loop test in this project replays a fixed
 * transcript through it, which is what makes the ReAct cycle testable without a provider.
 */
export class MockModel implements Model {
  readonly id: string;
  readonly provider = "mock";
  readonly capabilities = modelCapabilities({ streaming: true, toolCalls: true });

  private readonly turns: MockTurn[];
  private readonly chunkSize: number;
  private index = 0;

  /** Every transcript passed to generate or generateStream, in call order. */
  readonly calls: ChatMessage[][] = [];

  constructor(input: MockTurnInput[] | MockModelOptions) {
    if (Array.isArray(input)) {
      this.turns = input.map(normalizeTurn);
      this.id = "mock";
      this.chunkSize = 0;
    } else {
      this.turns = input.responses.map(normalizeTurn);
      this.id = input.id ?? "mock";
      this.chunkSize = input.chunkSize ?? 0;
    }
  }

  get callCount(): number {
    return this.index;
  }

  get remaining(): number {
    return this.turns.length - this.index;
  }

  reset(): void {
    this.index = 0;
    this.calls.length = 0;
  }

  async generate(messages: readonly ChatMessage[], _options?: GenerateOptions): Promise<ChatCompletion> {
    const turn = this.take(messages);
    return {
      content: turn.content ?? "",
      toolCalls: turn.toolCalls === undefined ? [] : turn.toolCalls.map((call) => ({ ...call })),
      usage: turn.usage ?? EMPTY_TOKEN_USAGE,
      finishReason: turn.finishReason ?? "stop",
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    _options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk> {
    const turn = this.take(messages);
    const content = turn.content ?? "";
    const size = this.chunkSize > 0 ? this.chunkSize : content.length;
    if (content.length === 0) {
      yield { delta: "", finishReason: turn.finishReason ?? "stop" };
      return;
    }
    for (let offset = 0; offset < content.length; offset += size) {
      yield { delta: content.slice(offset, offset + size) };
    }
    if (turn.toolCalls !== undefined) {
      turn.toolCalls.forEach((call, index) => {
        void index;
      });
    }
    yield { delta: "", finishReason: turn.finishReason ?? "stop" };
  }

  private take(messages: readonly ChatMessage[]): MockTurn {
    this.calls.push([...messages]);
    const turn = this.turns[this.index];
    if (turn === undefined) {
      throw new AgentGenerationError(
        "MockModel script exhausted after " + String(this.index) + " responses",
      );
    }
    this.index += 1;
    return turn;
  }
}

function normalizeTurn(input: MockTurnInput): MockTurn {
  return typeof input === "string" ? { content: input } : input;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/mock-model.test.ts
Expected: PASS, 9 tests.

- [ ] **Step 5: Clean up the dead tool-call branch**

Step 3 contains a placeholder loop that does nothing:

```ts
    if (turn.toolCalls !== undefined) {
      turn.toolCalls.forEach((call, index) => {
        void index;
      });
    }
```

Delete it. Tool calls are delivered by `generate()`; `generateStream()` carries text deltas and the finish
reason. If a later task needs streamed tool-call deltas, add them deliberately with a test that requires
them — do not leave a no-op branch in shipped source.

Run: pnpm vitest run packages/core/test/mock-model.test.ts
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/testing/mock-model.ts packages/core/test/mock-model.test.ts
git commit -m "feat(core): add MockModel, the deterministic scripted model"
```

---

## Task 11: Tools and the tool registry

**Files:**
- Create: packages/core/src/logger.ts
- Create: packages/core/src/tool/tool.ts
- Create: packages/core/src/tool/registry.ts
- Test: packages/core/test/logger.test.ts
- Test: packages/core/test/tool.test.ts
- Test: packages/core/test/registry.test.ts

**Dependency note:** this task requires `zod@^4` for `z.toJSONSchema`. S0 already pins `"zod": "^4.0.0"`, so the
dependency is in place; there is no v3 fallback path and no compatibility shim to write. Zod 4 is also Standard
Schema compliant, which the design spec requires.

- [ ] **Step 1: Write the failing test for the tool factory**

```ts
// packages/core/test/tool.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolDefinitionError, tool } from "../src/tool/tool.js";

describe("tool()", () => {
  it("keeps an explicit name", () => {
    const t = tool({
      name: "get_weather",
      description: "Get the weather.",
      inputSchema: z.object({ city: z.string() }),
      execute: () => "sunny",
    });
    expect(t.name).toBe("get_weather");
  });

  it("rejects a missing name when the schema has no title", () => {
    expect(() =>
      tool({
        description: "no name",
        inputSchema: z.object({ a: z.string() }),
        execute: () => 1,
      }),
    ).toThrow(ToolDefinitionError);
  });

  it("falls back to the schema title", () => {
    const schema = z.object({ a: z.string() }).describe("add_one");
    const t = tool({ description: "Add one.", inputSchema: schema, execute: () => 1 });
    expect(t.name).toBe("add_one");
  });

  it("rejects a name that is not an identifier", () => {
    expect(() =>
      tool({ name: "not a name", description: "d", inputSchema: z.object({}), execute: () => 1 }),
    ).toThrow(/identifier/i);
  });

  it("produces a JSON Schema spec for the model", () => {
    const t = tool({
      name: "get_weather",
      description: "Get the weather.",
      inputSchema: z.object({ city: z.string(), units: z.enum(["celsius", "fahrenheit"]).optional() }),
      execute: () => "sunny",
    });
    const spec = t.toSpec();
    expect(spec.name).toBe("get_weather");
    expect(spec.description).toBe("Get the weather.");
    expect(spec.inputSchema.type).toBe("object");
    expect(spec.inputSchema.required).toEqual(["city"]);
  });

  it("passes validated input to execute", async () => {
    const seen: unknown[] = [];
    const t = tool({
      name: "echo",
      description: "Echo.",
      inputSchema: z.object({ value: z.string() }),
      execute: (input) => {
        seen.push(input);
        return input.value;
      },
    });
    const parsed = t.inputSchema.parse({ value: "hi" });
    expect(await t.execute(parsed, {} as never)).toBe("hi");
    expect(seen).toEqual([{ value: "hi" }]);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/tool.test.ts
Expected: FAIL, because `../src/tool/tool.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/logger.ts and its test**

```ts
export interface Logger {
  debug(message: string, ...args: readonly unknown[]): void;
  info(message: string, ...args: readonly unknown[]): void;
  warn(message: string, ...args: readonly unknown[]): void;
  error(message: string, ...args: readonly unknown[]): void;
}

/** The default logger. Silent, so the library is quiet unless asked not to be. */
export const noopLogger: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/** A logger that forwards to a console-like sink. Accepts the global console. */
export function consoleLogger(sink: Pick<Console, "debug" | "info" | "warn" | "error"> = console): Logger {
  return {
    debug: (message, ...args) => sink.debug(message, ...args),
    info: (message, ...args) => sink.info(message, ...args),
    warn: (message, ...args) => sink.warn(message, ...args),
    error: (message, ...args) => sink.error(message, ...args),
  };
}
```

and the test that pins the contract:

```ts
// packages/core/test/logger.test.ts
import { describe, expect, it } from "vitest";
import { consoleLogger, noopLogger } from "../src/logger.js";

type Sink = Pick<Console, "debug" | "info" | "warn" | "error">;

const recordingSink = (calls: unknown[][]): Sink => ({
  debug: (...args: unknown[]) => void calls.push(["debug", ...args]),
  info: (...args: unknown[]) => void calls.push(["info", ...args]),
  warn: (...args: unknown[]) => void calls.push(["warn", ...args]),
  error: (...args: unknown[]) => void calls.push(["error", ...args]),
});

describe("logger", () => {
  it("noopLogger swallows every level", () => {
    expect(() => {
      noopLogger.debug("d");
      noopLogger.info("i");
      noopLogger.warn("w");
      noopLogger.error("e");
    }).not.toThrow();
  });

  it("consoleLogger forwards each level to its sink method", () => {
    const calls: unknown[][] = [];
    const logger = consoleLogger(recordingSink(calls));
    logger.debug("d");
    logger.info("i");
    logger.warn("w");
    logger.error("e");
    expect(calls).toEqual([["debug", "d"], ["info", "i"], ["warn", "w"], ["error", "e"]]);
  });

  it("forwards extra arguments unchanged", () => {
    const calls: unknown[][] = [];
    const logger = consoleLogger(recordingSink(calls));
    logger.warn("retrying", 3, { id: "a" });
    expect(calls).toEqual([["warn", "retrying", 3, { id: "a" }]]);
  });
});
```

Run: pnpm vitest run packages/core/test/logger.test.ts
Expected: PASS, 3 tests.

- [ ] **Step 4: Write src/tool/tool.ts**

```ts
import { z } from "zod";
import type { ToolSpec } from "../model.js";
import type { Logger } from "../logger.js";

export class ToolDefinitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolDefinitionError";
  }
}

export interface ToolContext {
  readonly signal: AbortSignal;
  readonly fetch: typeof globalThis.fetch;
  readonly callId: string;
  readonly stepIndex: number;
  readonly logger: Logger;
}

export interface ToolDefinition<TIn extends z.ZodType, TOut = unknown> {
  /**
   * Defaults to the input schema's description when that description is itself a valid JavaScript
   * identifier. Set the name explicitly: it is what the model writes in generated code, it must be a
   * valid identifier, and a prose description almost never is — so treat the name as required.
   */
  name?: string;
  description: string;
  inputSchema: TIn;
  outputSchema?: z.ZodType<TOut>;
  execute: (input: z.infer<TIn>, ctx: ToolContext) => Promise<TOut> | TOut;
}

export interface Tool<TIn extends z.ZodType = z.ZodType, TOut = unknown>
  extends ToolDefinition<TIn, TOut> {
  readonly name: string;
  /** The provider-neutral advertisement handed to the model. */
  toSpec(): ToolSpec;
}

const IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/;

function resolveName(given: string | undefined, schema: z.ZodType): string | undefined {
  if (given !== undefined) return given;
  const description = schema.description;
  return description !== undefined && IDENTIFIER.test(description) ? description : undefined;
}

/**
 * Declare a tool. Schema-first by necessity: TypeScript types are erased at runtime, so
 * the contract must exist as a value (design spec section 8).
 */
export function tool<TIn extends z.ZodType, TOut = unknown>(
  definition: ToolDefinition<TIn, TOut>,
): Tool<TIn, TOut> {
  const name = resolveName(definition.name, definition.inputSchema);
  if (name === undefined || name === "") {
    throw new ToolDefinitionError(
      "Tool has no name: pass an explicit name, or set the input schema's description to a valid identifier.",
    );
  }
  if (!IDENTIFIER.test(name)) {
    throw new ToolDefinitionError(
      "Tool name must be a valid JavaScript identifier, got: " + name,
    );
  }
  return {
    ...definition,
    name,
    toSpec(): ToolSpec {
      // z.toJSONSchema emits "$schema" (which providers ignore or reject) and, in input mode, omits
      // "additionalProperties: false" (which strict OpenAI-style function schemas require). Normalise both
      // here, so the prompt, the wire format and validation all stay derived from one source. Note that
      // z.toJSONSchema throws on types JSON Schema cannot express, such as z.bigint().
      const jsonSchema = z.toJSONSchema(definition.inputSchema, { io: "input" }) as Record<string, unknown>;
      delete jsonSchema["$schema"];
      if (jsonSchema["type"] === "object" && jsonSchema["additionalProperties"] === undefined) {
        jsonSchema["additionalProperties"] = false;
      }
      return {
        name,
        description: definition.description,
        inputSchema: jsonSchema,
      };
    },
  };
}
```

- [ ] **Step 5: Run the tool test**

Run: pnpm vitest run packages/core/test/tool.test.ts
Expected: PASS, 6 tests.

If `z.toJSONSchema` is unavailable, the installed Zod is the wrong major: run `pnpm add zod@^4 -F @smolagents-ts/core` and
re-run. Do not hand-roll a converter; the dependency is already part of the design.

- [ ] **Step 6: Write the failing test for the registry**

```ts
// packages/core/test/registry.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolDefinitionError, tool } from "../src/tool/tool.js";
import { ToolRegistry } from "../src/tool/registry.js";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).optional(),
  }),
  execute: () => "sunny",
});

const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

describe("ToolRegistry", () => {
  it("starts empty", () => {
    expect(new ToolRegistry().size).toBe(0);
  });

  it("accepts tools in the constructor", () => {
    expect(new ToolRegistry([weather, add]).size).toBe(2);
  });

  it("looks tools up by name", () => {
    const registry = new ToolRegistry([weather]);
    expect(registry.get("get_weather")).toBe(weather);
    expect(registry.get("nope")).toBeUndefined();
    expect(registry.has("get_weather")).toBe(true);
  });

  it("rejects a duplicate name", () => {
    const registry = new ToolRegistry([weather]);
    expect(() => registry.add(weather)).toThrow(ToolDefinitionError);
  });

  it("lists every tool", () => {
    expect(new ToolRegistry([weather, add]).list().map((t) => t.name)).toEqual(["get_weather", "add"]);
  });

  it("renders every spec for the model", () => {
    const specs = new ToolRegistry([weather, add]).toSpecs();
    expect(specs.map((s) => s.name)).toEqual(["get_weather", "add"]);
  });

  it("renders readable descriptions, marking optional arguments", () => {
    const text = new ToolRegistry([weather]).renderDescriptions();
    expect(text).toContain("get_weather");
    expect(text).toContain("Get the current weather for a city.");
    expect(text).toMatch(/city\s*\(string, required\)/);
    expect(text).toMatch(/units\s*\(string, optional\)/);
  });

  it("renders an empty string when there are no tools", () => {
    expect(new ToolRegistry().renderDescriptions()).toBe("");
  });
});
```

- [ ] **Step 7: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/registry.test.ts
Expected: FAIL, because `../src/tool/registry.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 8: Write src/tool/registry.ts**

```ts
import type { ToolSpec } from "../model.js";
import { ToolDefinitionError, type Tool } from "./tool.js";

/**
 * The agent's tool set. Order is insertion order, which is the order the model sees,
 * so the prompt is stable across runs.
 */
export class ToolRegistry {
  private readonly byName = new Map<string, Tool>();

  constructor(tools: readonly Tool[] = []) {
    for (const entry of tools) this.add(entry);
  }

  add(entry: Tool): void {
    if (this.byName.has(entry.name)) {
      throw new ToolDefinitionError("Duplicate tool name: " + entry.name);
    }
    this.byName.set(entry.name, entry);
  }

  get(name: string): Tool | undefined {
    return this.byName.get(name);
  }

  has(name: string): boolean {
    return this.byName.has(name);
  }

  get size(): number {
    return this.byName.size;
  }

  list(): Tool[] {
    return [...this.byName.values()];
  }

  toSpecs(): ToolSpec[] {
    return this.list().map((entry) => entry.toSpec());
  }

  /**
   * Human-readable tool documentation for the system prompt. This is our analogue of upstream's
   * Tool.to_code_prompt() — same purpose, different shape. Upstream renders a callable
   * "def name(arg: type) -> ret:" signature; we render a bullet list with typed arguments derived from the
   * same JSON Schema the model receives, so the prompt and the wire format cannot drift.
   */
  renderDescriptions(): string {
    const lines: string[] = [];
    for (const entry of this.list()) {
      const spec = entry.toSpec();
      lines.push("- " + spec.name + ": " + spec.description);
      const properties = (spec.inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
      const required = new Set((spec.inputSchema.required ?? []) as string[]);
      const names = Object.keys(properties);
      if (names.length === 0) {
        lines.push("  Arguments: none");
        continue;
      }
      const rendered = names.map((name) => {
        const property = properties[name] ?? {};
        const type = describeType(property);
        const suffix = required.has(name) ? "required" : "optional";
        const description = typeof property.description === "string" ? ": " + property.description : "";
        return name + " (" + type + ", " + suffix + ")" + description;
      });
      lines.push("  Arguments: " + rendered.join(", "));
    }
    return lines.join("\n");
  }
}

function describeType(property: Record<string, unknown>): string {
  if (Array.isArray(property.enum)) {
    return property.enum.map((value) => JSON.stringify(value)).join(" | ");
  }
  const type = property.type;
  if (typeof type === "string") return type;
  if (Array.isArray(type)) return type.join(" | ");
  return "unknown";
}
```

- [ ] **Step 9: Run the registry test to verify it passes**

Run: pnpm vitest run packages/core/test/registry.test.ts
Expected: PASS, 8 tests.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/logger.ts packages/core/src/tool/tool.ts packages/core/src/tool/registry.ts packages/core/test/logger.test.ts packages/core/test/tool.test.ts packages/core/test/registry.test.ts
git commit -m "feat(core): add schema-first tools and the tool registry"
```

---

## Task 12: The CodeExecutor contract

**Files:**
- Create: packages/core/src/executor.ts
- Create: packages/core/src/testing/scripted-executor.ts
- Test: packages/core/test/scripted-executor.test.ts

This task defines the seam that S4 fills with QuickJS. S1 ships only a scripted double, which is what makes
the loop testable before any sandbox exists — and it proves the seam is genuinely swappable.

**Scope:** this task owns the *interface* only. The QuickJS implementation, the final_answer bridge and the
async tool-call bridge are S4 (design spec section 14); the design's S4 row lists implementations, not the
contract, which lands here.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/scripted-executor.test.ts
import { describe, expect, it } from "vitest";
import type { CodeResult } from "../src/executor.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { ToolRegistry } from "../src/tool/registry.js";

const options = () => ({
  tools: new ToolRegistry(),
  finalAnswer: { name: "final_answer", submit: () => undefined },
  signal: new AbortController().signal,
  timeoutMs: 1000,
  stepIndex: 0,
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
});

describe("ScriptedExecutor", () => {
  it("records the code it was asked to run", async () => {
    const executor = new ScriptedExecutor();
    await executor.execute("console.log(1)", options());
    expect(executor.executed).toEqual(["console.log(1)"]);
  });

  it("returns a non-final empty result by default", async () => {
    const result = await new ScriptedExecutor().execute("console.log(1)", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.logs).toBe("");
    expect(result.toolCallCount).toBe(0);
  });

  it("dispatches to a recorded result by exact code", async () => {
    const executor = new ScriptedExecutor({
      results: { "final_answer(4)": finalAnswerResult(4) },
    });
    const result = await executor.execute("final_answer(4)", options());
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe(4);
  });

  it("falls back to the handler for unrecorded code", async () => {
    const executor = new ScriptedExecutor({
      results: { known: finalAnswerResult(1) },
      handler: (code) => ({ logs: "ran " + code, isFinalAnswer: false, durationMs: 1, toolCallCount: 0 }),
    });
    const result = await executor.execute("unknown", options());
    expect(result.logs).toBe("ran unknown");
  });

  it("throws a helpful error for unrecorded code with no handler", async () => {
    const executor = new ScriptedExecutor({ results: { known: finalAnswerResult(1) } });
    await expect(executor.execute("unknown", options())).rejects.toThrow(/no scripted result/i);
  });

  it("defaults to JavaScript with async tool calls and no network", () => {
    const executor = new ScriptedExecutor();
    expect(executor.language).toBe("javascript");
    expect(executor.capabilities.asyncToolCalls).toBe(true);
    expect(executor.capabilities.network).toBe("host-mediated");
  });

  it("lets capabilities be overridden", () => {
    const executor = new ScriptedExecutor({ capabilities: { asyncToolCalls: false } });
    expect(executor.capabilities.asyncToolCalls).toBe(false);
  });

  it("records execution order across several calls", async () => {
    const executor = new ScriptedExecutor();
    await executor.execute("a", options());
    await executor.execute("b", options());
    expect(executor.executed).toEqual(["a", "b"]);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/scripted-executor.test.ts
Expected: FAIL, because `../src/executor.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/executor.ts**

```ts
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
```

- [ ] **Step 4: Write src/testing/scripted-executor.ts**

```ts
import type {
  CodeExecutor,
  CodeResult,
  ExecuteOptions,
  ExecutorCapabilities,
  ExecutorLanguage,
} from "../executor.js";

export type ScriptedHandler = (
  code: string,
  options: ExecuteOptions,
) => Promise<CodeResult> | CodeResult;

export interface ScriptedExecutorOptions {
  language?: ExecutorLanguage;
  /** Exact-code dispatch, checked before the handler. */
  results?: Record<string, CodeResult>;
  handler?: ScriptedHandler;
  capabilities?: Partial<ExecutorCapabilities>;
}

const DEFAULT_CAPABILITIES: ExecutorCapabilities = {
  language: "javascript",
  isolation: "none",
  asyncToolCalls: true,
  timers: true,
  network: "host-mediated",
};

/** The common case: the guest called final_answer. */
export function finalAnswerResult(value: unknown, logs = ""): CodeResult {
  return { logs, isFinalAnswer: true, value, durationMs: 0, toolCallCount: 0 };
}

/**
 * A deterministic executor double. Records what it ran and answers from a script, so the
 * whole agent loop can be tested without a sandbox (design spec section 11).
 */
export class ScriptedExecutor implements CodeExecutor {
  readonly language: ExecutorLanguage;
  readonly capabilities: ExecutorCapabilities;
  readonly executed: string[] = [];

  private readonly results: Record<string, CodeResult>;
  private readonly handler: ScriptedHandler | undefined;

  constructor(options: ScriptedExecutorOptions = {}) {
    this.language = options.language ?? "javascript";
    this.capabilities = {
      ...DEFAULT_CAPABILITIES,
      language: this.language,
      ...options.capabilities,
    };
    this.results = options.results ?? {};
    this.handler = options.handler;
  }

  execute(code: string, options: ExecuteOptions): Promise<CodeResult> {
    this.executed.push(code);
    const recorded = this.results[code];
    if (recorded !== undefined) return Promise.resolve(recorded);
    if (this.handler !== undefined) return Promise.resolve(this.handler(code, options));
    return Promise.reject(
      new Error("ScriptedExecutor has no scripted result for code: " + code),
    );
  }
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/scripted-executor.test.ts
Expected: PASS, 8 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/executor.ts packages/core/src/testing/scripted-executor.ts packages/core/test/scripted-executor.test.ts
git commit -m "feat(core): add the CodeExecutor contract and a scripted executor double"
```

---

## Task 13: Parsing the model's code blocks

**Files:**
- Create: packages/core/src/utils/parse-code-blocks.ts
- Test: packages/core/test/parse-code-blocks.test.ts

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/parse-code-blocks.test.ts
import { describe, expect, it } from "vitest";
import { CODE_FENCE } from "../src/prompts/templates.js";
import {
  extractCodeBlock,
  extractThought,
  hasFinalAnswerCall,
} from "../src/utils/parse-code-blocks.js";

const fenced = (body: string, language = "") =>
  "Thought: let me compute.\nCode:\n" + CODE_FENCE + language + "\n" + body + "\n" + CODE_FENCE;

describe("extractCodeBlock", () => {
  it("extracts a plain fenced block", () => {
    expect(extractCodeBlock(fenced("console.log(1)"))).toBe("console.log(1)");
  });

  it("extracts a block tagged with a language", () => {
    expect(extractCodeBlock(fenced("console.log(1)", "javascript"))).toBe("console.log(1)");
  });

  it("preserves interior blank lines and indentation", () => {
    const body = "if (true) {\n\n  console.log(1);\n}";
    expect(extractCodeBlock(fenced(body))).toBe(body);
  });

  it("returns null when there is no block", () => {
    expect(extractCodeBlock("Thought: nothing here.")).toBeNull();
  });

  it("takes the first block when several are present", () => {
    const text = fenced("first()") + "\n" + fenced("second()");
    expect(extractCodeBlock(text)).toBe("first()");
  });

  it("accepts an unterminated trailing block", () => {
    expect(extractCodeBlock("Code:\n" + CODE_FENCE + "\nconsole.log(1)")).toBe("console.log(1)");
  });

  it("ignores a fence that opens and closes empty", () => {
    expect(extractCodeBlock(CODE_FENCE + "\n" + CODE_FENCE)).toBe("");
  });

  it("honours a custom fence", () => {
    expect(extractCodeBlock("~~~\n1+1\n~~~", "~~~")).toBe("1+1");
  });
});

describe("extractThought", () => {
  it("strips the Thought: label", () => {
    expect(extractThought("Thought: because reasons\n" + fenced("x()"))).toBe("because reasons");
  });

  it("returns everything when there is no code block", () => {
    expect(extractThought("Just thinking.")).toBe("Just thinking.");
  });
});

describe("hasFinalAnswerCall", () => {
  it("detects a direct call", () => {
    expect(hasFinalAnswerCall("final_answer(42)")).toBe(true);
  });

  it("detects a call with whitespace and an await", () => {
    expect(hasFinalAnswerCall("await final_answer ( 42 )")).toBe(true);
  });

  it("does not match a mention inside a string", () => {
    expect(hasFinalAnswerCall('const s = "call final_answer() to finish";')).toBe(true);
  });

  it("returns false when there is no call", () => {
    expect(hasFinalAnswerCall("console.log(1)")).toBe(false);
  });

  it("does not match a property access like my.final_answer", () => {
    expect(hasFinalAnswerCall("obj.final_answer(1)")).toBe(false);
  });
});
```

Note: the third `hasFinalAnswerCall` case documents a known and accepted limitation — a call inside a string
literal is a false positive. The executor's `finalAnswer.submit` is the authority: if the guest never calls
it, the step is simply not final. A false positive here only affects labelling, never correctness. If you
prefer, tighten it later with a real tokenizer; do not build one now.

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/parse-code-blocks.test.ts
Expected: FAIL, because `../src/utils/parse-code-blocks.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/utils/parse-code-blocks.ts**

```ts
import { CODE_FENCE } from "../prompts/templates.js";

/**
 * Extract the first fenced code block from model output.
 *
 * Line-based rather than regex-based: a regex that is permissive enough to accept an
 * unterminated trailing block is hard to reason about, and upstream's behaviour here is
 * "the first block wins, and a block may be the whole tail of the message".
 */
export function extractCodeBlock(text: string, fence: string = CODE_FENCE): string | null {
  const lines = text.split("\n");
  const collected: string[] = [];
  let inside = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!inside) {
      if (trimmed.startsWith(fence)) {
        inside = true;
      }
      continue;
    }
    if (trimmed.startsWith(fence)) {
      return collected.join("\n");
    }
    collected.push(line);
  }

  return collected.length > 0 ? collected.join("\n") : null;
}

/** The reasoning the model wrote before its code block. */
export function extractThought(text: string, fence: string = CODE_FENCE): string {
  const index = text.indexOf(fence);
  const head = index === -1 ? text : text.slice(0, index);
  return head.replace(/^\s*Thought:\s*/i, "").trim();
}

/**
 * Whether the code appears to call final_answer. Advisory only: the authoritative
 * signal is CodeExecutor having actually invoked the final-answer sink.
 */
export function hasFinalAnswerCall(code: string, name = "final_answer"): boolean {
  const escaped = name.replace(/[.*+?^`{}()|[\]\\]/g, "\\$&");
  return new RegExp("(^|[^A-Za-z0-9_.$])" + escaped + "\\s*\\(").test(code);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/parse-code-blocks.test.ts
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/parse-code-blocks.ts packages/core/test/parse-code-blocks.test.ts
git commit -m "feat(core): add code block, thought and final-answer parsing"
```

---

## Task 14: Action types and agent middleware

**Files:**
- Create: packages/core/src/agent/action.ts
- Create: packages/core/src/middleware.ts
- Test: packages/core/test/middleware.test.ts
- Edit: docs/design/2026-10-12-smolagents-ts-v1-design.md (section 5.5(a)’s prose and its missing S1.5 sentence — see Step 6)

**Design note (a real decision, recorded here):** middleware wraps the **action execution** phase as an
async-generator chain, not the whole step. That is what keeps it live — a middleware can observe or inject
events as they pass, because it uses `yield* next()` rather than `await next()`. Wrapping the model phase
too is an S1.5 extension, once the shape has real users. This is a deliberate narrowing of design spec 5.5(a),
and the spec should be amended to match.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/middleware.test.ts
import { describe, expect, it } from "vitest";
import type { ActionOutcome } from "../src/agent/action.js";
import type { AgentEvent } from "../src/events.js";
import { type MiddlewareContext, composeMiddleware } from "../src/middleware.js";
import { AgentMemory } from "../src/memory/memory.js";
import { ActionStep } from "../src/memory/steps.js";

function context(): MiddlewareContext {
  return {
    runId: "run-1",
    task: "task",
    stepIndex: 0,
    step: new ActionStep("raw"),
    signal: new AbortController().signal,
    logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
    memory: new AgentMemory(),
    state: new Map<string, unknown>(),
  };
}

async function* terminal(): AsyncGenerator<AgentEvent, ActionOutcome> {
  yield { type: "step.started", stepIndex: 0 };
  yield { type: "logs.appended", stepIndex: 0, text: "hello" };
  return { observations: "hello", isFinalAnswer: false };
}

async function drain(gen: AsyncGenerator<AgentEvent, ActionOutcome>) {
  const events: AgentEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, outcome: next.value };
}

describe("composeMiddleware", () => {
  it("calls the terminal when there is no middleware", async () => {
    const composed = composeMiddleware([])(context(), terminal);
    const { events, outcome } = await drain(composed);
    expect(events).toHaveLength(2);
    expect(outcome.observations).toBe("hello");
  });

  it("runs middleware as an onion, before and after", async () => {
    const order: string[] = [];
    const tag = (name: string) => async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      order.push("before " + name);
      const outcome = yield* next();
      order.push("after " + name);
      return outcome;
    };
    const composed = composeMiddleware([tag("outer"), tag("inner")])(context(), terminal);
    await drain(composed);
    expect(order).toEqual(["before outer", "before inner", "after inner", "after outer"]);
  });

  it("lets a middleware observe every event as it passes", async () => {
    const seen: string[] = [];
    const tap = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      for await (const event of next()) {
        seen.push(event.type);
        yield event;
      }
      return { observations: "intercepted", isFinalAnswer: false };
    };
    const composed = composeMiddleware([tap])(context(), terminal);
    const { events } = await drain(composed);
    expect(seen).toEqual(["step.started", "logs.appended"]);
    expect(events.map((e) => e.type)).toEqual(["step.started", "logs.appended"]);
  });

  it("lets a middleware short-circuit without calling next", async () => {
    const veto = async function* (): AsyncGenerator<AgentEvent, ActionOutcome> {
      return { observations: "blocked by policy", isFinalAnswer: false };
    };
    const composed = composeMiddleware([veto])(context(), terminal);
    const { events, outcome } = await drain(composed);
    expect(events).toEqual([]);
    expect(outcome.observations).toBe("blocked by policy");
  });

  it("lets a middleware rewrite the outcome", async () => {
    const rewrite = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      const outcome = yield* next();
      return { ...outcome, observations: outcome.observations.toUpperCase() };
    };
    const composed = composeMiddleware([rewrite])(context(), terminal);
    const { outcome } = await drain(composed);
    expect(outcome.observations).toBe("HELLO");
  });

  it("throws when a middleware calls next twice", async () => {
    const greedy = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      await drain(next());
      return yield* next();
    };
    const composed = composeMiddleware([greedy])(context(), terminal);
    await expect(drain(composed)).rejects.toThrow(/twice/i);
  });

  it("shares one state map across the chain", async () => {
    const writer = async function* (
      ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      ctx.state.set("cost", 42);
      return yield* next();
    };
    const reader = async function* (
      ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      expect(ctx.state.get("cost")).toBe(42);
      return yield* next();
    };
    const composed = composeMiddleware([writer, reader])(context(), terminal);
    await drain(composed);
  });

  it("propagates an error thrown by the terminal", async () => {
    const boom = async function* (): AsyncGenerator<AgentEvent, ActionOutcome> {
      throw new Error("executor exploded");
      // eslint-disable-next-line no-unreachable
      yield { type: "run.cancelled" };
    };
    const composed = composeMiddleware([])(context(), boom);
    await expect(drain(composed)).rejects.toThrow("executor exploded");
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/middleware.test.ts
Expected: FAIL, because `../src/agent/action.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/agent/action.ts**

```ts
import type { AgentErrorInfo } from "../errors.js";
import type { ToolCallRequest } from "../model.js";

/**
 * The name the guest or the model calls to end the run. It lives here, in the lowest-level
 * module both agent flavours already import, so exactly one binding for it exists in the
 * package. A second declaration would make the public star-export ambiguous.
 */
export const FINAL_ANSWER_TOOL_NAME = "final_answer";

/** What the agent decided to do with one model response. */
export interface InterpretedAction {
  kind: "final" | "code" | "toolcalls" | "empty";
  /** The raw model text, kept for the ActionStep and for debugging. */
  raw: string;
  /** Set when kind is "final". */
  output?: unknown;
  /** Set when kind is "code". */
  code?: string;
  /** Set when kind is "toolcalls". */
  calls?: ToolCallRequest[];
}

/** The result of executing one action. */
export interface ActionOutcome {
  /** Everything the guest printed, plus any error text. Becomes the Observation. */
  observations: string;
  isFinalAnswer: boolean;
  /** Set when isFinalAnswer is true. */
  value?: unknown;
  error?: AgentErrorInfo;
}
```

- [ ] **Step 4: Write src/middleware.ts**

```ts
import type { ActionOutcome } from "./agent/action.js";
import type { AgentEvent } from "./events.js";
import type { Logger } from "./logger.js";
import type { AgentMemory } from "./memory/memory.js";
import type { AnyAgentStep } from "./memory/steps.js";

/** Everything a middleware may read about the step it is wrapping. */
export interface MiddlewareContext {
  readonly runId: string;
  readonly task: string;
  readonly stepIndex: number;
  readonly step: AnyAgentStep;
  readonly signal: AbortSignal;
  readonly logger: Logger;
  readonly memory: AgentMemory;
  /** Per-run scratch space, shared by every middleware in the chain. */
  readonly state: Map<string, unknown>;
}

/**
 * Wraps action execution. Return the terminal's outcome, or your own to short-circuit.
 *
 * Use yield* next() rather than awaiting a promise: that is what lets a middleware
 * observe, filter, or inject events while they are still flowing.
 */
export type AgentMiddleware = (
  ctx: MiddlewareContext,
  next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
) => AsyncGenerator<AgentEvent, ActionOutcome>;

export type TerminalAction = () => AsyncGenerator<AgentEvent, ActionOutcome>;

/**
 * Koa-style composition over async generators. Calling next() twice within one
 * middleware is a programming error and throws.
 */
export function composeMiddleware(
  middleware: readonly AgentMiddleware[],
): (ctx: MiddlewareContext, terminal: TerminalAction) => AsyncGenerator<AgentEvent, ActionOutcome> {
  return (ctx, terminal) => {
    let lastIndex = -1;
    const dispatch = (index: number): AsyncGenerator<AgentEvent, ActionOutcome> => {
      if (index <= lastIndex) {
        throw new Error("next() called twice inside a single middleware");
      }
      lastIndex = index;
      const current = middleware[index];
      return current === undefined ? terminal() : current(ctx, () => dispatch(index + 1));
    };
    return dispatch(0);
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/middleware.test.ts
Expected: PASS, 8 tests.

- [ ] **Step 6: Confirm the design spec matches (amend it if it does not)**

**MEASURED against the document as this plan was written**: section 5.5(a) of
`docs/design/2026-10-12-smolagents-ts-v1-design.md` already carries the generator `AgentMiddleware` signature
(`next: () => AsyncGenerator<void, void, void>`) and a `yield* next()` comment, but it is still wrong in two ways that
a search for the literal string `next: () => Promise<void>` would never find — that string appears nowhere in the
file. Fix both:

1. Its prose says "Onion semantics (`await next()` around the step), like Koa", contradicting the generator signature
   two lines above it. Replace that clause with the generator form (`yield* next()`).
2. The narrowing sentence "Middleware wraps action execution; wrapping the model phase is an S1.5 extension." does not
   appear anywhere in the file — add it to 5.5(a). This is the sentence that makes S1's definition-of-done item 9 true.

Verify by measurement, not by impression:

```powershell
Select-String -Path docs/design/2026-10-12-smolagents-ts-v1-design.md -Pattern 'await next'   # must print nothing
Select-String -Path docs/design/2026-10-12-smolagents-ts-v1-design.md -Pattern 'yield\* next'  # must match the prose
Select-String -Path docs/design/2026-10-12-smolagents-ts-v1-design.md -Pattern 'wrapping the model phase'  # must match
```

```bash
git add docs/design/2026-10-12-smolagents-ts-v1-design.md
git commit -m "docs: record the generator form of agent middleware"
```

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/agent/action.ts packages/core/src/middleware.ts packages/core/test/middleware.test.ts
git commit -m "feat(core): add action types and generator-based agent middleware"
```

---

## Task 15: MultiStepAgent — the ReAct loop

**Files:**
- Edit: packages/core/src/errors.ts (add `AgentError.fromInfo`)
- Create: packages/core/src/agent/multi-step-agent.ts
- Test: packages/core/test/multi-step-agent.test.ts

This is the heart of the port. Everything before it exists to make it testable.

**Why `fromInfo` first:** errors travel through events as plain data, so the base class must be able to turn
an `AgentErrorInfo` back into a throwable without knowing which subclass it came from.

- [ ] **Step 1: Add AgentError.fromInfo**

Append to `packages/core/src/errors.ts`, inside the `AgentError` class, directly after `static from`:

```ts
  /** Rebuild a throwable from the plain-data form that travels in events. */
  static fromInfo(info: AgentErrorInfo): AgentError {
    const error = new AgentError(info.message, {
      code: info.code as AgentErrorCode,
      stepIndex: info.stepIndex,
      cause: info.cause,
    });
    error.name = info.name;
    return error;
  }
```

- [ ] **Step 2: Write the failing test**

```ts
// packages/core/test/multi-step-agent.test.ts
import { describe, expect, it } from "vitest";
import type { InterpretedAction } from "../src/agent/action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "../src/agent/multi-step-agent.js";
import { AgentCancelledError, AgentMaxStepsError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import type { ActionOutcome } from "../src/agent/action.js";
import type { CodeExecutor } from "../src/executor.js";
import type { ChatCompletion } from "../src/model.js";
import { ActionStep } from "../src/memory/steps.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { extractCodeBlock } from "../src/utils/parse-code-blocks.js";

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

class TestAgent extends MultiStepAgent<string> {
  constructor(
    private readonly executor: CodeExecutor,
    options: AgentOptions,
  ) {
    super(options);
  }

  protected override buildSystemPrompt(): string {
    return "You are a test agent.";
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const code = extractCodeBlock(completion.content);
    if (code === null) return { kind: "empty", raw: completion.content };
    return { kind: "code", raw: completion.content, code };
  }

  protected override async *executeAction(
    action: InterpretedAction,
    _step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    if (action.code === undefined) return { observations: "", isFinalAnswer: false };
    const result = await this.executor.execute(action.code, {
      tools: this.tools,
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: context.signal,
      timeoutMs: this.executionTimeoutMs,
      stepIndex: context.stepIndex,
      logger: this.logger,
    });
    return {
      observations: result.logs,
      isFinalAnswer: result.isFinalAnswer,
      value: result.value,
      error: result.error,
    };
  }
}

function buildAgent(options: {
  responses: string[];
  results?: Record<string, ReturnType<typeof finalAnswerResult>>;
  agent?: Partial<AgentOptions>;
}) {
  const model = new MockModel(options.responses);
  const executor = new ScriptedExecutor({ results: options.results ?? {} });
  const agent = new TestAgent(executor, { model, ...options.agent });
  return { model, executor, agent };
}

async function collect(agent: TestAgent, task: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return events;
}

function types(events: AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

describe("MultiStepAgent", () => {
  it("runs one action, then finishes on the executor's final answer", async () => {
    const { agent } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "computing", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4, "answered"),
      },
    });
    const result = await agent.run("What is 2 + 2?");
    expect(result.output).toBe(4);
    expect(result.state).toBe("success");
    expect(result.steps.filter((step) => step.kind === "action")).toHaveLength(2);
  });

  it("emits the documented event sequence", async () => {
    const { agent } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "computing", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4, "answered"),
      },
    });
    const events = await collect(agent, "Q");
    expect(types(events)).toEqual([
      "run.started",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "run.completed",
    ]);
  });

  it("records the task and the system prompt in memory, in order", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")], results: { "final_answer(1)": finalAnswerResult(1) } });
    const result = await agent.run("the task");
    expect(result.steps[0]?.kind).toBe("task");
    expect(result.steps[1]?.kind).toBe("system_prompt");
    expect(result.messages[0]).toEqual({ role: "system", content: "You are a test agent." });
    expect(result.messages[1]).toEqual({ role: "user", content: "the task" });
  });

  it("feeds each observation back into the next transcript", async () => {
    const { agent, model } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "42", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4),
      },
    });
    await agent.run("Q");
    const secondTranscript = model.calls[1] ?? [];
    expect(secondTranscript.at(-1)).toEqual({ role: "user", content: "Observation:\n42" });
  });

  it("answers directly when the model calls final_answer in its first action", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(7)")], results: { "final_answer(7)": finalAnswerResult(7) } });
    const events = await collect(agent, "Q");
    expect(types(events).filter((type) => type === "step.started")).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("stops at maxSteps and reports it", async () => {
    const { agent } = buildAgent({
      responses: [fenced("a()"), fenced("b()")],
      results: {
        "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
        "b()": { logs: "b", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
      },
      agent: { maxSteps: 2 },
    });
    const events = await collect(agent, "Q");
    expect(events.at(-1)).toEqual({ type: "run.maxStepsReached", steps: 2 });
  });

  it("throws AgentMaxStepsError from run()", async () => {
    const { agent } = buildAgent({
      responses: [fenced("a()")],
      results: { "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 } },
      agent: { maxSteps: 1 },
    });
    await expect(agent.run("Q")).rejects.toBeInstanceOf(AgentMaxStepsError);
  });

  it("turns a model reply with no code block into an observation and keeps going", async () => {
    const { agent } = buildAgent({
      responses: ["I am only thinking out loud.", fenced("final_answer(3)")],
      results: { "final_answer(3)": finalAnswerResult(3) },
    });
    const events = await collect(agent, "Q");
    const observation = events.find((event) => event.type === "observation.completed");
    expect(observation).toMatchObject({ isFinalAnswer: false });
    expect((observation as { text: string }).text).toMatch(/no action found/i);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("cancels before the first step when the signal is already aborted", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")] });
    const controller = new AbortController();
    controller.abort();
    const events: AgentEvent[] = [];
    for await (const event of agent.stream("Q", { signal: controller.signal })) events.push(event);
    expect(types(events)).toEqual(["run.started", "run.cancelled"]);
  });

  it("throws AgentCancelledError from run() when aborted mid-run", async () => {
    const controller = new AbortController();
    const { agent } = buildAgent({
      responses: [fenced("a()"), fenced("final_answer(1)")],
      results: { "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 } },
      agent: { middleware: [attachingAbort(controller)] },
    });
    await expect(agent.run("Q", { signal: controller.signal })).rejects.toBeInstanceOf(AgentCancelledError);
  });

  it("accumulates token usage across steps", async () => {
    const model = new MockModel([
      { content: fenced("a()"), usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } },
      { content: fenced("final_answer(1)"), usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 } },
    ]);
    const executor = new ScriptedExecutor({
      results: {
        "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
        "final_answer(1)": finalAnswerResult(1),
      },
    });
    const agent = new TestAgent(executor, { model });
    const result = await agent.run("Q");
    expect(result.tokenUsage).toEqual({ inputTokens: 30, outputTokens: 5, totalTokens: 35 });
  });

  it("surfaces an executor-reported error as an observation and keeps going", async () => {
    const { agent } = buildAgent({
      responses: [fenced("boom()"), fenced("final_answer(1)")],
      results: {
        "boom()": {
          logs: "ReferenceError: boom is not defined",
          isFinalAnswer: false,
          error: {
            name: "AgentExecutionError",
            message: "ReferenceError: boom is not defined",
            code: "AGENT_EXECUTION",
            stepIndex: 0,
          },
          durationMs: 0,
          toolCallCount: 0,
        },
        "final_answer(1)": finalAnswerResult(1),
      },
    });
    const events = await collect(agent, "Q");
    expect(types(events).at(-1)).toBe("run.completed");
    const observation = events.find((event) => event.type === "observation.completed");
    expect((observation as { text: string }).text).toMatch(/boom is not defined/);
  });

  it("fails the run when the executor itself throws, not when guest code throws", async () => {
    const { agent } = buildAgent({ responses: [fenced("boom()")], results: {} });
    const events = await collect(agent, "Q");
    expect(types(events).at(-1)).toBe("run.failed");
  });

  it("lets middleware veto an action and inject its own outcome", async () => {
    const { agent, executor } = buildAgent({
      responses: [fenced("a()"), fenced("final_answer(1)")],
      results: { "final_answer(1)": finalAnswerResult(1) },
      agent: {
        middleware: [
          async function* (ctx, next) {
            // Veto the first action only. Never calling next() means the executor never sees it.
            if (ctx.stepIndex === 0) {
              return { observations: "blocked by policy", isFinalAnswer: false };
            }
            return yield* next();
          },
        ],
      },
    });
    const events = await collect(agent, "Q");
    expect(executor.executed).toEqual(["final_answer(1)"]);
    expect(events.some((event) => event.type === "observation.completed" && event.text === "blocked by policy")).toBe(true);
  });

  it("notifies on() listeners, and stops after unsubscribe", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")] });
    const seen: string[] = [];
    const off = agent.on((event) => seen.push(event.type));
    await agent.run("Q");
    expect(seen).toEqual([
      "run.started",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "run.completed",
    ]);
    off();
    seen.length = 0;
    await expect(agent.run("Q")).rejects.toThrow();
    expect(seen).toEqual([]);
  });

  it("returns a complete RunResult", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")], results: { "final_answer(1)": finalAnswerResult(1) } });
    const result = await agent.run("Q");
    expect(result.runId).toMatch(/[0-9a-f-]{36}/);
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.state).toBe("success");
    expect(result.steps.length).toBeGreaterThan(2);
  });
});

function attachingAbort(controller: AbortController) {
  return async function* (
    _ctx: unknown,
    next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    controller.abort();
    return yield* next();
  } as never;
}
```

- [ ] **Step 3: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/multi-step-agent.test.ts
Expected: FAIL, because `../src/agent/multi-step-agent.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 4: Write src/agent/multi-step-agent.ts**

```ts
import {
  AgentCancelledError,
  AgentError,
  AgentMaxStepsError,
  AgentParsingError,
} from "../errors.js";
import type { AgentEvent } from "../events.js";
import type { CodeExecutor } from "../executor.js";
import { type Logger, noopLogger } from "../logger.js";
import { AgentMemory } from "../memory/memory.js";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from "../memory/steps.js";
import { type AgentMiddleware, type MiddlewareContext, composeMiddleware } from "../middleware.js";
import type { ChatCompletion, Model } from "../model.js";
import { Monitor } from "../monitoring/monitor.js";
import { ToolRegistry } from "../tool/registry.js";
import type { Tool } from "../tool/tool.js";
import { type ChatMessage, type TokenUsage, EMPTY_TOKEN_USAGE, addTokenUsage } from "../types.js";
import { makeRunResult, type RunResult, type RunState } from "./run-result.js";
import type { ActionOutcome, InterpretedAction } from "./action.js";

export interface AgentOptions {
  model: Model;
  tools?: readonly Tool[] | ToolRegistry;
  /** Hard cap on action steps. Defaults to 20. */
  maxSteps?: number;
  /** Emit a planning step every N steps. 0 disables planning. Defaults to 0. */
  planningInterval?: number;
  /** Wall-clock budget handed to the executor for one action. Defaults to 30000. */
  executionTimeoutMs?: number;
  logger?: Logger;
  customInstructions?: string;
  /** Overrides the subclass-built prompt entirely. */
  systemPrompt?: string;
  middleware?: readonly AgentMiddleware[];
}

export interface RunOptions {
  signal?: AbortSignal;
}

/** Mutable per-run bookkeeping, handed to subclasses so they can execute an action. */
export interface RunContext {
  readonly runId: string;
  readonly task: string;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly state: Map<string, unknown>;
  usage: TokenUsage;
  stepIndex: number;
}

export type AgentEventListener = (event: AgentEvent) => void;

const PLANNING_INSTRUCTION =
  "Before you continue, write a short numbered plan for the remaining work. Reply with the plan only.";

/**
 * The ReAct loop, shared by every agent flavour (design spec 6.2).
 *
 * Subclasses supply exactly three things: the system prompt, how to read a model reply,
 * and how to execute the action it names. Everything else — memory, events, accounting,
 * cancellation, middleware — lives here so it cannot drift between flavours.
 */
export abstract class MultiStepAgent<TOut = unknown> {
  readonly model: Model;
  readonly tools: ToolRegistry;
  readonly maxSteps: number;
  readonly planningInterval: number;
  readonly executionTimeoutMs: number;
  protected readonly logger: Logger;
  protected readonly memory = new AgentMemory();
  protected monitor: Monitor;

  private readonly middleware: readonly AgentMiddleware[];
  private readonly customInstructions: string | undefined;
  private readonly explicitSystemPrompt: string | undefined;
  private readonly listeners = new Set<AgentEventListener>();

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.tools =
      options.tools instanceof ToolRegistry ? options.tools : new ToolRegistry(options.tools ?? []);
    this.maxSteps = options.maxSteps ?? 20;
    this.planningInterval = options.planningInterval ?? 0;
    this.executionTimeoutMs = options.executionTimeoutMs ?? 30_000;
    this.logger = options.logger ?? noopLogger;
    this.middleware = options.middleware ?? [];
    this.customInstructions = options.customInstructions;
    this.explicitSystemPrompt = options.systemPrompt;
    this.monitor = new Monitor();
  }

  protected get customInstructionsValue(): string | undefined {
    return this.customInstructions;
  }

  /** The prompt sent on every turn. Computed once per access so tools stay in sync. */
  get systemPrompt(): string {
    return this.explicitSystemPrompt ?? this.buildSystemPrompt();
  }

  /** Subscribe to every event. Returns an unsubscribe function. Mirrors design spec 6.4. */
  on(listener: AgentEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Whether to use the streaming path when the model supports it. */
  protected get prefersStreaming(): boolean {
    return true;
  }

  protected abstract buildSystemPrompt(): string;

  /** Read the model's reply. This is where the two agent flavours diverge. */
  protected abstract interpret(completion: ChatCompletion): InterpretedAction;

  /** Execute the action. Yield events as they happen; return the observation. */
  protected abstract executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome>;

  /** Drain the stream and return the result, throwing if the run did not succeed. */
  async run(task: string, options: RunOptions = {}): Promise<RunResult<TOut>> {
    let completed: RunResult<TOut> | undefined;
    let failure: AgentError | undefined;
    for await (const event of this.stream(task, options)) {
      switch (event.type) {
        case "run.completed":
          completed = event.result as RunResult<TOut>;
          break;
        case "run.failed":
          failure = AgentError.fromInfo(event.error);
          break;
        case "run.cancelled":
          failure = new AgentCancelledError("The run was cancelled");
          break;
        case "run.maxStepsReached":
          failure = new AgentMaxStepsError(
            "Reached the maximum number of steps (" + String(event.steps) + ")",
          );
          break;
        default:
          break;
      }
    }
    if (failure !== undefined) throw failure;
    if (completed === undefined) {
      throw new AgentError("The run ended without a terminal event");
    }
    return completed;
  }

  /**
   * The async source of truth for a run (design spec 6.3). Deltas are advisory;
   * run.completed, run.failed, run.maxStepsReached and run.cancelled are terminal.
   */
  async *stream(task: string, options: RunOptions = {}): AsyncGenerator<AgentEvent, void> {
    const runId = crypto.randomUUID();
    const signal = options.signal ?? new AbortController().signal;
    const context: RunContext = {
      runId,
      task,
      signal,
      startedAt: Date.now(),
      state: new Map<string, unknown>(),
      usage: EMPTY_TOKEN_USAGE,
      stepIndex: 0,
    };

    this.memory.reset();
    this.memory.addStep(new TaskStep(task));
    this.memory.addStep(new SystemPromptStep(this.systemPrompt));
    this.monitor = new Monitor(context.startedAt);

    yield this.emit({ type: "run.started", runId, task, modelId: this.model.id });

    if (signal.aborted) {
      yield this.emit({ type: "run.cancelled" });
      return;
    }

    for (let stepIndex = 0; stepIndex < this.maxSteps; stepIndex += 1) {
      context.stepIndex = stepIndex;

      if (signal.aborted) {
        yield this.emit({ type: "run.cancelled" });
        return;
      }

      if (this.planningInterval > 0 && stepIndex > 0 && stepIndex % this.planningInterval === 0) {
        const planning = yield* this.runPlanningStep(stepIndex, context);
        if ("cancelled" in planning) {
          yield this.emit({ type: "run.cancelled" });
          return;
        }
        if ("failed" in planning) {
          yield this.emit({ type: "run.failed", error: planning.failed.info });
          return;
        }
      }

      yield this.emit({ type: "step.started", stepIndex });

      let completion: ChatCompletion;
      try {
        completion = yield* this.streamCompletion(
          this.memory.toMessages({ systemPrompt: this.systemPrompt }),
          stepIndex,
          context,
          "action",
        );
      } catch (error) {
        yield this.emit({ type: "run.failed", error: AgentError.from(error, "AGENT_GENERATION", stepIndex).info });
        return;
      }

      yield this.emit({ type: "message.completed", text: completion.content });

      const action = this.interpret(completion);
      const step = new ActionStep(action.raw);
      step.tokenUsage = completion.usage;
      step.toolCalls = [...completion.toolCalls];

      if (action.kind === "final") {
        this.memory.addStep(new FinalAnswerStep(action.output));
        yield this.emit({
          type: "run.completed",
          result: this.buildResult(action.output, context, "success"),
        });
        return;
      }

      if (action.code !== undefined) {
        step.codeAction = action.code;
        yield this.emit({ type: "code.completed", stepIndex, code: action.code });
      }

      this.memory.addStep(step);

      if (action.kind === "empty") {
        const parsingError = new AgentParsingError(
          "No action found in the response. Reply with a code block that computes the answer and calls final_answer.",
          { stepIndex },
        );
        step.error = parsingError.info;
        step.observations = parsingError.message;
        yield this.emit({
          type: "observation.completed",
          stepIndex,
          text: parsingError.message,
          isFinalAnswer: false,
        });
        continue;
      }

      let outcome: ActionOutcome;
      try {
        outcome = yield* this.drainAction(this.composeAction(context, step, stepIndex, action));
      } catch (error) {
        const executionError = AgentError.from(error, "AGENT_EXECUTION", stepIndex);
        step.error = executionError.info;
        yield this.emit({ type: "run.failed", error: executionError.info });
        return;
      }

      if (outcome.error !== undefined) step.error = outcome.error;
      step.observations = outcome.observations;
      step.isFinalAnswer = outcome.isFinalAnswer;

      yield this.emit({
        type: "observation.completed",
        stepIndex,
        text: outcome.observations,
        isFinalAnswer: outcome.isFinalAnswer,
      });

      if (outcome.isFinalAnswer) {
        this.memory.addStep(new FinalAnswerStep(outcome.value));
        yield this.emit({
          type: "run.completed",
          result: this.buildResult(outcome.value, context, "success"),
        });
        return;
      }
    }

    yield this.emit({ type: "run.maxStepsReached", steps: this.maxSteps });
  }

  private composeAction(
    context: RunContext,
    step: ActionStep,
    stepIndex: number,
    action: InterpretedAction,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    const middlewareContext: MiddlewareContext = {
      runId: context.runId,
      task: context.task,
      stepIndex,
      step,
      signal: context.signal,
      logger: this.logger,
      memory: this.memory,
      state: context.state,
    };
    return composeMiddleware(this.middleware)(middlewareContext, () =>
      this.executeAction(action, step, context),
    );
  }

  /** Re-emit everything a composed generator produces so listeners and yielders agree. */
  private async *drainAction(
    composed: AsyncGenerator<AgentEvent, ActionOutcome>,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    let next = await composed.next();
    while (!next.done) {
      yield this.emit(next.value);
      next = await composed.next();
    }
    return next.value;
  }

  private async *runPlanningStep(
    stepIndex: number,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, { ok: true } | { cancelled: true } | { failed: AgentError }> {
    yield this.emit({ type: "planning.started", stepIndex });
    const messages = this.memory.toMessages({ systemPrompt: this.systemPrompt });
    messages.push({ role: "user", content: PLANNING_INSTRUCTION });
    try {
      const completion = yield* this.streamCompletion(messages, stepIndex, context, "planning");
      const step = new PlanningStep(completion.content);
      step.tokenUsage = completion.usage;
      this.memory.addStep(step);
      yield this.emit({ type: "planning.completed", stepIndex, text: completion.content });
      return { ok: true };
    } catch (error) {
      return { failed: AgentError.from(error, "AGENT_GENERATION", stepIndex) };
    }
  }

  /**
   * One model turn. Deltas are emitted as they arrive; the authoritative completion is
   * returned, never reconstructed from deltas by the caller.
   */
  private async *streamCompletion(
    messages: readonly ChatMessage[],
    stepIndex: number,
    context: RunContext,
    kind: "action" | "planning",
  ): AsyncGenerator<AgentEvent, ChatCompletion> {
    if (this.prefersStreaming && this.model.capabilities.streaming) {
      let text = "";
      for await (const chunk of this.model.generateStream(messages, { signal: context.signal })) {
        if (chunk.delta === "") continue;
        text += chunk.delta;
        yield kind === "planning"
          ? { type: "planning.delta", stepIndex, text: chunk.delta }
          : { type: "message.delta", text: chunk.delta };
      }
      // ChatCompletionChunk carries no usage, so the running total is unchanged. Emit anyway,
      // so consumers have one invariant: exactly one usage.updated per model turn.
      yield { type: "usage.updated", usage: context.usage };
      return { content: text, toolCalls: [], usage: EMPTY_TOKEN_USAGE, finishReason: "stop" };
    }

    const startedAt = Date.now();
    const completion = await this.model.generate(messages, { signal: context.signal });
    if (completion.content !== "") {
      yield kind === "planning"
        ? { type: "planning.delta", stepIndex, text: completion.content }
        : { type: "message.delta", text: completion.content };
    }
    this.monitor.record(this.model.id, completion.usage, Date.now() - startedAt);
    context.usage = addTokenUsage(context.usage, completion.usage);
    yield { type: "usage.updated", usage: context.usage };
    return completion;
  }

  private buildResult(output: unknown, context: RunContext, state: RunState): RunResult<TOut> {
    return makeRunResult<TOut>({
      runId: context.runId,
      output: output as TOut,
      steps: this.memory.steps,
      messages: this.memory.toMessages({ systemPrompt: this.systemPrompt }),
      start: context.startedAt,
      end: Date.now(),
      tokenUsage: context.usage,
      state,
    });
  }

  private emit(event: AgentEvent): AgentEvent {
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (error) {
        this.logger.warn("An agent event listener threw", error);
      }
    }
    return event;
  }
}
```

**Why `usage.updated` appears even when nothing changed:** `ChatCompletionChunk` carries no usage, so a streamed
turn cannot add to the running total, and the streaming branch emits `usage.updated` with the *unchanged* total.
Consumers then have one invariant instead of two: exactly one `usage.updated` per model turn. When S3 lands real
adapters, revisit whether `ChatCompletionChunk` should carry an optional usage field; reporting zero is correct
today, and guessing would not be.

- [ ] **Step 5: Run the typecheck and the test**

Run: pnpm typecheck
Expected: exit 0.

Run: pnpm vitest run packages/core/test/multi-step-agent.test.ts
Expected: PASS, 16 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/errors.ts packages/core/src/agent/multi-step-agent.ts packages/core/test/multi-step-agent.test.ts
git commit -m "feat(core): implement the MultiStepAgent ReAct loop"
```

---

## Task 16: CodeAgent

**Files:**
- Create: packages/core/src/utils/async-queue.ts
- Create: packages/core/src/agent/code-agent.ts
- Create: packages/core/test/golden/fibonacci.transcript.json
- Test: packages/core/test/async-queue.test.ts
- Test: packages/core/test/code-agent.test.ts

CodeAgent is the upstream flagship: the model's action is a code block, and the executor is what decides
whether the run is over. The executor reports tool calls back through callbacks, so this task needs a way to
turn callbacks into events without losing the live stream — hence the async queue.

- [ ] **Step 1: Write the failing test for the async queue**

```ts
// packages/core/test/async-queue.test.ts
import { describe, expect, it } from "vitest";
import { createAsyncQueue } from "../src/utils/async-queue.js";

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("createAsyncQueue", () => {
  it("buffers values pushed before anyone iterates", async () => {
    const queue = createAsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    queue.close();
    const seen: number[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([1, 2]);
  });

  it("delivers a value pushed while the consumer is already waiting", async () => {
    const queue = createAsyncQueue<number>();
    const seen: number[] = [];
    const consumer = (async () => {
      for await (const value of queue) seen.push(value);
    })();
    await tick();
    queue.push(1);
    await tick();
    expect(seen).toEqual([1]);
    queue.push(2);
    queue.close();
    await consumer;
    expect(seen).toEqual([1, 2]);
  });

  it("ends the loop when closed", async () => {
    const queue = createAsyncQueue<string>();
    queue.close();
    const seen: string[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([]);
  });

  it("rejects the loop when failed", async () => {
    const queue = createAsyncQueue<number>();
    queue.fail(new Error("guest exploded"));
    await expect(
      (async () => {
        for await (const _value of queue) {
          // drain
        }
      })(),
    ).rejects.toThrow("guest exploded");
  });

  it("rejects a consumer that was already waiting when it failed", async () => {
    const queue = createAsyncQueue<number>();
    const consumer = (async () => {
      for await (const _value of queue) {
        // drain
      }
    })();
    await tick();
    queue.fail(new Error("late failure"));
    await expect(consumer).rejects.toThrow("late failure");
  });

  it("ignores pushes after close", async () => {
    const queue = createAsyncQueue<number>();
    queue.close();
    queue.push(1);
    const seen: number[] = [];
    for await (const value of queue) seen.push(value);
    expect(seen).toEqual([]);
  });

  it("stops early when the consumer breaks", async () => {
    const queue = createAsyncQueue<number>();
    queue.push(1);
    queue.push(2);
    const seen: number[] = [];
    for await (const value of queue) {
      seen.push(value);
      break;
    }
    expect(seen).toEqual([1]);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/async-queue.test.ts
Expected: FAIL, because `../src/utils/async-queue.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/utils/async-queue.ts**

```ts
/**
 * A minimal single-consumer async queue.
 *
 * Executors report progress through synchronous callbacks (onLog, onToolCall), but an
 * agent must yield events as they happen. This is the bridge: callbacks push, the agent
 * iterates, and neither side blocks the other.
 */
export interface AsyncQueue<T> extends AsyncIterable<T> {
  push(value: T): void;
  close(): void;
  fail(error: unknown): void;
}

export function createAsyncQueue<T>(): AsyncQueue<T> {
  const buffered: T[] = [];
  let waiting: ((result: IteratorResult<T>) => void) | undefined;
  let rejectWaiting: ((error: unknown) => void) | undefined;
  let closed = false;
  let failure: unknown;

  const resolveWaiting = (result: IteratorResult<T>): void => {
    const resolve = waiting;
    waiting = undefined;
    rejectWaiting = undefined;
    resolve?.(result);
  };

  return {
    push(value: T): void {
      if (closed) return;
      if (waiting !== undefined) {
        resolveWaiting({ value, done: false });
        return;
      }
      buffered.push(value);
    },

    close(): void {
      if (closed) return;
      closed = true;
      resolveWaiting({ value: undefined as never, done: true });
    },

    fail(error: unknown): void {
      if (closed) return;
      failure = error;
      closed = true;
      const reject = rejectWaiting;
      waiting = undefined;
      rejectWaiting = undefined;
      if (reject !== undefined) reject(error);
      else resolveWaiting({ value: undefined as never, done: true });
    },

    [Symbol.asyncIterator](): AsyncIterator<T> {
      return {
        next(): Promise<IteratorResult<T>> {
          const bufferedValue = buffered.shift();
          if (bufferedValue !== undefined) {
            return Promise.resolve({ value: bufferedValue, done: false });
          }
          if (failure !== undefined) return Promise.reject(failure);
          if (closed) {
            return Promise.resolve({ value: undefined as never, done: true });
          }
          return new Promise<IteratorResult<T>>((resolve, reject) => {
            waiting = resolve;
            rejectWaiting = reject;
          });
        },
        return(): Promise<IteratorResult<T>> {
          closed = true;
          buffered.length = 0;
          return Promise.resolve({ value: undefined as never, done: true });
        },
      };
    },
  };
}
```

**Known limitation, recorded deliberately:** `next()` cannot distinguish "the buffer held `undefined`" from
"the buffer was empty", so pushing `undefined` into the queue is not supported. Every use in this project
pushes events (objects), and the type parameter is never `undefined`. If a future use needs it, switch the
buffer to a `{ value: T }` wrapper. Do not silence it with a non-null assertion.

- [ ] **Step 4: Run the queue test to verify it passes**

Run: pnpm vitest run packages/core/test/async-queue.test.ts
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the golden transcript**

```json
{
  "name": "fibonacci",
  "description": "Two-step run: compute the tenth Fibonacci number, then report it through final_answer.",
  "task": "What is the 10th Fibonacci number, counting 0 as the 0th?",
  "turns": [
    {
      "thought": "I will build the sequence in a loop and print the tenth element.",
      "code": "const fib = [0, 1];\nfor (let i = 2; i < 10; i += 1) {\n  fib.push(fib[i - 1] + fib[i - 2]);\n}\nconsole.log(fib[9]);"
    },
    {
      "thought": "The loop printed 34, so that is the answer.",
      "code": "final_answer(34)"
    }
  ],
  "logs": {
    "0": "34"
  },
  "finalAnswer": 34,
  "expected": {
    "output": 34,
    "state": "success",
    "actionSteps": 2,
    "eventTypes": [
      "run.started",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "logs.appended",
      "observation.completed",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "run.completed"
    ]
  }
}
```

- [ ] **Step 6: Write the failing CodeAgent test**

```ts
// packages/core/test/code-agent.test.ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import type { AgentEvent } from "../src/events.js";
import type { CodeResult } from "../src/executor.js";
import type { RunResult } from "../src/agent/run-result.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import { z } from "zod";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

async function drain(agent: CodeAgent, task: string) {
  const events: AgentEvent[] = [];
  let result: RunResult | undefined;
  for await (const event of agent.stream(task)) {
    events.push(event);
    if (event.type === "run.completed") result = event.result;
  }
  return { events, result, types: events.map((event) => event.type) };
}

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: () => "sunny",
});

describe("CodeAgent", () => {
  it("builds its system prompt from the tool registry", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor(),
      tools: [weatherTool],
    });
    expect(agent.systemPrompt).toContain("get_weather");
    expect(agent.systemPrompt).toContain("Get the current weather for a city.");
  });

  it("says (no tools) when the registry is empty", () => {
    const agent = new CodeAgent({ model: new MockModel(["x"]), executor: new ScriptedExecutor() });
    expect(agent.systemPrompt).toContain("no tools are available");
  });

  it("uses the executor's language in the prompt", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor({ language: "python" }),
    });
    expect(agent.systemPrompt).toContain("Python");
  });

  it("appends custom instructions to the prompt", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor(),
      customInstructions: "Always answer in French.",
    });
    expect(agent.systemPrompt).toContain("Always answer in French.");
  });

  it("passes the extracted code to the executor with the right step index", async () => {
    const seen: { code: string; stepIndex: number }[] = [];
    const executor = new ScriptedExecutor({
      handler: (code, options) => {
        seen.push({ code, stepIndex: options.stepIndex });
        return code === "final_answer(5)" ? finalAnswerResult(5) : { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "compute()"), fenced("done", "final_answer(5)")]), executor });
    await agent.run("Q");
    expect(seen).toEqual([
      { code: "compute()", stepIndex: 0 },
      { code: "final_answer(5)", stepIndex: 1 },
    ]);
  });

  it("emits logs.appended before the observation", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options) => {
        options.onLog?.("first line");
        options.onLog?.("second line");
        return { logs: "first line\nsecond line", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "a()"), fenced("done", "final_answer(1)")]), executor });
    const { types } = await drain(agent, "Q");
    expect(types.indexOf("logs.appended")).toBeGreaterThan(types.indexOf("code.completed"));
    expect(types.filter((type) => type === "logs.appended")).toHaveLength(4);
  });

  it("turns executor tool-call callbacks into action events and ActionStep records", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options) => {
        options.onToolCall?.({ type: "requested", callId: "c1", name: "get_weather", args: { city: "Paris" } });
        options.onToolCall?.({ type: "result", callId: "c1", name: "get_weather", output: "sunny", durationMs: 3 });
        return { logs: "sunny", isFinalAnswer: false, durationMs: 3, toolCallCount: 1 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "get_weather()"), fenced("done", "final_answer(1)")]), executor, tools: [weatherTool] });
    const { events, result } = await drain(agent, "Q");
    expect(events.filter((event) => event.type === "action.requested")).toHaveLength(2);
    expect(events.filter((event) => event.type === "action.result")).toHaveLength(2);
    const firstAction = result?.steps.find((step) => step.kind === "action");
    expect(firstAction).toMatchObject({
      kind: "action",
      toolCalls: [{ id: "c1", name: "get_weather", arguments: { city: "Paris" }, result: "sunny", durationMs: 3 }],
    });
  });

  it("finishes when the guest calls final_answer even if the executor does not flag it", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options): CodeResult => {
        options.finalAnswer.submit(41);
        return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("done", "final_answer(41)")]), executor });
    const result = await agent.run("Q");
    expect(result.output).toBe(41);
  });

  it("prefers the executor's value when it does flag a final answer", async () => {
    const executor = new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult("from executor") } });
    const agent = new CodeAgent({ model: new MockModel([fenced("done", "final_answer(1)")]), executor });
    const result = await agent.run("Q");
    expect(result.output).toBe("from executor");
  });

  it("replays the golden fibonacci transcript event for event", async () => {
    const transcript = JSON.parse(
      readFileSync(new URL("./golden/fibonacci.transcript.json", import.meta.url), "utf8"),
    ) as {
      task: string;
      turns: { thought: string; code: string }[];
      logs: Record<string, string>;
      finalAnswer: number;
      expected: { output: number; state: string; actionSteps: number; eventTypes: string[] };
    };

    const model = new MockModel(transcript.turns.map((turn) => fenced(turn.thought, turn.code)));
    const executor = new ScriptedExecutor({
      handler: (code, options): CodeResult => {
        const index = transcript.turns.findIndex((turn) => turn.code === code);
        const logs = transcript.logs[String(index)] ?? "";
        if (logs !== "") options.onLog?.(logs);
        if (code.startsWith("final_answer(")) options.finalAnswer.submit(transcript.finalAnswer);
        return { logs, isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });

    const agent = new CodeAgent<number>({ model, executor });
    const { types, result } = await drain(agent, transcript.task);

    expect(types).toEqual(transcript.expected.eventTypes);
    expect(result?.output).toBe(transcript.expected.output);
    expect(result?.state).toBe(transcript.expected.state);
    expect(result?.steps.filter((step) => step.kind === "action")).toHaveLength(transcript.expected.actionSteps);
  });
});
```

- [ ] **Step 7: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/code-agent.test.ts
Expected: FAIL, because `../src/agent/code-agent.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 8: Write src/agent/code-agent.ts**

```ts
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "./multi-step-agent.js";
import type { AgentEvent } from "../events.js";
import type { CodeExecutor, ToolCallEvent } from "../executor.js";
import type { ActionStep } from "../memory/steps.js";
import type { ChatCompletion } from "../model.js";
import { buildCodeAgentSystemPrompt } from "../prompts/system-prompt.js";
import type { ToolCall } from "../types.js";
import { createAsyncQueue } from "../utils/async-queue.js";
import { extractCodeBlock } from "../utils/parse-code-blocks.js";

export interface CodeAgentOptions extends AgentOptions {
  executor: CodeExecutor;
}

/**
 * The code-as-action agent (design spec 6.1). The model writes a code block; the
 * executor runs it; the run ends when the guest calls final_answer.
 */
export class CodeAgent<TOut = unknown> extends MultiStepAgent<TOut> {
  readonly executor: CodeExecutor;

  constructor(options: CodeAgentOptions) {
    super(options);
    this.executor = options.executor;
  }

  protected override buildSystemPrompt(): string {
    const customInstructions = this.customInstructionsValue;
    return buildCodeAgentSystemPrompt({
      toolDescriptions: this.tools.renderDescriptions(),
      language: this.executor.language === "python" ? "Python" : "JavaScript",
      ...(customInstructions === undefined ? {} : { customInstructions }),
    });
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    const code = extractCodeBlock(raw);
    return code === null ? { kind: "empty", raw } : { kind: "code", raw, code };
  }

  protected override async *executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    if (action.code === undefined) return { observations: "", isFinalAnswer: false };

    const queue = createAsyncQueue<AgentEvent>();
    const toolCalls: ToolCall[] = [];
    let submitted: unknown;
    let submittedFinal = false;
    const stepIndex = context.stepIndex;

    const execution = this.executor
      .execute(action.code, {
        tools: this.tools,
        finalAnswer: {
          name: FINAL_ANSWER_TOOL_NAME,
          submit: (value: unknown) => {
            submittedFinal = true;
            submitted = value;
          },
        },
        signal: context.signal,
        timeoutMs: this.executionTimeoutMs,
        stepIndex,
        logger: this.logger,
        onLog: (text) => {
          queue.push({ type: "logs.appended", stepIndex, text });
        },
        onToolCall: (event) => {
          queue.push(toAgentEvent(event));
          if (event.type === "requested") {
            toolCalls.push({ id: event.callId, name: event.name, arguments: event.args });
          } else if (event.type === "result") {
            completeToolCall(toolCalls, event.callId, event.output, undefined, event.durationMs);
          } else {
            completeToolCall(toolCalls, event.callId, undefined, event.error.message, 0);
          }
        },
      })
      .then(
        (result) => {
          queue.close();
          return { ok: true as const, result };
        },
        (error: unknown) => {
          queue.fail(error);
          return { ok: false as const, error };
        },
      );

    for await (const event of queue) {
      yield event;
    }

    const settled = await execution;
    if (!settled.ok) throw settled.error;

    step.toolCalls = toolCalls;
    return {
      observations: settled.result.logs,
      isFinalAnswer: settled.result.isFinalAnswer || submittedFinal,
      // The executor's own answer wins when it claims one; the sink is the fallback.
      value: settled.result.isFinalAnswer ? settled.result.value : submitted,
      error: settled.result.error,
    };
  }
}

function toAgentEvent(event: ToolCallEvent): AgentEvent {
  switch (event.type) {
    case "requested":
      return { type: "action.requested", callId: event.callId, name: event.name, args: event.args };
    case "result":
      return {
        type: "action.result",
        callId: event.callId,
        name: event.name,
        output: event.output,
        durationMs: event.durationMs,
      };
    case "failed":
      return { type: "action.failed", callId: event.callId, name: event.name, error: event.error };
  }
}

function completeToolCall(
  calls: ToolCall[],
  callId: string,
  result: unknown,
  error: string | undefined,
  durationMs: number,
): void {
  const call = calls.find((entry) => entry.id === callId);
  if (call === undefined) return;
  call.durationMs = durationMs;
  if (error === undefined) call.result = result;
  else call.error = error;
}
```

- [ ] **Step 9: Run the CodeAgent tests**

Run: pnpm vitest run packages/core/test/code-agent.test.ts
Expected: PASS, 10 tests.

- [ ] **Step 10: Run the whole package suite and the typecheck**

Run: pnpm vitest run --project core
Expected: PASS, every test file.

Run: pnpm typecheck
Expected: exit 0.

- [ ] **Step 11: Commit**

```bash
git add packages/core/src/utils/async-queue.ts packages/core/src/agent/code-agent.ts packages/core/test/async-queue.test.ts packages/core/test/code-agent.test.ts packages/core/test/golden/fibonacci.transcript.json
git commit -m "feat(core): add CodeAgent, the async queue, and the golden fibonacci transcript"
```

---

## Task 17: ToolCallingAgent

**Files:**
- Edit: packages/core/src/prompts/templates.ts (add `TOOL_CALLING_AGENT_SYSTEM_TEMPLATE`)
- Edit: packages/core/src/prompts/system-prompt.ts (add `buildToolCallingAgentSystemPrompt`)
- Create: packages/core/src/agent/tool-calling-agent.ts
- Test: packages/core/test/tool-calling-agent.test.ts

The second flavour. It shares the loop with CodeAgent and differs in exactly two places: the prompt, and the
fact that the model's action is a structured tool call rather than a code block.

**Why `final_answer` is special-cased rather than registered:** it takes an arbitrary value, and an arbitrary
value has no honest JSON Schema. Registering it as a tool would mean lying in the schema (for example
`z.string()`) and silently coercing numbers and objects. Special-casing it keeps the value exact.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/tool-calling-agent.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/model.js";

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: ({ city }) => "sunny in " + city,
});

const failingTool = tool({
  name: "explode",
  description: "Always throws.",
  inputSchema: z.object({}),
  execute: () => {
    throw new Error("tool exploded");
  },
});

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

async function drain(agent: ToolCallingAgent, task: string) {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return { events, types: events.map((event) => event.type) };
}

describe("ToolCallingAgent", () => {
  it("exposes the final_answer name as a constant", () => {
    expect(FINAL_ANSWER_TOOL_NAME).toBe("final_answer");
  });

  it("builds its system prompt from the tool registry", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [weatherTool] });
    expect(agent.systemPrompt).toContain("get_weather");
    expect(agent.systemPrompt).toContain("Get the current weather for a city.");
  });

  it("never streams, because tool calls only come from generate()", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [weatherTool] });
    expect((agent as unknown as { prefersStreaming: boolean }).prefersStreaming).toBe(false);
  });

  it("executes a tool call and turns the result into an observation", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("get_weather", { city: "Paris" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "sunny" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const result = await agent.run("Q");
    expect(result.output).toBe("sunny");
    expect(result.steps.find((step) => step.kind === "action")).toMatchObject({
      toolCalls: [{ id: "c1", name: "get_weather", arguments: { city: "Paris" }, result: "sunny in Paris" }],
    });
  });

  it("emits toolcalls.requested, action.requested and action.result in order", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("get_weather", { city: "Paris" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "sunny" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { types } = await drain(agent, "Q");
    // No message.delta here: a tool-call reply has empty content, and the loop only emits
    // a delta when there is text. message.completed still arrives, as it always does.
    expect(types).toEqual([
      "run.started",
      "step.started",
      "usage.updated",
      "message.completed",
      "toolcalls.requested",
      "action.requested",
      "action.result",
      "observation.completed",
      "step.started",
      "usage.updated",
      "message.completed",
      "toolcalls.requested",
      "action.result",
      "observation.completed",
      "run.completed",
    ]);
  });

  it("records an unknown tool as a failed call and keeps the run alive", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("nope", {})], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect(failure).toMatchObject({ name: "nope" });
    expect((failure as { error: { message: string } }).error.message).toMatch(/Unknown tool/);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("reports arguments that are not valid JSON without throwing", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: "get_weather", arguments: "{not json" }], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect((failure as { error: { message: string } }).error.message).toMatch(/not valid JSON/);
  });

  it("reports a schema violation without calling the tool", async () => {
    let called = false;
    const strict = tool({
      name: "strict",
      description: "Needs a number.",
      inputSchema: z.object({ n: z.number() }),
      execute: () => {
        called = true;
        return "ok";
      },
    });
    const model = new MockModel([
      { content: "", toolCalls: [call("strict", { n: "not a number" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [strict] });
    const { events } = await drain(agent, "Q");
    expect(called).toBe(false);
    expect(events.some((event) => event.type === "action.failed")).toBe(true);
  });

  it("reports a tool that throws without failing the run", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("explode", {})], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [failingTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect((failure as { error: { message: string } }).error.message).toBe("tool exploded");
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("accepts a bare value as the final answer when there is no answer key", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: FINAL_ANSWER_TOOL_NAME, arguments: "42" }], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model });
    const result = await agent.run("Q");
    expect(result.output).toBe(42);
  });

  it("treats a reply with no tool calls as an empty action and keeps going", async () => {
    const model = new MockModel([
      "I am only chatting.",
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const observation = events.find((event) => event.type === "observation.completed");
    expect((observation as { text: string }).text).toMatch(/no action found/i);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("executes several tool calls from one reply", async () => {
    const model = new MockModel([
      {
        content: "",
        toolCalls: [call("get_weather", { city: "Paris" }, "c1"), call("get_weather", { city: "Rome" }, "c2")],
        finishReason: "tool_calls",
      },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "both sunny" }, "c3")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    expect(events.filter((event) => event.type === "action.result")).toHaveLength(3);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/tool-calling-agent.test.ts
Expected: FAIL, because `../src/agent/tool-calling-agent.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Add the tool-calling prompt template**

Add to `packages/core/src/prompts/templates.ts`, after `CODE_AGENT_SYSTEM_TEMPLATE`:

```ts
export const TOOL_CALLING_AGENT_SYSTEM_TEMPLATE = [
  "You are a helpful agent that solves tasks by calling tools.",
  "",
  "TOOLS",
  "You have access to the following tools:",
  "{{toolDescriptions}}",
  "",
  "RULES",
  "1. Act by emitting tool calls. Never write code and never answer in prose.",
  "2. Pass only the arguments a tool declares. Do not invent parameters.",
  "3. You may emit several tool calls in one turn when they do not depend on each other.",
  "4. When you have the answer, call the final_answer tool with an answer argument.",
  "5. If a tool fails, read the error, adjust your arguments, and try again.",
  "",
  "{{customInstructions}}",
].join("\n");
```

- [ ] **Step 4: Add the builder**

Add to `packages/core/src/prompts/system-prompt.ts`, after `buildCodeAgentSystemPrompt`:

```ts
export function buildToolCallingAgentSystemPrompt(
  options: BuildCodeAgentSystemPromptOptions,
): string {
  const toolDescriptions =
    options.toolDescriptions.trim() === ""
      ? "(no tools are available; call final_answer to finish)"
      : options.toolDescriptions;
  return populateTemplate(TOOL_CALLING_AGENT_SYSTEM_TEMPLATE, {
    toolDescriptions,
    customInstructions: options.customInstructions ?? "",
  });
}
```

Its parameter type is reused deliberately: the two builders take the same inputs, and `language` is simply ignored
by this one. If you prefer a distinct `BuildToolCallingAgentSystemPromptOptions` with only the members it uses,
add one — but do not change `BuildCodeAgentSystemPromptOptions` to accommodate it.

- [ ] **Step 5: Write src/agent/tool-calling-agent.ts**

```ts
import { type AgentErrorInfo, AgentToolCallError } from "../errors.js";
import type { AgentEvent } from "../events.js";
import type { ToolCallEvent } from "../executor.js";
import type { ActionStep } from "../memory/steps.js";
import type { ChatCompletion, ToolCallRequest } from "../model.js";
import { buildToolCallingAgentSystemPrompt } from "../prompts/system-prompt.js";
import type { Tool, ToolContext } from "../tool/tool.js";
import type { ToolCall } from "../types.js";
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "./multi-step-agent.js";

// Re-exported so callers can import it beside the agent that uses it. The binding itself is
// declared once, in action.ts, so the package's public star-exports stay unambiguous.
export { FINAL_ANSWER_TOOL_NAME };

export type ToolCallingAgentOptions = AgentOptions;

/**
 * The structured-tool-call agent. Same loop as CodeAgent, different action language.
 */
export class ToolCallingAgent<TOut = unknown> extends MultiStepAgent<TOut> {
  constructor(options: ToolCallingAgentOptions) {
    super(options);
  }

  /** Tool calls arrive on generate(), never on the chunk stream. */
  protected override get prefersStreaming(): boolean {
    return false;
  }

  protected override buildSystemPrompt(): string {
    const customInstructions = this.customInstructionsValue;
    return buildToolCallingAgentSystemPrompt({
      toolDescriptions: this.tools.renderDescriptions(),
      ...(customInstructions === undefined ? {} : { customInstructions }),
    });
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const raw = completion.content;
    if (completion.toolCalls.length === 0) return { kind: "empty", raw };
    return { kind: "toolcalls", raw, calls: completion.toolCalls };
  }

  protected override async *executeAction(
    action: InterpretedAction,
    step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    const stepIndex = context.stepIndex;
    const requests = action.calls ?? [];
    const calls: ToolCall[] = [];
    const observations: string[] = [];
    let isFinalAnswer = false;
    let finalValue: unknown;

    yield {
      type: "toolcalls.requested",
      stepIndex,
      calls: requests.map((request, index) => ({
        id: request.id === "" ? "call-" + String(index) : request.id,
        name: request.name,
        arguments: parseArgumentsOrRaw(request.arguments),
      })),
    };

    for (const [index, request] of requests.entries()) {
      const callId = request.id === "" ? "call-" + String(index) : request.id;

      let args: unknown;
      try {
        args = request.arguments.trim() === "" ? {} : JSON.parse(request.arguments);
      } catch {
        const info = new AgentToolCallError(
          "Arguments for tool " + request.name + " are not valid JSON: " + request.arguments,
          { stepIndex },
        ).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: request.arguments, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      if (request.name === FINAL_ANSWER_TOOL_NAME) {
        const value = extractAnswer(args);
        calls.push({ id: callId, name: request.name, arguments: args, result: value, durationMs: 0 });
        yield { type: "action.result", callId, name: request.name, output: value, durationMs: 0 };
        observations.push("Final answer: " + display(value));
        isFinalAnswer = true;
        finalValue = value;
        continue;
      }

      const definition = this.tools.get(request.name);
      if (definition === undefined) {
        const info = new AgentToolCallError("Unknown tool: " + request.name, { stepIndex }).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: args, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      const parsed = definition.inputSchema.safeParse(args);
      if (!parsed.success) {
        const info = new AgentToolCallError(
          "Invalid arguments for tool " + request.name + ": " + parsed.error.message,
          { stepIndex },
        ).info;
        yield { type: "action.failed", callId, name: request.name, error: info };
        calls.push({ id: callId, name: request.name, arguments: args, error: info.message });
        observations.push("Error: " + info.message);
        continue;
      }

      yield { type: "action.requested", callId, name: request.name, args: parsed.data };
      const startedAt = Date.now();
      const result = await this.invoke(definition, parsed.data, callId, stepIndex, context);
      const durationMs = Date.now() - startedAt;

      if (result.ok) {
        calls.push({ id: callId, name: request.name, arguments: parsed.data, result: result.output, durationMs });
        yield { type: "action.result", callId, name: request.name, output: result.output, durationMs };
        observations.push("Tool " + request.name + " returned: " + display(result.output));
      } else {
        calls.push({ id: callId, name: request.name, arguments: parsed.data, error: result.error.message, durationMs });
        yield { type: "action.failed", callId, name: request.name, error: result.error };
        observations.push("Error: " + result.error.message);
      }
    }

    step.toolCalls = calls;
    return {
      observations: observations.join("\n"),
      isFinalAnswer,
      value: finalValue,
    };
  }

  private async invoke(
    definition: Tool,
    args: unknown,
    callId: string,
    stepIndex: number,
    context: RunContext,
  ): Promise<{ ok: true; output: unknown } | { ok: false; error: AgentErrorInfo }> {
    const toolContext: ToolContext = {
      signal: context.signal,
      fetch: globalThis.fetch,
      callId,
      stepIndex,
      logger: this.logger,
    };
    try {
      return { ok: true, output: await definition.execute(args, toolContext) };
    } catch (error) {
      return {
        ok: false,
        error: new AgentToolCallError(error instanceof Error ? error.message : String(error), { stepIndex })
          .info,
      };
    }
  }
}

function parseArgumentsOrRaw(raw: string): unknown {
  try {
    return raw.trim() === "" ? {} : JSON.parse(raw);
  } catch {
    return raw;
  }
}

function extractAnswer(args: unknown): unknown {
  if (typeof args === "object" && args !== null && "answer" in args) {
    return (args as { answer: unknown }).answer;
  }
  return args;
}

function display(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
```

- [ ] **Step 6: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/tool-calling-agent.test.ts
Expected: PASS, 12 tests.

- [ ] **Step 7: Run the package suite and the typecheck**

Run: pnpm vitest run --project core
Expected: PASS.

Run: pnpm typecheck
Expected: exit 0.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/prompts/templates.ts packages/core/src/prompts/system-prompt.ts packages/core/src/agent/tool-calling-agent.ts packages/core/test/tool-calling-agent.test.ts
git commit -m "feat(core): add ToolCallingAgent"
```

---

## Task 18: AgentSession — the framework-agnostic store

**Files:**
- Create: packages/core/src/session/agent-session.ts
- Test: packages/core/test/agent-session.test.ts

Layer L1 of the design spec. It is a plain class with `getSnapshot()` and `subscribe()`, which is exactly the
`useSyncExternalStore` contract — so L2 hooks are a thin shell and never touch the agent directly.

Two rules make this correct, and both are tested:

1. `getSnapshot()` returns the **identical object** while nothing has changed. Returning a fresh object every
   call makes `useSyncExternalStore` loop forever, so this is a correctness requirement, not a nicety.
2. A `.delta` event is **advisory**. It may update a provisional field, but the matching `.completed` event
   overwrites it wholesale. A delta can never leave residue in the authoritative snapshot.

- [ ] **Step 1: Write the failing test**

```ts
// packages/core/test/agent-session.test.ts
import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import { AgentCancelledError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const idleExecutor = new ScriptedExecutor({
  handler: () => ({ logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 }),
});

function buildAgent(responses: unknown[], executor = idleExecutor) {
  return new CodeAgent({ model: new MockModel(responses as never), executor });
}

describe("AgentSession", () => {
  it("starts idle with a frozen snapshot", () => {
    const session = new AgentSession(buildAgent([]));
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("idle");
    expect(snapshot.isRunning).toBe(false);
    expect(snapshot.steps).toEqual([]);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it("returns the identical snapshot object until something changes", () => {
    const session = new AgentSession(buildAgent([]));
    const first = session.getSnapshot();
    expect(session.getSnapshot()).toBe(first);
    expect(session.getSnapshot()).toBe(first);
  });

  it("respects the useSyncExternalStore contract: getSnapshot is cheap and stable", () => {
    const session = new AgentSession(buildAgent([]));
    let reads = 0;
    const getSnapshot = () => {
      reads += 1;
      return session.getSnapshot();
    };
    const a = getSnapshot();
    const b = getSnapshot();
    expect(a).toBe(b);
    expect(reads).toBe(2);
  });

  it("notifies subscribers on change and stops after unsubscribe", async () => {
    const executor = new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } });
    const session = new AgentSession(buildAgent([fenced("final_answer(1)")], executor));
    let calls = 0;
    const off = session.subscribe(() => {
      calls += 1;
    });
    await session.send("Q");
    expect(calls).toBeGreaterThan(0);
    off();
    const before = calls;
    session.reset();
    expect(calls).toBe(before);
  });

  it("drives the agent and returns the RunResult", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(9)")], new ScriptedExecutor({ results: { "final_answer(9)": finalAnswerResult(9) } })),
    );
    const result = await session.send("Q");
    expect(result.output).toBe(9);
  });

  it("exposes steps, code, logs and the observation in the snapshot", async () => {
    const executor = new ScriptedExecutor({
      handler: (code, options) => {
        if (code === "final_answer(34)") return finalAnswerResult(34, "34");
        options.onLog?.("34");
        return { logs: "34", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const session = new AgentSession(buildAgent([fenced("compute()"), fenced("final_answer(34)")], executor));
    await session.send("Q");
    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("success");
    expect(snapshot.output).toBe(34);
    expect(snapshot.steps).toHaveLength(2);
    expect(snapshot.steps[0]).toMatchObject({ code: "compute()", logs: "34\n", observation: "34" });
    expect(snapshot.steps[1]).toMatchObject({ code: "final_answer(34)", isFinalAnswer: true });
  });

  it("lets the authoritative .completed event overwrite an advisory delta", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { thought: string }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "message.delta", text: "half" });
    apply.apply({ type: "message.delta", text: "-baked" });
    expect(apply.getSnapshot().steps[0]?.thought).toBe("half-baked");

    apply.apply({ type: "message.completed", text: "fully baked" });
    expect(apply.getSnapshot().steps[0]?.thought).toBe("fully baked");
  });

  it("tracks tool calls from pending to complete", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { toolCalls: unknown[] }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "action.requested", callId: "c1", name: "get_weather", args: { city: "Paris" } });
    expect(apply.getSnapshot().steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "get_weather", args: { city: "Paris" }, status: "pending" },
    ]);

    apply.apply({ type: "action.result", callId: "c1", name: "get_weather", output: "sunny", durationMs: 3 });
    expect(apply.getSnapshot().steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "get_weather", args: { city: "Paris" }, status: "ok", output: "sunny", durationMs: 3 },
    ]);
  });

  it("marks a failed tool call as an error", async () => {
    const session = new AgentSession(buildAgent([]));
    const apply = session as unknown as { apply(event: AgentEvent): void; getSnapshot(): { steps: { toolCalls: { status: string; error?: string }[] }[] } };

    apply.apply({ type: "run.started", runId: "r", task: "t", modelId: "m" });
    apply.apply({ type: "step.started", stepIndex: 0 });
    apply.apply({ type: "action.requested", callId: "c1", name: "boom", args: {} });
    apply.apply({
      type: "action.failed",
      callId: "c1",
      name: "boom",
      error: { name: "AgentToolCallError", message: "tool exploded", code: "AGENT_TOOL_CALL" },
    });
    expect(apply.getSnapshot().steps[0]?.toolCalls[0]).toMatchObject({ status: "error", error: "tool exploded" });
  });

  it("refuses to start a second run while one is in flight", async () => {
    const session = new AgentSession(buildAgent([fenced("final_answer(1)"), fenced("final_answer(2)")]));
    const first = session.send("Q");
    await expect(session.send("Q")).rejects.toThrow(/already running/i);
    await first.catch(() => undefined);
  });

  it("cancels the run and reports it in the snapshot", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(1)")], new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } })),
    );
    const promise = session.send("Q");
    session.cancel();
    await expect(promise).rejects.toBeInstanceOf(AgentCancelledError);
    expect(session.getSnapshot().status).toBe("cancelled");
    expect(session.getSnapshot().isRunning).toBe(false);
  });

  it("resets back to idle", async () => {
    const session = new AgentSession(
      buildAgent([fenced("final_answer(1)")], new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } })),
    );
    await session.send("Q");
    session.reset();
    expect(session.getSnapshot().status).toBe("idle");
    expect(session.getSnapshot().steps).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/agent-session.test.ts
Expected: FAIL, because `../src/session/agent-session.js` cannot be resolved — the error names that specifier (Vitest 5.0.3 says "Cannot find module"; other resolvers say "Failed to resolve import")

- [ ] **Step 3: Write src/session/agent-session.ts**

```ts
import { AgentError } from "../errors.js";
import type { AgentErrorInfo } from "../errors.js";
import type { AgentEvent, AgentEventType } from "../events.js";
import type { MultiStepAgent } from "../agent/multi-step-agent.js";
import type { RunResult } from "../agent/run-result.js";
import { type TokenUsage, EMPTY_TOKEN_USAGE } from "../types.js";

export type SessionStatus = "idle" | "running" | "success" | "failed" | "cancelled" | "max_steps";

export type ToolCallStatus = "pending" | "ok" | "error";

export interface ToolCallView {
  readonly id: string;
  readonly name: string;
  readonly args: unknown;
  readonly status: ToolCallStatus;
  readonly output?: unknown;
  readonly error?: string;
  readonly durationMs?: number;
}

export interface StepView {
  readonly stepIndex: number;
  readonly status: "streaming" | "complete";
  /** Provisional while streaming; replaced wholesale by message.completed. */
  readonly thought: string;
  readonly code: string | null;
  readonly logs: string;
  readonly observation: string | null;
  readonly toolCalls: readonly ToolCallView[];
  readonly isFinalAnswer: boolean;
  readonly startedAt: number;
  readonly endedAt?: number;
}

export interface AgentSessionSnapshot {
  readonly runId: string | null;
  readonly task: string | null;
  readonly modelId: string | null;
  readonly status: SessionStatus;
  readonly isRunning: boolean;
  readonly steps: readonly StepView[];
  readonly output: unknown;
  readonly error: AgentErrorInfo | null;
  readonly usage: TokenUsage;
  readonly startedAt: number | null;
  readonly endedAt: number | null;
  readonly lastEventType: AgentEventType | null;
}

interface StepDraft {
  stepIndex: number;
  status: "streaming" | "complete";
  thought: string;
  code: string | null;
  logs: string;
  observation: string | null;
  toolCalls: ToolCallView[];
  isFinalAnswer: boolean;
  startedAt: number;
  endedAt?: number;
}

interface RunDraft {
  runId: string | null;
  task: string | null;
  modelId: string | null;
  status: SessionStatus;
  steps: StepDraft[];
  output: unknown;
  error: AgentErrorInfo | null;
  usage: TokenUsage;
  startedAt: number | null;
  endedAt: number | null;
}

function emptyRun(): RunDraft {
  return {
    runId: null,
    task: null,
    modelId: null,
    status: "idle",
    steps: [],
    output: undefined,
    error: null,
    usage: EMPTY_TOKEN_USAGE,
    startedAt: null,
    endedAt: null,
  };
}

/**
 * The framework-agnostic run store (design spec 5.3, layer L1).
 *
 * React's useSyncExternalStore needs subscribe + getSnapshot, so this class is the whole
 * integration surface. It never imports React, and it works in Vue, Svelte, or a plain
 * event listener just as well.
 */
export class AgentSession<TOut = unknown> {
  private agent: MultiStepAgent<TOut>;
  private draft: RunDraft = emptyRun();
  private snapshot: AgentSessionSnapshot = freezeRun(this.draft, null);
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;

  constructor(agent: MultiStepAgent<TOut>) {
    this.agent = agent;
  }

  /** Stable while nothing changed. This identity is the contract useSyncExternalStore relies on. */
  getSnapshot(): AgentSessionSnapshot {
    return this.snapshot;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isRunning(): boolean {
    return this.draft.status === "running";
  }

  /** Run a task. Rejects if a run is already in flight. */
  async send(task: string, options: { signal?: AbortSignal } = {}): Promise<RunResult<TOut>> {
    if (this.isRunning) {
      throw new AgentError("AgentSession is already running a task");
    }

    const controller = new AbortController();
    this.controller = controller;
    const external = options.signal;
    if (external !== undefined) {
      if (external.aborted) controller.abort();
      else external.addEventListener("abort", () => controller.abort(), { once: true });
    }

    this.draft = { ...emptyRun(), status: "running", task, startedAt: Date.now() };
    this.publish(null);

    const unsubscribe = this.agent.on((event) => {
      this.apply(event);
    });

    try {
      const result = await this.agent.run(task, { signal: controller.signal });
      this.draft.output = result.output;
      this.draft.runId = result.runId;
      this.draft.status = "success";
      this.draft.endedAt = Date.now();
      this.publish("run.completed");
      return result;
    } catch (error) {
      const info = AgentError.from(error).info;
      this.draft.error = info;
      this.draft.status = statusForCode(info.code);
      this.draft.endedAt = Date.now();
      this.publish(null);
      throw error;
    } finally {
      unsubscribe();
      this.controller = null;
    }
  }

  /** Ask the run to stop. Safe to call when nothing is running. */
  cancel(): void {
    this.controller?.abort();
  }

  /** Back to idle, with no steps and no output. */
  reset(): void {
    this.draft = emptyRun();
    this.publish(null);
  }

  /** Replace the agent, for example after a model change in the UI. */
  setAgent(agent: MultiStepAgent<TOut>): void {
    this.agent = agent;
  }

  private apply(event: AgentEvent): void {
    this.reduce(event);
    this.publish(event.type);
  }

  private reduce(event: AgentEvent): void {
    switch (event.type) {
      case "run.started":
        this.draft.runId = event.runId;
        this.draft.task = event.task;
        this.draft.modelId = event.modelId;
        this.draft.status = "running";
        return;

      case "step.started":
        this.draft.steps[event.stepIndex] = {
          stepIndex: event.stepIndex,
          status: "streaming",
          thought: "",
          code: null,
          logs: "",
          observation: null,
          toolCalls: [],
          isFinalAnswer: false,
          startedAt: Date.now(),
        };
        return;

      case "message.delta": {
        // Advisory. message.completed will overwrite this wholesale.
        const step = this.openStep();
        if (step !== undefined) step.thought += event.text;
        return;
      }

      case "message.completed": {
        const step = this.openStep();
        if (step !== undefined) step.thought = event.text;
        return;
      }

      case "code.completed": {
        const step = this.stepAt(event.stepIndex);
        if (step !== undefined) step.code = event.code;
        return;
      }

      case "logs.appended": {
        const step = this.stepAt(event.stepIndex);
        if (step !== undefined) step.logs += event.text + "\n";
        return;
      }

      case "action.requested": {
        const step = this.openStep();
        if (step === undefined) return;
        step.toolCalls.push({ id: event.callId, name: event.name, args: event.args, status: "pending" });
        return;
      }

      case "action.result": {
        const call = this.findCall(event.callId);
        if (call === undefined) return;
        call.status = "ok";
        call.output = event.output;
        call.durationMs = event.durationMs;
        return;
      }

      case "action.failed": {
        const call = this.findCall(event.callId);
        if (call === undefined) return;
        call.status = "error";
        call.error = event.error.message;
        return;
      }

      case "observation.completed": {
        const step = this.stepAt(event.stepIndex);
        if (step === undefined) return;
        step.observation = event.text;
        step.isFinalAnswer = event.isFinalAnswer;
        step.status = "complete";
        step.endedAt = Date.now();
        return;
      }

      case "usage.updated":
        this.draft.usage = event.usage;
        return;

      case "run.completed":
        this.draft.status = "success";
        this.draft.output = event.result.output;
        this.draft.endedAt = Date.now();
        return;

      case "run.failed":
        this.draft.status = "failed";
        this.draft.error = event.error;
        this.draft.endedAt = Date.now();
        return;

      case "run.maxStepsReached":
        this.draft.status = "max_steps";
        this.draft.endedAt = Date.now();
        return;

      case "run.cancelled":
        this.draft.status = "cancelled";
        this.draft.endedAt = Date.now();
        return;

      // Planning and tool-call announcement events are not part of the step view in v1.
      // The run inspector adds a planning lane in S5; leaving them unhandled is honest.
      default:
        return;
    }
  }

  private openStep(): StepDraft | undefined {
    return this.draft.steps[this.draft.steps.length - 1];
  }

  private stepAt(stepIndex: number): StepDraft | undefined {
    return this.draft.steps[stepIndex] ?? this.openStep();
  }

  private findCall(callId: string): ToolCallView | undefined {
    for (const step of this.draft.steps) {
      const call = step.toolCalls.find((entry) => entry.id === callId);
      if (call !== undefined) return call;
    }
    return undefined;
  }

  private publish(eventType: AgentEventType | null): void {
    this.snapshot = freezeRun(this.draft, eventType ?? this.snapshot.lastEventType);
    for (const listener of this.listeners) {
      listener();
    }
  }
}

function statusForCode(code: string): SessionStatus {
  if (code === "AGENT_CANCELLED") return "cancelled";
  if (code === "AGENT_MAX_STEPS") return "max_steps";
  return "failed";
}

function freezeRun(draft: RunDraft, lastEventType: AgentEventType | null): AgentSessionSnapshot {
  return Object.freeze({
    runId: draft.runId,
    task: draft.task,
    modelId: draft.modelId,
    status: draft.status,
    isRunning: draft.status === "running",
    steps: Object.freeze(
      draft.steps.map((step) =>
        Object.freeze({
          stepIndex: step.stepIndex,
          status: step.status,
          thought: step.thought,
          code: step.code,
          logs: step.logs,
          observation: step.observation,
          toolCalls: Object.freeze(step.toolCalls.map((call) => Object.freeze({ ...call }))),
          isFinalAnswer: step.isFinalAnswer,
          startedAt: step.startedAt,
          ...(step.endedAt === undefined ? {} : { endedAt: step.endedAt }),
        }),
      ),
    ),
    output: draft.output,
    error: draft.error,
    usage: draft.usage,
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
    lastEventType,
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: pnpm vitest run packages/core/test/agent-session.test.ts
Expected: PASS, 12 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/session/agent-session.ts packages/core/test/agent-session.test.ts
git commit -m "feat(core): add AgentSession, the useSyncExternalStore-shaped run store"
```

---

## Task 19: The public surface, an end-to-end run, and the shape gate

**Files:**
- Replace: packages/core/src/index.ts (S0 wrote a placeholder)
- Create: packages/core/test/public-surface.test.ts
- Create: packages/core/test/integration.test.ts
- Create: .changeset/s1-core-runtime.md

- [ ] **Step 1: Write the failing public-surface test**

```ts
// packages/core/test/public-surface.test.ts
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
  // tools
  "tool",
  "ToolDefinitionError",
  "ToolRegistry",
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
  "FinalAnswerStep",
  "Monitor",
  // runtime
  "MultiStepAgent",
  "CodeAgent",
  "ToolCallingAgent",
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
```

The last assertion in the second test is the point of the test: an accidental new export from a `export *` line
shows up as a failure rather than as a surprise in a published package. When you add an export on purpose, add
its name to `RUNTIME_EXPORTS` in the same commit.

- [ ] **Step 2: Run it and verify it fails**

Run: pnpm vitest run packages/core/test/public-surface.test.ts
Expected: FAIL — the S0 placeholder exports almost nothing.

- [ ] **Step 3: Replace src/index.ts**

```ts
/**
 * @smolagents-ts/core — the agent runtime.
 *
 * Everything here is isomorphic: no node: imports, no Buffer, no process, no DOM, no React.
 * The architecture tests enforce that, and the CI matrix runs this package on Node, Bun,
 * Deno and a browser.
 */

// The version string the S0 smoke test asserts on. Kept as a named export so replacing
// this file cannot silently break it.
export { VERSION } from "./version.js";

// Foundations.
export * from "./types.js";
export * from "./errors.js";
export * from "./logger.js";
export * from "./events.js";

// The two seams a host can replace: which model answers, and where code runs.
export * from "./model.js";
export * from "./executor.js";

// Tools.
export * from "./tool/tool.js";
export * from "./tool/registry.js";

// Prompts. The templates themselves stay internal; only the fence and the builders are public.
export * from "./prompts/populate-template.js";
export { CODE_FENCE } from "./prompts/templates.js";
export {
  buildCodeAgentSystemPrompt,
  buildToolCallingAgentSystemPrompt,
} from "./prompts/system-prompt.js";

// Memory and accounting.
export * from "./memory/steps.js";
export * from "./memory/memory.js";
export * from "./monitoring/monitor.js";

// The runtime.
export * from "./agent/action.js";
export * from "./agent/run-result.js";
export * from "./agent/multi-step-agent.js";
export * from "./agent/code-agent.js";
export * from "./agent/tool-calling-agent.js";
export * from "./middleware.js";
export * from "./session/agent-session.js";

// Utilities.
export * from "./utils/parse-code-blocks.js";
export * from "./utils/async-queue.js";

// Test doubles, published on purpose: they are the documented way to test an agent
// without a provider or a sandbox (design spec section 11).
export * from "./testing/mock-model.js";
export * from "./testing/scripted-executor.js";
```

- [ ] **Step 4: Run the surface test**

Run: pnpm vitest run packages/core/test/public-surface.test.ts
Expected: PASS, 52 tests.

If a name from `RUNTIME_EXPORTS` is missing, the `export *` line that should have provided it is wrong — fix
the line, do not remove the name. If the "total export count" test fails, the diff tells you which `export *`
leaked; either export that name deliberately and list it, or narrow the star export to named exports.

- [ ] **Step 5: Write the end-to-end integration test**

```ts
// packages/core/test/integration.test.ts
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  AgentSession,
  type AgentMiddleware,
  type AgentEvent,
  type CodeResult,
  CodeAgent,
  MockModel,
  ScriptedExecutor,
  ToolRegistry,
  buildCodeAgentSystemPrompt,
  tool,
} from "../src/index.js";

const CODE_FENCE = String.fromCharCode(96) + String.fromCharCode(96) + String.fromCharCode(96);

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

describe("end to end", () => {
  it("runs a tool-using task through the public entry point", async () => {
    const registry = new ToolRegistry([add]);
    const executor = new ScriptedExecutor({
      handler: async (code, options): Promise<CodeResult> => {
        if (code === "final_answer(20)") {
          options.onLog?.("20");
          options.finalAnswer.submit(20);
          return { logs: "20", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
        }

        // Stand in for guest code that calls add(12, 8), exactly as a real executor would.
        const definition = options.tools.get("add");
        if (definition === undefined) throw new Error("add is not registered");
        const args = definition.inputSchema.parse({ a: 12, b: 8 });
        options.onToolCall?.({ type: "requested", callId: "c1", name: "add", args });
        const startedAt = Date.now();
        const output = await definition.execute(args, {
          signal: options.signal,
          fetch: globalThis.fetch,
          callId: "c1",
          stepIndex: options.stepIndex,
          logger: options.logger,
        });
        options.onToolCall?.({ type: "result", callId: "c1", name: "add", output, durationMs: Date.now() - startedAt });
        options.onLog?.("20");
        return { logs: "20", isFinalAnswer: false, durationMs: 0, toolCallCount: 1 };
      },
    });

    const seenSteps: number[] = [];
    const middleware: AgentMiddleware = async function* (ctx, next) {
      seenSteps.push(ctx.stepIndex);
      return yield* next();
    };

    const agent = new CodeAgent<number>({
      model: new MockModel([fenced("print(add(12, 8))"), fenced("final_answer(20)")]),
      executor,
      tools: registry,
      middleware: [middleware],
    });

    const session = new AgentSession(agent);
    const events: AgentEvent[] = [];
    session.subscribe(() => undefined);
    const off = agent.on((event) => events.push(event));
    const result = await session.send("What is 12 + 8?");
    off();

    expect(result.output).toBe(20);
    expect(result.state).toBe("success");
    expect(seenSteps).toEqual([0, 1]);
    expect(events.some((event) => event.type === "action.result")).toBe(true);

    const snapshot = session.getSnapshot();
    expect(snapshot.status).toBe("success");
    expect(snapshot.steps).toHaveLength(2);
    expect(snapshot.steps[0]?.toolCalls).toEqual([
      { id: "c1", name: "add", args: { a: 12, b: 8 }, status: "ok", output: 20, durationMs: expect.any(Number) },
    ]);
    expect(snapshot.steps[1]?.isFinalAnswer).toBe(true);
  });

  it("builds a prompt a model can actually follow", () => {
    const prompt = buildCodeAgentSystemPrompt({ toolDescriptions: new ToolRegistry([add]).renderDescriptions() });
    expect(prompt).toContain("add");
    expect(prompt).toContain("Add two numbers.");
    expect(prompt).toContain("a (number, required)");
    expect(prompt).toContain("final_answer");
  });
});
```

- [ ] **Step 6: Run the integration test**

Run: pnpm vitest run packages/core/test/integration.test.ts
Expected: PASS, 2 tests.

- [ ] **Step 7: Run the whole S1 gate**

Run: pnpm vitest run --project core
Expected: PASS, every file.

Run: pnpm typecheck
Expected: exit 0.

Run: pnpm lint
Expected: exit 0.

Run: pnpm test:architecture
Expected: PASS. If the boundary tests fail, the import that broke them is the bug — never relax the rule to
make S1 green.

- [ ] **Step 8: Prove the published shape**

Run: pnpm build
Expected: exit 0.

Run: node scripts/pack-smoke.mjs
Expected: prints a PASS line for every package and a `smolagents-ts` subpath that resolves to core.

- [ ] **Step 9: Add a changeset**

```md
---
"@smolagents-ts/core": minor
---

Add the S1 core runtime: the MultiStepAgent ReAct loop, CodeAgent and ToolCallingAgent,
schema-first tools, the CodeExecutor seam, agent middleware, the async event stream,
AgentSession, and the MockModel and ScriptedExecutor test doubles.
```

- [ ] **Step 10: Commit**

```bash
git add packages/core/src/index.ts packages/core/test/public-surface.test.ts packages/core/test/integration.test.ts .changeset/s1-core-runtime.md
git commit -m "feat(core): publish the S1 core runtime surface"
```

---

## S1 definition of done

S1 is complete when **all** of the following hold, each with its own evidence:

1. `pnpm vitest run --project core` passes, and every task's stated test count matches the actual count.
2. `pnpm typecheck` exits 0.
3. `pnpm lint` exits 0, including the import and global restrictions that keep core isomorphic.
4. `pnpm test:architecture` passes, including the live negative probe from S0.
5. `node scripts/pack-smoke.mjs` passes: the tarball contains what it should, and every subpath resolves.
6. `packages/core/test/public-surface.test.ts` passes with an exact export list — no accidental leaks.
7. `packages/core/test/golden/fibonacci.transcript.json` replays event-for-event.
8. No file under `packages/core/src` imports a `node:*` module, `Buffer`, `process`, `eval`, `new Function`,
   a DOM global, or React. The architecture tests are what make this true; do not assert it by eye.
9. `docs/design/2026-10-12-smolagents-ts-v1-design.md`, section 5.5(a), has been amended to the generator middleware
   shape actually shipped.

## What S1 deliberately does not do

- **No provider adapters.** `Model` is an interface, and nothing implements it but `MockModel`. S3.
- **No QuickJS.** `CodeExecutor` is implemented only by `ScriptedExecutor`. S4.
- **No React.** `AgentSession` satisfies the `useSyncExternalStore` contract, but no hook exists yet. S5.
- **No python executor.** `ExecutorLanguage` includes `"python"`, and the prompt builder accepts `"Python"`, so
  the seam is honoured — but nothing runs it. S4 decides whether it ships at all.
- **No planning in the golden transcript.** `planningInterval` is implemented and unit-tested, but the golden
  run exercises only the action path. Add a planning golden transcript in S5 when the run inspector needs it.
- **No retries.** A model failure ends the run with `run.failed`. Retry is middleware, and middleware is proven
  by Task 14; the retry policy itself is S1.5 work with real provider behaviour to design against.
- **No partial RunResult on failure.** The loop throws `AgentMaxStepsError`, exactly as design spec 6.2
  specifies, so `RunResult.state = "max_steps_reached"` is a reserved value that S1 never produces. S1.5 either
  makes it reachable (for example `AgentMaxStepsError.result`) or drops it from `RunState` — once there is a
  consumer who needs the partial run.
- **No differential harness.** The Python-versus-TypeScript comparison is S1.5 (decision D9).

