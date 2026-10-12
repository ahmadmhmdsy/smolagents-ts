import { describe, expect, it } from "vitest";
import {
  ActionStep,
  FinalAnswerStep,
  PlanningStep,
  SystemPromptStep,
  TaskStep,
} from "../src/memory/steps.js";

describe("memory steps", () => {
  it("each step reports its kind", () => {
    expect(new TaskStep("do it").kind).toBe("task");
    expect(new SystemPromptStep("you are").kind).toBe("system_prompt");
    expect(new PlanningStep("plan").kind).toBe("planning");
    expect(new ActionStep("model said this").kind).toBe("action");
    expect(new FinalAnswerStep(42).kind).toBe("final_answer");
  });

  it("assigns a unique id and a creation timestamp", () => {
    const a = new TaskStep("a");
    const b = new TaskStep("b");
    expect(a.id).not.toBe(b.id);
    expect(a.createdAt).toBeGreaterThan(0);
  });

  it("keeps the payload it was given", () => {
    expect(new TaskStep("do it").task).toBe("do it");
    expect(new SystemPromptStep("you are").systemPrompt).toBe("you are");
    expect(new PlanningStep("plan").plan).toBe("plan");
    expect(new FinalAnswerStep({ n: 1 }).output).toEqual({ n: 1 });
  });

  it("defaults ActionStep fields to null and an empty call list", () => {
    const step = new ActionStep("raw output");
    expect(step.modelOutput).toBe("raw output");
    expect(step.codeAction).toBeNull();
    expect(step.observations).toBeNull();
    expect(step.toolCalls).toEqual([]);
    expect(step.error).toBeUndefined();
  });

  it("allows ActionStep fields to be filled in after construction", () => {
    const step = new ActionStep("raw output");
    step.codeAction = "final_answer(1)";
    step.observations = "1";
    step.isFinalAnswer = false;
    expect(step.codeAction).toBe("final_answer(1)");
    expect(step.observations).toBe("1");
  });
});
