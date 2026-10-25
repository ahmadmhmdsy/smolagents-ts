import {
  CODE_FENCE,
  CodeAgent,
  MODEL_ADAPTER_VERSION,
  ScriptedExecutor,
  finalAnswerResult,
  upgradeModelAdapter,
  type Model,
} from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import * as barrel from "../src/index.js";
import { AnthropicModel } from "../src/anthropic.js";
import { CONFORMING_ADAPTERS, fixture } from "./adapter-contract.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

describe("the phase 6 exit criterion", () => {
  it("runs a model written before the numbering through the loop", async () => {
    const legacy: Model = {
      id: "legacy",
      provider: "legacy",
      capabilities: { streaming: false, toolCalls: false, images: false },
      generate: () =>
        Promise.resolve({
          content: fenced("done", "final_answer(7)"),
          toolCalls: [],
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          finishReason: "stop",
        }),
      generateStream: () =>
        (async function* () {
          yield { delta: "7", finishReason: "stop" as const };
        })(),
    };
    const model = upgradeModelAdapter(legacy);
    const agent = new CodeAgent({
      model,
      executor: new ScriptedExecutor({ handler: () => finalAnswerResult(7) }),
    });

    let output: unknown;
    for await (const event of agent.stream("answer")) {
      if (event.type === "run.completed") output = event.result.output;
    }

    expect(model.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
    expect(output).toBe(7);
  });

  it("carries a cache hint from the agent options onto the provider wire", async () => {
    const body = fixture("anthropic-messages.json");
    const calls: Array<{ init: RequestInit }> = [];
    const fetch = (_url: string | URL | Request, init?: RequestInit) => {
      calls.push({ init: init ?? {} });
      return Promise.resolve(
        new Response(body, { status: 200, headers: { "content-type": "application/json" } }),
      );
    };
    const model = new AnthropicModel({ model: "claude-sonnet-4-5", fetch });
    const agent = new CodeAgent({
      model,
      executor: new ScriptedExecutor({ handler: () => finalAnswerResult(7) }),
      modelOptions: { providerOptions: { cache: { system: true, transcript: true } } },
    });

    for await (const event of agent.stream("hi")) {
      if (calls.length > 0) {
        expect(event.type).toBeDefined();
        break;
      }
    }

    const sent = JSON.parse(String(calls[0]?.init.body)) as {
      system: Array<Record<string, unknown>>;
      messages: Array<{ content: Array<Record<string, unknown>> }>;
    };
    expect(sent.system[0]?.["cache_control"]).toEqual({ type: "ephemeral" });
    expect(sent.messages.at(-1)?.content.at(-1)?.["cache_control"]).toEqual({ type: "ephemeral" });
  });

  it("exports exactly the adapters the conformance list covers", () => {
    for (const adapter of CONFORMING_ADAPTERS) {
      const exported = (barrel as Record<string, unknown>)[adapter.name];
      expect(exported, adapter.name + " is not in the barrel").toBeTypeOf("function");
    }
  });
});
