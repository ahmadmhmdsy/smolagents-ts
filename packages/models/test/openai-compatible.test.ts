import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import { HttpError, type FetchLike } from "../src/transport.js";

/** The recorded response of a real tool-calling turn, kept as a fixture so the suite needs no key. */
const completion = readFileSync(
  new URL("./fixtures/openai-chat-completion.json", import.meta.url),
  "utf8",
);

interface Recorded {
  url: string;
  init: RequestInit;
}

interface SentBody {
  model: string;
  messages: Array<Record<string, unknown>>;
  stream: boolean;
  temperature?: number;
  max_tokens?: number;
  stop?: string[];
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: unknown } }>;
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

function sent(calls: Recorded[]): SentBody {
  return JSON.parse(String(calls[0]?.init.body)) as SentBody;
}

function sentHeaders(calls: Recorded[]): Record<string, string> {
  return calls[0]?.init.headers as Record<string, string>;
}

const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: { type: "object", properties: { city: { type: "string" } } },
};

describe("OpenAICompatibleModel", () => {
  it("sends the transcript and parses the recorded completion", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new OpenAICompatibleModel({
      model: "gpt-4o-mini",
      apiKey: "sk-test",
      baseUrl: "https://example.test/v1",
      fetch,
    });

    const result = await model.generate(
      [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Weather in Paris?" },
      ],
      { tools: [weatherTool], temperature: 0 },
    );

    expect(calls[0]?.url).toBe("https://example.test/v1/chat/completions");
    expect(sentHeaders(calls)["authorization"]).toBe("Bearer sk-test");
    const body = sent(calls);
    expect(body.model).toBe("gpt-4o-mini");
    expect(body.stream).toBe(false);
    expect(body.temperature).toBe(0);
    expect(body.messages).toEqual([
      { role: "system", content: "You are terse." },
      { role: "user", content: "Weather in Paris?" },
    ]);
    expect(body.tools?.[0]?.type).toBe("function");
    expect(body.tools?.[0]?.function.name).toBe("get_weather");
    expect(body.tools?.[0]?.function.parameters).toEqual(weatherTool.inputSchema);

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(result.finishReason).toBe("tool_calls");
  });

  it("renders an assistant tool call and its result on the wire", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new OpenAICompatibleModel({ model: "m", fetch });

    await model.generate([
      { role: "user", content: "Weather?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' }],
      },
      { role: "tool", content: "sunny", toolCallId: "call_1", name: "get_weather" },
    ]);

    expect(sent(calls).messages[1]).toEqual({
      role: "assistant",
      content: null,
      tool_calls: [
        {
          id: "call_1",
          type: "function",
          function: { name: "get_weather", arguments: '{"city":"Paris"}' },
        },
      ],
    });
    expect(sent(calls).messages[2]).toEqual({
      role: "tool",
      content: "sunny",
      tool_call_id: "call_1",
      name: "get_weather",
    });
  });

  it("defaults to the OpenAI endpoint and sends no key when there is none", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new OpenAICompatibleModel({ model: "m", fetch });

    await model.generate([{ role: "user", content: "hi" }]);

    expect(calls[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    expect(sentHeaders(calls)["authorization"]).toBeUndefined();
  });

  it("prepends the configured system prompt exactly once", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new OpenAICompatibleModel({ model: "m", fetch, systemPrompt: "Be terse." });

    await model.generate([{ role: "user", content: "hi" }]);
    expect(sent(calls).messages[0]).toEqual({ role: "system", content: "Be terse." });

    await model.generate([
      { role: "system", content: "Already here." },
      { role: "user", content: "hi" },
    ]);
    const second = sent([{ url: calls[1]?.url ?? "", init: calls[1]?.init ?? {} }]);
    expect(second.messages[0]).toEqual({ role: "system", content: "Already here." });
    expect(second.messages).toHaveLength(2);
  });

  it("lets a per-request option override the constructor default", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new OpenAICompatibleModel({ model: "m", fetch, temperature: 0.7, maxTokens: 10 });

    await model.generate([{ role: "user", content: "hi" }], { temperature: 0, maxTokens: 99 });

    expect(sent(calls).temperature).toBe(0);
    expect(sent(calls).max_tokens).toBe(99);
  });

  it("raises an HttpError carrying the provider's status and body", async () => {
    const { fetch } = recorder("model not found", 404);
    const model = new OpenAICompatibleModel({ model: "m", fetch });

    const error = await model.generate([{ role: "user", content: "hi" }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as HttpError).body).toBe("model not found");
    expect((error as HttpError).url).toBe("https://api.openai.com/v1/chat/completions");
  });

  it("reports its identity and refuses a blank model id", () => {
    const model = new OpenAICompatibleModel({ model: "gpt-4o-mini" });
    expect(model.id).toBe("gpt-4o-mini");
    expect(model.provider).toBe("openai-compatible");
    expect(model.capabilities).toEqual({
      streaming: true,
      toolCalls: true,
      images: false,
      structuredOutput: false,
    });
    expect(new OpenAICompatibleModel({ model: "m", provider: "ollama" }).provider).toBe("ollama");
    expect(() => new OpenAICompatibleModel({ model: "  " })).toThrow(/model id/);
  });
});
