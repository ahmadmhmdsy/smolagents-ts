/**
 * The tested examples behind `docs/guides/where-behaviour-belongs.md` (T-77). Each `it` is one
 * row of that guide's table, and the guide quotes the code between the `guide:` markers. A
 * change that breaks an example here breaks the guide, so the two cannot drift apart silently.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  CodeAgent,
  FINAL_ANSWER_TOOL_NAME,
  MemoryRunStore,
  MockModel,
  ScriptedExecutor,
  ToolCallingAgent,
  definePlugin,
  finalAnswerResult,
  tool,
  type AgentMiddleware,
  type ChatMessage,
  type CodeExecutor,
  type ExecuteOptions,
  type GenerateOptions,
  type Model,
  type RunRecord,
  type RunStore,
} from "../src/index.js";

function answerTurn(answer: unknown, id = "c-" + String(answer)) {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [{ id, name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer }) }],
  };
}

describe("where each kind of behaviour belongs", () => {
  it("Model wrapper: changes which provider answers, keeping id and provider honest", async () => {
    // guide:model-wrapper
    class LoggingModel implements Model {
      readonly log: string[] = [];
      constructor(private readonly inner: Model) {}
      // Cost, budgets and the run record key on these two, so they stay the inner model's.
      get id() { return this.inner.id; }
      get provider() { return this.inner.provider; }
      get capabilities() { return this.inner.capabilities; }
      generate(messages: readonly ChatMessage[], options?: GenerateOptions) {
        this.log.push("generate " + String(messages.length));
        return this.inner.generate(messages, options);
      }
      generateStream(messages: readonly ChatMessage[], options?: GenerateOptions) {
        this.log.push("stream " + String(messages.length));
        return this.inner.generateStream(messages, options);
      }
    }
    // guide:end

    const model = new LoggingModel(new MockModel([answerTurn(1)]));
    const result = await new ToolCallingAgent({ model }).run("answer");

    expect(result.output).toBe(1);
    expect(model.log).toHaveLength(1);
    expect(model.id).toBe("mock");
  });

  it("Plugin hook: a cross-cutting rule on an existing seam, here a check on the answer", async () => {
    // guide:plugin-hook
    const evenOnly = definePlugin({
      name: "even-only",
      version: "1.0.0",
      setup: (api) => {
        api.on("answer:check", (answer) =>
          typeof answer === "number" && answer % 2 === 1
            ? { reject: "the answer must be even" }
            : undefined,
        );
      },
    });
    // guide:end

    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1), answerTurn(2)]) });
    agent.use(evenOnly);

    expect((await agent.run("answer")).output).toBe(2);
  });

  it("Tool: a capability the model chooses to call, with a schema it is held to", async () => {
    // guide:tool
    const add = tool({
      name: "add",
      description: "Add two numbers.",
      inputSchema: z.object({ a: z.number(), b: z.number() }),
      execute: ({ a, b }) => a + b,
    });
    // guide:end

    const model = new MockModel([
      {
        content: "",
        finishReason: "tool_calls",
        toolCalls: [{ id: "c-add", name: "add", arguments: '{"a":2,"b":3}' }],
      },
      answerTurn(5),
    ]);
    const result = await new ToolCallingAgent({ model, tools: [add] }).run("add");

    expect(result.output).toBe(5);
    expect(JSON.stringify(model.calls[1])).toContain("5");
  });

  it("Executor: where and how a CodeAgent's program runs", async () => {
    // guide:executor
    class AuditedExecutor implements CodeExecutor {
      readonly programs: string[] = [];
      constructor(private readonly inner: CodeExecutor) {}
      get language() { return this.inner.language; }
      get capabilities() { return this.inner.capabilities; }
      execute(code: string, options: ExecuteOptions) {
        this.programs.push(code);
        return this.inner.execute(code, options);
      }
      async dispose() {
        await this.inner.dispose?.();
      }
    }
    // guide:end

    const executor = new AuditedExecutor(
      new ScriptedExecutor({ handler: async () => finalAnswerResult(7) }),
    );
    const model = new MockModel([{ content: "```javascript\nfinal_answer(7)\n```" }]);
    const result = await new CodeAgent({ model, executor }).run("seven");

    expect(result.output).toBe(7);
    expect(executor.programs).toEqual(["final_answer(7)"]);
  });

  it("Store: where a run's record lives, so it can be resumed or watched", async () => {
    // guide:store
    class MirroredStore implements RunStore {
      readonly commits: string[] = [];
      constructor(private readonly inner: RunStore) {}
      commit(runId: string, record: RunRecord, expectedGeneration?: number) {
        this.commits.push(runId);
        return this.inner.commit(runId, record, expectedGeneration);
      }
      load(runId: string) { return this.inner.load(runId); }
      claim(runId: string, expectedGeneration: number, owner: string) {
        return this.inner.claim(runId, expectedGeneration, owner);
      }
      latestForConversation(conversationId: string) {
        return this.inner.latestForConversation(conversationId);
      }
      watch(runId: string, listener: (record: RunRecord) => void) {
        return this.inner.watch(runId, listener);
      }
    }
    // guide:end

    const store = new MirroredStore(new MemoryRunStore());
    await new ToolCallingAgent({ model: new MockModel([answerTurn(1)]), store }).run("answer", {
      runId: "kept",
    });

    expect(store.commits.length).toBeGreaterThan(0);
    expect(await store.load("kept")).toBeDefined();
  });

  it("Middleware: wraps one step's action, to time, filter or short-circuit it", async () => {
    const seen: number[] = [];
    // guide:middleware
    const timeEachAction: AgentMiddleware = async function* (ctx, next) {
      const startedAt = Date.now();
      const outcome = yield* next();
      seen.push(ctx.stepIndex);
      ctx.logger.debug("step " + String(ctx.stepIndex) + " took " + String(Date.now() - startedAt) + " ms");
      return outcome;
    };
    // guide:end

    const agent = new ToolCallingAgent({
      model: new MockModel([answerTurn(1)]),
      middleware: [timeEachAction],
    });
    await agent.run("answer");

    expect(seen).toEqual([0]);
  });

  it("Event listener: observe the run from outside, changing nothing", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1)]) });
    const finished: unknown[] = [];
    // guide:events
    const stop = agent.on("run.completed", (event) => {
      finished.push(event.result.output);
    });
    // guide:end

    await agent.run("answer");
    stop();

    expect(finished).toEqual([1]);
  });
});

/** Each `guide:<name>` block in this file, with its common indent removed. */
function blocksIn(source: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const pattern = /^([ \t]*)\/\/ guide:([a-z-]+)\r?\n([\s\S]*?)^[ \t]*\/\/ guide:end/gm;
  for (const match of source.matchAll(pattern)) {
    const indent = match[1]!.length;
    const body = match[3]!
      .split(/\r?\n/)
      .map((line) => line.slice(indent))
      .join("\n")
      .trimEnd();
    blocks.set(match[2]!, body);
  }
  return blocks;
}

describe("the guide", () => {
  it("quotes every example exactly as this file runs it", () => {
    const source = readFileSync(new URL(import.meta.url), "utf8");
    const guide = readFileSync(
      new URL("../../../docs/guides/where-behaviour-belongs.md", import.meta.url),
      "utf8",
    );
    const quoted = new Map<string, string>();
    for (const match of guide.matchAll(/<!-- guide:([a-z-]+) -->\r?\n```ts\r?\n([\s\S]*?)\r?\n```/g)) {
      quoted.set(match[1]!, match[2]!.replace(/\r\n/g, "\n"));
    }

    const tested = blocksIn(source);
    expect([...quoted.keys()].sort()).toEqual([...tested.keys()].sort());
    for (const [name, body] of tested) expect(quoted.get(name), name).toBe(body);
  });
});
