import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  noopLogger,
  tool,
  type CodeResult,
  type Tool,
  type ToolCallEvent,
} from "@smolagents-ts/core";
import { QuickJSExecutor } from "../src/executor.js";

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: (input) => "sunny in " + input.city,
});

const boom = tool({
  name: "boom",
  description: "Always fails.",
  inputSchema: z.object({}),
  execute: () => {
    throw new Error("kaboom");
  },
});

interface HarnessOptions {
  tools?: readonly Tool[];
  timeoutMs?: number;
  signal?: AbortSignal;
  fetch?: typeof globalThis.fetch;
}

/** One executor, one registry, and the callbacks every assertion reads. */
function harness(options: HarnessOptions = {}) {
  const executor = new QuickJSExecutor(options.fetch === undefined ? {} : { fetch: options.fetch });
  const registry = new ToolRegistry(options.tools ?? []);
  const events: ToolCallEvent[] = [];
  const logs: string[] = [];
  const answers: unknown[] = [];
  const signal = options.signal ?? new AbortController().signal;
  const run = (code: string): Promise<CodeResult> =>
    executor.execute(code, {
      tools: registry,
      finalAnswer: { name: "final_answer", submit: (value) => answers.push(value) },
      signal,
      timeoutMs: options.timeoutMs ?? 5000,
      stepIndex: 0,
      logger: noopLogger,
      onLog: (line) => logs.push(line),
      onToolCall: (event) => events.push(event),
    });
  return { executor, events, logs, answers, run };
}

describe("QuickJSExecutor", () => {
  it("reports its capabilities", () => {
    const executor = new QuickJSExecutor({ memoryLimitBytes: 1024 });
    expect(executor.language).toBe("javascript");
    expect(executor.capabilities).toEqual({
      language: "javascript",
      isolation: "wasm",
      asyncToolCalls: true,
      timers: false,
      network: "host-mediated",
      memoryLimitBytes: 1024,
    });
  });

  it("runs a synchronous block and reports the final answer", async () => {
    const h = harness();
    try {
      const result = await h.run("const total = 5 + 3 + 1294.678;\nfinal_answer(total);");
      expect(result.isFinalAnswer).toBe(true);
      expect(result.value).toBeCloseTo(1302.678);
      expect(result.logs).toBe("");
      expect(result.toolCallCount).toBe(0);
      expect(result.error).toBeUndefined();
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
      expect(h.answers).toEqual([1302.678]);
    } finally {
      await h.executor.dispose();
    }
  });

  it("streams console output and joins it into the logs", async () => {
    const h = harness();
    try {
      const result = await h.run(
        'console.log("start");\nconsole.log("n", 1, { a: 2 });\nfinal_answer("done");',
      );
      expect(result.logs).toBe('start\nn 1 {"a":2}');
      expect(h.logs).toEqual(["start", 'n 1 {"a":2}']);
      expect(result.value).toBe("done");
    } finally {
      await h.executor.dispose();
    }
  });

  it("awaits a tool and returns its result to the guest", async () => {
    const h = harness({ tools: [weather] });
    try {
      const result = await h.run(
        'const report = await get_weather({ city: "Paris" });\nfinal_answer(report);',
      );
      expect(result.isFinalAnswer).toBe(true);
      expect(result.value).toBe("sunny in Paris");
      expect(result.toolCallCount).toBe(1);
      expect(result.error).toBeUndefined();
    } finally {
      await h.executor.dispose();
    }
  });

  it("emits requested then result under one call id", async () => {
    const h = harness({ tools: [weather] });
    try {
      const result = await h.run('await get_weather({ city: "Oslo" });\nfinal_answer("ok");');
      expect(h.events).toMatchObject([
        { type: "requested", name: "get_weather", args: { city: "Oslo" } },
        { type: "result", name: "get_weather", output: "sunny in Oslo" },
      ]);
      expect(new Set(h.events.map((event) => event.callId)).size).toBe(1);
      const durations = h.events.flatMap((event) =>
        event.type === "result" ? [event.durationMs] : [],
      );
      expect(durations[0]).toBeGreaterThanOrEqual(0);
      expect(result.toolCallCount).toBe(1);
    } finally {
      await h.executor.dispose();
    }
  });

  it("lets the guest catch a tool that throws", async () => {
    const h = harness({ tools: [boom] });
    try {
      const result = await h.run(
        'try { await boom({}); } catch (error) { final_answer("caught: " + error.message); }',
      );
      expect(result.value).toBe('caught: Tool "boom" failed: kaboom');
      expect(h.events.map((event) => event.type)).toEqual(["requested", "failed"]);
      const failed = h.events.filter((event) => event.type === "failed");
      expect(failed[0]?.error.code).toBe("AGENT_TOOL_CALL");
    } finally {
      await h.executor.dispose();
    }
  });

  it("fails only the call when the tool is unknown", async () => {
    const h = harness();
    try {
      const result = await h.run(
        'try { await callTool("nosuch", {}); } catch (error) { final_answer("caught"); }',
      );
      expect(result.value).toBe("caught");
      expect(h.events).toMatchObject([{ type: "failed", name: "nosuch" }]);
    } finally {
      await h.executor.dispose();
    }
  });

  it("fails only the call when the arguments do not match the schema", async () => {
    const h = harness({ tools: [weather] });
    try {
      const result = await h.run(
        'try { await get_weather({ city: 7 }); } catch (error) { final_answer("invalid"); }',
      );
      expect(result.value).toBe("invalid");
      const failed = h.events.filter((event) => event.type === "failed");
      expect(failed[0]?.error.message).toContain("Invalid arguments for get_weather");
      expect(h.events.some((event) => event.type === "result")).toBe(false);
    } finally {
      await h.executor.dispose();
    }
  });

  it("returns a guest error instead of rejecting the promise", async () => {
    const h = harness();
    try {
      const result = await h.run("const value = null;\nvalue.missing();");
      expect(result.isFinalAnswer).toBe(false);
      expect(result.error?.name).toBe("TypeError");
      expect(result.error?.message).toContain("null");
      expect(result.error?.code).toBe("AGENT_EXECUTION");
    } finally {
      await h.executor.dispose();
    }
  });

  it("interrupts a runaway guest and reports a timeout", async () => {
    const h = harness({ timeoutMs: 150 });
    try {
      const result = await h.run("let i = 0;\nwhile (true) { i += 1; }");
      expect(result.isFinalAnswer).toBe(false);
      expect(result.error?.code).toBe("AGENT_TIMEOUT");
      expect(result.error?.message).toContain("150 ms");
    } finally {
      await h.executor.dispose();
    }
  });

  it("stops the guest when the signal aborts", async () => {
    const controller = new AbortController();
    const h = harness({ signal: controller.signal });
    controller.abort();
    try {
      const result = await h.run('await new Promise(() => {});\nfinal_answer("never");');
      expect(result.error?.code).toBe("AGENT_CANCELLED");
      expect(result.isFinalAnswer).toBe(false);
    } finally {
      await h.executor.dispose();
    }
  });

  it("keeps guest state between execute calls", async () => {
    const h = harness();
    try {
      const first = await h.run("globalThis.total = 41;");
      expect(first.error).toBeUndefined();
      const second = await h.run("final_answer(total + 1);");
      expect(second.value).toBe(42);
    } finally {
      await h.executor.dispose();
    }
  });

  it("degrades a tool result JSON cannot express", async () => {
    const weird = tool({
      name: "weird",
      description: "Returns a bigint.",
      inputSchema: z.object({}),
      execute: () => 10n,
    });
    const h = harness({ tools: [weird] });
    try {
      const result = await h.run(
        'const value = await weird({});\nfinal_answer(typeof value + ":" + value);',
      );
      expect(result.value).toBe("string:10");
      expect(result.error).toBeUndefined();
    } finally {
      await h.executor.dispose();
    }
  });

  it("bounds the log buffer as the guest keeps printing", async () => {
    const h = harness();
    try {
      const result = await h.run(
        'for (let i = 0; i < 1500; i += 1) { console.log("x".repeat(1000)); }\nfinal_answer("done");',
      );
      expect(result.isFinalAnswer).toBe(true);
      // The guest printed 1.5 MB; the result keeps only the 50,000-character read clip of the
      // 1 MiB buffer, but every line still reached the live callback.
      expect(result.logs.length).toBeLessThanOrEqual(50_000);
      expect(result.logs.startsWith("x")).toBe(true);
      expect(result.logs.endsWith("x")).toBe(true);
      expect(result.logs).toContain("_This content has been truncated to stay below 50000 characters_");
      expect(h.logs).toHaveLength(1500);
    } finally {
      await h.executor.dispose();
    }
  });
});
