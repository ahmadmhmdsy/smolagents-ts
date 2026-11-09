import { describe, expect, it } from "vitest";
import type { ChatCompletion, ChatCompletionChunk, Model } from "@smolagents-ts/core";
import { CustomModel, FallbackModel, isRetryableModelError, type FallbackEvent } from "../src/index.js";
import { HttpError } from "../src/transport.js";

const USER = [{ role: "user" as const, content: "hi" }];

function answer(text: string): ChatCompletion {
  return { content: text, toolCalls: [], usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 }, finishReason: "stop" };
}

function failing(id: string, error: unknown, calls: string[]): CustomModel {
  return new CustomModel({
    id,
    capabilities: { toolCalls: true },
    generate: () => {
      calls.push(id);
      return Promise.reject(error);
    },
    // eslint-disable-next-line require-yield
    async *generateStream() {
      calls.push(id);
      throw error;
    },
  });
}

function working(id: string, calls: string[]): CustomModel {
  return new CustomModel({
    id,
    capabilities: { toolCalls: true },
    generate: () => {
      calls.push(id);
      return Promise.resolve(answer("from " + id));
    },
    async *generateStream() {
      calls.push(id);
      yield { delta: "from " };
      yield { delta: id, finishReason: "stop" };
    },
  });
}

async function drain(stream: AsyncIterable<ChatCompletionChunk>): Promise<string> {
  let text = "";
  for await (const chunk of stream) text += chunk.delta;
  return text;
}

function networkError(): TypeError {
  return new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
}

describe("isRetryableModelError", () => {
  it.each([408, 409, 429, 500, 502, 503, 529])("moves on HTTP %i", (status) => {
    expect(isRetryableModelError(new HttpError(status, "", "https://x"))).toBe(true);
  });

  it.each([400, 401, 403, 404, 413, 422])("does not move on HTTP %i", (status) => {
    expect(isRetryableModelError(new HttpError(status, "", "https://x"))).toBe(false);
  });

  it("moves on a network failure and a timeout", () => {
    expect(isRetryableModelError(networkError())).toBe(true);
    expect(isRetryableModelError(Object.assign(new Error("reset"), { code: "ECONNRESET" }))).toBe(true);
    expect(isRetryableModelError(new DOMException("timed out", "TimeoutError"))).toBe(true);
  });

  it("does not move on an abort or an error it cannot classify", () => {
    expect(isRetryableModelError(new DOMException("aborted", "AbortError"))).toBe(false);
    expect(isRetryableModelError(new Error("The model answered nonsense"))).toBe(false);
    expect(isRetryableModelError("a string")).toBe(false);
  });
});

describe("FallbackModel", () => {
  it("answers from the first model when it succeeds, without a move", async () => {
    const calls: string[] = [];
    const events: FallbackEvent[] = [];
    const model = new FallbackModel({
      models: [working("a", calls), working("b", calls)],
      onFallback: (event) => events.push(event),
    });
    expect((await model.generate(USER)).content).toBe("from a");
    expect(calls).toEqual(["a"]);
    expect(events).toEqual([]);
  });

  it("moves on a retryable failure and reports the move", async () => {
    const calls: string[] = [];
    const events: FallbackEvent[] = [];
    const first = failing("a", new HttpError(503, "busy", "https://a"), calls);
    const second = working("b", calls);
    const model = new FallbackModel({ models: [first, second], onFallback: (event) => events.push(event) });
    expect((await model.generate(USER)).content).toBe("from b");
    expect(calls).toEqual(["a", "b"]);
    expect(events).toHaveLength(1);
    expect(events[0]?.from).toBe(first);
    expect(events[0]?.to).toBe(second);
    expect(events[0]?.index).toBe(0);
    expect((events[0]?.error as HttpError).status).toBe(503);
  });

  it("does not move on another 4xx", async () => {
    const calls: string[] = [];
    const error = new HttpError(401, "bad key", "https://a");
    const model = new FallbackModel({ models: [failing("a", error, calls), working("b", calls)] });
    await expect(model.generate(USER)).rejects.toBe(error);
    expect(calls).toEqual(["a"]);
  });

  it("does not move once the caller's signal has aborted", async () => {
    const calls: string[] = [];
    const controller = new AbortController();
    const error = new DOMException("timed out", "TimeoutError");
    const first = new CustomModel({
      id: "a",
      generate: () => {
        calls.push("a");
        controller.abort();
        return Promise.reject(error);
      },
    });
    const model = new FallbackModel({ models: [first, working("b", calls)] });
    await expect(model.generate(USER, { signal: controller.signal })).rejects.toBe(error);
    expect(calls).toEqual(["a"]);
  });

  it("throws an AggregateError holding every failure when all models fail", async () => {
    const calls: string[] = [];
    const one = new HttpError(429, "", "https://a");
    const two = networkError();
    const model = new FallbackModel({ models: [failing("a", one, calls), failing("b", two, calls)] });
    const caught = await model.generate(USER).catch((error: unknown) => error);
    expect(caught).toBeInstanceOf(AggregateError);
    expect((caught as AggregateError).errors).toEqual([one, two]);
    expect((caught as AggregateError).message).toContain("a, b");
  });

  it("throws a later model's own non-retryable failure as it is", async () => {
    const calls: string[] = [];
    const fatal = new HttpError(400, "bad request", "https://b");
    const model = new FallbackModel({
      models: [failing("a", new HttpError(500, "", "https://a"), calls), failing("b", fatal, calls), working("c", calls)],
    });
    await expect(model.generate(USER)).rejects.toBe(fatal);
    expect(calls).toEqual(["a", "b"]);
  });

  it("honours a custom move rule", async () => {
    const calls: string[] = [];
    const model = new FallbackModel({
      models: [failing("a", new Error("quota"), calls), working("b", calls)],
      isRetryable: (error) => error instanceof Error && error.message === "quota",
    });
    expect((await model.generate(USER)).content).toBe("from b");
  });

  it("moves a stream that fails before its first chunk", async () => {
    const calls: string[] = [];
    const events: FallbackEvent[] = [];
    const model = new FallbackModel({
      models: [failing("a", networkError(), calls), working("b", calls)],
      onFallback: (event) => events.push(event),
    });
    expect(await drain(model.generateStream(USER))).toBe("from b");
    expect(calls).toEqual(["a", "b"]);
    expect(events).toHaveLength(1);
  });

  it("never moves a stream after its first chunk", async () => {
    const calls: string[] = [];
    const error = new HttpError(503, "", "https://a");
    const partial = new CustomModel({
      id: "a",
      generate: () => Promise.resolve(answer("unused")),
      async *generateStream() {
        calls.push("a");
        yield { delta: "half an ans" };
        throw error;
      },
    });
    const model = new FallbackModel({ models: [partial, working("b", calls)] });
    const seen: string[] = [];
    const run = (async () => {
      for await (const chunk of model.generateStream(USER)) seen.push(chunk.delta);
    })();
    await expect(run).rejects.toBe(error);
    expect(seen).toEqual(["half an ans"]);
    expect(calls).toEqual(["a"]);
  });

  it("reports the intersection of its members' capabilities", async () => {
    const calls: string[] = [];
    const vision = new CustomModel({
      id: "v",
      capabilities: { toolCalls: true, images: true },
      generate: () => Promise.resolve(answer("")),
      async *generateStream() {},
    });
    const model = new FallbackModel({ models: [vision, working("b", calls)] });
    expect(model.capabilities).toEqual({ streaming: true, toolCalls: true, images: false, audio: false });

    const noStream = new CustomModel({ id: "n", generate: () => Promise.resolve(answer("")) });
    const blocking = new FallbackModel({ models: [working("b", calls), noStream] });
    expect(blocking.capabilities.streaming).toBe(false);
    await expect(drain(blocking.generateStream(USER))).rejects.toThrow(/cannot stream/);
  });

  it("names itself after its members and refuses an empty list", () => {
    const calls: string[] = [];
    const model = new FallbackModel({ models: [working("a", calls), working("b", calls)] });
    expect(model.id).toBe("fallback(a,b)");
    expect(model.provider).toBe("fallback");
    expect(model.adapterVersion).toBe(2);
    expect(new FallbackModel({ id: "mine", models: [working("a", calls)] }).id).toBe("mine");
    expect(() => new FallbackModel({ models: [] as Model[] })).toThrow(/at least one/);
  });
});
