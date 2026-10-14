import { HuggingFaceModel, OpenAICompatibleModel } from "@smolagents-ts/models";
import { afterEach, describe, expect, it } from "vitest";
import { UnsupportedModelTypeError } from "../src/errors.js";
import {
  HF_TOKEN_VARIABLE,
  OPENAI_API_KEY_VARIABLE,
  loadModel,
  resolveApiKey,
} from "../src/model-factory.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/** Record request URLs and answer with a minimal completion, so no test reaches a provider. */
function stubFetch(seen: string[]): void {
  globalThis.fetch = (async (url: string) => {
    seen.push(url);
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: "ok" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as unknown as typeof globalThis.fetch;
}

describe("loadModel", () => {
  it("maps InferenceClientModel to the Hugging Face adapter", () => {
    const model = loadModel({ modelType: "InferenceClientModel", modelId: "org/model" });

    expect(model).toBeInstanceOf(HuggingFaceModel);
    expect(model.id).toBe("org/model");
    expect(model.provider).toBe("huggingface");
  });

  it("maps OpenAIModel to the OpenAI-compatible adapter", () => {
    const model = loadModel({ modelType: "OpenAIModel", modelId: "gpt-4o-mini" });

    expect(model).toBeInstanceOf(OpenAICompatibleModel);
    expect(model.id).toBe("gpt-4o-mini");
    expect(model.provider).toBe("openai-compatible");
  });

  it("forwards the api base to the OpenAI-compatible adapter", async () => {
    const seen: string[] = [];
    stubFetch(seen);
    const model = loadModel({
      modelType: "OpenAIModel",
      modelId: "m",
      apiBase: "https://example.test/v1",
    });

    await model.generate([{ role: "user", content: "hi" }]);

    expect(seen[0]).toBe("https://example.test/v1/chat/completions");
  });

  it("forwards the api base to the Hugging Face adapter", async () => {
    const seen: string[] = [];
    stubFetch(seen);
    const model = loadModel({
      modelType: "InferenceClientModel",
      modelId: "org/model",
      apiBase: "https://router.example.test/v1",
    });

    await model.generate([{ role: "user", content: "hi" }]);

    expect(seen[0]).toBe("https://router.example.test/v1/chat/completions");
  });

  it("refuses a model type with no adapter, naming the alternatives", () => {
    for (const modelType of ["LiteLLMModel", "TransformersModel", "OpenAIServerModel"]) {
      let message = "";
      try {
        loadModel({ modelType, modelId: "m" });
      } catch (error) {
        expect(error).toBeInstanceOf(UnsupportedModelTypeError);
        message = (error as Error).message;
      }
      expect(message).toContain(modelType);
      expect(message).toContain("InferenceClientModel");
      expect(message).toContain("OpenAIModel");
    }
  });
});

describe("resolveApiKey", () => {
  it("prefers an explicit key", () => {
    expect(resolveApiKey("InferenceClientModel", "explicit", { [HF_TOKEN_VARIABLE]: "env" })).toBe(
      "explicit",
    );
  });

  it("reads the provider's documented variable when no key is given", () => {
    expect(resolveApiKey("InferenceClientModel", undefined, { [HF_TOKEN_VARIABLE]: "hf" })).toBe("hf");
    expect(resolveApiKey("OpenAIModel", undefined, { [OPENAI_API_KEY_VARIABLE]: "sk" })).toBe("sk");
  });

  it("treats an empty explicit value as absent", () => {
    expect(resolveApiKey("OpenAIModel", "", { [OPENAI_API_KEY_VARIABLE]: "sk" })).toBe("sk");
  });

  it("answers undefined when neither channel has a key", () => {
    expect(resolveApiKey("OpenAIModel", undefined, {})).toBeUndefined();
    expect(resolveApiKey("InferenceClientModel", undefined, { [OPENAI_API_KEY_VARIABLE]: "sk" })).toBeUndefined();
  });

  it("reads nothing for a type it does not know", () => {
    expect(resolveApiKey("LiteLLMModel", undefined, { [HF_TOKEN_VARIABLE]: "hf" })).toBeUndefined();
  });
});
