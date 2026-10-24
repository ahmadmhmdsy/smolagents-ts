import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import { MockModel } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

function finalAnswer(answer: unknown, id = "c1"): ToolCallRequest {
  return { id, name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer }) };
}

describe("agent guardrails", () => {
  it("halts on an input tripwire before the model is asked, with the reason", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([]),
      tools: [],
      guardrails: { input: (task) => (task.includes("secret") ? "task rejected" : undefined) },
    });

    const events: string[] = [];
    for await (const event of agent.stream("read the secret file")) events.push(event.type);

    await expect(agent.run("read the secret file")).rejects.toMatchObject({
      name: "AgentGuardrailError",
      code: "AGENT_GUARDRAIL",
      message: "task rejected",
    });
    expect(events).toEqual(["run.started", "run.failed"]);
  });

  it("lets a task through when the input tripwire passes", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([{ content: "", finishReason: "tool_calls", toolCalls: [finalAnswer("ok")] }]),
      tools: [],
      guardrails: { input: () => undefined },
    });

    await expect(agent.run("a harmless task")).resolves.toMatchObject({ output: "ok" });
  });

  it("halts on an output tripwire with the reason", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([{ content: "", finishReason: "tool_calls", toolCalls: [finalAnswer("leak")] }]),
      tools: [],
      guardrails: { output: (value) => (value === "leak" ? "answer blocked" : undefined) },
    });

    await expect(agent.run("task")).rejects.toMatchObject({
      name: "AgentGuardrailError",
      code: "AGENT_GUARDRAIL",
      message: "answer blocked",
    });
  });

  it("returns a schema mismatch as an observation and accepts a corrected answer", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ town: "x" })] },
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ city: "Baghdad" }, "c2")] },
      ]),
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    const result = await agent.run("name the city");
    expect(result.output).toEqual({ city: "Baghdad" });
    const first = result.steps.find((step) => step.kind === "action");
    expect(first?.kind === "action" ? first.observations : "").toContain("city");
  });

  it("advertises the bound schema as the final_answer parameter schema", async () => {
    const model = new MockModel([
      { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ city: "Baghdad" })] },
    ]);
    const agent = new ToolCallingAgent({
      model,
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    await agent.run("name the city");

    const specs = model.requestOptions[0]?.tools ?? [];
    const answerSpec = specs.find((spec) => spec.name === FINAL_ANSWER_TOOL_NAME);
    expect(answerSpec?.inputSchema).toMatchObject({ type: "object", required: ["answer"] });
    expect(JSON.stringify(answerSpec?.inputSchema)).toContain("\"city\"");
  });

  it("reports the validated value when the final answer passes the output schema", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([{ content: "", finishReason: "tool_calls", toolCalls: [finalAnswer("42")] }]),
      tools: [],
      outputSchema: z.coerce.number(),
    });

    const result = await agent.run("task");
    expect(result.output).toBe(42);
  });
});
