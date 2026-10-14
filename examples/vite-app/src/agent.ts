import { CODE_FENCE, CodeAgent, MockModel, tool } from "smolagents-ts";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

/** The task the scripted model answers. */
export const DEMO_TASK = "Greet the world, then answer with the greeting.";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

export interface DemoRun {
  readonly agent: CodeAgent;
  readonly executor: QuickJSExecutor;
}

const turn = (thought: string, program: string): string =>
  ["Thought: " + thought, "Code:", CODE_FENCE, program, CODE_FENCE].join("\n");

/**
 * One scripted run. The model writes a program that calls the tool and logs the greeting,
 * then a second program that answers with the variable the first one declared — the realm is
 * shared between steps, so that variable is still there.
 *
 * Only the model is scripted: the executor is the real QuickJS one, so the code in the middle
 * is really sandboxed JavaScript, and the page needs no provider, no key and no network.
 */
export function createDemoRun(): DemoRun {
  const executor = new QuickJSExecutor();
  const model = new MockModel([
    turn(
      "call the tool, then read the greeting back from the log.",
      ['const greeting = await greet({ name: "world" });', "console.log(greeting);"].join("\n"),
    ),
    turn("answer with the greeting from the last step.", "final_answer(greeting);"),
  ]);
  return { agent: new CodeAgent({ model, executor, tools: [greet] }), executor };
}
