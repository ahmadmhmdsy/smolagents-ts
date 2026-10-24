import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import type { ApprovalHandler } from "../src/agent/approval.js";
import type { AgentEvent } from "../src/events.js";
import { translateRecord, type RunRecord } from "../src/session/run-record.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(args: unknown, id: string): ToolCallRequest {
  return { id, name: "count", arguments: JSON.stringify(args) };
}

function countTurn(id: string) {
  return { content: "", finishReason: "tool_calls" as const, toolCalls: [call({}, id)] };
}

function answerTurn(value: unknown): {
  content: string;
  finishReason: "tool_calls";
  toolCalls: ToolCallRequest[];
} {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [
      { id: "answer", name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer: value }) },
    ],
  };
}

/** A tool whose call count is the proof that a replayed effect did not run again. */
function countingTool(): { tool: ReturnType<typeof tool>; calls: () => number } {
  let calls = 0;
  const counted = tool({
    name: "count",
    description: "Count one more call.",
    inputSchema: z.object({}),
    execute: () => {
      calls += 1;
      return calls;
    },
  });
  return { tool: counted, calls: () => calls };
}

function recordOf(store: MemoryRunStore, runId: string): RunRecord {
  const stored = store.load(runId);
  if (stored === undefined) throw new Error("no record for " + runId);
  return translateRecord(stored, runId);
}

describe("fork from a named step", () => {
  it("replays the copied step's effect, names the parent, and finishes under its own id", async () => {
    const store = new MemoryRunStore();
    const counted = countingTool();
    const parent = new ToolCallingAgent({
      model: new MockModel([
        countTurn("c0"),
        countTurn("c1"),
        countTurn("c2"),
        answerTurn(3),
      ]),
      tools: [counted.tool],
      store,
    });
    const parentResult = await parent.run("count", { runId: "parent-run" });
    expect(parentResult.output).toBe(3);
    expect(counted.calls()).toBe(3);
    const parentRecord = recordOf(store, "parent-run");
    const parentStepOne = parentRecord.completed?.find((step) => step.index === 1);
    if (parentStepOne === undefined) throw new Error("the parent has no step 1");

    const forked = new ToolCallingAgent({
      model: new MockModel([answerTurn("forked")]),
      tools: [counted.tool],
      store,
    });
    const childResult = await forked.run("count", {
      runId: "child-run",
      fork: { fromRunId: "parent-run", atStep: 1 },
    });

    expect(childResult.output).toBe("forked");
    expect(childResult.runId).toBe("child-run");
    const child = recordOf(store, "child-run");
    expect(child.status).toBe("completed");
    expect(child.parentRunId).toBe("parent-run");
    expect(child.parentStep).toBe(1);
    // The parent's step-1 effect is in the child's journal with its result, and did not run again.
    const replayed = child.journal?.filter((entry) => entry.stepId === parentStepOne.stepId) ?? [];
    expect(replayed.map((entry) => entry.state)).toEqual(["done", "done"]);
    expect(replayed.find((entry) => entry.toolName === "count")?.result).toEqual({
      ok: true,
      output: 2,
    });
    expect(counted.calls()).toBe(3);
    // The parent is untouched.
    expect(recordOf(store, "parent-run").parentRunId).toBeUndefined();
  });

  it("clears the pending request a waiting parent would otherwise lend the fork", async () => {
    const store = new MemoryRunStore();
    const counted = countingTool();
    let decisions = 0;
    const approve: ApprovalHandler = (request) => {
      decisions += 1;
      return {
        requestId: request.requestId,
        digest: request.digest,
        outcome: decisions === 1 ? "allowed-once" : "pending",
      };
    };
    const parent = new ToolCallingAgent({
      model: new MockModel([countTurn("c0"), countTurn("c1")]),
      tools: [counted.tool],
      store,
      approve,
    });
    const events: AgentEvent[] = [];
    for await (const event of parent.stream("count", { runId: "parent-wait" })) events.push(event);
    const parentRecord = recordOf(store, "parent-wait");
    expect(parentRecord.status).toBe("waiting");
    expect(parentRecord.pending).toBeDefined();
    expect(counted.calls()).toBe(1);

    const forked = new ToolCallingAgent({
      model: new MockModel([answerTurn("forked")]),
      tools: [counted.tool],
      store,
    });
    const childResult = await forked.run("count", {
      runId: "child-wait",
      fork: { fromRunId: "parent-wait", atStep: 0 },
    });

    expect(childResult.output).toBe("forked");
    const child = recordOf(store, "child-wait");
    expect(child.status).toBe("completed");
    expect(child.parentRunId).toBe("parent-wait");
    expect(child.parentStep).toBe(0);
    expect(child.pending).toBeUndefined();
    expect(child.owner).toBeUndefined();
    // The replayed step-0 effect did not run again on the way out.
    expect(counted.calls()).toBe(1);
  });
});
