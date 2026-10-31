import { describe, expect, it } from "vitest";
import { CodeAgent } from "../src/agent/code-agent.js";
import { UnsupportedContentError } from "../src/errors.js";
import {
  MODEL_ADAPTER_VERSION,
  modelCapabilities,
  upgradeModelAdapter,
  type ChatCompletionChunk,
  type ModelAdapterV1,
  type ModelAdapterV2,
} from "../src/model.js";
import { CODE_FENCE } from "../src/prompts/templates.js";
import { MockModel } from "../src/testing/mock-model.js";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import type { ChatMessage } from "../src/types.js";

function fenced(thought: string, code: string): string {
  return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
}

/** A model that says nothing about its contract, as one written before the versions were. */
function undeclared(responses: string[]): MockModel {
  return Object.defineProperty(new MockModel(responses), "adapterVersion", { value: undefined });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const TEXT_PARTS: readonly ChatMessage[] = [
  {
    role: "user",
    content: [
      { type: "text", text: "first" },
      { type: "text", text: "second" },
    ],
  },
];

const WITH_MEDIA: readonly ChatMessage[] = [
  {
    role: "user",
    content: [
      { type: "text", text: "look" },
      { type: "image", mediaType: "image/png", bytes: PNG },
    ],
  },
];

async function drain(chunks: AsyncIterable<ChatCompletionChunk>): Promise<string> {
  let text = "";
  for await (const chunk of chunks) text += chunk.delta;
  return text;
}

/** A model written against 0.1.0's numbered contract, and one that claims images under it. */
function declaredV1(): { model: ModelAdapterV1; inner: MockModel } {
  const inner = new MockModel({ responses: ["hello"], capabilities: { images: true } });
  const model: ModelAdapterV1 = {
    id: inner.id,
    provider: inner.provider,
    capabilities: inner.capabilities,
    adapterVersion: 1,
    generate: (messages, options) => inner.generate(messages, options),
    generateStream: (messages, options) => inner.generateStream(messages, options),
  };
  return { model, inner };
}

/** The shipped contract's version is a number, and the loop accepts an adapter written before it. */
describe("the numbered adapter contract", () => {
  it("upgrades a model written before the numbering", async () => {
    expect(MODEL_ADAPTER_VERSION).toBe(2);
    const legacy = undeclared(["hello"]);
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
    }) as ModelAdapterV2;

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

/** A 0.1.0 adapter was written for strings, so the shim gives it strings or stops the call. */
describe("the shim over an earlier contract", () => {
  it("wraps a model that declares version 1", () => {
    const { model } = declaredV1();
    expect(upgradeModelAdapter(model).adapterVersion).toBe(MODEL_ADAPTER_VERSION);
  });

  it("reports no media whatever the model declared", () => {
    const { model } = declaredV1();
    expect(model.capabilities.images).toBe(true);
    expect(upgradeModelAdapter(model).capabilities).toEqual(
      modelCapabilities({ streaming: true, toolCalls: true, images: false, audio: false }),
    );
  });

  it("passes a string message through untouched", async () => {
    const legacy = undeclared(["hello"]);
    const message: ChatMessage = { role: "user", content: "hi" };
    await upgradeModelAdapter(legacy).generate([message]);
    expect(legacy.calls[0]?.[0]).toBe(message);
  });

  it("flattens text parts to the string the model expects", async () => {
    const { model, inner } = declaredV1();
    await upgradeModelAdapter(model).generate(TEXT_PARTS);
    expect(inner.calls[0]).toEqual([{ role: "user", content: "first\nsecond" }]);
  });

  it("flattens text parts on the streamed path too", async () => {
    const legacy = undeclared(["hello"]);
    expect(await drain(upgradeModelAdapter(legacy).generateStream(TEXT_PARTS))).toBe("hello");
    expect(legacy.calls[0]).toEqual([{ role: "user", content: "first\nsecond" }]);
  });

  it("refuses media before a model written for version 1 is called", async () => {
    const { model, inner } = declaredV1();
    await expect(upgradeModelAdapter(model).generate(WITH_MEDIA)).rejects.toBeInstanceOf(UnsupportedContentError);
    await expect(drain(upgradeModelAdapter(model).generateStream(WITH_MEDIA))).rejects.toBeInstanceOf(
      UnsupportedContentError,
    );
    expect(inner.callCount).toBe(0);
  });

  it("refuses media before a model with no declared version is called", async () => {
    const legacy = undeclared(["hello"]);
    await expect(upgradeModelAdapter(legacy).generate(WITH_MEDIA)).rejects.toBeInstanceOf(UnsupportedContentError);
    await expect(drain(upgradeModelAdapter(legacy).generateStream(WITH_MEDIA))).rejects.toBeInstanceOf(
      UnsupportedContentError,
    );
    expect(legacy.callCount).toBe(0);
  });
});
