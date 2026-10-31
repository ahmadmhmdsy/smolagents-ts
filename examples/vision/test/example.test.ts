import { inflateSync } from "node:zlib";
import { expect, test } from "vitest";

import { SKIP_MESSAGE, main, solidPng } from "../index.mjs";

const ANSWER = {
  candidates: [
    {
      content: { role: "model", parts: [{ functionCall: { name: "final_answer", args: { answer: "Red" } } }] },
      finishReason: "STOP",
    },
  ],
  usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 2, totalTokenCount: 12 },
};

test("prints SKIPPED and does nothing when the key is absent", async () => {
  const lines: string[] = [];
  const result = await main({ env: {}, log: (line: string) => lines.push(line) });

  expect(result).toEqual({ skipped: true, model: null, answer: null });
  expect(lines).toEqual([SKIP_MESSAGE]);
  expect(SKIP_MESSAGE).toContain("SKIPPED");
});

test("builds a PNG of the size and colour it was asked for", () => {
  const png = solidPng(1, 2, 3, 2);

  expect(png.subarray(0, 4).toString("latin1")).toBe("\x89PNG");
  const start = png.indexOf("IDAT") + 4;
  const raw = inflateSync(png.subarray(start, png.length - 16));
  expect([...raw]).toEqual([0, 1, 2, 3, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3]);
});

test("sends the image to the model and keeps the alt text out of the request", async () => {
  const bodies: string[] = [];
  const stubFetch = async (_url: string, init: { body: string }) => {
    bodies.push(init.body);
    return new Response(JSON.stringify(ANSWER), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await main({ env: { GOOGLE_API_KEY: "k" }, fetch: stubFetch, log: () => undefined });

  expect(result.answer).toBe("Red");
  expect(bodies[0]).toContain('"inlineData"');
  expect(bodies[0]).toContain('"mimeType":"image/png"');
  expect(bodies[0]).not.toContain("A plain red square");
  // A real provider can only finish by calling what the request offers it.
  expect(JSON.parse(bodies[0] ?? "{}").tools[0].functionDeclarations[0].name).toBe("final_answer");
});

test("never prints the key, even when a provider error quotes it", async () => {
  const key = "unit-test-key-do-not-print";
  const failingFetch = async () => {
    throw new Error("request rejected for key " + key);
  };
  const lines: string[] = [];

  let caught: unknown;
  try {
    await main({
      env: { GOOGLE_API_KEY: key },
      fetch: failingFetch,
      log: (line: string) => lines.push(line),
    });
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(Error);
  const message = (caught as Error).message;
  expect(message).toContain("vision failed:");
  expect(message).toContain("[redacted]");
  expect(message).not.toContain(key);
  for (const line of lines) expect(line).not.toContain(key);
});
