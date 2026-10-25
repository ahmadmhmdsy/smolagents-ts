import { readFileSync } from "node:fs";
import {
  MODEL_ADAPTER_VERSION,
  upgradeModelAdapter,
  type ChatCompletion,
  type ChatCompletionChunk,
  type Model,
  type ModelAdapterV1,
} from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { AnthropicModel } from "../src/anthropic.js";
import { CustomModel } from "../src/custom.js";
import { GeminiModel } from "../src/gemini.js";
import { HuggingFaceModel } from "../src/huggingface.js";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

function fixture(name: string): string {
  return readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
}

/** Answers every request with one recorded body; the conformance file never reaches a provider. */
function answer(body: string, contentType: string): FetchLike {
  return () =>
    Promise.resolve(new Response(body, { status: 200, headers: { "content-type": contentType } }));
}

/** One adapter, two wire forms: the request's own stream flag picks the recorded body. Gemini */
/** streams from a different URL rather than a body flag, so the URL decides there. */
function wireFetch(jsonBody: string, sseBody: string): FetchLike {
  return (url, init) => {
    const stream =
      String(init.body ?? "").includes('"stream":true') ||
      (typeof url === "string" && (url.includes(":streamGenerateContent") || url.includes("alt=sse")));
    return Promise.resolve(
      new Response(stream ? sseBody : jsonBody, {
        status: 200,
        headers: { "content-type": stream ? "text/event-stream" : "application/json" },
      }),
    );
  };
}

/** A model factory: one instance per wire form, so generate and generateStream see their fixture. */
interface ConformingAdapter {
  readonly name: string;
  /** The fixture for generate(), empty when the adapter has no wire. */
  readonly json: string;
  /** The fixture for generateStream(), empty when the adapter has no wire. */
  readonly sse: string;
  /** Whether the adapter speaks HTTP and therefore reads the two fixtures. */
  readonly wire: boolean;
  build(fetch: FetchLike): Model;
}

const CUSTOM_COMPLETION: ChatCompletion = {
  content: "custom answer",
  toolCalls: [],
  usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
  finishReason: "stop",
};

function customStream(): AsyncIterable<ChatCompletionChunk> {
  return (async function* () {
    yield { delta: "custom " };
    yield { delta: "answer", finishReason: "stop" as const };
  })();
}

/** Exported so the phase exit test covers exactly this list: a new adapter cannot land uncovered. */
export const CONFORMING_ADAPTERS: readonly ConformingAdapter[] = [
  {
    name: "OpenAICompatibleModel",
    json: "openai-chat-completion.json",
    sse: "openai-chat-completion.sse.txt",
    wire: true,
    build: (fetch) => new OpenAICompatibleModel({ model: "gpt-4o-mini", fetch }),
  },
  {
    name: "AnthropicModel",
    json: "anthropic-messages.json",
    sse: "anthropic-messages.sse.txt",
    wire: true,
    build: (fetch) => new AnthropicModel({ model: "claude-sonnet-4-5", fetch }),
  },
  {
    name: "GeminiModel",
    json: "gemini-generate-content.json",
    sse: "gemini-stream.sse.txt",
    wire: true,
    build: (fetch) => new GeminiModel({ model: "gemini-2.5-flash", fetch }),
  },
  {
    name: "HuggingFaceModel",
    // The router speaks the OpenAI wire, so it reads the OpenAI fixtures.
    json: "huggingface-chat-completion.json",
    sse: "openai-chat-completion.sse.txt",
    wire: true,
    build: (fetch) => new HuggingFaceModel({ model: "meta-llama/Llama-3-8B-Instruct", fetch }),
  },
  {
    name: "CustomModel",
    json: "",
    sse: "",
    wire: false,
    build: () =>
      new CustomModel({
        id: "custom-model",
        generate: () => Promise.resolve({ ...CUSTOM_COMPLETION, toolCalls: [] }),
        generateStream: customStream,
      }),
  },
];

/** The assertions every adapter must satisfy at the current contract version. */
async function assertContract(adapter: Model): Promise<void> {
  const versioned = adapter as ModelAdapterV1;
  expect(MODEL_ADAPTER_VERSION).toBe(1);
  expect(versioned.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
  expect(adapter.id.length).toBeGreaterThan(0);
  expect(adapter.provider.length).toBeGreaterThan(0);
  expect(typeof adapter.capabilities.streaming).toBe("boolean");
  expect(typeof adapter.capabilities.toolCalls).toBe("boolean");
  expect(typeof adapter.capabilities.images).toBe("boolean");

  const completion = await adapter.generate([{ role: "user", content: "answer" }]);
  expect(typeof completion.content).toBe("string");
  expect(Array.isArray(completion.toolCalls)).toBe(true);
  expect(["stop", "tool_calls", "length", "other"]).toContain(completion.finishReason);
  expect(completion.usage.inputTokens).toBeGreaterThanOrEqual(0);
  expect(completion.usage.outputTokens).toBeGreaterThanOrEqual(0);
  expect(completion.usage.totalTokens).toBe(
    completion.usage.inputTokens + completion.usage.outputTokens,
  );

  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of adapter.generateStream([{ role: "user", content: "answer" }])) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.some((chunk) => chunk.finishReason !== undefined || chunk.usage !== undefined)).toBe(true);
}

describe("the adapter contract", () => {
  for (const adapter of CONFORMING_ADAPTERS) {
    it(adapter.name + " conforms at version " + String(MODEL_ADAPTER_VERSION), async () => {
      // A wire adapter reads both fixtures; CustomModel takes no request at all.
      const fetchImpl = adapter.wire
        ? wireFetch(fixture(adapter.json), fixture(adapter.sse))
        : answer("{}", "application/json");
      await assertContract(adapter.build(fetchImpl));
    });
  }

  it("accepts a model written before the numbering", async () => {
    const legacy: Model = {
      id: "legacy",
      provider: "legacy",
      capabilities: { streaming: false, toolCalls: false, images: false },
      generate: () => Promise.resolve({ ...CUSTOM_COMPLETION, toolCalls: [] }),
      generateStream: () => customStream(),
    };

    const upgraded = upgradeModelAdapter(legacy);
    expect(upgraded.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
    expect(upgraded.id).toBe("legacy");
    const completion = await upgraded.generate([{ role: "user", content: "hi" }]);
    expect(completion.content).toBe("custom answer");
  });
});
