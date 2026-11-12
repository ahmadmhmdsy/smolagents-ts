/**
 * A provider replay token on a tool call (Gemini's `thoughtSignature`) must reach the next turn
 * unchanged, or the provider rejects the request; and it must survive the run record, so a
 * resumed run replays it too.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  FINAL_ANSWER_TOOL_NAME,
  MemoryRunStore,
  MockModel,
  ToolCallingAgent,
  tool,
} from "../src/index.js";
import { translateRecord } from "../src/session/run-store.js";

const add = tool({
  name: "add",
  description: "Add two integers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

describe("a tool call's provider signature", () => {
  it("is sent back on the next turn and kept on the run record", async () => {
    const model = new MockModel([
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [{ id: "c-1", name: "add", arguments: '{"a":2,"b":3}', signature: "sig-1" }],
      },
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [{ id: "c-2", name: FINAL_ANSWER_TOOL_NAME, arguments: '{"answer":5}' }],
      },
    ]);
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model, tools: [add], store });

    const result = await agent.run("add", { runId: "signed" });

    expect(result.output).toBe(5);
    const replayed = model.calls[1]?.find((message) => message.toolCalls !== undefined);
    expect(replayed?.toolCalls).toEqual([
      { id: "c-1", name: "add", arguments: '{"a":2,"b":3}', signature: "sig-1" },
    ]);
    // The record keeps the action step's calls as they were made, the token among them.
    expect(JSON.stringify(translateRecord(store.load("signed")!))).toContain('"signature":"sig-1"');
  });
});
