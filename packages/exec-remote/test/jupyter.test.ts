import { afterEach, describe, expect, it } from "vitest";
import { SandboxError } from "../src/errors.js";
import { JupyterGateway, globalWebSocketFactory } from "../src/jupyter.js";
import { RpcTimeoutError } from "../src/rpc.js";
import { startJupyterLoopback, type LoopbackJupyter } from "./ws-server.js";

let server: LoopbackJupyter | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

function gateway(overrides: { readonly token?: string; readonly readyAttempts?: number; readonly readyIntervalMs?: number } = {}): JupyterGateway {
  if (server === undefined) throw new Error("the loopback server is not running");
  return new JupyterGateway({
    baseUrl: server.url,
    token: overrides.token ?? server.token,
    webSocketFactory: globalWebSocketFactory,
    readyAttempts: overrides.readyAttempts ?? 3,
    readyIntervalMs: overrides.readyIntervalMs ?? 10,
    requestTimeoutMs: 5_000,
  });
}

describe("the Jupyter Kernel Gateway driver", () => {
  it("polled the readiness probe, creates a kernel and folds a stream, a result and the idle status", async () => {
    server = await startJupyterLoopback();
    const client = gateway();
    await client.waitForReady();
    const kernelId = await client.createKernel();
    expect(kernelId).toBe(server.kernelId);
    const kernel = client.connect(kernelId);
    const result = await kernel.run({
      code: "print()",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(result.outputs.map((output) => output.text)).toEqual(["hello", "42"]);
    expect(result.frames.at(-1)).toEqual({ type: "step_end" });
    expect(result.exitStatus).toBeNull();
    kernel.dispose();
    expect(server.requests).toContain("print()");
  });

  it("answers the guest's input() over the kernel's stdin channel and carries the tool result", async () => {
    server = await startJupyterLoopback();
    const client = gateway();
    const kernelId = await client.createKernel();
    const kernel = client.connect(kernelId);
    const calls: unknown[] = [];
    const result = await kernel.run({
      code: "CALL_TOOL",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
      callTool: (call) => {
        calls.push({ callId: call.callId, name: call.name, args: call.args });
        return "echoed:hi";
      },
    });
    expect(calls).toEqual([{ callId: "call-1", name: "echo", args: { text: "hi" } }]);
    expect(result.frames.find((frame) => frame.type === "final_answer")).toEqual({
      type: "final_answer",
      value: "echoed:hi",
    });
    expect(server.inputReplies[0]).toContain("echoed:hi");
    kernel.dispose();
  });

  it("refuses a wrong token at the HTTP handshake and at the WebSocket upgrade", async () => {
    server = await startJupyterLoopback();
    const wrong = gateway({ token: "wrong", readyAttempts: 1, readyIntervalMs: 1 });
    await expect(wrong.waitForReady()).rejects.toThrow(SandboxError);
    await expect(wrong.createKernel()).rejects.toThrow(SandboxError);
    const kernel = wrong.connect(server.kernelId);
    await expect(
      kernel.run({ code: "print()", timeoutMs: 1_000, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
    kernel.dispose();
    expect(server.rejectedTokens).toBeGreaterThan(0);
  });

  it("fails a run whose kernel never reports idle", async () => {
    server = await startJupyterLoopback();
    const client = gateway();
    const kernelId = await client.createKernel();
    const kernel = client.connect(kernelId);
    await expect(
      kernel.run({ code: "HANG", timeoutMs: 30, signal: new AbortController().signal }),
    ).rejects.toThrow(RpcTimeoutError);
    kernel.dispose();
  });
});
