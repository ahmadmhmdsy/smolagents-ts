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

/**
 * Fold an AgentEvent stream into one OTel-shaped trace: a `run` root with a child span per step,
 * per planning pass and per tool call. It is span-shaped (name, start/end, status, attributes,
 * children) without importing the SDK, so an adapter maps it to a real exporter later. Advisory
 * ".delta" events are skipped — a consumer converges on the matching ".completed" event. The clock
 * is injected so a replay is deterministic.
 */
export function buildTrace(events: readonly AgentEvent[], clock: () => number = Date.now): TraceSpan {
  const root = span("run", clock());
  let step: TraceSpan | undefined;
  let planning: TraceSpan | undefined;
  const tools = new Map<string, TraceSpan>();
  let at = root.startTimeMs;

  for (const event of events) {
    at = clock();
    switch (event.type) {
      case "run.started":
        root.attributes.runId = event.runId;
        root.attributes.task = event.task;
        root.attributes.modelId = event.modelId;
        break;
      case "planning.started":
        if (step !== undefined) step.endTimeMs = at;
        planning = span("planning." + event.stepIndex, at, { stepIndex: event.stepIndex });
        root.children.push(planning);
        break;
      case "planning.completed":
        if (planning !== undefined) {
          planning.attributes.text = event.text;
          planning.endTimeMs = at;
        }
        break;
      case "memory.condensed":
        root.children.push(
          span("memory.condensed", at, {
            forgotten: event.forgotten,
            trigger: event.trigger,
            summary: event.summary,
          }),
        );
        break;
      case "step.started":
        if (step !== undefined) step.endTimeMs = at;
        step = span("step." + event.stepIndex, at, { stepIndex: event.stepIndex });
        root.children.push(step);
        break;
      case "code.completed":
        if (step !== undefined) step.attributes.code = event.code;
        break;
      case "logs.appended":
        if (step !== undefined) step.attributes.logs = event.text;
        break;
      case "toolcalls.requested":
        if (step !== undefined) step.attributes.toolCalls = event.calls.length;
        break;
      case "observation.completed":
        if (step !== undefined) {
          step.attributes.observation = event.text;
          step.attributes.isFinalAnswer = event.isFinalAnswer;
        }
        break;
      case "action.requested": {
        const tool = span("tool." + event.name, at, { name: event.name, args: event.args });
        (step ?? root).children.push(tool);
        tools.set(event.callId, tool);
        break;
      }
      case "action.result": {
        const tool = tools.get(event.callId);
        if (tool !== undefined) {
          tool.endTimeMs = at;
          tool.attributes.output = event.output;
          tool.attributes.durationMs = event.durationMs;
        }
        break;
      }
      case "action.failed": {
        const tool = tools.get(event.callId);
        if (tool !== undefined) {
          tool.endTimeMs = at;
          tool.status = "error";
          tool.attributes.error = event.error;
        }
        break;
      }
      case "usage.updated":
        root.attributes.usage = event.usage;
        break;
      case "run.completed":
        root.attributes.state = event.result.state;
        break;
      case "run.failed":
        root.status = "error";
        root.attributes.error = event.error;
        // A tripped guardrail must not leave the refused value in the trace either.
        if (event.error.code === "AGENT_GUARDRAIL") {
          root.attributes.redacted = true;
          redactGuardedSpans(root);
        }
        break;
      case "run.maxStepsReached":
        root.status = "error";
        root.attributes.maxSteps = event.steps;
        break;
      case "run.limitReached":
        root.status = "error";
        root.attributes.limitReached = event.reason;
        break;
      case "run.cancelled":
        root.status = "error";
        break;
      // Advisory deltas carry no authoritative state; a trace records the ".completed" event.
      case "message.delta":
      case "message.completed":
      case "planning.delta":
      case "code.delta":
        break;
    }
  }

  if (step !== undefined) step.endTimeMs = at;
  if (planning !== undefined) planning.endTimeMs = at;
  root.endTimeMs = at;
  return root;
}
