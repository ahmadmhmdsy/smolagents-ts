import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ToolRegistry, noopLogger, tool, type CodeResult } from "@smolagents-ts/core";
import { z } from "zod";

import { PyodideExecutor } from "../src/executor.js";

/**
 * Probe A, pinned as a test: a Python guest under runPythonAsync awaits a host callable whose
 * JavaScript implementation returns a promise that a real timer settles. If Pyodide could not
 * do this, capabilities.asyncToolCalls would have to be false and the bridge would have to
 * report that instead of pretending.
 */
const slowPing = tool({
  name: "slow_ping",
  description: "Resolves a label after a real timer.",
  inputSchema: z.object({ label: z.string(), delayMs: z.number().int().nonnegative() }),
  execute: (input) =>
    new Promise<string>((resolve) => {
      setTimeout(() => resolve("pinged " + input.label), input.delayMs);
    }),
});

describe("PyodideExecutor async tool calls", () => {
  let executor: PyodideExecutor;

  beforeAll(() => {
    executor = new PyodideExecutor();
  }, 120_000);

  afterAll(async () => {
    await executor.dispose();
  });

  it("awaits a host promise that a real timer settles", async () => {
    const started = Date.now();
    const result: CodeResult = await executor.execute(
      'value = await slow_ping(label="p", delayMs=120)\nfinal_answer(value)',
      {
        tools: new ToolRegistry([slowPing]),
        finalAnswer: { name: "final_answer", submit: () => undefined },
        signal: new AbortController().signal,
        timeoutMs: 20_000,
        stepIndex: 0,
        logger: noopLogger,
      },
    );
    const elapsed = Date.now() - started;
    expect(result.error).toBeUndefined();
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe("pinged p");
    expect(elapsed).toBeGreaterThanOrEqual(120);
    expect(executor.capabilities.asyncToolCalls).toBe(true);
  }, 120_000);

  it("keeps the guest from continuing on its own while the host promise is pending", async () => {
    // A tool that never settles must leave the guest waiting, so the run cannot finish:
    // awaiting a host promise is a real suspension, not a synchronous shortcut.
    const hanging = tool({
      name: "hanging",
      description: "Never settles.",
      inputSchema: z.object({}),
      execute: () => new Promise<string>(() => undefined),
    });
    const result = await executor.execute('await hanging()\nprint("unreachable")', {
      tools: new ToolRegistry([hanging]),
      finalAnswer: { name: "final_answer", submit: () => undefined },
      signal: new AbortController().signal,
      timeoutMs: 250,
      stepIndex: 0,
      logger: noopLogger,
    });
    expect(result.error?.code).toBe("AGENT_TIMEOUT");
    expect(result.logs).not.toContain("unreachable");
  }, 120_000);
});
