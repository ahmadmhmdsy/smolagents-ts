#!/usr/bin/env node
/**
 * One gateway run, behind a base URL read from the environment. With no OMNIROUTE_BASE_URL the
 * script prints SKIPPED and exits 0, so it is safe to run anywhere. With one it drives the same
 * OpenAI-compatible adapter a gateway serves -- one plain completion, one streamed, then a real
 * CodeAgent in QuickJS -- so a reader can see that gateway support is configuration, not code.
 *
 * Run: node index.mjs
 *      OMNIROUTE_API_KEY=<key> OMNIROUTE_MODEL=<model-id> node index.mjs
 *
 * The key is never printed: a gateway error can quote the request, and the request carries it.
 */
import { pathToFileURL } from "node:url";
import { CodeAgent } from "smolagents-ts";
import { OpenAICompatibleModel } from "smolagents-ts/models";
import { QuickJSExecutor } from "smolagents-ts/exec/quickjs";

const BASE_ENV = "OMNIROUTE_BASE_URL";
const KEY_ENV = "OMNIROUTE_API_KEY";
const MODEL_ENV = "OMNIROUTE_MODEL";
const DEFAULT_MODEL_ID = "auto";
export const SKIP_MESSAGE = "gateway SKIPPED: " + BASE_ENV + " is not set";

const PROMPT = "Compute 2 + 2 in JavaScript, then call final_answer with the number.";

export async function main(options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const baseUrl = env[BASE_ENV];

  if (baseUrl === undefined || baseUrl.trim() === "") {
    log(SKIP_MESSAGE);
    return { skipped: true, model: null, text: null, answer: null };
  }

  // An empty key is accepted by a local gateway; a set one must never reach the output.
  const apiKey = env[KEY_ENV] ?? "";
  const scrub =
    apiKey === ""
      ? (text) => String(text)
      : (text) => String(text).split(apiKey).join("[redacted]");
  // Determinism: a gateway can route an id such as "auto" per request, so pin one for a
  // reproducible run. The scanner's ~1475 ids come from GET <baseUrl>/models.
  const modelId = env[MODEL_ENV] ?? DEFAULT_MODEL_ID;
  const model = new OpenAICompatibleModel({
    model: modelId,
    baseUrl: baseUrl.trim(),
    apiKey,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  log("gateway: " + modelId + " through " + baseUrl.trim() + " (the key is never printed)");
  log("  note: pin " + MODEL_ENV + " for reproducible runs; auto may route per request");

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
    // The cause is dropped on purpose: it carries the request, and the request carries the key.
    // eslint-disable-next-line preserve-caught-error -- attaching the cause would leak the key
    throw new Error(
      "gateway failed: " + scrub(error && error.message ? error.message : error),
    );
  } finally {
    await executor.dispose();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await main();
  if (result.skipped) process.exit(0);
}
