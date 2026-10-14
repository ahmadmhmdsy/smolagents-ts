import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  ToolRegistry,
  noopLogger,
  tool,
  type CodeResult,
  type ToolCallEvent,
} from "@smolagents-ts/core";
import { z } from "zod";

import { PyodideExecutor } from "../src/executor.js";
import { defaultPyodideLoader, type PyodideLoader } from "../src/loader.js";

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

describe("PyodideExecutor against the real runtime", () => {
  let executor: PyodideExecutor;
  let registry: ToolRegistry;
  let events: ToolCallEvent[];
  let answers: unknown[];
  let logs: string[];

  beforeAll(() => {
    executor = new PyodideExecutor();
  }, 120_000);

  afterAll(async () => {
    await executor.dispose();
  });

  beforeEach(() => {
    registry = new ToolRegistry([]);
    events = [];
    answers = [];
    logs = [];
  });

  const run = (code: string, timeoutMs = 20_000): Promise<CodeResult> =>
    executor.execute(code, {
      tools: registry,
      finalAnswer: { name: "final_answer", submit: (value) => answers.push(value) },
      signal: new AbortController().signal,
      timeoutMs,
      stepIndex: 0,
      logger: noopLogger,
      onLog: (line) => logs.push(line),
      onToolCall: (event) => events.push(event),
    });

  it("captures stdout and carries it into logs and onLog", async () => {
    const result = await run('print("hello")\nprint(1 + 1)');
    expect(result.error).toBeUndefined();
    expect(result.logs).toBe("hello\n2");
    expect(logs).toEqual(["hello", "2"]);
    expect(result.isFinalAnswer).toBe(false);
    expect(result.toolCallCount).toBe(0);
  });

  it("keeps a variable across two execute() calls", async () => {
    await run("kept = 7");
    const result = await run("final_answer(kept * 2)");
    expect(result.isFinalAnswer).toBe(true);
    expect(Number(result.value)).toBe(14);
  });

  it("awaits a host tool and returns its value as the final answer", async () => {
    registry = new ToolRegistry([weather]);
    const result = await run('answer = await get_weather(city="Paris")\nfinal_answer(answer)');
    expect(result.error).toBeUndefined();
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe("sunny in Paris");
    expect(events.map((event) => event.type)).toEqual(["requested", "result"]);
    expect(answers).toEqual(["sunny in Paris"]);
    expect(result.toolCallCount).toBe(1);
  });

  it("lets except Exception catch a failed tool but not the final answer", async () => {
    registry = new ToolRegistry([boom]);
    const result = await run(
      'try:\n    await boom()\nexcept Exception as exc:\n    final_answer("caught " + str(exc))',
    );
    expect(result.isFinalAnswer).toBe(true);
    expect(String(result.value)).toContain("caught ");
    expect(events.map((event) => event.type)).toEqual(["requested", "failed"]);
  });

  it("maps a deliberate raise to AGENT_EXECUTION", async () => {
    const result = await run('raise ValueError("deliberate")');
    expect(result.error?.name).toBe("ValueError");
    expect(result.error?.code).toBe("AGENT_EXECUTION");
    expect(result.error?.message).toContain("deliberate");
    expect(result.isFinalAnswer).toBe(false);
  });

  it("refuses a disallowed import from guest code", async () => {
    const result = await run("import os");
    expect(result.error?.name).toBe("ImportError");
    expect(result.error?.message).toContain("Import of os is not allowed");
  });
});

describe("PyodideExecutor deadline and abandonment against the real runtime", () => {
  it("poisons the runtime on a timeout and detaches the abandoned run's output", async () => {
    let loads = 0;
    const loader: PyodideLoader = (options) => {
      loads += 1;
      return defaultPyodideLoader(options);
    };
    const executor = new PyodideExecutor({ loader, additionalAuthorizedImports: ["asyncio"] });
    const registry = new ToolRegistry([]);
    const run = (code: string, timeoutMs: number): Promise<CodeResult> =>
      executor.execute(code, {
        tools: registry,
        finalAnswer: { name: "final_answer", submit: () => undefined },
        signal: new AbortController().signal,
        timeoutMs,
        stepIndex: 0,
        logger: noopLogger,
      });

    const code = [
      "import asyncio",
      "for i in range(12):",
      "    await asyncio.sleep(0.05)",
      '    print("abandoned " + str(i))',
      'final_answer("never")',
    ].join("\n");

    const first = await run(code, 450);
    expect(first.error?.code).toBe("AGENT_TIMEOUT");
    expect(loads).toBe(1);

    const second = await run('print("second")', 20_000);
    expect(second.error).toBeUndefined();
    expect(second.logs).toBe("second");
    expect(loads).toBe(2);

    await executor.dispose();
  }, 120_000);
});
