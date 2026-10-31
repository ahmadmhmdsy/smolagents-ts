import { CliUsageError, HelpRequested } from "./errors.js";
import { DEFAULT_STATE_DIRECTORY } from "./store.js";

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
  /** The durable id a new run is stored under; absent for a run this process does not keep. */
  runId?: string;
  /** Resume the run stored under this id instead of starting a new one. */
  resume?: string;
  /** Settle the resumed run's pending request with this id, as allowed-once. */
  approve?: string;
  /** The conversation to tag a new run with or to find the newest run of. */
  conversation?: string;
  /** Branch a fresh run from this parent run's record. Needs forkStep. */
  fork?: string;
  /** The parent step a fork re-enters. */
  forkStep?: number;
  /** The directory run records live in. Defaults to DEFAULT_STATE_DIRECTORY beside the cwd. */
  stateDir: string;
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
  "  --api-base URL        the endpoint of the model; pair it with --model-type OpenAIModel",
  "  --api-key KEY         the key; without it HF_TOKEN or OPENAI_API_KEY is read",
  "  --run-id ID           store this run under ID so it survives the process",
  "  --resume ID           resume the stored run ID instead of starting a new one;",
  "                        the run parks with exit code 3 on an approval it must be given",
  "  --approve REQUEST     allow the resumed run's pending request REQUEST (needs --resume",
  "                        or --conversation to name the run)",
  "  --conversation ID     tag a new run with ID, or resume the newest run tagged with",
  "                        it instead of starting another; --run-id names a second run",
  "  --fork ID             branch a fresh run from run ID's record at --fork-step",
  "  --fork-step N         the parent step --fork re-enters (needs --fork)",
  "  --state-dir DIR       where run records live (default .smolagents)",
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
  | "apiKey"
  | "runId"
  | "resume"
  | "approve"
  | "conversation"
  | "fork"
  | "forkStep"
  | "stateDir";

const VALUE_OPTIONS: ReadonlyMap<string, ValueOption> = new Map([
  ["--model-type", "modelType"],
  ["--action-type", "actionType"],
  ["--model-id", "modelId"],
  ["--verbosity-level", "verbosityLevel"],
  ["--provider", "provider"],
  ["--api-base", "apiBase"],
  ["--api-key", "apiKey"],
  ["--run-id", "runId"],
  ["--resume", "resume"],
  ["--approve", "approve"],
  ["--conversation", "conversation"],
  ["--fork", "fork"],
  ["--fork-step", "forkStep"],
  ["--state-dir", "stateDir"],
]);

type ListOption = "imports" | "tools";

const LIST_OPTIONS: ReadonlyMap<string, ListOption> = new Map([
  ["--imports", "imports"],
  ["--tools", "tools"],
]);

/**
 * What the parsed flags risk without being wrong, one line each for stderr. A warning and not
 * a usage error, because upstream accepts both and a script may rely on them.
 */
export function argumentWarnings(args: CliArguments): string[] {
  const warnings: string[] = [];
  if (args.apiKey !== undefined) {
    warnings.push(
      "warning: --api-key is visible in the process list and shell history; prefer HF_TOKEN or OPENAI_API_KEY.",
    );
  }
  // With no prompt the interactive setup still picks the model type.
  if (args.apiBase !== undefined && args.prompt !== undefined && args.modelType === DEFAULT_MODEL_TYPE) {
    warnings.push(
      "warning: --api-base is sent with --model-type " +
        args.modelType +
        ", so HF_TOKEN goes to that endpoint; pass --model-type OpenAIModel for an OpenAI-compatible server.",
    );
  }
  return warnings;
}

const INTEGER = new RegExp("^-?[0-9]+$");

const NEGATIVE_NUMBER = /^-(?:[0-9]+|[0-9]*\.[0-9]+)$/;

/**
 * True when a token is read as an option rather than as a value. A lone dash is a
 * value, which is what argparse does with it, and so is a negative number: argparse
 * reads `-1` as a value whenever no option of its own looks like one, which holds here.
 */
function isOption(token: string): boolean {
  return token.length > 1 && token.startsWith("-") && !NEGATIVE_NUMBER.test(token);
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
    stateDir: DEFAULT_STATE_DIRECTORY,
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

    if (valueKey === "verbosityLevel" || valueKey === "forkStep") {
      if (!INTEGER.test(value)) {
        throw new CliUsageError("argument --" + (valueKey === "forkStep" ? "fork-step" : "verbosity-level") + ": invalid int value: '" + value + "'");
      }
      parsed[valueKey] = Number.parseInt(value, 10);
    } else {
      parsed[valueKey] = value;
    }
  }

  if (parsed.fork !== undefined && parsed.forkStep === undefined) {
    throw new CliUsageError(
      "argument --fork: it re-enters one parent step, so it needs --fork-step <n> to name it.",
    );
  }
  if (parsed.forkStep !== undefined && parsed.fork === undefined) {
    throw new CliUsageError("argument --fork-step: it names a parent step, so it needs --fork <runId>.");
  }
  if (parsed.fork !== undefined && parsed.resume !== undefined) {
    throw new CliUsageError(
      "argument --fork: a forked run is a new run, so it cannot be combined with --resume.",
    );
  }

  if (parsed.approve !== undefined && parsed.resume === undefined && parsed.conversation === undefined) {
    throw new CliUsageError(
      "argument --approve: it settles a pending request, so it needs --resume <runId> or --conversation <id> to name the run.",
    );
  }

  if (prompt !== undefined) {
    parsed.prompt = prompt;
  }
  return parsed;
}
