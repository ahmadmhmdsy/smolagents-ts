import { AgentError, AgentMaxStepsError, AgentCancelledError } from "../errors.js";
import type { RunResult } from "./run-result.js";
import type { ManagedAgent } from "./managed-agent.js";
import { populateTemplate } from "../prompts/populate-template.js";
import { MANAGED_AGENT_TASK_TEMPLATE } from "../prompts/templates.js";

/** Why a child run stopped, in the vocabulary a caller can branch on. */
export type ChildStopReason = "success" | "failure" | "max_steps" | "waiting";

/** The failure channel of a child report; never carries the child's inputs or produced values. */
export interface ChildFailure {
  /** `schema` is a declared-output mismatch, `agent` a typed run failure, `unknown` anything else. */
  readonly kind: "schema" | "agent" | "unknown";
  /** The typed error's name, or `ChildSchemaError` for a mismatch. */
  readonly name: string;
  /** A bounded diagnostic with the task text and key-shaped tokens removed. */
  readonly message: string;
  /** Schema paths and issue codes only, never the values. */
  readonly issues?: readonly string[];
}

/**
 * A child's result: a value validated against the schema the caller declared, or a failure
 * channel that says why there is no value. The two are mutually exclusive by construction.
 */
export interface ChildReport<T = unknown> {
  readonly stopReason: ChildStopReason;
  readonly value?: T;
  readonly failure?: ChildFailure;
}

/** Options for a managed-agent run. The signal is the caller's cancellation. */
export interface RunManagedAgentOptions {
  readonly signal?: AbortSignal;
  /** The parent's agent path; the child's run appends its own name to it. */
  readonly agentPath?: readonly string[];
}

const MAX_DIAGNOSTIC = 300;

/**
 * Run a managed agent and report its answer as a validated value or a typed failure. The task is
 * wrapped in the same delegation prompt the model-facing tool uses, so both paths agree on what
 * the child was asked; the report's diagnostic is assembled from the error, bounded and stripped
 * of the task text and key-shaped tokens, never from the child's inputs.
 */
export async function runManagedAgent<T = unknown>(
  entry: ManagedAgent<T>,
  task: string,
  options: RunManagedAgentOptions = {},
): Promise<ChildReport<T>> {
  const prompt = populateTemplate(MANAGED_AGENT_TASK_TEMPLATE, { name: entry.name, task });
  let result: RunResult;
  try {
    result = await entry.agent.run(prompt, {
      ...(options.signal === undefined ? {} : { signal: options.signal }),
      ...(options.agentPath === undefined ? {} : { agentPath: options.agentPath }),
    });
  } catch (error) {
    return { stopReason: stopReasonOf(error), failure: failureOf(error, task) };
  }

  if (result.state === "waiting") {
    return {
      stopReason: "waiting",
      failure: {
        kind: "agent",
        name: "RunWaiting",
        message: "The child parked on a request and has not produced a final answer.",
      },
    };
  }

  if (entry.outputSchema === undefined) {
    return { stopReason: "success", value: result.output as T };
  }

  const parsed = entry.outputSchema.safeParse(result.output);
  if (parsed.success) return { stopReason: "success", value: parsed.data as T };

  const issues = parsed.error.issues.map((issue) => {
    const path = issue.path.map((part) => String(part)).join(".");
    return (path === "" ? "<root>" : path) + ": " + issue.code;
  });
  return {
    stopReason: "failure",
    failure: {
      kind: "schema",
      name: "ChildSchemaError",
      message: bounded("The child's answer did not match the declared schema: " + issues.join("; "), task),
      issues,
    },
  };
}

function stopReasonOf(error: unknown): ChildStopReason {
  if (error instanceof AgentMaxStepsError) return "max_steps";
  if (error instanceof AgentCancelledError) return "failure";
  return "failure";
}

function failureOf(error: unknown, task: string): ChildFailure {
  const info = AgentError.from(error).info;
  const kind: ChildFailure["kind"] = error instanceof AgentError ? "agent" : "unknown";
  return { kind, name: info.name, message: bounded(info.message, task) };
}

/** Bound a provider diagnostic and remove the task text and key-shaped tokens from it. */
function bounded(message: string, task: string): string {
  let text = task.trim() === "" ? message : message.split(task).join("[task]");
  text = text
    .replace(/\b(?:sk|pk|hf|ghp|gho|glpat)[-_][A-Za-z0-9_-]{6,}\b/gi, "[redacted]")
    .replace(/\b(?:api[_-]?key|token|secret)\s*[=:]\s*\S+/gi, (match) => match.split(/[=:]/)[0] + "=[redacted]")
    .replace(/\s+/g, " ")
    .trim();
  return text.length <= MAX_DIAGNOSTIC ? text : text.slice(0, MAX_DIAGNOSTIC - 1) + "…";
}
