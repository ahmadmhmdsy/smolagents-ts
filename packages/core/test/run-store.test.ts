import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import {
  AgentMaxStepsError,
  RunClaimedError,
  RunNotFoundError,
  RunRecordVersionError,
  StaleWriterError,
} from "../src/errors.js";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
  stepFromJSON,
  stepToJSON,
  type AnyAgentStep,
} from "../src/memory/steps.js";
import {
  MemoryRunStore,
  type RunStore,
  type StoredRun,
} from "../src/session/run-store.js";
import {
  RUN_RECORD_VERSION,
  translateRecord,
  type RunRecord,
  type RunStatus,
} from "../src/session/run-record.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

describe("step serialization", () => {
  it("round-trips every step kind through JSON, identity included", () => {
    const steps: AnyAgentStep[] = [
      new TaskStep("do the thing"),
      new SystemPromptStep("you are helpful"),
      Object.assign(new PlanningStep("plan: first then second"), { hasError: true }),
      Object.assign(new ActionStep("thinking"), {
        codeAction: "1 + 1",
        toolCalls: [{ id: "c1", name: "add", arguments: { a: 1 } }],
        observations: "2",
        isFinalAnswer: false,
      }),
      new FinalAnswerStep({ answer: 2 }),
    ];

    for (const before of steps) {
      // A JSON encode/decode cycle is the store contract: a record is plain data.
      const wire = JSON.parse(JSON.stringify(stepToJSON(before))) as ReturnType<typeof stepToJSON>;
      const after = stepFromJSON(wire);
      expect(after.kind).toBe(before.kind);
      expect(after.id).toBe(before.id);
      expect(after.createdAt).toBe(before.createdAt);
      expect(after).toEqual(before);
    }
  });
});

describe("run records", () => {
  const steps = [stepToJSON(new TaskStep("do the thing"))];

  it("translates a bare step array, the version-0 form, into a record", () => {
    const wire = JSON.parse(JSON.stringify(steps)) as ReturnType<typeof stepToJSON>[];
    const record = translateRecord(wire);
    expect(record.schemaVersion).toBe(RUN_RECORD_VERSION);
    expect(record.status).toBe("interrupted");
    expect(record.generation).toBe(0);
    expect(record.memory.steps).toEqual(wire);
  });

  it("translates the version-1 envelope into a record", () => {
    const record = translateRecord({ formatVersion: 1, steps });
    expect(record.schemaVersion).toBe(RUN_RECORD_VERSION);
    expect(record.status).toBe("interrupted");
    expect(record.memory.steps).toEqual(steps);
  });

  it("reads a current record unchanged", () => {
    const current: RunRecord = {
      schemaVersion: RUN_RECORD_VERSION,
      runId: "run-1",
      status: "waiting",
      generation: 2,
      memory: { steps },
      createdAt: "2026-10-24T00:00:00.000Z",
      updatedAt: "2026-10-24T00:00:01.000Z",
    };
    expect(translateRecord(current)).toEqual(current);
  });

  it("refuses a record written by a newer runtime, typed, and names the version", () => {
    const newer: RunRecord = {
      schemaVersion: RUN_RECORD_VERSION + 1,
      runId: "run-1",
      status: "running",
      generation: 0,
      memory: { steps },
    };
    expect(() => translateRecord(newer)).toThrow(RunRecordVersionError);
    expect(() => translateRecord(newer)).toThrow(new RegExp(String(RUN_RECORD_VERSION + 1)));
  });
});

/** A store that keeps every record it was handed and counts the commits, for the boundary test. */
class RecordingStore implements RunStore {
  readonly commits: { runId: string; status: RunStatus; actions: number }[] = [];
  private readonly inner = new MemoryRunStore();

  claim(runId: string, expectedGeneration: number, owner: string): RunRecord {
    return this.inner.claim(runId, expectedGeneration, owner);
  }

  commit(runId: string, record: RunRecord): void {
    this.commits.push({
      runId,
      status: record.status,
      actions: record.memory.steps.filter((step) => step.kind === "action").length,
    });
    this.inner.commit(runId, record);
  }

  load(runId: string): StoredRun | undefined {
    return this.inner.load(runId);
  }
}

function addTool() {
  return tool({
    name: "add",
    description: "Add two numbers.",
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    execute: ({ a, b }) => a + b,
  });
}

describe("run store", () => {
  it("journals each effect and commits each step boundary before the terminal state", async () => {
    const store = new RecordingStore();
    const agent = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 1, b: 1 }, "c1")] },
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 2, b: 2 }, "c2")] },
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 4 }, "c3")],
        },
      ]),
      tools: [addTool()],
      store,
    });

    const result = await agent.run("add", { runId: "run-1" });

    expect(result.output).toBe(4);
    expect(result.runId).toBe("run-1");
    const statuses = store.commits.map((entry) => entry.status);
    expect(statuses.at(-1)).toBe("completed");
    expect(statuses.slice(0, -1).every((status) => status === "running")).toBe(true);
    // 1.4 journals the model request and each tool effect, so an action step writes more than its
    // own boundary; what must stay true is that the record only grows at those boundaries.
    const actions = store.commits.map((entry) => entry.actions);
    expect(actions).toEqual([...actions].sort((left, right) => left - right));
    expect(actions.at(-1)).toBe(3);
    expect(store.commits.length).toBeGreaterThanOrEqual(3);
    const stored = translateRecord(store.load("run-1")!);
    expect(stored.status).toBe("completed");
    expect(stored.runId).toBe("run-1");
    expect(stored.schemaVersion).toBe(RUN_RECORD_VERSION);
    expect(stored.memory.steps).toEqual(result.steps.map(stepToJSON));
  });

  it("commits the failed status when the run throws", async () => {
    const store = new RecordingStore();
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [], store });

    await expect(agent.run("work", { runId: "run-failed" })).rejects.toBeInstanceOf(Error);

    const statuses = store.commits.map((entry) => entry.status);
    // The announcement the model request never completed is committed before it is attempted,
    // so the record shows the run starting and then failing rather than only the failure.
    expect(statuses.slice(0, -1).every((status) => status === "running")).toBe(true);
    expect(statuses.at(-1)).toBe("failed");
    const stored = translateRecord(store.load("run-failed")!);
    expect(stored.status).toBe("failed");
    expect(stored.memory.steps.some((step) => step.kind === "action")).toBe(false);
  });

  it("lets exactly one of two racing resumers claim the record", async () => {
    const store = new MemoryRunStore();
    store.commit("race", {
      schemaVersion: RUN_RECORD_VERSION,
      runId: "race",
      status: "failed",
      generation: 0,
      memory: { steps: [] },
    });
    const outcomes = await Promise.allSettled([
      Promise.resolve().then(() => store.claim("race", 0, "owner-a")),
      Promise.resolve().then(() => store.claim("race", 0, "owner-b")),
    ]);
    const fulfilled = outcomes.filter((entry) => entry.status === "fulfilled");
    const rejected = outcomes.filter((entry) => entry.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(RunClaimedError);
    const stored = store.load("race")!;
    expect(stored).toMatchObject({ generation: 1 });
  });

  it("refuses a stale writer and leaves the claimed record exactly as it was", async () => {
    const store = new MemoryRunStore();
    store.commit("stale", {
      schemaVersion: RUN_RECORD_VERSION,
      runId: "stale",
      status: "running",
      generation: 0,
      memory: { steps: [] },
    });
    const claimed = store.claim("stale", 0, "owner-a");
    expect(claimed.generation).toBe(1);
    const before = JSON.stringify(store.load("stale"));
    expect(() =>
      store.commit("stale", { ...claimed, generation: 0, memory: { steps: [] } }, 0),
    ).toThrow(StaleWriterError);
    expect(JSON.stringify(store.load("stale"))).toBe(before);
    // The record still names its live owner, and the in-fence writer can continue it.
    expect(store.load("stale")).toMatchObject({ generation: 1, owner: "owner-a" });
    store.commit("stale", { ...claimed, status: "completed" }, 1);
    expect(store.load("stale")).toMatchObject({ status: "completed" });
  });

  it("repairs a crashed run, closing its open step as interrupted, then finishes it", async () => {
    const store = new MemoryRunStore();
    const first = new ActionStep("call add once");
    store.commit("crashed", {
      schemaVersion: RUN_RECORD_VERSION,
      runId: "crashed",
      status: "running",
      generation: 3,
      memory: { steps: [new TaskStep("add"), first].map(stepToJSON) },
      step: { index: 1, stepId: "crashed-open", startedAt: "2026-10-24T00:00:00.000Z" },
      completed: [
        { stepId: first.id, index: 0, state: "completed", finishedAt: "2026-10-24T00:00:01.000Z" },
      ],
    });
    const agent = new ToolCallingAgent({
      model: new MockModel([
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 2 }, "c-resume")],
        },
      ]),
      tools: [addTool()],
      store,
    });

    const result = await agent.run("add", { runId: "crashed", resume: {} });

    expect(result.output).toBe(2);
    const stored = translateRecord(store.load("crashed")!);
    expect(stored.status).toBe("completed");
    expect(stored.generation).toBe(4);
    expect(stored.owner).toBeUndefined();
    expect(stored.memory.steps.length).toBeGreaterThanOrEqual(2);
    expect(stored.completed).toHaveLength(3);
    expect(stored.completed?.[0]).toMatchObject({ stepId: first.id, state: "completed" });
    expect(stored.completed?.[1]).toMatchObject({ stepId: "crashed-open", state: "interrupted" });
    // The step that answered after the repair finished normally.
    expect(stored.completed?.[2]).toMatchObject({ index: 1, state: "completed" });
  });

  it("resumes a stopped run from its record and finishes it", async () => {
    const store = new MemoryRunStore();
    const add = addTool();

    // First run stops at the step budget with its one action step already committed.
    const first = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 1, b: 1 })] },
      ]),
      tools: [add],
      maxSteps: 1,
      store,
    });
    await expect(first.run("add 1 and 1", { runId: "job-1" })).rejects.toBeInstanceOf(
      AgentMaxStepsError,
    );
    expect(store.has("job-1")).toBe(true);
    const saved = translateRecord(store.load("job-1")!);
    expect(saved.schemaVersion).toBe(RUN_RECORD_VERSION);
    expect(saved.status).toBe("failed");
    expect(saved.memory.steps.length).toBeGreaterThan(0);

    // A fresh agent resumes the same record; its memory carries the first run's steps forward.
    const second = new ToolCallingAgent({
      model: new MockModel([
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 2 }, "c2")],
        },
      ]),
      tools: [add],
      maxSteps: 1,
      store,
    });
    const result = await second.run("add 1 and 1", { runId: "job-1", reset: false });

    expect(result.output).toBe(2);
    expect(result.runId).toBe("job-1");
    const actions = result.steps.filter((step) => step.kind === "action");
    // The resumed step plus the one that answered.
    expect(actions).toHaveLength(2);
    // The tool result from before the resume is still in the transcript.
    expect(
      result.steps.some(
        (step) => step.kind === "action" && (step.observations ?? "").includes("returned: 2"),
      ),
    ).toBe(true);
  });

  it("resumes from a store that still holds the version-0 bare array", async () => {
    const add = addTool();
    const stored: string[] = [];
    const legacyStore: RunStore = {
      commit: (_runId, record) => {
        // Persist only the steps, the way a store written before the envelope did.
        stored.push(JSON.stringify(record.memory.steps));
      },
      load: () =>
        stored.length === 0
          ? undefined
          : (JSON.parse(stored[0]!) as ReturnType<typeof stepToJSON>[]),
      claim: (runId, expectedGeneration, owner) => {
        const raw = stored.length === 0 ? undefined : (JSON.parse(stored[0]!) as StoredRun);
        if (raw === undefined) throw new RunNotFoundError("no legacy record yet");
        const current = translateRecord(raw, runId);
        if (current.generation !== expectedGeneration) throw new RunClaimedError("overtaken");
        return { ...current, generation: expectedGeneration + 1, owner };
      },
    };

    const first = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 1, b: 1 })] },
      ]),
      tools: [add],
      maxSteps: 1,
      store: legacyStore,
    });
    await expect(first.run("add 1 and 1", { runId: "job-legacy" })).rejects.toBeInstanceOf(
      AgentMaxStepsError,
    );

    const second = new ToolCallingAgent({
      model: new MockModel([
        {
          content: "",
          finishReason: "tool_calls",
          toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: 2 }, "c2")],
        },
      ]),
      tools: [add],
      maxSteps: 1,
      store: legacyStore,
    });
    const result = await second.run("add 1 and 1", { runId: "job-legacy", reset: false });
    expect(result.output).toBe(2);
  });

  it("fails a resumed run when the stored record declares a newer version", async () => {
    const newerStore: RunStore = {
      commit: () => undefined,
      claim: () => {
        throw new Error("unreachable: the load refuses the record first");
      },
      load: (runId): RunRecord => ({
        schemaVersion: RUN_RECORD_VERSION + 1,
        runId,
        status: "running",
        generation: 0,
        memory: { steps: [] },
      }),
    };
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [], store: newerStore });

    await expect(agent.run("resume", { runId: "job-new", reset: false })).rejects.toBeInstanceOf(
      RunRecordVersionError,
    );
  });
});
