import { INTERACTIVE_MODEL_ID } from "./args.js";
import type { Prompter, Writer } from "./terminal.js";
import type { ToolCatalogEntry } from "./tool-factory.js";

/** Upstream's default task prompt, from cli.py:42. */
export const LEOPARD_PROMPT =
  "How many seconds would it take for a leopard at full speed to run through Pont des Arts?";

/** The model types upstream's interactive menu offers, in its order. */
export const INTERACTIVE_MODEL_TYPES = [
  "InferenceClientModel",
  "OpenAIServerModel",
  "LiteLLMModel",
  "TransformersModel",
];

/** The action types the menu offers. */
export const ACTION_TYPES = ["code", "tool_calling"];

/** The types whose advanced branch upstream follows with endpoint questions. */
export const API_MODEL_TYPES = ["InferenceClientModel", "OpenAIServerModel", "LiteLLMModel"];

export interface InteractiveIo {
  print: Writer;
  prompter: Prompter;
  catalog: readonly ToolCatalogEntry[];
}

export interface InteractiveSelection {
  prompt: string;
  tools: string[];
  modelType: string;
  modelId: string;
  provider?: string;
  apiBase?: string;
  imports: string[];
  actionType: string;
}

/**
 * Upstream's interactive_mode, ported.
 *
 * The questions, their order and their defaults match cli.py:110-185. One question is
 * not asked here: upstream prompts for the API key with hidden input, and this port
 * asks for nothing that would be echoed, so it names the two channels a key can take
 * and leaves the prompt out.
 */
export async function interactiveMode(io: InteractiveIo): Promise<InteractiveSelection> {
  io.print("+-------------------------------------+\n");
  io.print("|  SmolaGents CLI                     |\n");
  io.print("|  Intelligent agents at your service |\n");
  io.print("+-------------------------------------+\n\n");
  io.print("Welcome to the SmolaGents CLI!\n");
  io.print("----------------------------------------------------------------------\n");

  io.print("Configuration\n");
  // Upstream asks this and then discards the answer; the reset is ported below.
  await io.prompter.ask("What kind of agent would you like to use? (code/tool_calling)", {
    default: "code",
    choices: ACTION_TYPES,
  });

  io.print("\nAvailable Tools:\n");
  for (const entry of io.catalog) {
    io.print("  - " + entry.name + ": " + entry.description + "\n");
  }
  io.print("Tools loaded from a Hugging Face Space are not supported by this port.\n");
  const toolsAnswer = await io.prompter.ask(
    "Which tools would you like to use? (space-separated names)",
    { default: "web_search" },
  );
  const tools = toolsAnswer.split(/[\s,]+/).filter((name) => name.length > 0);

  io.print("\nModel Configuration:\n");
  const modelType = await io.prompter.ask("Which model type would you like to use?", {
    default: "InferenceClientModel",
    choices: INTERACTIVE_MODEL_TYPES,
  });
  const modelId = await io.prompter.ask("Which model would you like to use?", {
    default: INTERACTIVE_MODEL_ID,
  });

  let provider: string | undefined;
  let apiBase: string | undefined;
  let imports: string[] = [];
  const advanced = await io.prompter.confirm("Would you like to configure advanced options?", {
    default: false,
  });
  if (advanced) {
    if (API_MODEL_TYPES.includes(modelType)) {
      const providerAnswer = await io.prompter.ask("Enter the provider name (optional)", { default: "" });
      if (providerAnswer.length > 0) provider = providerAnswer;
      const baseAnswer = await io.prompter.ask("Enter the API base URL (optional)", { default: "" });
      if (baseAnswer.length > 0) apiBase = baseAnswer;
      io.print(
        "The API key is read from --api-key, or from HF_TOKEN for InferenceClientModel " +
          "and OPENAI_API_KEY for OpenAIModel; this port never asks for it.\n",
      );
    }
    const importsAnswer = await io.prompter.ask(
      "Enter additional authorized imports (optional)",
      { default: "" },
    );
    imports = importsAnswer.split(/[\s,]+/).filter((name) => name.length > 0);
  }

  const prompt = await io.prompter.ask("\nEnter your prompt", { default: LEOPARD_PROMPT });

  // Upstream resets action_type to "code" at cli.py:167-168, after asking for it, so
  // the answer above never reaches the agent. Ported unchanged.
  return {
    prompt,
    tools,
    modelType,
    modelId,
    imports,
    actionType: "code",
    ...(provider === undefined ? {} : { provider }),
    ...(apiBase === undefined ? {} : { apiBase }),
  };
}
