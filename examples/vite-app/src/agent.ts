import { CODE_FENCE, CodeAgent, FINAL_ANSWER_TOOL_NAME, MockModel, ToolCallingAgent, tool } from "smolagents-ts";
import { GeminiModel } from "smolagents-ts/models";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";
import { z } from "zod";

/** The task the scripted model answers. */
export const DEMO_TASK = "Greet the world, then answer with the greeting.";

/** The model the live mode asks when the dev server names no other. */
export const DEFAULT_LIVE_MODEL = "gemini-3.5-flash-lite";

/**
 * Where the live mode sends its requests: the dev server's own path, never the provider's.
 * The proxy holds the key, so the page never does.
 */
export const LIVE_BASE_PATH = "/api/gemini";

const greet = tool({
  name: "greet",
  description: "Greet one person by name.",
  inputSchema: z.object({ name: z.string() }),
  execute: ({ name }) => "Hello, " + name + "!",
});

const add = tool({
  name: "add",
  description: "Add two numbers and return their sum.",
  inputSchema: z.object({ a: z.number(), b: z.number() }),
  execute: ({ a, b }) => String(a + b),
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

export interface LiveRunOptions {
  /** Everything before "/models/" in the provider URL — here, the dev server's proxy. */
  readonly baseUrl: string;
  readonly model?: string | undefined;
}

/**
 * One live run. The model is a real provider reached through the dev server's proxy, and the
 * executor is the same real QuickJS one, so the code the model writes is sandboxed here too.
 *
 * The tool set is deliberately local: a browser request to a search or scrape endpoint would
 * have to clear CORS first, so the live mode exercises the loop, the sandbox and the tool
 * bridge rather than the network.
 */
export function createLiveRun(options: LiveRunOptions): DemoRun {
  const executor = new QuickJSExecutor();
  const model = new GeminiModel({
    model: options.model ?? DEFAULT_LIVE_MODEL,
    baseUrl: options.baseUrl,
  });
  return { agent: new CodeAgent({ model, executor, tools: [greet, add] }), executor };
}

/** The child the delegation demo hands work to: its own loop, its own scripted model. */
function createChildAgent(): ToolCallingAgent {
  const call = (name: string, args: object, id: string) => ({
    id,
    name,
    arguments: JSON.stringify(args),
  });
  return new ToolCallingAgent({
    tools: [greet],
    model: new MockModel([
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [call("greet", { name: "world" }, "c1")],
      },
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer: "Hello, world!" }, "c2")],
      },
    ]),
  });
}

/**
 * One scripted delegation. The parent's program calls the child agent as a sandbox function and
 * answers with the report that child's run returned. The sandbox is the real QuickJS one, so this
 * shows the whole path: generated code calls a team member, the child runs its own loop, and its
 * report folds back as the parent's answer.
 */
export function createDelegationRun(): DemoRun {
  const executor = new QuickJSExecutor();
  const model = new MockModel([
    turn(
      "delegate the greeting to the researcher and answer with its report.",
      [
        'const report = await researcher({ task: "greet the world" });',
        "console.log(report);",
        "final_answer(report);",
      ].join("\n"),
    ),
  ]);
  const agent = new CodeAgent({
    model,
    executor,
    tools: [greet],
    managedAgents: [
      { name: "researcher", description: "Greets people and reports back.", agent: createChildAgent() },
    ],
  });
  return { agent, executor };
}
