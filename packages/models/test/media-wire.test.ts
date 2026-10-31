import { readFileSync } from "node:fs";
import {
  UnsupportedContentError,
  collectCompletion,
  type AudioPart,
  type ChatMessage,
  type ContentPart,
  type ImagePart,
  type Model,
} from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { AnthropicModel } from "../src/anthropic.js";
import { GeminiModel } from "../src/gemini.js";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG_BASE64 = "iVBORw0KGgo=";
const GIF_SIGNATURE = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
const WAV_SIGNATURE = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45];
const WAV_BASE64 = "UklGRgAAAABXQVZF";

const PNG: ImagePart = { type: "image", mediaType: "image/png", bytes: Uint8Array.from(PNG_SIGNATURE) };
const GIF: ImagePart = { type: "image", mediaType: "image/gif", bytes: Uint8Array.from(GIF_SIGNATURE) };
const WAV: AudioPart = {
  type: "audio",
  mediaType: "audio/wav",
  format: "wav",
  bytes: Uint8Array.from(WAV_SIGNATURE),
};
const TEXT: ContentPart = { type: "text", text: "What is this?" };

interface WireBody {
  messages: Array<{ role: string; content: unknown }>;
  contents: Array<{ role: string; parts: unknown }>;
}

function fixture(name: string): string {
  return readFileSync(new URL("./fixtures/" + name, import.meta.url), "utf8");
}

function recorder(reply: string): { fetch: FetchLike; bodies: () => WireBody[]; count: () => number } {
  const sent: string[] = [];
  const fetchImpl: FetchLike = (_url, init) => {
    sent.push(String(init.body));
    return Promise.resolve(new Response(reply, { status: 200, headers: { "content-type": "application/json" } }));
  };
  return {
    fetch: fetchImpl,
    bodies: () => sent.map((body) => JSON.parse(body) as WireBody),
    count: () => sent.length,
  };
}

function user(...content: ContentPart[]): ChatMessage[] {
  return [{ role: "user", content }];
}

const ADAPTERS = [
  {
    name: "OpenAICompatibleModel",
    reply: "openai-chat-completion.json",
    build: (fetch: FetchLike, capabilities?: { images?: boolean; audio?: boolean }): Model =>
      new OpenAICompatibleModel({ model: "m", fetch, ...(capabilities ? { capabilities } : {}) }),
  },
  {
    name: "AnthropicModel",
    reply: "anthropic-messages.json",
    build: (fetch: FetchLike, capabilities?: { images?: boolean; audio?: boolean }): Model =>
      new AnthropicModel({ model: "m", fetch, ...(capabilities ? { capabilities } : {}) }),
  },
  {
    name: "GeminiModel",
    reply: "gemini-generate-content.json",
    build: (fetch: FetchLike, capabilities?: { images?: boolean; audio?: boolean }): Model =>
      new GeminiModel({ model: "m", fetch, ...(capabilities ? { capabilities } : {}) }),
  },
];

describe.each(ADAPTERS)("media on the wire: $name", ({ reply, build }) => {
  it("sends a text-only parts array exactly as it sends the string", async () => {
    const asString = recorder(fixture(reply));
    await build(asString.fetch).generate([{ role: "user", content: "What is this?" }]);
    const asParts = recorder(fixture(reply));
    await build(asParts.fetch).generate(user(TEXT));
    expect(asParts.bodies()).toEqual(asString.bodies());
  });

  it("refuses media on a non-user message before any request", async () => {
    const wire = recorder(fixture(reply));
    await expect(build(wire.fetch).generate([{ role: "assistant", content: [PNG] }])).rejects.toBeInstanceOf(
      UnsupportedContentError,
    );
    expect(wire.count()).toBe(0);
  });

  it("refuses an image once the caller turns the capability off", async () => {
    const wire = recorder(fixture(reply));
    await expect(build(wire.fetch, { images: false }).generate(user(PNG))).rejects.toBeInstanceOf(
      UnsupportedContentError,
    );
    expect(wire.count()).toBe(0);
  });

  it("refuses on the streaming path too", async () => {
    const wire = recorder("");
    const disguised: ImagePart = { ...PNG, mediaType: "image/gif" };
    await expect(collectCompletion(build(wire.fetch).generateStream(user(disguised)))).rejects.toBeInstanceOf(
      UnsupportedContentError,
    );
    expect(wire.count()).toBe(0);
  });
});

describe("OpenAICompatibleModel media mapping", () => {
  it("maps an image to a data URI with its detail, and audio to input_audio", async () => {
    const wire = recorder(fixture("openai-chat-completion.json"));
    const model = new OpenAICompatibleModel({ model: "m", fetch: wire.fetch });
    await model.generate(user(TEXT, { ...PNG, detail: "low" }, WAV));
    expect(wire.bodies()[0]?.messages[0]?.content).toEqual([
      { type: "text", text: "What is this?" },
      { type: "image_url", image_url: { url: "data:image/png;base64," + PNG_BASE64, detail: "low" } },
      { type: "input_audio", input_audio: { data: WAV_BASE64, format: "wav" } },
    ]);
  });

  it("omits detail when the part sets none", async () => {
    const wire = recorder(fixture("openai-chat-completion.json"));
    const model = new OpenAICompatibleModel({ model: "m", fetch: wire.fetch });
    await model.generate(user(PNG));
    expect(wire.bodies()[0]?.messages[0]?.content).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64," + PNG_BASE64 } },
    ]);
  });
});

describe("AnthropicModel media mapping", () => {
  it("maps an image to a base64 block and leaves detail off", async () => {
    const wire = recorder(fixture("anthropic-messages.json"));
    const model = new AnthropicModel({ model: "m", fetch: wire.fetch });
    await model.generate(user(TEXT, { ...PNG, detail: "high" }));
    expect(wire.bodies()[0]?.messages[0]?.content).toEqual([
      { type: "text", text: "What is this?" },
      { type: "image", source: { type: "base64", media_type: "image/png", data: PNG_BASE64 } },
    ]);
  });

  it("refuses audio even when the caller claims it", async () => {
    const wire = recorder(fixture("anthropic-messages.json"));
    const model = new AnthropicModel({ model: "m", fetch: wire.fetch, capabilities: { audio: true } });
    expect(model.capabilities.audio).toBe(false);
    await expect(model.generate(user(WAV))).rejects.toBeInstanceOf(UnsupportedContentError);
    expect(wire.count()).toBe(0);
  });

  it("puts the transcript cache marker on an image that ends the turn", async () => {
    const wire = recorder(fixture("anthropic-messages.json"));
    const model = new AnthropicModel({ model: "m", fetch: wire.fetch });
    await model.generate(user(TEXT, PNG), { providerOptions: { cache: { transcript: true } } });
    const blocks = wire.bodies()[0]?.messages[0]?.content as Array<Record<string, unknown>>;
    expect(blocks.at(-1)?.["type"]).toBe("image");
    expect(blocks.at(-1)?.["cache_control"]).toEqual({ type: "ephemeral" });
  });
});

describe("GeminiModel media mapping", () => {
  it("maps media to inlineData parts", async () => {
    const wire = recorder(fixture("gemini-generate-content.json"));
    const model = new GeminiModel({ model: "m", fetch: wire.fetch });
    await model.generate(user(TEXT, PNG, WAV));
    expect(wire.bodies()[0]?.contents[0]?.parts).toEqual([
      { text: "What is this?" },
      { inlineData: { mimeType: "image/png", data: PNG_BASE64 } },
      { inlineData: { mimeType: "audio/wav", data: WAV_BASE64 } },
    ]);
  });

  it("refuses a gif, which the provider does not list", async () => {
    const wire = recorder(fixture("gemini-generate-content.json"));
    const model = new GeminiModel({ model: "m", fetch: wire.fetch });
    await expect(model.generate(user(GIF))).rejects.toBeInstanceOf(UnsupportedContentError);
    expect(wire.count()).toBe(0);
  });
});
