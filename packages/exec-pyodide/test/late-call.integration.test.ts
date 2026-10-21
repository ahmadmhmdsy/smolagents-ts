import { describe, expect, it } from "vitest";
import { ToolRegistry, noopLogger, tool, type ToolCallEvent } from "@smolagents-ts/core";
import { z } from "zod";

import { PyodideExecutor } from "../src/executor.js";

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe("PyodideExecutor late tool calls against the real runtime", () => {
  it("does not run a tool for a coroutine that outlives its step", async () => {
    const executor = new PyodideExecutor({ additionalAuthorizedImports: ["asyncio"] });
    let executed = 0;
    const ping = tool({
      name: "ping",
      description: "Counts calls.",
      inputSchema: z.object({}),
      execute: () => {
        executed += 1;
        return "pong";
      },
    });
    const events: ToolCallEvent[] = [];
    try {
      const result = await executor.execute(
        [
          "import asyncio",
          "async def later():",
          "    await asyncio.sleep(0.05)",
          "    await ping()",
          "_pending = asyncio.ensure_future(later())",
        ].join("\n"),
        {
          tools: new ToolRegistry([ping]),
          finalAnswer: { name: "final_answer", submit: () => undefined },
          signal: new AbortController().signal,
          timeoutMs: 20_000,
          stepIndex: 0,
          logger: noopLogger,
          onToolCall: (event) => events.push(event),
        },
      );
      expect(result.error).toBeUndefined();
      expect(result.toolCallCount).toBe(0);
      await delay(400);
      expect(executed).toBe(0);
      expect(events).toEqual([]);
    } finally {
      await executor.dispose();
    }
  }, 120_000);
});
