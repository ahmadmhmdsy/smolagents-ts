import { describe, expect, it } from "vitest";
import {
  AgentExecutionError,
  ToolRegistry,
  noopLogger,
  tool,
  type CodeResult,
  type Tool,
  type ToolCallEvent,
} from "@smolagents-ts/core";
import { z } from "zod";

import { PyodideExecutor } from "../src/executor.js";
import type { PyodideLoader, PyodideRuntime } from "../src/loader.js";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: (input) => "sunny in " + input.city,
});

interface FakeHandle {
  readonly runtime: PyodideRuntime;
  readonly globals: Map<string, unknown>;
  readonly runPythonSources: string[];
  readonly runPythonAsyncSources: string[];
  readonly counters: { stdoutInstalls: number; stderrInstalls: number };
}

/** A loader that mints a fresh runtime per call and records every source it is handed. */
function createFakeLoader(onRunAsync?: (handle: FakeHandle) => Promise<unknown> | unknown) {
  const handles: FakeHandle[] = [];
  let loads = 0;
  const loader: PyodideLoader = async () => {
    loads += 1;
    const globals = new Map<string, unknown>();
    const runPythonSources: string[] = [];
    const runPythonAsyncSources: string[] = [];
    const counters = { stdoutInstalls: 0, stderrInstalls: 0 };
    const runtime: PyodideRuntime = {
      version: "314.0.7-fake",
      globals: {
        get: (name) => globals.get(name),
        set: (name, value) => {
          globals.set(name, value);
        },
        has: (name) => globals.has(name),
        delete: (name) => {
          globals.delete(name);
        },
      },
      runPython: (code) => {
        runPythonSources.push(code);
      },
      runPythonAsync: async (code) => {
        runPythonAsyncSources.push(code);
        return onRunAsync === undefined ? undefined : onRunAsync(handles[handles.length - 1] as FakeHandle);
      },
      setStdout: () => {
        counters.stdoutInstalls += 1;
      },
      setStderr: () => {
        counters.stderrInstalls += 1;
      },
    };
    handles.push({ runtime, globals, runPythonSources, runPythonAsyncSources, counters });
    return runtime;
  };
  return { loader, loads: () => loads, handles };
}

function harness(loader: PyodideLoader, tools: readonly Tool[] = []) {
  const executor = new PyodideExecutor({ loader });
  const events: ToolCallEvent[] = [];
  const answers: unknown[] = [];
  const logs: string[] = [];
  const registry = new ToolRegistry(tools);
  const run = (
    code: string,
    options: { timeoutMs?: number; signal?: AbortSignal } = {},
  ): Promise<CodeResult> =>
    executor.execute(code, {
      tools: registry,
      finalAnswer: { name: "final_answer", submit: (value) => answers.push(value) },
      signal: options.signal ?? new AbortController().signal,
      timeoutMs: options.timeoutMs ?? 5000,
      stepIndex: 1,
      logger: noopLogger,
      onLog: (line) => logs.push(line),
      onToolCall: (event) => events.push(event),
    });
  return { executor, run, events, answers, logs };
}

describe("PyodideExecutor", () => {
  it("reports its language and capabilities", () => {
    const executor = new PyodideExecutor({ loader: createFakeLoader().loader });
    expect(executor.language).toBe("python");
    expect(executor.capabilities).toEqual({
      language: "python",
      isolation: "wasm",
      asyncToolCalls: true,
      timers: false,
      network: "host-mediated",
    });
    expect(executor.capabilities.memoryLimitBytes).toBeUndefined();
    expect(executor.capabilities.cpuTimeLimitMs).toBeUndefined();
  });

  it("loads one runtime across three execute() calls and seeds the prelude and guard once", async () => {
    const fake = createFakeLoader();
    const h = harness(fake.loader);
    await h.run("first");
    await h.run("second");
    await h.run("third");
    expect(fake.loads()).toBe(1);
    expect(fake.handles).toHaveLength(1);
    const handle = fake.handles[0] as FakeHandle;
    expect(handle.counters.stdoutInstalls).toBe(1);
    expect(handle.counters.stderrInstalls).toBe(1);
    expect(handle.runPythonSources).toHaveLength(2);
    expect(handle.runPythonSources[0]).toContain("_FinalAnswerSignal");
    expect(handle.runPythonSources[1]).toContain("_builtins.__import__ = _ts_import");
    expect(handle.runPythonSources[1]).toContain("_TS_GUEST_GLOBALS = globals()");
    expect(handle.runPythonAsyncSources).toHaveLength(3);
    expect(handle.runPythonAsyncSources[0]).toContain("first");
    expect(handle.runPythonAsyncSources[2]).toContain("third");
  });

  it("installs a fresh host dispatcher in the guest globals before each run", async () => {
    const fake = createFakeLoader();
    const h = harness(fake.loader);
    await h.run("first");
    const first = fake.handles[0]?.globals.get("__call_tool");
    expect(typeof first).toBe("function");
    await h.run("second");
    const second = fake.handles[0]?.globals.get("__call_tool");
    expect(typeof second).toBe("function");
    expect(second).not.toBe(first);
  });

  it("binds this run's tool names as guest callables", async () => {
    const fake = createFakeLoader();
    const h = harness(fake.loader, [weather]);
    await h.run("x");
    expect(fake.handles[0]?.runPythonAsyncSources[0]).toContain('_make_tool("get_weather")');
  });

  it("passes additionalAuthorizedImports into the guard source", async () => {
    const fake = createFakeLoader();
    const executor = new PyodideExecutor({
      loader: fake.loader,
      additionalAuthorizedImports: ["asyncio"],
    });
    await executor.execute("x", {
      tools: new ToolRegistry([]),
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: new AbortController().signal,
      timeoutMs: 1000,
      stepIndex: 0,
      logger: noopLogger,
    });
    expect(fake.handles[0]?.runPythonSources[1]).toContain('"asyncio"');
  });

  it("reports a final answer and submits it to the sink", async () => {
    const fake = createFakeLoader((handle) => {
      handle.globals.set("_final_answer_raised", true);
      handle.globals.set("_final_answer_value", { answer: 42, text: "hi" });
    });
    const h = harness(fake.loader);
    const result = await h.run("final_answer(42)");
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toEqual({ answer: 42, text: "hi" });
    expect(h.answers).toEqual([{ answer: 42, text: "hi" }]);
    expect(result.error).toBeUndefined();
  });

  it("treats the final-answer signal rejection as an answer, not a failure", async () => {
    const signal = Object.assign(new Error("Traceback...\n_FinalAnswerSignal"), {
      type: "_FinalAnswerSignal",
    });
    const fake = createFakeLoader((handle) => {
      handle.globals.set("_final_answer_raised", true);
      handle.globals.set("_final_answer_value", "raised");
      return Promise.reject(signal);
    });
    const h = harness(fake.loader);
    const result = await h.run('final_answer("raised")');
    expect(result.error).toBeUndefined();
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe("raised");
    expect(h.answers).toEqual(["raised"]);
  });

  it("unwraps a proxy final answer and destroys it", async () => {
    let destroyed = false;
    const fake = createFakeLoader((handle) => {
      handle.globals.set("_final_answer_raised", true);
      handle.globals.set("_final_answer_value", {
        toJs: (options: unknown) => ({ plain: true, options }),
        destroy: () => {
          destroyed = true;
        },
      });
    });
    const h = harness(fake.loader);
    const result = await h.run("final_answer({})");
    expect(result.value).toEqual({ plain: true, options: { create_pyproxies: false } });
    expect(destroyed).toBe(true);
  });

  it("maps a guest failure to AGENT_EXECUTION with the Python class name", async () => {
    const failure = Object.assign(new Error("Traceback...\nValueError: deliberate"), {
      type: "ValueError",
    });
    const fake = createFakeLoader(() => Promise.reject(failure));
    const h = harness(fake.loader);
    const result = await h.run("raise ValueError('deliberate')");
    expect(result.error).toMatchObject({ name: "ValueError", code: "AGENT_EXECUTION" });
    expect(result.error?.message).toContain("deliberate");
    expect(result.isFinalAnswer).toBe(false);
  });

  it("reports a timeout, disables the bridge, and loads a new runtime next", async () => {
    let calls = 0;
    const fake = createFakeLoader(() => {
      calls += 1;
      return calls === 1 ? new Promise<unknown>(() => undefined) : Promise.resolve();
    });
    const h = harness(fake.loader);
    const first = await h.run("while True: pass", { timeoutMs: 25 });
    expect(first.error?.code).toBe("AGENT_TIMEOUT");
    expect(fake.loads()).toBe(1);
    const callable = fake.handles[0]?.globals.get("__call_tool") as (
      name: string,
      args: string,
    ) => Promise<string>;
    const envelope = JSON.parse(await callable("anything", "{}")) as Record<string, unknown>;
    expect(envelope.ok).toBe(false);
    const second = await h.run("ok", { timeoutMs: 5000 });
    expect(second.error).toBeUndefined();
    expect(fake.loads()).toBe(2);
  });

  it("reports a cancellation and poisons the runtime", async () => {
    let calls = 0;
    const fake = createFakeLoader(() => {
      calls += 1;
      return calls === 1 ? new Promise<unknown>(() => undefined) : Promise.resolve();
    });
    const h = harness(fake.loader);
    const controller = new AbortController();
    const pending = h.run("while True: pass", { timeoutMs: 5000, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    const result = await pending;
    expect(result.error?.code).toBe("AGENT_CANCELLED");
    const second = await h.run("ok", { timeoutMs: 5000 });
    expect(second.error).toBeUndefined();
    expect(fake.loads()).toBe(2);
  });

  it("reports a cancellation before loading when the signal is already aborted", async () => {
    const fake = createFakeLoader();
    const h = harness(fake.loader);
    const controller = new AbortController();
    controller.abort();
    const result = await h.run("print(1)", { signal: controller.signal });
    expect(result.error?.code).toBe("AGENT_CANCELLED");
    expect(fake.loads()).toBe(0);
  });

  it("dispose() is idempotent and a later execute() throws a typed error", async () => {
    const fake = createFakeLoader();
    const h = harness(fake.loader);
    await h.run("a");
    await h.executor.dispose();
    await expect(h.executor.dispose()).resolves.toBeUndefined();
    await expect(h.run("b")).rejects.toBeInstanceOf(AgentExecutionError);
  });

  it("reports a runtime that will not load as a typed executor error", async () => {
    const loader: PyodideLoader = async () => {
      throw new Error("no wasm here");
    };
    const h = harness(loader);
    await expect(h.run("a")).rejects.toBeInstanceOf(AgentExecutionError);
  });
});
