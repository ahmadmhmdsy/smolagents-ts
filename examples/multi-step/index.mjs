#!/usr/bin/env node
/**
 * A CodeAgent that needs more than one step. The model writes a program, the QuickJS
 * executor runs it in a WASM realm, and a tool call inside the program comes back to the
 * host. Step one adds two numbers and logs the sum; step two multiplies that sum by four
 * and calls final_answer. The model is scripted, so the example needs no provider and no
 * network; the executor and both tools are real.
 *
 * Run: node index.mjs
 */
import { pathToFileURL } from "node:url";
import { CODE_FENCE, CodeAgent, MockModel, extractThought, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

const TASK = "Add 2 and 3, multiply the sum by 4, and answer with the number.";

const add = tool({
  name: "add",
  description: "Add two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a + b,
});

const multiply = tool({
  name: "multiply",
  description: "Multiply two numbers.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => a * b,
});

// Step one uses the first tool and prints what it saw. Step two reads that observation
// back, uses the second tool, and ends the run.
const addCode = ["const sum = await add({ a: 2, b: 3 });", 'console.log("sum is " + sum);'].join(
  "\n",
);
const multiplyCode = [
  "const product = await multiply({ a: 5, b: 4 });",
  "final_answer(product);",
].join("\n");

function turn(thought, code) {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

const model = new MockModel([
  turn("I need the sum of 2 and 3 before I can multiply it.", addCode),
  turn("The log says the sum is 5, so multiply 5 by 4 and answer.", multiplyCode),
]);

export async function main() {
  const executor = new QuickJSExecutor();
  try {
    const agent = new CodeAgent({ model, executor, tools: [add, multiply], maxSteps: 5 });
    return await agent.run(TASK);
  } finally {
    await executor.dispose();
  }
}

/** One typed step, rendered as lines a caller can read back. */
function stepLines(step) {
  if (step.kind !== "action") return [step.kind];
  const calls = step.toolCalls.map((call) => call.name + " -> " + JSON.stringify(call.result));
  return [
    "action",
    "  thought:     " + JSON.stringify(extractThought(step.modelOutput ?? "")),
    "  code:        " + JSON.stringify(step.codeAction),
    "  tool calls:  " + (calls.length === 0 ? "(none)" : calls.join(", ")),
    "  observation: " + JSON.stringify(step.observations),
  ];
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await main();
  console.log("typed steps (" + result.steps.length + "):");
  for (const [index, step] of result.steps.entries()) {
    const [head, ...rest] = stepLines(step);
    console.log(String(index + 1) + ". " + head);
    for (const line of rest) console.log("   " + line);
  }
  console.log("final output: " + JSON.stringify(result.output));
}
