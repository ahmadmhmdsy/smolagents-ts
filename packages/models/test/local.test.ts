import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { lmStudioModel, llamaCppModel, ollamaModel, vllmModel } from "../src/index.js";
import type { FetchLike } from "../src/transport.js";

const completion = readFileSync(new URL("./fixtures/openai-chat-completion.json", import.meta.url), "utf8");

interface Recorded {
  url: string;
  init: RequestInit;
}

function recorder(): { fetch: FetchLike; calls: Recorded[] } {
  const calls: Recorded[] = [];
  const fetchImpl: FetchLike = (url, init) => {
    calls.push({ url, init });
    return Promise.resolve(new Response(completion, { status: 200, headers: { "content-type": "application/json" } }));
  };
  return { fetch: fetchImpl, calls };
}

const USER = [{ role: "user" as const, content: "hi" }];

describe.each([
  { name: "ollama", make: ollamaModel, provider: "ollama", url: "http://localhost:11434/v1", tools: true },
  { name: "LM Studio", make: lmStudioModel, provider: "lm-studio", url: "http://localhost:1234/v1", tools: true },
  { name: "llama.cpp", make: llamaCppModel, provider: "llama-cpp", url: "http://localhost:8080/v1", tools: false },
  { name: "vLLM", make: vllmModel, provider: "vllm", url: "http://localhost:8000/v1", tools: false },
])("the $name preset", ({ make, provider, url, tools }) => {
  it("posts to the runtime's default local address with no key", async () => {
    const { fetch, calls } = recorder();
    const model = make({ model: "qwen3:8b", fetch });
    await model.generate(USER);
    expect(calls[0]?.url).toBe(url + "/chat/completions");
    const headers = calls[0]?.init.headers as Record<string, string>;
    expect(headers["authorization"]).toBeUndefined();
    expect((JSON.parse(String(calls[0]?.init.body)) as { model: string }).model).toBe("qwen3:8b");
    expect(model.provider).toBe(provider);
    expect(model.id).toBe("qwen3:8b");
  });

  it("reports what the runtime gives without extra flags", () => {
    const model = make({ model: "m", fetch: recorder().fetch });
    expect(model.capabilities).toEqual({ streaming: true, toolCalls: tools, images: false, audio: false });
  });

  it("takes another address, a key and claimed capabilities", async () => {
    const { fetch, calls } = recorder();
    const model = make({
      model: "m",
      fetch,
      baseUrl: "http://gpu-box:9000/v1/",
      apiKey: "local-secret",
      capabilities: { images: true, toolCalls: true },
    });
    await model.generate(USER);
    expect(calls[0]?.url).toBe("http://gpu-box:9000/v1/chat/completions");
    expect((calls[0]?.init.headers as Record<string, string>)["authorization"]).toBe("Bearer local-secret");
    expect(model.capabilities.images).toBe(true);
    expect(model.capabilities.toolCalls).toBe(true);
    expect(model.provider).toBe(provider);
  });
});

describe("the llama.cpp preset's model name", () => {
  it("defaults to the model the server loaded", async () => {
    const { fetch, calls } = recorder();
    await llamaCppModel({ fetch }).generate(USER);
    expect((JSON.parse(String(calls[0]?.init.body)) as { model: string }).model).toBe("default");
  });
});
