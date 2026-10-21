import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";
import {
  ToolRegistry,
  noopLogger,
  tool,
  type CodeResult,
  type Logger,
  type Tool,
} from "@smolagents-ts/core";
import { QuickJSExecutor, type QuickJSExecutorOptions } from "../src/executor.js";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** A tool that answers after `ms`, so a step can end while the call is still in flight. */
function slowTool(name: string, ms: number, output: unknown = "late"): Tool {
  return tool({
    name,
    description: "Answers after a delay.",
    inputSchema: z.object({}),
    execute: async () => {
      await delay(ms);
      return output;
    },
  });
}

function harness(tools: readonly Tool[], options: QuickJSExecutorOptions = {}) {
  const executor = new QuickJSExecutor(options);
  const registry = new ToolRegistry(tools);
  const answers: unknown[] = [];
  const warnings: string[] = [];
  const logger: Logger = { ...noopLogger, warn: (message) => warnings.push(message) };
  const run = (code: string, timeoutMs = 5000): Promise<CodeResult> =>
    executor.execute(code, {
      tools: registry,
      finalAnswer: { name: "final_answer", submit: (value) => answers.push(value) },
      signal: new AbortController().signal,
      timeoutMs,
      stepIndex: 0,
      logger,
    });
  return { executor, answers, warnings, run };
}

describe("QuickJSExecutor tool-call lifecycle", () => {
  const rejections: unknown[] = [];
  const onRejection = (reason: unknown): void => {
    rejections.push(reason);
  };
  beforeEach(() => {
    rejections.length = 0;
    process.on("unhandledRejection", onRejection);
  });
  afterEach(() => {
    process.off("unhandledRejection", onRejection);
  });

  it("never resumes a step that timed out while a tool was in flight", async () => {
    const h = harness([slowTool("slow", 80), slowTool("wait", 250, "on time")]);
    try {
      const first = await h.run('const v = await slow({});\nfinal_answer("late:" + v);', 20);
      expect(first.error?.code).toBe("AGENT_TIMEOUT");
      // The second step drives the job queue long enough for the first step's tool to answer.
      const second = await h.run('const w = await wait({});\nfinal_answer(w);');
      expect(second.error).toBeUndefined();
      expect(second.value).toBe("on time");
      expect(h.answers).toEqual(["on time"]);
    } finally {
      await h.executor.dispose();
    }
  });

  it("disposes cleanly and quietly while a tool call is still pending", async () => {
    const h = harness([slowTool("slow", 60)]);
    await h.run("globalThis.ready = true;");
    const result = await h.run("await slow({});", 20);
    expect(result.error?.code).toBe("AGENT_TIMEOUT");
    await h.executor.dispose();
    await delay(120);
    expect(h.warnings).toEqual([]);
    expect(rejections).toEqual([]);
  });

  it("releases each tool result instead of holding it until the realm is disposed", async () => {
    const big = "x".repeat(256 * 1024);
    const h = harness([slowTool("big", 0, big)], { memoryLimitBytes: 4 * 1024 * 1024 });
    try {
      const result = await h.run(
        "let total = 0;\nfor (let i = 0; i < 48; i += 1) { total += (await big({})).length; }\nfinal_answer(total);",
      );
      expect(result.error).toBeUndefined();
      expect(result.value).toBe(48 * big.length);
    } finally {
      await h.executor.dispose();
    }
    expect(h.warnings).toEqual([]);
  });

  it("does not claim timers the guest realm does not have", async () => {
    const h = harness([]);
    try {
      const result = await h.run("final_answer(typeof setTimeout);");
      expect(result.value).toBe("undefined");
      expect(h.executor.capabilities.timers).toBe(false);
    } finally {
      await h.executor.dispose();
    }
  });
});
