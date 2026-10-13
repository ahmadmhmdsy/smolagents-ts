import {
  AgentCancelledError,
  AgentError,
  AgentMaxStepsError,
  AgentParsingError,
} from "../errors.js";
import type { AgentEvent } from "../events.js";
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
import {
  ToolCallAccumulator,
  type ChatCompletion,
  type FinishReason,
  type GenerateOptions,
  type Model,
} from "../model.js";
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
    return false;
  }

  /** Which transcript shape this agent's memory renders into. */
  protected get transcriptStyle(): "observation" | "tool-messages" {
    return "observation";
  }

  /** Whether this agent sends its tool schemas with the request. */
  protected get advertisesTools(): boolean {
    return false;
  }

  /** The one place the transcript options are assembled. */
  protected transcript(): ChatMessage[] {
    return this.memory.toMessages({
      systemPrompt: this.systemPrompt,
      toolResults: this.transcriptStyle,
    });
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
    try {
      yield* this.runStream(task, options);
    } finally {
      await this.releaseResources();
    }
  }

  /**
   * Release anything the run held. Called once, after the terminal event, from the
   * generator's finally, which an async generator runs on completion, on failure and on a
   * consumer's early return() — but not if a consumer abandons the stream without returning.
   */
  protected async releaseResources(): Promise<void> {
    // Nothing to release by default. An agent that owns a sandbox overrides this.
  }

  /** The run itself. stream() owns the release hook so that no terminal path can skip it. */
  private async *runStream(
    task: string,
    options: RunOptions = {},
  ): AsyncGenerator<AgentEvent, void> {
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
          this.transcript(),
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
    const messages = this.transcript();
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

  /** The request options for one model turn, assembled in one place. */
  private modelOptions(context: RunContext): GenerateOptions {
    const options: GenerateOptions = { signal: context.signal };
    if (this.advertisesTools) {
      const specs = this.tools.toSpecs();
      if (specs.length > 0) options.tools = specs;
    }
    return options;
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
      const startedAt = Date.now();
      const accumulator = new ToolCallAccumulator();
      let text = "";
      let finishReason: FinishReason = "stop";
      let streamUsage: TokenUsage | undefined;

      for await (const chunk of this.model.generateStream(messages, this.modelOptions(context))) {
        if (chunk.delta !== "") {
          text += chunk.delta;
          yield this.emit(
            kind === "planning"
              ? { type: "planning.delta", stepIndex, text: chunk.delta }
              : { type: "message.delta", text: chunk.delta },
          );
        }
        if (chunk.toolCallDelta !== undefined) accumulator.accept(chunk.toolCallDelta);
        if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
        if (chunk.usage !== undefined) streamUsage = chunk.usage;
      }

      if (streamUsage !== undefined) {
        this.monitor.record(this.model.id, streamUsage, Date.now() - startedAt);
        context.usage = addTokenUsage(context.usage, streamUsage);
      }
      // Exactly one usage.updated per model turn, whether or not the stream reported usage.
      yield this.emit({ type: "usage.updated", usage: context.usage });
      return {
        content: text,
        toolCalls: accumulator.finish(),
        usage: streamUsage ?? EMPTY_TOKEN_USAGE,
        finishReason,
      };
    }

    const startedAt = Date.now();
    const completion = await this.model.generate(messages, this.modelOptions(context));
    if (completion.content !== "") {
      yield this.emit(
        kind === "planning"
          ? { type: "planning.delta", stepIndex, text: completion.content }
          : { type: "message.delta", text: completion.content },
      );
    }
    this.monitor.record(this.model.id, completion.usage, Date.now() - startedAt);
    context.usage = addTokenUsage(context.usage, completion.usage);
    yield this.emit({ type: "usage.updated", usage: context.usage });
    return completion;
  }

  private buildResult(output: unknown, context: RunContext, state: RunState): RunResult<TOut> {
    return makeRunResult<TOut>({
      runId: context.runId,
      output: output as TOut,
      steps: this.memory.steps,
      messages: this.transcript(),
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