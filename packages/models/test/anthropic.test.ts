import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnthropicModel } from "../src/anthropic.js";
import { HttpError, type FetchLike } from "../src/transport.js";

/** The reply Anthropic documents for a tool-calling turn, kept as a fixture so the suite needs no key. */
const completion = readFileSync(
  new URL("./fixtures/anthropic-messages.json", import.meta.url),
  "utf8",
);

interface Recorded {
  url: string;
  init: RequestInit;
}

interface SentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: string;
}

interface SentBody {
  model: string;
  max_tokens: number;
  system?: string;
  messages: Array<{ role: string; content: SentBlock[] }>;
  stream: boolean;
  temperature?: number;
  stop_sequences?: string[];
  tools?: Array<{ name: string; description: string; input_schema: unknown }>;
}

function recorder(body: string, status = 200): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body, { status, headers: { "content-type": "application/json" } }),
    );
  };
  return { fetch: fetchImpl, calls };
}

function bodyOf(calls: Recorded[], index = 0): SentBody {
  return JSON.parse(String(calls[index]?.init.body)) as SentBody;
}

function sentHeaders(calls: Recorded[]): Record<string, string> {
  return calls[0]?.init.headers as Record<string, string>;
}

const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: { type: "object", properties: { city: { type: "string" } } },
};

describe("AnthropicModel", () => {
  it("sends the transcript and parses the documented completion", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new AnthropicModel({
      model: "claude-sonnet-4-5",
      apiKey: "sk-ant-test",
      baseUrl: "https://example.test",
      fetch,
    });

    const result = await model.generate(
      [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Weather in Paris?" },
      ],
      { tools: [weatherTool], temperature: 0 },
    );

    expect(calls[0]?.url).toBe("https://example.test/v1/messages");
    expect(sentHeaders(calls)["x-api-key"]).toBe("sk-ant-test");
    expect(sentHeaders(calls)["anthropic-version"]).toBe("2023-06-01");

    const body = bodyOf(calls);
    expect(body.model).toBe("claude-sonnet-4-5");
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0);
    // The system turn is not a message: the wire wants it at the top level.
    expect(body.system).toBe("You are terse.");
    expect(body.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "Weather in Paris?" }] },
    ]);
    expect(body.tools?.[0]).toEqual({
      name: "get_weather",
      description: "Get the current weather for a city.",
      input_schema: weatherTool.inputSchema,
    });

    expect(result.content).toBe("I'll check.");
    expect(result.toolCalls).toEqual([
      { id: "toolu_01A09q90qw90lq917835lq9", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(result.finishReason).toBe("tool_calls");
  });

  it("renders an assistant tool call and its result as blocks", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new AnthropicModel({ model: "m", fetch });

    await model.generate([
      { role: "user", content: "Weather?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' }],
      },
      { role: "tool", content: "sunny", toolCallId: "call_1", name: "get_weather" },
    ]);

    expect(bodyOf(calls).messages[1]).toEqual({
      role: "assistant",
      content: [
        { type: "tool_use", id: "call_1", name: "get_weather", input: { city: "Paris" } },
      ],
    });
    expect(bodyOf(calls).messages[2]).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "call_1", content: "sunny" }],
    });
  });

  it("merges consecutive tool results into one user turn", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new AnthropicModel({ model: "m", fetch });

    await model.generate([
      { role: "user", content: "Weather?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
          { id: "call_2", name: "get_weather", arguments: '{"city":"Rome"}' },
        ],
      },
      { role: "tool", content: "sunny", toolCallId: "call_1", name: "get_weather" },
      { role: "tool", content: "rainy", toolCallId: "call_2", name: "get_weather" },
    ]);

    const messages = bodyOf(calls).messages;
    expect(messages).toHaveLength(3);
    expect(messages[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "call_1", content: "sunny" },
        { type: "tool_result", tool_use_id: "call_2", content: "rainy" },
      ],
    });
  });

  it("defaults the limit, the host and the version, and omits the key when there is none", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new AnthropicModel({ model: "m", fetch, systemPrompt: "Be terse." });

    await model.generate([{ role: "user", content: "hi" }]);

    expect(calls[0]?.url).toBe("https://api.anthropic.com/v1/messages");
    expect(sentHeaders(calls)["x-api-key"]).toBeUndefined();
    expect(sentHeaders(calls)["anthropic-version"]).toBe("2023-06-01");
    expect(bodyOf(calls).max_tokens).toBe(4096);
    expect(bodyOf(calls).system).toBe("Be terse.");

    await model.generate([{ role: "user", content: "hi" }], { maxTokens: 99, systemPrompt: "Over." });
    expect(bodyOf(calls, 1).max_tokens).toBe(99);
    expect(bodyOf(calls, 1).system).toBe("Over.");
  });

  it("raises an HttpError carrying the provider's status and body", async () => {
    const { fetch } = recorder("invalid api key", 401);
    const model = new AnthropicModel({ model: "m", fetch });

    const error = await model.generate([{ role: "user", content: "hi" }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(401);
    expect((error as HttpError).body).toBe("invalid api key");
    expect((error as HttpError).url).toBe("https://api.anthropic.com/v1/messages");
  });

  it("reports its identity and refuses a blank model id", () => {
    const model = new AnthropicModel({ model: "claude-sonnet-4-5" });
    expect(model.id).toBe("claude-sonnet-4-5");
    expect(model.provider).toBe("anthropic");
    expect(model.capabilities).toEqual({
      streaming: true,
      toolCalls: true,
      images: false,
      structuredOutput: false,
    });
    expect(() => new AnthropicModel({ model: "  " })).toThrow(/model id/);
  });
});
