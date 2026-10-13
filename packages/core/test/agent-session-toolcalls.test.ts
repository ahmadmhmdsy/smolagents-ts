import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { MockTurnInput } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: ({ city }) => "sunny in " + city,
});

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function sessionFor(turns: MockTurnInput[]): AgentSession {
  return new AgentSession(new ToolCallingAgent({ model: new MockModel(turns), tools: [weatherTool] }));
}

describe("AgentSession tool calls", () => {
  it("records a call whose failure is reported before the request", async () => {
    const session = sessionFor([
      { content: "", toolCalls: [call("nope", {}, "c1")], finishReason: "tool_calls" },
      {
        content: "",
        toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")],
        finishReason: "tool_calls",
      },
    ]);

    await session.send("Q");

    const calls = session.getSnapshot().steps[0]?.toolCalls ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ id: "c1", name: "nope", args: {}, status: "error" });
    expect(calls[0]?.error).toMatch(/Unknown tool/);
  });

  it("records a successful call once, with its arguments and output", async () => {
    const session = sessionFor([
      { content: "", toolCalls: [call("get_weather", { city: "Paris" }, "c1")], finishReason: "tool_calls" },
      {
        content: "",
        toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "sunny" }, "c2")],
        finishReason: "tool_calls",
      },
    ]);

    await session.send("Q");

    const calls = session.getSnapshot().steps[0]?.toolCalls ?? [];
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      id: "c1",
      name: "get_weather",
      args: { city: "Paris" },
      status: "ok",
      output: "sunny in Paris",
    });
  });

  it("records every call in a reply, mixing success and failure", async () => {
    const session = sessionFor([
      {
        content: "",
        toolCalls: [call("get_weather", { city: "Rome" }, "c1"), call("nope", {}, "c2")],
        finishReason: "tool_calls",
      },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c3")], finishReason: "tool_calls" },
    ]);

    await session.send("Q");

    const calls = session.getSnapshot().steps[0]?.toolCalls ?? [];
    expect(calls.map((entry) => entry.id + ":" + entry.status)).toEqual(["c1:ok", "c2:error"]);
  });
});
