import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import { AgentMaxStepsError, RunRecordVersionError } from "../src/errors.js";
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
  it("commits once per action step and once at the terminal state", async () => {
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
    expect(store.commits.map((entry) => entry.status)).toEqual(["running", "running", "completed"]);
    expect(store.commits.map((entry) => entry.actions)).toEqual([1, 2, 3]);
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
    expect(statuses).toEqual(["failed"]);
    const stored = translateRecord(store.load("run-failed")!);
    expect(stored.status).toBe("failed");
    expect(stored.memory.steps.some((step) => step.kind === "action")).toBe(false);
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
