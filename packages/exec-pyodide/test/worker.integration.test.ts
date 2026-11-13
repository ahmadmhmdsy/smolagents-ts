import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  ToolRegistry,
  noopLogger,
  tool,
  type CodeResult,
  type ExecuteOptions,
  type ToolCallEvent,
} from "@smolagents-ts/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";

import { PyodideWorkerExecutor } from "../src/worker-executor.js";

/**
 * The worker script runs as a real `worker_threads` worker, so it is bundled from source first:
 * a worker cannot load TypeScript, and the gate runs this project before `dist/` exists. The
 * bundle resolves the core to its source and leaves `pyodide` to this package's install, the
 * way `dist/pyodide-worker.js` reaches it from a consumer's `node_modules`.
 */
const PACKAGE_DIR = fileURLToPath(new URL("..", import.meta.url));
const OUT_DIR = fileURLToPath(new URL("../node_modules/.cache/worker-test/", import.meta.url));
const WORKER_FILE = OUT_DIR + "pyodide-worker.mjs";

async function bundleWorker(): Promise<void> {
  const fromVite = createRequire(createRequire(PACKAGE_DIR + "package.json").resolve("vite"));
  const esbuild = (await import(pathToFileURL(fromVite.resolve("esbuild")).href)) as {
    build(options: Record<string, unknown>): Promise<unknown>;
  };
  mkdirSync(OUT_DIR, { recursive: true });
  await esbuild.build({
    entryPoints: [fileURLToPath(new URL("../src/pyodide-worker.ts", import.meta.url))],
    outfile: WORKER_FILE,
    bundle: true,
    format: "esm",
    platform: "node",
    external: ["pyodide"],
    alias: {
      "@smolagents-ts/core": fileURLToPath(new URL("../../core/src/index.ts", import.meta.url)),
    },
    logLevel: "silent",
  });
}

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: (input) => "sunny in " + input.city,
});

function options(overrides: Partial<ExecuteOptions> & { registry?: ToolRegistry } = {}): {
  options: ExecuteOptions;
  answers: unknown[];
  events: ToolCallEvent[];
  logs: string[];
} {
  const answers: unknown[] = [];
  const events: ToolCallEvent[] = [];
  const logs: string[] = [];
  return {
    answers,
    events,
    logs,
    options: {
      tools: overrides.registry ?? new ToolRegistry([]),
      finalAnswer: { name: "final_answer", submit: (value) => answers.push(value) },
      signal: overrides.signal ?? new AbortController().signal,
      timeoutMs: overrides.timeoutMs ?? 20_000,
      stepIndex: 0,
      logger: noopLogger,
      onLog: (line) => logs.push(line),
      onToolCall: (event) => events.push(event),
    },
  };
}

describe("PyodideWorkerExecutor in a Node worker against the real runtime", () => {
  let executor: PyodideWorkerExecutor;
  const run = (code: string, extra: Parameters<typeof options>[0] = {}) => {
    const call = options(extra);
    return executor.execute(code, call.options).then((result) => ({ result, ...call }));
  };

  beforeAll(async () => {
    await bundleWorker();
    executor = new PyodideWorkerExecutor({ workerUrl: pathToFileURL(WORKER_FILE) });
  }, 60_000);

  afterAll(async () => {
    await executor.dispose();
  });

  it("reports the bound it enforces as cpuTimeLimitMs", () => {
    expect(executor.capabilities.cpuTimeLimitMs).toBe(30_000);
    expect(executor.capabilities.isolation).toBe("wasm");
  });

  it("runs a step, keeps globals across steps and calls a host tool", async () => {
    const first = await run('kept = 41\nprint("hello")');
    expect(first.result.error).toBeUndefined();
    expect(first.result.logs).toBe("hello");
    expect(first.logs).toEqual(["hello"]);

    const second = await run(
      'answer = await get_weather(city="Paris")\nfinal_answer(answer + " " + str(kept + 1))',
      { registry: new ToolRegistry([weather]) },
    );
    expect(second.result.error).toBeUndefined();
    expect(second.result.isFinalAnswer).toBe(true);
    expect(second.result.value).toBe("sunny in Paris 42");
    expect(second.answers).toEqual(["sunny in Paris 42"]);
    expect(second.events.map((event) => event.type)).toEqual(["requested", "result"]);
    expect(second.result.toolCallCount).toBe(1);
  }, 60_000);

  it("refuses a disallowed import, as the in-process executor does", async () => {
    const { result } = await run("import os");
    expect(result.error?.name).toBe("ImportError");
  }, 60_000);

  it("cuts a synchronous busy loop at its deadline, and the next step starts a fresh worker", async () => {
    await run("survivor = 1");
    const startedAt = Date.now();
    const stopped = await run('print("looping")\nwhile True:\n    pass', { timeoutMs: 1_500 });
    const elapsed = Date.now() - startedAt;

    expect(stopped.result.error?.code).toBe("AGENT_TIMEOUT");
    expect(stopped.result.error?.message).toContain("1500 ms");
    expect(stopped.result.isFinalAnswer).toBe(false);
    // The in-process executor cannot stop this loop at all; here the host terminates the
    // worker at the deadline. The slack covers message latency, not a cold start.
    expect(elapsed).toBeLessThan(4_000);

    const after = await run("print(survivor)");
    expect(after.result.error?.name).toBe("NameError");
    const fresh = await run("final_answer(6 * 7)");
    expect(fresh.result.value).toBe(42);
  }, 90_000);

  it("cuts a busy loop on abort with a cancellation", async () => {
    await run("pass");
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 500);
    const startedAt = Date.now();
    const { result } = await run("while True:\n    pass", { signal: controller.signal });
    expect(result.error?.code).toBe("AGENT_CANCELLED");
    expect(Date.now() - startedAt).toBeLessThan(3_000);
  }, 60_000);

  it("bounds a step by cpuTimeLimitMs when it is shorter than the step's timeout", async () => {
    const bounded = new PyodideWorkerExecutor({
      workerUrl: pathToFileURL(WORKER_FILE),
      cpuTimeLimitMs: 1_000,
    });
    try {
      await bounded.execute("pass", options().options);
      const startedAt = Date.now();
      const result: CodeResult = await bounded.execute(
        "while True:\n    pass",
        options({ timeoutMs: 20_000 }).options,
      );
      expect(result.error?.code).toBe("AGENT_TIMEOUT");
      expect(Date.now() - startedAt).toBeLessThan(3_500);
    } finally {
      await bounded.dispose();
    }
    await expect(bounded.execute("pass", options().options)).rejects.toThrow(/disposed/);
  }, 60_000);
});

describe("PyodideWorkerExecutor without a runtime", () => {
  it("throws a typed executor error when the worker dies on its own", async () => {
    let fail: (error: unknown) => void = () => undefined;
    const executor = new PyodideWorkerExecutor({
      createWorker: () => ({
        postMessage: () => undefined,
        onMessage: () => undefined,
        onError: (listener) => {
          fail = listener;
        },
        terminate: () => undefined,
      }),
    });
    const pending = executor.execute("pass", options().options);
    fail(new Error("worker crashed"));
    await expect(pending).rejects.toMatchObject({ code: "AGENT_EXECUTION" });
  });

  it("rejects a non-positive cpuTimeLimitMs", () => {
    expect(() => new PyodideWorkerExecutor({ cpuTimeLimitMs: 0 })).toThrow(/cpuTimeLimitMs/);
  });
});
