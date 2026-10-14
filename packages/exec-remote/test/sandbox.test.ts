import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { SerializationError } from "../src/errors.js";
import { buildStepSource, parseFrameLine } from "../src/shim-source.js";
import type { RemoteSandbox } from "../src/sandbox.js";

describe("the sandbox seam", () => {
  it("is satisfied by the process backend", () => {
    const sandbox: RemoteSandbox = new ProcessSandbox();
    expect(sandbox.supportsToolRoundTrip).toBe(true);
    expect(sandbox.capabilities).toEqual({ isolation: "process", network: "none", timers: false });
  });

  it("treats a line without the sentinel as output", () => {
    expect(parseFrameLine("just a print")).toBeUndefined();
    expect(parseFrameLine("@@SMOLAGENTS_FRAME@@{\"type\":\"step_end\"}")).toEqual({ type: "step_end" });
  });

  it("refuses a malformed or unknown frame instead of guessing", () => {
    expect(() => parseFrameLine("@@SMOLAGENTS_FRAME@@not json")).toThrow(SerializationError);
    expect(() => parseFrameLine('@@SMOLAGENTS_FRAME@@{"type":"mystery"}')).toThrow(SerializationError);
    expect(() => parseFrameLine('@@SMOLAGENTS_FRAME@@{"type":"final_answer","value":{"__t":"mystery"}}')).toThrow(
      SerializationError,
    );
  });

  it("wraps an empty step so a try block is never empty", () => {
    expect(buildStepSource("")).toContain("    pass");
    expect(buildStepSource("x = 1")).toContain("    x = 1");
  });
});
