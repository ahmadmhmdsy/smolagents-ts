import { expect, test } from "vitest";

import { SKIP_MESSAGE, main } from "../index.mjs";

test("prints SKIPPED and does nothing when the key is absent", async () => {
  const lines: string[] = [];
  const result = await main({ env: {}, log: (line: string) => lines.push(line) });

  expect(result).toEqual({ skipped: true, model: null, text: null, answer: null });
  expect(lines).toEqual([SKIP_MESSAGE]);
  expect(SKIP_MESSAGE).toContain("SKIPPED");
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
  expect(message).toContain("live-provider failed:");
  expect(message).toContain("[redacted]");
  expect(message).not.toContain(key);
  for (const line of lines) expect(line).not.toContain(key);
});
