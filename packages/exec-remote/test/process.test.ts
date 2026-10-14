import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { SandboxError } from "../src/errors.js";
import { buildShimSource } from "../src/shim-source.js";

const shim = buildShimSource({ tools: [], allowToolCalls: false });

describe("the process backend", () => {
  it("runs a real interpreter and reports the answer, a captured print and a clean step end", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: shim });
    const result = await sandbox.run({
      code: 'print("hello")\nfinal_answer("done")',
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(result.exitStatus).toBeNull();
    expect(result.outputs.map((output) => output.text)).toContain("hello");
    expect(result.frames).toEqual([
      { type: "final_answer", value: "done" },
      { type: "step_end" },
    ]);
    await sandbox.dispose();
  });

  it("keeps the interpreter alive across steps", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: shim });
    const first = await sandbox.run({
      code: "state = 41",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(first.frames).toEqual([{ type: "step_end" }]);
    const second = await sandbox.run({
      code: "final_answer(state + 1)",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(second.frames[0]).toEqual({ type: "final_answer", value: 42 });
    await sandbox.dispose();
  });

  it("reports a non-zero exit when the guest kills its own interpreter", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: shim });
    const result = await sandbox.run({
      code: "import os\nos._exit(3)",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(result.exitStatus).toBe(3);
    expect(result.frames).toEqual([]);
    await sandbox.dispose();
  });

  it("leaves no child behind after dispose", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: shim });
    const pid = sandbox.pid;
    expect(pid).toBeTypeOf("number");
    await sandbox.dispose();
    expect(sandbox.isRunning).toBe(false);
    expect(() => process.kill(pid as number, 0)).toThrow();
    await expect(
      sandbox.run({ code: "1", timeoutMs: 1_000, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
  });

  it("refuses a run before start and after a failed spawn", async () => {
    const sandbox = new ProcessSandbox();
    await expect(
      sandbox.run({ code: "1", timeoutMs: 1_000, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
    const missing = new ProcessSandbox({ program: "smolagents-no-such-interpreter" });
    await expect(missing.start({ shimSource: shim })).rejects.toThrow(SandboxError);
    await missing.dispose();
  });
});
