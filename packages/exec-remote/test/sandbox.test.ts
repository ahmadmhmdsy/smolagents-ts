import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { SerializationError } from "../src/errors.js";
import { buildShimSource, buildStepSource, parseFrameLine } from "../src/shim-source.js";
import type { RemoteSandbox } from "../src/sandbox.js";

describe("the sandbox seam", () => {
  it("is satisfied by the process backend", async () => {
    const sandbox: RemoteSandbox = new ProcessSandbox();
    expect(sandbox.capabilities).toEqual({
      isolation: "process",
      network: "direct",
      timers: false,
      toolRoundTrip: true,
    });
    await sandbox.dispose();
  });

  it("treats a line without the sentinel as output", () => {
    expect(parseFrameLine("just a print")).toBeUndefined();
    expect(parseFrameLine("@@SMOLAGENTS_FRAME@@{\"type\":\"step_end\"}")).toEqual({ type: "step_end" });
  });

  it("leaves a marked line that is not a frame as output, so guest text cannot end the step", () => {
    expect(parseFrameLine("@@SMOLAGENTS_FRAME@@not json")).toBeUndefined();
    expect(parseFrameLine("@@SMOLAGENTS_FRAME@@[1]")).toBeUndefined();
    expect(parseFrameLine('@@SMOLAGENTS_FRAME@@{"type":"mystery"}')).toBeUndefined();
  });

  it("reads frames only under the run's nonce and writes that nonce into the prelude", () => {
    const options = { frameNonce: "abc123" };
    expect(parseFrameLine('@@SMOLAGENTS_FRAME@@{"type":"step_end"}', options)).toBeUndefined();
    expect(parseFrameLine('@@SMOLAGENTS_FRAME@@abc123@@{"type":"step_end"}', options)).toEqual({
      type: "step_end",
    });
    const shim = buildShimSource({ tools: [], allowToolCalls: true, frameNonce: "abc123" });
    expect(shim).toContain('_FRAME_PREFIX = "@@SMOLAGENTS_FRAME@@abc123@@"');
    expect(shim).not.toContain("__FRAME_MARKER__");
  });

  it("still refuses a real frame whose value cannot be decoded", () => {
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
