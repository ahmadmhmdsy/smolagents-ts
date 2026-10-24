import { ToolRegistry, noopLogger } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { EgressUnsupportedError, SandboxError } from "../src/errors.js";
import { createProcessExecutor } from "../src/process.js";
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

  it("surfaces that kill through the executor as an execution failure rather than an empty step", async () => {
    const executor = createProcessExecutor();
    try {
      const result = await executor.execute("import os\nos._exit(3)", {
        tools: new ToolRegistry([]),
        finalAnswer: { name: "final_answer", submit: () => undefined },
        signal: new AbortController().signal,
        timeoutMs: 5_000,
        stepIndex: 0,
        logger: noopLogger,
      });
      expect(result.isFinalAnswer).toBe(false);
      expect(result.error?.name).toBe("SandboxError");
      expect(result.error?.code).toBe("AGENT_EXECUTION");
      expect(result.error?.message).toContain("3");
    } finally {
      await executor.dispose?.();
    }
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

/** Start the sandbox, read the guest's answer to one `os.environ.get` probe, and tear it down. */
async function readEnvironmentVariable(sandbox: ProcessSandbox, name: string): Promise<string> {
  await sandbox.start({ shimSource: shim });
  try {
    const result = await sandbox.run({
      code: 'import os\nprint(os.environ.get("' + name + '", "absent"))',
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    const text = result.outputs.map((output) => output.text).join("\n");
    if (text === "") throw new Error("the interpreter printed nothing");
    return text;
  } finally {
    await sandbox.dispose();
  }
}

describe("the process backend's child environment", () => {
  it("refuses deny-all before it spawns an interpreter", async () => {
    const sandbox = new ProcessSandbox({ egress: "deny-all", program: "definitely-not-python" });

    await expect(sandbox.start({ shimSource: "print('x')" })).rejects.toThrow(
      EgressUnsupportedError,
    );
    expect(sandbox.isRunning).toBe(false);
  });

  it("reports direct network access and an allow-listed environment", () => {
    const sandbox = new ProcessSandbox();
    expect(sandbox.capabilities).toEqual({
      isolation: "process",
      network: "direct",
      timers: false,
      toolRoundTrip: true,
    });
  });

  it("withholds a host variable the allow-list does not name", async () => {
    const name = "SMOLAGENTS_TS_TEST_SECRET";
    process.env[name] = "leaked";
    try {
      expect(await readEnvironmentVariable(new ProcessSandbox(), name)).toBe("absent");
    } finally {
      delete process.env[name];
    }
  });

  it("inherits a host variable only when envPassthrough names it", async () => {
    const name = "SMOLAGENTS_TS_TEST_PASSTHROUGH";
    process.env[name] = "from-host";
    try {
      const inherited = new ProcessSandbox({ envPassthrough: [name] });
      expect(await readEnvironmentVariable(inherited, name)).toBe("from-host");
    } finally {
      delete process.env[name];
    }
  });

  it("lets an explicit env value win, including removing a passed-through name", async () => {
    const name = "SMOLAGENTS_TS_TEST_OVERRIDE";
    process.env[name] = "from-host";
    try {
      const overridden = new ProcessSandbox({
        envPassthrough: [name],
        env: { [name]: "explicit" },
      });
      expect(await readEnvironmentVariable(overridden, name)).toBe("explicit");
      const removed = new ProcessSandbox({
        envPassthrough: [name],
        env: { [name]: undefined },
      });
      expect(await readEnvironmentVariable(removed, name)).toBe("absent");
    } finally {
      delete process.env[name];
    }
  });

  it("starts an interpreter with only the allow-list, so PATH and the locale names survive", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: shim });
    try {
      const result = await sandbox.run({
        code: 'import os\nprint("path=" + str("PATH" in os.environ))',
        timeoutMs: 5_000,
        signal: new AbortController().signal,
      });
      expect(result.outputs.map((output) => output.text)).toContain("path=True");
    } finally {
      await sandbox.dispose();
    }
  });
});
