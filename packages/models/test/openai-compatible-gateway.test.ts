import { readFileSync } from "node:fs";
import { collectCompletion } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { OpenAICompatibleModel } from "../src/openai-compatible.js";
import type { FetchLike } from "../src/transport.js";

/**
 * The frame shapes an OpenAI-compatible gateway adds to the wire, hand-shaped from
 * `docs/research/omniroute-api-surface.md` §2 as it read gateway `3.8.53` -- not a capture of a
 * live gateway, which the repository cannot support. The fixture is named by wire shape rather
 * than by one gateway because LiteLLM and Portkey emit the same frames.
 */
const fixture = readFileSync(
  new URL("./fixtures/openai-compatible-gateway.sse.txt", import.meta.url),
  "utf8",
);

/** An error stream replaces the stream it interrupts, so it cannot share the fixture's body. */
const errorStream =
  'data: {"choices":[{"index":0,"delta":{"content":"partial "}}]}\n\n' +
  'data: {"error":{"message":"Upstream provider timed out","type":"stream_error"}}\n\n';

function streamed(text: string): FetchLike {
  return () => {
    const bytes = new TextEncoder().encode(text);
    return Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            // One byte at a time: the reader must reassemble frames across reads.
            for (let at = 0; at < bytes.length; at += 1) controller.enqueue(bytes.slice(at, at + 1));
            controller.close();
          },
        }),
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ),
    );
  };
}

function modelFor(body: string, apiKey?: string): OpenAICompatibleModel {
  return new OpenAICompatibleModel({
    model: "auto",
    baseUrl: "http://localhost:20128/v1",
    ...(apiKey === undefined ? {} : { apiKey }),
    fetch: streamed(body),
  });
}

describe("the OpenAI-compatible wire through a gateway", () => {
  it("drops the synthetic keepalive chunk instead of yielding phantom text", async () => {
    const completion = await collectCompletion(
      modelFor(fixture).generateStream([{ role: "user", content: "Q" }]),
    );

    expect(completion.content).toBe("Gateway ready.");
  });

  it("reads one usage chunk from a frame whose choices are empty", async () => {
    const chunks = [];
    for await (const chunk of modelFor(fixture).generateStream([{ role: "user", content: "Q" }])) {
      chunks.push(chunk);
    }

    expect(chunks.filter((chunk) => chunk.usage !== undefined)).toHaveLength(1);
    expect(chunks.at(-1)?.usage).toEqual({ inputTokens: 12, outputTokens: 4, totalTokens: 16 });
  });

  it("reads the synthesized finish reason the gateway adds when the upstream sent none", async () => {
    const chunks = [];
    for await (const chunk of modelFor(fixture).generateStream([{ role: "user", content: "Q" }])) {
      chunks.push(chunk);
    }

    expect(chunks.filter((chunk) => chunk.finishReason !== undefined)).toHaveLength(1);
    expect(chunks.find((chunk) => chunk.finishReason !== undefined)?.finishReason).toBe("stop");
  });

  it("throws on an error delivered as a data frame, without the key in the message", async () => {
    const key = "gateway-key-do-not-print";
    const error = await collectCompletion(
      modelFor(errorStream, key).generateStream([{ role: "user", content: "Q" }]),
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/stream reported an error/);
    expect((error as Error).message).toContain("Upstream provider timed out");
    expect((error as Error).message).not.toContain(key);
  });
});
