import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ChatCompletionChunk } from "@smolagents-ts/core";
import { HuggingFaceModel } from "../src/huggingface.js";
import { HttpError, type FetchLike } from "../src/transport.js";

/** The reply the Inference Providers router documents, kept as a fixture so the suite needs no key. */
const completion = readFileSync(
  new URL("./fixtures/huggingface-chat-completion.json", import.meta.url),
  "utf8",
);

const streamed =
  'data: {"choices":[{"index":0,"delta":{"content":"hi"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';

interface Recorded {
  url: string;
  init: RequestInit;
}

interface SentBody {
  model: string;
  stream: boolean;
  stream_options?: { include_usage: boolean };
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

describe("HuggingFaceModel", () => {
  it("defaults to the router and parses the completion it documents", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new HuggingFaceModel({ model: "openai/gpt-oss-120b:groq", apiKey: "hf_test", fetch });

    const result = await model.generate([{ role: "user", content: "Weather in Paris?" }]);

    expect(calls[0]?.url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect(sentHeaders(calls)["authorization"]).toBe("Bearer hf_test");
    expect(bodyOf(calls).model).toBe("openai/gpt-oss-120b:groq");
    expect(result.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(result.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(result.finishReason).toBe("tool_calls");
  });

  it("keeps the routing suffix and reports its own provider", () => {
    const model = new HuggingFaceModel({ model: "openai/gpt-oss-120b:cheapest" });
    expect(model.id).toBe("openai/gpt-oss-120b:cheapest");
    expect(model.provider).toBe("huggingface");
    expect(model.capabilities.toolCalls).toBe(true);
  });

  it("asks the router for usage while streaming", async () => {
    const { fetch, calls } = recorder(streamed);
    const model = new HuggingFaceModel({ model: "m", fetch });

    const chunks: ChatCompletionChunk[] = [];
    for await (const chunk of model.generateStream([{ role: "user", content: "hi" }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.delta).join("")).toBe("hi");
    expect(bodyOf(calls).stream).toBe(true);
    expect(bodyOf(calls).stream_options).toEqual({ include_usage: true });
  });

  it("does not ask for usage on a non-streaming request", async () => {
    const { fetch, calls } = recorder(completion);
    const model = new HuggingFaceModel({ model: "m", fetch });

    await model.generate([{ role: "user", content: "hi" }]);

    expect(bodyOf(calls).stream_options).toBeUndefined();
  });

  it("raises an HttpError from the router and refuses a blank model id", async () => {
    const { fetch } = recorder("model not found", 404);
    const model = new HuggingFaceModel({ model: "m", fetch });

    const error = await model.generate([{ role: "user", content: "hi" }]).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(404);
    expect((error as HttpError).url).toBe("https://router.huggingface.co/v1/chat/completions");
    expect(() => new HuggingFaceModel({ model: " " })).toThrow(/model id/);
  });
});
