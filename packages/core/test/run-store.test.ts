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
});
