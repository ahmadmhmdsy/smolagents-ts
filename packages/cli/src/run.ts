import {
  CodeAgent,
  ToolCallingAgent,
  type CodeExecutor,
  type Model,
  type MultiStepAgent,
  type Tool,
} from "@smolagents-ts/core";
import process from "node:process";
import {
  DEFAULT_ACTION_TYPE,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_TYPE,
  DEFAULT_TOOLS,
} from "./args.js";
import { MissingExecutorError, UnsupportedActionTypeError } from "./errors.js";
import { loadModel } from "./model-factory.js";
import { renderEvent, type RenderOptions } from "./renderer.js";
import { loadTools } from "./tool-factory.js";

export interface RunSmolagentOptions {
  /** The task. */
  prompt: string;
  /** Tool names to resolve. Defaults to the CLI's default, web_search. */
  tools?: readonly string[];
  /** Model factory configuration, used only when model is absent. */
  modelType?: string;
  modelId?: string;
  provider?: string;
  apiBase?: string;
  apiKey?: string;
  /** Accepted for parity with upstream; the JavaScript executor has no allow-list. */
  imports?: readonly string[];
  actionType?: string;
  /** 0 quiet, 1 default, 2 verbose. Defaults to 1. */
  verbosityLevel?: number;
  /** Injected instead of the factory's model; the end-to-end test passes a MockModel. */
  model?: Model;
  /** Injected instead of the lazily loaded executor. */
  executor?: CodeExecutor;
  /** Where rendered text goes. Defaults to the process's stdout. */
  out?: (text: string) => void;
  /** Where a failure's message goes. Defaults to the process's stderr. */
  err?: (text: string) => void;
  /** Environment read for a provider key. Defaults to an empty map. */
  env?: Readonly<Record<string, string | undefined>>;
  /** Whether escape codes are emitted. Defaults to false. */
  color?: boolean;
  /** The loop's step budget. Defaults to the core's. */
  maxSteps?: number;
}

/**
 * Load the executor the code action needs. A caller-supplied one wins. Otherwise the
 * optional peer package is imported on demand, so a tool_calling run never needs the
 * JavaScript engine and a code run without the peer fails with instructions.
 */
async function resolveExecutor(provided: CodeExecutor | undefined): Promise<CodeExecutor> {
  if (provided !== undefined) return provided;
  try {
    const imported = (await import("@smolagents-ts/exec-quickjs")) as {
      QuickJSExecutor?: new () => CodeExecutor;
    };
    const Executor = imported.QuickJSExecutor;
    if (typeof Executor !== "function") {
      throw new Error("the package exports no QuickJSExecutor");
    }
    return new Executor();
  } catch (cause) {
    throw new MissingExecutorError(cause);
  }
}

interface BuildAgentInput {
  actionType: string;
  model: Model;
  tools: Tool[];
  executor?: CodeExecutor;
  maxSteps?: number;
}

async function buildAgent(input: BuildAgentInput): Promise<MultiStepAgent<unknown>> {
  const shared = {
    model: input.model,
    tools: input.tools,
    ...(input.maxSteps === undefined ? {} : { maxSteps: input.maxSteps }),
  };
  if (input.actionType === "code") {
    const executor = await resolveExecutor(input.executor);
    return new CodeAgent({ ...shared, executor });
  }
  if (input.actionType === "tool_calling") {
    return new ToolCallingAgent(shared);
  }
  throw new UnsupportedActionTypeError(input.actionType);
}

/**
 * Run one task and answer with the process exit code: 0 when the run completed, 1
 * when it failed or stopped. A configuration refusal is caught here rather than
 * thrown, because the bin's only job after it is to exit with the code.
 */
export async function runSmolagent(options: RunSmolagentOptions): Promise<number> {
  const out = options.out ?? ((text: string) => void process.stdout.write(text));
  const err = options.err ?? ((text: string) => void process.stderr.write(text));
  const verbosity = options.verbosityLevel ?? 1;
  const render: RenderOptions = { verbosity, color: options.color ?? false };

  try {
    if (options.imports !== undefined && options.imports.length > 0 && verbosity >= 1) {
      out(
        "[note] " +
          String(options.imports.length) +
          " authorized import(s) named (" +
          options.imports.join(", ") +
          "); the JavaScript executor has no import allow-list.\n",
      );
    }

    const tools = loadTools(options.tools ?? DEFAULT_TOOLS);
    const model =
      options.model ??
      loadModel(
        {
          modelType: options.modelType ?? DEFAULT_MODEL_TYPE,
          modelId: options.modelId ?? DEFAULT_MODEL_ID,
          ...(options.provider === undefined ? {} : { provider: options.provider }),
          ...(options.apiBase === undefined ? {} : { apiBase: options.apiBase }),
          ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
        },
        options.env === undefined ? {} : { env: options.env },
      );

    const agent = await buildAgent({
      actionType: options.actionType ?? DEFAULT_ACTION_TYPE,
      model,
      tools,
      ...(options.executor === undefined ? {} : { executor: options.executor }),
      ...(options.maxSteps === undefined ? {} : { maxSteps: options.maxSteps }),
    });

    let completed = false;
    let stopped = false;
    for await (const event of agent.stream(options.prompt)) {
      const text = renderEvent(event, render);
      if (text !== undefined) out(text);
      if (event.type === "run.completed") completed = true;
      if (
        event.type === "run.failed" ||
        event.type === "run.maxStepsReached" ||
        event.type === "run.cancelled"
      ) {
        stopped = true;
      }
    }
    return completed && !stopped ? 0 : 1;
  } catch (error) {
    err((error instanceof Error ? error.message : String(error)) + "\n");
    return 1;
  }
}
