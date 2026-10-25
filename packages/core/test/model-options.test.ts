import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import type { ToolSpec } from "../src/model.js";
import { z } from "zod";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: () => "sunny",
});

async function run(agent: { stream(input: string): AsyncIterable<{ type: string }> }): Promise<void> {
  for await (const event of agent.stream("answer")) {
    if (event.type === "run.completed" || event.type === "run.failed") return;
  }
}

describe("the model options a caller pins", () => {
  it("reach every turn", async () => {
    const model = new MockModel([
      fenced("think", "x = 1"),
      fenced("done", "final_answer(7)"),
    ]);
    const agent = new CodeAgent({
      model,
      executor: new ScriptedExecutor({
        handler: (code) =>
          code.includes("final_answer")
            ? finalAnswerResult(7)
            : { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
      }),
      modelOptions: { temperature: 0.2, providerOptions: { cache: { system: true } } },
    });

    await run(agent);

    expect(model.requestOptions).toHaveLength(2);
    for (const options of model.requestOptions) {
      expect(options.temperature).toBe(0.2);
      expect(options.providerOptions).toEqual({ cache: { system: true } });
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
  });

  it("cannot replace the loop's own tools or signal", async () => {
    const model = new MockModel([
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [
          {
            id: "answer",
            name: FINAL_ANSWER_TOOL_NAME,
            arguments: JSON.stringify({ answer: 7 }),
          },
        ],
      },
    ]);
    const callerSignal = new AbortController().signal;
    const callerTools: ToolSpec[] = [
      { name: "bogus", description: "not registered", inputSchema: { type: "object" } },
    ];
    const agent = new ToolCallingAgent({
      model,
      tools: [weatherTool],
      modelOptions: { tools: callerTools, signal: callerSignal },
    });

    await run(agent);

    const options = model.requestOptions[0];
    const names = options?.tools?.map((spec) => spec.name) ?? [];
    expect(names).toContain("get_weather");
    expect(names).not.toContain("bogus");
    expect(options?.signal).not.toBe(callerSignal);
  });
});
