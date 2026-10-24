import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ToolApprovalError, withApproval } from "../src/agent/approval.js";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { noopLogger } from "../src/logger.js";
import { digestOf } from "../src/utils/digest.js";
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

function addTool(execute = vi.fn(({ a, b }: { a: number; b: number }) => a + b)) {
  return tool({
    name: "add",
    description: "Add two numbers.",
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    execute,
  });
}

describe("withApproval", () => {
  it("asks with the validated input, the call id and a stable digest", async () => {
    const seen: unknown[] = [];
    const gated = withApproval(addTool(), (request) => {
      seen.push(request);
      return true;
    });

    await expect(gated.execute({ a: 2, b: 3 }, context)).resolves.toBe(5);
    expect(seen).toHaveLength(1);
    const request = seen[0] as { name: string; input: unknown; requestId: string; digest: string; stepIndex: number };
    expect(request.name).toBe("add");
    expect(request.input).toEqual({ a: 2, b: 3 });
    expect(request.requestId).toBe("t1");
    expect(request.digest).toBe(digestOf({ a: 2, b: 3 }));
    expect(request.stepIndex).toBe(3);
  });

  it("keeps a boolean as shorthand for granted and rejected", async () => {
    await expect(withApproval(addTool(), () => true).execute({ a: 1, b: 1 }, context)).resolves.toBe(2);
    await expect(withApproval(addTool(), () => false).execute({ a: 1, b: 1 }, context)).rejects.toBeInstanceOf(
      ToolApprovalError,
    );
  });

  it("refuses a verdict written for another call", async () => {
    const execute = vi.fn(() => "ran");
    const gated = withApproval(
      tool({ name: "danger", description: "d", inputSchema: z.object({}), execute }),
      () => ({ requestId: "other-call", digest: digestOf({}), outcome: "allowed-once" }),
    );

    await expect(gated.execute({}, context)).rejects.toThrow(/another call|those arguments|names call/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("refuses a verdict written for other arguments", async () => {
    const execute = vi.fn(() => "ran");
    const gated = withApproval(
      tool({ name: "danger", description: "d", inputSchema: z.object({ a: z.number() }), execute }),
      (request) => ({ requestId: request.requestId, digest: digestOf({ a: 999 }), outcome: "allowed-once" }),
    );

    await expect(gated.execute({ a: 1 }, context)).rejects.toThrow(/digest/);
    expect(execute).not.toHaveBeenCalled();
  });

  it("fails closed when the handler throws, returns nothing or names an unknown outcome", async () => {
    const execute = vi.fn(() => "ran");
    const danger = tool({ name: "danger", description: "d", inputSchema: z.object({}), execute });

    await expect(
      withApproval(danger, () => {
        throw new Error("boom");
      }).execute({}, context),
    ).rejects.toThrow(/unavailable: boom/);

    await expect(
      withApproval(danger, (() => null) as never).execute({}, context),
    ).rejects.toThrow(/unavailable/);

    await expect(
      withApproval(
        danger,
        (request) =>
          ({ requestId: request.requestId, digest: request.digest, outcome: "always" }) as never,
      ).execute({}, context),
    ).rejects.toThrow(/unavailable: unknown approval outcome/);

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
    expect(denied?.kind === "action" ? denied.observations : "").toContain("rejected");
  });

  it("runs the tool when the handler approves and records one decision per ask", async () => {
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

    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await agent.run("use the danger tool");

    expect(execute).toHaveBeenCalledTimes(1);
    const decided = events.filter((event) => event.type === "approval.decided");
    expect(decided).toHaveLength(1);
    const decision = decided[0];
    expect(decision?.type === "approval.decided" ? decision.outcome : null).toBe("allowed-once");
    expect(decision?.type === "approval.decided" ? decision.requestId : null).toBe("c1");
    expect(decision?.type === "approval.decided" ? decision.digest : null).toBe(digestOf({}));
  });

  it("refuses without asking under the never policy", async () => {
    const handler = vi.fn(() => true);
    const execute = vi.fn(() => "ran");
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("danger", {})] },
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "ok" }, "c2")],
        },
      ]),
      tools: [tool({ name: "danger", description: "d", inputSchema: z.object({}), execute })],
      approvalPolicy: "never",
      approve: handler,
    });

    const events: AgentEvent[] = [];
    agent.on((event) => events.push(event));
    await agent.run("use the danger tool");

    expect(handler).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
    const decided = events.filter((event) => event.type === "approval.decided");
    expect(decided).toHaveLength(1);
    expect(decided[0]?.type === "approval.decided" ? decided[0].outcome : null).toBe("rejected");
    expect(decided[0]?.type === "approval.decided" ? decided[0].reason : "").toContain("never");
  });
});
