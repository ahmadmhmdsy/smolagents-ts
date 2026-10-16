import { populateTemplate } from "./populate-template.js";
import {
  CODE_AGENT_SYSTEM_TEMPLATE,
  CODE_FENCE,
  MANAGED_AGENTS_SECTION_TEMPLATE,
  TOOL_CALLING_AGENT_SYSTEM_TEMPLATE,
} from "./templates.js";

export interface BuildCodeAgentSystemPromptOptions {
  /**
   * Pre-rendered tool documentation, one line per tool. An empty string means "no tools", which the prompt states
   * explicitly rather than leaving a blank. The registry's renderer emits one bullet plus an Arguments line per tool,
   * so count lines rather than tools.
   */
  toolDescriptions: string;
  /**
   * Pre-rendered documentation of the managed agents (the "team members" the agent may delegate to),
   * one line per managed agent. An empty string, or omission, means the prompt carries no managed-agents section.
   */
  managedAgentDescriptions?: string;
  /** Defaults to "JavaScript". */
  language?: string;
  /** Appended verbatim at the end of the prompt. */
  customInstructions?: string;
}

/** The managed-agents section, or an empty string when there are none to list. */
function managedAgentsSection(descriptions: string | undefined): string {
  if (descriptions === undefined || descriptions.trim() === "") return "";
  return populateTemplate(MANAGED_AGENTS_SECTION_TEMPLATE, { managedAgentDescriptions: descriptions });
}

export function buildCodeAgentSystemPrompt(options: BuildCodeAgentSystemPromptOptions): string {
  const toolDescriptions =
    options.toolDescriptions.trim() === ""
      ? "(no tools are available; solve the task with code alone)"
      : options.toolDescriptions;
  return populateTemplate(CODE_AGENT_SYSTEM_TEMPLATE, {
    language: options.language ?? "JavaScript",
    codeFence: CODE_FENCE,
    toolDescriptions,
    managedAgents: managedAgentsSection(options.managedAgentDescriptions),
    customInstructions: options.customInstructions ?? "",
  });
}

export function buildToolCallingAgentSystemPrompt(
  options: BuildCodeAgentSystemPromptOptions,
): string {
  const toolDescriptions =
    options.toolDescriptions.trim() === ""
      ? "(no tools are available; call final_answer to finish)"
      : options.toolDescriptions;
  return populateTemplate(TOOL_CALLING_AGENT_SYSTEM_TEMPLATE, {
    toolDescriptions,
    managedAgents: managedAgentsSection(options.managedAgentDescriptions),
    customInstructions: options.customInstructions ?? "",
  });
}
