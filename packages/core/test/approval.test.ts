import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolApprovalError, withApproval } from "../src/agent/approval.js";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import { noopLogger } from "../src/logger.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool, type ToolContext } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

const context: ToolContext = {
  signal: new AbortController().signal,
  fetch: globalThis.fetch,
  callId: "t1",
  stepIndex: 3,
  logger: noopLogger,
};

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

describe("withApproval", () => {
  it("asks the handler with the validated input and the step index", async () => {
    const seen: unknown[] = [];
    const gated = withApproval(
      tool({
        name: "add",
        description: "Add two numbers.",
        inputSchema: z.object({ a: z.number(), b: z.number() }),
        execute: ({ a, b }) => a + b,
      }),
      (request) => {
        seen.push(request);
        return true;
      },
    );

    await expect(gated.execute({ a: 2, b: 3 }, context)).resolves.toBe(5);
    expect(seen).toEqual([{ name: "add", input: { a: 2, b: 3 }, stepIndex: 3 }]);
  });

  it("throws ToolApprovalError and never runs the tool when denied", async () => {
    const execute = vi.fn(() => "ran");
    const gated = withApproval(
      tool({ name: "danger", description: "d", inputSchema: z.object({}), execute }),
      () => false,
    );

    await expect(gated.execute({}, context)).rejects.toBeInstanceOf(ToolApprovalError);
    expect(execute).not.toHaveBeenCalled();
  });
});

describe("agent approval gate", () => {
  it("denies a tool call in the loop, records it as an error, and keeps going", async () => {
    const execute = vi.fn(() => "ran");
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("danger", {})] },
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "aborted" }, "c2")],
        },
      ]),
      tools: [tool({ name: "danger", description: "d", inputSchema: z.object({}), execute })],
      approve: () => false,
    });

    const result = await agent.run("use the danger tool");

    expect(execute).not.toHaveBeenCalled();
    const denied = result.steps.find((step) => step.kind === "action");
    expect(denied?.kind === "action" ? denied.observations : "").toContain("denied");
    expect(result.output).toBe("aborted");
  });

  it("runs the tool when the handler approves", async () => {
    const execute = vi.fn(() => "ran");
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("danger", {})] },
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, "c2")],
        },
      ]),
      tools: [tool({ name: "danger", description: "d", inputSchema: z.object({}), execute })],
      approve: () => true,
    });

    await agent.run("use the danger tool");

    expect(execute).toHaveBeenCalledTimes(1);
  });
});
