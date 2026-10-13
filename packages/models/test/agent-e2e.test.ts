import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent, tool } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

const weatherTool = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({ city: z.string() }),
  execute: ({ city }) => "sunny in " + city,
});

interface SentBody {
  messages: Array<{
    role: string;
    content?: string | null;
    tool_call_id?: string;
    tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  }>;
  tools?: Array<{ function: { name: string } }>;
}

function toolCallTurn(id: string, name: string, args: unknown): string {
  return JSON.stringify({
    choices: [
      {
        message: {
          role: "assistant",
          content: null,
          tool_calls: [
            { id, type: "function", function: { name, arguments: JSON.stringify(args) } },
          ],
        },
        finish_reason: "tool_calls",
      },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });
}

/** A provider that answers each request with the next recorded turn. */
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

describe("an agent driving the OpenAI-compatible adapter", () => {
  it("runs a tool call and answers from its result", async () => {
    const { fetch, bodies } = scripted([
      toolCallTurn("call_1", "get_weather", { city: "Paris" }),
      toolCallTurn("call_2", FINAL_ANSWER_TOOL_NAME, { answer: "sunny in Paris" }),
    ]);
    const model = new OpenAICompatibleModel({
      model: "gpt-4o-mini",
      apiKey: "sk-test",
      fetch,
    });
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });

    const result = await agent.run("What is the weather in Paris?");

    expect(result.output).toBe("sunny in Paris");
    expect(bodies).toHaveLength(2);
    expect(bodies[0]?.tools?.map((entry) => entry.function.name)).toContain("get_weather");

    const second = bodies[1]?.messages ?? [];
    const assistant = second.find((message) => message.tool_calls !== undefined);
    expect(assistant?.tool_calls?.[0]?.function.name).toBe("get_weather");
    const toolResult = second.find((message) => message.role === "tool");
    expect(toolResult?.tool_call_id).toBe("call_1");
    expect(toolResult?.content).toContain("sunny in Paris");
  });

  it("keeps the transcript a provider can replay across three turns", async () => {
    const { fetch, bodies } = scripted([
      toolCallTurn("call_1", "get_weather", { city: "Rome" }),
      toolCallTurn("call_2", FINAL_ANSWER_TOOL_NAME, { answer: "sunny in Rome" }),
    ]);
    const model = new OpenAICompatibleModel({ model: "gpt-4o-mini", fetch });
    const agent = new ToolCallingAgent({ model, tools: [weatherTool] });

    await agent.run("Weather in Rome?");

    // Every tool message the adapter sent answers a call the assistant announced in the
    // same request, which is the invariant the wire format enforces.
    for (const body of bodies) {
      const announced = new Set(
        body.messages.flatMap((message) => message.tool_calls?.map((call) => call.id) ?? []),
      );
      for (const message of body.messages) {
        if (message.role === "tool") expect(announced.has(message.tool_call_id ?? "")).toBe(true);
      }
    }
  });
});
