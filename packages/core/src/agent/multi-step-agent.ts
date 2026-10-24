import {
  AgentCancelledError,
  AgentError,
  AgentGuardrailError,
  AgentMaxStepsError,
  AgentParsingError,
  RunSnapshotVersionError,
} from "../errors.js";
import { isTerminal, type AgentEvent, type AgentEventOf, type AgentEventType } from "../events.js";
import { type Logger, noopLogger } from "../logger.js";
import { AgentMemory } from "../memory/memory.js";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
  type AnyAgentStep,
} from "../memory/steps.js";
import { type AgentMiddleware, type MiddlewareContext, composeMiddleware } from "../middleware.js";
import {
  ToolCallAccumulator,
  type ChatCompletion,
  type FinishReason,
  type GenerateOptions,
  type Model,
  type ToolSpec,
} from "../model.js";
import { Monitor } from "../monitoring/monitor.js";
import { populateTemplate } from "../prompts/populate-template.js";
import { MANAGED_AGENTS_SECTION_TEMPLATE } from "../prompts/templates.js";
import { ToolRegistry } from "../tool/registry.js";
import type { Tool } from "../tool/tool.js";
import { type ChatMessage, type TokenUsage, EMPTY_TOKEN_USAGE, addTokenUsage } from "../types.js";
import { makeRunResult, type RunResult, type RunState } from "./run-result.js";
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { managedAgent, type ManagedAgent } from "./managed-agent.js";
import {
  withApproval,
  type ApprovalDecision,
  type ApprovalHandler,
  type ApprovalPolicy,
} from "./approval.js";
import type { Guardrails } from "./guardrail.js";
import {
  RUN_SNAPSHOT_VERSION,
  translateSnapshot,
  type RunSnapshot,
  type RunStore,
} from "../session/run-store.js";
import { z } from "zod";

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
  /**
   * Child agents exposed to the model as callable tools, upstream's managed agents. Each is folded into
   * this agent's tool set, so both flavours execute it and advertise it without a second path, and it is
   * rendered in the prompt as a "team member" rather than as an ordinary tool.
   */
  managedAgents?: readonly ManagedAgent[];
  /**
   * Where a run's checkpoint lives. With a `checkpoint` name on the run, the agent saves the
   * memory after each step and reads it back to resume, so a run survives its process.
   */
  store?: RunStore;
  /** Gates every tool call: asked before a tool runs, and a denial fails that one call. */
  approve?: ApprovalHandler;
  /**
   * The session approval policy. Defaults to `ask`, which consults `approve` when one is set.
   * `never` refuses every tool call before the handler is consulted, for a headless or CI run.
   */
  approvalPolicy?: ApprovalPolicy;
  /**
   * Tripwires on the run: `input` inspects the task before the loop starts, `output` inspects the
   * final answer before the run completes. A tripped wire halts the run with an
   * `AgentGuardrailError`.
   */
  guardrails?: Guardrails;
  /** When set, the final answer is validated against this schema before the run completes. */
  outputSchema?: z.ZodType;
}

export interface RunOptions {
  signal?: AbortSignal;
  /**
   * Start from a clean memory (the default), or continue a prior run's memory — upstream's `reset`
   * flag. A false value keeps this agent's steps and, with a store, resumes from its checkpoint.
   */
  reset?: boolean;
  /** The store key naming this run's checkpoint. A store saves and resumes only named runs. */
  checkpoint?: string;
}

/** Mutable per-run bookkeeping, handed to subclasses so they can execute an action. */
export interface RunContext {
  readonly runId: string;
  readonly task: string;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly state: Map<string, unknown>;
  readonly checkpoint: string | undefined;
  usage: TokenUsage;
  stepIndex: number;
  /** Why the latest model reply ended, so a schema failure can tell a truncation from a bad shape. */
  finishReason: FinishReason | undefined;
}

export type AgentEventListener = (event: AgentEvent) => void;

/** A listener for one event type, handed the narrowed event. */
export type AgentEventHandler<T extends AgentEventType> = (event: AgentEventOf<T>) => void;

/** How many schema-failure repairs one run may spend before the mismatch ends it. */
const MAX_ANSWER_REPAIRS = 2;

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
  readonly managedAgents: readonly ManagedAgent[];
  protected readonly logger: Logger;
  protected readonly memory = new AgentMemory();
  protected monitor: Monitor;

  /** The names of the managed agents folded into `tools`, so the prompt can render them apart. */
  private readonly managedAgentNames = new Set<string>();
  private readonly middleware: readonly AgentMiddleware[];
  private readonly customInstructions: string | undefined;
  private readonly explicitSystemPrompt: string | undefined;
  private readonly listeners = new Set<AgentEventListener>();
  private readonly store: RunStore | undefined;
  /** Repairs spent by the run in flight; the budget itself is the module constant. */
  private answerRepairs = 0;
  private readonly approve: ApprovalHandler | undefined;
  private readonly approvalPolicy: ApprovalPolicy;
  /** Set by a subclass for the duration of one step, so decisions land in that step's stream. */
  private approvalSink: ((decision: ApprovalDecision) => void) | undefined;
  private readonly guardrails: Guardrails | undefined;
  private readonly outputSchema: z.ZodType | undefined;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.approve = options.approve;
    this.approvalPolicy = options.approvalPolicy ?? "ask";
    this.store = options.store;
    this.guardrails = options.guardrails;
    this.outputSchema = options.outputSchema;
    const managedAgents = options.managedAgents ?? [];
    // Managed agents are added to this agent's registry, so a caller's registry is copied first:
    // mutating it would make a second agent built from the same registry fail on a duplicate name.
    if (options.tools instanceof ToolRegistry) {
      this.tools = managedAgents.length > 0 ? new ToolRegistry(options.tools.list()) : options.tools;
    } else {
      this.tools = new ToolRegistry(options.tools ?? []);
    }
    if (this.approve !== undefined || this.approvalPolicy === "never") {
      const approve = this.approve;
      const gate = (request: Parameters<ApprovalHandler>[0]) =>
        approve === undefined ? Promise.resolve(false) : approve(request);
      const options = { policy: this.approvalPolicy, onDecision: (d: ApprovalDecision) => this.recordApproval(d) };
      this.tools = new ToolRegistry(this.tools.list().map((entry) => withApproval(entry, gate, options)));
    }
    this.maxSteps = options.maxSteps ?? 20;
    this.planningInterval = options.planningInterval ?? 0;
    this.executionTimeoutMs = options.executionTimeoutMs ?? 30_000;
    this.logger = options.logger ?? noopLogger;
    this.middleware = options.middleware ?? [];
    this.customInstructions = options.customInstructions;
    this.explicitSystemPrompt = options.systemPrompt;
    this.monitor = new Monitor();
    this.managedAgents = managedAgents;
    for (const entry of this.managedAgents) {
      const wrapped = managedAgent(entry);
      const gated =
        this.approve === undefined && this.approvalPolicy !== "never"
          ? wrapped
          : withApproval(wrapped, this.approve ?? (() => Promise.resolve(false)), {
              policy: this.approvalPolicy,
              onDecision: (d: ApprovalDecision) => this.recordApproval(d),
            });
      this.tools.add(gated);
      this.managedAgentNames.add(wrapped.name);
    }
  }

  /**
   * Record one approval decision. A subclass sets the sink for the step it is executing, so an
   * approval always lands in the stream of the step that asked, and an ask outside a step (a
   * direct `withApproval` use) records nowhere.
   */
  protected captureApprovals(sink: ((decision: ApprovalDecision) => void) | undefined): void {
    this.approvalSink = sink;
  }

  private recordApproval(decision: ApprovalDecision): void {
    this.approvalSink?.(decision);
  }

  /** The event a decision becomes. One per ask, so the stream and the handler count agree. */
  protected approvalEvent(decision: ApprovalDecision): AgentEvent {
    const event: AgentEventOf<"approval.decided"> = {
      type: "approval.decided",
      requestId: decision.requestId,
      digest: decision.digest,
      name: decision.name,
      stepIndex: decision.stepIndex,
      outcome: decision.outcome,
      ...(decision.reason === undefined ? {} : { reason: decision.reason }),
    };
    return event;
  }

  protected get customInstructionsValue(): string | undefined {
    return this.customInstructions;
  }

  /** Tool documentation for the prompt, with managed agents left to renderManagedAgents(). */
  protected renderToolDescriptions(): string {
    return this.tools.renderDescriptions((entry) => !this.managedAgentNames.has(entry.name));
  }

  /** The "team members" section for the prompt, empty when the agent has no managed agents. */
  protected renderManagedAgents(): string {
    if (this.managedAgentNames.size === 0) return "";
    return populateTemplate(MANAGED_AGENTS_SECTION_TEMPLATE, {
      managedAgentDescriptions: this.tools.renderDescriptions((entry) =>
        this.managedAgentNames.has(entry.name),
      ),
    });
  }

  /** The prompt sent on every turn. Computed once per access so tools stay in sync. */
  get systemPrompt(): string {
    return this.explicitSystemPrompt ?? this.buildSystemPrompt();
  }

  /**
   * The run's typed steps, in the order the loop recorded them, as a frozen snapshot: the same
   * read upstream exposes as `memory.steps`. It is the one public view that covers every
   * outcome — `RunResult.steps` exists only where a result was built, and the session's step
   * list is a UI projection — so a run that threw, one that spent its budget and one that
   * finished all leave their steps readable here.
   */
  get steps(): readonly AnyAgentStep[] {
    return this.memory.steps;
  }

  /**
   * Subscribe to every event, or to one event type with a handler that receives the narrowed
   * event (design spec 6.4). Returns an unsubscribe function.
   */
  on(listener: AgentEventListener): () => void;
  on<T extends AgentEventType>(type: T, handler: AgentEventHandler<T>): () => void;
  on<T extends AgentEventType>(
    listenerOrType: AgentEventListener | T,
    handler?: AgentEventHandler<T>,
  ): () => void {
    let listener: AgentEventListener;
    if (typeof listenerOrType === "function") {
      listener = listenerOrType;
    } else {
      if (handler === undefined) {
        throw new TypeError("agent.on(type, handler) needs a handler for " + listenerOrType);
      }
      const type = listenerOrType;
      listener = (event) => {
        if (event.type === type) handler(event as AgentEventOf<T>);
      };
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * The code visible so far in a model reply that may still be arriving, for `code.delta`; `done`
   * says the reply is complete. Each call's result extends the previous one. An agent that writes
   * no code returns `undefined`, the default.
   */
  protected streamedCode(_text: string, _done: boolean): string | undefined {
    return undefined;
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
    // Every run ends in exactly one terminal event. The loop emits its own; anything that still
    // escapes it — a subclass's interpret(), a prompt builder — is reported here instead of being
    // thrown past a consumer that waits for the terminal event.
    let ended = false;
    try {
      for await (const event of this.runStream(task, options)) {
        if (isTerminal(event.type)) ended = true;
        yield event;
      }
    } catch (error) {
      if (ended) throw error;
      yield this.emit(
        options.signal?.aborted === true
          ? { type: "run.cancelled" }
          : { type: "run.failed", error: AgentError.from(error).info },
      );
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
      checkpoint: options.checkpoint,
      finishReason: undefined,
    };

    this.answerRepairs = 0;
    this.monitor = new Monitor(context.startedAt);
    yield this.emit({ type: "run.started", runId, task, modelId: this.model.id });

    if (options.reset ?? true) {
      this.memory.reset();
    } else if (this.store !== undefined && options.checkpoint !== undefined) {
      let saved: ReturnType<typeof translateSnapshot> | undefined;
      try {
        const stored = await this.store.load(options.checkpoint);
        saved = stored === undefined ? undefined : translateSnapshot(stored);
      } catch (error) {
        // A newer format is a typed refusal; anything else is the store failing to load.
        const failure =
          error instanceof RunSnapshotVersionError ? error : storeError("load", error);
        yield this.emit({ type: "run.failed", error: failure.info });
        return;
      }
      if (saved !== undefined) this.memory.restore(saved.steps);
    }
    this.memory.addStep(new TaskStep(task));
    // A continued memory already holds a system prompt, and the transcript renders the current
    // prompt in its place, so a second copy would only pile up in every checkpoint.
    if (this.memory.systemPrompt === undefined) {
      this.memory.addStep(new SystemPromptStep(this.systemPrompt));
    }

    if (this.guardrails?.input !== undefined) {
      let reason: string | undefined;
      try {
        reason = await this.guardrails.input(task, { task, signal });
      } catch (error) {
        yield this.emit({ type: "run.failed", error: guardrailError("input", error).info });
        return;
      }
      if (reason !== undefined) {
        yield this.emit({ type: "run.failed", error: new AgentGuardrailError(reason).info });
        return;
      }
    }

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
        // An abort surfaces as the model call's rejection; it is still a cancellation.
        yield this.emit(
          signal.aborted
            ? { type: "run.cancelled" }
            : { type: "run.failed", error: AgentError.from(error, "AGENT_GENERATION", stepIndex).info },
        );
        return;
      }

      context.finishReason = completion.finishReason;
      yield this.emit({ type: "message.completed", text: completion.content });

      const action = this.interpret(completion);
      const step = new ActionStep(action.raw);
      step.tokenUsage = completion.usage;
      step.toolCalls = [...completion.toolCalls];

      // No shipped flavour reads a reply as a final answer — both end through final_answer — but
      // MultiStepAgent is public and abstract, and a custom interpret() may settle the answer from
      // the text alone. The step is recorded so the answering reply stays in memory.
      if (action.kind === "final") {
        step.isFinalAnswer = true;
        this.memory.addStep(step);
        yield* this.complete(action.output, context);
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
        const saveFailure = await this.saveCheckpoint(context);
        if (saveFailure !== undefined) {
          yield this.emit({ type: "run.failed", error: saveFailure.info });
          return;
        }
        continue;
      }

      let outcome: ActionOutcome;
      try {
        outcome = yield* this.drainAction(this.composeAction(context, step, stepIndex, action));
      } catch (error) {
        const executionError = AgentError.from(error, "AGENT_EXECUTION", stepIndex);
        step.error = executionError.info;
        yield this.emit(
          signal.aborted ? { type: "run.cancelled" } : { type: "run.failed", error: executionError.info },
        );
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

      const saveFailure = await this.saveCheckpoint(context);
      if (saveFailure !== undefined) {
        yield this.emit({ type: "run.failed", error: saveFailure.info });
        return;
      }

      if (outcome.isFinalAnswer) {
        yield* this.complete(outcome.value, context);
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
    let completion: ChatCompletion;
    try {
      completion = yield* this.streamCompletion(messages, stepIndex, context, "planning");
    } catch (error) {
      if (context.signal.aborted) return { cancelled: true };
      return { failed: AgentError.from(error, "AGENT_GENERATION", stepIndex) };
    }
    const step = new PlanningStep(completion.content);
    step.tokenUsage = completion.usage;
    this.memory.addStep(step);
    yield this.emit({ type: "planning.completed", stepIndex, text: completion.content });
    const saveFailure = await this.saveCheckpoint(context);
    if (saveFailure !== undefined) return { failed: saveFailure };
    return { ok: true };
  }

  /**
   * Persist the memory as this run's checkpoint, when a store and a name were given. A store
   * failure is returned rather than thrown, so the loop can end the run on it.
   */
  private async saveCheckpoint(context: RunContext): Promise<AgentError | undefined> {
    if (this.store === undefined || context.checkpoint === undefined) return undefined;
    try {
      const snapshot: RunSnapshot = {
        formatVersion: RUN_SNAPSHOT_VERSION,
        steps: this.memory.toJSON(),
      };
      await this.store.save(context.checkpoint, snapshot);
      return undefined;
    } catch (error) {
      return storeError("save", error, context.stepIndex);
    }
  }

  /** The request options for one model turn, assembled in one place. */
  private modelOptions(context: RunContext): GenerateOptions {
    const options: GenerateOptions = { signal: context.signal };
    if (this.advertisesTools) {
      const specs = [...this.tools.toSpecs()];
      // The bound answer schema travels as the final_answer parameter schema, so the model
      // validates against the contract it will be held to instead of discovering it afterwards.
      const answer = this.finalAnswerSpec();
      if (answer !== undefined) specs.push(answer);
      if (specs.length > 0) options.tools = specs;
    }
    return options;
  }

  /** The answer schema as JSON Schema, or undefined when no schema is bound. */
  protected answerJsonSchema(): Record<string, unknown> | undefined {
    if (this.outputSchema === undefined) return undefined;
    const schema = z.toJSONSchema(this.outputSchema, { io: "output" }) as Record<string, unknown>;
    delete schema["$schema"];
    return schema;
  }

  /** The final_answer spec carrying the bound schema, for a flavour that advertises tools. */
  protected finalAnswerSpec(): ToolSpec | undefined {
    if (this.outputSchema === undefined) return undefined;
    const wrapped = z.toJSONSchema(z.object({ answer: this.outputSchema }), { io: "output" }) as Record<
      string,
      unknown
    >;
    delete wrapped["$schema"];
    if (wrapped["type"] === "object" && wrapped["additionalProperties"] === undefined) {
      wrapped["additionalProperties"] = false;
    }
    return {
      name: FINAL_ANSWER_TOOL_NAME,
      description: "Return the final answer. Its value must satisfy the declared schema.",
      inputSchema: wrapped,
    };
  }

  /** The prompt paragraph that binds the schema for a flavour without tools. */
  protected answerSchemaText(): string {
    const schema = this.answerJsonSchema();
    if (schema === undefined) return "";
    return (
      "\n\nFINAL ANSWER SCHEMA\nThe value passed to final_answer must satisfy this JSON schema:\n" +
      JSON.stringify(schema) +
      "\nA value that does not satisfy it is rejected, and the error names the offending path."
    );
  }

  /** Why a value cannot be the final answer, or undefined when it satisfies the bound schema. */
  protected invalidAnswer(value: unknown): string | undefined {
    if (this.outputSchema === undefined) return undefined;
    const parsed = this.outputSchema.safeParse(value);
    if (parsed.success) return undefined;
    const issues = parsed.error.issues.map((issue) =>
      (issue.path.length === 0 ? "(root)" : issue.path.join(".")) + ": " + issue.message,
    );
    return "The final answer failed the output schema — " + issues.join("; ");
  }

  /**
   * How one run answers a schema failure: as a correction observation, up to the repair budget,
   * then as a guardrail failure. A reply cut off by its length limit is never repaired, because
   * the missing part is not a mistake the model can correct in the next turn.
   */
  protected answerFailure(
    reason: string,
    finishReason: FinishReason | undefined,
    stepIndex: number,
  ): string {
    if (finishReason === "length") {
      throw new AgentGuardrailError(
        "The final answer failed the output schema and the reply was truncated by its length limit, so no repair was attempted: " +
          reason,
        { stepIndex },
      );
    }
    if (this.answerRepairs >= MAX_ANSWER_REPAIRS) {
      throw new AgentGuardrailError(
        "The final answer failed the output schema after " +
          String(MAX_ANSWER_REPAIRS) +
          " repair attempts: " +
          reason,
        { stepIndex },
      );
    }
    this.answerRepairs += 1;
    return "Error: " + reason;
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
      let code = "";
      let finishReason: FinishReason = "stop";
      let streamUsage: TokenUsage | undefined;

      for await (const chunk of this.model.generateStream(messages, this.modelOptions(context))) {
        if (chunk.delta !== "") {
          text += chunk.delta;
          if (kind === "planning") {
            yield this.emit({ type: "planning.delta", stepIndex, text: chunk.delta });
          } else {
            yield this.emit({ type: "message.delta", text: chunk.delta });
            code = yield* this.emitCodeDelta(text, false, code, stepIndex);
          }
        }
        if (chunk.toolCallDelta !== undefined) accumulator.accept(chunk.toolCallDelta);
        if (chunk.finishReason !== undefined) finishReason = chunk.finishReason;
        if (chunk.usage !== undefined) streamUsage = chunk.usage;
      }
      if (kind === "action") yield* this.emitCodeDelta(text, true, code, stepIndex);

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
    if (kind === "action") yield* this.emitCodeDelta(completion.content, true, "", stepIndex);
    this.monitor.record(this.model.id, completion.usage, Date.now() - startedAt);
    context.usage = addTokenUsage(context.usage, completion.usage);
    yield this.emit({ type: "usage.updated", usage: context.usage });
    return completion;
  }

  /**
   * Emit the code that `streamedCode` sees in `text` beyond what was already emitted, and return
   * the code emitted so far. Deltas only ever append: should the visible code stop extending what
   * was sent, nothing more is emitted, and `code.completed` still carries the authoritative code.
   */
  private async *emitCodeDelta(
    text: string,
    done: boolean,
    emitted: string,
    stepIndex: number,
  ): AsyncGenerator<AgentEvent, string> {
    const code = this.streamedCode(text, done);
    if (code === undefined || code.length <= emitted.length || !code.startsWith(emitted)) return emitted;
    yield this.emit({ type: "code.delta", stepIndex, text: code.slice(emitted.length) });
    return code;
  }

  /**
   * Guard the final answer, record it, and emit the terminal `run.completed` event. A tripped
   * output tripwire or an output-schema mismatch fails the run instead.
   */
  private async *complete(output: unknown, context: RunContext): AsyncGenerator<AgentEvent, void> {
    if (this.guardrails?.output !== undefined) {
      let reason: string | undefined;
      try {
        reason = await this.guardrails.output(output, { task: context.task, signal: context.signal });
      } catch (error) {
        yield this.emit({
          type: "run.failed",
          error: guardrailError("output", error, context.stepIndex).info,
        });
        return;
      }
      if (reason !== undefined) {
        yield this.emit({
          type: "run.failed",
          error: new AgentGuardrailError(reason, { stepIndex: context.stepIndex }).info,
        });
        return;
      }
    }
    let value = output;
    if (this.outputSchema !== undefined) {
      const parsed = this.outputSchema.safeParse(output);
      if (!parsed.success) {
        yield this.emit({
          type: "run.failed",
          error: new AgentGuardrailError("The final answer failed the output schema: " + parsed.error.message, {
            stepIndex: context.stepIndex,
          }).info,
        });
        return;
      }
      value = parsed.data;
    }
    this.memory.addStep(new FinalAnswerStep(value));
    yield this.emit({ type: "run.completed", result: this.buildResult(value, context, "success") });
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

/** A guardrail that throws has still stopped the run; it fails as a guardrail, not as a crash. */
function guardrailError(which: "input" | "output", error: unknown, stepIndex?: number): AgentGuardrailError {
  const message = "The " + which + " guardrail threw: " + (error instanceof Error ? error.message : String(error));
  return new AgentGuardrailError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}

function storeError(operation: "load" | "save", error: unknown, stepIndex?: number): AgentError {
  const message =
    "The run store failed to " + operation + " the checkpoint: " + (error instanceof Error ? error.message : String(error));
  return new AgentError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}