import { expect, test } from "vitest";

import { main } from "../index.mjs";

test("the run reaches the same answer through structured tool calls, not code", async () => {
  const result = await main();

  expect(result.output).toBe(20);
  expect(result.state).toBe("success");

  const actions = result.steps.filter((step) => step.kind === "action");
  expect(actions).toHaveLength(2);

  // Unlike the code agent, no code was ever submitted: the action is the call itself.
  expect(actions[0].codeAction).toBeNull();
  expect(actions[0].isFinalAnswer).toBe(false);
  expect(actions[0].toolCalls).toMatchObject([{ name: "add", arguments: { a: 2, b: 3 }, result: 5 }]);

  // The second reply carried both the multiplication and the final answer.
  expect(actions[1].toolCalls.map((call) => call.name)).toEqual(["multiply", "final_answer"]);
  expect(actions[1].toolCalls[0].result).toBe(20);
  expect(actions[1].isFinalAnswer).toBe(true);
});
