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
