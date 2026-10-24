import { describe, expect, it } from "vitest";
import { ToolCallAccumulator, collectCompletion, modelCapabilities } from "../src/model.js";
import { EMPTY_TOKEN_USAGE } from "../src/types.js";
import type { ChatCompletionChunk } from "../src/model.js";

async function* from(chunks: ChatCompletionChunk[]): AsyncIterable<ChatCompletionChunk> {
  for (const chunk of chunks) yield chunk;
}

describe("collectCompletion", () => {
  it("joins text deltas", async () => {
    const completion = await collectCompletion(from([{ delta: "Hel" }, { delta: "lo" }]));
    expect(completion.content).toBe("Hello");
  });

  it("returns an empty completion for an empty stream", async () => {
    const completion = await collectCompletion(from([]));
    expect(completion.content).toBe("");
    expect(completion.toolCalls).toEqual([]);
    expect(completion.finishReason).toBe("stop");
  });

  it("reassembles a tool call split across chunks", async () => {
    const completion = await collectCompletion(
      from([
        { delta: "", toolCallDelta: { index: 0, id: "call_1", name: "get_weather", argumentsDelta: '{"ci' } },
        { delta: "", toolCallDelta: { index: 0, argumentsDelta: 'ty":"Paris"}' } },
      ]),
    );
    expect(completion.toolCalls).toEqual([
      { id: "call_1", name: "get_weather", arguments: '{"city":"Paris"}' },
    ]);
  });

  it("keeps interleaved tool calls apart and in index order", async () => {
    const completion = await collectCompletion(
      from([
        { delta: "", toolCallDelta: { index: 1, id: "b", name: "second", argumentsDelta: "{}" } },
        { delta: "", toolCallDelta: { index: 0, id: "a", name: "first", argumentsDelta: "{}" } },
      ]),
    );
    expect(completion.toolCalls.map((c) => c.name)).toEqual(["first", "second"]);
  });

  it("carries the finish reason from the last chunk that set one", async () => {
    const completion = await collectCompletion(
      from([{ delta: "x", finishReason: "tool_calls" }, { delta: "y" }]),
    );
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("passes the supplied usage through", async () => {
    const usage = { inputTokens: 3, outputTokens: 4, totalTokens: 7 };
    const completion = await collectCompletion(from([{ delta: "x" }]), usage);
    expect(completion.usage).toEqual(usage);
  });

  it("does not hand out the shared empty usage by reference", async () => {
    const completion = await collectCompletion(from([]));
    (completion.usage as { inputTokens: number }).inputTokens = 999;
    expect(EMPTY_TOKEN_USAGE.inputTokens).toBe(0);
    expect((await collectCompletion(from([]))).usage.inputTokens).toBe(0);
  });

  it("takes the usage a stream reports when the caller supplies none", async () => {
    const completion = await collectCompletion(
      from([{ delta: "x" }, { delta: "", usage: { inputTokens: 7, outputTokens: 2, totalTokens: 9 } }]),
    );
    expect(completion.usage).toEqual({ inputTokens: 7, outputTokens: 2, totalTokens: 9 });
  });

  it("prefers the caller's usage over the stream's", async () => {
    const supplied = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };
    const completion = await collectCompletion(
      from([{ delta: "x", usage: { inputTokens: 9, outputTokens: 9, totalTokens: 18 } }]),
      supplied,
    );
    expect(completion.usage).toEqual(supplied);
  });

  it("accumulates streamed tool-call deltas by index", () => {
    const accumulator = new ToolCallAccumulator();
    accumulator.accept({ index: 0, id: "call_a", name: "add", argumentsDelta: '{"a":' });
    accumulator.accept({ index: 0, argumentsDelta: "2}" });
    accumulator.accept({ index: 1, id: "call_b", name: "mul", argumentsDelta: "{}" });

    expect(accumulator.finish()).toEqual([
      { id: "call_a", name: "add", arguments: '{"a":2}' },
      { id: "call_b", name: "mul", arguments: "{}" },
    ]);
  });

  it("does not alias the usage object it was given", async () => {
    const usage = { inputTokens: 3, outputTokens: 4, totalTokens: 7 };
    const completion = await collectCompletion(from([{ delta: "x" }]), usage);
    (completion.usage as { inputTokens: number }).inputTokens = 999;
    expect(usage.inputTokens).toBe(3);
  });

  it("propagates a mid-stream failure instead of returning partial state", async () => {
    async function* boom(): AsyncIterable<ChatCompletionChunk> {
      yield { delta: "par" };
      throw new Error("mid-stream-boom");
    }
    await expect(collectCompletion(boom())).rejects.toThrow("mid-stream-boom");
  });

  it("reports the default capabilities, and their overrides", () => {
    expect(modelCapabilities()).toEqual({ streaming: true, toolCalls: false, images: false });
    expect(modelCapabilities({ toolCalls: true })).toEqual({ streaming: true, toolCalls: true, images: false });
  });
});