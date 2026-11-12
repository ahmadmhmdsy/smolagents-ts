/**
 * Decision 0039, rule 1: the run record names the plugins that were active, resume and fork
 * refuse a different set unless the caller opts into drift, and replay compares the recorded
 * digest before it returns a journaled result.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import type { AgentOptions } from "../src/agent/agent-options.js";
import { TaskStep, stepToJSON } from "../src/memory/steps.js";
import type { PluginEntry } from "../src/session/run-record.js";
import {
  MemoryRunStore,
  translateRecord,
  RUN_RECORD_VERSION,
  type JournalEntry,
  type RunRecord,
} from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import { EMPTY_TOKEN_USAGE, type ToolCallRequest } from "../src/types.js";
import { digestOf } from "../src/utils/digest.js";
import { nextRequestDigest } from "./support/request-digest.js";

const LOGGING: PluginEntry = { name: "logging", version: "1.0.0", configDigest: "cfg-a" };
const COST: PluginEntry = { name: "cost", version: "2.1.0", configDigest: "cfg-b" };

/** Stands in for the plugin host T-75 adds: the agent reports a fixed plugin set. */
class PluggedAgent extends ToolCallingAgent {
  constructor(
    options: AgentOptions,
    private readonly plugins: readonly PluginEntry[],
  ) {
    super(options);
  }

  protected override pluginEntries(): readonly PluginEntry[] {
    return this.plugins;
  }
}

function call(name: string, args: unknown, id: string): ToolCallRequest {
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

function addTool(): { tool: ReturnType<typeof tool>; calls: () => number } {
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
  return { tool: add, calls: () => calls };
}

function crashedRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    schemaVersion: RUN_RECORD_VERSION,
    runId: "run-plugins",
    status: "running",
    generation: 0,
    memory: { steps: [stepToJSON(new TaskStep("add 1 and 1"))] },
    step: { index: 0, stepId: "attempt-0", startedAt: "2026-11-12T00:00:00.000Z" },
    ...overrides,
  };
}

function modelDone(completion: unknown, argsDigest: string): JournalEntry {
  return {
    stepId: "attempt-0",
    callId: "model",
    toolName: "",
    argsDigest,
    state: "done",
    result: { ...(completion as object), usage: EMPTY_TOKEN_USAGE },
    usage: EMPTY_TOKEN_USAGE,
    at: "2026-11-12T00:00:01.000Z",
  };
}

describe("the plugin set on the run record", () => {
  it("writes the active plugins into the record, and nothing when there are none", async () => {
    const store = new MemoryRunStore();
    await new PluggedAgent({ model: new MockModel([ANSWER_TURN]), store }, [LOGGING, COST]).run(
      "add",
      { runId: "with-plugins" },
    );
    await new ToolCallingAgent({ model: new MockModel([ANSWER_TURN]), store }).run("add", {
      runId: "without-plugins",
    });

    expect(translateRecord(store.load("with-plugins")!).plugins).toEqual([LOGGING, COST]);
    expect(translateRecord(store.load("without-plugins")!).plugins).toBeUndefined();
  });

  it("refuses a resume with one plugin removed before any model call", async () => {
    const store = new MemoryRunStore();
    store.commit("run-plugins", crashedRun({ plugins: [LOGGING, COST] }));
    const model = new MockModel([ANSWER_TURN]);
    const agent = new PluggedAgent({ model, store }, [LOGGING]);

    await expect(agent.run("add", { runId: "run-plugins", resume: {} })).rejects.toMatchObject({
      code: "AGENT_RUN_PLUGIN_MISMATCH",
    });
    expect(model.calls).toHaveLength(0);
  });

  it("refuses a changed plugin config as drift too", async () => {
    const store = new MemoryRunStore();
    store.commit("run-plugins", crashedRun({ plugins: [LOGGING] }));
    const model = new MockModel([ANSWER_TURN]);
    const agent = new PluggedAgent({ model, store }, [{ ...LOGGING, configDigest: "cfg-changed" }]);

    await expect(agent.run("add", { runId: "run-plugins", resume: {} })).rejects.toMatchObject({
      code: "AGENT_RUN_PLUGIN_MISMATCH",
    });
    expect(model.calls).toHaveLength(0);
  });

  it("continues a drifted resume when the caller opts in", async () => {
    const store = new MemoryRunStore();
    store.commit("run-plugins", crashedRun({ plugins: [LOGGING, COST] }));
    const agent = new PluggedAgent({ model: new MockModel([ANSWER_TURN]), store }, [LOGGING]);

    const result = await agent.run("add", {
      runId: "run-plugins",
      resume: {},
      allowPluginDrift: true,
    });

    expect(result.output).toBe(2);
  });

  it("refuses a fork whose plugin set differs from the parent's", async () => {
    const store = new MemoryRunStore();
    await new PluggedAgent({ model: new MockModel([ANSWER_TURN]), store }, [LOGGING, COST]).run(
      "add",
      { runId: "parent" },
    );
    const model = new MockModel([ANSWER_TURN]);
    const child = new PluggedAgent({ model, store }, [LOGGING]);

    await expect(
      child.run("add", { runId: "child", fork: { fromRunId: "parent", atStep: 0 } }),
    ).rejects.toMatchObject({ code: "AGENT_RUN_PLUGIN_MISMATCH" });
    expect(model.calls).toHaveLength(0);
  });
});

describe("digest-checked replay", () => {
  it("never returns a journaled tool result when the call's arguments changed", async () => {
    const store = new MemoryRunStore();
    const add = addTool();
    const record = crashedRun();
    const requestDigest = await nextRequestDigest(record, (model, probeStore) =>
      new ToolCallingAgent({ model, tools: [add.tool], store: probeStore }).run("add", {
        runId: "run-plugins",
        resume: {},
      }),
    );
    store.commit(
      "run-plugins",
      crashedRun({
        journal: [
          modelDone(ADD_TURN, requestDigest),
          {
            stepId: "attempt-0",
            callId: "c-add",
            toolName: "add",
            // Journaled for different arguments than the replayed turn now carries.
            argsDigest: digestOf({ a: 2, b: 2 }),
            state: "done",
            result: { ok: true, output: 4 },
            at: "2026-11-12T00:00:02.000Z",
          },
        ],
      }),
    );
    const agent = new ToolCallingAgent({
      model: new MockModel([ANSWER_TURN]),
      tools: [add.tool],
      store,
    });

    await expect(agent.run("add", { runId: "run-plugins", resume: {} })).rejects.toMatchObject({
      code: "AGENT_REPLAY_DIVERGED",
    });
    expect(add.calls()).toBe(0);
  });

  it("asks the model again instead of replaying a reply to a different request", async () => {
    const store = new MemoryRunStore();
    store.commit(
      "run-plugins",
      crashedRun({ journal: [modelDone(ADD_TURN, "a request this run never sent")] }),
    );
    const add = addTool();
    const model = new MockModel([ANSWER_TURN]);
    const agent = new ToolCallingAgent({ model, tools: [add.tool], store });

    const result = await agent.run("add", { runId: "run-plugins", resume: {} });

    // The stale reply asked for `add`; the fresh one answers directly, so `add` never ran.
    expect(result.output).toBe(2);
    expect(model.calls).toHaveLength(1);
    expect(add.calls()).toBe(0);
  });
});
