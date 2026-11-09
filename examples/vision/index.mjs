#!/usr/bin/env node
/**
 * One image handed to a real model, behind a key read from the environment. With no key the
 * script prints SKIPPED and exits 0, so it is safe to run anywhere. With a key it checks the
 * model's capabilities first, then asks a ToolCallingAgent what colour a generated square is.
 * The alt text is for a person reading the transcript and never reaches the model. The key is
 * never printed: any provider error is scrubbed before it is shown.
 *
 * Run: node index.mjs
 *      GEMINI_MODEL=<model-id> node index.mjs
 */
import { crc32, deflateSync } from "node:zlib";
import { pathToFileURL } from "node:url";
import { ToolCallingAgent, sniffMediaType } from "smolagents-ts";
import { GeminiModel } from "smolagents-ts/models";

const KEY_ENV = "GOOGLE_API_KEY";
const DEFAULT_MODEL_ID = "gemini-2.5-flash";
export const SKIP_MESSAGE = "vision SKIPPED: " + KEY_ENV + " is not set";

const QUESTION = "What colour is this square? Call final_answer with the one word.";
const SQUARE_SIZE = 16;

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, checksum]);
}

/** An opaque square of one colour, built here so the example ships no binary file. */
export function solidPng(red, green, blue, size = SQUARE_SIZE) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour
  const row = [0, ...Array.from({ length: size }, () => [red, green, blue]).flat()];
  const pixels = Uint8Array.from(Array.from({ length: size }, () => row).flat());
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export async function main(options = {}) {
  const env = options.env ?? process.env;
  const log = options.log ?? console.log;
  const apiKey = env[KEY_ENV];

  if (apiKey === undefined || apiKey.trim() === "") {
    log(SKIP_MESSAGE);
    return { skipped: true, model: null, answer: null };
  }

  // Nothing below may print the key, and a provider error can quote the request.
  const scrub = (text) => String(text).split(apiKey).join("[redacted]");
  const modelId = env.GEMINI_MODEL ?? DEFAULT_MODEL_ID;
  const model = new GeminiModel({
    model: modelId,
    apiKey,
    ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
  });
  log("vision: " + modelId + " through " + KEY_ENV + " (the value is never printed)");

  // Ask before building anything: a model that cannot see refuses the part outright.
  if (!model.capabilities.images) {
    log("  this model does not take images");
    return { skipped: true, model: modelId, answer: null };
  }

  const bytes = new Uint8Array(solidPng(220, 30, 30));
  const task = [
    { type: "text", text: QUESTION },
    { type: "image", mediaType: sniffMediaType(bytes), bytes, alt: "A plain red square" },
  ];

  try {
    const agent = new ToolCallingAgent({ model, maxSteps: 3 });
    const result = await agent.run(task);
    log("  answer: " + JSON.stringify(result.output ?? null));
    return { skipped: false, model: modelId, answer: result.output ?? null };
  } catch (error) {
    // The cause is dropped on purpose: it carries the request, and the request carries the key,
    // so scrubbing the message alone would still leave the key in the chain Node prints for an
    // unhandled error.
    // eslint-disable-next-line preserve-caught-error -- attaching the cause would leak the key
    throw new Error("vision failed: " + scrub(error && error.message ? error.message : error));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await main();
  if (result.skipped) process.exit(0);
}
