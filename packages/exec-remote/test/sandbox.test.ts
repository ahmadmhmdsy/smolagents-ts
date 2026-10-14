import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { SerializationError } from "../src/errors.js";
import { buildStepSource, parseFrameLine } from "../src/shim-source.js";
import type { RemoteSandbox } from "../src/sandbox.js";

describe("the sandbox seam", () => {
  it("is satisfied by the process backend", async () => {
    const sandbox: RemoteSandbox = new ProcessSandbox();
    expect(sandbox.capabilities).toEqual({
      isolation: "process",
      network: "none",
      timers: false,
      toolRoundTrip: true,
    });
    await sandbox.dispose();
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

  it("embeds the step as one string literal rather than indenting every line", () => {
    expect(buildStepSource("")).toContain("    pass");
    // The literal form preserves the interior of a multi-line string, so the code is not
    // re-indented; the trailing 4-space quote would only exist in the old indented form.
    expect(buildStepSource("x = 1")).toContain('compile("x = 1", "<smolagent-step>", "exec")');
    expect(buildStepSource("x = 1")).not.toContain('    x = 1');
  });
});
