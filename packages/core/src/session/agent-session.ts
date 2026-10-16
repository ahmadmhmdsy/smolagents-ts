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

/** The mutable working copy of a tool call. `ToolCallView` stays readonly for consumers. */
type ToolCallDraft = { -readonly [K in keyof ToolCallView]: ToolCallView[K] };

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

/**
 * The planning lane: one entry per planning step, filled while its text streams and replaced
 * wholesale when the step completes.
 */
export interface PlanningView {
  readonly stepIndex: number;
  readonly status: "streaming" | "complete";
  readonly text: string;
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
  readonly planning: readonly PlanningView[];
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
  toolCalls: ToolCallDraft[];
  isFinalAnswer: boolean;
  startedAt: number;
  endedAt?: number;
}

interface PlanningDraft {
  stepIndex: number;
  status: "streaming" | "complete";
  text: string;
  startedAt: number;
  endedAt?: number;
}

interface RunDraft {
  runId: string | null;
  task: string | null;
  modelId: string | null;
  status: SessionStatus;
  steps: StepDraft[];
  planning: PlanningDraft[];
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
    planning: [],
    output: undefined,
    error: null,
    usage: EMPTY_TOKEN_USAGE,
    startedAt: null,
    endedAt: null,
  };
}

/**
 * Session options. A `checkpoint` names this session's durable memory: with one set, each `send`
 * continues the agent's prior turns (and, when the agent has a `store`, it checkpoints them), so a
 * new session naming the same checkpoint reads what the earlier one did. Left unset, each run is a
 * fresh turn.
 */
export interface AgentSessionOptions {
  readonly checkpoint?: string;
}

/**
 * The framework-agnostic run store (design spec 5.3, layer L1).
 *
 * React's useSyncExternalStore needs subscribe + getSnapshot + getServerSnapshot, so this
 * class is the whole integration surface. It never imports React, and it works in Vue, Svelte,
 * or a plain event listener just as well.
 */
export class AgentSession<TOut = unknown> {
  private agent: MultiStepAgent<TOut>;
  private readonly checkpoint: string | undefined;
  private draft: RunDraft = emptyRun();
  /**
   * The snapshot a server render starts from. Built once from the initial empty draft and never
   * reassigned: React reads it while rendering on the server and again while hydrating, so its
   * identity must not move however far a run has travelled.
   */
  private readonly serverSnapshot: AgentSessionSnapshot = freezeRun(this.draft, null);
  private snapshot: AgentSessionSnapshot = this.serverSnapshot;
  private readonly listeners = new Set<() => void>();
  private controller: AbortController | null = null;

  constructor(agent: MultiStepAgent<TOut>, options: AgentSessionOptions = {}) {
    this.agent = agent;
    this.checkpoint = options.checkpoint;
  }

  /** Stable while nothing changed. This identity is the contract useSyncExternalStore relies on. */
  getSnapshot(): AgentSessionSnapshot {
    return this.snapshot;
  }

  /**
   * The initial snapshot, for useSyncExternalStore's third argument. Frozen and referentially
   * stable across calls, and it stays the idle, stepless snapshot however far a run has moved.
   */
  getServerSnapshot(): AgentSessionSnapshot {
    return this.serverSnapshot;
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

  /**
   * Run a task. Rejects if a run is already in flight. With a session `checkpoint` set, the turn
   * continues the agent's prior memory by default; pass `reset: true` to start a fresh turn anyway.
   */
  async send(
    task: string,
    options: { signal?: AbortSignal; reset?: boolean } = {},
  ): Promise<RunResult<TOut>> {
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
      const result = await this.agent.run(task, {
        signal: controller.signal,
        reset: options.reset ?? this.checkpoint === undefined,
        ...(this.checkpoint === undefined ? {} : { checkpoint: this.checkpoint }),
      });
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

      case "planning.started":
        this.draft.planning.push({
          stepIndex: event.stepIndex,
          status: "streaming",
          text: "",
          startedAt: Date.now(),
        });
        return;

      case "planning.delta": {
        // Advisory, exactly like message.delta: planning.completed replaces the text.
        const planning = this.planningAt(event.stepIndex);
        if (planning !== undefined) planning.text += event.text;
        return;
      }

      case "planning.completed": {
        const planning = this.planningAt(event.stepIndex);
        if (planning === undefined) return;
        planning.text = event.text;
        planning.status = "complete";
        planning.endedAt = Date.now();
        return;
      }

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

      case "toolcalls.requested": {
        // The announcement every later tool-call event refers back to, so a call exists
        // in the store before any result or failure names it.
        for (const announced of event.calls) {
          this.recordCall(announced.id, announced.name, announced.arguments);
        }
        return;
      }

      case "action.requested": {
        this.recordCall(event.callId, event.name, event.args);
        return;
      }

      case "action.result": {
        const call = this.recordCall(event.callId, event.name, undefined);
        if (call === undefined) return;
        call.status = "ok";
        call.output = event.output;
        call.durationMs = event.durationMs;
        return;
      }

      case "action.failed": {
        const call = this.recordCall(event.callId, event.name, undefined);
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

      // code.delta is advisory: code.completed replaces the step's code wholesale, so a
      // partial line never reaches the snapshot.
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

  private planningAt(stepIndex: number): PlanningDraft | undefined {
    return (
      this.draft.planning.find((entry) => entry.stepIndex === stepIndex) ??
      this.draft.planning[this.draft.planning.length - 1]
    );
  }

  /**
   * The call for callId, created on the open step when no event has mentioned it yet.
   * Events arrive in whatever order the agent emitted them — a failure can be reported
   * before its request — so the store converges on the call instead of requiring the
   * happy order.
   */
  private recordCall(callId: string, name: string, args: unknown): ToolCallDraft | undefined {
    const existing = this.findCall(callId);
    if (existing !== undefined) {
      if (args !== undefined) existing.args = args;
      return existing;
    }
    const step = this.openStep();
    if (step === undefined) return undefined;
    const created: ToolCallDraft = { id: callId, name, args, status: "pending" };
    step.toolCalls.push(created);
    return created;
  }

  private findCall(callId: string): ToolCallDraft | undefined {
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
    planning: Object.freeze(
      draft.planning.map((planning) =>
        Object.freeze({
          stepIndex: planning.stepIndex,
          status: planning.status,
          text: planning.text,
          startedAt: planning.startedAt,
          ...(planning.endedAt === undefined ? {} : { endedAt: planning.endedAt }),
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
