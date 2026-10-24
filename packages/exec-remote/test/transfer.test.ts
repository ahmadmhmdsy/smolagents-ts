import { ToolRegistry, noopLogger, tool } from "@smolagents-ts/core";
import { z } from "zod";
import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
// The refusal is asserted by its typed name on the failed step; see the case below.
import { RemoteExecutor } from "../src/executor.js";
import type { RemoteSandbox, SandboxRunOptions, SandboxStartOptions } from "../src/sandbox.js";

const alpha = tool({
  name: "alpha",
  description: "first tool",
  inputSchema: z.object({}),
  execute: () => "a",
});
const beta = tool({
  name: "beta",
  description: "second tool",
  inputSchema: z.object({}),
  execute: () => "b",
});

function registry(): ToolRegistry {
  return new ToolRegistry([alpha, beta]);
}

function options(tools: ToolRegistry) {
  return {
    tools,
    finalAnswer: { name: "final_answer", submit: () => undefined },
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    stepIndex: 0,
    logger: noopLogger,
  };
}

/** A double that records the prelude it was asked to install and answers one empty step. */
class RecordingSandbox implements RemoteSandbox {
  readonly capabilities = { isolation: "process", network: "direct", timers: false, toolRoundTrip: true } as const;
  readonly starts: SandboxStartOptions[] = [];

  async start(startedWith: SandboxStartOptions): Promise<void> {
    this.starts.push(startedWith);
  }

  async run(_options: SandboxRunOptions) {
    return { frames: [], outputs: [], exitStatus: null, durationMs: 0 };
  }

  async dispose(): Promise<void> {
    // Nothing to release.
  }
}

function installedTools(shimSource: string): string[] {
  const names: string[] = [];
  for (const line of shimSource.split("\n")) {
    const match = /^globals\(\)\[(".*")\] = _make_tool/.exec(line);
    if (match !== null) names.push(JSON.parse(match[1] as string) as string);
  }
  return names;
}

describe("a declared transfer", () => {
  it("makes a declared variable live in the guest before step 0", async () => {
    const executor = new RemoteExecutor({
      sandbox: new ProcessSandbox(),
      transfer: { tools: [], variables: { seed: 41 } },
    });
    try {
      const result = await executor.execute("final_answer(seed + 1)", options(new ToolRegistry([])));
      expect(result.isFinalAnswer).toBe(true);
      expect(result.value).toBe(42);
    } finally {
      await executor.dispose();
    }
  });

  it("installs exactly the declared subset, while no transfer still installs every registry tool", async () => {
    const declared = new RecordingSandbox();
    const withTransfer = new RemoteExecutor({
      sandbox: declared,
      transfer: { tools: [alpha.toSpec()], variables: {} },
    });
    await withTransfer.execute("pass", options(registry()));
    expect(installedTools(declared.starts[0]!.shimSource)).toEqual(["alpha"]);

    const plain = new RecordingSandbox();
    const withoutTransfer = new RemoteExecutor({ sandbox: plain });
    await withoutTransfer.execute("pass", options(registry()));
    expect(installedTools(plain.starts[0]!.shimSource)).toEqual(["alpha", "beta"]);
  });

  it("refuses a variable name that is not a Python identifier before anything starts", async () => {
    const sandbox = new RecordingSandbox();
    const executor = new RemoteExecutor({
      sandbox,
      transfer: { tools: [], variables: { "not-an-identifier": 1 } },
    });
    const result = await executor.execute("pass", options(new ToolRegistry([])));
    // The executor reports a failure as a step result rather than throwing, and the typed name
    // survives in the info; what matters equally is that no sandbox was started.
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error?.name).toBe("SerializationError");
    expect(result.error?.message).toContain("not-an-identifier");
    expect(sandbox.starts).toEqual([]);
  });
});
