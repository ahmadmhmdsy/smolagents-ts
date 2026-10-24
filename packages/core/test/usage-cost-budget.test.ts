import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import type { RunResult } from "../src/agent/run-result.js";
import {
  DEFAULT_PRICE_TABLE,
  PRICE_TABLE_DATE,
  deriveCost,
  findModelPrice,
  type ModelPrice,
} from "../src/monitoring/pricing.js";
import {
  createBudgetHandle,
  resolveBudget,
  spendCostBudget,
  RUN_LIMITS_CEILING,
} from "../src/session/budget.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { TokenUsage, ToolCallRequest } from "../src/types.js";

const noop = tool({
  name: "noop",
  description: "Do nothing.",
  inputSchema: z.object({}),
  execute: () => "ok",
});

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const usage = (input: number, output: number, extra: Partial<TokenUsage> = {}): TokenUsage => ({
  inputTokens: input,
  outputTokens: output,
  totalTokens: input + output,
  ...extra,
});

/** One published row, priced so the arithmetic is checkable by hand: $3 / $15 per MTok. */
const PRICED: ModelPrice = {
  provider: "mock",
  modelPrefix: "mock",
  currency: "USD",
  effectiveDate: "2026-01-01",
  inputPerMTokUsd: 3,
  cachedInputPerMTokUsd: 0.3,
  cacheWriteInputPerMTokUsd: 3.75,
  outputPerMTokUsd: 15,
  source: "https://example.test/prices",
};

function workTurn(total: number, id: string) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call("noop", {}, id)],
    usage: usage(1, total - 1),
  };
}

function answerTurn(total: number, id: string) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, id)],
    usage: usage(1, total - 1),
  };
}

async function drain(
  agent: ToolCallingAgent,
  task: string,
  options: { budget?: ReturnType<typeof createBudgetHandle> } = {},
): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task, options)) events.push(event);
  return events;
}

function completed(events: readonly AgentEvent[]): Extract<AgentEvent, { type: "run.completed" }> {
  const last = events.at(-1);
  if (last?.type !== "run.completed") throw new Error("the run did not complete: " + String(last?.type));
  return last;
}

function resultOf(events: readonly AgentEvent[]): RunResult {
  return completed(events).result as RunResult;
}

describe("prices and cost", () => {
  it("ships a dated table and finds a model by provider and longest prefix", () => {
    expect(DEFAULT_PRICE_TABLE.length).toBeGreaterThanOrEqual(3);
    expect(PRICE_TABLE_DATE).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    const gemini = findModelPrice({ provider: "google", model: "gemini-3.5-flash-lite" });
    expect(gemini?.effectiveDate).toBe(PRICE_TABLE_DATE);
    expect(gemini?.source).toMatch(/^https:\/\//);
    expect(findModelPrice({ provider: "google", model: "gemini-9" })).toBeUndefined();
    expect(findModelPrice({ provider: "nobody", model: "gemini-3.5-flash-lite" })).toBeUndefined();

    const longest = findModelPrice(
      { provider: "mock", model: "mock-2-pro", table: [PRICED, { ...PRICED, modelPrefix: "mock-2", inputPerMTokUsd: 9 }] },
    );
    expect(longest?.inputPerMTokUsd).toBe(9);
  });

  it("derives an exact decimal cost from the usage split", () => {
    const cost = deriveCost(
      { inputTokens: 1_000_000, cachedInputTokens: 400_000, cacheWriteInputTokens: 100_000, outputTokens: 500_000, totalTokens: 1_500_000 },
      { provider: "mock", model: "mock-1", table: [PRICED] },
    );
    // 500k uncached * $3 + 400k cached * $0.30 + 100k cache-write * $3.75 + 500k output * $15.
    expect(cost?.costUsd).toBe("9.495000");
    expect(cost?.microUsd).toBe(9_495_000);
    expect(cost?.basis).toMatchObject({
      currency: "USD",
      effectiveDate: "2026-01-01",
      uncachedInputTokens: 500_000,
      cachedInputTokens: 400_000,
      cacheWriteInputTokens: 100_000,
      outputTokens: 500_000,
    });
  });

  it("prices zero usage as zero and an unknown model as undefined", () => {
    const zero = deriveCost(
      { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      { provider: "mock", model: "mock-1", table: [PRICED] },
    );
    expect(zero?.costUsd).toBe("0.000000");
    expect(zero?.microUsd).toBe(0);
    expect(
      deriveCost({ inputTokens: 10, outputTokens: 5, totalTokens: 15 }, { provider: "mock", model: "other", table: [PRICED] }),
    ).toBeUndefined();
  });

  it("fails open on an unknown price: the run completes and reports no cost", async () => {
    const model = new MockModel({ responses: [answerTurn(11, "a")], id: "mock-unknown" });
    const agent = new ToolCallingAgent({ model, tools: [noop], limits: { maxCostUsd: 0.001 } });
    const events = await drain(agent, "finish");
    expect(events.at(-1)?.type).toBe("run.completed");
    const result = resultOf(events);
    expect(result.cost).toBeUndefined();
    expect(result.costBasis).toBe("unknown");
    expect(model.callCount).toBe(1);
  });

  it("stops before the next model call when the cost cap is crossed", async () => {
    const model = new MockModel({ responses: [workTurn(1000, "a"), answerTurn(11, "b")] });
    const agent = new ToolCallingAgent({ model, tools: [noop], limits: { maxCostUsd: 0.001 }, priceTable: [PRICED] });
    const events = await drain(agent, "work");
    // 1000 prompt tokens at $3/MTok cost $0.003, over the $0.001 the caller allowed.
    expect(events.at(-1)).toMatchObject({ type: "run.limitReached", reason: "limitCostUsd" });
    expect(model.callCount).toBe(1);
  });

  it("reports the run's cost and keeps one handle counting across runs", async () => {
    const model = new MockModel({ responses: [workTurn(1000, "a"), answerTurn(500, "b")] });
    const handle = createBudgetHandle({ maxCostUsd: 0.03 });
    const agent = new ToolCallingAgent({ model, tools: [noop], priceTable: [PRICED] });
    const events = await drain(agent, "work", { budget: handle });
    const result = resultOf(events);
    // Two prompt tokens at $3/MTok plus 1498 output tokens at $15/MTok, in integer micro-dollars.
    expect(result.cost?.costUsd).toBe("0.022476");
    expect(result.costBasis).toBe("table");
    expect(result.cost?.basis).toMatchObject({ uncachedInputTokens: 2, outputTokens: 1498 });
    expect(handle.budget.costMicroUsd).toBe(22_476);

    const next = new MockModel({ responses: [answerTurn(1000, "c")] });
    const second = new ToolCallingAgent({ model: next, tools: [noop], priceTable: [PRICED] });
    const secondEvents = await drain(second, "again", { budget: handle });
    expect(secondEvents.at(-1)).toMatchObject({ type: "run.limitReached", reason: "limitCostUsd" });
  });

  it("clamps the requested cost cap to the ceiling and spends micro-dollars", () => {
    expect(resolveBudget({ maxCostUsd: 1000 }).maxCostMicroUsd).toBe(RUN_LIMITS_CEILING.maxCostUsd * 1_000_000);
    const budget = resolveBudget({ maxCostUsd: 0.001 });
    expect(budget.maxCostMicroUsd).toBe(1000);
    expect(budget.costMicroUsd).toBe(0);
    expect(spendCostBudget(budget, 500)).toBeUndefined();
    expect(budget.costMicroUsd).toBe(500);
    expect(spendCostBudget(budget, 500)).toBe("limitCostUsd");
  });
});
