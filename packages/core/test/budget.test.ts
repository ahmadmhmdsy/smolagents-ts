import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentEvent } from "../src/events.js";
import {
  RUN_LIMITS_CEILING,
  budgetSeedFromSteps,
  createBudgetHandle,
  resolveBudget,
  spendBudget,
} from "../src/session/budget.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

const noop = tool({
  name: "noop",
  description: "Do nothing.",
  inputSchema: z.object({}),
  execute: () => "ok",
});

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const usage = (total: number) => ({ inputTokens: 1, outputTokens: total - 1, totalTokens: total });

function workTurn(total: number, id: string) {
  return { content: "", finishReason: "tool_calls" as const, toolCalls: [call("noop", {}, id)], usage: usage(total) };
}

function answerTurn(total: number, id: string) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "done" }, id)],
    usage: usage(total),
  };
}

function agentWith(turns: readonly object[], limits: { maxTurns?: number; maxOutputTokens?: number; maxTotalTokens?: number }, store?: MemoryRunStore) {
  return new ToolCallingAgent({
    model: new MockModel(turns as never),
    tools: [noop],
    limits,
    ...(store === undefined ? {} : { store }),
  });
}

async function drain(agent: ToolCallingAgent, task: string, options: { reset?: boolean; runId?: string; budget?: ReturnType<typeof createBudgetHandle> } = {}) {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task, options)) events.push(event);
  return events;
}

describe("the run budget", () => {
  it("clamps every requested limit to the deployment ceiling", () => {
    const budget = resolveBudget({
      maxTurns: 10_000,
      maxOutputTokens: RUN_LIMITS_CEILING.maxOutputTokens + 1,
      maxTotalTokens: 50,
    });
    expect(budget.maxTurns).toBe(RUN_LIMITS_CEILING.maxTurns);
    expect(budget.maxOutputTokens).toBe(RUN_LIMITS_CEILING.maxOutputTokens);
    expect(budget.maxTotalTokens).toBe(50);
    expect(budget.turns).toBe(0);
  });

  it("refuses a limit that is not a positive finite number", () => {
    expect(() => resolveBudget({ maxTurns: 0 })).toThrow(RangeError);
    expect(() => resolveBudget({ maxTotalTokens: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it("names the limit one spent turn crosses", () => {
    const turns = resolveBudget({ maxTurns: 1 });
    expect(spendBudget(turns, usage(3))).toBe("limitTurns");

    const output = resolveBudget({ maxOutputTokens: 4 });
    expect(spendBudget(output, usage(5))).toBe("limitOutputTokens");

    const total = resolveBudget({ maxTotalTokens: 2 });
    expect(spendBudget(total, usage(2))).toBe("limitTotalTokens");

    const roomy = resolveBudget({ maxTotalTokens: 100 });
    expect(spendBudget(roomy, usage(2))).toBeUndefined();
  });

  it("seeds a resumed budget from the steps the record already holds", () => {
    const seed = budgetSeedFromSteps([
      { tokenUsage: usage(3) },
      { tokenUsage: usage(4) },
    ] as never);
    expect(seed).toEqual({ turns: 2, outputTokens: 5, totalTokens: 7 });
  });

  it("ends the run on the total-token limit with the typed reason", async () => {
    const agent = agentWith([workTurn(2, "c1"), answerTurn(2, "c2")], { maxTotalTokens: 2 });

    const events = await drain(agent, "spend the budget");

    expect(events.at(-1)).toEqual({ type: "run.limitReached", reason: "limitTotalTokens" });
    expect(events.some((event) => event.type === "run.completed")).toBe(false);
  });

  it("keeps counting across calls that share the handle and reports the limit", async () => {
    const budget = createBudgetHandle({ maxTotalTokens: 5 });
    const first = agentWith([workTurn(2, "c1"), answerTurn(2, "c2")], { maxTotalTokens: 5 });

    const firstEvents = await drain(first, "work", { budget });
    expect(firstEvents.at(-1)?.type).toBe("run.completed");
    expect(budget.budget.totalTokens).toBe(4);
    const completed = firstEvents.at(-1);
    expect(completed?.type === "run.completed" ? completed.result.budget?.totalTokens : undefined).toBe(4);

    const second = agentWith([workTurn(2, "c3")], { maxTotalTokens: 5 });
    const secondEvents = await drain(second, "keep working", { budget });

    expect(secondEvents.at(-1)).toEqual({ type: "run.limitReached", reason: "limitTotalTokens" });
    expect(budget.budget.totalTokens).toBe(6);
  });

  it("does not reset the counters when a run resumes a record", async () => {
    const store = new MemoryRunStore();
    const first = agentWith([workTurn(2, "c1"), answerTurn(2, "c2")], { maxTotalTokens: 10 }, store);
    const firstEvents = await drain(first, "work", { runId: "run" });
    expect(firstEvents.at(-1)?.type).toBe("run.completed");

    const model = new MockModel([workTurn(2, "c3"), answerTurn(2, "c4")]);
    const resumed = new ToolCallingAgent({
      model,
      tools: [noop],
      limits: { maxTotalTokens: 3 },
      store,
    });
    const events = await drain(resumed, "continue", { reset: false, runId: "run" });

    expect(events.at(-1)).toEqual({ type: "run.limitReached", reason: "limitTotalTokens" });
    expect(model.callCount).toBe(0);
  });
});
