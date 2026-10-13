import { describe, expect, it } from "vitest";
import { HttpError, joinUrl, resolveFetch } from "../src/transport.js";

describe("resolveFetch", () => {
  it("prefers the injected transport", () => {
    const injected = (() => Promise.reject(new Error("unused"))) as unknown as typeof fetch;
    expect(resolveFetch(injected)).toBe(injected);
  });

  it("falls back to the global fetch", () => {
    expect(resolveFetch()).toBe(globalThis.fetch);
  });
});

describe("joinUrl", () => {
  it("does not double the slash", () => {
    expect(joinUrl("https://api.openai.com/v1/", "/chat/completions")).toBe(
      "https://api.openai.com/v1/chat/completions",
    );
  });

  it("adds the slash when the base has none", () => {
    expect(joinUrl("http://localhost:11434/v1", "/chat/completions")).toBe(
      "http://localhost:11434/v1/chat/completions",
    );
  });
});

describe("HttpError", () => {
  it("carries status, body and url", () => {
    const error = new HttpError(429, "slow down", "https://example.test/v1/chat/completions");
    expect(error.status).toBe(429);
    expect(error.body).toBe("slow down");
    expect(error.message).toContain("429");
    expect(error.message).toContain("slow down");
    expect(error.url).toBe("https://example.test/v1/chat/completions");
    expect(error).toBeInstanceOf(Error);
  });
});
