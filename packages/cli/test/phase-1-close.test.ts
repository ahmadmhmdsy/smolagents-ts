/**
 * The Phase 1 exit criterion, as tests: one process parks a durable run on an approval, a second
 * reads the record, is refused a competing claim, resumes and finishes; and a process that dies
 * after a journaled tool effect is repaired by a later process without running that effect twice.
 */
import {
  CODE_FENCE,
  CodeAgent,
  FileRunStore,
  MockModel,
  RUN_RECORD_VERSION,
  RunClaimedError,
  ScriptedExecutor,
  finalAnswerResult,
  noopLogger,
  translateRecord,
  type RunRecord,
  type RunStore,
  type StoredRun,
  type Tool,
} from "@smolagents-ts/core";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runSmolagent } from "../src/run.js";
import { loadTools } from "../src/tool-factory.js";
import { nodeRunFileSystem } from "../src/store.js";

const ANSWER_REPLY = [
  "Thought: done.",
  "Code:",
  CODE_FENCE,
  "javascript",
  'final_answer("finished");',
  CODE_FENCE,
].join("\n");

const TOOL_REPLY = [
  "Thought: double the number.",
  "Code:",
  CODE_FENCE,
  "javascript",
  "const doubled = double(21);",
  CODE_FENCE,
].join("\n");

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

function executorFor(): ScriptedExecutor {
  return new ScriptedExecutor({
    handler: async (code, options) => {
      if (code.includes("final_answer")) return finalAnswerResult("finished");
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
  return mkdtempSync(join(tmpdir(), "smolagent-phase-close-"));
}

async function storedRecord(directory: string, runId: string): Promise<RunRecord> {
  const stored = await new FileRunStore(nodeRunFileSystem(directory)).load(runId);
  if (stored === undefined) throw new Error("the state directory holds no record for " + runId);
  return translateRecord(stored, runId);
}

/** A store that dies on the first commit after a tool result reached the record. */
class CrashingStore implements RunStore {
  private readonly inner: FileRunStore;
  private sawToolResult = false;
  private readonly crashed = new Error("the process died after the tool ran");

  constructor(directory: string) {
    this.inner = new FileRunStore(nodeRunFileSystem(directory));
  }

  async commit(runId: string, record: RunRecord, expectedGeneration?: number): Promise<void> {
    // A dead process writes nothing more: the record stays at the last commit before the crash.
    if (this.sawToolResult) throw this.crashed;
    await this.inner.commit(runId, record, expectedGeneration);
    if ((record.journal ?? []).some((entry) => entry.state === "done" && entry.toolName !== "")) {
      this.sawToolResult = true;
    }
  }

  load(runId: string): Promise<StoredRun | undefined> {
    return this.inner.load(runId);
  }

  claim(runId: string, expectedGeneration: number, owner: string): Promise<RunRecord> {
    return this.inner.claim(runId, expectedGeneration, owner);
  }

  watch(runId: string, listener: (record: RunRecord) => void): () => void {
    return this.inner.watch(runId, listener);
  }

  latestForConversation(conversationId: string): Promise<RunRecord | undefined> {
    return this.inner.latestForConversation(conversationId);
  }
}

describe("Phase 1 exit criterion", () => {
  it("parks in one process, refuses a competing claim, and finishes in a second", async () => {
    const directory = temporaryDirectory();
    try {
      const counter = { calls: 0 };
      const parked = await runSmolagent({
        prompt: "Double 21, then answer.",
        model: new MockModel([TOOL_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        runId: "close-run",
        stateDir: directory,
        out: () => {},
      });
      expect(parked).toBe(3);
      const waiting = await storedRecord(directory, "close-run");
      expect(waiting.status).toBe("waiting");
      expect(counter.calls).toBe(0);

      // The second process reads the same file: the fence refuses a writer at another generation,
      // and only the recorded generation can be claimed.
      const store = new FileRunStore(nodeRunFileSystem(directory));
      await expect(
        store.claim("close-run", waiting.generation + 1, "other-process"),
      ).rejects.toBeInstanceOf(RunClaimedError);
      const claimed = await store.claim("close-run", waiting.generation, "second-process");
      expect(claimed.owner).toBe("second-process");

      const requestId = waiting.pending?.requestId;
      if (requestId === undefined) throw new Error("the parked record names no request");
      const finished = await runSmolagent({
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        resume: "close-run",
        approve: requestId,
        stateDir: directory,
        out: () => {},
      });

      expect(finished).toBe(0);
      expect(counter.calls).toBe(1);
      const done = await storedRecord(directory, "close-run");
      expect(done.status).toBe("completed");
      expect(done.settlements?.map((entry) => entry.outcome)).toEqual(["allowed-once"]);
      expect(done.owner).toBeUndefined();
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("repairs a process that died after a journaled tool effect without repeating it", async () => {
    const directory = temporaryDirectory();
    try {
      const counter = { calls: 0 };
      const store = new CrashingStore(directory);
      const crashed = new CodeAgent({
        model: new MockModel([TOOL_REPLY]),
        tools: [doubleTool(counter)],
        executor: executorFor(),
        store,
      });
      await expect(crashed.run("Double 21, then answer.", { runId: "crash-run" })).rejects.toThrow(
        /the process died after the tool ran/,
      );

      const broken = await storedRecord(directory, "crash-run");
      expect(broken.status).toBe("running");
      expect(broken.step?.stepId).toBeDefined();
      expect(
        broken.journal?.some((entry) => entry.toolName === "double" && entry.state === "done"),
      ).toBe(true);
      expect(broken.memory.steps.some((step) => step.kind === "action")).toBe(false);
      expect(counter.calls).toBe(1);

      const finished = await runSmolagent({
        model: new MockModel([ANSWER_REPLY]),
        executor: executorFor(),
        toolset: [doubleTool(counter)],
        resume: "crash-run",
        stateDir: directory,
        out: () => {},
      });

      expect(finished).toBe(0);
      // The tool result came from the journal, not from a second execution.
      expect(counter.calls).toBe(1);
      const repaired = await storedRecord(directory, "crash-run");
      expect(repaired.status).toBe("completed");
      expect(repaired.completed?.[0]?.state).toBe("interrupted");
      expect(repaired.schemaVersion).toBe(RUN_RECORD_VERSION);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("watches a record file another store writes", async () => {
    const directory = temporaryDirectory();
    try {
      const writer = new FileRunStore(nodeRunFileSystem(directory));
      const watcher = new FileRunStore(nodeRunFileSystem(directory));
      const seen: RunRecord[] = [];
      const stop = watcher.watch("run-watch", (record) => seen.push(record));

      await writer.commit("run-watch", {
        schemaVersion: RUN_RECORD_VERSION,
        runId: "run-watch",
        status: "running",
        generation: 0,
        memory: { steps: [] },
      });
      const deadline = Date.now() + 3_000;
      while (seen.length === 0 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      stop();

      expect(seen.length).toBeGreaterThan(0);
      expect(seen[0]?.runId).toBe("run-watch");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
