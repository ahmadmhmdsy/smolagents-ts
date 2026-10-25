import {
  MODEL_ADAPTER_VERSION,
  upgradeModelAdapter,
  type ChatCompletionChunk,
  type Model,
  type ModelAdapterV1,
} from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import {
  CONFORMING_ADAPTERS,
  CUSTOM_COMPLETION,
  answer,
  customStream,
  fixture,
  wireFetch,
} from "./adapter-contract.js";

/** The assertions every adapter must satisfy at the current contract version. */
async function assertContract(adapter: Model): Promise<void> {
  const versioned = adapter as ModelAdapterV1;
  expect(MODEL_ADAPTER_VERSION).toBe(1);
  expect(versioned.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
  expect(adapter.id.length).toBeGreaterThan(0);
  expect(adapter.provider.length).toBeGreaterThan(0);
  expect(typeof adapter.capabilities.streaming).toBe("boolean");
  expect(typeof adapter.capabilities.toolCalls).toBe("boolean");
  expect(typeof adapter.capabilities.images).toBe("boolean");

  const completion = await adapter.generate([{ role: "user", content: "answer" }]);
  expect(typeof completion.content).toBe("string");
  expect(Array.isArray(completion.toolCalls)).toBe(true);
  expect(["stop", "tool_calls", "length", "other"]).toContain(completion.finishReason);
  expect(completion.usage.inputTokens).toBeGreaterThanOrEqual(0);
  expect(completion.usage.outputTokens).toBeGreaterThanOrEqual(0);
  expect(completion.usage.totalTokens).toBe(
    completion.usage.inputTokens + completion.usage.outputTokens,
  );

  const chunks: ChatCompletionChunk[] = [];
  for await (const chunk of adapter.generateStream([{ role: "user", content: "answer" }])) {
    chunks.push(chunk);
  }
  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks.some((chunk) => chunk.finishReason !== undefined || chunk.usage !== undefined)).toBe(
    true,
  );
}

describe("the adapter contract", () => {
  for (const adapter of CONFORMING_ADAPTERS) {
    it(adapter.name + " conforms at version " + String(MODEL_ADAPTER_VERSION), async () => {
      // A wire adapter reads both fixtures; CustomModel takes no request at all.
      const fetchImpl = adapter.wire
        ? wireFetch(fixture(adapter.json), fixture(adapter.sse))
        : answer("{}", "application/json");
      await assertContract(adapter.build(fetchImpl));
    });
  }

  it("accepts a model written before the numbering", async () => {
    const legacy: Model = {
      id: "legacy",
      provider: "legacy",
      capabilities: { streaming: false, toolCalls: false, images: false },
      generate: () => Promise.resolve({ ...CUSTOM_COMPLETION, toolCalls: [] }),
      generateStream: () => customStream(),
    };

    const upgraded = upgradeModelAdapter(legacy);
    expect(upgraded.adapterVersion).toBe(MODEL_ADAPTER_VERSION);
    expect(upgraded.id).toBe("legacy");
    const completion = await upgraded.generate([{ role: "user", content: "hi" }]);
    expect(completion.content).toBe("custom answer");
  });
});
