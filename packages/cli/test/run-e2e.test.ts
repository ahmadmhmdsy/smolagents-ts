import { CODE_FENCE, MockModel, ScriptedExecutor, finalAnswerResult } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { runSmolagent } from "../src/run.js";

const PROGRAM = 'final_answer("The answer is 42.")';
const REPLY =
  "Thought: I know the answer.\nCode:\n" + CODE_FENCE + "\n" + PROGRAM + "\n" + CODE_FENCE;

describe("runSmolagent end to end", () => {
  it("drives the real CodeAgent with MockModel and ScriptedExecutor", async () => {
    const model = new MockModel([REPLY]);
    const executor = new ScriptedExecutor({
      handler: () => finalAnswerResult("The answer is 42."),
    });
    const chunks: string[] = [];

    const code = await runSmolagent({
      prompt: "What is the answer?",
      model,
      executor,
      tools: [],
      verbosityLevel: 1,
      out: (text) => {
        chunks.push(text);
      },
    });

    const rendered = chunks.join("");
    expect(code).toBe(0);
    expect(rendered).toContain("Task: What is the answer?");
    expect(rendered).toContain("Final answer: The answer is 42.");
    expect(executor.executed).toEqual([PROGRAM]);
    expect(model.callCount).toBe(1);
  });

  it("answers 1 and explains when a tool name is refused", async () => {
    const model = new MockModel([REPLY]);
    const executor = new ScriptedExecutor({ handler: () => finalAnswerResult("x") });
    const errors: string[] = [];

    const code = await runSmolagent({
      prompt: "go",
      model,
      executor,
      tools: ["python_interpreter"],
      out: () => {},
      err: (text) => {
        errors.push(text);
      },
    });

    expect(code).toBe(1);
    expect(errors.join("")).toContain("python_interpreter");
    expect(executor.executed).toEqual([]);
  });

  it("answers 1 for an action type it does not implement", async () => {
    const model = new MockModel([REPLY]);
    const executor = new ScriptedExecutor({ handler: () => finalAnswerResult("x") });
    const errors: string[] = [];

    const code = await runSmolagent({
      prompt: "go",
      model,
      executor,
      tools: [],
      actionType: "python",
      out: () => {},
      err: (text) => {
        errors.push(text);
      },
    });

    expect(code).toBe(1);
    expect(errors.join("")).toContain("Unsupported action type");
  });
});
