import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { MultiStepAgent } from "../src/agent/multi-step-agent.js";
import { managedAgent, type ManagedAgent } from "../src/agent/managed-agent.js";
import type { RunResult } from "../src/agent/run-result.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { noopLogger } from "../src/logger.js";
import type { ActionStep } from "../src/memory/steps.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool, ToolDefinitionError, type ToolContext } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const context: ToolContext = {
  signal: new AbortController().signal,
  fetch: globalThis.fetch,
  callId: "t1",
  stepIndex: 0,
  logger: noopLogger,
};

function fakeAgent(output: unknown): { agent: MultiStepAgent; run: ReturnType<typeof vi.fn> } {
  const run = vi.fn(async (_task: string) => ({ output }) as unknown as RunResult);
  return { agent: { run } as unknown as MultiStepAgent, run };
}

function entry(agent: MultiStepAgent, over: Partial<ManagedAgent> = {}): ManagedAgent {
  return { name: "junior", description: "A junior who does arithmetic.", agent, ...over };
}

describe("managedAgent", () => {
  it("exposes the child under its name and description with a single task argument", () => {
    const { agent } = fakeAgent("x");
    const wrapped = managedAgent(entry(agent));
    expect(wrapped.name).toBe("junior");
    const spec = wrapped.toSpec();
    expect(spec.description).toBe("A junior who does arithmetic.");
    expect(Object.keys(spec.inputSchema.properties ?? {})).toEqual(["task", "additional_args"]);
  });

  it("wraps the task, runs the child, and wraps the answer in the report", async () => {
    const { agent, run } = fakeAgent("42");
    const wrapped = managedAgent(entry(agent));
    const output = await wrapped.execute({ task: "compute 6*7" }, context);
    expect(run).toHaveBeenCalledTimes(1);
    const [task, options] = run.mock.calls[0] as [string, { signal: AbortSignal }];
    expect(task).toContain("You're a helpful agent named 'junior'");
    expect(task).toContain("compute 6*7");
    expect(options.signal).toBe(context.signal);
    expect(output).toBe("Here is the final answer from your managed agent 'junior':\n42");
  });

  it("json-encodes a child answer that is not a string", async () => {
    const { agent } = fakeAgent({ product: 42 });
    const output = await managedAgent(entry(agent)).execute({ task: "go" }, context);
    expect(output).toContain('{"product":42}');
  });

  it("refuses a managed agent with no description", () => {
    const { agent } = fakeAgent("x");
    expect(() => managedAgent(entry(agent, { description: "   " }))).toThrow(ToolDefinitionError);
  });

  it("refuses a name that is not a JavaScript identifier", () => {
    const { agent } = fakeAgent("x");
    expect(() => managedAgent(entry(agent, { name: "not a name" }))).toThrow(ToolDefinitionError);
  });
});

describe("delegation through an agent", () => {
  it("runs the child and folds its report back as the observation", async () => {
    const child = new ToolCallingAgent({
      model: new MockModel([
        {
          content: "",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 42 }, "k1")],
          finishReason: "tool_calls",
        },
      ]),
    });
    const parent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", toolCalls: [call("junior", { task: "compute 6*7" }, "p1")], finishReason: "tool_calls" },
        {
          content: "",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "42" }, "p2")],
          finishReason: "tool_calls",
        },
      ]),
      managedAgents: [{ name: "junior", description: "A junior who does arithmetic.", agent: child }],
    });

    const result = await parent.run("What is 6 times 7?");
    expect(result.output).toBe("42");

    const action = result.steps.find(
      (step) => step.kind === "action" && (step as ActionStep).toolCalls.length > 0,
    ) as ActionStep;
    expect(action.toolCalls[0]?.result).toContain(
      "Here is the final answer from your managed agent 'junior'",
    );
    expect((child.model as MockModel).callCount).toBe(1);
  });

  it("lists a managed agent as a team member, not as an ordinary tool", () => {
    const getWeather = tool({
      name: "get_weather",
      description: "Get the weather.",
      inputSchema: z.object({ city: z.string() }),
      execute: () => "sunny",
    });
    const child = new ToolCallingAgent({ model: new MockModel([]) });
    const parent = new ToolCallingAgent({
      model: new MockModel([]),
      tools: [getWeather],
      managedAgents: [{ name: "junior", description: "Does arithmetic.", agent: child }],
    });

    const prompt = parent.systemPrompt;
    expect(prompt).toContain("Here is a list of the team members that you can call:");
    expect(prompt).toContain("- junior: Does arithmetic.");
    expect(prompt).toContain("- get_weather: Get the weather.");
    // "junior" names the team member once, in its own section; it never reaches the tool list.
    expect(prompt.split("junior").length - 1).toBe(1);
  });

  it("omits the team-members section when there are no managed agents", () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]) });
    expect(agent.systemPrompt).not.toContain("team members");
  });
});
