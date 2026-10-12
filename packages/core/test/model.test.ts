import { describe, expect, it } from "vitest";
import { collectCompletion } from "../src/model.js";
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
});
