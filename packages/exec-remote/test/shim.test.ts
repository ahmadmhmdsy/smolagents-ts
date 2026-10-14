import type { ToolSpec } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { ProcessSandbox } from "../src/backends/process.js";
import { PickleRefusedError } from "../src/errors.js";
import { buildShimSource } from "../src/shim-source.js";

const echo: ToolSpec = {
  name: "echo",
  description: "Echo the argument back.",
  inputSchema: {
    type: "object",
    properties: { text: { type: "string" } },
    required: ["text"],
    additionalProperties: false,
  },
};

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("the guest shim", () => {
  it("cannot lose its answer to a guest's except Exception", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: buildShimSource({ tools: [], allowToolCalls: false }) });
    const result = await sandbox.run({
      code: 'try:\n    final_answer("first")\nexcept Exception:\n    final_answer("second")',
      timeoutMs: 5_000,
      signal: signal(),
    });
    const answers = result.frames.filter((frame) => frame.type === "final_answer");
    expect(answers).toEqual([{ type: "final_answer", value: "first" }]);
    expect(result.frames.at(-1)).toEqual({ type: "step_end" });
    await sandbox.dispose();
  });

  it("round-trips one request and one response per tool call", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: buildShimSource({ tools: [echo], allowToolCalls: true }) });
    const calls: { name: string; args: unknown }[] = [];
    const result = await sandbox.run({
      code: 'first = echo(text="one")\nsecond = echo(text="two")\nfinal_answer([first, second])',
      timeoutMs: 5_000,
      signal: signal(),
      callTool: (call) => {
        calls.push({ name: call.name, args: call.args });
        const args = call.args as { text: string };
        return "echoed:" + args.text;
      },
    });
    expect(calls).toEqual([
      { name: "echo", args: { text: "one" } },
      { name: "echo", args: { text: "two" } },
    ]);
    const requests = result.frames.filter((frame) => frame.type === "tool_call");
    expect(requests).toHaveLength(2);
    expect(new Set(requests.map((frame) => frame.callId)).size).toBe(2);
    expect(result.frames.find((frame) => frame.type === "final_answer")).toEqual({
      type: "final_answer",
      value: ["echoed:one", "echoed:two"],
    });
    await sandbox.dispose();
  });

  it("refuses a tool call with a named error rather than hanging when the shim has no channel", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: buildShimSource({ tools: [echo], allowToolCalls: false }) });
    const result = await sandbox.run({
      code: 'print(echo(text="one"))',
      timeoutMs: 5_000,
      signal: signal(),
    });
    expect(result.frames[0]).toMatchObject({ type: "error", name: "RuntimeError" });
    const error = result.frames[0] as { message: string };
    expect(error.message).toContain("no mid-run call channel");
    expect(result.frames.at(-1)).toEqual({ type: "step_end" });
    await sandbox.dispose();
  });

  it("refuses a pickle: answer by default and carries raw bytes when opted in", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: buildShimSource({ tools: [], allowToolCalls: false }) });
    await expect(
      sandbox.run({ code: 'final_answer("pickle:AAAA")', timeoutMs: 5_000, signal: signal() }),
    ).rejects.toThrow(PickleRefusedError);
    const allowed = new ProcessSandbox();
    await allowed.start({ shimSource: buildShimSource({ tools: [], allowToolCalls: false }) });
    const result = await allowed.run({
      code: 'final_answer("pickle:AAAA")',
      timeoutMs: 5_000,
      signal: signal(),
      allowPickle: true,
    });
    const answer = result.frames[0] as { value: Uint8Array };
    expect([...answer.value]).toEqual([0, 0, 0]);
    await sandbox.dispose();
    await allowed.dispose();
  });
});
