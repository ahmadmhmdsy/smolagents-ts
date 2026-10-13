import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectCompletion, type ChatCompletionChunk } from "@smolagents-ts/core";
import { GeminiModel } from "../src/gemini.js";
import { type FetchLike } from "../src/transport.js";

/** The streamed form Google documents for a function-calling turn, kept as a fixture. */
const transcript = readFileSync(
  new URL("./fixtures/gemini-stream.sse.txt", import.meta.url),
  "utf8",
);

interface Recorded {
  url: string;
  init: RequestInit;
}

function recorder(body: string): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(
      new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } }),
    );
  };
  return { fetch: fetchImpl, calls };
}

function sentHeaders(calls: Recorded[]): Record<string, string> {
  return calls[0]?.init.headers as Record<string, string>;
}

async function drain(model: GeminiModel): Promise<ChatCompletionChunk[]> {
  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of model.generateStream([{ role: "user", content: "Weather?" }])) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("GeminiModel streaming", () => {
  it("turns the streamed responses into chunks", async () => {
    const { fetch } = recorder(transcript);
    const model = new GeminiModel({ model: "gemini-2.5-flash", fetch });

    const chunks = await drain(model);

    expect(chunks.map((chunk) => chunk.delta).join("")).toBe("I'll check");
    const call = chunks.find((chunk) => chunk.toolCallDelta !== undefined)?.toolCallDelta;
    expect(call).toEqual({
      index: 0,
      id: "call-0",
      name: "get_weather",
      argumentsDelta: '{"city":"Paris"}',
    });
    expect(chunks.at(-1)?.finishReason).toBe("tool_calls");
  });

  it("collects the stream into one call", async () => {
    const { fetch } = recorder(transcript);
    const model = new GeminiModel({ model: "m", fetch });

    const result = await collectCompletion(model.generateStream([{ role: "user", content: "W?" }]));

    expect(result.content).toBe("I'll check");
    expect(result.toolCalls).toEqual([
      { id: "call-0", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.finishReason).toBe("tool_calls");
  });

  it("reports the usage the stream carries", async () => {
    const { fetch } = recorder(transcript);
    const model = new GeminiModel({ model: "m", fetch });

    const chunks = await drain(model);
    const reported = chunks.find((chunk) => chunk.usage !== undefined);

    expect(reported?.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
  });

  it("asks for the event-stream form", async () => {
    const { fetch, calls } = recorder(transcript);
    const model = new GeminiModel({ model: "gemini-2.5-flash", baseUrl: "https://example.test/v1beta", fetch });

    await drain(model);

    expect(calls[0]?.url).toBe(
      "https://example.test/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse",
    );
    expect(sentHeaders(calls)["accept"]).toBe("text/event-stream");
  });

  it("yields nothing for a response that says nothing", async () => {
    const empty = 'data: {"candidates":[{"content":{"role":"model","parts":[]}}]}\n\n';
    const { fetch } = recorder(empty);
    const model = new GeminiModel({ model: "m", fetch });

    expect(await drain(model)).toEqual([]);
  });

  it("throws when the response carries no body", async () => {
    const noBody: FetchLike = () => Promise.resolve(new Response(null, { status: 200 }));
    const model = new GeminiModel({ model: "m", fetch: noBody });

    const error = await collectCompletion(
      model.generateStream([{ role: "user", content: "hi" }]),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("The provider returned no body to stream");
  });
});
