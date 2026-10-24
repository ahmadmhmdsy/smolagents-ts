import type { AgentEvent } from "@smolagents-ts/core";

export interface RenderOptions {
  /** 0 quiet, 1 default, 2 verbose. A value outside that range is clamped. */
  verbosity: number;
  /** When false, no escape code is emitted. */
  color: boolean;
}

const CODES = {
  reset: "\u001b[0m",
  dim: "\u001b[2m",
  bold: "\u001b[1m",
  red: "\u001b[31m",
  green: "\u001b[32m",
  yellow: "\u001b[33m",
  cyan: "\u001b[36m",
} as const;

type Color = keyof typeof CODES;

function paint(text: string, color: Color, options: RenderOptions): string {
  return options.color ? CODES[color] + text + CODES.reset : text;
}

/** Clamp the requested level to the three the renderer knows. */
function level(options: RenderOptions): number {
  if (options.verbosity <= 0) return 0;
  if (options.verbosity >= 2) return 2;
  return 1;
}

/**
 * True when a stream may receive escape codes. A pipe, a redirected file, a dumb
 * terminal or NO_COLOR all mean plain text.
 */
export function supportsColor(
  isTty: boolean | undefined,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  if (env.NO_COLOR !== undefined && env.NO_COLOR !== "") return false;
  if (env.TERM === "dumb") return false;
  return isTty === true;
}

/** Render a value a model produced. A string is itself; anything else is JSON. */
export function display(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    const json = JSON.stringify(value, null, 2);
    return json === undefined ? String(value) : json;
  } catch {
    return String(value);
  }
}

function line(text: string): string {
  return text + "\n";
}

/**
 * Render one event. Returns undefined when the level hides it, which is how the
 * caller tells "nothing to print" from "print an empty line".
 *
 * Level 0 keeps the final answer and a failure. Level 1 adds the step frame, the
 * model's message, a plan and an observation. Level 2 adds the advisory deltas,
 * every action, the extracted code, logs and token usage.
 */
export function renderEvent(event: AgentEvent, options: RenderOptions): string | undefined {
  const v = level(options);
  switch (event.type) {
    case "run.started":
      return v >= 1
        ? line(
            paint("=== run " + event.runId + " | model " + event.modelId + " ===", "cyan", options),
          ) + line("Task: " + event.task)
        : undefined;
    case "planning.started":
      return v >= 1 ? line(paint("--- planning ---", "dim", options)) : undefined;
    case "planning.delta":
      return v >= 2 ? event.text : undefined;
    case "planning.completed":
      return v >= 1 ? line(paint("Plan:", "bold", options) + " " + event.text) : undefined;
    case "step.started":
      return v >= 1
        ? line(paint("[step " + String(event.stepIndex + 1) + "]", "yellow", options))
        : undefined;
    case "code.delta":
      return v >= 2 ? event.text : undefined;
    case "code.completed":
      return v >= 2 ? line(paint("Code:", "dim", options) + "\n" + event.code) : undefined;
    case "action.requested":
      return v >= 2 ? line("Call " + event.name + "(" + display(event.args) + ")") : undefined;
    case "action.result":
      return v >= 2
        ? line("  -> " + display(event.output) + " (" + String(event.durationMs) + " ms)")
        : undefined;
    case "action.failed":
      return v >= 1
        ? line(
            paint("Call " + event.name + " failed", "red", options) +
              ": " +
              event.error.message,
          )
        : undefined;
    case "approval.decided":
      return v >= 1
        ? line(
            "Approval " +
              event.outcome +
              ": " +
              event.name +
              " (call " +
              event.requestId +
              ")",
          )
        : undefined;
    case "toolcalls.requested":
      return v >= 2 ? line(String(event.calls.length) + " tool call(s) requested") : undefined;
    case "logs.appended":
      return v >= 2 ? line("output: " + event.text) : undefined;
    case "observation.completed":
      if (event.isFinalAnswer) {
        return v >= 2 ? line("Final observation:\n" + event.text) : undefined;
      }
      return v >= 1 ? line(paint("Observation:", "cyan", options) + "\n" + event.text) : undefined;
    case "message.delta":
      return v >= 2 ? event.text : undefined;
    case "message.completed":
      return v >= 1 ? line(event.text) : undefined;
    case "usage.updated":
      return v >= 2
        ? line(
            "tokens: in " +
              String(event.usage.inputTokens) +
              ", out " +
              String(event.usage.outputTokens) +
              ", total " +
              String(event.usage.totalTokens),
          )
        : undefined;
    case "run.waiting": {
      const pending = event.result.pending;
      const request =
        pending === undefined
          ? "an approval"
          : 'request ' + pending.requestId + ' for "' + pending.toolName + '"';
      return (
        line(
          paint("Run waiting", "yellow", options) +
            " on " +
            request +
            " (run " +
            event.result.runId +
            ")",
        ) + line("Resume it with --resume " + event.result.runId + " --approve <requestId>.")
      );
    }
    case "run.resumed":
      return v >= 1
        ? line(
            "Resumed run " +
              event.runId +
              ": request " +
              event.requestId +
              " " +
              event.outcome,
          )
        : undefined;
    case "run.transferred": {
      const target = event.result.transfer?.target ?? "another agent";
      return line(paint("Transferred to " + target, "yellow", options) + " (run " + event.result.runId + ")");
    }
    case "run.completed":
      return line(paint("Final answer:", "green", options) + " " + display(event.result.output));
    case "run.failed":
      return line(paint("Run failed", "red", options) + ": " + event.error.message);
    case "run.maxStepsReached":
      return line(paint("Run stopped after " + String(event.steps) + " steps", "red", options));
    case "run.limitReached":
      return line(paint("Run stopped on its budget: " + event.reason, "red", options));
    case "run.cancelled":
      return line(paint("Run cancelled", "red", options));
    default:
      // A new variant is a compile error at the switching call sites; this keeps a
      // runtime caller that passes one anyway from crashing the renderer.
      return undefined;
  }
}
