import { CliUsageError, HelpRequested } from "./errors.js";

/** The parsed command line. The optional fields are absent when their flag was absent. */
export interface CliArguments {
  /** Absent when the positional argument was omitted; the bin then runs interactive mode. */
  prompt?: string;
  modelType: string;
  actionType: string;
  modelId: string;
  imports: string[];
  tools: string[];
  verbosityLevel: number;
  provider?: string;
  apiBase?: string;
  apiKey?: string;
}

/** The defaults upstream cli.py declares at 1.27.0.dev0, ported unchanged. */
export const DEFAULT_MODEL_TYPE = "InferenceClientModel";
export const DEFAULT_ACTION_TYPE = "code";
export const DEFAULT_MODEL_ID = "Qwen/Qwen3-Next-80B-A3B-Thinking";
export const DEFAULT_TOOLS = ["web_search"];
export const DEFAULT_VERBOSITY_LEVEL = 1;

/** The interactive default for the model id differs from the flag default, as it does upstream. */
export const INTERACTIVE_MODEL_ID = "Qwen/Qwen2.5-Coder-32B-Instruct";

/** The help text. It names where this port diverges from upstream where a caller can see it. */
export const USAGE = [
  "Usage: smolagent [options] [prompt]",
  "",
  "Run an agent. With no prompt, an interactive setup asks for the configuration",
  "and then for the task.",
  "",
  "Positional arguments:",
  "  prompt                the task; omit it to be asked interactively",
  "",
  "Options:",
  "  -h, --help            show this help and exit",
  "  --model-type TYPE     InferenceClientModel (default) or OpenAIModel",
  "  --action-type TYPE    code (default) or tool_calling",
  "  --model-id ID         the model identifier",
  "  --imports NAME ...    accepted for compatibility; the JavaScript executor has",
  "                        no import allow-list, so the names are only echoed",
  "  --tools NAME ...      tools to load; defaults to web_search",
  "  --verbosity-level N   0 quiet, 1 default (default), 2 verbose",
  "  --provider NAME       the InferenceClientModel provider label",
  "  --api-base URL        the endpoint for OpenAIModel",
  "  --api-key KEY         the key; without it HF_TOKEN or OPENAI_API_KEY is read",
  "",
  "Environment:",
  "  HF_TOKEN              read when --api-key is absent and the type is",
  "                        InferenceClientModel",
  "  OPENAI_API_KEY        read when --api-key is absent and the type is OpenAIModel",
].join("\n");

type ValueOption =
  | "modelType"
  | "actionType"
  | "modelId"
  | "verbosityLevel"
  | "provider"
  | "apiBase"
  | "apiKey";

const VALUE_OPTIONS: ReadonlyMap<string, ValueOption> = new Map([
  ["--model-type", "modelType"],
  ["--action-type", "actionType"],
  ["--model-id", "modelId"],
  ["--verbosity-level", "verbosityLevel"],
  ["--provider", "provider"],
  ["--api-base", "apiBase"],
  ["--api-key", "apiKey"],
]);

type ListOption = "imports" | "tools";

const LIST_OPTIONS: ReadonlyMap<string, ListOption> = new Map([
  ["--imports", "imports"],
  ["--tools", "tools"],
]);

const INTEGER = new RegExp("^-?[0-9]+$");

/**
 * True when a token is read as an option rather than as a value. A lone dash is a
 * value, which is what argparse does with it.
 */
function isOption(token: string): boolean {
  return token.length > 1 && token.startsWith("-");
}

/**
 * Read argv the way upstream's argparse definition reads it. Hand-rolled because
 * --imports and --tools take a space-separated list, which node:util's parseArgs
 * does not model, and because the upstream shape is the behaviour to reproduce.
 */
export function parseArguments(argv: readonly string[]): CliArguments {
  const parsed: CliArguments = {
    modelType: DEFAULT_MODEL_TYPE,
    actionType: DEFAULT_ACTION_TYPE,
    modelId: DEFAULT_MODEL_ID,
    imports: [],
    tools: [...DEFAULT_TOOLS],
    verbosityLevel: DEFAULT_VERBOSITY_LEVEL,
  };
  let prompt: string | undefined;
  let optionsEnded = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] as string;

    if (optionsEnded) {
      if (prompt !== undefined) throw new CliUsageError("unrecognized arguments: " + token);
      prompt = token;
      continue;
    }

    if (token === "--") {
      optionsEnded = true;
      continue;
    }

    if (token === "-h" || token === "--help") {
      throw new HelpRequested(USAGE);
    }

    if (!isOption(token)) {
      if (prompt !== undefined) throw new CliUsageError("unrecognized arguments: " + token);
      prompt = token;
      continue;
    }

    const equals = token.indexOf("=");
    const name = equals === -1 ? token : token.slice(0, equals);
    const inline = equals === -1 ? undefined : token.slice(equals + 1);

    const listKey = LIST_OPTIONS.get(name);
    if (listKey !== undefined) {
      const values: string[] = inline === undefined ? [] : [inline];
      if (inline === undefined) {
        let cursor = index + 1;
        while (cursor < argv.length) {
          const next = argv[cursor] as string;
          if (isOption(next) || next === "--") break;
          values.push(next);
          cursor += 1;
        }
        index = cursor - 1;
      }
      parsed[listKey] = values;
      continue;
    }

    const valueKey = VALUE_OPTIONS.get(name);
    if (valueKey === undefined) {
      throw new CliUsageError("unrecognized arguments: " + token);
    }

    let value: string;
    if (inline !== undefined) {
      value = inline;
    } else {
      const next = argv[index + 1];
      if (next === undefined || isOption(next)) {
        throw new CliUsageError("argument " + name + ": expected one argument");
      }
      value = next;
      index += 1;
    }

    if (valueKey === "verbosityLevel") {
      if (!INTEGER.test(value)) {
        throw new CliUsageError("argument --verbosity-level: invalid int value: '" + value + "'");
      }
      parsed.verbosityLevel = Number.parseInt(value, 10);
    } else {
      parsed[valueKey] = value;
    }
  }

  if (prompt !== undefined) {
    parsed.prompt = prompt;
  }
  return parsed;
}
