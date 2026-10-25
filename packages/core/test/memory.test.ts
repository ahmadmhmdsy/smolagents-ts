import { describe, expect, it } from "vitest";
import { AgentMemory } from "../src/memory/memory.js";
import {
  ActionStep,
  CondensationStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from "../src/memory/steps.js";

function seeded(): AgentMemory {
  const memory = new AgentMemory();
  memory.addStep(new TaskStep("What is 2 + 2?"));
  memory.addStep(new SystemPromptStep("You are a helpful agent."));
  return memory;
}

describe("AgentMemory", () => {
  it("starts empty", () => {
    expect(new AgentMemory().steps).toEqual([]);
  });

  it("appends steps in order", () => {
    const memory = seeded();
    expect(memory.steps.map((s) => s.kind)).toEqual(["task", "system_prompt"]);
  });

  it("exposes the task and the system prompt", () => {
    const memory = seeded();
    expect(memory.task).toBe("What is 2 + 2?");
    expect(memory.systemPrompt).toBe("You are a helpful agent.");
  });

  it("resets to empty", () => {
    const memory = seeded();
    memory.reset();
    expect(memory.steps).toEqual([]);
    expect(memory.task).toBeUndefined();
  });

  it("returns a frozen snapshot, so a caller cannot mutate memory", () => {
    const memory = seeded();
    const snapshot = memory.steps;
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(() => {
      (snapshot as TaskStep[]).push(new TaskStep("sneaky"));
    }).toThrow();
    expect(memory.steps).toHaveLength(2);
  });
});

describe("toMessages", () => {
  it("puts the system prompt first, then the task", () => {
    const memory = seeded();
    expect(memory.toMessages()).toEqual([
      { role: "system", content: "You are a helpful agent." },
      { role: "user", content: "What is 2 + 2?" },
    ]);
  });

  it("renders a planning step as an assistant turn plus a nudge", () => {
    const memory = seeded();
    memory.addStep(new PlanningStep("Step 1: add."));
    const messages = memory.toMessages();
    expect(messages[2]).toEqual({ role: "assistant", content: "Plan:\nStep 1: add." });
    expect(messages[3]).toEqual({ role: "user", content: "Now proceed with the plan." });
  });

  it("renders an action step as the model output plus the observation", () => {
    const memory = seeded();
    const action = new ActionStep("Thought: I will compute.\nCode: console.log(4)");
    action.observations = "4";
    memory.addStep(action);
    const messages = memory.toMessages();
    expect(messages[2]).toEqual({ role: "assistant", content: "Thought: I will compute.\nCode: console.log(4)" });
    expect(messages[3]).toEqual({ role: "user", content: "Observation:\n4" });
  });

  it("omits an action step with no model output", () => {
    const memory = seeded();
    memory.addStep(new ActionStep(null));
    expect(memory.toMessages()).toHaveLength(2);
  });

  it("renders tool calls and their results when asked for the tool-message form", () => {
    const memory = seeded();
    const action = new ActionStep("");
    action.observations = "Tool add returned: 5";
    action.toolCalls = [{ id: "call_1", name: "add", arguments: { a: 2, b: 3 }, result: 5 }];
    memory.addStep(action);

    const messages = memory.toMessages({ toolResults: "tool-messages" });

    expect(messages[2]).toEqual({
      role: "assistant",
      content: "",
      toolCalls: [{ id: "call_1", name: "add", arguments: '{"a":2,"b":3}' }],
    });
    expect(messages[3]).toEqual({ role: "tool", toolCallId: "call_1", name: "add", content: "5" });
  });

  it("keeps the Observation form when tool messages were not asked for", () => {
    const memory = seeded();
    const action = new ActionStep("code");
    action.observations = "tool said 5";
    action.toolCalls = [{ id: "call_1", name: "add", arguments: {}, result: 5 }];
    memory.addStep(action);

    expect(memory.toMessages().map((message) => message.role)).toEqual([
      "system",
      "user",
      "assistant",
      "user",
    ]);
  });

  it("reports a failed call as an error string in the tool message", () => {
    const memory = seeded();
    const action = new ActionStep("");
    action.toolCalls = [{ id: "call_1", name: "explode", arguments: {}, error: "tool exploded" }];
    memory.addStep(action);

    expect(memory.toMessages({ toolResults: "tool-messages" })[3]).toEqual({
      role: "tool",
      toolCallId: "call_1",
      name: "explode",
      content: "Error: tool exploded",
    });
  });

  it("stops at the final answer", () => {
    const memory = seeded();
    memory.addStep(new FinalAnswerStep(4));
    expect(memory.toMessages()).toHaveLength(2);
  });
});

describe("toChatMessages", () => {
  it("renders the task as a user turn and the final answer as an assistant turn", () => {
    const memory = seeded();
    memory.addStep(new ActionStep("thinking"));
    memory.addStep(new FinalAnswerStep(4));
    expect(memory.toChatMessages()).toEqual([
      { role: "user", content: "What is 2 + 2?" },
      { role: "assistant", content: "thinking" },
      { role: "assistant", content: "4" },
    ]);
  });

  it("stringifies a non-string final answer", () => {
    const memory = seeded();
    memory.addStep(new FinalAnswerStep({ a: 1 }));
    expect(memory.toChatMessages()[1]).toEqual({ role: "assistant", content: '{"a":1}' });
  });
});
describe("summary mode", () => {
  it("drops the system prompt, the earlier plans and the model output, keeping the task and outcomes", () => {
    const memory = new AgentMemory();
    memory.addStep(new TaskStep("Solve it."));
    memory.addStep(new SystemPromptStep("You are an agent."));
    memory.addStep(new PlanningStep("Here are the facts and the plan."));
    const action = new ActionStep("the model's reasoning");
    action.toolCalls = [{ id: "t1", name: "echo", arguments: { value: "x" }, result: "x" }];
    action.observations = "x";
    memory.addStep(action);

    const messages = memory.toMessages({ summaryMode: true });
    const text = messages.map((message) => message.content).join("\n");
    expect(messages[0]?.content).toBe("Solve it.");
    expect(text).toContain("Calling tools:");
    expect(text).toContain("Observation:");
    expect(text).not.toContain("the model's reasoning");
    expect(text).not.toContain("You are an agent.");
    expect(text).not.toContain("Here are the facts and the plan.");
    expect(messages.some((message) => message.role === "system")).toBe(false);
  });

  it("keeps a condensation summary in place of the steps it hid", () => {
    const memory = new AgentMemory();
    memory.addStep(new TaskStep("Solve it."));
    memory.addStep(new CondensationStep("Earlier: the first two steps did X.", [], "soft"));

    const messages = memory.toMessages({ summaryMode: true });
    expect(messages.some((message) => message.content.includes("Earlier: the first two steps did X."))).toBe(true);
  });
});
