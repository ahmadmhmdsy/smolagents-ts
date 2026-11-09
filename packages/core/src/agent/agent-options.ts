/**
 * The agent loop's option and context types, split out of `multi-step-agent.ts` (T-73) with no
 * change of shape. `multi-step-agent.ts` re-exports the public ones, so its import path stays the API.
 */
import { type AgentEvent, type AgentEventOf, type AgentEventType } from "../events.js";
import { type Logger } from "../logger.js";
import { type AnyAgentStep } from "../memory/steps.js";
import { type AgentMiddleware } from "../middleware.js";
import { type FinishReason, type GenerateOptions, type Model } from "../model.js";
import { type MediaLimits } from "../media.js";
import type { SpanExporter } from "../monitoring/otel.js";
import { TraceBuilder } from "../monitoring/trace.js";
import { type ModelPrice } from "../monitoring/pricing.js";
import { ToolRegistry } from "../tool/registry.js";
import { type MergedToolPolicy, type ToolPolicy, type ToolPolicyProvider } from "../tool/policy.js";
import { type Tool } from "../tool/tool.js";
import { type ChatMessage, type MediaRef, type TokenUsage } from "../types.js";
import { type ManagedAgent } from "./managed-agent.js";
import { type TransferSignal, type TransferTarget } from "./transfer.js";
import { type ApprovalHandler, type ApprovalPolicy, type SettledApprovalOutcome } from "./approval.js";
import type { Guardrails } from "./guardrail.js";
import {
  type ApprovalSettlement,
  type CompletedStep,
  type JournalEntry,
  type OpenStep,
  type PendingApproval,
  type RunEventEntry,
  type RunRecord,
} from "../session/run-record.js";
import type { RunStore } from "../session/run-store.js";
import { type MediaStore } from "../session/media-store.js";
import { type RunMessage } from "../session/messages.js";
import { type LimitStopReason, type RunBudget, type RunBudgetHandle, type RunLimits } from "../session/budget.js";
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
  /** Caps on a run's media, counted encoded. Unset fields keep `DEFAULT_MEDIA_LIMITS`. */
  mediaLimits?: Partial<MediaLimits>;
  /**
   * Where media bytes live, so a run with media can resume in another process. The framework
   * never deletes from it. Unset, bytes last only as long as this agent.
   */
  mediaStore?: MediaStore;
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
export interface StepToolView {
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
  /** The media this step's tools have returned so far, until the step takes it. */
  readonly attachments: MediaRef[];
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
