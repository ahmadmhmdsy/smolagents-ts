import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import { buildTrace } from "../src/monitoring/trace.js";
import { MemoryRunStore } from "../src/session/run-store.js";
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

  it("binds the schema to a model that cannot call tools and repairs a text answer", async () => {
    const model = new MockModel({
      responses: [{ content: "The answer is 41." }, { content: '{"city": "Baghdad"}' }],
      capabilities: { toolCalls: false },
    });
    const agent = new ToolCallingAgent({
      model,
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    const result = await agent.run("name the city");

    expect(result.output).toEqual({ city: "Baghdad" });
    expect(model.callCount).toBe(2);
    // No forced tool: a model that cannot call one is not sent a tool schema.
    expect(model.requestOptions[0]?.tools).toBeUndefined();
    // The bound schema travels in the prompt instead.
    expect(agent.systemPrompt).toContain("FINAL ANSWER SCHEMA");
    expect(JSON.stringify(model.calls[0])).toContain("FINAL ANSWER SCHEMA");
    const refused = result.steps.find((step) => step.kind === "action");
    expect(refused?.kind === "action" ? refused.observations : "").toContain("failed the output schema");
  });

  it("ends a tool-less model's run at the repair bound", async () => {
    const model = new MockModel({
      responses: [{ content: "one" }, { content: "two" }, { content: "three" }],
      capabilities: { toolCalls: false },
    });
    const agent = new ToolCallingAgent({
      model,
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    await expect(agent.run("name the city")).rejects.toMatchObject({
      name: "AgentGuardrailError",
      message: expect.stringContaining("after 2 repair attempts"),
    });
    expect(model.callCount).toBe(3);
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

  it("spends two repair attempts, then accepts a valid answer", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ town: "x" }, "c1")] },
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ town: "y" }, "c2")] },
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer({ city: "Baghdad" }, "c3")] },
      ]),
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    const result = await agent.run("name the city");

    expect(result.output).toEqual({ city: "Baghdad" });
    const refused = result.steps.filter(
      (step) =>
        step.kind === "action" &&
        (step.toolCalls ?? []).some((call) => call.name === FINAL_ANSWER_TOOL_NAME && call.error !== undefined),
    );
    expect(refused).toHaveLength(2);
  });

  it("fails the run once the repair budget is spent", async () => {
    const answers = ["x", "y", "z"].map((town, index) => ({
      content: "",
      finishReason: "tool_calls" as const,
      toolCalls: [finalAnswer({ town }, "c" + String(index))],
    }));
    const agent = new ToolCallingAgent({
      model: new MockModel(answers),
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    await expect(agent.run("name the city")).rejects.toMatchObject({
      code: "AGENT_GUARDRAIL",
      message: expect.stringContaining("repair attempts"),
    });
  });

  it("does not repair an answer truncated by the length limit", async () => {
    const model = new MockModel([
      { content: "", finishReason: "length", toolCalls: [finalAnswer({ town: "x" })] },
    ]);
    const agent = new ToolCallingAgent({
      model,
      tools: [],
      outputSchema: z.object({ city: z.string() }),
    });

    await expect(agent.run("name the city")).rejects.toMatchObject({
      code: "AGENT_GUARDRAIL",
      message: expect.stringMatching(/truncated/),
    });
    expect(model.callCount).toBe(1);
  });

  it("keeps a blocked answer out of the record and says redacted in the trace", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [finalAnswer("top-secret")] },
      ]),
      tools: [],
      store,
      guardrails: { output: () => "blocked by policy" },
    });

    const events: AgentEvent[] = [];
    for await (const event of agent.stream("tell the secret", { runId: "blocked-run" })) {
      events.push(event);
    }

    expect(events.at(-1)?.type).toBe("run.failed");
    const saved = JSON.stringify(store.load("blocked-run"));
    expect(saved).not.toContain("top-secret");
    expect(saved).toContain("redacted");
    const trace = buildTrace(events);
    expect(JSON.stringify(trace)).not.toContain("top-secret");
    expect(trace.attributes.redacted).toBe(true);
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
