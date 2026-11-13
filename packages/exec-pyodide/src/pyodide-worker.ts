/**
 * The worker script `PyodideWorkerExecutor` starts (decision 0041). It runs the in-process
 * `PyodideExecutor` unchanged, except that the guest's tool global forwards each call to the
 * host, where the real tool, its schema and its events live. The runtime is loaded as soon as
 * the init message arrives, and the host enforces each step's deadline by terminating this
 * worker, so nothing here keeps a clock.
 *
 * The same script serves a Node `worker_threads` worker and a browser module worker. It names
 * no Node builtin in an import: on Node it reaches `parentPort` through
 * `process.getBuiltinModule`, which a browser does not have.
 */

import type { Logger, ToolRegistry } from "@smolagents-ts/core";

import { PyodideExecutor, type WorkerHostedExecutorOptions } from "./executor.js";
import type {
  HostToWorkerMessage,
  WorkerExecuteMessage,
  WorkerToHostMessage,
} from "./worker-protocol.js";

interface Channel {
  post(message: WorkerToHostMessage): void;
  listen(listener: (message: HostToWorkerMessage) => void): void;
}

interface NodeParentPort {
  postMessage(message: unknown): void;
  on(event: "message", listener: (message: unknown) => void): void;
}

function openChannel(): Channel {
  const nodeProcess = (globalThis as { process?: { getBuiltinModule?: (id: string) => unknown } })
    .process;
  const workerThreads = nodeProcess?.getBuiltinModule?.("node:worker_threads") as
    | { parentPort: NodeParentPort | null }
    | undefined;
  const parentPort = workerThreads?.parentPort ?? null;
  if (parentPort !== null) {
    return {
      post: (message) => parentPort.postMessage(message),
      listen: (listener) => parentPort.on("message", (data) => listener(data as HostToWorkerMessage)),
    };
  }
  const scope = globalThis as unknown as {
    postMessage(message: unknown): void;
    addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  };
  return {
    post: (message) => scope.postMessage(message),
    listen: (listener) =>
      scope.addEventListener("message", (event) => listener(event.data as HostToWorkerMessage)),
  };
}

const channel = openChannel();
const pendingTools = new Map<number, (envelope: string) => void>();
let executor: PyodideExecutor | undefined;
let activeRunId = 0;
let nextCallId = 0;

/** The guest's `__call_tool`: one host round trip per call, answered with the host's envelope. */
function dispatch(name: string, argsJson: string): Promise<string> {
  nextCallId += 1;
  const callId = nextCallId;
  return new Promise<string>((resolve) => {
    pendingTools.set(callId, resolve);
    channel.post({ kind: "tool-call", runId: activeRunId, callId, name, argsJson });
  });
}

const forwardLogger: Logger = {
  debug: (): void => undefined,
  info: (): void => undefined,
  warn: (message: string): void => channel.post({ kind: "warn", message }),
  error: (message: string): void => channel.post({ kind: "warn", message }),
};

/** The names the guest prelude wraps; the tools themselves never cross into the worker. */
function namesOnly(names: readonly string[]): ToolRegistry {
  return { list: () => names.map((name) => ({ name })), size: names.length } as unknown as ToolRegistry;
}

async function runStep(message: WorkerExecuteMessage): Promise<void> {
  const runId = message.runId;
  activeRunId = runId;
  if (executor === undefined) {
    channel.post({
      kind: "failed",
      runId,
      name: "AgentExecutionError",
      message: "The Pyodide worker received a step before its init message.",
    });
    return;
  }
  let answer: { value: unknown } | undefined;
  try {
    const result = await executor.execute(message.code, {
      tools: namesOnly(message.toolNames),
      finalAnswer: {
        name: "final_answer",
        submit: (value) => {
          answer = { value };
        },
      },
      signal: new AbortController().signal,
      // The host owns the clock and terminates this worker when it runs out.
      timeoutMs: 0,
      stepIndex: message.stepIndex,
      logger: forwardLogger,
      onLog: (line) => channel.post({ kind: "log", runId, line }),
    });
    const done: WorkerToHostMessage = {
      kind: "done",
      runId,
      isFinalAnswer: result.isFinalAnswer,
      ...(answer === undefined ? {} : { value: answer.value }),
      ...(result.error === undefined ? {} : { error: result.error }),
    };
    try {
      channel.post(done);
    } catch {
      // An answer structured clone cannot carry (a function, a class instance) degrades to its
      // string form, as the in-process bridge degrades a tool result JSON cannot express.
      channel.post({ ...done, value: String(answer?.value) });
    }
  } catch (error) {
    channel.post({
      kind: "failed",
      runId,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Load the runtime before the host starts any step's clock: an empty step loads it and installs
 * the guard, so a cold start is never charged to a deadline.
 */
async function warmUp(target: PyodideExecutor): Promise<void> {
  try {
    await target.execute("", {
      tools: namesOnly([]),
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: new AbortController().signal,
      timeoutMs: 0,
      stepIndex: 0,
      logger: forwardLogger,
    });
    channel.post({ kind: "ready" });
  } catch (error) {
    channel.post({
      kind: "failed",
      runId: 0,
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

channel.listen((message) => {
  switch (message.kind) {
    case "init": {
      const options: WorkerHostedExecutorOptions = {
        additionalAuthorizedImports: message.additionalAuthorizedImports,
        toolDispatch: dispatch,
        ...(message.indexURL === undefined ? {} : { indexURL: message.indexURL }),
      };
      executor = new PyodideExecutor(options);
      void warmUp(executor);
      return;
    }
    case "execute":
      void runStep(message);
      return;
    case "tool-result": {
      const resolve = pendingTools.get(message.callId);
      pendingTools.delete(message.callId);
      resolve?.(message.envelope);
      return;
    }
  }
});
