import { describe, expect, it } from "vitest";
import { addTokenUsage, EMPTY_TOKEN_USAGE } from "../src/types.js";
import type { ChatMessage, ToolCallRequest } from "../src/types.js";

describe("token usage arithmetic", () => {
  it("starts empty", () => {
    expect(EMPTY_TOKEN_USAGE).toEqual({ inputTokens: 0, outputTokens: 0, totalTokens: 0 });
  });

  it("adds two usages field by field", () => {
    const a = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    const b = { inputTokens: 1, outputTokens: 2, totalTokens: 3 };
    expect(addTokenUsage(a, b)).toEqual({ inputTokens: 11, outputTokens: 7, totalTokens: 18 });
  });

  it("is not mutated by adding", () => {
    const a = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };
    addTokenUsage(a, EMPTY_TOKEN_USAGE);
    expect(a.inputTokens).toBe(10);
  });
});

describe("ChatMessage", () => {
  it("carries the tool calls an assistant turn asked for", () => {
    const call: ToolCallRequest = { id: "call_1", name: "search", arguments: '{"q":"x"}' };
    const message: ChatMessage = { role: "assistant", content: "", toolCalls: [call] };
    expect(message.toolCalls?.[0]?.name).toBe("search");
  });
});
