import { z } from "zod";
import { ToolDefinitionError, tool, type Tool } from "../tool/tool.js";
import type { MultiStepAgent } from "./multi-step-agent.js";

/**
 * One entry in an agent's `transfers` list: a team member the model may hand the conversation to
 * instead of answering. Unlike a managed agent, a transfer does not run the child inside this
 * run: it ends the run and names the target, so the caller starts the target's run itself and the
 * record says who took over. The tool's name is derived from the declaration, so a target that was
 * not declared has no call the model can make.
 */
export interface TransferTarget {
  /** The name the model transfers to; must be a valid JavaScript identifier. */
  name: string;
  /** What the target handles, shown in the tool's description. */
  description: string;
  /** The agent that takes over. It is not called here; naming it is the whole action. */
  agent: MultiStepAgent;
}

/** Why a transfer happened, carried by the tool's argument and the run's result. */
export interface TransferSignal {
  /** The declared target's name. */
  readonly target: string;
  /** The model's stated reason for handing over, when it gave one. */
  readonly reason?: string | undefined;
}

/** The single argument a transfer tool accepts. */
export const TRANSFER_INPUT_SCHEMA = z.object({
  reason: z
    .string()
    .optional()
    .describe("Why this task belongs to the target agent, in one or two sentences."),
});

/** The tool name a declared target gets, so the model can only name a target that was declared. */
export function transferToolName(name: string): string {
  return "transfer_to_" + name;
}

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

/**
 * Build the callable tool for one declared transfer. Calling it returns a signal rather than the
 * target's answer; the loop recognises the signal and ends the run with `run.transferred`.
 */
export function transferTool(entry: TransferTarget): Tool<typeof TRANSFER_INPUT_SCHEMA, TransferSignal> {
  if (!IDENTIFIER.test(entry.name)) {
    throw new ToolDefinitionError(
      "A transfer target's name must be a JavaScript identifier, got: " + JSON.stringify(entry.name),
    );
  }
  if (entry.description.trim() === "") {
    throw new ToolDefinitionError("Transfer target " + entry.name + " needs a description");
  }
  return tool({
    name: transferToolName(entry.name),
    description:
      "Hand this task to the " + entry.name + " agent instead of answering: " + entry.description,
    inputSchema: TRANSFER_INPUT_SCHEMA,
    outputSchema: z.object({ target: z.string(), reason: z.string().optional() }),
    execute(input) {
      return {
        target: entry.name,
        ...(input.reason === undefined ? {} : { reason: input.reason }),
      };
    },
  });
}

/** True when a tool result is a transfer signal, so the loop can tell a handover from an answer. */
export function isTransferSignal(value: unknown): value is TransferSignal {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { target?: unknown }).target === "string" &&
    ((value as { reason?: unknown }).reason === undefined ||
      typeof (value as { reason?: unknown }).reason === "string")
  );
}
