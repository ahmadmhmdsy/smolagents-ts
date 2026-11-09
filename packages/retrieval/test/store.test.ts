import { describe, expect, it } from "vitest";
import { EmbeddingDimensionError, InMemoryVectorStore, hashingEmbedder, normalize } from "../src/index.js";

const doc = (id: string, text = id, metadata?: Record<string, string | number | boolean>) =>
  metadata === undefined ? { id, text } : { id, text, metadata };

describe("hashingEmbedder", () => {
  it("returns the same unit-length vector for the same text", async () => {
    const embedder = hashingEmbedder({ dimensions: 64 });
    const [a, b] = await embedder.embed(["The cat sat", "the CAT sat!"]);
    expect(a).toHaveLength(64);
    expect(a).toEqual(b);
    const length = Math.sqrt((a ?? []).reduce((sum, value) => sum + value * value, 0));
    expect(length).toBeCloseTo(1, 10);
    expect(embedder.id).toBe("hashing-64");
    expect(embedder.dimensions).toBe(64);
  });

  it("scores texts that share words above texts that share none", async () => {
    const embedder = hashingEmbedder();
    const [query, near, far] = await embedder.embed([
      "refund policy for damaged goods",
      "our refund policy covers damaged goods within 30 days",
      "the office opens at nine on weekdays",
    ]);
    const dot = (x: number[] = [], y: number[] = []) => x.reduce((sum, value, index) => sum + value * (y[index] ?? 0), 0);
    expect(dot(query, near)).toBeGreaterThan(dot(query, far));
  });

  it("gives an empty text the zero vector and handles letters outside ASCII", async () => {
    const embedder = hashingEmbedder({ dimensions: 64 });
    const [empty, arabic] = await embedder.embed(["  ...  ", "مرحبا بالعالم"]);
    expect(empty).toEqual(new Array(64).fill(0));
    expect((arabic ?? []).some((value) => value !== 0)).toBe(true);
  });

  it("refuses a dimension that is not a positive integer, and an aborted signal", async () => {
    expect(() => hashingEmbedder({ dimensions: 0 })).toThrow(RangeError);
    expect(() => hashingEmbedder({ dimensions: 1.5 })).toThrow(RangeError);
    const controller = new AbortController();
    controller.abort(new Error("stop"));
    await expect(hashingEmbedder().embed(["x"], { signal: controller.signal })).rejects.toThrow("stop");
  });

  it("normalize leaves a zero vector alone", () => {
    expect(normalize([0, 0])).toEqual([0, 0]);
    expect(normalize([3, 4])).toEqual([0.6, 0.8]);
  });
});

describe("InMemoryVectorStore", () => {
  it("ranks by cosine similarity and honours k", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { document: doc("a"), vector: [1, 0] },
      { document: doc("b"), vector: [0.7, 0.7] },
      { document: doc("c"), vector: [0, 1] },
    ]);
    const results = await store.query([1, 0], { k: 2 });
    expect(results.map((result) => result.id)).toEqual(["a", "b"]);
    expect(results[0]?.score).toBeCloseTo(1, 10);
    expect(store.size).toBe(3);
  });

  it("breaks ties by id so the order is stable", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { document: doc("z"), vector: [1, 0] },
      { document: doc("m"), vector: [1, 0] },
      { document: doc("a"), vector: [2, 0] },
    ]);
    expect((await store.query([1, 0], { k: 3 })).map((result) => result.id)).toEqual(["a", "m", "z"]);
  });

  it("filters on metadata equality", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([
      { document: doc("a", "a", { lang: "en", year: 2026 }), vector: [1, 0] },
      { document: doc("b", "b", { lang: "ar", year: 2026 }), vector: [1, 0] },
      { document: doc("c"), vector: [1, 0] },
    ]);
    const results = await store.query([1, 0], { k: 5, filter: { lang: "ar", year: 2026 } });
    expect(results.map((result) => result.id)).toEqual(["b"]);
  });

  it("replaces a record with the same id and deletes by id", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([{ document: doc("a", "old"), vector: [1, 0] }]);
    await store.upsert([{ document: doc("a", "new"), vector: [1, 0] }]);
    expect(store.size).toBe(1);
    expect((await store.query([1, 0], { k: 1 }))[0]?.text).toBe("new");
    await store.delete(["a", "unknown"]);
    expect(store.size).toBe(0);
    expect(await store.query([1, 0], { k: 1 })).toEqual([]);
  });

  it("refuses a vector of another dimension, on upsert and on query, and stores nothing from a bad batch", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([{ document: doc("a"), vector: [1, 0] }]);
    const upsert = store.upsert([
      { document: doc("b"), vector: [1, 0] },
      { document: doc("c"), vector: [1, 0, 0] },
    ]);
    await expect(upsert).rejects.toBeInstanceOf(EmbeddingDimensionError);
    await expect(upsert).rejects.toThrow("expected 2, got 3");
    expect(store.size).toBe(1);
    await expect(store.query([1, 0, 0], { k: 1 })).rejects.toBeInstanceOf(EmbeddingDimensionError);
  });

  it("forgets the dimension once emptied", async () => {
    const store = new InMemoryVectorStore();
    await store.upsert([{ document: doc("a"), vector: [1, 0] }]);
    await store.delete(["a"]);
    await store.upsert([{ document: doc("b"), vector: [1, 0, 0] }]);
    expect(store.size).toBe(1);
  });
});
