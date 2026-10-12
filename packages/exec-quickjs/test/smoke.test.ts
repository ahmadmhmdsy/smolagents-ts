import { describe, expect, it } from "vitest";
import { VERSION } from "../src/index.js";

describe("exec-quickjs package", () => {
  it("exports a version string", () => {
    expect(typeof VERSION).toBe("string");
    expect(VERSION.length).toBeGreaterThan(0);
  });
});
