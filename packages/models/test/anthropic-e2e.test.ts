import { readFileSync } from "node:fs";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent, tool } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AnthropicModel } from "../src/anthropic.js";
import type { FetchLike } from "../src/transport.js";

/** The tool-calling reply Anthropic documents, kept as a fixture so the suite needs no key. */
const weatherTurn = readFileSync(
  new URL("./fixtures/anthropic-messages.json", import.meta.url),
  "utf8",
);

/** A reply that ends the run: this loop answers a final_answer call, never a bare text. */
function finalAnswerTurn(answer: string): string {
  return JSON.stringify({
    id: "msg_2",
    type: "message",
    role: "assistant",
    content: [
      {
        type: "tool_use",
        id: "toolu_final",
        name: FINAL_ANSWER_TOOL_NAME,
        input: { answer },
      },
    ],
    stop_reason: "tool_use",
    usage: { input_tokens: 30, output_tokens: 9 },
  });
}

interface SentBody {
  system?: string;
  messages: Array<{ role: string; content: string | Array<Record<string, unknown>> }>;
  tools?: Array<{ name: string }>;
}

/** A provider that answers each request with the next scripted turn. */
function scripted(turns: string[]): { fetch: FetchLike; bodies: SentBody[] } {
  const bodies: SentBody[] = [];
  let index = 0;
  const fetchImpl: FetchLike = (_url, init) => {
    bodies.push(JSON.parse(String(init.body)) as SentBody);
    const turn = turns[Math.min(index, turns.length - 1)] ?? "{}";
    index += 1;
    return Promise.resolve(
      new Response(turn, { status: 200, headers: { "content-type": "application/json" } }),
    );
  };
  return { fetch: fetchImpl, bodies };
}

describe("an agent driving the Anthropic adapter", () => {
  it("runs a tool call and answers from its result", async () => {
    let runs = 0;
    const weatherTool = tool({
      name: "get_weather",
      description: "Get the current weather for a city.",
      inputSchema: z.object({ city: z.string() }),
      execute: ({ city }) => {
        runs += 1;
        return "sunny in " + city;
      },
    });
    const { fetch, bodies } = scripted([weatherTurn, finalAnswerTurn("sunny in Paris")]);
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", apiKey: "sk-ant-test", fetch });
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });

    const result = await agent.run("What is the weather in Paris?");

    expect(result.output).toBe("sunny in Paris");
    expect(runs).toBe(1);
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.tools?.map((entry) => entry.name)).toContain("get_weather");
    expect(bodies[0]?.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "What is the weather in Paris?" }] },
    ]);
  });

  it("carries the tool result back as a user turn", async () => {
    const weatherTool = tool({
      name: "get_weather",
      description: "Get the current weather for a city.",
      inputSchema: z.object({ city: z.string() }),
      execute: ({ city }) => "sunny in " + city,
    });
    const { fetch, bodies } = scripted([weatherTurn, finalAnswerTurn("sunny in Paris")]);
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", fetch });
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });

    await agent.run("Weather in Paris?");

    const second = bodies[1]?.messages ?? [];
    const result_ = second.at(-1);
    expect(result_?.role).toBe("user");
    const blocks = Array.isArray(result_?.content) ? result_.content : [];
    const resultBlock = blocks.find((block) => block.type === "tool_result");
    expect(resultBlock).toMatchObject({
      type: "tool_result",
      tool_use_id: "toolu_01A09q90qw90lq917835lq9",
    });
    expect(String(resultBlock?.content)).toContain("sunny in Paris");

    // The block it answers is the assistant's own tool_use, so the transcript replays.
    const announced = second.at(-2);
    expect(announced?.role).toBe("assistant");
    const useBlocks = Array.isArray(announced?.content) ? announced.content : [];
    expect(useBlocks.find((block) => block.type === "tool_use")).toMatchObject({
      type: "tool_use",
      id: "toolu_01A09q90qw90lq917835lq9",
      name: "get_weather",
      input: { city: "Paris" },
    });
  });
});
