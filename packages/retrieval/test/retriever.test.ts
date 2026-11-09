import { FINAL_ANSWER_TOOL_NAME, MockModel, ToolCallingAgent, type ToolCallRequest } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import {
  CONTEXT_HEADING,
  EmbeddingCountError,
  type Embedder,
  Retriever,
  formatContext,
  hashingEmbedder,
} from "../src/index.js";

const PASSAGES = [
  { id: "refunds", text: "Refunds are issued within 30 days for damaged goods.", metadata: { topic: "billing" } },
  { id: "hours", text: "The office opens at nine on weekdays.", metadata: { topic: "office" } },
  { id: "shipping", text: "Shipping is free on orders over 50 dollars.", metadata: { topic: "billing" } },
];

async function filled(options: Partial<ConstructorParameters<typeof Retriever>[0]> = {}): Promise<Retriever> {
  const retriever = new Retriever({ embedder: hashingEmbedder(), ...options });
  await retriever.add(PASSAGES);
  return retriever;
}

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function turn(...calls: ToolCallRequest[]) {
  return { content: "", finishReason: "tool_calls" as const, toolCalls: calls };
}

function userText(model: MockModel, callIndex: number): string {
  const messages = model.calls[callIndex] ?? [];
  const user = messages.find((message) => message.role === "user");
  const content = user?.content;
  if (typeof content === "string") return content;
  return (content ?? []).map((part) => (part.type === "text" ? part.text : "")).join("\n");
}

describe("Retriever", () => {
  it("finds the passage that shares the query's words first", async () => {
    const retriever = await filled();
    const results = await retriever.retrieve("how do refunds work for damaged goods", { k: 2 });
    expect(results[0]?.id).toBe("refunds");
    expect(results).toHaveLength(2);
  });

  it("passes the filter to the store and drops results under minScore", async () => {
    const retriever = await filled({ minScore: 0.2 });
    const filtered = await retriever.retrieve("office hours weekdays", { filter: { topic: "billing" } });
    expect(filtered.every((result) => result.metadata?.["topic"] === "billing")).toBe(true);
    expect(filtered.every((result) => result.score >= 0.2)).toBe(true);
  });

  it("embeds in batches and refuses an embedder that returns the wrong count", async () => {
    const sizes: number[] = [];
    const counting: Embedder = {
      id: "counting",
      embed(texts) {
        sizes.push(texts.length);
        return hashingEmbedder({ dimensions: 16 }).embed(texts);
      },
    };
    await filled({ embedder: counting, batchSize: 2 });
    expect(sizes).toEqual([2, 1]);

    const short: Embedder = { id: "short", embed: () => Promise.resolve([[1, 0]]) };
    const retriever = new Retriever({ embedder: short });
    const added = retriever.add(PASSAGES.slice(0, 2));
    await expect(added).rejects.toBeInstanceOf(EmbeddingCountError);
    await expect(added).rejects.toThrow("Embedder short returned 1 vectors for 2 texts.");
    const none: Embedder = { id: "none", embed: () => Promise.resolve([]) };
    await expect(new Retriever({ embedder: none }).retrieve("x")).rejects.toBeInstanceOf(EmbeddingCountError);
  });

  it("removes passages by id", async () => {
    const retriever = await filled();
    await retriever.remove(["refunds"]);
    const results = await retriever.retrieve("refunds damaged goods", { k: 3 });
    expect(results.map((result) => result.id)).not.toContain("refunds");
  });

  it("formats a numbered block under the heading, within maxChars", async () => {
    const retriever = await filled();
    const block = await retriever.context("refunds damaged goods", { k: 1 });
    expect(block.startsWith(CONTEXT_HEADING + "\n\n[1] refunds (score ")).toBe(true);
    expect(block.endsWith(PASSAGES[0]?.text ?? "")).toBe(true);
  });

  it("leaves out passages that do not fit and cuts a first passage longer than the cap", () => {
    const results = [
      { id: "a", text: "x".repeat(40), score: 0.9 },
      { id: "b", text: "y".repeat(40), score: 0.8 },
    ];
    const roomForOne = CONTEXT_HEADING.length + 80;
    const one = formatContext(results, roomForOne);
    expect(one).toContain("[1] a");
    expect(one).not.toContain("[2] b");
    expect(one.length).toBeLessThanOrEqual(roomForOne);

    const tiny = formatContext(results, CONTEXT_HEADING.length + 10);
    expect(tiny).toHaveLength(CONTEXT_HEADING.length + 10);
    expect(formatContext([], 100)).toBe("");
  });

  it("augments a string task, a parts task, and leaves a task with no match alone", async () => {
    const retriever = await filled();
    const augmented = await retriever.augment("Are refunds issued for damaged goods?");
    expect(typeof augmented).toBe("string");
    expect(augmented as string).toContain("[1] refunds");
    expect((augmented as string).endsWith("Are refunds issued for damaged goods?")).toBe(true);

    const parts = await retriever.augment([{ type: "text", text: "refund damaged goods" }], { k: 1 });
    expect(Array.isArray(parts)).toBe(true);
    expect(parts).toHaveLength(2);
    const lead = (parts as readonly { type: string; text?: string }[])[0];
    expect(lead?.type).toBe("text");
    expect(lead?.text?.startsWith(CONTEXT_HEADING)).toBe(true);

    const empty = new Retriever({ embedder: hashingEmbedder() });
    expect(await empty.augment("anything")).toBe("anything");
    const strict = await filled({ minScore: 0.99 });
    expect(await strict.augment("zebra quantum")).toBe("zebra quantum");
  });

  it("uses an explicit query for augment when given one", async () => {
    const retriever = await filled();
    const augmented = (await retriever.augment("Answer briefly.", { query: "office opens weekdays", k: 1 })) as string;
    expect(augmented).toContain("[1] hours");
  });

  it("reaches the model as part of the first user turn, with no agent change", async () => {
    const retriever = await filled();
    const model = new MockModel([turn(call(FINAL_ANSWER_TOOL_NAME, { answer: "30 days" }, "a"))]);
    const agent = new ToolCallingAgent({ model });
    const result = await agent.run(await retriever.augment("Are refunds issued for damaged goods?"));
    expect(result.output).toBe("30 days");
    const sent = userText(model, 0);
    expect(sent).toContain(CONTEXT_HEADING);
    expect(sent).toContain("Refunds are issued within 30 days");
  });

  it("answers as a tool the agent calls, then the model sees the passages", async () => {
    const retriever = await filled();
    const model = new MockModel([
      turn(call("retrieve", { query: "shipping orders" }, "r1")),
      turn(call(FINAL_ANSWER_TOOL_NAME, { answer: "free over 50" }, "a")),
    ]);
    const agent = new ToolCallingAgent({ model, tools: [retriever.asTool()] });
    const result = await agent.run("Is shipping free?");
    expect(result.output).toBe("free over 50");
    const second = JSON.stringify(model.calls[1] ?? []);
    expect(second).toContain("Shipping is free on orders over 50 dollars.");
  });

  it("names the tool as asked and says so when nothing matched", async () => {
    const retriever = new Retriever({ embedder: hashingEmbedder() });
    const lookup = retriever.asTool({ name: "lookup_docs", description: "Look things up." });
    expect(lookup.name).toBe("lookup_docs");
    expect(lookup.toSpec().description).toBe("Look things up.");
    expect(lookup.idempotent).toBe(true);
    const controller = new AbortController();
    const answer = await lookup.execute(
      { query: "anything" },
      {
        signal: controller.signal,
        fetch: globalThis.fetch,
        callId: "c",
        stepIndex: 0,
        logger: { debug() {}, info() {}, warn() {}, error() {} } as never,
      },
    );
    expect(answer).toBe("No passages matched the query.");
  });
});
