import {
  AgentBudgetExceededError,
  AgentCancelledError,
  AgentError,
  AgentGuardrailError,
  AgentMaxStepsError,
  AgentParsingError,
  RunAlreadySettledError,
  RunApprovalMismatchError,
  RunNotFoundError,
  RunNotWaitingError,
  RunRecordVersionError,
  RunRequestExpiredError,
  RunRequestMismatchError,
  StaleWriterError,
} from "../errors.js";
import {
  isTerminal,
  type AgentEvent,
  type AgentEventOf,
  type AgentEventPayload,
  type AgentEventType,
} from "../events.js";
import { type Logger, noopLogger } from "../logger.js";
import { AgentMemory } from "../memory/memory.js";
import {
  ActionStep,
  CondensationStep,
  FinalAnswerStep,
  MessageStep,
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
import type { SpanExporter } from "../monitoring/otel.js";
import { TraceBuilder } from "../monitoring/trace.js";
import { deriveCost, type ModelPrice, type RunCost } from "../monitoring/pricing.js";
import { digestOf } from "../utils/digest.js";
import { populateTemplate } from "../prompts/populate-template.js";
import {
  CODE_FENCE,
  MANAGED_AGENTS_SECTION_TEMPLATE,
  PLAN_END_TAG,
  PLANNING_INITIAL_TEMPLATE,
  PLANNING_UPDATE_SYSTEM_TEMPLATE,
  PLANNING_UPDATE_USER_TEMPLATE,
  wrapInitialPlan,
  wrapUpdatedPlan,
} from "../prompts/templates.js";
import { ToolRegistry } from "../tool/registry.js";
import {
  advertisedToolRegistry,
  applyToolPolicy,
  isEmptyToolPolicy,
  mergeToolPolicy,
  toolPolicySignature,
  validateToolPolicy,
  type MergedToolPolicy,
  type ToolPolicy,
  type ToolPolicyContext,
  type ToolPolicyProvider,
} from "../tool/policy.js";
import { ToolDefinitionError, type Tool } from "../tool/tool.js";
import {
  type ChatMessage,
  type TokenUsage,
  type ToolCall,
  EMPTY_TOKEN_USAGE,
  addTokenUsage,
} from "../types.js";
import { makeRunResult, type RunResult, type RunState } from "./run-result.js";
import { FINAL_ANSWER_TOOL_NAME, type ActionOutcome, type InterpretedAction } from "./action.js";
import { managedAgent, type ManagedAgent } from "./managed-agent.js";
import { isTransferSignal, transferTool, type TransferSignal, type TransferTarget } from "./transfer.js";
import {
  withApproval,
  type ApprovalDecision,
  type ApprovalHandler,
  type ApprovalPolicy,
  type ApprovalRequest,
  type ApprovalVerdict,
  type SettledApprovalOutcome,
} from "./approval.js";
import type { Guardrails } from "./guardrail.js";
import {
  RUN_RECORD_VERSION,
  translateRecord,
  type ApprovalSettlement,
  type CompletedStep,
  type JournalEntry,
  type OpenStep,
  type PendingApproval,
  type RunEventEntry,
  type RunRecord,
  type RunStatus,
} from "../session/run-record.js";
import type { RunStore } from "../session/run-store.js";
import { undeliveredMessages, type RunMessage } from "../session/messages.js";
import {
  budgetSeedFromSteps,
  resolveBudget,
  spendBudget,
  spendCostBudget,
  type LimitStopReason,
  type RunBudget,
  type RunBudgetHandle,
  type RunLimits,
} from "../session/budget.js";
import { z } from "zod";

export interface AgentOptions {
  model: Model;
  tools?: readonly Tool[] | ToolRegistry;
  /** Hard cap on action steps. Defaults to 20. */
  maxSteps?: number;
  /**
   * Plan before the first action, then again every N steps: `0` disables planning, and `N` plans at
   * step 0, N, 2N and so on. Defaults to 0.
   */
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
   * Team members the model may hand the conversation to instead of answering. Each becomes a
   * `transfer_to_<name>` tool; calling one ends this run with `run.transferred` and a
   * `TransferSignal`, and the target's own run is the caller's to start.
   */
  transfers?: readonly TransferTarget[];
  /**
   * Opt-in condensation: when the transcript's estimated size crosses a threshold, the oldest
   * action steps are hidden behind a summary step and a `memory.condensed` event names them.
   * Off by default, so no existing run condenses.
   */
  condensation?: CondensationOptions;
  /**
   * Where a run's record lives. With a `runId` on the run, the agent commits the record after
   * each boundary and reads it back to resume, so a run survives its process.
   */
  store?: RunStore;
  /** How many emitted events the record retains for a reconnecting reader. Defaults to 256. */
  maxRecordedEvents?: number;
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
  /**
   * What a run may spend: model turns, completion tokens and total tokens. Each requested limit
   * is clamped by the deployment ceiling (`RUN_LIMITS_CEILING`); a run that crosses one ends with
   * a typed `run.limitReached` reason. Omitted fields take the ceiling.
   */
  limits?: RunLimits;
  /**
   * What this run may show and call, as data. A policy narrows the registered tools; a provider
   * is asked once per step and may narrow it further. Omitted, every tool is visible and callable,
   * exactly as before.
   */
  toolPolicy?: ToolPolicy | ToolPolicyProvider;
  /**
   * Where a finished trace goes. Omitted, no trace is built and nothing is exported; installed,
   * the run hands one OTel-shaped tree to it after its terminal event, and an export that throws
   * is logged instead of failing the run.
   */
  exporter?: SpanExporter;
  /**
   * The prices a cost limit is checked against. Omitted, the shipped dated table is used; a model
   * it does not price has no cost, so a cost limit cannot stop that run. A run reports the cost it
   * worked out on its result, and the date of the row it used.
   */
  priceTable?: readonly ModelPrice[];
  /**
   * Options handed to every model turn beneath the ones the loop builds: a pinned temperature, a
   * per-run cache hint. The loop's own signal and advertised tools win over a caller's copy.
   */
  modelOptions?: GenerateOptions;
}

/** One step's resolved view of the tool set: what is advertised, what runs, and the policy. */
interface StepToolView {
  readonly advertised: ToolRegistry;
  readonly registry: ToolRegistry;
  readonly policy: MergedToolPolicy;
}

/**
 * The condensation budget. The estimate is a heuristic over the transcript, not a provider's
 * tokenizer: the loop asks before a model call, so it needs a number before the usage arrives.
 */
export interface CondensationOptions {
  /** Estimated tokens at which a condensation is due. */
  readonly softLimit: number;
  /** Estimated tokens at which the next model call is unsafe without condensing. */
  readonly hardLimit: number;
  /** The newest action steps never forgotten. Defaults to 4. */
  readonly keepRecent?: number;
  /** Produces the summary; absent uses a deterministic one. A throw defers a soft trigger. */
  readonly summarize?: (
    forgotten: readonly AnyAgentStep[],
    transcript: readonly ChatMessage[],
  ) => string | Promise<string>;
  /** Estimates the transcript's size. Defaults to ceil(characters / 4). */
  readonly estimate?: (messages: readonly ChatMessage[]) => number;
}

export interface RunOptions {
  signal?: AbortSignal;
  /**
   * Start from a clean memory (the default), or continue a prior run's memory — upstream's `reset`
   * flag. A false value keeps this agent's steps and, with a store, resumes from its record.
   */
  reset?: boolean;
  /**
   * The run's durable identity. With a store, the loop commits its record under this id and a
   * run with `reset: false` resumes it; without one the run is addressed by a generated id.
   */
  runId?: string;
  /**
   * A caller-held budget to continue: its counters are carried into this run instead of a fresh
   * budget being made, so a second run keeps counting against the same limits. A resumed run
   * without a handle seeds its counters from the steps its record already holds.
   */
  budget?: RunBudgetHandle;
  /**
   * Continue a run from its record. With `requestId` and `outcome`, settle that pending request
   * exactly once and re-enter the unfinished step; without them, repair a record whose process
   * died by closing its open step as interrupted and running forward.
   */
  resume?: { readonly requestId?: string; readonly outcome?: SettledApprovalOutcome };
  /** The owner name this run claims its record under. Defaults to a fresh id per run. */
  owner?: string;
  /**
   * The conversation this run belongs to. The record keeps it, so a later run can find the
   * newest record of the conversation instead of starting from nothing.
   */
  conversationId?: string;
  /**
   * The agents to report in every event's path, root first. A managed child appends its own
   * name to its parent's path; an ordinary run leaves this empty.
   */
  agentPath?: readonly string[];
  /**
   * The run that started this one as a background child. Unlike a fork this copies no memory:
   * the child is a fresh run that names its parent so the parent's row and the child's record
   * point at each other.
   */
  parentRunId?: string;
  /**
   * Branch a fresh run from a parent record at one of its steps. The child copies the parent's
   * memory and journal up to that step, names the parent on its own record, and re-enters the
   * step with the copied journal, so a recorded effect replays instead of running twice.
   */
  fork?: { readonly fromRunId: string; readonly atStep: number };
}

/** Mutable per-run bookkeeping, handed to subclasses so they can execute an action. */
export interface RunContext {
  readonly runId: string;
  readonly task: string;
  readonly signal: AbortSignal;
  readonly startedAt: number;
  readonly state: Map<string, unknown>;
  /** Whether this run has a store and an id to commit under. */
  readonly durable: boolean;
  /** The fence number the record carries; Phase 1.3 is the first item that changes it. */
  generation: number;
  readonly createdAt: string;
  usage: TokenUsage;
  /**
   * The live trace fold, allocated only for a run whose caller installed an exporter. Absent,
   * the loop never builds a tree and nothing is exported.
   */
  trace: TraceBuilder | undefined;
  /** The run's budget record: clamped limits plus what it has spent so far. */
  readonly budget: RunBudget;
  /** Set by the model turn that exhausted the budget; the loop ends the run on it. */
  limitReached: LimitStopReason | undefined;
  stepIndex: number;
  /** Why the latest model reply ended, so a schema failure can tell a truncation from a bad shape. */
  finishReason: FinishReason | undefined;
  /** The request this run is parked on, while it waits for a resume. */
  pending: PendingApproval | undefined;
  /** The settlement this run was resumed for; the gate honours it for this step and digest only. */
  resumedSettlement: ApprovalSettlement | undefined;
  /** Every settlement the record holds, so a commit never drops one. */
  settlements: readonly ApprovalSettlement[];
  /** The memory as the last successful commit wrote it, so a park replays from that boundary. */
  committedSteps: RunRecord["memory"]["steps"];
  /** The claim holder written on every commit; dropped by a terminal commit. */
  owner: string;
  /** The conversation the record is tagged with, kept across a resume or left absent. */
  conversationId: string | undefined;
  /** The messages the record holds, delivered or not; the loop appends and stamps deliveries. */
  messages: RunMessage[];
  /** The agents this run produced events as, root first; empty at the root. */
  readonly agentPath: readonly string[];
  /** The declared target this run handed the conversation to, once it has. */
  transfer: TransferSignal | undefined;
  /** Background children this run started, when the loop itself started them. */
  children: RunRecord["children"];
  /** The parent run and step of a fork, written on every commit of the branch. */
  parentRunId: string | undefined;
  parentStep: number | undefined;
  /** Finished steps, the closer a repair appended included. */
  completed: CompletedStep[];
  /** The step in flight, committed while it runs so a repair can name it. */
  openStep: OpenStep | undefined;
  /** The effects journaled so far, in announcement order; each write commits the record. */
  journal: JournalEntry[];
  /** A step attempt a repair or a resume re-enters, whose journal replay belongs to it. */
  replayStepId: string | undefined;
  /** Serialises commits, so two effects in one code block cannot interleave a record. */
  commitTail: Promise<void>;
  /** The seq the next emitted event gets; seeded past the record's tail when one is loaded. */
  nextSeq: number;
  /** Events emitted since the last commit, appended to the recorded tail when it lands. */
  events: RunEventEntry[];
  /** The tail the last commit wrote, kept so a commit appends rather than rebuilds it. */
  recordedEvents: RunEventEntry[];
}

export type AgentEventListener = (event: AgentEvent) => void;

/** A listener for one event type, handed the narrowed event. */
export type AgentEventHandler<T extends AgentEventType> = (event: AgentEventOf<T>) => void;

/** How many schema-failure repairs one run may spend before the mismatch ends it. */
const MAX_ANSWER_REPAIRS = 2;

/** How many policy refusals one run may spend before the unmet requirement ends it. */
const MAX_POLICY_REPAIRS = 2;

/** The step ceiling a planning update tells the planner it still has, as upstream does. */
function remainingStepsAfter(stepIndex: number, maxSteps: number): number {
  return maxSteps - stepIndex - 1;
}

/**
 * The ReAct loop, shared by every agent flavour (design spec 6.2).
 *
 * Subclasses supply exactly three things: the system prompt, how to read a model reply,
 * and how to execute the action it names. Everything else — memory, events, accounting,
 * cancellation, middleware — lives here so it cannot drift between flavours.
 */
export abstract class MultiStepAgent<TOut = unknown> {
  readonly model: Model;
  /** The registry, rewritten once when the approval gate is installed. */
  tools: ToolRegistry;
  readonly maxSteps: number;
  readonly planningInterval: number;
  readonly executionTimeoutMs: number;
  readonly managedAgents: readonly ManagedAgent[];
  /** The declared transfer targets, kept so a test or a caller can read the declaration back. */
  readonly transfers: readonly TransferTarget[];
  readonly limits: RunLimits;
  protected readonly logger: Logger;
  protected readonly memory = new AgentMemory();
  protected monitor: Monitor;

  /** The names of the managed agents folded into `tools`, so the prompt can render them apart. */
  private readonly managedAgentNames = new Set<string>();
  /** The transfer tool names this agent declared, so only a declared handover is recognised. */
  private readonly transferNames = new Set<string>();
  private readonly middleware: readonly AgentMiddleware[];
  private readonly customInstructions: string | undefined;
  private readonly explicitSystemPrompt: string | undefined;
  private readonly listeners = new Set<AgentEventListener>();
  /** The run in flight, so a throw that escapes the loop can still commit its failure. */
  private activeContext: RunContext | undefined;
  private readonly store: RunStore | undefined;
  private readonly maxRecordedEvents: number;
  /** Repairs spent by the run in flight; the budget itself is the module constant. */
  private answerRepairs = 0;
  private readonly approve: ApprovalHandler | undefined;
  private readonly approvalPolicy: ApprovalPolicy;
  /** Set by a subclass for the duration of one step, so decisions land in that step's stream. */
  private approvalSink: ((decision: ApprovalDecision) => void) | undefined;
  /** The pending decision the loop parks on, set when a gate answers `pending`. */
  private parkingDecision: ApprovalDecision | undefined;
  /** Whether the approval gate already wraps this agent's tools. */
  private toolsGated = false;
  private readonly guardrails: Guardrails | undefined;
  private readonly outputSchema: z.ZodType | undefined;
  private readonly condensation: CondensationOptions | undefined;
  /** The run's tool policy, or the provider the loop asks once per step. */
  private readonly toolPolicy: ToolPolicy | ToolPolicyProvider | undefined;
  /** The step in flight's resolved tool view; undefined until the first step resolves one. */
  private stepView: StepToolView | undefined;
  /** The exporter a caller installed; undefined means this agent never builds a trace. */
  private readonly exporter: SpanExporter | undefined;
  /** The price rows this agent costs a run against; undefined means the shipped table. */
  private readonly priceTable: readonly ModelPrice[] | undefined;
  /** The options a caller pinned for every model turn, beneath the ones the loop builds. */
  private readonly baseModelOptions: GenerateOptions;
  /** Refusals spent by the run in flight; the budget itself is the module constant. */
  private policyRepairs = 0;
  /** Tool names that completed a call in this run, for a "require" check. */
  private readonly policyCalled = new Set<string>();
  /** Tool names that completed a call in the step in flight, for a "forced" check. */
  private stepCalled = new Set<string>();
  /** What the last announced view looked like, so an unchanged policy is not re-announced. */
  private lastPolicySignature: string | undefined;

  constructor(options: AgentOptions) {
    this.model = options.model;
    this.limits = options.limits ?? {};
    this.approve = options.approve;
    this.approvalPolicy = options.approvalPolicy ?? "ask";
    this.store = options.store;
    this.maxRecordedEvents = options.maxRecordedEvents ?? 256;
    this.guardrails = options.guardrails;
    this.outputSchema = options.outputSchema;
    this.condensation = options.condensation;
    this.toolPolicy = options.toolPolicy;
    this.exporter = options.exporter;
    this.priceTable = options.priceTable;
    this.baseModelOptions = options.modelOptions ?? {};
    const managedAgents = options.managedAgents ?? [];
    const transfers = options.transfers ?? [];
    // Managed agents and transfers are added to this agent's registry, so a caller's registry is
    // copied first: mutating it would make a second agent built from it fail on a duplicate name.
    if (options.tools instanceof ToolRegistry) {
      this.tools =
        managedAgents.length > 0 || transfers.length > 0
          ? new ToolRegistry(options.tools.list())
          : options.tools;
    } else {
      this.tools = new ToolRegistry(options.tools ?? []);
    }
    if (this.approve !== undefined || this.approvalPolicy === "never") {
      this.ensureApprovalGate();
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
    this.transfers = transfers;
    for (const entry of this.transfers) {
      if (entry.agent === this) {
        throw new ToolDefinitionError(
          "Transfer target " + JSON.stringify(entry.name) + " is this agent; a run cannot transfer to itself.",
        );
      }
      const wrapped = transferTool(entry);
      if (this.transferNames.has(wrapped.name)) {
        throw new ToolDefinitionError(
          "Two transfer targets are named " + JSON.stringify(entry.name) + ".",
        );
      }
      const gated =
        this.approve === undefined && this.approvalPolicy !== "never"
          ? wrapped
          : withApproval(wrapped, this.approve ?? (() => Promise.resolve(false)), {
              policy: this.approvalPolicy,
              onDecision: (d: ApprovalDecision) => this.recordApproval(d),
            });
      this.tools.add(gated);
      this.transferNames.add(wrapped.name);
    }
    // A static policy is checked where it is declared; a provider's answer is checked per step,
    // because only then does the loop know which names it names.
    if (this.toolPolicy !== undefined && typeof this.toolPolicy !== "function") {
      validateToolPolicy(this.tools, this.toolPolicy);
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

  /**
   * Put the gate in front of every tool. Built eagerly when a handler or the `never` policy is
   * configured; a resumed run also needs it even without either, because its settlement must be
   * honoured — and a call it does not match must be refused rather than run ungated.
   */
  private ensureApprovalGate(): void {
    if (this.toolsGated) return;
    this.toolsGated = true;
    const gate = (request: ApprovalRequest) => this.gateAnswer(request);
    const options = { policy: this.approvalPolicy, onDecision: (d: ApprovalDecision) => this.recordApproval(d) };
    this.tools = new ToolRegistry(this.tools.list().map((entry) => withApproval(entry, gate, options)));
  }

  private recordApproval(decision: ApprovalDecision): void {
    if (decision.outcome === "pending") this.parkingDecision = decision;
    this.approvalSink?.(decision);
  }

  /**
   * The one gate every ask goes through. A run resumed for this step answers from its settlement
   * when the argument digest matches; a different call in the same step is a typed refusal; every
   * other ask is the caller's handler.
   */
  private gateAnswer(request: ApprovalRequest): ApprovalVerdict | boolean | Promise<ApprovalVerdict | boolean> {
    const settlement = this.activeContext?.resumedSettlement;
    if (settlement !== undefined && settlement.stepIndex === request.stepIndex) {
      if (settlement.argsDigest === request.digest) {
        return { requestId: request.requestId, digest: request.digest, outcome: settlement.outcome };
      }
      throw new RunApprovalMismatchError(
        "The resumed step asked for '" +
          request.name +
          "' with arguments whose digest is " +
          request.digest +
          ", not the settled " +
          settlement.argsDigest +
          ". The run runs no effect on a call it was not resumed for.",
        { stepIndex: request.stepIndex },
      );
    }
    if (this.approve === undefined || this.approvalPolicy === "never") return false;
    return this.approve(request);
  }

  /** The event a decision becomes. One per ask, so the stream and the handler count agree. */
  protected approvalEvent(decision: ApprovalDecision): AgentEventOf<"approval.decided"> {
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

  /** The step's advertised tools: what the prompt and the request may name. */
  protected advertisedRegistry(): ToolRegistry {
    return this.stepView?.advertised ?? this.tools;
  }

  /** The step's runnable tools: what the executor and the lookup may run, hidden ones stubbed. */
  protected stepRegistry(): ToolRegistry {
    return this.stepView?.registry ?? this.tools;
  }


  /**
   * Ask the policy for this step and build the one view every reader uses: the advertised
   * registry for the prompt and the request, the runnable registry for the executor and the
   * lookup. Called once per step, before the request is built.
   */
  private async resolveStepView(context: RunContext, stepIndex: number): Promise<StepToolView> {
    const policy = this.toolPolicy;
    let merged: MergedToolPolicy;
    if (typeof policy === "function") {
      const contextForPolicy: ToolPolicyContext = {
        runId: context.runId,
        stepIndex,
        task: context.task,
        memory: this.memory,
        state: context.state as ReadonlyMap<string, unknown>,
        usage: context.usage,
      };
      const stepPolicy = await policy(contextForPolicy);
      validateToolPolicy(this.tools, stepPolicy, "The tool policy provider");
      merged = mergeToolPolicy(undefined, stepPolicy);
    } else {
      merged = mergeToolPolicy(undefined, policy);
    }
    return {
      advertised: advertisedToolRegistry(this.tools, merged),
      registry: applyToolPolicy(this.tools, merged),
      policy: merged,
    };
  }

  /** The forced and required entries an answer has not satisfied yet. */
  private unmetPolicy(policy: MergedToolPolicy): { tool: string; reason: string }[] {
    const unmet: { tool: string; reason: string }[] = [];
    for (const name of policy.forced) {
      if (!this.stepCalled.has(name)) {
        unmet.push({ tool: name, reason: "this step must call " + name + " before it answers" });
      }
    }
    for (const entry of policy.required) {
      if (!this.policyCalled.has(entry.tool)) unmet.push({ tool: entry.tool, reason: entry.reason });
    }
    return unmet;
  }

  /** The correction an unmet policy earns, or the guardrail error that ends the run past it. */
  private policyRefusal(
    unmet: readonly { tool: string; reason: string }[],
  ): string | AgentGuardrailError {
    const detail = unmet.map((entry) => entry.tool + " (" + entry.reason + ")").join("; ");
    if (this.policyRepairs >= MAX_POLICY_REPAIRS) {
      return new AgentGuardrailError(
        "The step's tool policy is still unmet after " +
          String(MAX_POLICY_REPAIRS) +
          " repairs: " +
          detail,
      );
    }
    this.policyRepairs += 1;
    return "Error: this answer cannot be accepted until the tool policy is met — " + detail + ".";
  }

  /** Record the tools a step actually ran, before an answer is checked against the policy. */
  private recordPolicyCalls(calls: readonly ToolCall[]): void {
    for (const call of calls) {
      if (call.error !== undefined) continue;
      this.policyCalled.add(call.name);
      this.stepCalled.add(call.name);
    }
  }

  /** Tool documentation for the prompt, with managed agents left to renderManagedAgents(). */
  protected renderToolDescriptions(): string {
    return this.advertisedRegistry().renderDescriptions(
      (entry) => !this.managedAgentNames.has(entry.name),
    );
  }

  /**
   * The paragraph that names what the step's policy requires. Empty when it requires nothing, so
   * a run without a policy sends exactly the prompt it sent before.
   */
  protected renderToolPolicyNotice(): string {
    const policy = this.stepView?.policy;
    if (policy === undefined) return "";
    const lines: string[] = [];
    if (policy.forced.length > 0) {
      lines.push(
        "This step must call: " + policy.forced.join(", ") + ". Do not answer before you have called it.",
      );
    }
    for (const entry of policy.required) {
      lines.push("The run must call " + entry.tool + " before it answers: " + entry.reason + ".");
    }
    return lines.length === 0
      ? ""
      : ["", "", "TOOL REQUIREMENTS", ...lines].join(String.fromCharCode(10));
  }

  /** The "team members" section for the prompt, empty when the agent has no managed agents. */
  protected renderManagedAgents(): string {
    if (this.managedAgentNames.size === 0) return "";
    return populateTemplate(MANAGED_AGENTS_SECTION_TEMPLATE, {
      managedAgentDescriptions: this.advertisedRegistry().renderDescriptions((entry) =>
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
        if (event.type === type) handler(event as unknown as AgentEventOf<T>);
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
  ): AsyncGenerator<AgentEventPayload, ActionOutcome>;

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
        case "run.waiting":
          completed = event.result as RunResult<TOut>;
          break;
        case "run.transferred":
          completed = event.result as RunResult<TOut>;
          break;
        case "run.maxStepsReached":
          failure = new AgentMaxStepsError(
            "Reached the maximum number of steps (" + String(event.steps) + ")",
          );
          break;
        case "run.limitReached":
          failure = new AgentBudgetExceededError(
            "The run reached its budget (" + event.reason + ")",
            { reason: event.reason },
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
      // A throw that escaped the loop still leaves a record: commit the failure before reporting.
      const context = this.activeContext;
      const terminal = this.emit(
        options.signal?.aborted === true
          ? { type: "run.cancelled" }
          : { type: "run.failed", error: AgentError.from(error).info },
      );
      if (context !== undefined) await this.commitRun(context, "failed");
      ended = true;
      yield terminal;
    } finally {
      const context = this.activeContext;
      this.activeContext = undefined;
      if (ended && context?.trace !== undefined && this.exporter !== undefined) {
        // Telemetry is a side channel: a failing exporter is a warning, never the run's ending.
        try {
          await this.exporter.export(context.trace.finish(), {
            runId: context.runId,
            modelId: this.model.id,
            provider: this.model.provider,
            task: context.task,
          });
        } catch (error) {
          this.logger.warn("The trace exporter threw; the run's result stands", error);
        }
      }
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
    const runId = options.runId ?? crypto.randomUUID();
    const fork = options.fork;
    const signal = options.signal ?? new AbortController().signal;
    const context: RunContext = {
      runId,
      task,
      signal,
      startedAt: Date.now(),
      state: new Map<string, unknown>(),
      usage: EMPTY_TOKEN_USAGE,
      trace: this.exporter === undefined ? undefined : new TraceBuilder(),
      budget: options.budget?.budget ?? resolveBudget(this.limits),
      limitReached: undefined,
      stepIndex: 0,
      durable: this.store !== undefined && (options.runId !== undefined || fork !== undefined),
      generation: 0,
      createdAt: new Date().toISOString(),
      finishReason: undefined,
      pending: undefined,
      resumedSettlement: undefined,
      settlements: [],
      committedSteps: [],
      owner: options.owner ?? crypto.randomUUID(),
      conversationId: options.conversationId,
      messages: [],
      agentPath: options.agentPath ?? [],
      transfer: undefined,
      children: undefined,
      parentRunId: options.parentRunId,
      parentStep: undefined,
      completed: [],
      openStep: undefined,
      journal: [],
      replayStepId: undefined,
      commitTail: Promise.resolve(),
      nextSeq: 1,
      events: [],
      recordedEvents: [],
    };

    this.activeContext = context;
    this.parkingDecision = undefined;
    this.answerRepairs = 0;
    this.policyRepairs = 0;
    this.policyCalled.clear();
    this.stepCalled = new Set<string>();
    this.stepView = undefined;
    this.lastPolicySignature = undefined;
    if (options.resume !== undefined) this.ensureApprovalGate();
    this.monitor = new Monitor(context.startedAt);

    // A durable run's first event must be numbered past the tail its record already holds, so the
    // record is read before run.started. The claim below still compare-and-sets the generation, so
    // a writer that lands between this read and the claim is refused rather than overwritten.
    const store = this.store;
    const storedRunId = options.runId;
    const lookup =
      fork === undefined &&
      store !== undefined &&
      storedRunId !== undefined &&
      !((options.reset ?? true) && options.resume === undefined);
    let loaded: RunRecord | undefined;
    let loadFailure: AgentError | undefined;
    if (lookup && store !== undefined && storedRunId !== undefined) {
      try {
        const stored = await store.load(storedRunId);
        loaded = stored === undefined ? undefined : translateRecord(stored, storedRunId);
      } catch (error) {
        // A newer format is a typed refusal; anything else is the store failing to load.
        loadFailure = error instanceof RunRecordVersionError ? error : storeError("load", error);
      }
      if (loaded !== undefined) {
        context.recordedEvents = [...(loaded.events ?? [])];
        context.nextSeq = (loaded.events?.at(-1)?.seq ?? 0) + 1;
      }
    }

    yield this.emit({
      type: "run.started",
      runId,
      task,
      modelId: this.model.id,
      provider: this.model.provider,
    });
    if (loadFailure !== undefined) {
      yield this.emit({ type: "run.failed", error: loadFailure.info });
      return;
    }

    if (fork !== undefined) {
      const failure = await this.loadFork(context, fork);
      if (failure !== undefined) {
        yield this.emit({ type: "run.failed", error: failure.info });
        return;
      }
    } else if ((options.reset ?? true) && options.resume === undefined) {
      this.memory.reset();
    } else if (lookup && store !== undefined && storedRunId !== undefined) {
      const resume = options.resume;
      // Validate before claiming: a refused resume must leave the record exactly as it found it.
      if (resume !== undefined) {
        const refusal = this.validateResume(loaded, resume);
        if (refusal !== undefined) {
          yield this.emit({ type: "run.failed", error: refusal.info });
          return;
        }
      } else if (loaded !== undefined && loaded.status === "waiting" && loaded.pending !== undefined) {
        yield this.emit({
          type: "run.failed",
          error: new RunNotWaitingError(
            "The run is waiting on request " +
              loaded.pending.requestId +
              "; resume it instead of running it again.",
          ).info,
        });
        return;
      }
      if (loaded !== undefined) {
        // One owner at a time: the claim fences every commit that follows.
        let claimed: RunRecord;
        try {
          claimed = await store.claim(storedRunId, loaded.generation, context.owner);
        } catch (error) {
          yield this.emit({ type: "run.failed", error: AgentError.from(error).info });
          return;
        }
        loaded = claimed;
        context.generation = claimed.generation;
        // A run resumed without a conversation keeps the one its record carries.
        context.conversationId = options.conversationId ?? claimed.conversationId;
        context.messages = [...(claimed.messages ?? [])];
        context.settlements = claimed.settlements ?? [];
        context.completed = [...(claimed.completed ?? [])];
        context.journal = [...(claimed.journal ?? [])];
        context.committedSteps = claimed.memory.steps;
        this.memory.restore(claimed.memory.steps);
        if (resume !== undefined && claimed.status === "waiting") {
          const settled = this.consumeResume(context, claimed, resume);
          if (settled !== undefined) {
            yield this.emit({ type: "run.failed", error: settled.info });
            return;
          }
          // Consume the pause before re-entering the step: a crash past this point leaves a
          // running record, never a request that could be settled twice.
          const commitFailure = await this.commitRun(context, "running");
          if (commitFailure !== undefined) {
            yield* this.failRun(context, commitFailure);
            return;
          }
          const settlement = context.resumedSettlement as ApprovalSettlement;
          yield this.emit({
            type: "run.resumed",
            runId,
            requestId: settlement.requestId,
            outcome: settlement.outcome,
          });
        } else if (claimed.status === "running") {
          // The process that owned this record died mid-step: keep every step, close the open
          // one as interrupted and run forward from the next index.
          this.repairOpenStep(context, claimed);
        }
      }
      // A resumed run continues the budget its record already spent. Without a store there is
      // nothing to seed from, and without a handle the caller asked for a fresh run.
      if (loaded !== undefined && options.budget === undefined) {
        const seed = budgetSeedFromSteps(this.memory.steps);
        context.budget.turns = seed.turns ?? 0;
        context.budget.outputTokens = seed.outputTokens ?? 0;
        context.budget.totalTokens = seed.totalTokens ?? 0;
      }
    } else if (options.resume !== undefined) {
      yield this.emit({
        type: "run.failed",
        error: new RunNotFoundError(
          "A resume needs a store and the runId of the parked run, so there is nothing to load.",
        ).info,
      });
      return;
    }
    if (options.resume === undefined && fork === undefined) this.memory.addStep(new TaskStep(task));
    // A fork continues the budget its copied steps already spent.
    if (fork !== undefined && options.budget === undefined) {
      const seed = budgetSeedFromSteps(this.memory.steps);
      context.budget.turns = seed.turns ?? 0;
      context.budget.outputTokens = seed.outputTokens ?? 0;
      context.budget.totalTokens = seed.totalTokens ?? 0;
    }
    // A continued memory already holds a system prompt, and the transcript renders the current
    // prompt in its place, so a second copy would only pile up in every record.
    if (this.memory.systemPrompt === undefined) {
      this.memory.addStep(new SystemPromptStep(this.systemPrompt));
    }
    // What a park replays from: everything recorded before the step it parks in.
    context.committedSteps = this.memory.toJSON();

    if (this.guardrails?.input !== undefined) {
      let reason: string | undefined;
      try {
        reason = await this.guardrails.input(task, { task, signal });
      } catch (error) {
        yield* this.failRun(context, guardrailError("input", error));
        return;
      }
      if (reason !== undefined) {
        yield* this.failRun(context, new AgentGuardrailError(reason));
        return;
      }
    }

    if (signal.aborted) {
      yield* this.cancelRun(context);
      return;
    }

    // A resumed run may already have spent its budget; it must say so instead of spending one
    // more turn and crossing the limit a second time.
    const preExhausted = exhaustedBudget(context.budget);
    if (preExhausted !== undefined) {
      yield* this.limitRun(context, preExhausted);
      return;
    }

    for (let stepIndex = context.stepIndex; stepIndex < this.maxSteps; stepIndex += 1) {
      context.stepIndex = stepIndex;

      if (signal.aborted) {
        yield* this.cancelRun(context);
        return;
      }

      // A message sent while the last step ran becomes a step of its own before this turn.
      const deliveryFailure = await this.deliverMessages(context);
      if (deliveryFailure !== undefined) {
        yield* this.failRun(context, deliveryFailure);
        return;
      }

      yield* this.maybeCondense();

      if (this.planningInterval > 0 && (stepIndex === 0 || stepIndex % this.planningInterval === 0)) {
        const planning = yield* this.runPlanningStep(stepIndex, context);
        if ("cancelled" in planning) {
          yield* this.cancelRun(context);
          return;
        }
        if ("failed" in planning) {
          yield* this.failRun(context, planning.failed);
          return;
        }
        if (context.limitReached !== undefined) {
          yield* this.limitRun(context, context.limitReached);
          return;
        }
      }

      this.stepCalled = new Set<string>();
      this.beginAttempt(context, stepIndex);
      yield this.emit({ type: "step.started", stepIndex });

      // One policy resolution per step, before the request is built: every reader below uses it.
      let view: StepToolView;
      try {
        view = await this.resolveStepView(context, stepIndex);
      } catch (error) {
        yield* this.failRun(context, AgentError.from(error, "AGENT_EXECUTION", stepIndex));
        return;
      }
      this.stepView = view;
      if (!isEmptyToolPolicy(view.policy)) {
        const signature = toolPolicySignature(view.policy);
        if (signature !== this.lastPolicySignature) {
          this.lastPolicySignature = signature;
          yield this.emit({
            type: "tool.policy",
            stepIndex,
            advertised: view.advertised.list().map((entry) => entry.name),
            hidden: [...view.policy.hidden],
            forced: [...view.policy.forced],
            required: [...view.policy.required],
          });
        }
      }

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
        if (signal.aborted) yield* this.cancelRun(context);
        else yield* this.failRun(context, AgentError.from(error, "AGENT_GENERATION", stepIndex));
        return;
      }

      context.finishReason = completion.finishReason;
      yield this.emit({ type: "message.completed", text: completion.content });
      if (context.limitReached !== undefined) {
        yield* this.limitRun(context, context.limitReached);
        return;
      }

      const action = this.interpret(completion);
      const step = new ActionStep(action.raw);
      step.tokenUsage = completion.usage;
      step.toolCalls = [...completion.toolCalls];

      // A subclass may settle the answer from the text alone — a tool-calling agent on a model
      // that cannot call tools does exactly that. A wrong-shaped text answer gets the same repair
      // turn as a wrong-shaped final_answer call, so the schema is enforced on both paths.
      if (action.kind === "final") {
        // A text answer still has to satisfy the step's tool policy before it can be accepted.
        const unmet = this.unmetPolicy(view.policy);
        if (unmet.length > 0) {
          const refusal = this.policyRefusal(unmet);
          if (refusal instanceof AgentGuardrailError) {
            yield* this.failRun(context, refusal);
            return;
          }
          for (const entry of unmet) {
            yield this.emit({
              type: "tool.requirementUnmet",
              stepIndex,
              tool: entry.tool,
              reason: entry.reason,
            });
          }
          step.observations = refusal;
          this.memory.addStep(step);
          yield this.emit({
            type: "observation.completed",
            stepIndex,
            text: refusal,
            isFinalAnswer: false,
          });
          const saveFailure = await this.commitAfterStep(context);
          if (saveFailure !== undefined) {
            yield* this.failRun(context, saveFailure);
            return;
          }
          continue;
        }
        const invalid = this.invalidAnswer(action.output);
        if (invalid !== undefined) {
          const correction = this.answerFailure(invalid, context.finishReason, stepIndex);
          step.observations = correction;
          this.memory.addStep(step);
          yield this.emit({
            type: "observation.completed",
            stepIndex,
            text: correction,
            isFinalAnswer: false,
          });
          const saveFailure = await this.commitAfterStep(context);
          if (saveFailure !== undefined) {
            yield* this.failRun(context, saveFailure);
            return;
          }
          continue;
        }
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
        const saveFailure = await this.commitAfterStep(context);
        if (saveFailure !== undefined) {
          yield* this.failRun(context, saveFailure);
          return;
        }
        continue;
      }

      let outcome: ActionOutcome;
      try {
        outcome = yield* this.drainAction(this.composeAction(context, step, stepIndex, action));
      } catch (error) {
        // A gate that answered `pending` parks the run; the error it threw is that park, not a
        // failed call. A resumed call that does not match its settlement keeps its typed error.
        if (this.parkingDecision !== undefined) {
          yield* this.parkRun(context);
          return;
        }
        if (error instanceof RunApprovalMismatchError) {
          yield this.emit({ type: "run.failed", error: error.info });
          return;
        }
        const executionError = AgentError.from(error, "AGENT_EXECUTION", stepIndex);
        step.error = executionError.info;
        if (signal.aborted) yield* this.cancelRun(context);
        else yield* this.failRun(context, executionError);
        return;
      }
      if (this.parkingDecision !== undefined) {
        yield* this.parkRun(context);
        return;
      }

      if (outcome.error !== undefined) step.error = outcome.error;
      step.observations = outcome.observations;
      step.isFinalAnswer = outcome.isFinalAnswer;
      this.recordPolicyCalls(step.toolCalls);

      // An answering step whose policy is unmet is refused the same way a wrong-shaped answer is:
      // a correction observation and another turn, never a silent completion.
      if (outcome.isFinalAnswer) {
        const unmet = this.unmetPolicy(view.policy);
        if (unmet.length > 0) {
          const refusal = this.policyRefusal(unmet);
          if (refusal instanceof AgentGuardrailError) {
            yield* this.failRun(context, refusal);
            return;
          }
          for (const entry of unmet) {
            yield this.emit({
              type: "tool.requirementUnmet",
              stepIndex,
              tool: entry.tool,
              reason: entry.reason,
            });
          }
          step.isFinalAnswer = false;
          step.observations = refusal;
          yield this.emit({
            type: "observation.completed",
            stepIndex,
            text: refusal,
            isFinalAnswer: false,
          });
          const saveFailure = await this.commitAfterStep(context);
          if (saveFailure !== undefined) {
            yield* this.failRun(context, saveFailure);
            return;
          }
          continue;
        }
      }

      yield this.emit({
        type: "observation.completed",
        stepIndex,
        text: outcome.observations,
        isFinalAnswer: outcome.isFinalAnswer,
      });

      // A declared transfer ends the run instead of answering: the target's run is the caller's
      // to start, and the record names it so a later reader knows where the conversation went.
      const transfer = this.transferOf(step);
      if (transfer !== undefined) {
        yield* this.transferRun(transfer, context);
        return;
      }

      // An answering step is committed by complete() as the terminal status, so it is not
      // committed twice: one boundary per step, one terminal write.
      if (outcome.isFinalAnswer) {
        yield* this.complete(outcome.value, context);
        return;
      }

      const saveFailure = await this.commitAfterStep(context);
      if (saveFailure !== undefined) {
        yield* this.failRun(context, saveFailure);
        return;
      }
    }

    yield* this.maxStepsRun(context);
  }

  private composeAction(
    context: RunContext,
    step: ActionStep,
    stepIndex: number,
    action: InterpretedAction,
  ): AsyncGenerator<AgentEventPayload, ActionOutcome> {
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
    composed: AsyncGenerator<AgentEventPayload, ActionOutcome>,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    let next = await composed.next();
    while (!next.done) {
      yield this.emit(next.value);
      next = await composed.next();
    }
    return next.value;

  }

  /**
   * One planning turn (decision 0028). The first plan reads one user template carrying the task and
   * the tools; every later plan reads a system prelude, a summary-mode history and a user postlude
   * carrying the tools and the steps left. Both stop at \`<end_plan>\`, and the stored plan is the
   * reply wrapped the way upstream wraps it.
   */
  private async *runPlanningStep(
    stepIndex: number,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, { ok: true } | { cancelled: true } | { failed: AgentError }> {
    yield this.emit({ type: "planning.started", stepIndex });
    const first = stepIndex === 0;
    const task = this.memory.task ?? "";
    const messages = first ? this.initialPlanMessages(task) : this.updatePlanMessages(task, stepIndex);
    let completion: ChatCompletion;
    try {
      completion = yield* this.streamCompletion(messages, stepIndex, context, "planning", {
        stopSequences: [PLAN_END_TAG],
        tools: [],
      });
    } catch (error) {
      if (context.signal.aborted) return { cancelled: true };
      return { failed: AgentError.from(error, "AGENT_GENERATION", stepIndex) };
    }
    const plan = first ? wrapInitialPlan(completion.content) : wrapUpdatedPlan(task, completion.content);
    const step = new PlanningStep(plan);
    step.tokenUsage = completion.usage;
    this.memory.addStep(step);
    yield this.emit({ type: "planning.completed", stepIndex, text: plan });
    const saveFailure = await this.commitRun(context, "running");
    if (saveFailure !== undefined) return { failed: saveFailure };
    return { ok: true };
  }

  /** The initial plan's one user turn: the task, the tool prompts and the managed agents. */
  private initialPlanMessages(task: string): ChatMessage[] {
    return [
      {
        role: "user",
        content: populateTemplate(PLANNING_INITIAL_TEMPLATE, {
          codeFence: CODE_FENCE,
          managedAgentsBlock: this.renderManagedAgents(),
          planEndTag: PLAN_END_TAG,
          task,
          toolsBlock: this.planningToolsBlock(),
        }),
      },
    ];
  }

  /** The update plan's three-part input: system prelude, summary-mode memory, user postlude. */
  private updatePlanMessages(task: string, stepIndex: number): ChatMessage[] {
    return [
      {
        role: "system",
        content: populateTemplate(PLANNING_UPDATE_SYSTEM_TEMPLATE, { codeFence: CODE_FENCE, task }),
      },
      ...this.memory.toMessages({ summaryMode: true }),
      {
        role: "user",
        content: populateTemplate(PLANNING_UPDATE_USER_TEMPLATE, {
          managedAgentsBlock: this.renderManagedAgents(),
          planEndTag: PLAN_END_TAG,
          remainingSteps: remainingStepsAfter(stepIndex, this.maxSteps),
          toolsBlock: this.planningToolsBlock(),
        }),
      },
    ];
  }

  /** The tool section a planning template carries; a run without tools says so instead of faking one. */
  private planningToolsBlock(): string {
    const descriptions = this.renderToolDescriptions().trim();
    return descriptions === ""
      ? "This agent has no tools: the plan must be carried out by reasoning alone."
      : "The tools available:" + String.fromCharCode(10) + descriptions;
  }

  /**
   * Commit this run's record, when it has a store and an id. This is the one boundary the loop
   * writes at: after a step, and at the terminal status. A store failure is returned rather than
   * thrown, so the loop can end the run on it.
   */
  /**
   * Keep the messages other writers appended to the record. A send commits the record whole, so
   * the loop joins by message id before every commit instead of trusting the list it started with;
   * a delivery it stamps itself is never overwritten by an older copy of that entry.
   */
  private async mergeMessages(context: RunContext): Promise<readonly RunMessage[]> {
    if (this.store === undefined || !context.durable) return context.messages;
    const stored = await this.store.load(context.runId);
    if (stored === undefined) return context.messages;
    const known = new Set(context.messages.map((message) => message.id));
    const added = (translateRecord(stored, context.runId).messages ?? []).filter(
      (message) => !known.has(message.id),
    );
    if (added.length > 0) context.messages = [...context.messages, ...added];
    return context.messages;
  }

  /**
   * Deliver the messages sent to this run, at the step boundary and before the model turn. A
   * message becomes an ordinary user-role step in memory, stamped on the record in the same
   * commit, so a resumed run that reads the record back does not deliver it a second time.
   */
  private async deliverMessages(context: RunContext): Promise<AgentError | undefined> {
    if (this.store === undefined || !context.durable) return undefined;
    await this.mergeMessages(context);
    const pending = undeliveredMessages(context.messages);
    if (pending.length === 0) return undefined;
    const deliveredAt = new Date().toISOString();
    const ids = new Set(pending.map((message) => message.id));
    context.messages = context.messages.map((message) =>
      ids.has(message.id)
        ? { ...message, deliveredAt, deliveredStep: context.stepIndex }
        : message,
    );
    for (const message of pending) this.memory.addStep(new MessageStep(message.from, message.text));
    return this.commitRun(context, "running");
  }

  private async commitRun(context: RunContext, status: RunStatus): Promise<AgentError | undefined> {
    if (this.store === undefined || !context.durable) return undefined;
    // One record write at a time: a code block may announce several effects concurrently, and
    // each announcement commits, so the writes are ordered rather than raced.
    const previous = context.commitTail;
    let release!: () => void;
    context.commitTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    const terminal = status === "completed" || status === "failed";
    try {
      // The step in flight is not durable: its record is replayed from the journal, and the
      // restored memory holds only the boundary that preceded it (what parkRun relies on).
      const steps = context.openStep === undefined ? this.memory.toJSON() : context.committedSteps;
      const messages = await this.mergeMessages(context);
      // The recorded tail is append-only between commits and bounded in all: a reconnecting reader
      // asks after its last seq, and a cursor older than the base learns it was truncated.
      const recordedEvents = [...context.recordedEvents, ...context.events];
      const events = recordedEvents.slice(
        Math.max(0, recordedEvents.length - this.maxRecordedEvents),
      );
      const record: RunRecord = {
        schemaVersion: RUN_RECORD_VERSION,
        runId: context.runId,
        ...(context.conversationId === undefined ? {} : { conversationId: context.conversationId }),
        agentPath: context.agentPath,
        ...(messages.length === 0 ? {} : { messages }),
        ...(context.parentRunId === undefined ? {} : { parentRunId: context.parentRunId }),
        ...(context.parentStep === undefined ? {} : { parentStep: context.parentStep }),
        status,
        generation: context.generation,
        // A terminal commit releases the claim; a pause keeps it while the record waits.
        ...(terminal ? {} : { owner: context.owner }),
        ...(terminal || context.openStep === undefined ? {} : { step: context.openStep }),
        ...(context.completed.length === 0 ? {} : { completed: context.completed }),
        ...(context.journal.length === 0 ? {} : { journal: context.journal }),
        memory: { steps },
        ...(context.pending === undefined ? {} : { pending: context.pending }),
        ...(context.transfer === undefined ? {} : { transfer: context.transfer }),
        ...(context.children === undefined || context.children.length === 0
          ? {}
          : { children: context.children }),
        ...(context.settlements.length === 0 ? {} : { settlements: context.settlements }),
        ...(events.length === 0 ? {} : { events }),
        createdAt: context.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await this.store.commit(context.runId, record, context.generation);
      context.committedSteps = steps;
      context.recordedEvents = events;
      context.events = [];
      return undefined;
    } catch (error) {
      // A stale refusal is the writer's answer, not a store outage: surface it as itself.
      if (error instanceof StaleWriterError) return error;
      return storeError("commit", error, context.stepIndex);
    } finally {
      release();
    }
  }

  /**
   * Branch this run from a parent record. The child keeps the parent's memory and journal up to
   * the fork step, names the parent on its record, starts at generation 0 with no pending request
   * or owner, and re-enters the fork step so the copied journal answers its effects.
   */
  private async loadFork(
    context: RunContext,
    fork: { readonly fromRunId: string; readonly atStep: number },
  ): Promise<AgentError | undefined> {
    if (this.store === undefined) {
      return AgentError.from(new Error("A fork needs a store to read the parent run from."));
    }
    let parent: RunRecord | undefined;
    try {
      const stored = await this.store.load(fork.fromRunId);
      parent = stored === undefined ? undefined : translateRecord(stored, fork.fromRunId);
    } catch (error) {
      return error instanceof RunRecordVersionError ? error : storeError("load", error);
    }
    if (parent === undefined) {
      return new RunNotFoundError(
        "The fork's parent run " + JSON.stringify(fork.fromRunId) + " holds no record.",
      );
    }
    const atStep = fork.atStep;
    const target =
      parent.step?.index === atStep
        ? parent.step.stepId
        : (parent.completed?.find((step) => step.index === atStep)?.stepId ??
          (parent.pending?.stepIndex === atStep ? parent.pending.stepId : undefined));
    if (target === undefined) {
      return AgentError.from(
        new Error(
          "The parent run has no step " +
            String(atStep) +
            " to fork at; its steps end at " +
            String(parent.step?.index ?? parent.completed?.at(-1)?.index ?? -1) +
            ".",
        ),
      );
    }
    const steps = [...parent.memory.steps];
    const position = steps.findIndex((step) => step.id === target);
    const copiedSteps = position === -1 ? steps : steps.slice(0, position);
    const journal = [...(parent.journal ?? [])];
    let last = -1;
    for (let index = 0; index < journal.length; index += 1) {
      if (journal[index]?.stepId === target) last = index;
    }
    context.parentRunId = parent.runId;
    context.parentStep = atStep;
    context.completed = [...(parent.completed ?? [])].filter((step) => step.index < atStep);
    context.journal = last === -1 ? [] : journal.slice(0, last + 1);
    context.conversationId = context.conversationId ?? parent.conversationId;
    // Re-enter the fork step with the parent's attempt id, so its journaled effects replay.
    context.replayStepId = target;
    context.stepIndex = atStep;
    this.memory.restore(copiedSteps);
    context.committedSteps = copiedSteps;
    return this.commitRun(context, "running");
  }

  /**
   * Open one attempt at a step. A repaired or resumed step re-enters its recorded attempt so its
   * journaled effects replay; every other attempt gets a fresh id.
   */
  private beginAttempt(context: RunContext, stepIndex: number): string {
    const stepId = context.replayStepId ?? crypto.randomUUID();
    context.replayStepId = undefined;
    context.openStep = { index: stepIndex, stepId, startedAt: new Date().toISOString() };
    context.stepIndex = stepIndex;
    return stepId;
  }

  /** Whether this run writes a record, so journaling is meaningful for it. */
  protected journals(context: RunContext): boolean {
    return this.store !== undefined && context.durable;
  }

  /** The journal entry for one effect of one attempt, if the record holds it. */
  protected journalLookup(
    context: RunContext,
    stepId: string,
    callId: string,
  ): JournalEntry | undefined {
    return context.journal.find((entry) => entry.stepId === stepId && entry.callId === callId);
  }

  /** The journaled model request of one step attempt, if it was announced or finished. */
  protected journaledCompletion(context: RunContext, stepId: string): JournalEntry | undefined {
    return context.journal.find((entry) => entry.stepId === stepId && entry.toolName === "");
  }

  /** Announce an effect before it starts, and commit that intent so a crash cannot hide it. */
  protected async journalIntent(
    context: RunContext,
    stepId: string,
    callId: string,
    toolName: string,
    argsDigest: string,
  ): Promise<AgentError | undefined> {
    context.journal = [
      ...context.journal,
      { stepId, callId, toolName, argsDigest, state: "intent", at: new Date().toISOString() },
    ];
    return this.commitRun(context, "running");
  }

  /** Complete an announced effect with its result; `unknown` records a retried in-doubt effect. */
  protected async journalResult(
    context: RunContext,
    stepId: string,
    callId: string,
    result: unknown,
    state: "done" | "unknown" = "done",
    usage?: TokenUsage,
  ): Promise<AgentError | undefined> {
    context.journal = context.journal.map((entry) =>
      entry.stepId === stepId && entry.callId === callId
        ? {
            ...entry,
            state,
            result,
            ...(usage === undefined ? {} : { usage }),
            at: new Date().toISOString(),
          }
        : entry,
    );
    return this.commitRun(context, "running");
  }

  /** Drop the intent of an effect that never started (a parked gate), before the pause commits. */
  protected discardIntent(context: RunContext, stepId: string, callId: string): void {
    context.journal = context.journal.filter(
      (entry) => !(entry.stepId === stepId && entry.callId === callId && entry.state === "intent"),
    );
  }

  /** Mark the step in flight finished, so the next commit carries its closer. */
  private markStepFinished(context: RunContext): void {
    const open = context.openStep;
    if (open === undefined) return;
    context.completed = [
      ...context.completed,
      { stepId: open.stepId, index: open.index, state: "completed", finishedAt: new Date().toISOString() },
    ];
    context.openStep = undefined;
  }

  /** Finish the step, then commit the boundary. */
  private async commitAfterStep(context: RunContext, status: RunStatus = "running"): Promise<AgentError | undefined> {
    this.markStepFinished(context);
    return this.commitRun(context, status);
  }

  /**
   * Park the run on the decision the gate refused to make. The incomplete step is dropped — the
   * model produces it again on resume — and the record is committed `waiting` with the request.
   */
  private async *parkRun(context: RunContext): AsyncGenerator<AgentEvent, void> {
    const decision = this.parkingDecision;
    this.parkingDecision = undefined;
    if (decision === undefined) return;
    this.memory.restore([...context.committedSteps]);
    const stepId = context.openStep?.stepId;
    // The parked step was dropped from memory, so nothing is in flight while the run waits.
    context.openStep = undefined;
    context.pending = {
      kind: "approval",
      ...(stepId === undefined ? {} : { stepId }),
      requestId: decision.requestId,
      toolName: decision.name,
      argsDigest: decision.digest,
      stepIndex: decision.stepIndex,
      createdAt: new Date().toISOString(),
    };
    const terminal = this.emit({
      type: "run.waiting",
      result: this.buildResult(undefined, context, "waiting"),
    });
    const commitFailure = await this.commitRun(context, "waiting");
    if (commitFailure !== undefined) {
      yield* this.failRun(context, commitFailure);
      return;
    }
    yield terminal;
  }

  /**
   * Check a resume against the record without touching it. A refusal therefore leaves the record
   * exactly as it was found, which is what lets a wrong request id run no effect at all.
   */
  private validateResume(
    loaded: RunRecord | undefined,
    resume: { readonly requestId?: string; readonly outcome?: SettledApprovalOutcome },
  ): AgentError | undefined {
    if (loaded === undefined) {
      return new RunNotFoundError(
        "The store holds no record for run " + (resume.requestId ?? "") + " to resume.",
      );
    }
    const requestId = resume.requestId;
    if (requestId !== undefined) {
      const settled = (loaded.settlements ?? []).find((entry) => entry.requestId === requestId);
      if (settled !== undefined) {
        return new RunAlreadySettledError(
          "Request " +
            requestId +
            " was already settled as " +
            settled.outcome +
            "; resuming it again runs nothing.",
          {},
          settled.outcome,
        );
      }
    }
    if (loaded.status === "waiting") {
      const pending = loaded.pending;
      if (pending === undefined || requestId === undefined || resume.outcome === undefined) {
        return new RunNotWaitingError(
          "The run record is waiting, so a resume must name the pending request and its outcome.",
        );
      }
      if (pending.requestId !== requestId) {
        return new RunRequestMismatchError(
          "The run is waiting on request " +
            pending.requestId +
            ", not " +
            requestId +
            "; nothing was settled.",
        );
      }
      if (pending.expiresAt !== undefined && Date.now() > Date.parse(pending.expiresAt)) {
        return new RunRequestExpiredError(
          "Request " + pending.requestId + " expired at " + pending.expiresAt + "; it cannot be settled.",
          {},
          pending.expiresAt,
        );
      }
      return undefined;
    }
    if (loaded.status === "running") {
      if (requestId !== undefined || resume.outcome !== undefined) {
        return new RunRequestMismatchError(
          "The run record is running, not waiting on a request; there is nothing to settle.",
        );
      }
      return undefined;
    }
    return new RunNotWaitingError(
      "The run record is " + loaded.status + ", not a crashed or waiting run to resume.",
    );
  }

  /** Append the settlement a validated resume settled, and re-enter the step that asked. */
  private consumeResume(
    context: RunContext,
    record: RunRecord,
    resume: { readonly requestId?: string; readonly outcome?: SettledApprovalOutcome },
  ): AgentError | undefined {
    const pending = record.pending;
    if (pending === undefined || resume.outcome === undefined) {
      return new RunNotWaitingError("The record has no pending request to settle.");
    }
    const settlement: ApprovalSettlement = {
      requestId: pending.requestId,
      argsDigest: pending.argsDigest,
      stepIndex: pending.stepIndex,
      outcome: resume.outcome,
      at: new Date().toISOString(),
    };
    context.settlements = [...context.settlements, settlement];
    context.resumedSettlement = settlement;
    context.pending = undefined;
    context.stepIndex = pending.stepIndex;
    context.openStep = undefined;
    // The parked attempt's journaled model request is replayed, not paid for twice.
    if (pending.stepId !== undefined) context.replayStepId = pending.stepId;
    return undefined;
  }

  /**
   * Close a record whose process died: keep every step and every earlier closer, append one
   * synthetic interrupted closer for the open step, and continue from the next index.
   */
  private repairOpenStep(context: RunContext, record: RunRecord): void {
    const open = record.step;
    if (open !== undefined && !context.completed.some((entry) => entry.stepId === open.stepId)) {
      context.completed = [
        ...context.completed,
        {
          stepId: open.stepId,
          index: open.index,
          state: "interrupted",
          finishedAt: new Date().toISOString(),
        },
      ];
      context.stepIndex = open.index;
      // Re-entering the crashed attempt: its journaled effects are replayed, not re-run.
      context.replayStepId = open.stepId;
      return;
    }
    const last = context.completed[context.completed.length - 1];
    context.stepIndex = last === undefined ? 0 : last.index + 1;
  }

  /**
   * Number the terminal failure before its commit, then report it after the write. The commit
   * records the event; a failed commit does not hide the cause from the consumer.
   */
  private async *failRun(context: RunContext, error: AgentError): AsyncGenerator<AgentEvent, void> {
    const terminal = this.emit({ type: "run.failed", error: error.info });
    const commitFailure = await this.commitRun(context, "failed");
    if (commitFailure !== undefined) {
      this.logger.warn("The run record could not be committed as failed", commitFailure);
    }
    yield terminal;
  }

  /** Number the cancellation before the terminal commit, then report it. */
  private async *cancelRun(context: RunContext): AsyncGenerator<AgentEvent, void> {
    const terminal = this.emit({ type: "run.cancelled" });
    await this.commitRun(context, "failed");
    yield terminal;
  }

  /** Number the budget stop before the terminal commit, then report it. */
  private async *limitRun(context: RunContext, reason: LimitStopReason): AsyncGenerator<AgentEvent, void> {
    const terminal = this.emit({ type: "run.limitReached", reason });
    await this.commitRun(context, "failed");
    yield terminal;
  }

  /** Number the step cap before the terminal commit, then report it. */
  private async *maxStepsRun(context: RunContext): AsyncGenerator<AgentEvent, void> {
    const terminal = this.emit({ type: "run.maxStepsReached", steps: this.maxSteps });
    await this.commitRun(context, "failed");
    yield terminal;
  }

  /** The request options for one model turn, assembled in one place. */
  private modelOptions(context: RunContext, extra?: GenerateOptions): GenerateOptions {
    // The caller's options come first, so the loop's signal and advertised tools always win — except
    // that a turn may name its own tools (the planning call sends none) or its own stop sequences.
    const options: GenerateOptions = { ...this.baseModelOptions, signal: context.signal, ...extra };
    if (extra?.tools === undefined && this.advertisesTools) {
      const specs = [...this.advertisedRegistry().toSpecs()];
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
    extra?: GenerateOptions,
  ): AsyncGenerator<AgentEvent, ChatCompletion> {
    const stepId = context.openStep?.stepId;
    if (stepId !== undefined) {
      const recorded = this.journaledCompletion(context, stepId);
      if (recorded?.state === "done" && recorded.result !== undefined) {
        // The model request is a read: replaying its recorded reply costs nothing and runs no effect.
        return recorded.result as ChatCompletion;
      }
      const intentFailure = await this.journalIntent(
        context,
        stepId,
        "model",
        "",
        digestOf(messages),
      );
      if (intentFailure !== undefined) throw intentFailure;
    }
    let completion: ChatCompletion;
    if (this.prefersStreaming && this.model.capabilities.streaming) {
      const startedAt = Date.now();
      const accumulator = new ToolCallAccumulator();
      let text = "";
      let code = "";
      let finishReason: FinishReason = "stop";
      let streamUsage: TokenUsage | undefined;

      for await (const chunk of this.model.generateStream(messages, this.modelOptions(context, extra))) {
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
      const turnUsage = streamUsage ?? EMPTY_TOKEN_USAGE;
      const costReason = this.spendRunCost(turnUsage, context.budget);
      context.limitReached = spendBudget(context.budget, turnUsage) ?? costReason;
      // Exactly one usage.updated per model turn, whether or not the stream reported usage.
      yield this.emit({ type: "usage.updated", usage: context.usage });
      completion = {
        content: text,
        toolCalls: accumulator.finish(),
        usage: streamUsage ?? EMPTY_TOKEN_USAGE,
        finishReason,
      };
    } else {
      const startedAt = Date.now();
      completion = await this.model.generate(messages, this.modelOptions(context, extra));
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
      const costReason = this.spendRunCost(completion.usage, context.budget);
      context.limitReached = spendBudget(context.budget, completion.usage) ?? costReason;
      yield this.emit({ type: "usage.updated", usage: context.usage });
    }
    if (stepId !== undefined) {
      const doneFailure = await this.journalResult(
        context,
        stepId,
        "model",
        completion,
        "done",
        completion.usage,
      );
      if (doneFailure !== undefined) throw doneFailure;
    }
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
   * The transfer signal a completed action carries, if any: only a tool this agent declared as a
   * transfer counts, so a user tool returning a similar object cannot end a run by accident.
   */
  private transferOf(step: ActionStep): TransferSignal | undefined {
    if (this.transferNames.size === 0) return undefined;
    for (const call of step.toolCalls ?? []) {
      if (!this.transferNames.has(call.name)) continue;
      if (isTransferSignal(call.result)) return call.result;
    }
    return undefined;
  }

  /**
   * End the run as a transfer: the answering boundary is committed with the signal on the record,
   * and `run.transferred` is the terminal event. The target's own run is not started here.
   */
  private async *transferRun(
    transfer: TransferSignal,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, void> {
    context.transfer = transfer;
    this.markStepFinished(context);
    const terminal = this.emit({
      type: "run.transferred",
      result: this.buildResult(undefined, context, "success"),
    });
    const commitFailure = await this.commitRun(context, "completed");
    if (commitFailure !== undefined) {
      yield* this.failRun(context, commitFailure);
      return;
    }
    yield terminal;
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
        this.refuseAnswer(context);
        yield* this.failRun(context, guardrailError("output", error, context.stepIndex));
        return;
      }
      if (reason !== undefined) {
        this.refuseAnswer(context);
        yield* this.failRun(context, new AgentGuardrailError(reason, { stepIndex: context.stepIndex }));
        return;
      }
    }
    let value = output;
    if (this.outputSchema !== undefined) {
      const parsed = this.outputSchema.safeParse(output);
      if (!parsed.success) {
        this.refuseAnswer(context);
        const guardrail = new AgentGuardrailError(
          "The final answer failed the output schema: " + parsed.error.message,
          { stepIndex: context.stepIndex },
        );
        yield* this.failRun(context, guardrail);
        return;
      }
      value = parsed.data;
    }
    this.memory.addStep(new FinalAnswerStep(value));
    this.markStepFinished(context);
    // The terminal event is numbered before the commit, so the record's tail ends with it and a
    // reconnecting reader gets the completion; the consumer still sees it only after the write. A
    // caller that finds no completed record must not believe the run finished, so a store failure
    // here fails the run rather than the answer.
    const terminal = this.emit({
      type: "run.completed",
      result: this.buildResult(value, context, "success"),
    });
    const commitFailure = await this.commitRun(context, "completed");
    if (commitFailure !== undefined) {
      yield* this.failRun(context, commitFailure);
      return;
    }
    yield terminal;
  }

  /**
   * A tripped guardrail must not persist the value it refused. The answering step's recorded call
   * and observation are redacted before the terminal commit, so neither the failed record nor a
   * later reader holds the blocked text.
   */
  private refuseAnswer(context: RunContext): void {
    const steps = this.memory.steps;
    for (let index = steps.length - 1; index >= 0; index -= 1) {
      const step = steps[index];
      if (step === undefined || step.kind !== "action") continue;
      if (step.isFinalAnswer !== true) break;
      for (const call of step.toolCalls ?? []) {
        if (call.name !== FINAL_ANSWER_TOOL_NAME) continue;
        call.arguments = { redacted: true };
        call.result = "[redacted]";
        call.error = "The answer was withheld by the output guardrail.";
      }
      step.observations = "Final answer: [redacted]";
      break;
    }
    // The event tail is recorded too, so the events the refused step emitted are dropped rather
    // than rewritten: they were delivered live, but the record must not keep the blocked text.
    context.events = [];
    const stepId = context.openStep?.stepId;
    if (stepId === undefined) return;
    context.journal = context.journal.map((entry) =>
      entry.stepId !== stepId
        ? entry
        : {
            ...entry,
            result:
              entry.toolName === ""
                ? { content: "[redacted]", toolCalls: [], finishReason: "stop" }
                : {
                    ok: false,
                    error: {
                      code: "AGENT_GUARDRAIL",
                      message: "The result was withheld by the output guardrail.",
                    },
                  },
          },
    );
  }

  /**
   * Price one usage against this agent's table. Undefined means the table does not price the
   * model: the run then reports no cost, and a cost limit never treats an unknown price as zero.
   */
  private priceUsage(usage: TokenUsage): RunCost | undefined {
    return deriveCost(usage, {
      provider: this.model.provider,
      model: this.model.id,
      ...(this.priceTable === undefined ? {} : { table: this.priceTable }),
    });
  }

  /** Count one turn's cost against the budget, so the cap stops the run before the next call. */
  private spendRunCost(usage: TokenUsage, budget: RunBudget): LimitStopReason | undefined {
    const cost = this.priceUsage(usage);
    return cost === undefined ? undefined : spendCostBudget(budget, cost.microUsd);
  }

  private buildResult(output: unknown, context: RunContext, state: RunState): RunResult<TOut> {
    const cost = this.priceUsage(context.usage);
    return makeRunResult<TOut>({
      runId: context.runId,
      output: output as TOut,
      steps: this.memory.steps,
      messages: this.transcript(),
      start: context.startedAt,
      end: Date.now(),
      tokenUsage: context.usage,
      state,
      budget: context.budget,
      ...(context.pending === undefined ? {} : { pending: context.pending }),
      ...(context.transfer === undefined ? {} : { transfer: context.transfer }),
      ...(cost === undefined ? {} : { cost }),
    });
  }

  /**
   * Hide the oldest action steps behind a summary when the transcript is over budget. The stored
   * steps stay: this appends a condensation step whose ids the read-time projection drops, and
   * emits the event that names the loss. A soft trigger whose summarizer throws defers to the next
   * boundary; a hard trigger falls back to a deterministic summary, because the next model call is
   * the risk it exists to avoid.
   */
  private async *maybeCondense(): AsyncGenerator<AgentEvent, void> {
    const options = this.condensation;
    if (options === undefined) return;
    const transcript = this.transcript();
    const estimate = options.estimate ?? estimatedTokens;
    const size = estimate(transcript);
    // Whichever limit is lower decides that a condensation is due; the hard one only decides how
    // it may proceed when the summarizer is unavailable.
    if (size < Math.min(options.softLimit, options.hardLimit)) return;

    const keepRecent = options.keepRecent ?? 4;
    const forgottenIds = this.memory.forgottenIds;
    const candidates = this.memory.steps.filter(
      (step) =>
        (step.kind === "action" || step.kind === "planning") && !forgottenIds.has(step.id),
    );
    const forgettable = candidates.slice(0, Math.max(0, candidates.length - keepRecent));
    if (forgettable.length === 0) return;

    const trigger: "soft" | "hard" = size >= options.hardLimit ? "hard" : "soft";
    let summary: string;
    try {
      summary =
        options.summarize === undefined
          ? deterministicSummary(forgettable.length)
          : await options.summarize(forgettable, transcript);
    } catch (error) {
      if (trigger === "soft") return;
      this.logger.warn("The summarizer threw; the hard trigger used a deterministic summary", error);
      summary = deterministicSummary(forgettable.length);
    }

    const step = new CondensationStep(summary, forgettable.map((entry) => entry.id), trigger);
    this.memory.addStep(step);
    yield this.emit({
      type: "memory.condensed",
      forgotten: step.forgotten,
      summary: step.summary,
      trigger: step.trigger,
    });
  }

  protected emit(event: AgentEventPayload & { readonly agentPath?: readonly string[] }): AgentEvent {
    // Enrich at emission, the one place every event passes: the path names the agents that
    // produced it, and the seq is its position in this run's stream, so a nested child's events
    // are attributable without a second event shape.
    const context = this.activeContext;
    const enriched: AgentEvent = {
      ...event,
      agentPath: context?.agentPath ?? [],
      seq: context?.nextSeq ?? 1,
    };
    if (context !== undefined) {
      context.nextSeq += 1;
      context.events.push({ seq: enriched.seq, event: enriched });
      context.trace?.accept(enriched);
    }
    for (const listener of this.listeners) {
      try {
        listener(enriched);
      } catch (error) {
        this.logger.warn("An agent event listener threw", error);
      }
    }
    return enriched;
  }
}

/** The default size estimate: a quarter of the transcript's characters, rounded up. */
function estimatedTokens(messages: readonly ChatMessage[]): number {
  let characters = 0;
  for (const message of messages) characters += message.content.length;
  return Math.ceil(characters / 4);
}

/** The summary a hard trigger uses when no summarizer is configured, or it throws. */
function deterministicSummary(count: number): string {
  return "Condensed " + String(count) + " earlier step" + (count === 1 ? "" : "s") + ".";
}

/** A guardrail that throws has still stopped the run; it fails as a guardrail, not as a crash. */
function guardrailError(which: "input" | "output", error: unknown, stepIndex?: number): AgentGuardrailError {
  const message = "The " + which + " guardrail threw: " + (error instanceof Error ? error.message : String(error));
  return new AgentGuardrailError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}

/** The limit a budget has already crossed, if any. Used before a resumed run spends a turn. */
function exhaustedBudget(budget: RunBudget): LimitStopReason | undefined {
  if (budget.turns >= budget.maxTurns) return "limitTurns";
  if (budget.outputTokens >= budget.maxOutputTokens) return "limitOutputTokens";
  if (budget.totalTokens >= budget.maxTotalTokens) return "limitTotalTokens";
  if (budget.costMicroUsd >= budget.maxCostMicroUsd) return "limitCostUsd";
  return undefined;
}

function storeError(operation: "load" | "commit", error: unknown, stepIndex?: number): AgentError {
  const message =
    "The run store failed to " + operation + " the run record: " + (error instanceof Error ? error.message : String(error));
  return new AgentError(message, stepIndex === undefined ? { cause: error } : { cause: error, stepIndex });
}