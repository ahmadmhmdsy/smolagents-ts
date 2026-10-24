import { ToolRegistry, noopLogger, tool } from "@smolagents-ts/core";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { RemoteExecutor } from "../src/executor.js";

const hostTool = tool({
  name: "host_tool",
  description: "a tool that only exists on the host",
  inputSchema: z.object({ n: z.number() }),
  execute: ({ n }) => n * 2,
});

const otherTool = tool({
  name: "other_tool",
  description: "a tool the transfer does not declare",
  inputSchema: z.object({}),
  execute: () => "other",
});

function options(tools: ToolRegistry) {
  return {
    tools,
    finalAnswer: { name: "final_answer", submit: () => undefined },
    signal: new AbortController().signal,
    timeoutMs: 10_000,
    stepIndex: 0,
    logger: noopLogger,
  };
}

describe("the Phase 4 exit criterion, exec-remote half", () => {
  it("a remote guest calls a host tool by name through a declared transfer", async () => {
    const calls: string[] = [];
    const recorded = tool({
      name: "host_tool",
      description: "a tool that only exists on the host",
      inputSchema: z.object({ n: z.number() }),
      execute: ({ n }) => {
        calls.push("host_tool");
        return n * 2;
      },
    });
    const executor = new RemoteExecutor({
      sandbox: new ProcessSandbox(),
      transfer: { tools: [recorded.toSpec()], variables: { seed: 20 } },
    });
    try {
      const result = await executor.execute(
        "final_answer(host_tool(seed + 1))",
        options(new ToolRegistry([recorded])),
      );
      expect(result.isFinalAnswer).toBe(true);
      expect(result.value).toBe(42);
      expect(calls).toEqual(["host_tool"]);
      expect(result.toolCallCount).toBe(1);
    } finally {
      await executor.dispose();
    }
  });

  it("a tool outside the declared transfer is not installed in the guest", async () => {
    const executor = new RemoteExecutor({
      sandbox: new ProcessSandbox(),
      transfer: { tools: [hostTool.toSpec()], variables: {} },
    });
    try {
      const result = await executor.execute(
        'final_answer(other_tool())',
        options(new ToolRegistry([hostTool, otherTool])),
      );
      expect(result.isFinalAnswer).toBe(false);
      expect(result.error?.name).toBe("NameError");
    } finally {
      await executor.dispose();
    }
  });
});
