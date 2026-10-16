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

/** The fields every step carries, as they appear in a checkpoint. */
interface StepMetaJSON {
  readonly id: string;
  readonly createdAt: number;
  readonly timing?: Timing;
  readonly tokenUsage?: TokenUsage;
}

/**
 * A step as a plain, JSON-safe object — the checkpoint form a store round-trips. Mirrors
 * upstream's pydantic `step.dict()`, kind and every field of the step included.
 */
export type StepJSON =
  | (StepMetaJSON & { readonly kind: "task"; readonly task: string })
  | (StepMetaJSON & { readonly kind: "system_prompt"; readonly systemPrompt: string })
  | (StepMetaJSON & { readonly kind: "planning"; readonly plan: string; readonly hasError: boolean })
  | (StepMetaJSON & {
      readonly kind: "action";
      readonly modelOutput: string | null;
      readonly codeAction: string | null;
      readonly toolCalls: readonly ToolCall[];
      readonly observations: string | null;
      readonly error?: AgentErrorInfo;
      readonly isFinalAnswer: boolean;
    })
  | (StepMetaJSON & { readonly kind: "final_answer"; readonly output: unknown });

function stepMeta(step: AgentStep): StepMetaJSON {
  return {
    id: step.id,
    createdAt: step.createdAt,
    ...(step.timing === undefined ? {} : { timing: step.timing }),
    ...(step.tokenUsage === undefined ? {} : { tokenUsage: step.tokenUsage }),
  };
}

/** Serialise a step to the checkpoint form. */
export function stepToJSON(step: AnyAgentStep): StepJSON {
  const meta = stepMeta(step);
  switch (step.kind) {
    case "task":
      return { ...meta, kind: "task", task: step.task };
    case "system_prompt":
      return { ...meta, kind: "system_prompt", systemPrompt: step.systemPrompt };
    case "planning":
      return { ...meta, kind: "planning", plan: step.plan, hasError: step.hasError };
    case "action":
      return {
        ...meta,
        kind: "action",
        modelOutput: step.modelOutput,
        codeAction: step.codeAction,
        toolCalls: step.toolCalls,
        observations: step.observations,
        ...(step.error === undefined ? {} : { error: step.error }),
        isFinalAnswer: step.isFinalAnswer,
      };
    case "final_answer":
      return { ...meta, kind: "final_answer", output: step.output };
  }
}

/** Rebuild a step from its checkpoint form, identity and timing included. */
export function stepFromJSON(json: StepJSON): AnyAgentStep {
  const step = constructStep(json);
  // id and createdAt are readonly on the class but restored verbatim, so a resumed run keeps
  // the step identity a store keyed on it.
  Object.assign(step, {
    id: json.id,
    createdAt: json.createdAt,
    timing: json.timing,
    tokenUsage: json.tokenUsage,
  });
  return step;
}

function constructStep(json: StepJSON): AnyAgentStep {
  switch (json.kind) {
    case "task":
      return new TaskStep(json.task);
    case "system_prompt":
      return new SystemPromptStep(json.systemPrompt);
    case "planning": {
      const step = new PlanningStep(json.plan);
      step.hasError = json.hasError;
      return step;
    }
    case "action": {
      const step = new ActionStep(json.modelOutput);
      step.codeAction = json.codeAction;
      step.toolCalls = [...json.toolCalls];
      step.observations = json.observations;
      step.error = json.error;
      step.isFinalAnswer = json.isFinalAnswer;
      return step;
    }
    case "final_answer":
      return new FinalAnswerStep(json.output);
  }
}
