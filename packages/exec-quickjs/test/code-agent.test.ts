import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CODE_FENCE,
  CodeAgent,
  MockModel,
  tool,
  type AgentEvent,
  type RunResult,
  type Tool,
} from "@smolagents-ts/core";
import { QuickJSExecutor } from "../src/executor.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

async function drain(agent: CodeAgent, task: string) {
  const events: AgentEvent[] = [];
  let result: RunResult | undefined;
  for await (const event of agent.stream(task)) {
    events.push(event);
    if (event.type === "run.completed") result = event.result;
  }
  return { events, result, types: events.map((event) => event.type) };
}

const weather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: (input) => "sunny in " + input.city,
});

/** The run the plan describes: a tool, a log line and a final answer in one step. */
const weatherCode =
  'const report = await get_weather({ city: "Paris" });\n' +
  'console.log("weather", report);\n' +
  "final_answer(report);";

function agentFor(executor: QuickJSExecutor, model: MockModel, tools: readonly Tool[] = [weather]) {
  return new CodeAgent({ model, executor, tools });
}

describe("QuickJSExecutor under a CodeAgent", () => {
  it("runs a code action from the model through to its final answer", async () => {
    const executor = new QuickJSExecutor();
    try {
      const agent = agentFor(executor, new MockModel([fenced("look it up", weatherCode)]));
      const { types, result } = await drain(agent, "What is the weather in Paris?");
      expect(result?.output).toBe("sunny in Paris");
      expect(types).toContain("code.completed");
      expect(types).toContain("logs.appended");
      expect(types).toContain("action.requested");
      expect(types).toContain("action.result");
      expect(types).toContain("observation.completed");
      expect(types.indexOf("code.completed")).toBeLessThan(types.indexOf("logs.appended"));
      expect(types.indexOf("action.result")).toBeLessThan(types.indexOf("observation.completed"));
    } finally {
      await executor.dispose();
    }
  });

  it("records the tool call on the action step", async () => {
    const executor = new QuickJSExecutor();
    try {
      const agent = agentFor(executor, new MockModel([fenced("look it up", weatherCode)]));
      const { result } = await drain(agent, "What is the weather in Paris?");
      const firstAction = result?.steps.find((step) => step.kind === "action");
      expect(firstAction).toMatchObject({
        kind: "action",
        toolCalls: [{ name: "get_weather", arguments: { city: "Paris" }, result: "sunny in Paris" }],
      });
      expect(firstAction?.observations).toBe('weather sunny in Paris');
    } finally {
      await executor.dispose();
    }
  });

  it("survives a broken guest step and lets the model recover", async () => {
    const executor = new QuickJSExecutor();
    try {
      const agent = agentFor(
        executor,
        new MockModel([
          fenced("compute", "const value = null;\nvalue.missing();"),
          fenced("recover", 'final_answer("recovered");'),
        ]),
      );
      const { result } = await drain(agent, "Q");
      const firstAction = result?.steps.find((step) => step.kind === "action");
      expect(firstAction?.error?.code).toBe("AGENT_EXECUTION");
      expect(firstAction?.observations).toContain("Error:");
      expect(firstAction?.observations).toContain("null");
      expect(result?.output).toBe("recovered");
    } finally {
      await executor.dispose();
    }
  });

  it("keeps a step's variables for the next step", async () => {
    const executor = new QuickJSExecutor();
    try {
      const agent = agentFor(
        executor,
        new MockModel([
          fenced("define", "const doubled = 21 * 2;\nconsole.log(doubled);"),
          fenced("use it", "final_answer(doubled);"),
        ]),
      );
      const { result } = await drain(agent, "Q");
      expect(result?.output).toBe(42);
      expect(result?.steps.filter((step) => step.kind === "action")).toHaveLength(2);
    } finally {
      await executor.dispose();
    }
  });
});
