import { describe, expect, it } from "vitest";
import type { InterpretedAction } from "../src/agent/action.js";
import { MultiStepAgent, type AgentOptions, type RunContext } from "../src/agent/multi-step-agent.js";
import { AgentCancelledError, AgentMaxStepsError } from "../src/errors.js";
import type { AgentEvent } from "../src/events.js";
import type { ActionOutcome } from "../src/agent/action.js";
import type { CodeExecutor } from "../src/executor.js";
import type { ChatCompletion } from "../src/model.js";
import { ActionStep } from "../src/memory/steps.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { extractCodeBlock } from "../src/utils/parse-code-blocks.js";

function fenced(code: string): string {
  return "Thought: working.\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

class TestAgent extends MultiStepAgent<string> {
  constructor(
    private readonly executor: CodeExecutor,
    options: AgentOptions,
  ) {
    super(options);
  }

  protected override buildSystemPrompt(): string {
    return "You are a test agent.";
  }

  protected override interpret(completion: ChatCompletion): InterpretedAction {
    const code = extractCodeBlock(completion.content);
    if (code === null) return { kind: "empty", raw: completion.content };
    return { kind: "code", raw: completion.content, code };
  }

  // eslint-disable-next-line require-yield -- TestAgent's action executor never yields events; the base class requires a generator.
  protected override async *executeAction(
    action: InterpretedAction,
    _step: ActionStep,
    context: RunContext,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    if (action.code === undefined) return { observations: "", isFinalAnswer: false };
    const result = await this.executor.execute(action.code, {
      tools: this.tools,
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: context.signal,
      timeoutMs: this.executionTimeoutMs,
      stepIndex: context.stepIndex,
      logger: this.logger,
    });
    return {
      observations: result.logs,
      isFinalAnswer: result.isFinalAnswer,
      value: result.value,
      error: result.error,
    };
  }
}

/** Streaming is off in every shipped agent, so a test subclass is the only way in. */
class StreamingTestAgent extends TestAgent {
  protected override get prefersStreaming(): boolean {
    return true;
  }
}

function buildAgent(options: {
  responses: string[];
  results?: Record<string, ReturnType<typeof finalAnswerResult>>;
  agent?: Partial<AgentOptions>;
}) {
  const model = new MockModel(options.responses);
  const executor = new ScriptedExecutor({ results: options.results ?? {} });
  const agent = new TestAgent(executor, { model, ...options.agent });
  return { model, executor, agent };
}

async function collect(agent: TestAgent, task: string): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task)) events.push(event);
  return events;
}

function types(events: AgentEvent[]): string[] {
  return events.map((event) => event.type);
}

describe("MultiStepAgent", () => {
  it("runs one action, then finishes on the executor's final answer", async () => {
    const { agent } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "computing", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4, "answered"),
      },
    });
    const result = await agent.run("What is 2 + 2?");
    expect(result.output).toBe(4);
    expect(result.state).toBe("success");
    expect(result.steps.filter((step) => step.kind === "action")).toHaveLength(2);
  });

  it("emits the documented event sequence", async () => {
    const { agent } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "computing", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4, "answered"),
      },
    });
    const events = await collect(agent, "Q");
    expect(types(events)).toEqual([
      "run.started",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "run.completed",
    ]);
  });

  it("records the task and the system prompt in memory, in order", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")], results: { "final_answer(1)": finalAnswerResult(1) } });
    const result = await agent.run("the task");
    expect(result.steps[0]?.kind).toBe("task");
    expect(result.steps[1]?.kind).toBe("system_prompt");
    expect(result.messages[0]).toEqual({ role: "system", content: "You are a test agent." });
    expect(result.messages[1]).toEqual({ role: "user", content: "the task" });
  });

  it("feeds each observation back into the next transcript", async () => {
    const { agent, model } = buildAgent({
      responses: [fenced("compute()"), fenced("final_answer(4)")],
      results: {
        "compute()": { logs: "42", isFinalAnswer: false, durationMs: 1, toolCallCount: 0 },
        "final_answer(4)": finalAnswerResult(4),
      },
    });
    await agent.run("Q");
    const secondTranscript = model.calls[1] ?? [];
    expect(secondTranscript.at(-1)).toEqual({ role: "user", content: "Observation:\n42" });
  });

  it("answers directly when the model calls final_answer in its first action", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(7)")], results: { "final_answer(7)": finalAnswerResult(7) } });
    const events = await collect(agent, "Q");
    expect(types(events).filter((type) => type === "step.started")).toHaveLength(1);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("stops at maxSteps and reports it", async () => {
    const { agent } = buildAgent({
      responses: [fenced("a()"), fenced("b()")],
      results: {
        "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
        "b()": { logs: "b", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
      },
      agent: { maxSteps: 2 },
    });
    const events = await collect(agent, "Q");
    expect(events.at(-1)).toEqual({ type: "run.maxStepsReached", steps: 2 });
  });

  it("throws AgentMaxStepsError from run()", async () => {
    const { agent } = buildAgent({
      responses: [fenced("a()")],
      results: { "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 } },
      agent: { maxSteps: 1 },
    });
    await expect(agent.run("Q")).rejects.toBeInstanceOf(AgentMaxStepsError);
  });

  it("turns a model reply with no code block into an observation and keeps going", async () => {
    const { agent } = buildAgent({
      responses: ["I am only thinking out loud.", fenced("final_answer(3)")],
      results: { "final_answer(3)": finalAnswerResult(3) },
    });
    const events = await collect(agent, "Q");
    const observation = events.find((event) => event.type === "observation.completed");
    expect(observation).toMatchObject({ isFinalAnswer: false });
    expect((observation as { text: string }).text).toMatch(/no action found/i);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("cancels before the first step when the signal is already aborted", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")] });
    const controller = new AbortController();
    controller.abort();
    const events: AgentEvent[] = [];
    for await (const event of agent.stream("Q", { signal: controller.signal })) events.push(event);
    expect(types(events)).toEqual(["run.started", "run.cancelled"]);
  });

  it("throws AgentCancelledError from run() when aborted mid-run", async () => {
    const controller = new AbortController();
    const { agent } = buildAgent({
      responses: [fenced("a()"), fenced("final_answer(1)")],
      results: { "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 } },
      agent: { middleware: [attachingAbort(controller)] },
    });
    await expect(agent.run("Q", { signal: controller.signal })).rejects.toBeInstanceOf(AgentCancelledError);
  });

  it("accumulates token usage across steps", async () => {
    const model = new MockModel([
      { content: fenced("a()"), usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 } },
      { content: fenced("final_answer(1)"), usage: { inputTokens: 20, outputTokens: 3, totalTokens: 23 } },
    ]);
    const executor = new ScriptedExecutor({
      results: {
        "a()": { logs: "a", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 },
        "final_answer(1)": finalAnswerResult(1),
      },
    });
    const agent = new TestAgent(executor, { model });
    const result = await agent.run("Q");
    expect(result.tokenUsage).toEqual({ inputTokens: 30, outputTokens: 5, totalTokens: 35 });
  });

  it("keeps a streamed turn's usage and still emits exactly one usage.updated", async () => {
    const model = new MockModel({
      responses: [
        {
          content: fenced("final_answer(1)"),
          usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
        },
      ],
      chunkSize: 7,
    });
    const executor = new ScriptedExecutor({ results: { "final_answer(1)": finalAnswerResult(1) } });
    const agent = new StreamingTestAgent(executor, { model });

    const events = await collect(agent, "Q");

    const updates = events.filter((event) => event.type === "usage.updated");
    expect(updates).toHaveLength(1);
    expect((updates[0] as { usage: unknown }).usage).toEqual({
      inputTokens: 10,
      outputTokens: 2,
      totalTokens: 12,
    });
    expect(events.filter((event) => event.type === "message.delta").length).toBeGreaterThan(1);
    expect(events.at(-1)?.type).toBe("run.completed");
  });

  it("surfaces an executor-reported error as an observation and keeps going", async () => {
    const { agent } = buildAgent({
      responses: [fenced("boom()"), fenced("final_answer(1)")],
      results: {
        "boom()": {
          logs: "ReferenceError: boom is not defined",
          isFinalAnswer: false,
          error: {
            name: "AgentExecutionError",
            message: "ReferenceError: boom is not defined",
            code: "AGENT_EXECUTION",
            stepIndex: 0,
          },
          durationMs: 0,
          toolCallCount: 0,
        },
        "final_answer(1)": finalAnswerResult(1),
      },
    });
    const events = await collect(agent, "Q");
    expect(types(events).at(-1)).toBe("run.completed");
    const observation = events.find((event) => event.type === "observation.completed");
    expect((observation as { text: string }).text).toMatch(/boom is not defined/);
  });

  it("fails the run when the executor itself throws, not when guest code throws", async () => {
    const { agent } = buildAgent({ responses: [fenced("boom()")], results: {} });
    const events = await collect(agent, "Q");
    expect(types(events).at(-1)).toBe("run.failed");
  });

  it("lets middleware veto an action and inject its own outcome", async () => {
    const { agent, executor } = buildAgent({
      responses: [fenced("a()"), fenced("final_answer(1)")],
      results: { "final_answer(1)": finalAnswerResult(1) },
      agent: {
        middleware: [
          async function* (ctx, next) {
            // Veto the first action only. Never calling next() means the executor never sees it.
            if (ctx.stepIndex === 0) {
              return { observations: "blocked by policy", isFinalAnswer: false };
            }
            return yield* next();
          },
        ],
      },
    });
    const events = await collect(agent, "Q");
    expect(executor.executed).toEqual(["final_answer(1)"]);
    expect(events.some((event) => event.type === "observation.completed" && event.text === "blocked by policy")).toBe(true);
  });

  it("notifies on() listeners, and stops after unsubscribe", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")], results: { "final_answer(1)": finalAnswerResult(1) } });
    const seen: string[] = [];
    const off = agent.on((event) => seen.push(event.type));
    await agent.run("Q");
    expect(seen).toEqual([
      "run.started",
      "step.started",
      "message.delta",
      "usage.updated",
      "message.completed",
      "code.completed",
      "observation.completed",
      "run.completed",
    ]);
    off();
    seen.length = 0;
    await expect(agent.run("Q")).rejects.toThrow();
    expect(seen).toEqual([]);
  });

  it("returns a complete RunResult", async () => {
    const { agent } = buildAgent({ responses: [fenced("final_answer(1)")], results: { "final_answer(1)": finalAnswerResult(1) } });
    const result = await agent.run("Q");
    expect(result.runId).toMatch(/[0-9a-f-]{36}/);
    expect(result.timing.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.state).toBe("success");
    expect(result.steps.length).toBeGreaterThan(2);
  });
});

function attachingAbort(controller: AbortController) {
  return async function* (
    _ctx: unknown,
    next: () => AsyncGenerator<AgentEvent, ActionOutcome>,
  ): AsyncGenerator<AgentEvent, ActionOutcome> {
    controller.abort();
    return yield* next();
  } as never;
}