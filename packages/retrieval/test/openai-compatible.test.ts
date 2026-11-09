import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EmbeddingRequestError, Retriever, openAICompatibleEmbedder } from "../src/index.js";

const fixture = readFileSync(new URL("./fixtures/openai-embeddings.json", import.meta.url), "utf8");

interface Recorded {
  url: string;
  init: RequestInit;
}

function recorder(body = fixture, status = 200): { fetch: typeof globalThis.fetch; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl = ((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(body, { status, headers: { "content-type": "application/json" } }));
  }) as typeof globalThis.fetch;
  return { fetch: fetchImpl, calls };
}

describe("openAICompatibleEmbedder", () => {
  it("posts the model and the texts and returns vectors in index order", async () => {
    const { fetch, calls } = recorder();
    const embedder = openAICompatibleEmbedder({
      baseUrl: "http://localhost:11434/v1/",
      model: "nomic-embed-text",
      fetch,
    });
    const vectors = await embedder.embed(["first", "second"]);
    expect(calls[0]?.url).toBe("http://localhost:11434/v1/embeddings");
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ model: "nomic-embed-text", input: ["first", "second"] });
    expect((calls[0]?.init.headers as Record<string, string>)["authorization"]).toBeUndefined();
    // The fixture lists index 1 before index 0; the embedder restores the order.
    expect(vectors).toEqual([
      [0.1, 0.2, 0.3],
      [0.3, 0.2, 0.1],
    ]);
    expect(embedder.id).toBe("openai-compatible:nomic-embed-text");
  });

  it("sends the key and the dimensions when given, and splits large inputs into batches", async () => {
    const { fetch, calls } = recorder();
    const embedder = openAICompatibleEmbedder({
      baseUrl: "https://api.example.test/v1",
      model: "text-embedding-3-small",
      apiKey: "secret-key",
      dimensions: 3,
      batchSize: 2,
      fetch,
    });
    const vectors = await embedder.embed(["a", "b", "c", "d"]);
    expect(calls).toHaveLength(2);
    expect((calls[0]?.init.headers as Record<string, string>)["authorization"]).toBe("Bearer secret-key");
    expect(JSON.parse(String(calls[1]?.init.body))).toEqual({
      model: "text-embedding-3-small",
      input: ["c", "d"],
      dimensions: 3,
    });
    expect(vectors).toHaveLength(4);
    expect(embedder.dimensions).toBe(3);
  });

  it("reports an HTTP error with its status and without the key", async () => {
    const { fetch } = recorder("{}", 401);
    const embedder = openAICompatibleEmbedder({ baseUrl: "http://x/v1", model: "m", apiKey: "secret-key", fetch });
    const failure = embedder.embed(["a"]);
    await expect(failure).rejects.toBeInstanceOf(EmbeddingRequestError);
    await expect(failure).rejects.toMatchObject({ status: 401 });
    await expect(failure).rejects.not.toThrow("secret-key");
  });

  it("refuses a body with no data array or a non-numeric embedding", async () => {
    await expect(
      openAICompatibleEmbedder({ baseUrl: "http://x/v1", model: "m", fetch: recorder("{}").fetch }).embed(["a"]),
    ).rejects.toThrow("has no data array");
    const bad = JSON.stringify({ data: [{ index: 0, embedding: ["x"] }] });
    await expect(
      openAICompatibleEmbedder({ baseUrl: "http://x/v1", model: "m", fetch: recorder(bad).fetch }).embed(["a"]),
    ).rejects.toThrow("is not a number array");
  });

  it("refuses a batch size that is not a positive integer", () => {
    expect(() => openAICompatibleEmbedder({ baseUrl: "http://x/v1", model: "m", batchSize: 0 })).toThrow(RangeError);
  });

  it("drives a Retriever end to end", async () => {
    const { fetch } = recorder();
    const retriever = new Retriever({
      embedder: openAICompatibleEmbedder({ baseUrl: "http://x/v1", model: "m", fetch }),
    });
    await retriever.add([
      { id: "one", text: "first" },
      { id: "two", text: "second" },
    ]);
    // The fixture answers every request the same way, so the query embeds to [0.1, 0.2, 0.3].
    const scored = await (async () => {
      const results = await retriever.store.query([0.1, 0.2, 0.3], { k: 2 });
      return results.map((result) => result.id);
    })();
    expect(scored).toEqual(["one", "two"]);
  });
});
