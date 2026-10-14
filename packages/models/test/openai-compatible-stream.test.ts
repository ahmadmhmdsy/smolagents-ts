import { readFileSync } from "node:fs";
import { collectCompletion, type Model } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { CustomModel } from "../src/custom.js";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

const transcript = readFileSync(
  new URL("./fixtures/openai-chat-completion.sse.txt", import.meta.url),
  "utf8",
);

/** A response whose body arrives in fixed-size pieces, the way a network delivers it. */
function streamed(text: string, chunkSize?: number): FetchLike {
  return () => {
    const bytes = new TextEncoder().encode(text);
    const size = chunkSize ?? bytes.length;
    return Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            for (let at = 0; at < bytes.length; at += size) {
              controller.enqueue(bytes.slice(at, at + size));
            }
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );
  };
}

interface Recorded {
  url: string;
  init: RequestInit;
}

function recording(impl: FetchLike): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return impl(url, init);
  };
  return { fetch: fetchImpl, calls };
}

describe("OpenAICompatibleModel.generateStream", () => {
  it("turns the recorded transcript into chunks", async () => {
    const { fetch, calls } = recording(streamed(transcript));
    const model = new OpenAICompatibleModel({ model: "gpt-4o-mini", apiKey: "sk-test", fetch });

    const chunks = [];
    for await (const chunk of model.generateStream([{ role: "user", content: "Weather?" }])) {
      chunks.push(chunk);
    }

    expect(chunks.map((chunk) => chunk.delta).join("")).toBe("Let me check.");
    // The wire reports the finish reason on the last content chunk and usage on the
    // chunk after it, so the two are not on the same chunk.
    expect(chunks.find((chunk) => chunk.finishReason !== undefined)?.finishReason).toBe("tool_calls");
    expect(chunks.at(-1)?.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(chunks.flatMap((chunk) => (chunk.toolCallDelta === undefined ? [] : [chunk.toolCallDelta]))).toEqual([
      { index: 0, id: "call_1", name: "get_weather", argumentsDelta: "" },
      { index: 0, argumentsDelta: '{"city":"Paris"}' },
    ]);

    expect(calls[0]?.url).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(calls[0]?.init.body)) as { stream: boolean };
    expect(body.stream).toBe(true);
  });

  it("asks the provider for usage while streaming", async () => {
    const { fetch, calls } = recording(streamed(transcript));
    const model = new OpenAICompatibleModel({ model: "gpt-4o-mini", fetch });

    await collectCompletion(model.generateStream([{ role: "user", content: "Q" }]));

    const body = JSON.parse(String(calls[0]?.init.body)) as {
      stream_options?: { include_usage: boolean };
    };
    expect(body.stream_options).toEqual({ include_usage: true });
  });

  it("survives the transcript arriving in small pieces", async () => {
    const model = new OpenAICompatibleModel({ model: "m", fetch: streamed(transcript, 7) });

    const completion = await collectCompletion(model.generateStream([{ role: "user", content: "Q" }]));

    expect(completion.content).toBe("Let me check.");
    expect(completion.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
    expect(completion.usage).toEqual({ inputTokens: 42, outputTokens: 7, totalTokens: 49 });
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("ignores a keep-alive comment between events", async () => {
    const model = new OpenAICompatibleModel({
      model: "m",
      fetch: streamed(": ping\n\n" + transcript),
    });

    const completion = await collectCompletion(model.generateStream([{ role: "user", content: "Q" }]));

    expect(completion.content).toBe("Let me check.");
  });

  it("stops at the [DONE] sentinel", async () => {
    const model = new OpenAICompatibleModel({
      model: "m",
      fetch: streamed(transcript + 'data: {"choices":[{"delta":{"content":"never"}}]}\n\n'),
    });

    const completion = await collectCompletion(model.generateStream([{ role: "user", content: "Q" }]));

    expect(completion.content).toBe("Let me check.");
  });

  it("refuses a response with no body", async () => {
    const model = new OpenAICompatibleModel({
      model: "m",
      fetch: () => Promise.resolve(new Response(null, { status: 200 })),
    });

    const error = await collectCompletion(model.generateStream([{ role: "user", content: "Q" }])).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/no body/i);
  });
});

describe("OpenAICompatibleModel as a Model", () => {
  it("satisfies the core interface", () => {
    const model: Model = new OpenAICompatibleModel({ model: "m" });
    expect(model.id).toBe("m");
    expect(model.capabilities.streaming).toBe(true);
  });
});

describe("CustomModel", () => {
  it("delegates both calls to the functions it was given", async () => {
    const seen: number[] = [];
    const model = new CustomModel({
      id: "scripted",
      generate: (messages, options) => {
        seen.push(messages.length, options.temperature ?? -1);
        return Promise.resolve({
          content: "hello",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 2, totalTokens: 3 },
          finishReason: "stop",
        });
      },
      generateStream: () =>
        (async function* () {
          yield { delta: "he" };
          yield { delta: "llo", finishReason: "stop" as const };
        })(),
    });

    const completion = await model.generate([{ role: "user", content: "hi" }], { temperature: 0 });
    expect(completion.content).toBe("hello");
    expect(seen).toEqual([1, 0]);

    const streamed = await collectCompletion(model.generateStream([{ role: "user", content: "hi" }]));
    expect(streamed.content).toBe("hello");
    expect(streamed.finishReason).toBe("stop");
    expect(model.provider).toBe("custom");
    expect(model.capabilities.streaming).toBe(true);
  });

  it("reports no streaming capability when no stream function was given", () => {
    const model = new CustomModel({
      id: "one-shot",
      generate: () =>
        Promise.resolve({
          content: "",
          toolCalls: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          finishReason: "stop",
        }),
    });

    expect(model.capabilities.streaming).toBe(false);
    expect(() => model.generateStream([{ role: "user", content: "hi" }])).toThrow(/generateStream/);
  });
});
