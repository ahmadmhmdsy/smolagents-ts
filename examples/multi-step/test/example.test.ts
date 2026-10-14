import { expect, test } from "vitest";

import { main } from "../index.mjs";

test("the run takes two steps, calls both tools, and answers 20", async () => {
  const result = await main();

  expect(result.output).toBe(20);
  expect(result.state).toBe("success");

  const actions = result.steps.filter((step) => step.kind === "action");
  expect(actions).toHaveLength(2);

  // Step one ran in the real QuickJS executor: the guest called add and logged the sum.
  expect(actions[0].codeAction).toContain("add(");
  expect(actions[0].observations).toContain("sum is 5");
  expect(actions[0].isFinalAnswer).toBe(false);
  expect(actions[0].toolCalls.map((call) => call.name)).toEqual(["add"]);
  expect(actions[0].toolCalls[0].result).toBe(5);

  // Step two called the second tool and ended the run through final_answer.
  expect(actions[1].codeAction).toContain("multiply(");
  expect(actions[1].isFinalAnswer).toBe(true);
  expect(actions[1].toolCalls.map((call) => call.name)).toEqual(["multiply"]);
  expect(actions[1].toolCalls[0].result).toBe(20);
});
