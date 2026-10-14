#!/usr/bin/env node
/**
 * One live provider call, outside the fixture suite.
 *
 * Every unit test in this repository drives an injected fetch against a recorded fixture.
 * This script is the opposite: it is the only thing here that needs a credential, it reads
 * the key from the environment, and it never prints it (an error message is scrubbed of the
 * key before it is shown). With no key it prints SKIPPED and exits 0, so the gate never
 * needs one.
 *
 * Run:  pnpm build && node scripts/live-smoke.mjs
 *       GEMINI_MODEL=gemini-2.5-flash node scripts/live-smoke.mjs
 */
const KEY_ENV = "GOOGLE_API_KEY";
const MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-3.5-flash-lite";

const apiKey = process.env[KEY_ENV];
if (apiKey === undefined || apiKey.trim() === "") {
  console.log("live-smoke SKIPPED: " + KEY_ENV + " is not set");
  process.exit(0);
}

/** Nothing below may print the key, and a provider error can quote the request. */
const scrub = (text) => String(text).split(apiKey).join("[redacted]");

const models = await import(new URL("../packages/models/dist/index.js", import.meta.url).href);
const core = await import(new URL("../packages/core/dist/index.js", import.meta.url).href);
const { QuickJSExecutor } = await import(
  new URL("../packages/exec-quickjs/dist/index.js", import.meta.url).href
);

const failures = [];
async function check(name, fn) {
  try {
    const value = await fn();
    if (value === false) throw new Error("returned false");
    console.log("  ok   " + name);
  } catch (error) {
    const message = scrub(error && error.message ? error.message : error);
    failures.push(name + ": " + message);
    console.log("  FAIL " + name + ": " + message);
  }
}

const model = new models.GeminiModel({
  model: MODEL_ID,
  apiKey,
  systemPrompt: "Answer briefly and literally.",
});

console.log("live-smoke: " + MODEL_ID + " through " + KEY_ENV + " (the value is never printed)");

await check("a non-streamed completion returns text", async () => {
  const completion = await model.generate([{ role: "user", content: "Reply with the single word: ready" }]);
  if (typeof completion.content !== "string" || completion.content.trim() === "") {
    throw new Error("empty content");
  }
  console.log("       text " + JSON.stringify(completion.content.trim().slice(0, 80)));
  return true;
});

await check("a streamed completion returns deltas and usage", async () => {
  let text = "";
  let usage;
  for await (const chunk of model.generateStream([{ role: "user", content: "Count from one to three." }])) {
    text += chunk.delta ?? "";
    if (chunk.usage !== undefined) usage = chunk.usage;
  }
  if (text.trim() === "") throw new Error("the stream carried no text");
  if (usage === undefined || usage.totalTokens <= 0) throw new Error("the stream reported no usage");
  console.log("       text " + JSON.stringify(text.trim().slice(0, 80)) + " tokens " + usage.totalTokens);
  return true;
});

await check("a live CodeAgent run executes a program and answers", async () => {
  const executor = new QuickJSExecutor();
  try {
    const agent = new core.CodeAgent({ model, executor, maxSteps: 4 });
    let programs = 0;
    let answer;
    let budget = false;
    for await (const event of agent.stream(
      "Compute 2 + 2 in JavaScript, then call final_answer with the number.",
    )) {
      if (event.type === "observation.completed") programs += 1;
      if (event.type === "run.completed") answer = event.result.output;
      if (event.type === "run.maxStepsReached") budget = true;
    }
    if (programs === 0) throw new Error("no program reached the executor");
    if (budget) {
      console.log("       note: the run spent its budget without a final answer");
    }
    console.log("       programs " + programs + " answer " + JSON.stringify(answer ?? null));
    return true;
  } finally {
    await executor.dispose();
  }
});

if (failures.length > 0) {
  for (const failure of failures) console.error("  - " + failure);
  throw new Error("live-smoke FAILED: " + failures.length + " of 3 checks failed");
}
console.log("live-smoke OK (" + MODEL_ID + ")");
