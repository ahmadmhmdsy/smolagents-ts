import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import type { AgentEvent } from "../src/events.js";
import type { CodeResult } from "../src/executor.js";
import type { RunResult } from "../src/agent/run-result.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import { z } from "zod";

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

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: () => "sunny",
});

describe("CodeAgent", () => {
  it("builds its system prompt from the tool registry", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor(),
      tools: [weatherTool],
    });
    expect(agent.systemPrompt).toContain("get_weather");
    expect(agent.systemPrompt).toContain("Get the current weather for a city.");
  });

  it("says (no tools) when the registry is empty", () => {
    const agent = new CodeAgent({ model: new MockModel(["x"]), executor: new ScriptedExecutor() });
    expect(agent.systemPrompt).toContain("no tools are available");
  });

  it("uses the executor's language in the prompt", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor({ language: "python" }),
    });
    expect(agent.systemPrompt).toContain("Python");
  });

  it("appends custom instructions to the prompt", () => {
    const agent = new CodeAgent({
      model: new MockModel(["x"]),
      executor: new ScriptedExecutor(),
      customInstructions: "Always answer in French.",
    });
    expect(agent.systemPrompt).toContain("Always answer in French.");
  });

  it("passes the extracted code to the executor with the right step index", async () => {
    const seen: { code: string; stepIndex: number }[] = [];
    const executor = new ScriptedExecutor({
      handler: (code, options) => {
        seen.push({ code, stepIndex: options.stepIndex });
        return code === "final_answer(5)" ? finalAnswerResult(5) : { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "compute()"), fenced("done", "final_answer(5)")]), executor });
    await agent.run("Q");
    expect(seen).toEqual([
      { code: "compute()", stepIndex: 0 },
      { code: "final_answer(5)", stepIndex: 1 },
    ]);
  });

  it("emits logs.appended before the observation", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options) => {
        options.onLog?.("first line");
        options.onLog?.("second line");
        return { logs: "first line\nsecond line", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "a()"), fenced("done", "final_answer(1)")]), executor });
    const { types } = await drain(agent, "Q");
    expect(types.indexOf("logs.appended")).toBeGreaterThan(types.indexOf("code.completed"));
    expect(types.filter((type) => type === "logs.appended")).toHaveLength(4);
  });

  it("turns executor tool-call callbacks into action events and ActionStep records", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options) => {
        options.onToolCall?.({ type: "requested", callId: "c1", name: "get_weather", args: { city: "Paris" } });
        options.onToolCall?.({ type: "result", callId: "c1", name: "get_weather", output: "sunny", durationMs: 3 });
        if (_code.startsWith("final_answer(")) options.finalAnswer.submit(1);
        return { logs: "sunny", isFinalAnswer: false, durationMs: 3, toolCallCount: 1 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("go", "get_weather()"), fenced("done", "final_answer(1)")]), executor, tools: [weatherTool] });
    const { events, result } = await drain(agent, "Q");
    expect(events.filter((event) => event.type === "action.requested")).toHaveLength(2);
    expect(events.filter((event) => event.type === "action.result")).toHaveLength(2);
    const firstAction = result?.steps.find((step) => step.kind === "action");
    expect(firstAction).toMatchObject({
      kind: "action",
      toolCalls: [{ id: "c1", name: "get_weather", arguments: { city: "Paris" }, result: "sunny", durationMs: 3 }],
    });
  });

  it("finishes when the guest calls final_answer even if the executor does not flag it", async () => {
    const executor = new ScriptedExecutor({
      handler: (_code, options): CodeResult => {
        options.finalAnswer.submit(41);
        return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([fenced("done", "final_answer(41)")]), executor });
    const result = await agent.run("Q");
    expect(result.output).toBe(41);
  });

  it("prefers the executor's value when it does flag a final answer", async () => {
    const executor = new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult("from executor") } });
    const agent = new CodeAgent({ model: new MockModel([fenced("done", "final_answer(1)")]), executor });
    const result = await agent.run("Q");
    expect(result.output).toBe("from executor");
  });

  it("puts a failed code step's error into the observation", async () => {
    const executor = new ScriptedExecutor({
      handler: (code, options): CodeResult => {
        if (code === "broken()") {
          return {
            logs: "half a line",
            isFinalAnswer: false,
            durationMs: 1,
            toolCallCount: 0,
            error: { name: "TypeError", message: "not a function", code: "AGENT_EXECUTION", stepIndex: 0 },
          };
        }
        options.finalAnswer.submit("recovered");
        return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });
    const agent = new CodeAgent({
      model: new MockModel([fenced("go", "broken()"), fenced("recover", "final_answer('recovered')")]),
      executor,
    });
    const { result } = await drain(agent, "Q");
    const firstAction = result?.steps.find((step) => step.kind === "action");
    expect(firstAction).toMatchObject({ observations: "half a line\nError: not a function" });
    expect(result?.output).toBe("recovered");
  });

  it("replays the golden fibonacci transcript event for event", async () => {
    const transcript = JSON.parse(
      readFileSync(new URL("./golden/fibonacci.transcript.json", import.meta.url), "utf8"),
    ) as {
      task: string;
      turns: { thought: string; code: string }[];
      logs: Record<string, string>;
      finalAnswer: number;
      expected: { output: number; state: string; actionSteps: number; eventTypes: string[] };
    };

    const model = new MockModel(transcript.turns.map((turn) => fenced(turn.thought, turn.code)));
    const executor = new ScriptedExecutor({
      handler: (code, options): CodeResult => {
        const index = transcript.turns.findIndex((turn) => turn.code === code);
        const logs = transcript.logs[String(index)] ?? "";
        if (logs !== "") options.onLog?.(logs);
        if (code.startsWith("final_answer(")) options.finalAnswer.submit(transcript.finalAnswer);
        return { logs, isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
      },
    });

    const agent = new CodeAgent<number>({ model, executor });
    const { types, result } = await drain(agent, transcript.task);

    expect(types).toEqual(transcript.expected.eventTypes);
    expect(result?.output).toBe(transcript.expected.output);
    expect(result?.state).toBe(transcript.expected.state);
    expect(result?.steps.filter((step) => step.kind === "action")).toHaveLength(transcript.expected.actionSteps);
  });
});
