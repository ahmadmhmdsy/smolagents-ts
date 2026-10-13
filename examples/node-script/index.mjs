#!/usr/bin/env node
/**
 * The smallest complete run: a CodeAgent whose model writes one program, a tool
 * the program calls, and the QuickJS executor that runs it. The model is
 * scripted, so the example needs no provider and no network; the executor is
 * the real one.
 *
 * Run: pnpm example:node
 */
import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

const program = [
  'const message = await greet({ name: "world" });',
  "final_answer(message);",
].join("\n");

const model = new MockModel([
  "Thought: greet the caller, then answer with the greeting.\nCode:\n" +
    CODE_FENCE +
    "\n" +
    program +
    "\n" +
    CODE_FENCE,
]);

export async function main() {
  const executor = new QuickJSExecutor();
  try {
    const agent = new CodeAgent({ model, executor, tools: [greet] });
    const result = await agent.run("Greet the world.");
    return result.output;
  } finally {
    await executor.dispose();
  }
}

if (import.meta.url === (await import("node:url")).pathToFileURL(process.argv[1]).href) {
  console.log(await main());
}
