/**
 * Decision 0039, rules 2 to 5: the plugin host, the tool hooks in the tool wrapper, the
 * `model:request` edit that may not swap the model, and registration only between runs.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { CodeAgent } from "../src/agent/code-agent.js";
import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent } from "../src/agent/tool-calling-agent.js";
import { PluginError } from "../src/errors.js";
import { noopLogger } from "../src/logger.js";
import { definePlugin, type PluginHooks } from "../src/plugin/plugin.js";
import { PluginHost } from "../src/plugin/host.js";
import { sealArgs } from "../src/plugin/tool-hooks.js";
import { MemoryRunStore, translateRecord } from "../src/session/run-store.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { tool } from "../src/tool/tool.js";
import type { ToolCallRequest } from "../src/types.js";

function call(name: string, args: unknown, id: string): ToolCallRequest {
  return { id, name, arguments: JSON.stringify(args) };
}

const ADD_TURN = {
  content: "",
  finishReason: "tool_calls" as const,
  toolCalls: [call("add", { a: 1, b: 1 }, "c-add")],
};

function answerTurn(answer: unknown, id = "c-fin") {
  return {
    content: "",
    finishReason: "tool_calls" as const,
    toolCalls: [call(FINAL_ANSWER_TOOL_NAME, { answer }, id)],
  };
}

function addTool(onCall?: (input: { a: number; b: number }) => void) {
  const seen: { a: number; b: number }[] = [];
  const add = tool({
    name: "add",
    description: "Add two numbers.",
    inputSchema: z.object({ a: z.number(), b: z.number() }),
    execute: (input) => {
      seen.push(input);
      onCall?.(input);
      return input.a + input.b;
    },
  });
  return { tool: add, seen };
}

function onePlugin<K extends keyof PluginHooks>(name: string, hook: K, listener: PluginHooks[K]) {
  return definePlugin({ name, version: "1.0.0", setup: (api) => void api.on(hook, listener) });
}

describe("definePlugin and the host", () => {
  it("checks the name, the version and the setup early", () => {
    expect(() => definePlugin({ name: " ", version: "1", setup: () => undefined })).toThrow(
      TypeError,
    );
    expect(() => definePlugin({ name: "a", version: "", setup: () => undefined })).toThrow(
      TypeError,
    );
  });

  it("refuses a second plugin with the same name", () => {
    const host = new PluginHost(noopLogger);
    host.use(onePlugin("same", "step:end", () => undefined));
    expect(() => host.use(onePlugin("same", "step:end", () => undefined))).toThrow(PluginError);
  });

  it("dispose removes every registration and runs the teardown once", () => {
    const host = new PluginHost(noopLogger);
    let teardowns = 0;
    const handle = host.use(
      definePlugin({
        name: "many",
        version: "1.0.0",
        setup: (api) => {
          api.on("tool:before", () => undefined);
          api.on("tool:after", () => undefined);
          api.on("step:end", () => undefined);
          return () => {
            teardowns += 1;
          };
        },
      }),
    );
    expect(host.has("tool:before") && host.has("tool:after") && host.has("step:end")).toBe(true);
    handle.dispose();
    handle.dispose();
    expect(host.has("tool:before") || host.has("tool:after") || host.has("step:end")).toBe(false);
    expect(host.entries()).toEqual([]);
    expect(teardowns).toBe(1);
  });

  it("logs a failing emit listener and still runs the next one", () => {
    const warnings: string[] = [];
    const host = new PluginHost({
      ...noopLogger,
      warn: (message: string) => void warnings.push(message),
    });
    let reached = false;
    host.use(
      onePlugin("bad", "step:end", () => {
        throw new Error("boom");
      }),
    );
    host.use(
      onePlugin("good", "step:end", () => {
        reached = true;
      }),
    );
    host.emit("step:end", { runId: "r", stepIndex: 0, stepId: "s" });
    expect(reached).toBe(true);
    expect(warnings).toHaveLength(1);
  });

  it("sealArgs freezes a deep copy", () => {
    const input = { nested: { list: [1, 2] } };
    const sealed = sealArgs(input);
    expect(sealed).toEqual(input);
    expect(sealed).not.toBe(input);
    expect(Object.isFrozen(sealed.nested.list)).toBe(true);
  });
});

describe("tool hooks", () => {
  it("fires tool:before on a CodeAgent guest call and the tool sees the rewrite", async () => {
    const { tool: add, seen } = addTool();
    const executor = new ScriptedExecutor({
      handler: async (_code, options) => {
        const entry = options.tools.get("add")!;
        const output = await entry.execute(
          { a: 1, b: 1 },
          {
            signal: options.signal,
            fetch,
            callId: "g-1",
            stepIndex: options.stepIndex,
            logger: options.logger,
          },
        );
        return finalAnswerResult(output);
      },
    });
    const agent = new CodeAgent({
      model: new MockModel(["```javascript\nfinal_answer(add({a: 1, b: 1}))\n```"]),
      executor,
      tools: [add],
    });
    const fired: string[] = [];
    agent.use(
      onePlugin("double-a", "tool:before", (args, info) => {
        fired.push(info.name + ":" + info.callId);
        return { ...(args as { a: number; b: number }), a: 10 };
      }),
    );

    const result = await agent.run("add");

    expect(fired).toEqual(["add:g-1"]);
    expect(seen).toEqual([{ a: 10, b: 1 }]);
    expect(result.output).toBe(11);
  });

  it("approval sees the rewritten args frozen, so nothing rewrites them after it", async () => {
    const { tool: add, seen } = addTool();
    const approved: unknown[] = [];
    const agent = new ToolCallingAgent({
      model: new MockModel([ADD_TURN, answerTurn(2)]),
      tools: [add],
      approve: (request) => {
        approved.push(request.input);
        expect(() => {
          (request.input as { a: number }).a = 99;
        }).toThrow(TypeError);
        return true;
      },
    });
    agent.use(onePlugin("rewrite", "tool:before", () => ({ a: 5, b: 5 })));

    await agent.run("add");

    expect(approved).toEqual([{ a: 5, b: 5 }]);
    expect(seen).toEqual([{ a: 5, b: 5 }]);
  });

  it("fails the run on a tool:before rewrite the input schema rejects: a plugin bug, not the model's", async () => {
    const { tool: add, seen } = addTool();
    const agent = new ToolCallingAgent({
      model: new MockModel([ADD_TURN, answerTurn(2)]),
      tools: [add],
    });
    agent.use(onePlugin("broken", "tool:before", () => ({ a: "one" })));

    await expect(agent.run("add")).rejects.toThrow(/input schema refuses/);
    expect(seen).toEqual([]);
  });

  it("tool:after rewrites the output the model sees", async () => {
    const { tool: add } = addTool();
    const model = new MockModel([ADD_TURN, answerTurn(2)]);
    const agent = new ToolCallingAgent({ model, tools: [add] });
    agent.use(onePlugin("after", "tool:after", (output) => "sum=" + String(output)));

    await agent.run("add");

    expect(JSON.stringify(model.calls[1])).toContain("sum=2");
  });

  it("fires nothing once the plugin is disposed", async () => {
    const { tool: add, seen } = addTool();
    const agent = new ToolCallingAgent({
      model: new MockModel([ADD_TURN, answerTurn(2)]),
      tools: [add],
    });
    let fired = 0;
    const handle = agent.use(
      onePlugin("gone", "tool:before", () => {
        fired += 1;
        return { a: 7, b: 7 };
      }),
    );
    handle.dispose();

    await agent.run("add");

    expect(fired).toBe(0);
    expect(seen).toEqual([{ a: 1, b: 1 }]);
  });
});

describe("registration between runs", () => {
  it("refuses use() and dispose() while a run is in flight", async () => {
    const errors: unknown[] = [];
    const ref: { agent?: ToolCallingAgent } = {};
    const handle = { current: undefined as { dispose(): void } | undefined };
    const { tool: add } = addTool(() => {
      try {
        ref.agent?.use(onePlugin("late", "step:end", () => undefined));
      } catch (error) {
        errors.push(error);
      }
      try {
        handle.current?.dispose();
      } catch (error) {
        errors.push(error);
      }
    });
    const agent = new ToolCallingAgent({ model: new MockModel([ADD_TURN, answerTurn(2)]), tools: [add] });
    ref.agent = agent;
    handle.current = agent.use(onePlugin("early", "step:end", () => undefined));

    await agent.run("add");

    expect(errors).toHaveLength(2);
    expect(errors.every((error) => error instanceof PluginError)).toBe(true);
    handle.current.dispose();
    expect(() => agent.use(onePlugin("late", "step:end", () => undefined))).not.toThrow();
  });
});

describe("model and answer hooks", () => {
  it("applies a model:request edit to what the model receives", async () => {
    const model = new MockModel([answerTurn(1)]);
    const agent = new ToolCallingAgent({ model });
    agent.use(
      onePlugin("tag", "model:request", (request) => ({
        ...request,
        messages: [...request.messages, { role: "user", content: "PLUGIN-NOTE" }],
      })),
    );

    await agent.run("answer");

    expect(JSON.stringify(model.calls[0])).toContain("PLUGIN-NOTE");
  });

  it("refuses a model:request result that names a model", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1)]) });
    agent.use(
      onePlugin("swap", "model:request", (request) => ({
        ...request,
        options: { ...request.options, model: "other" } as never,
      })),
    );

    await expect(agent.run("answer")).rejects.toBeInstanceOf(PluginError);
  });

  it("turns an answer:check rejection into a correction and accepts the next answer", async () => {
    const model = new MockModel([answerTurn(1, "c-1"), answerTurn(2, "c-2")]);
    const agent = new ToolCallingAgent({ model });
    agent.use(
      onePlugin("even", "answer:check", (answer) =>
        typeof answer === "number" && answer % 2 === 1
          ? { reject: "the answer must be even" }
          : undefined,
      ),
    );

    const result = await agent.run("answer");

    expect(result.output).toBe(2);
    expect(JSON.stringify(model.calls[1])).toContain("the answer must be even");
  });

  it("emits step:end and model:response with the run's id", async () => {
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1)]) });
    const steps: string[] = [];
    const responses: string[] = [];
    agent.use(
      definePlugin({
        name: "watch",
        version: "1.0.0",
        setup: (api) => {
          api.on("step:end", (info) => void steps.push(info.runId + "#" + info.stepIndex));
          api.on("model:response", (_completion, info) => void responses.push(info.runId));
        },
      }),
    );

    await agent.run("answer", { runId: "watched" });

    expect(steps.length).toBeGreaterThan(0);
    expect(steps.every((entry) => entry.startsWith("watched#"))).toBe(true);
    expect(responses).toEqual(["watched"]);
  });

  it("names the plugins in use on the run record", async () => {
    const store = new MemoryRunStore();
    const agent = new ToolCallingAgent({ model: new MockModel([answerTurn(1)]), store });
    agent.use(
      definePlugin({
        name: "noted",
        version: "3.0.0",
        config: { level: 1 },
        setup: () => undefined,
      }),
    );

    await agent.run("answer", { runId: "named" });

    const plugins = translateRecord(store.load("named")!).plugins;
    expect(plugins?.map((entry) => [entry.name, entry.version])).toEqual([["noted", "3.0.0"]]);
  });
});
