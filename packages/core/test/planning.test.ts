import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { AgentBudgetExceededError } from "../src/errors.js";
import { templateVariables } from "../src/prompts/populate-template.js";
import {
  PLAN_END_TAG,
  PLANNING_INITIAL_TEMPLATE,
  PLANNING_TEMPLATE_VARIABLES,
  PLANNING_UPDATE_SYSTEM_TEMPLATE,
  PLANNING_UPDATE_USER_TEMPLATE,
} from "../src/prompts/templates.js";
import type { AgentEvent } from "../src/events.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import { FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import type { ToolCallRequest } from "../src/types.js";

const echo = tool({
  name: "echo",
  description: "Echo a value back.",
  inputSchema: z.object({ value: z.string() }),
  execute: async ({ value }) => value,
});

function finalAnswer(answer: unknown): ToolCallRequest {
  return { id: "c1", name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer }) };
}

const answerTurn = { content: "", finishReason: "tool_calls" as const, toolCalls: [finalAnswer("ok")] };

function callEcho(id: string, content = ""): { content: string; finishReason: "tool_calls"; toolCalls: ToolCallRequest[] } {
  return {
    content,
    finishReason: "tool_calls",
    toolCalls: [{ id, name: "echo", arguments: JSON.stringify({ value: "x" }) }],
  };
}

async function collect(agent: ToolCallingAgent, task: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return events;
}

describe("the planning lane (decision 0028)", () => {
  it("plans before the first action, from one user turn carrying the task and the tools", async () => {
    const model = new MockModel(["1. echo the value", answerTurn]);
    const agent = new ToolCallingAgent({ model, tools: [echo], planningInterval: 1, maxSteps: 1 });

    const events = await collect(agent, "Echo the value.");

    const types = events.map((event) => event.type);
    expect(types.indexOf("planning.completed")).toBeLessThan(types.indexOf("step.started"));
    const request = model.calls[0] ?? [];
    expect(request).toHaveLength(1);
    expect(request[0]?.role).toBe("user");
    expect(request[0]?.content).toContain("Echo the value.");
    expect(request[0]?.content).toContain("echo");
    expect(model.requestOptions[0]?.stopSequences).toEqual([PLAN_END_TAG]);
    expect(model.requestOptions[0]?.tools).toEqual([]);
  });

  it("stores the reply wrapped the way upstream wraps an initial plan", async () => {
    const model = new MockModel(["1. echo the value", answerTurn]);
    const agent = new ToolCallingAgent({ model, tools: [echo], planningInterval: 1, maxSteps: 1 });

    await agent.run("Echo the value.");

    const planning = agent.steps.find((step) => step.kind === "planning");
    expect(planning?.kind).toBe("planning");
    const plan = planning !== undefined && "plan" in planning ? planning.plan : "";
    expect(plan).toContain("Here are the facts I know and the plan of action I will follow to solve the task:");
    expect(plan).toContain("1. echo the value");
    expect(plan.startsWith("Here are the facts")).toBe(true);
  });

  it("feeds an update plan a system prelude, the summary-mode history and a user postlude", async () => {
    const model = new MockModel([
      "1. echo",                 // plan at step 0
      callEcho("a", "first thought"), // action step 0
      callEcho("b", "second thought"),// action step 1
      "2. echo again",           // plan at step 2
      answerTurn,                // action step 2, final
    ]);
    const agent = new ToolCallingAgent({ model, tools: [echo], planningInterval: 2, maxSteps: 4 });

    await agent.run("Echo the value.");
    expect(model.calls).toHaveLength(5);

    const update = model.calls[3] ?? [];
    expect(update[0]?.role).toBe("system");
    expect(update[0]?.content).toContain("Echo the value.");
    const postlude = update.at(-1);
    expect(postlude?.role).toBe("user");
    expect(postlude?.content).toContain("This step has 1 of the run's step ceiling left.");
    const history = update.slice(1, -1);
    expect(history.some((message) => message.content.includes("Calling tools:"))).toBe(true);
    expect(history.some((message) => message.content.includes("Observation:"))).toBe(true);
    // The summary drops the model's reasoning and the earlier plan.
    expect(history.some((message) => message.content.includes("first thought"))).toBe(false);
    expect(history.some((message) => message.content.includes("1. echo"))).toBe(false);
    expect(history.some((message) => message.role === "system")).toBe(false);
    // And the answer turn's request never sees the initial template again.
    expect(model.calls[4]?.some((message) => message.content.includes("facts survey"))).toBe(false);
  });

  it("spends a model turn on the initial plan before any action", async () => {
    const model = new MockModel(["1. echo"]);
    const agent = new ToolCallingAgent({
      model,
      tools: [echo],
      planningInterval: 1,
      limits: { maxTurns: 1 },
    });

    const events = await collect(agent, "Echo the value.");

    expect(events.map((event) => event.type)).not.toContain("step.started");
    expect(events.at(-1)).toMatchObject({ type: "run.limitReached", reason: "limitTurns" });

    const second = new ToolCallingAgent({
      model: new MockModel(["1. echo"]),
      tools: [echo],
      planningInterval: 1,
      limits: { maxTurns: 1 },
    });
    await expect(second.run("Echo the value.")).rejects.toBeInstanceOf(AgentBudgetExceededError);
  });

  it("keeps every placeholder declared and every declared placeholder used", () => {
    const templates = [PLANNING_INITIAL_TEMPLATE, PLANNING_UPDATE_SYSTEM_TEMPLATE, PLANNING_UPDATE_USER_TEMPLATE];
    const used = new Set(templates.flatMap((template) => templateVariables(template)));
    for (const name of used) expect(PLANNING_TEMPLATE_VARIABLES as readonly string[]).toContain(name);
    for (const name of PLANNING_TEMPLATE_VARIABLES) expect(used.has(name)).toBe(true);
    expect(used.has("planEndTag")).toBe(true);
  });
});
