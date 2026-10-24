import { FINAL_ANSWER_TOOL_NAME } from "../agent/action.js";
import type { AgentEvent } from "../events.js";

/** One OTel-shaped span: a named, timed unit of work with attributes and child spans. */
export interface TraceSpan {
  readonly name: string;
  readonly startTimeMs: number;
  endTimeMs: number;
  status: "ok" | "error";
  readonly attributes: Record<string, unknown>;
  readonly children: TraceSpan[];
}

function span(name: string, startTimeMs: number, attributes: Record<string, unknown> = {}): TraceSpan {
  return { name, startTimeMs, endTimeMs: startTimeMs, status: "ok", attributes, children: [] };
}

/**
 * Remove a guarded run's refused answer from every span: the final-answer tool span loses the
 * arguments and output it recorded, and the answering step's observation says it was redacted.
 */
function redactGuardedSpans(span: TraceSpan): void {
  if (span.name === "tool." + FINAL_ANSWER_TOOL_NAME) {
    delete span.attributes["args"];
    delete span.attributes["output"];
    span.attributes.redacted = true;
  }
  if (span.attributes.isFinalAnswer === true) {
    span.attributes.observation = "[redacted]";
    span.attributes.redacted = true;
  }
  for (const child of span.children) redactGuardedSpans(child);
}

/** What one span needs from its clock: the time of the event that closes it. */
export interface TraceBuilderOptions {
  /** The clock the replay or the live run reads. Defaults to `Date.now`. */
  readonly clock?: () => number;
}

/**
 * Fold an AgentEvent stream into one OTel-shaped trace: a `run` root with a child span per step,
 * per planning pass and per tool call. It is span-shaped without importing the SDK, so an adapter
 * maps it to a real exporter later. Advisory ".delta" events are skipped: a consumer converges on
 * the matching ".completed" event. The clock is injected so a replay is deterministic.
 *
 * The builder form lets a live run feed the fold one event at a time; `buildTrace` is the replay
 * form over an array. A span records the model, the provider, the tool, the step and its own
 * duration, because those are the attributes worth filtering on; task text and payloads stay in
 * the trace only for a caller that asked the exporter to carry them.
 */
export class TraceBuilder {
  private readonly clock: () => number;
  private readonly root: TraceSpan;
  private step: TraceSpan | undefined;
  private planning: TraceSpan | undefined;
  private readonly tools = new Map<string, TraceSpan>();
  private at: number;

  constructor(options: TraceBuilderOptions = {}) {
    this.clock = options.clock ?? Date.now;
    this.root = span("run", this.clock());
    this.at = this.root.startTimeMs;
  }

  /** Fold one event. Applied once, in stream order. */
  accept(event: AgentEvent): void {
    this.at = this.clock();
    switch (event.type) {
      case "run.started":
        this.root.attributes.runId = event.runId;
        this.root.attributes.task = event.task;
        this.root.attributes.modelId = event.modelId;
        if (event.provider !== undefined) this.root.attributes.provider = event.provider;
        break;
      case "planning.started":
        this.closeStep();
        this.planning = span("planning." + event.stepIndex, this.at, { stepIndex: event.stepIndex });
        this.root.children.push(this.planning);
        break;
      case "planning.completed":
        if (this.planning !== undefined) {
          this.planning.attributes.text = event.text;
          this.closePlanning();
        }
        break;
      case "memory.condensed":
        this.root.children.push(
          span("memory.condensed", this.at, {
            forgotten: event.forgotten,
            trigger: event.trigger,
            summary: event.summary,
          }),
        );
        break;
      case "step.started":
        this.closeStep();
        this.step = span("step." + event.stepIndex, this.at, { stepIndex: event.stepIndex });
        this.root.children.push(this.step);
        break;
      case "code.completed":
        if (this.step !== undefined) this.step.attributes.code = event.code;
        break;
      case "logs.appended":
        if (this.step !== undefined) this.step.attributes.logs = event.text;
        break;
      case "toolcalls.requested":
        if (this.step !== undefined) this.step.attributes.toolCalls = event.calls.length;
        break;
      case "tool.policy":
        (this.step ?? this.root).attributes.policy = {
          advertised: event.advertised,
          hidden: event.hidden.map((entry) => entry.name),
          forced: event.forced,
          required: event.required.map((entry) => entry.tool),
        };
        break;
      case "tool.requirementUnmet":
        this.root.children.push(
          span("tool.requirementUnmet." + event.tool, this.at, {
            stepIndex: event.stepIndex,
            tool: event.tool,
            reason: event.reason,
          }),
        );
        break;
      case "observation.completed":
        if (this.step !== undefined) {
          this.step.attributes.observation = event.text;
          this.step.attributes.isFinalAnswer = event.isFinalAnswer;
        }
        break;
      case "action.requested": {
        const tool = span("tool." + event.name, this.at, { name: event.name, args: event.args });
        (this.step ?? this.root).children.push(tool);
        this.tools.set(event.callId, tool);
        break;
      }
      case "action.progress": {
        // A trace keeps the latest report and a count, not the whole stream: a long tool must not
        // grow the span without bound.
        const tool = this.tools.get(event.callId);
        if (tool !== undefined) {
          tool.attributes.lastProgress = event.progress;
          const seen = tool.attributes.progressCount;
          tool.attributes.progressCount = typeof seen === "number" ? seen + 1 : 1;
        }
        break;
      }
      case "action.result": {
        const tool = this.tools.get(event.callId);
        if (tool !== undefined) {
          tool.endTimeMs = this.at;
          tool.attributes.output = event.output;
          tool.attributes.durationMs = event.durationMs;
        }
        break;
      }
      case "action.failed": {
        const tool = this.tools.get(event.callId);
        if (tool !== undefined) {
          tool.endTimeMs = this.at;
          tool.status = "error";
          tool.attributes.error = event.error;
        }
        break;
      }
      case "usage.updated":
        this.root.attributes.usage = event.usage;
        break;
      case "run.completed":
        this.root.attributes.state = event.result.state;
        break;
      case "run.failed":
        this.root.status = "error";
        this.root.attributes.error = event.error;
        // A tripped guardrail must not leave the refused value in the trace either.
        if (event.error.code === "AGENT_GUARDRAIL") {
          this.root.attributes.redacted = true;
          redactGuardedSpans(this.root);
        }
        break;
      case "run.maxStepsReached":
        this.root.status = "error";
        this.root.attributes.maxSteps = event.steps;
        break;
      case "run.limitReached":
        this.root.status = "error";
        this.root.attributes.limitReached = event.reason;
        break;
      case "run.cancelled":
        this.root.status = "error";
        break;
      // Advisory deltas carry no authoritative state; a trace records the ".completed" event.
      case "message.delta":
      case "message.completed":
      case "planning.delta":
      case "code.delta":
        break;
    }
  }

  /** Close the open spans and return the tree. Safe to call once, after the terminal event. */
  finish(): TraceSpan {
    this.closeStep();
    this.closePlanning();
    this.root.endTimeMs = this.at;
    this.root.attributes.durationMs = this.root.endTimeMs - this.root.startTimeMs;
    return this.root;
  }

  private closeStep(): void {
    if (this.step === undefined) return;
    this.step.endTimeMs = this.at;
    this.step.attributes.durationMs = this.step.endTimeMs - this.step.startTimeMs;
  }

  private closePlanning(): void {
    if (this.planning === undefined) return;
    this.planning.endTimeMs = this.at;
    this.planning.attributes.durationMs = this.planning.endTimeMs - this.planning.startTimeMs;
  }
}

/** Replay an already-recorded stream through the builder. The clock makes the replay deterministic. */
export function buildTrace(events: readonly AgentEvent[], clock: () => number = Date.now): TraceSpan {
  const builder = new TraceBuilder({ clock });
  for (const event of events) builder.accept(event);
  return builder.finish();
}
