import { populateTemplate } from "./populate-template.js";
import {
  CODE_AGENT_SYSTEM_TEMPLATE,
  CODE_FENCE,
  TOOL_CALLING_AGENT_SYSTEM_TEMPLATE,
} from "./templates.js";

export interface BuildCodeAgentSystemPromptOptions {
  /**
   * Pre-rendered tool documentation, one line per tool. An empty string means
 * The registry's renderer emits one bullet plus an Arguments line per tool, so count lines rather than tools.
   * "no tools", which the prompt states explicitly rather than leaving a blank.
   */
  toolDescriptions: string;
  /** Defaults to "JavaScript". */
  language?: string;
  /** Appended verbatim at the end of the prompt. */
  customInstructions?: string;
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
    customInstructions: options.customInstructions ?? "",
  });
}
