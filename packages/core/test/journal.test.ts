/**
 * The effects journal: an external effect is announced in the record before it starts and
 * completed after it returns, so a resumed run can replay a finished effect, refuse to guess at
 * an in-doubt one, and retry only what its tool declares idempotent.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CodeAgent } from "../src/agent/code-agent.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { ActionStep, TaskStep, stepToJSON } from "../src/memory/steps.js";
import {
  MemoryRunStore,
  translateRecord,
  RUN_RECORD_VERSION,
  type JournalEntry,
  type RunRecord,
  type RunStore,
} from "../src/session/run-store.js";
import { noopLogger } from "../src/logger.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import { EMPTY_TOKEN_USAGE, type ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const ADD_TURN = {
  content: "",
  finishReason: "tool_calls" as const,
  toolCalls: [call("add", { a: 1, b: 1 }, "c-add")],
};

const ANSWER_TURN = {
  content: "",
  finishReason: "tool_calls" as const,
  toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 2 }, "c-fin")],
};

function answerCompletion(id = "c-fin"): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
  usage: typeof EMPTY_TOKEN_USAGE;
} {
  return {
    content: "",
    finishReason: "tool_calls",
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 42 }, id)],
    usage: EMPTY_TOKEN_USAGE,
  };
}

function modelDone(stepId: string, completion: unknown): JournalEntry {
  return {
    stepId,
    callId: "model",
    toolName: "",
    argsDigest: "digest",
    state: "done",
    result: completion,
    usage: EMPTY_TOKEN_USAGE,
    at: "2026-10-24T00:00:00.000Z",
  };
}

function base(overrides: Partial<RunRecord>): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId: "run-journal",
    status: "running",
    generation: 0,
    memory: { steps: [stepToJSON(new TaskStep("add 1 and 1"))] },
    ...overrides,
  };
}

const completedFirstStep = {
  stepId: "attempt-0",
  index: 0,
  state: "completed" as const,
  finishedAt: "2026-10-24T00:00:01.000Z",
};

describe("effects journal", () => {
  it("commits an effect intent before the effect runs, then its done result", async () => {
    const snapshots: RunRecord[] = [];
    const inner = new MemoryRunStore();
    const store: RunStore = {
      claim: (runId, expectedGeneration, owner) => inner.claim(runId, expectedGeneration, owner),
      load: (runId) => inner.load(runId),
      watch: () => () => undefined,
      latestForConversation: (conversationId) => inner.latestForConversation(conversationId),
      commit: (runId, record, expected) => {
        snapshots.push(JSON.parse(JSON.stringify(record)) as RunRecord);
        inner.commit(runId, record, expected);
      },
    };
    let intentSeenBeforeEffect = false;
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => {
        intentSeenBeforeEffect = snapshots.some((record) =>
          (record.journal ?? []).some((entry) => entry.toolName === "add" && entry.state === "intent"),
        );
        return a + b;
      },
    });
    const agent = new ToolCallingAgent({
      model: new MockModel([ADD_TURN, ANSWER_TURN]),
      tools: [add],
      store,
    });

    await agent.run("add", { runId: "run-journal" });

    expect(intentSeenBeforeEffect).toBe(true);
    const stored = translateRecord((await store.load("run-journal"))!);
    const addEntry = (stored.journal ?? []).find((entry) => entry.toolName === "add");
    expect(addEntry?.state).toBe("done");
    expect(addEntry?.result).toEqual({ ok: true, output: 2 });
  });

  it("resumes after a crash between steps without moving the previous step's effects", async () => {
    const store = new MemoryRunStore();
    const first = new ActionStep("call add once");
    store.commit(
      "run-journal",
      base({
        memory: { steps: [stepToJSON(new TaskStep("add")), stepToJSON(first)] },
        completed: [completedFirstStep],
        journal: [
          modelDone("attempt-0", ADD_TURN),
          {
            stepId: "attempt-0",
            callId: "c-add",
            toolName: "add",
            argsDigest: "digest",
            state: "done",
            result: { ok: true, output: 2 },
            at: "2026-10-24T00:00:01.500Z",
          },
        ],
      }),
    );
    let calls = 0;
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => {
        calls += 1;
        return a + b;
      },
    });
    const agent = new ToolCallingAgent({ model: new MockModel([ANSWER_TURN]), tools: [add], store });

    const result = await agent.run("add", { runId: "run-journal", resume: {} });

    expect(result.output).toBe(2);
    expect(calls).toBe(0);
    expect(translateRecord(store.load("run-journal")!).completed?.[0]).toMatchObject({
      stepId: "attempt-0",
      state: "completed",
    });
  });

  it("surfaces an effect announced without a result and refuses to retry it", async () => {
    const store = new MemoryRunStore();
    store.commit(
      "run-journal",
      base({
        step: { index: 0, stepId: "attempt-1", startedAt: "2026-10-24T00:00:02.000Z" },
        journal: [
          modelDone("attempt-1", ADD_TURN),
          {
            stepId: "attempt-1",
            callId: "c-add",
            toolName: "add",
            argsDigest: "digest",
            state: "intent",
            at: "2026-10-24T00:00:02.500Z",
          },
        ],
      }),
    );
    let calls = 0;
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => {
        calls += 1;
        return a + b;
      },
    });
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [add], store });

    await expect(agent.run("add", { runId: "run-journal", resume: {} })).rejects.toMatchObject({
      code: "AGENT_EFFECT_UNKNOWN",
    });

    expect(calls).toBe(0);
    const stored = translateRecord(store.load("run-journal")!);
    expect(stored.status).toBe("failed");
    expect((stored.journal ?? []).find((entry) => entry.toolName === "add")?.state).toBe("intent");
  });

  it("retries an in-doubt effect once when its tool is declared idempotent", async () => {
    const store = new MemoryRunStore();
    store.commit(
      "run-journal",
      base({
        step: { index: 0, stepId: "attempt-1", startedAt: "2026-10-24T00:00:02.000Z" },
        journal: [
          modelDone("attempt-1", ADD_TURN),
          {
            stepId: "attempt-1",
            callId: "c-add",
            toolName: "add",
            argsDigest: "digest",
            state: "intent",
            at: "2026-10-24T00:00:02.500Z",
          },
        ],
      }),
    );
    let calls = 1; // The crashed attempt ran the effect once; the retry is the second run.
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      idempotent: true,
      execute: ({ a, b }) => {
        calls += 1;
        return a + b;
      },
    });
    // A resumed run gates tools: any call re-entering an effect must be approved again.
    const agent = new ToolCallingAgent({
      model: new MockModel([ANSWER_TURN]),
      tools: [add],
      store,
      approve: () => true,
    });

    const result = await agent.run("add", { runId: "run-journal", resume: {} });

    const stored = translateRecord(store.load("run-journal")!);
    expect(result.output).toBe(2);
    expect(calls).toBe(2);
    const entry = (stored.journal ?? []).find((item) => item.toolName === "add");
    expect(entry?.state).toBe("unknown");
    expect(entry?.result).toEqual({ ok: true, output: 2 });
  });

  it("replays a journaled effect for code the agent re-runs", async () => {
    const store = new MemoryRunStore();
    const code = [
      "Thought: add the numbers.",
      CODE_FENCE,
      "javascript",
      "const sum = add(1, 1);",
      "final_answer(sum);",
      CODE_FENCE,
    ].join(String.fromCharCode(10));
    store.commit(
      "run-journal",
      base({
        step: { index: 0, stepId: "attempt-1", startedAt: "2026-10-24T00:00:02.000Z" },
        journal: [
          modelDone("attempt-1", {
            content: code,
            finishReason: "stop",
            toolCalls: [],
            usage: EMPTY_TOKEN_USAGE,
          }),
          {
            stepId: "attempt-1",
            callId: "c-add",
            toolName: "add",
            argsDigest: "digest",
            state: "done",
            result: 2,
            at: "2026-10-24T00:00:02.500Z",
          },
        ],
      }),
    );
    let calls = 0;
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => {
        calls += 1;
        return a + b;
      },
    });
    const executor = new ScriptedExecutor({
      handler: async (code, options) => {
        const wrapped = options.tools.get("add");
        if (wrapped === undefined) throw new Error("the executor was given no add tool");
        const ctx = {
          signal: new AbortController().signal,
          fetch: globalThis.fetch,
          callId: "c-add",
          stepIndex: 0,
          logger: noopLogger,
        };
        const sum = await wrapped.execute({ a: 1, b: 1 }, ctx);
        return { ...finalAnswerResult(sum), logs: "" };
      },
    });
    const agent = new CodeAgent({ model: new MockModel([]), executor, tools: [add], store });

    const result = await agent.run("add", { runId: "run-journal", resume: {} });

    expect(result.output).toBe(2);
    expect(calls).toBe(0);
  });

  it("replays a journaled model request instead of paying for it twice", async () => {
    const store = new MemoryRunStore();
    store.commit(
      "run-journal",
      base({
        step: { index: 0, stepId: "attempt-1", startedAt: "2026-10-24T00:00:02.000Z" },
        journal: [modelDone("attempt-1", answerCompletion())],
      }),
    );
    // No scripted reply: a model call would throw, so finishing proves the request was replayed.
    const agent = new ToolCallingAgent({ model: new MockModel([]), store });

    const result = await agent.run("add", { runId: "run-journal", resume: {} });

    expect(result.output).toBe(42);
    expect(translateRecord(store.load("run-journal")!).status).toBe("completed");
  });
});
