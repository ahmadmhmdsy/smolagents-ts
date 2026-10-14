#!/usr/bin/env node
/**
 * The same task as examples/multi-step, driven the other way. A ToolCallingAgent does not
 * execute code: the model answers with structured tool calls and the loop invokes them in
 * the host. Step one calls add; step two calls multiply and final_answer in one reply.
 * The model is scripted, so the example runs offline; both tools are real.
 *
 * Run: node index.mjs
 */
import { pathToFileURL } from "node:url";
import { FINAL_ANSWER_TOOL_NAME, MockModel, ToolCallingAgent, tool } from "smolagents-ts";
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

/** The provider sends these as an assistant turn; arguments is the raw JSON string. */
function call(id, name, args) {
  return { id, name, arguments: JSON.stringify(args) };
}

const model = new MockModel([
  {
    content: "",
    toolCalls: [call("call-1", "add", { a: 2, b: 3 })],
    finishReason: "tool_calls",
  },
  {
    content: "",
    toolCalls: [
      call("call-2", "multiply", { a: 5, b: 4 }),
      call("call-3", FINAL_ANSWER_TOOL_NAME, { answer: 20 }),
    ],
    finishReason: "tool_calls",
  },
]);

export async function main() {
  const agent = new ToolCallingAgent({ model, tools: [add, multiply], maxSteps: 5 });
  return await agent.run(TASK);
}

/** One typed step, rendered as lines a caller can read back. */
function stepLines(step) {
  if (step.kind !== "action") return [step.kind];
  const calls = step.toolCalls.map(
    (call) => call.name + "(" + JSON.stringify(call.arguments) + ") -> " + JSON.stringify(call.result),
  );
  return [
    "action",
    "  tool calls:  " + (calls.length === 0 ? "(none)" : calls.join(", ")),
    "  observation: " + JSON.stringify(step.observations),
    "  final:       " + step.isFinalAnswer,
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
