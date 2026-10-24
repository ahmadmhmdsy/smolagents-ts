import { describe, expect, it, vi } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import type { InterpretedAction } from "../src/agent/action.js";
import { MultiStepAgent, type RunOptions } from "../src/agent/multi-step-agent.js";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import {
  AgentCancelledError,
  AgentError,
  AgentGuardrailError,
  AgentMaxStepsError,
} from "../src/errors.js";
import { isTerminal, type AgentEvent } from "../src/events.js";
import type { ChatCompletion, ChatCompletionChunk, GenerateOptions, Model } from "../src/model.js";
import { modelCapabilities } from "../src/model.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MemoryRunStore, type RunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { ToolRegistry } from "../src/tool/registry.js";
import { tool } from "../src/tool/tool.js";
import { EMPTY_TOKEN_USAGE, type ChatMessage, type ToolCallRequest } from "../src/types.js";
import { z } from "zod";

function finalAnswer(answer: unknown, id = "c1"): ToolCallRequest {
  return { id, name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer }) };
}

const answerTurn = { content: "", finishReason: "tool_calls" as const, toolCalls: [finalAnswer("ok")] };

async function collect(agent: MultiStepAgent, task: string, options?: RunOptions): Promise<AgentEvent[]> {
  const events: AgentEvent[] = [];
  for await (const event of agent.stream(task, options)) events.push(event);
  return events;
}

function terminals(events: readonly AgentEvent[]): AgentEvent[] {
  return events.filter((event) => isTerminal(event.type));
}

/** A model whose turns are functions, so a turn can wait on the abort signal. */
class ScriptedModel implements Model {
  readonly id = "scripted";
  readonly provider = "test";
  readonly capabilities = modelCapabilities({ streaming: false, toolCalls: true });
  private index = 0;

  constructor(private readonly turns: ((options?: GenerateOptions) => Promise<ChatCompletion>)[]) {}

  generate(_messages: readonly ChatMessage[], options?: GenerateOptions): Promise<ChatCompletion> {
    const turn = this.turns[this.index];
    this.index += 1;
    if (turn === undefined) return Promise.reject(new Error("script exhausted"));
    return turn(options);
  }

  // eslint-disable-next-line require-yield
  async *generateStream(): AsyncIterable<ChatCompletionChunk> {
    throw new Error("not streamed");
  }
}

/** A turn that resolves only when aborted, and then rejects the way a provider does. */
function hangUntilAborted(onStart: () => void) {
  return (options?: GenerateOptions): Promise<ChatCompletion> =>
    new Promise((_resolve, reject) => {
      onStart();
      options?.signal?.addEventListener("abort", () => {
        reject(new Error("The operation was aborted"));
      });
    });
}

function completion(content: string, toolCalls: ToolCallRequest[] = []): Promise<ChatCompletion> {
  return Promise.resolve({ content, toolCalls, usage: EMPTY_TOKEN_USAGE, finishReason: "stop" });
}

describe("terminal-event contract", () => {
  it("fails the run as a guardrail when the input guardrail throws", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([answerTurn]),
      guardrails: {
        input: () => {
          throw new Error("classifier offline");
        },
      },
    });

    const events = await collect(agent, "task");
    expect(events.map((event) => event.type)).toEqual(["run.started", "run.failed"]);
    const failed = events[1];
    expect(failed?.type === "run.failed" && failed.error.code).toBe("AGENT_GUARDRAIL");
    expect(failed?.type === "run.failed" && failed.error.message).toContain("classifier offline");

    await expect(agent.run("task")).rejects.toBeInstanceOf(AgentGuardrailError);
  });

  it("fails the run as a guardrail when the output guardrail throws", async () => {
    const agent = new ToolCallingAgent({
      model: new MockModel([answerTurn, answerTurn]),
      guardrails: {
        output: () => Promise.reject(new Error("moderation down")),
      },
    });

    const events = await collect(agent, "task");
    expect(terminals(events).map((event) => event.type)).toEqual(["run.failed"]);
    expect(events.at(-1)).toMatchObject({ type: "run.failed", error: { code: "AGENT_GUARDRAIL", stepIndex: 0 } });

    await expect(agent.run("task")).rejects.toBeInstanceOf(AgentGuardrailError);
  });

  it("fails the run when the store cannot load the record", async () => {
    const store: RunStore = {
      commit: () => undefined,
      load: () => Promise.reject(new Error("disk gone")),
      claim: () => Promise.reject(new Error("disk gone")),
    };
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn]), store });

    const events = await collect(agent, "task", { reset: false, runId: "c" });
    expect(events.map((event) => event.type)).toEqual(["run.started", "run.failed"]);
    expect(events[1]).toMatchObject({ error: { code: "AGENT_ERROR" } });
    expect(events[1]?.type === "run.failed" && events[1].error.message).toContain("load");
  });

  it("fails the run when the store cannot commit the record", async () => {
    const store: RunStore = {
      commit: () => {
        throw new Error("quota exceeded");
      },
      load: () => undefined,
      claim: () => {
        throw new Error("unreachable: a fresh run never claims");
      },
    };
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn]), store });

    const events = await collect(agent, "task", { runId: "c" });
    expect(terminals(events)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "run.failed", error: { code: "AGENT_ERROR", stepIndex: 0 } });
    expect(events.at(-1)?.type === "run.failed" && events.at(-1)).toMatchObject({
      error: { message: expect.stringContaining("quota exceeded") as unknown },
    });
  });

  it("fails the run when a commit after a planning step throws", async () => {
    let saves = 0;
    const store: RunStore = {
      commit: () => {
        saves += 1;
        if (saves === 2) throw new Error("planning commit failed");
      },
      load: () => undefined,
      claim: () => {
        throw new Error("unreachable: a fresh run never claims");
      },
    };
    const agent = new ToolCallingAgent({
      model: new MockModel(["no tool call", "1. answer", answerTurn]),
      store,
      planningInterval: 1,
    });

    const events = await collect(agent, "task", { runId: "c" });
    expect(terminals(events)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "run.failed", error: { code: "AGENT_ERROR" } });
  });

  it("reports a throw that escapes the loop as one run.failed", async () => {
    class ThrowingAgent extends ToolCallingAgent {
      protected override interpret(): InterpretedAction {
        throw new Error("interpret blew up");
      }
    }
    const agent = new ThrowingAgent({ model: new MockModel([answerTurn]) });

    const events = await collect(agent, "task");
    expect(terminals(events)).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({ type: "run.failed", error: { message: "interpret blew up" } });
  });
});

describe("cancellation during a model call", () => {
  it("emits run.cancelled, not run.failed, when the action call is aborted", async () => {
    const controller = new AbortController();
    const agent = new ToolCallingAgent({
      model: new ScriptedModel([hangUntilAborted(() => queueMicrotask(() => controller.abort()))]),
    });

    const events = await collect(agent, "task", { signal: controller.signal });
    expect(terminals(events).map((event) => event.type)).toEqual(["run.cancelled"]);
    await expect(
      agent.run("task", { signal: AbortSignal.abort() }),
    ).rejects.toBeInstanceOf(AgentCancelledError);
  });

  it("emits run.cancelled when the planning call is aborted", async () => {
    const controller = new AbortController();
    const agent = new ToolCallingAgent({
      model: new ScriptedModel([
        () => completion("no tool call"),
        hangUntilAborted(() => queueMicrotask(() => controller.abort())),
      ]),
      planningInterval: 1,
    });

    const events = await collect(agent, "task", { signal: controller.signal });
    expect(events.map((event) => event.type)).toContain("planning.started");
    expect(terminals(events).map((event) => event.type)).toEqual(["run.cancelled"]);
  });

  it("still fails a model error that is not an abort", async () => {
    const agent = new ToolCallingAgent({
      model: new ScriptedModel([() => Promise.reject(new Error("rate limited"))]),
    });

    const events = await collect(agent, "task");
    expect(events.at(-1)).toMatchObject({ type: "run.failed", error: { code: "AGENT_GENERATION" } });
  });
});

describe("managed agents and a caller's registry", () => {
  it("does not add managed agents to a registry the caller passed in", () => {
    const shared = new ToolRegistry([
      tool({ name: "echo", description: "Echo.", inputSchema: z.object({ text: z.string() }), execute: ({ text }) => text }),
    ]);
    const child = new ToolCallingAgent({ model: new MockModel([]) });
    const managed = [{ name: "junior", description: "Helps.", agent: child }];

    const first = new ToolCallingAgent({ model: new MockModel([]), tools: shared, managedAgents: managed });
    const second = new ToolCallingAgent({ model: new MockModel([]), tools: shared, managedAgents: managed });

    expect(shared.list().map((entry) => entry.name)).toEqual(["echo"]);
    expect(first.tools.list().map((entry) => entry.name)).toEqual(["echo", "junior"]);
    expect(second.tools.list().map((entry) => entry.name)).toEqual(["echo", "junior"]);
  });

  it("keeps using the caller's registry when there are no managed agents", () => {
    const shared = new ToolRegistry([]);
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: shared });
    expect(agent.tools).toBe(shared);
  });
});

describe("continuing a run's memory", () => {
  it("records one system prompt step across continued runs", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn, answerTurn, answerTurn]), store });

    await agent.run("first", { runId: "c" });
    await agent.run("second", { reset: false, runId: "c" });
    await agent.run("third", { reset: false });

    expect(agent.steps.filter((step) => step.kind === "system_prompt")).toHaveLength(1);
    expect(agent.steps.filter((step) => step.kind === "task")).toHaveLength(3);
  });
});

describe("run() rethrows the subclass", () => {
  it("rejects with an AgentGuardrailError on a tripped wire", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([]), guardrails: { input: () => "no" } });
    const error = await agent.run("task").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(AgentGuardrailError);
    expect(error).toBeInstanceOf(AgentError);
  });

  it("rejects with an AgentMaxStepsError when the budget runs out", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel(["no tool call"]), maxSteps: 1 });
    await expect(agent.run("task")).rejects.toBeInstanceOf(AgentMaxStepsError);
  });
});

describe("an interpret() that answers directly", () => {
  class DirectAgent extends MultiStepAgent<string> {
    protected buildSystemPrompt(): string {
      return "Answer directly.";
    }

    protected interpret(completion: ChatCompletion): InterpretedAction {
      return { kind: "final", raw: completion.content, output: completion.content.trim() };
    }

    // eslint-disable-next-line require-yield
    protected async *executeAction(): AsyncGenerator<AgentEvent, never> {
      throw new Error("never reached");
    }
  }

  it("completes the run and records the answering step", async () => {
    const agent = new DirectAgent({ model: new MockModel(["  forty-two "]) });

    const result = await agent.run("task");
    expect(result.output).toBe("forty-two");
    const action = agent.steps.find((step) => step.kind === "action");
    expect(action).toMatchObject({ modelOutput: "  forty-two ", isFinalAnswer: true });
    expect(agent.steps.at(-1)?.kind).toBe("final_answer");
  });
});

describe("AgentSession and a caller's signal", () => {
  it("removes its abort listener from the caller's signal when the turn ends", async () => {
    const executor = new ScriptedExecutor({ handler: () => finalAnswerResult(1) });
    const fenced = "Code:\n" + CODE_FENCE + "\nfinal_answer(1)\n" + CODE_FENCE;
    const session = new AgentSession(new CodeAgent({ model: new MockModel([fenced, fenced]), executor }));
    const controller = new AbortController();
    const add = vi.spyOn(controller.signal, "addEventListener");
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    await session.send("one", { signal: controller.signal });
    await session.send("two", { signal: controller.signal });

    const added = add.mock.calls.filter(([type]) => type === "abort").map(([, listener]) => listener);
    const removed = remove.mock.calls.filter(([type]) => type === "abort").map(([, listener]) => listener);
    expect(added).toHaveLength(2);
    expect(removed).toEqual(added);
  });
});

describe("agent.on(type, handler)", () => {
  it("delivers only the named event type, narrowed, until unsubscribed", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn, answerTurn]) });
    const seen: string[] = [];
    const off = agent.on("run.completed", (event) => {
      seen.push(event.type + ":" + String(event.result.output));
    });

    await agent.run("task");
    off();
    await agent.run("task");

    expect(seen).toEqual(["run.completed:ok"]);
  });

  it("still accepts a listener for every event", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn]) });
    const types: string[] = [];
    agent.on((event) => types.push(event.type));
    await agent.run("task");
    expect(types[0]).toBe("run.started");
    expect(types.at(-1)).toBe("run.completed");
  });
});

describe("code.delta", () => {
  const reply = "Thought: add.\nCode:\n" + CODE_FENCE + "js\nconst a = 1;\nfinal_answer(a + 1)\n" + CODE_FENCE + "\n";
  const code = "const a = 1;\nfinal_answer(a + 1)";

  function codeDeltas(events: readonly AgentEvent[]): string[] {
    return events.flatMap((event) => (event.type === "code.delta" ? [event.text] : []));
  }

  it("emits the code block once the reply arrives", async () => {
    const executor = new ScriptedExecutor({ handler: () => finalAnswerResult(2) });
    const agent = new CodeAgent({ model: new MockModel([reply]), executor });

    const events = await collect(agent, "task");
    expect(codeDeltas(events)).toEqual([code]);
    expect(events.find((event) => event.type === "code.completed")).toMatchObject({ code });
  });

  it("emits growing code, line by line, while the reply streams", async () => {
    class StreamingCodeAgent extends CodeAgent {
      protected override get prefersStreaming(): boolean {
        return true;
      }
    }
    const executor = new ScriptedExecutor({ handler: () => finalAnswerResult(2) });
    const agent = new StreamingCodeAgent({ model: new MockModel({ responses: [reply], chunkSize: 4 }), executor });

    const events = await collect(agent, "task");
    const deltas = codeDeltas(events);
    expect(deltas.length).toBeGreaterThan(1);
    expect(deltas.join("")).toBe(code);
    expect(deltas.some((delta) => delta.includes(CODE_FENCE))).toBe(false);
  });

  it("emits no code.delta for a tool-calling agent", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn]) });
    expect(codeDeltas(await collect(agent, "task"))).toEqual([]);
  });
});
