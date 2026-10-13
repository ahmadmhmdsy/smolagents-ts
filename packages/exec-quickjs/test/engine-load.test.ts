import { describe, expect, it, vi } from "vitest";
import { AgentExecutionError, ToolRegistry, noopLogger } from "@smolagents-ts/core";
import { QuickJSExecutor } from "../src/executor.js";

// rules/components/exec-quickjs.md: a platform with no usable WASM binary produces a typed
// executor error rather than falling back to the host realm. The loader is the only way to
// reach that branch on a machine where the binary does load, so this file alone replaces the
// engine's entry point with one that fails the way a platform without the binary would.
vi.mock("quickjs-emscripten-core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("quickjs-emscripten-core")>();
  return {
    ...actual,
    newQuickJSWASMModuleFromVariant: () => Promise.reject(new Error("no usable wasm binary")),
  };
});

describe("QuickJSExecutor with no usable engine", () => {
  it("fails with a typed executor error instead of the loader's own", async () => {
    const executor = new QuickJSExecutor();
    const failure = executor.execute("1 + 1", {
      tools: new ToolRegistry([]),
      finalAnswer: { name: "final_answer", submit: () => {} },
      signal: new AbortController().signal,
      timeoutMs: 0,
      stepIndex: 3,
      logger: noopLogger,
    });
    await expect(failure).rejects.toBeInstanceOf(AgentExecutionError);
    await expect(failure).rejects.toMatchObject({
      code: "AGENT_EXECUTION",
      stepIndex: 3,
      message: expect.stringContaining("could not be loaded"),
    });
    // Nothing was created, so release stays quiet.
    await executor.dispose();
  });
});
