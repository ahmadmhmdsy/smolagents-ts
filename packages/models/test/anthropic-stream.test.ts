import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { collectCompletion, type ChatCompletionChunk } from "@smolagents-ts/core";
import { AnthropicModel } from "../src/anthropic.js";
import { type FetchLike } from "../src/transport.js";

/** The event stream Anthropic documents for a tool-calling turn, kept as a fixture so the suite needs no key. */
const transcript = readFileSync(
  new URL("./fixtures/anthropic-messages.sse.txt", import.meta.url),
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

async function drain(model: AnthropicModel): Promise<ChatCompletionChunk[]> {
  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of model.generateStream([{ role: "user", content: "Weather?" }])) {
    chunks.push(chunk);
  }
  return chunks;
}

describe("AnthropicModel streaming", () => {
  it("turns the named events into chunks", async () => {
    const { fetch } = recorder(transcript);
    const model = new AnthropicModel({
      model: "claude-sonnet-4-5",
      baseUrl: "https://example.test",
      fetch,
    });

    const chunks = await drain(model);

    expect(chunks.map((chunk) => chunk.delta).join("")).toBe("I'll check");
    const argumentsDelta = chunks
      .filter((chunk) => chunk.toolCallDelta?.argumentsDelta !== undefined)
      .map((chunk) => chunk.toolCallDelta?.argumentsDelta)
      .join("");
    expect(argumentsDelta).toBe('{"city":"Paris"}');
    const announced = chunks.find((chunk) => chunk.toolCallDelta?.id !== undefined)?.toolCallDelta;
    expect(announced?.id).toBe("toolu_01A09q90qw90lq917835lq9");
    expect(announced?.name).toBe("get_weather");
    expect(chunks.at(-1)?.finishReason).toBe("tool_calls");
  });

  it("collects the stream into the call the documented reply describes", async () => {
    const { fetch } = recorder(transcript);
    const model = new AnthropicModel({ model: "m", fetch });

    const result = await collectCompletion(model.generateStream([{ role: "user", content: "W?" }]));

    expect(result.content).toBe("I'll check");
    expect(result.toolCalls).toEqual([
      { id: "toolu_01A09q90qw90lq917835lq9", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.finishReason).toBe("tool_calls");
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
  });

  it("adds the input count from the start to the output count from the end", async () => {
    const { fetch } = recorder(transcript);
    const model = new AnthropicModel({ model: "m", fetch });

    const chunks = await drain(model);
    const reported = chunks.find((chunk) => chunk.usage !== undefined);

    expect(reported?.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
  });

  it("asks for an event stream", async () => {
    const { fetch, calls } = recorder(transcript);
    const model = new AnthropicModel({ model: "m", baseUrl: "https://example.test", fetch });

    await drain(model);

    expect(calls[0]?.url).toBe("https://example.test/v1/messages");
    expect(sentHeaders(calls)["accept"]).toBe("text/event-stream");
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ stream: true });
  });

  it("stops at message_stop", async () => {
    const late =
      transcript +
      '\nevent: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"late"}}\n\n';
    const { fetch } = recorder(late);
    const model = new AnthropicModel({ model: "m", fetch });

    const chunks = await drain(model);

    expect(chunks.map((chunk) => chunk.delta).join("")).toBe("I'll check");
  });

  it("throws when the response carries no body", async () => {
    const noBody: FetchLike = () => Promise.resolve(new Response(null, { status: 200 }));
    const model = new AnthropicModel({ model: "m", fetch: noBody });

    const error = await collectCompletion(
      model.generateStream([{ role: "user", content: "hi" }]),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("The provider returned no body to stream");
  });
});
