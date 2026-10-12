import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/model.js";

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: ({ city }) => "sunny in " + city,
});

const failingTool = tool({
  name: "explode",
  description: "Always throws.",
  inputSchema: z.object({}),
  execute: () => {
    throw new Error("tool exploded");
  },
});

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

async function drain(agent: ToolCallingAgent, task: string) {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return { events, types: events.map((event) => event.type) };
}

describe("ToolCallingAgent", () => {
  it("exposes the final_answer name as a constant", () => {
    expect(FINAL_ANSWER_TOOL_NAME).toBe("final_answer");
  });

  it("builds its system prompt from the tool registry", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [weatherTool] });
    expect(agent.systemPrompt).toContain("get_weather");
    expect(agent.systemPrompt).toContain("Get the current weather for a city.");
  });

  it("never streams, because tool calls only come from generate()", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [weatherTool] });
    expect((agent as unknown as { prefersStreaming: boolean }).prefersStreaming).toBe(false);
  });

  it("executes a tool call and turns the result into an observation", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("get_weather", { city: "Paris" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "sunny" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const result = await agent.run("Q");
    expect(result.output).toBe("sunny");
    expect(result.steps.find((step) => step.kind === "action")).toMatchObject({
      toolCalls: [{ id: "c1", name: "get_weather", arguments: { city: "Paris" }, result: "sunny in Paris" }],
    });
  });

  it("emits toolcalls.requested, action.requested and action.result in order", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("get_weather", { city: "Paris" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "sunny" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { types } = await drain(agent, "Q");
    // No message.delta here: a tool-call reply has empty content, and the loop only emits
    // a delta when there is text. message.completed still arrives, as it always does.
    expect(types).toEqual([
      "run.started",
      "step.started",
      "usage.updated",
      "message.completed",
      "toolcalls.requested",
      "action.requested",
      "action.result",
      "observation.completed",
      "step.started",
      "usage.updated",
      "message.completed",
      "toolcalls.requested",
      "action.result",
      "observation.completed",
      "run.completed",
    ]);
  });

  it("records an unknown tool as a failed call and keeps the run alive", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("nope", {})], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect(failure).toMatchObject({ name: "nope" });
    expect((failure as { error: { message: string } }).error.message).toMatch(/Unknown tool/);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("reports arguments that are not valid JSON without throwing", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: "get_weather", arguments: "{not json" }], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect((failure as { error: { message: string } }).error.message).toMatch(/not valid JSON/);
  });

  it("reports a schema violation without calling the tool", async () => {
    let called = false;
    const strict = tool({
      name: "strict",
      description: "Needs a number.",
      inputSchema: z.object({ n: z.number() }),
      execute: () => {
        called = true;
        return "ok";
      },
    });
    const model = new MockModel([
      { content: "", toolCalls: [call("strict", { n: "not a number" })], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [strict] });
    const { events } = await drain(agent, "Q");
    expect(called).toBe(false);
    expect(events.some((event) => event.type === "action.failed")).toBe(true);
  });

  it("reports a tool that throws without failing the run", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [call("explode", {})], finishReason: "tool_calls" },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 1 }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [failingTool] });
    const { events } = await drain(agent, "Q");
    const failure = events.find((event) => event.type === "action.failed");
    expect((failure as { error: { message: string } }).error.message).toBe("tool exploded");
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("accepts a bare value as the final answer when there is no answer key", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: FINAL_ANSWER_TOOL_NAME, arguments: "42" }], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model });
    const result = await agent.run("Q");
    expect(result.output).toBe(42);
  });

  it("treats a reply with no tool calls as an empty action and keeps going", async () => {
    const model = new MockModel([
      "I am only chatting.",
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, "c2")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    const observation = events.find((event) => event.type === "observation.completed");
    expect((observation as { text: string }).text).toMatch(/no action found/i);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("executes several tool calls from one reply", async () => {
    const model = new MockModel([
      {
        content: "",
        toolCalls: [call("get_weather", { city: "Paris" }, "c1"), call("get_weather", { city: "Rome" }, "c2")],
        finishReason: "tool_calls",
      },
      { content: "", toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "both sunny" }, "c3")], finishReason: "tool_calls" },
    ]);
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });
    const { events } = await drain(agent, "Q");
    expect(events.filter((event) => event.type === "action.result")).toHaveLength(3);
  });
});
