import { describe, expect, it } from "vitest";
import { ToolCallingAgent, FINAL_ANSWER_TOOL_NAME } from "../src/agent/tool-calling-agent.js";
import { AgentSession } from "../src/session/agent-session.js";
import { MemoryRunStore } from "../src/session/run-store.js";
import { MockModel, type MockTurnInput } from "../src/testing/mock-model.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id = "c1"): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

function answer(value: unknown, id = "c1"): MockTurnInput {
  return {
    content: "",
    finishReason: "tool_calls",
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: value }, id)],
  };
}

describe("AgentSession persistence", () => {
  it("lets a second run read the first run's memory through the store", async () => {
    const store = new MemoryRunStore();

    const first = new AgentSession(
      new ToolCallingAgent({ model: new MockModel([answer("41")]), store }),
      { checkpoint: "chat" },
    );
    await first.send("remember the number 41");

    // A brand-new agent and session, naming the same checkpoint, resume the first run's memory.
    const second = new AgentSession(
      new ToolCallingAgent({ model: new MockModel([answer("done")]), store }),
      { checkpoint: "chat" },
    );
    const result = await second.send("what number did I ask you to remember?");

    expect(result.output).toBe("done");
    expect(
      result.steps.some((step) => step.kind === "task" && step.task === "remember the number 41"),
    ).toBe(true);
  });

  it("starts each turn fresh when no checkpoint is named", async () => {
    const store = new MemoryRunStore();
    const session = new AgentSession(
      new ToolCallingAgent({ model: new MockModel([answer("1"), answer("2")]), store }),
    );

    await session.send("first");
    const result = await session.send("second");

    expect(result.steps.filter((step) => step.kind === "task")).toHaveLength(1);
    expect(result.steps.some((step) => step.kind === "task" && step.task === "first")).toBe(false);
  });
});
