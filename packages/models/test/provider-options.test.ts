import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnthropicModel, type AnthropicProviderOptions } from "../src/anthropic.js";
import { CustomModel } from "../src/custom.js";
import { GeminiModel, type GeminiProviderOptions } from "../src/gemini.js";
import { OpenAICompatibleModel, type OpenAICompatibleProviderOptions } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

function fixture(name: string): string {
  return readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
}

interface Recorded {
  url: string;
  init: RequestInit;
}

/** Records the request and answers from the provider fixture, so no test reaches a provider. */
function recorder(name: string): { fetch: FetchLike; calls: Recorded[] } {
  const body = fixture(name);
  const calls: Recorded[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(
        new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
      );
    },
  };
}

function sent(calls: Recorded[]): Record<string, unknown> {
  return JSON.parse(String(calls[0]?.init.body)) as Record<string, unknown>;
}

const weatherTool = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: { type: "object", properties: { city: { type: "string" } } },
} as const;

const transcript = [
  { role: "system", content: "You are terse." } as const,
  { role: "user", content: "hi" } as const,
];

describe("typed provider options", () => {
  it("puts Anthropic cache breakpoints on the system, the tools and the transcript", async () => {
    const { fetch, calls } = recorder("anthropic-messages.json");
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", fetch });
    const providerOptions: AnthropicProviderOptions = {
      cache: { system: true, tools: true, transcript: true, ttl: "1h" },
    };

    await model.generate([...transcript], { tools: [weatherTool], providerOptions });

    const body = sent(calls);
    const marker = { type: "ephemeral", ttl: "1h" };
    expect(body["system"]).toEqual([{ type: "text", text: "You are terse.", cache_control: marker }]);
    const tools = body["tools"] as Array<Record<string, unknown>>;
    expect(tools.at(-1)?.["cache_control"]).toEqual(marker);
    const messages = body["messages"] as Array<{ role: string; content: Array<Record<string, unknown>> }>;
    expect(messages.at(-1)?.content.at(-1)?.["cache_control"]).toEqual(marker);
  });

  it("merges Anthropic extra body under the adapter's own fields", async () => {
    const { fetch, calls } = recorder("anthropic-messages.json");
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", fetch });
    const providerOptions: AnthropicProviderOptions = {
      extraBody: { metadata: { user_id: "u-1" }, model: "not-this-one" },
    };

    await model.generate([...transcript], { providerOptions });

    const body = sent(calls);
    expect(body["model"]).toBe("claude-sonnet-4-5");
    expect(body["metadata"]).toEqual({ user_id: "u-1" });
  });

  it("carries the OpenAI cache hint fields", async () => {
    const { fetch, calls } = recorder("openai-chat-completion.json");
    const model = new OpenAICompatibleModel({ model: "gpt-4o-mini", fetch });
    const providerOptions: OpenAICompatibleProviderOptions = {
      promptCacheKey: "run-42",
      promptCacheRetention: "24h",
      extraBody: { service_tier: "flex" },
    };

    await model.generate([...transcript], { providerOptions });

    const body = sent(calls);
    expect(body["prompt_cache_key"]).toBe("run-42");
    expect(body["prompt_cache_retention"]).toBe("24h");
    expect(body["service_tier"]).toBe("flex");
  });

  it("names the Gemini cached content", async () => {
    const { fetch, calls } = recorder("gemini-generate-content.json");
    const model = new GeminiModel({ model: "gemini-2.5-flash", fetch });
    const providerOptions: GeminiProviderOptions = {
      cachedContent: "cachedContents/abc",
      extraBody: { safetySettings: [{ category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" }] },
    };

    await model.generate([{ role: "user", content: "hi" }], { providerOptions });

    const body = sent(calls);
    expect(body["cachedContent"]).toBe("cachedContents/abc");
    expect(body["safetySettings"]).toEqual([
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "OFF" },
    ]);
  });

  it("hands a custom model the provider object untouched", async () => {
    const providerOptions = { anything: { goes: true } };
    let seen: unknown;
    const model = new CustomModel({
      id: "custom",
      generate: (_messages, options) => {
        seen = options.providerOptions;
        return Promise.resolve({
          content: "ok",
          toolCalls: [],
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          finishReason: "stop",
        });
      },
    });

    await model.generate([{ role: "user", content: "hi" }], { providerOptions });

    expect(seen).toBe(providerOptions);
  });

  it("leaves the Anthropic payload unchanged when no options are pinned", async () => {
    const { fetch, calls } = recorder("anthropic-messages.json");
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", fetch });

    await model.generate([...transcript]);

    const body = sent(calls);
    expect(body["system"]).toBe("You are terse.");
    const tools = body["tools"] as Array<Record<string, unknown>> | undefined;
    expect(tools?.some((entry) => "cache_control" in entry)).not.toBe(true);
  });
});
