import { readFileSync } from "node:fs";
import type { ChatCompletion, ChatCompletionChunk, Model } from "@smolagents-ts/core";
import { AnthropicModel } from "../src/anthropic.js";
import { CustomModel } from "../src/custom.js";
import { GeminiModel } from "../src/gemini.js";
import { HuggingFaceModel } from "../src/huggingface.js";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

/** The recorded body for one fixture; a provider is never reached. */
export function fixture(name: string): string {
  return readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
}

/** Answers every request with one recorded body. */
export function answer(body: string, contentType: string): FetchLike {
  return () =>
    Promise.resolve(new Response(body, { status: 200, headers: { "content-type": contentType } }));
}

/** One adapter, two wire forms: the request's own stream flag picks the recorded body. Gemini */
/** streams from a different URL rather than a body flag, so the URL decides there. */
export function wireFetch(jsonBody: string, sseBody: string): FetchLike {
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
export interface ConformingAdapter {
  readonly name: string;
  /** The fixture for generate(), empty when the adapter has no wire. */
  readonly json: string;
  /** The fixture for generateStream(), empty when the adapter has no wire. */
  readonly sse: string;
  /** Whether the adapter speaks HTTP and therefore reads the two fixtures. */
  readonly wire: boolean;
  build(fetch: FetchLike): Model;
}

export const CUSTOM_COMPLETION: ChatCompletion = {
  content: "custom answer",
  toolCalls: [],
  usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
  finishReason: "stop",
};

export function customStream(): AsyncIterable<ChatCompletionChunk> {
  return (async function* () {
    yield { delta: "custom " };
    yield { delta: "answer", finishReason: "stop" as const };
  })();
}

/** The list the phase exit test imports: a new adapter cannot land outside it. */
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
