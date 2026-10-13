import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GeminiModel } from "../src/gemini.js";
import { HttpError, type FetchLike } from "../src/transport.js";

/** The reply Google documents for a function-calling turn, kept as a fixture so the suite needs no key. */
const completion = readFileSync(
  new URL("./fixtures/gemini-generate-content.json", import.meta.url),
  "utf8",
);

interface Recorded {
  url: string;
  init: RequestInit;
}

interface SentContent {
  role?: string;
  parts: Array<Record<string, unknown>>;
}

interface SentBody {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: SentContent[];
  tools?: Array<{
    functionDeclarations: Array<{ name: string; description: string; parameters: unknown }>;
  }>;
  generationConfig?: { temperature?: number; maxOutputTokens?: number; stopSequences?: string[] };
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

function textReply(finishReason: string): string {
  return JSON.stringify({
    candidates: [{ content: { role: "model", parts: [{ text: "hi" }] }, finishReason }],
  });
}

describe("GeminiModel", () => {
  it("sends the transcript and parses the documented reply", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new GeminiModel({
      model: "gemini-2.5-flash",
      apiKey: "goog-test",
      baseUrl: "https://example.test/v1beta",
      fetch,
    });

    const result = await model.generate(
      [
        { role: "system", content: "You are terse." },
        { role: "user", content: "Weather in Paris?" },
      ],
      { tools: [weatherTool] },
    );

    expect(calls[0]?.url).toBe(
      "https://example.test/v1beta/models/gemini-2.5-flash:generateContent",
    );
    expect(sentHeaders(calls)["x-goog-api-key"]).toBe("goog-test");

    const body = bodyOf(calls);
    // The system turn is an instruction, not a content.
    expect(body.systemInstruction?.parts[0]?.text).toBe("You are terse.");
    expect(body.contents).toEqual([
      { role: "user", parts: [{ text: "Weather in Paris?" }] },
    ]);
    expect(body.tools?.[0]?.functionDeclarations[0]).toEqual({
      name: "get_weather",
      description: "Get the current weather for a city.",
      parameters: weatherTool.inputSchema,
    });

    expect(result.content).toBe("");
    expect(result.toolCalls).toEqual([
      { id: "call-0", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(result.finishReason).toBe("tool_calls");
  });

  it("renders an assistant function call and its result as parts", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new GeminiModel({ model: "m", fetch });

    await model.generate([
      { role: "user", content: "Weather?" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' }],
      },
      { role: "tool", content: "sunny", toolCallId: "call_1", name: "get_weather" },
    ]);

    expect(bodyOf(calls).contents[1]).toEqual({
      role: "model",
      parts: [{ functionCall: { name: "get_weather", args: { city: "Paris" }, id: "call_1" } }],
    });
    expect(bodyOf(calls).contents[2]).toEqual({
      role: "user",
      parts: [
        {
          functionResponse: { name: "get_weather", response: { result: "sunny" }, id: "call_1" },
        },
      ],
    });
  });

  it("merges consecutive tool results into one user content", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new GeminiModel({ model: "m", fetch });

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

    const contents = bodyOf(calls).contents;
    expect(contents).toHaveLength(3);
    expect(contents[2]?.parts).toHaveLength(2);
  });

  it("maps the finish reasons it knows", async () => {
    const stop = new GeminiModel({ model: "m", fetch: recorder(textReply("STOP")).fetch });
    const length = new GeminiModel({ model: "m", fetch: recorder(textReply("MAX_TOKENS")).fetch });
    const other = new GeminiModel({ model: "m", fetch: recorder(textReply("SAFETY")).fetch });

    expect((await stop.generate([{ role: "user", content: "hi" }])).finishReason).toBe("stop");
    expect((await length.generate([{ role: "user", content: "hi" }])).finishReason).toBe("length");
    expect((await other.generate([{ role: "user", content: "hi" }])).finishReason).toBe("other");
  });

  it("sends generationConfig only when it has something to say", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new GeminiModel({ model: "m", fetch });

    await model.generate([{ role: "user", content: "hi" }]);
    expect(bodyOf(calls).generationConfig).toBeUndefined();

    await model.generate([{ role: "user", content: "hi" }], {
      temperature: 0,
      maxTokens: 99,
      stopSequences: ["END"],
    });
    expect(bodyOf(calls, 1).generationConfig).toEqual({
      temperature: 0,
      maxOutputTokens: 99,
      stopSequences: ["END"],
    });
  });

  it("raises an HttpError carrying the provider's status and body", async () => {
    const { fetch } = recorder("API key not valid", 400);
    const model = new GeminiModel({ model: "m", fetch });

    const error = await model.generate([{ role: "user", content: "hi" }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(400);
    expect((error as HttpError).body).toBe("API key not valid");
    expect((error as HttpError).url).toBe(
      "https://generativelanguage.googleapis.com/v1beta/models/m:generateContent",
    );
  });

  it("reports its identity and refuses a blank model id", () => {
    const model = new GeminiModel({ model: "gemini-2.5-flash" });
    expect(model.id).toBe("gemini-2.5-flash");
    expect(model.provider).toBe("gemini");
    expect(model.capabilities).toEqual({
      streaming: true,
      toolCalls: true,
      images: false,
      structuredOutput: false,
    });
    expect(() => new GeminiModel({ model: "  " })).toThrow(/model id/);
  });
});
