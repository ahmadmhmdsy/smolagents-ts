import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("tools package", () => {
  it("exports a version string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
