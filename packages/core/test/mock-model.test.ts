import { describe, expect, it } from "vitest";
import { MockModel } from "../src/testing/mock-model.js";

describe("MockModel", () => {
  it("returns scripted responses in order", async () => {
    const model = new MockModel(["first", "second"]);
    expect((await model.generate([])).content).toBe("first");
    expect((await model.generate([])).content).toBe("second");
  });

  it("records every transcript it was given", async () => {
    const model = new MockModel(["ok"]);
    await model.generate([{ role: "user", content: "hello" }]);
    expect(model.calls).toHaveLength(1);
    expect(model.calls[0]).toEqual([{ role: "user", content: "hello" }]);
  });

  it("records a copy, so later mutation of the caller array does not leak in", async () => {
    const model = new MockModel(["ok"]);
    const messages = [{ role: "user" as const, content: "hello" }];
    await model.generate(messages);
    messages.push({ role: "user", content: "sneaky" });
    expect(model.calls[0]).toHaveLength(1);
  });

  it("fails loudly when the script is exhausted", async () => {
    const model = new MockModel(["only"]);
    await model.generate([]);
    await expect(model.generate([])).rejects.toThrow(/exhausted/i);
  });

  it("streams the response in chunks so delta handling is exercised", async () => {
    const model = new MockModel({ responses: ["abcdefghij"], chunkSize: 4 });
    const pieces: string[] = [];
    for await (const chunk of model.generateStream([])) pieces.push(chunk.delta);
    expect(pieces).toEqual(["abcd", "efgh", "ij"]);
    expect(pieces.join("")).toBe("abcdefghij");
  });

  it("returns the whole response in one chunk by default", async () => {
    const model = new MockModel(["whole"]);
    const pieces: string[] = [];
    for await (const chunk of model.generateStream([])) pieces.push(chunk.delta);
    expect(pieces).toEqual(["whole"]);
  });

  it("supports scripted tool calls", async () => {
    const model = new MockModel([
      { content: "", toolCalls: [{ id: "c1", name: "get_weather", arguments: '{"city":"Paris"}' }], finishReason: "tool_calls" },
    ]);
    const completion = await model.generate([]);
    expect(completion.toolCalls).toHaveLength(1);
    expect(completion.finishReason).toBe("tool_calls");
  });

  it("counts one response per generate and per generateStream call", async () => {
    const model = new MockModel(["a", "b"]);
    await model.generate([]);
    for await (const _ of model.generateStream([])) { /* consume */ }
    expect(model.callCount).toBe(2);
    await expect(model.generate([])).rejects.toThrow(/exhausted/i);
  });

  it("reports mock capabilities and identifiers", () => {
    const model = new MockModel(["x"]);
    expect(model.provider).toBe("mock");
    expect(model.id).toBe("mock");
    expect(model.capabilities.toolCalls).toBe(true);
  });
});
