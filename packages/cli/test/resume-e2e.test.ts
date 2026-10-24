/**
 * The CLI's durable surface: a run that parks on an approval is stored under a run id, a second
 * invocation resumes it by that id, settles the request and finishes, and a resume that cannot
 * find its state is refused with the flag that would have found it.
 */
import {
  CODE_FENCE,
  FileRunStore,
  MockModel,
  ScriptedExecutor,
  finalAnswerResult,
  noopLogger,
  translateRecord,
  type Tool,
} from "@smolagents-ts/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSmolagent } from "../src/run.js";
import { loadTools } from "../src/tool-factory.js";
import { nodeRunFileSystem } from "../src/store.js";

const TOOL_REPLY = [
  "Thought: double the number.",
  "Code:",
  CODE_FENCE,
  "javascript",
  "const doubled = double(21);",
  CODE_FENCE,
].join("\n");

const ANSWER_REPLY = [
  "Thought: done.",
  "Code:",
  CODE_FENCE,
  "javascript",
  'final_answer("The answer is 42.");',
  CODE_FENCE,
].join("\n");

/** A synthetic effect the model can call, standing in for a tool that touches the world. */
function doubleTool(counter: { calls: number }): Tool {
  const base = loadTools(["web_search"])[0] as Tool;
  return {
    ...base,
    name: "double",
    description: "Double a number.",
    execute: () => {
      counter.calls += 1;
      return 42;
    },
    toSpec: () => ({
      name: "double",
      description: "Double a number.",
      inputSchema: {
        type: "object",
        properties: { value: { type: "number" } },
        required: ["value"],
        additionalProperties: false,
      },
    }),
  };
}

/** The executor calls the tool the code names, so the gate and the journal are exercised. */
function executorFor(): ScriptedExecutor {
  return new ScriptedExecutor({
    handler: async (code, options) => {
      if (code.includes("final_answer")) return finalAnswerResult("The answer is 42.");
      const wrapped = options.tools.get("double");
      if (wrapped === undefined) throw new Error("the executor was given no double tool");
      await wrapped.execute(
        { value: 21 },
        {
          signal: new AbortController().signal,
          fetch: globalThis.fetch,
          callId: "c-double",
          stepIndex: options.stepIndex,
          logger: noopLogger,
        },
      );
      return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 1 };
    },
  });
}

function temporaryDirectory(): string {
  return mkdtempSync(join(tmpdir(), "smolagent-resume-"));
}

async function storedRecord(directory: string, runId: string) {
  const stored = await new FileRunStore(nodeRunFileSystem(directory)).load(runId);
  if (stored === undefined) throw new Error("the state directory holds no record for " + runId);
  return translateRecord(stored, runId);
}

describe("runSmolagent durability", () => {
  it("parks a durable run with exit code 3, then resumes it and finishes with exit code 0", async () => {
    const directory = temporaryDirectory();
    try {
      const counter = { calls: 0 };
      const first: string[] = [];
      const parked = await runSmolagent({
        prompt: "Double 21, then answer.",
        model: new MockModel([TOOL_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        runId: "run-1",
        stateDir: directory,
        verbosityLevel: 1,
        out: (text) => {
          first.push(text);
        },
      });

      expect(parked).toBe(3);
      expect(first.join("")).toContain("Run waiting");
      expect(counter.calls).toBe(0);
      const waiting = await storedRecord(directory, "run-1");
      expect(waiting.status).toBe("waiting");
      const requestId = waiting.pending?.requestId;
      if (requestId === undefined) throw new Error("the parked record names no request");
      expect(requestId).not.toBe("");

      const second: string[] = [];
      const model = new MockModel([ANSWER_REPLY]);
      const finished = await runSmolagent({
        model,
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        resume: "run-1",
        approve: requestId,
        stateDir: directory,
        verbosityLevel: 1,
        out: (text) => {
          second.push(text);
        },
      });

      expect(finished).toBe(0);
      expect(second.join("")).toContain("Final answer: The answer is 42.");
      expect(counter.calls).toBe(1);
      // The parked step's model request was replayed, so the second model answers only the next step.
      expect(model.callCount).toBe(1);
      const settled = await storedRecord(directory, "run-1");
      expect(settled.status).toBe("completed");
      expect(settled.pending).toBeUndefined();
      expect(settled.settlements?.map((entry) => entry.outcome)).toEqual(["allowed-once"]);
      const effect = (settled.journal ?? []).find((entry) => entry.toolName === "double");
      expect(effect?.state).toBe("done");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("tags a fresh run with its conversation and resumes the newest one", async () => {
    const directory = temporaryDirectory();
    try {
      // A conversation with no run starts one and records it.
      const started = await runSmolagent({
        prompt: "Answer only.",
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        tools: [],
        conversation: "conv-1",
        stateDir: directory,
        out: () => {},
      });
      expect(started).toBe(0);
      const store = new FileRunStore(nodeRunFileSystem(directory));
      const first = await store.latestForConversation("conv-1");
      expect(first?.conversationId).toBe("conv-1");
      expect(first?.status).toBe("completed");

      // A second run of the same conversation, under its own id: it parks, so the next
      // --conversation lookup has to choose it instead of starting a third run.
      const counter = { calls: 0 };
      const parked = await runSmolagent({
        prompt: "Double 21, then answer.",
        model: new MockModel([TOOL_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        runId: "run-b",
        conversation: "conv-1",
        stateDir: directory,
        out: () => {},
      });
      expect(parked).toBe(3);
      const waiting = await storedRecord(directory, "run-b");
      expect(waiting.conversationId).toBe("conv-1");
      expect(waiting.status).toBe("waiting");
      expect((await store.latestForConversation("conv-1"))?.runId).toBe("run-b");

      const requestId = waiting.pending?.requestId;
      if (requestId === undefined) throw new Error("the parked record names no request");
      const errors: string[] = [];
      const finished = await runSmolagent({
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        conversation: "conv-1",
        approve: requestId,
        stateDir: directory,
        out: () => {},
        err: (text) => errors.push(text),
      });

      expect(finished, errors.join("")).toBe(0);
      expect(counter.calls).toBe(1);
      const settled = await storedRecord(directory, "run-b");
      expect(settled.status).toBe("completed");
      // Three invocations, two runs: the third resumed the second rather than starting one.
      expect((await nodeRunFileSystem(directory).list()).length).toBe(2);
      expect((await store.latestForConversation("conv-1"))?.runId).toBe("run-b");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("forks a completed run from a named step without re-running its effect", async () => {
    const directory = temporaryDirectory();
    try {
      const counter = { calls: 0 };
      const parked = await runSmolagent({
        prompt: "Double 21, then answer.",
        model: new MockModel([TOOL_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        runId: "parent-fork",
        stateDir: directory,
        out: () => {},
      });
      expect(parked).toBe(3);
      const waiting = await storedRecord(directory, "parent-fork");
      const requestId = waiting.pending?.requestId;
      if (requestId === undefined) throw new Error("the parked record names no request");
      const finished = await runSmolagent({
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        resume: "parent-fork",
        approve: requestId,
        stateDir: directory,
        out: () => {},
      });
      expect(finished).toBe(0);
      expect(counter.calls).toBe(1);

      const forked = await runSmolagent({
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        runId: "child-fork",
        fork: { fromRunId: "parent-fork", atStep: 0 },
        stateDir: directory,
        out: () => {},
      });

      expect(forked).toBe(0);
      const child = await storedRecord(directory, "child-fork");
      expect(child.status).toBe("completed");
      expect(child.parentRunId).toBe("parent-fork");
      expect(child.parentStep).toBe(0);
      expect(counter.calls).toBe(1);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("refuses a resume when the state directory does not exist", async () => {
    const parent = temporaryDirectory();
    try {
      const errors: string[] = [];
      const code = await runSmolagent({
        model: new MockModel([]),
        executor: executorFor(),
        resume: "run-1",
        stateDir: join(parent, "absent"),
        out: () => {},
        err: (text) => {
          errors.push(text);
        },
      });

      expect(code).toBe(1);
      expect(errors.join("")).toContain("state directory");
      expect(errors.join("")).toContain("--state-dir");
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it("refuses a resume for a run the store does not hold", async () => {
    const directory = temporaryDirectory();
    try {
      const errors: string[] = [];
      const code = await runSmolagent({
        model: new MockModel([]),
        executor: executorFor(),
        resume: "run-missing",
        stateDir: directory,
        out: () => {},
        err: (text) => {
          errors.push(text);
        },
      });

      expect(code).toBe(1);
      expect(errors.join("")).toContain("no record for run");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
