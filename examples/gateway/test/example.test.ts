import { expect, test } from "vitest";

import { SKIP_MESSAGE, main } from "../index.mjs";

const TICK = String.fromCharCode(96);
const FENCE = TICK.repeat(3) + "javascript";
const CLOSE = TICK.repeat(3);

function sseFrame(payload: unknown): string {
  return "data: " + JSON.stringify(payload) + "\n\n";
}

function sse(content: string): Response {
  const body =
    sseFrame({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { content } }],
    }) +
    sseFrame({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
    }) +
    sseFrame({
      id: "chatcmpl-test",
      object: "chat.completion.chunk",
      choices: [],
      usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
    }) +
    "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

function completion(content: string): Response {
  return new Response(
    JSON.stringify({
      id: "chatcmpl-test",
      object: "chat.completion",
      choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
      usage: { prompt_tokens: 3, completion_tokens: 1, total_tokens: 4 },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}

/** A stand-in gateway: the adapter may reach a gateway, a test may not. */
function gatewayFetch(calls: string[]): typeof globalThis.fetch {
  return async (_url, init) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      stream?: boolean;
      messages?: { content?: string }[];
    };
    const last = body.messages?.at(-1)?.content ?? "";
    if (body.stream === true) {
      calls.push("stream:" + last.slice(0, 20));
      if (last.includes("Count from one to three")) return sse("one two three");
      return sse("Thought: answer.\nCode:\n" + FENCE + "\nfinal_answer(4)\n" + CLOSE);
    }
    calls.push("generate:" + last.slice(0, 20));
    // The CodeAgent's loop asks for a completion, not a stream; the plain generate call is the
    // one whose task is the greeting below.
    if (last.includes("Compute 2 + 2")) {
      return completion("Thought: answer.\nCode:\n" + FENCE + "\nfinal_answer(4)\n" + CLOSE);
    }
    return completion("ready");
  };
}

test("prints SKIPPED and does nothing when no base URL is set", async () => {
  const lines: string[] = [];
  const result = await main({ env: {}, log: (line: string) => lines.push(line) });

  expect(result).toEqual({ skipped: true, model: null, text: null, answer: null });
  expect(lines).toEqual([SKIP_MESSAGE]);
  expect(SKIP_MESSAGE).toContain("SKIPPED");
});

test("drives generate, generateStream and one CodeAgent run through the adapter", async () => {
  const calls: string[] = [];
  const lines: string[] = [];
  const result = await main({
    env: {
      OMNIROUTE_BASE_URL: "http://127.0.0.1:20128/v1",
      OMNIROUTE_API_KEY: "unit-test-key-do-not-print",
      OMNIROUTE_MODEL: "pinned-model",
    },
    fetch: gatewayFetch(calls),
    log: (line: string) => lines.push(line),
  });

  expect(result).toEqual({ skipped: false, model: "pinned-model", text: "ready", answer: 4 });
  expect(calls[0]?.startsWith("generate:")).toBe(true);
  expect(calls.some((call) => call.startsWith("stream:"))).toBe(true);
  expect(lines.some((line) => line.includes("pinned-model"))).toBe(true);
  for (const line of lines) expect(line).not.toContain("unit-test-key-do-not-print");
});

test("never prints the key, even when the gateway quotes it in an error", async () => {
  const key = "unit-test-key-do-not-print";
  const lines: string[] = [];
  let caught: unknown;
  try {
    await main({
      env: { OMNIROUTE_BASE_URL: "http://127.0.0.1:20128/v1", OMNIROUTE_API_KEY: key },
      fetch: async () => {
        throw new Error("request rejected for key " + key);
      },
      log: (line: string) => lines.push(line),
    });
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(Error);
  const message = (caught as Error).message;
  expect(message).toContain("gateway failed:");
  expect(message).toContain("[redacted]");
  expect(message).not.toContain(key);
  for (const line of lines) expect(line).not.toContain(key);
});
