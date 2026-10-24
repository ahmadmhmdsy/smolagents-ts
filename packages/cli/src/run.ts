import {
  CodeAgent,
  FileRunStore,
  ToolCallingAgent,
  translateRecord,
  type ApprovalHandler,
  type CodeExecutor,
  type Model,
  type MultiStepAgent,
  type RunRecord,
  type RunStore,
  type SettledApprovalOutcome,
  type Tool,
} from "@smolagents-ts/core";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import {
  DEFAULT_ACTION_TYPE,
  DEFAULT_MODEL_ID,
  DEFAULT_MODEL_TYPE,
  DEFAULT_TOOLS,
} from "./args.js";
import {
  CliUsageError,
  MissingExecutorError,
  MissingStateDirectoryError,
  PendingApprovalError,
  UnknownRunError,
  UnsupportedActionTypeError,
} from "./errors.js";
import { loadModel } from "./model-factory.js";
import { renderEvent, type RenderOptions } from "./renderer.js";
import { DEFAULT_STATE_DIRECTORY, nodeRunFileSystem } from "./store.js";
import { loadTools } from "./tool-factory.js";

export interface RunSmolagentOptions {
  /** The task. Absent for a resumed run, whose task the record already holds. */
  prompt?: string;
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
  /**
   * Injected instead of the tool factory's set, for a host that owns its tools. A run named by
   * --run-id still parks per tool call, so a resume can approve one request at a time.
   */
  toolset?: readonly Tool[];
  /** Store this run under this id so it survives the process; absent for a one-shot run. */
  runId?: string;
  /** Resume the run stored under this id instead of starting a new one. */
  resume?: string;
  /** Settle the resumed run's pending request with this id, as allowed-once. */
  approve?: string;
  /**
   * Tag a new run with a conversation, or name a conversation whose newest run to resume.
   * With --run-id it tags a second run of the same conversation.
   */
  conversation?: string;
  /** The run records' directory. Defaults to DEFAULT_STATE_DIRECTORY beside the cwd. */
  stateDir?: string;
  /** The directory a relative state directory is resolved against. Defaults to the cwd. */
  cwd?: string;
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

/**
 * The approval handler a durable run installs. A headless process cannot ask anyone, so the
 * honest answer is "pending": the loop commits the request and parks, and a later invocation
 * settles it with --approve. The verdict echoes the ask because the gate refuses a mismatch.
 */
const parkOnApproval: ApprovalHandler = (request) => ({
  requestId: request.requestId,
  digest: request.digest,
  outcome: "pending",
});

interface BuildAgentInput {
  actionType: string;
  model: Model;
  tools: Tool[];
  executor?: CodeExecutor;
  maxSteps?: number;
  store?: RunStore;
}

async function buildAgent(input: BuildAgentInput): Promise<MultiStepAgent<unknown>> {
  const shared = {
    model: input.model,
    tools: input.tools,
    ...(input.maxSteps === undefined ? {} : { maxSteps: input.maxSteps }),
    ...(input.store === undefined ? {} : { store: input.store, approve: parkOnApproval }),
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

/** The task a record already holds, so a resume needs no prompt repeated on the command line. */
function taskOf(record: RunRecord): string | undefined {
  const steps = record.memory.steps as readonly { kind?: unknown; task?: unknown }[];
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    const step = steps[index];
    if (step?.kind === "task" && typeof step.task === "string") return step.task;
  }
  return undefined;
}

/** Load a run's record from a store, or undefined when the store holds none. */
async function loadRecord(store: RunStore, runId: string): Promise<RunRecord | undefined> {
  const stored = await store.load(runId);
  return stored === undefined ? undefined : translateRecord(stored, runId);
}

/**
 * The resume request a stored record needs: settle the named request as allowed-once, refuse to
 * guess when the run is waiting without --approve, or continue a run that is not waiting. Shared
 * by --resume, which names the run, and --conversation, which finds the newest run of a
 * conversation and then has the same question to answer.
 */
function resumeRequest(record: RunRecord, runId: string, approve: string | undefined): {
  requestId?: string;
  outcome?: SettledApprovalOutcome;
} {
  const pending = record.pending;
  if (approve !== undefined) {
    if (record.status !== "waiting" || pending === undefined) {
      throw new CliUsageError(
        "Run " + JSON.stringify(runId) + " is " + record.status + ", not waiting on a request; there is nothing to approve.",
      );
    }
    if (pending.requestId !== approve) {
      throw new CliUsageError(
        "Run " +
          JSON.stringify(runId) +
          " is waiting on request " +
          JSON.stringify(pending.requestId) +
          ", not " +
          JSON.stringify(approve) +
          "; nothing was settled.",
      );
    }
    return { requestId: approve, outcome: "allowed-once" };
  }
  if (record.status === "waiting" && pending !== undefined) {
    throw new PendingApprovalError(runId, pending.requestId, pending.toolName);
  }
  return {};
}

/**
 * Run one task and answer with the process exit code: 0 when the run completed, 1 when it failed
 * or stopped, and 3 when a durable run parked on an approval a later invocation must settle. A
 * configuration refusal is caught here rather than thrown, because the bin's only job after it is
 * to exit with the code.
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

    const prompt = options.prompt;
    if (prompt === undefined && options.resume === undefined && options.conversation === undefined) {
      throw new CliUsageError(
        "A run needs a task. Pass a prompt, or use --resume <runId> or --conversation <id>.",
      );
    }

    const tools =
      options.toolset !== undefined
        ? [...options.toolset]
        : loadTools(options.tools ?? DEFAULT_TOOLS);
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

    // One directory serves both flags: a relative --state-dir is resolved against the working
    // directory the bin was started in, which is where an operator expects to find it again.
    const stateDirectory = resolve(
      options.cwd ?? process.cwd(),
      options.stateDir ?? DEFAULT_STATE_DIRECTORY,
    );
    let store: RunStore | undefined;
    let task = prompt ?? "";
    let streamOptions: {
      runId?: string;
      resume?: { requestId?: string; outcome?: SettledApprovalOutcome };
      conversationId?: string;
    } = {};

    if (options.resume !== undefined) {
      if (!existsSync(stateDirectory)) {
        throw new MissingStateDirectoryError(stateDirectory);
      }
      store = new FileRunStore(nodeRunFileSystem(stateDirectory));
      const record = await loadRecord(store, options.resume);
      if (record === undefined) throw new UnknownRunError(options.resume, stateDirectory);
      streamOptions = { runId: options.resume, resume: resumeRequest(record, options.resume, options.approve) };
      task = prompt ?? taskOf(record) ?? "";
    } else if (options.conversation !== undefined && options.runId === undefined) {
      store = new FileRunStore(nodeRunFileSystem(stateDirectory));
      const latest = existsSync(stateDirectory)
        ? await store.latestForConversation(options.conversation)
        : undefined;
      if (latest === undefined) {
        if (prompt === undefined) {
          throw new CliUsageError(
            "Conversation " +
              JSON.stringify(options.conversation) +
              " has no run yet, so this invocation needs a task.",
          );
        }
        // A conversation with no run starts one, tagged so a later invocation can find it.
        streamOptions = {
          runId: options.runId ?? randomUUID(),
          conversationId: options.conversation,
        };
      } else {
        streamOptions = {
          runId: latest.runId,
          resume: resumeRequest(latest, latest.runId, options.approve),
        };
        task = prompt ?? taskOf(latest) ?? "";
      }
    } else if (options.runId !== undefined) {
      // An explicit id starts a run, not a lookup; --conversation only tags it.
      store = new FileRunStore(nodeRunFileSystem(stateDirectory));
      streamOptions = {
        runId: options.runId,
        ...(options.conversation === undefined ? {} : { conversationId: options.conversation }),
      };
    }

    const agent = await buildAgent({
      actionType: options.actionType ?? DEFAULT_ACTION_TYPE,
      model,
      tools,
      ...(options.executor === undefined ? {} : { executor: options.executor }),
      ...(options.maxSteps === undefined ? {} : { maxSteps: options.maxSteps }),
      ...(store === undefined ? {} : { store }),
    });

    let completed = false;
    let stopped = false;
    let parked = false;
    for await (const event of agent.stream(task, streamOptions)) {
      const text = renderEvent(event, render);
      if (text !== undefined) out(text);
      if (event.type === "run.completed") completed = true;
      if (event.type === "run.waiting") parked = true;
      if (
        event.type === "run.failed" ||
        event.type === "run.maxStepsReached" ||
        event.type === "run.limitReached" ||
        event.type === "run.cancelled"
      ) {
        stopped = true;
      }
    }
    if (parked) return 3;
    return completed && !stopped ? 0 : 1;
  } catch (error) {
    err((error instanceof Error ? error.message : String(error)) + "\n");
    return 1;
  }
}
