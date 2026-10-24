import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import { AgentMaxStepsError } from "../src/errors.js";
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
import { MemoryRunStore } from "../src/session/run-store.js";
import {
  RUN_SNAPSHOT_VERSION,
  translateSnapshot,
  type RunSnapshot,
  type RunStore,
} from "../src/session/run-store.js";
import { RunSnapshotVersionError } from "../src/errors.js";
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
      // A JSON encode/decode cycle is the store contract: the checkpoint is plain data.
      const wire = JSON.parse(JSON.stringify(stepToJSON(before))) as ReturnType<typeof stepToJSON>;
      const after = stepFromJSON(wire);
      expect(after.kind).toBe(before.kind);
      expect(after.id).toBe(before.id);
      expect(after.createdAt).toBe(before.createdAt);
      expect(after).toEqual(before);
    }
  });
});

describe("run snapshots", () => {
  const steps = [stepToJSON(new TaskStep("do the thing"))];

  it("translates a bare step array, the version-0 form, into the envelope", () => {
    const wire = JSON.parse(JSON.stringify(steps)) as ReturnType<typeof stepToJSON>[];
    expect(translateSnapshot(wire)).toEqual({ formatVersion: RUN_SNAPSHOT_VERSION, steps: wire });
  });

  it("reads the current envelope unchanged", () => {
    expect(translateSnapshot({ formatVersion: RUN_SNAPSHOT_VERSION, steps })).toEqual({
      formatVersion: RUN_SNAPSHOT_VERSION,
      steps,
    });
  });

  it("refuses a snapshot written by a newer runtime, typed", () => {
    expect(() => translateSnapshot({ formatVersion: RUN_SNAPSHOT_VERSION + 1, steps })).toThrow(
      RunSnapshotVersionError,
    );
    expect(() => translateSnapshot({ formatVersion: RUN_SNAPSHOT_VERSION + 1, steps })).toThrow(
      /format version/,
    );
  });
});

describe("run store", () => {
  it("resumes a stopped run from its checkpoint and finishes it", async () => {
    const store = new MemoryRunStore();
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => a + b,
    });

    // First run stops at the step budget with its one action step already checkpointed.
    const first = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 1, b: 1 })] },
      ]),
      tools: [add],
      maxSteps: 1,
      store,
    });
    await expect(first.run("add 1 and 1", { checkpoint: "job-1" })).rejects.toBeInstanceOf(
      AgentMaxStepsError,
    );
    expect(store.has("job-1")).toBe(true);
    const saved = store.load("job-1") as RunSnapshot;
    expect(saved.formatVersion).toBe(RUN_SNAPSHOT_VERSION);
    expect(saved.steps.length).toBeGreaterThan(0);

    // A fresh agent resumes the same checkpoint; its memory carries the first run's steps forward.
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
    const result = await second.run("add 1 and 1", { checkpoint: "job-1", reset: false });

    expect(result.output).toBe(2);
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
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => a + b,
    });
    const stored: string[] = [];
    const legacyStore: RunStore = {
      save: (_checkpoint, snapshot) => {
        // Persist only the steps, the way a store written before the envelope did.
        stored.push(JSON.stringify(snapshot.steps));
      },
      load: () => (stored.length === 0 ? undefined : (JSON.parse(stored[0]!) as ReturnType<typeof stepToJSON>[])),
    };

    const first = new ToolCallingAgent({
      model: new MockModel([
        { content: "", finishReason: "tool_calls", toolCalls: [call("add", { a: 1, b: 1 })] },
      ]),
      tools: [add],
      maxSteps: 1,
      store: legacyStore,
    });
    await expect(first.run("add 1 and 1", { checkpoint: "job-legacy" })).rejects.toBeInstanceOf(
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
    const result = await second.run("add 1 and 1", { checkpoint: "job-legacy", reset: false });
    expect(result.output).toBe(2);
  });

  it("fails a resumed run when the stored snapshot declares a newer version", async () => {
    const newerStore: RunStore = {
      save: () => undefined,
      load: () => ({ formatVersion: RUN_SNAPSHOT_VERSION + 1, steps: [] }),
    };
    const agent = new ToolCallingAgent({ model: new MockModel([]), tools: [], store: newerStore });

    await expect(agent.run("resume", { checkpoint: "job-new", reset: false })).rejects.toBeInstanceOf(
      RunSnapshotVersionError,
    );
  });
});
