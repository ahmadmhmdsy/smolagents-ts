// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isSameOriginRequest } from "../vite.config.js";

describe("the key-adding proxy's guard", () => {
  it("admits the page and a local tool", () => {
    const host = "localhost:5173";

    expect(isSameOriginRequest({ host })).toBe(true);
    expect(isSameOriginRequest({ host, "sec-fetch-site": "same-origin" })).toBe(true);
    expect(isSameOriginRequest({ host, "sec-fetch-site": "none" })).toBe(true);
    expect(isSameOriginRequest({ host, origin: "http://localhost:5173" })).toBe(true);
  });

  it("refuses another site in the same browser", () => {
    const host = "localhost:5173";

    expect(isSameOriginRequest({ host, "sec-fetch-site": "cross-site" })).toBe(false);
    expect(isSameOriginRequest({ host, "sec-fetch-site": "same-site" })).toBe(false);
    expect(isSameOriginRequest({ host, origin: "https://evil.test" })).toBe(false);
    expect(isSameOriginRequest({ host, origin: "null" })).toBe(false);
  });
});
