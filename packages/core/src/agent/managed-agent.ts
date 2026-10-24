import { z } from "zod";
import { MANAGED_AGENT_REPORT_TEMPLATE } from "../prompts/templates.js";
import { populateTemplate } from "../prompts/populate-template.js";
import { ToolDefinitionError, tool, type Tool } from "../tool/tool.js";
import type { MultiStepAgent } from "./multi-step-agent.js";
import { runManagedAgent, type ChildReport } from "./child-report.js";

/**
 * One entry in a manager agent's `managedAgents` list: a child agent exposed to the model as a
 * callable tool. Mirrors upstream's requirement that every managed agent carries a name and a
 * description, because the description is the only thing the manager sees when deciding to delegate.
 */
export interface ManagedAgent<T = unknown> {
  /** The name the manager's model calls it by. Must be a valid JavaScript identifier. */
  name: string;
  /** What the team member is for, shown in the manager's prompt. */
  description: string;
  /** The child agent that runs the delegated task. */
  agent: MultiStepAgent;
  /**
   * The schema the child's answer must match. When set, the child's value is validated and a
   * mismatch becomes the report's failure channel instead of a value.
   */
  outputSchema?: z.ZodType<T>;
}

/**
 * The single argument a managed agent accepts, mirroring upstream's `inputs` for a managed agent:
 * a detailed `task` string and an optional bag of extra context.
 */
export const MANAGED_AGENT_INPUT_SCHEMA = z.object({
  task: z.string().describe("Long detailed description of the task."),
  additional_args: z
    .record(z.string(), z.unknown())
    .optional()
    .describe(
      "Dictionary of extra inputs to pass to the managed agent, e.g. images, dataframes, or any other contextual data it may need.",
    ),
});

/**
 * Expose a child agent as a tool, upstream's managed agent (`MultiStepAgent.__call__`). The manager's
 * model calls it like any tool with a single `task`; the factory wraps that task in upstream's
 * managed-agent prompt, runs the child, and wraps the child's answer in the report prompt. The
 * returned tool carries the child's description, so it renders in the manager's prompt without a
 * second registry.
 */
export function managedAgent<T = unknown>(
  entry: ManagedAgent<T>,
): Tool<typeof MANAGED_AGENT_INPUT_SCHEMA, string> {
  if (entry.description.trim() === "") {
    throw new ToolDefinitionError("Managed agent " + entry.name + " needs a description");
  }
  return tool({
    name: entry.name,
    description: entry.description,
    inputSchema: MANAGED_AGENT_INPUT_SCHEMA,
    outputSchema: z.string(),
    async execute(input, ctx) {
      const report = await runManagedAgent(entry, input.task, { signal: ctx.signal });
      return renderReport(entry.name, report);
    },
  });
}

/** The manager sees the report as text, built from the value when there is one and the failure otherwise. */
function renderReport<T>(name: string, report: ChildReport<T>): string {
  const answer =
    report.failure === undefined
      ? asText(report.value)
      : "The child could not produce a valid result (" +
        report.failure.name +
        "): " +
        report.failure.message;
  return populateTemplate(MANAGED_AGENT_REPORT_TEMPLATE, { name, final_answer: answer });
}

function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}
