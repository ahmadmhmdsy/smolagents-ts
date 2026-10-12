import { describe, expect, it } from "vitest";
import { ScriptedExecutor, finalAnswerResult } from "../src/testing/scripted-executor.js";
import { ToolRegistry } from "../src/tool/registry.js";

const options = () => ({
  tools: new ToolRegistry(),
  finalAnswer: { name: "final_answer", submit: () => undefined },
  signal: new AbortController().signal,
  timeoutMs: 1000,
  stepIndex: 0,
  logger: { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined },
});

describe("ScriptedExecutor", () => {
  it("records the code it was asked to run", async () => {
    const executor = new ScriptedExecutor();
    await executor.execute("console.log(1)", options());
    expect(executor.executed).toEqual(["console.log(1)"]);
  });

  it("returns a non-final empty result by default", async () => {
    const result = await new ScriptedExecutor().execute("console.log(1)", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.logs).toBe("");
    expect(result.toolCallCount).toBe(0);
  });

  it("dispatches to a recorded result by exact code", async () => {
    const executor = new ScriptedExecutor({
      results: { "final_answer(4)": finalAnswerResult(4) },
    });
    const result = await executor.execute("final_answer(4)", options());
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe(4);
  });

  it("falls back to the handler for unrecorded code", async () => {
    const executor = new ScriptedExecutor({
      results: { known: finalAnswerResult(1) },
      handler: (code) => ({ logs: "ran " + code, isFinalAnswer: false, durationMs: 1, toolCallCount: 0 }),
    });
    const result = await executor.execute("unknown", options());
    expect(result.logs).toBe("ran unknown");
  });

  it("throws a helpful error for unrecorded code with no handler", async () => {
    const executor = new ScriptedExecutor({ results: { known: finalAnswerResult(1) } });
    await expect(executor.execute("unknown", options())).rejects.toThrow(/no scripted result/i);
  });

  it("defaults to JavaScript with async tool calls and no network", () => {
    const executor = new ScriptedExecutor();
    expect(executor.language).toBe("javascript");
    expect(executor.capabilities.asyncToolCalls).toBe(true);
    expect(executor.capabilities.network).toBe("host-mediated");
  });

  it("lets capabilities be overridden", () => {
    const executor = new ScriptedExecutor({ capabilities: { asyncToolCalls: false } });
    expect(executor.capabilities.asyncToolCalls).toBe(false);
  });

  it("records execution order across several calls", async () => {
    const executor = new ScriptedExecutor();
    await executor.execute("a", options());
    await executor.execute("b", options());
    expect(executor.executed).toEqual(["a", "b"]);
  });
});
