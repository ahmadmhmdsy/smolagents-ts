import { describe, expect, it } from "vitest";
import type { ActionOutcome } from "../src/agent/action.js";
import type { AgentEvent } from "../src/events.js";
import { type MiddlewareContext, composeMiddleware } from "../src/middleware.js";
import { AgentMemory } from "../src/memory/memory.js";
import { ActionStep } from "../src/memory/steps.js";

function context(): MiddlewareContext {
  return {
    runId: "run-1",
    task: "task",
    stepIndex: 0,
    step: new ActionStep("raw"),
    signal: new AbortController().signal,
    logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
    memory: new AgentMemory(),
    state: new Map<string, unknown>(),
  };
}

async function* terminal(): AsyncGenerator<AgentEvent, ActionOutcome> {
  yield { type: "step.started", stepIndex: 0 };
  yield { type: "logs.appended", stepIndex: 0, text: "hello" };
  return { observations: "hello", isFinalAnswer: false };
}

async function drain(gen: AsyncGenerator<AgentEvent, ActionOutcome>) {
  const events: AgentEvent[] = [];
  let next = await gen.next();
  while (!next.done) {
    events.push(next.value);
    next = await gen.next();
  }
  return { events, outcome: next.value };
}

describe("composeMiddleware", () => {
  it("calls the terminal when there is no middleware", async () => {
    const composed = composeMiddleware([])(context(), terminal);
    const { events, outcome } = await drain(composed);
    expect(events).toHaveLength(2);
    expect(outcome.observations).toBe("hello");
  });

  it("runs middleware as an onion, before and after", async () => {
    const order: string[] = [];
    const tag = (name: string) => async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      order.push("before " + name);
      const outcome = yield* next();
      order.push("after " + name);
      return outcome;
    };
    const composed = composeMiddleware([tag("outer"), tag("inner")])(context(), terminal);
    await drain(composed);
    expect(order).toEqual(["before outer", "before inner", "after inner", "after outer"]);
  });

  it("lets a middleware observe every event as it passes", async () => {
    const seen: string[] = [];
    const tap = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      for await (const event of next()) {
        seen.push(event.type);
        yield event;
      }
      return { observations: "intercepted", isFinalAnswer: false };
    };
    const composed = composeMiddleware([tap])(context(), terminal);
    const { events } = await drain(composed);
    expect(seen).toEqual(["step.started", "logs.appended"]);
    expect(events.map((e) => e.type)).toEqual(["step.started", "logs.appended"]);
  });

  it("lets a middleware short-circuit without calling next", async () => {
    // eslint-disable-next-line require-yield -- this middleware deliberately yields no events
    const veto = async function* (): AsyncGenerator<AgentEvent, ActionOutcome> {
      return { observations: "blocked by policy", isFinalAnswer: false };
    };
    const composed = composeMiddleware([veto])(context(), terminal);
    const { events, outcome } = await drain(composed);
    expect(events).toEqual([]);
    expect(outcome.observations).toBe("blocked by policy");
  });

  it("lets a middleware rewrite the outcome", async () => {
    const rewrite = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      const outcome = yield* next();
      return { ...outcome, observations: outcome.observations.toUpperCase() };
    };
    const composed = composeMiddleware([rewrite])(context(), terminal);
    const { outcome } = await drain(composed);
    expect(outcome.observations).toBe("HELLO");
  });

  it("throws when a middleware calls next twice", async () => {
    const greedy = async function* (
      _ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      await drain(next());
      return yield* next();
    };
    const composed = composeMiddleware([greedy])(context(), terminal);
    await expect(drain(composed)).rejects.toThrow(/twice/i);
  });

  it("shares one state map across the chain", async () => {
    const writer = async function* (
      ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      ctx.state.set("cost", 42);
      return yield* next();
    };
    const reader = async function* (
      ctx: MiddlewareContext,
      next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
    ): AsyncGenerator<AgentEvent, ActionOutcome> {
      expect(ctx.state.get("cost")).toBe(42);
      return yield* next();
    };
    const composed = composeMiddleware([writer, reader])(context(), terminal);
    await drain(composed);
  });

  it("propagates an error thrown by the terminal", async () => {
    const boom = async function* (): AsyncGenerator<AgentEvent, ActionOutcome> {
      throw new Error("executor exploded");
      yield { type: "run.cancelled" };
    };
    const composed = composeMiddleware([])(context(), boom);
    await expect(drain(composed)).rejects.toThrow("executor exploded");
  });
});
