import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import {
  MODEL_ADAPTER_VERSION,
  upgradeModelAdapter,
  type ModelAdapterV1,
} from "../src/model.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** The shipped contract's version is a number, and the loop accepts an adapter written before it. */
describe("the numbered adapter contract", () => {
  it("upgrades a model written before the numbering", async () => {
    expect(MODEL_ADAPTER_VERSION).toBe(1);
    const legacy = new MockModel(["hello"]);
    const upgraded = upgradeModelAdapter(legacy);

    expect(upgraded.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
    expect(upgraded.id).toBe(legacy.id);
    expect(upgraded.provider).toBe(legacy.provider);
    expect(upgraded.capabilities).toEqual(legacy.capabilities);

    const completion = await upgraded.generate([{ role: "user", content: "hi" }], { temperature: 0.1 });
    expect(completion.content).toBe("hello");
    expect(legacy.requestOptions[0]?.temperature).toBe(0.1);
  });

  it("returns a versioned adapter unchanged", () => {
    const declared = Object.assign(new MockModel(["x"]), {
      adapterVersion: MODEL_ADAPTER_VERSION,
    }) as ModelAdapterV1;

    expect(upgradeModelAdapter(declared)).toBe(declared);
  });

  it("drives a run through the agent", async () => {
    const model = new MockModel([fenced("finish", "final_answer(7)")]);
    const agent = new CodeAgent({
      model: upgradeModelAdapter(model),
      executor: new ScriptedExecutor({ handler: () => finalAnswerResult(7) }),
    });

    let output: unknown;
    for await (const event of agent.stream("answer")) {
      if (event.type === "run.completed") output = event.result.output;
    }

    expect(output).toBe(7);
    expect(model.callCount).toBe(1);
  });
});
