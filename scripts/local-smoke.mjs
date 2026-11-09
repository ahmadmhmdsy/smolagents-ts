#!/usr/bin/env node
/**
 * One live call to a local runtime through its preset, outside the fixture suite.
 *
 * The runtime must already be running: this script starts nothing. When no server answers at the
 * preset's address it prints SKIPPED and exits 0, so a machine without a local runtime is not a
 * failure. It needs no key; LOCAL_API_KEY is sent only when set, and never printed.
 *
 * Run:  pnpm build && LOCAL_RUNTIME=ollama LOCAL_MODEL=qwen3:8b node scripts/local-smoke.mjs
 *       LOCAL_RUNTIME is one of ollama, lm-studio, llama-cpp, vllm; LOCAL_BASE_URL overrides
 *       the preset's address.
 */
const RUNTIMES = {
  ollama: "ollamaModel",
  "lm-studio": "lmStudioModel",
  "llama-cpp": "llamaCppModel",
  vllm: "vllmModel",
};

const runtime = process.env.LOCAL_RUNTIME ?? "ollama";
const factoryName = RUNTIMES[runtime];
if (factoryName === undefined) {
  console.error("local-smoke: LOCAL_RUNTIME must be one of " + Object.keys(RUNTIMES).join(", "));
  process.exit(2);
}
const modelId = process.env.LOCAL_MODEL;
if (modelId === undefined && runtime !== "llama-cpp") {
  console.error("local-smoke: set LOCAL_MODEL to a model the " + runtime + " server serves");
  process.exit(2);
}
const apiKey = process.env.LOCAL_API_KEY;
const scrub = (text) => (apiKey ? String(text).split(apiKey).join("[redacted]") : String(text));

const models = await import(new URL("../packages/models/dist/index.js", import.meta.url).href);
const model = models[factoryName]({
  ...(modelId === undefined ? {} : { model: modelId }),
  ...(process.env.LOCAL_BASE_URL ? { baseUrl: process.env.LOCAL_BASE_URL } : {}),
  ...(apiKey ? { apiKey } : {}),
});

const PROMPT = [{ role: "user", content: "Reply with the single word: ready" }];
const options = { maxTokens: 32, temperature: 0 };

try {
  await model.generate(PROMPT, options);
} catch (error) {
  // Only a request that got no HTTP answer at all means the server is not running.
  if (error?.status === undefined && models.isRetryableModelError(error)) {
    console.log("local-smoke SKIPPED: no " + runtime + " server answered (" + scrub(error.message) + ")");
    process.exit(0);
  }
  console.error("local-smoke FAILED on the first call: " + scrub(error && error.message ? error.message : error));
  process.exit(1);
}
console.log("  ok   non-streamed completion");

let text = "";
try {
  for await (const chunk of model.generateStream(PROMPT, options)) text += chunk.delta;
  if (text.trim() === "") throw new Error("the stream carried no text");
} catch (error) {
  console.error("local-smoke FAILED on the stream: " + scrub(error && error.message ? error.message : error));
  process.exit(1);
}
console.log("  ok   streamed completion");
console.log("local-smoke OK (" + runtime + ", " + model.id + ")");
