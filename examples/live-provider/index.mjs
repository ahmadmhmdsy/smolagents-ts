#!/usr/bin/env node
/**
 * One live provider run, behind a key read from the environment. With no key the script
 * prints SKIPPED and exits 0, so it is safe to run anywhere. With a key it asks GeminiModel
 * for one non-streamed completion and one streamed one, then runs a real CodeAgent in
 * QuickJS. The key is never printed: any provider error is scrubbed before it is shown.
 *
 * Run: node index.mjs
 *      GEMINI_MODEL=<model-id> node index.mjs
 */
import { pathToFileURL } from "node:url";
import { CodeAgent } from "smolagents-ts";
import { GeminiModel } from "smolagents-ts/models";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";

const KEY_ENV = "GOOGLE_API_KEY";
const DEFAULT_MODEL_ID = "gemini-3.5-flash-lite";
export const SKIP_MESSAGE = "live-provider SKIPPED: " + KEY_ENV + " is not set";

const PROMPT = "Compute 2 + 2 in JavaScript, then call final_answer with the number.";

export async function main(options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const apiKey = env[KEY_ENV];

  if (apiKey === undefined || apiKey.trim() === "") {
    log(SKIP_MESSAGE);
    return { skipped: true, model: null, text: null, answer: null };
  }

  // Nothing below may print the key, and a provider error can quote the request.
  const scrub = (text) => String(text).split(apiKey).join("[redacted]");
  const modelId = env.GEMINI_MODEL ?? DEFAULT_MODEL_ID;
  const model = new GeminiModel({
    model: modelId,
    apiKey,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  log("live-provider: " + modelId + " through " + KEY_ENV + " (the value is never printed)");

  const executor = new QuickJSExecutor();
  try {
    const completion = await model.generate([
      { role: "user", content: "Reply with the single word: ready" },
    ]);
    const text = completion.content.trim();
    log("  generate: " + JSON.stringify(text) + "  tokens " + completion.usage.totalTokens);

    let streamed = "";
    for await (const chunk of model.generateStream([
      { role: "user", content: "Count from one to three." },
    ])) {
      streamed += chunk.delta ?? "";
    }
    log("  stream:   " + JSON.stringify(streamed.trim()));

    const agent = new CodeAgent({ model, executor, maxSteps: 4 });
    let answer;
    for await (const event of agent.stream(PROMPT)) {
      if (event.type === "run.completed") answer = event.result.output;
    }
    log("  agent:    " + JSON.stringify(answer ?? null));
    return { skipped: false, model: modelId, text, answer: answer ?? null };
  } catch (error) {
    // The cause is dropped on purpose: it carries the request, and the request carries the key,
    // so scrubbing the message alone would still leave the key in the chain Node prints for an
    // unhandled error.
    // eslint-disable-next-line preserve-caught-error -- attaching the cause would leak the key
    throw new Error(
      "live-provider failed: " + scrub(error && error.message ? error.message : error),
    );
  } finally {
    await executor.dispose();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await main();
  if (result.skipped) process.exit(0);
}
