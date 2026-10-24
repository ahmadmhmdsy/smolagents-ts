import { describe, expect, it, vi } from "vitest";
import {
  E2BSandbox,
  E2B_NODE_FLOOR,
  satisfiesNodeFloor,
  type E2BClient,
  type E2BSandboxLike,
} from "../src/backends/e2b.js";
import {
  MissingPeerDependencyError,
  SandboxError,
  UnsupportedNodeVersionError,
  UnsupportedOptionError,
} from "../src/errors.js";
import { FRAME_PREFIX } from "../src/shim-source.js";

// Force the optional peer's dynamic import to fail, so the typed missing-peer refusal is
// exercised even though the peer is installed in this workspace.
vi.mock("@e2b/code-interpreter", () => {
  throw new Error("@e2b/code-interpreter is not installed");
});

interface FakeClient extends E2BClient {
  readonly codes: string[];
  readonly kills: string[];
  readonly creates: number;
  readonly createOptions: { egress?: string }[];
}

function fakeClient(
  options: {
    readonly failCreate?: boolean;
    readonly failRun?: boolean;
    readonly failKill?: boolean;
    readonly emitToolCall?: boolean;
  } = {},
): FakeClient {
  const codes: string[] = [];
  const kills: string[] = [];
  const createOptions: { egress?: string }[] = [];
  let creates = 0;
  const sandbox: E2BSandboxLike = {
    sandboxId: "sbx-1",
    async runCode(code, runOptions) {
      if (options.failRun === true && code !== "PRELUDE") throw new Error("the vendor sandbox died");
      codes.push(code);
      if (options.emitToolCall === true && code.includes("REFUSE_TOOL")) {
        // The shim emits the request frame before refusing; the backend must type it.
        runOptions?.onStdout?.(
          FRAME_PREFIX + JSON.stringify({ type: "tool_call", callId: "call-1", name: "echo", args: { text: "hi" } }),
        );
        runOptions?.onStdout?.(FRAME_PREFIX + JSON.stringify({ type: "error", name: "RuntimeError", message: "no mid-run call channel" }));
        runOptions?.onStdout?.(FRAME_PREFIX + JSON.stringify({ type: "step_end" }));
        return {};
      }
      if (code.includes("print(") || code.startsWith("try:")) {
        runOptions?.onStdout?.(FRAME_PREFIX + JSON.stringify({ type: "final_answer", value: 42 }));
        runOptions?.onStdout?.("hello");
        runOptions?.onStdout?.(FRAME_PREFIX + JSON.stringify({ type: "step_end" }));
      }
      return {};
    },
    async kill() {
      if (options.failKill === true) throw new Error("the vendor sandbox would not die");
      kills.push("sbx-1");
    },
  };
  return {
    codes,
    kills,
    createOptions,
    get creates() {
      return creates;
    },
    async create(request) {
      createOptions.push({ egress: request.egress });
      creates += 1;
      if (options.failCreate === true) throw new Error("no api key");
      return sandbox;
    },
  };
}

describe("the E2B backend", () => {
  it("refuses at construction when the host is below the vendor's Node floor", () => {
    expect(() => new E2BSandbox({ client: fakeClient(), nodeVersion: "22.12.0" })).toThrow(
      UnsupportedNodeVersionError,
    );
    expect(() => new E2BSandbox({ client: fakeClient(), nodeVersion: E2B_NODE_FLOOR })).not.toThrow();
    expect(satisfiesNodeFloor("22.19.0", "22.19.0")).toBe(true);
    expect(satisfiesNodeFloor("22.18.1", "22.19.0")).toBe(false);
    expect(satisfiesNodeFloor("24.0.0", "22.19.0")).toBe(true);
  });

  it("passes deny-all through the client seam and reports no reach", async () => {
    const client = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0", egress: "deny-all" });
    expect(sandbox.capabilities.network).toBe("none");

    await sandbox.start({ shimSource: "PRELUDE" });

    expect(client.createOptions).toEqual([{ egress: "deny-all" }]);
  });

  it("installs the prelude once, runs a one-shot step and reports the frames and output", async () => {
    const client = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    expect(sandbox.capabilities).toEqual({
      isolation: "remote",
      network: "direct",
      timers: true,
      toolRoundTrip: false,
    });
    await sandbox.start({ shimSource: "PRELUDE" });
    expect(client.creates).toBe(1);
    expect(client.codes[0]).toBe("PRELUDE");
    const result = await sandbox.run({
      code: "print('hi')",
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    });
    expect(result.outputs.map((output) => output.text)).toEqual(["hello"]);
    expect(result.frames.find((frame) => frame.type === "final_answer")).toEqual({
      type: "final_answer",
      value: 42,
    });
    expect(result.frames.at(-1)).toEqual({ type: "step_end" });
    expect(result.exitStatus).toBeNull();
    await sandbox.dispose();
    expect(client.kills).toEqual(["sbx-1"]);
  });

  it("wraps a vendor create failure and a vendor run failure as SandboxError", async () => {
    const failingCreate = fakeClient({ failCreate: true });
    const refused = new E2BSandbox({ client: failingCreate, nodeVersion: "24.0.0" });
    await expect(refused.start({ shimSource: "PRELUDE" })).rejects.toThrow(SandboxError);

    const failingRun = fakeClient({ failRun: true });
    const dead = new E2BSandbox({ client: failingRun, nodeVersion: "24.0.0" });
    await dead.start({ shimSource: "PRELUDE" });
    await expect(
      dead.run({ code: "1", timeoutMs: 100, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
  });

  it("refuses a run before start and disposes once", async () => {
    const client = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    await expect(
      sandbox.run({ code: "1", timeoutMs: 100, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
    await sandbox.dispose();
    await sandbox.dispose();
    expect(client.kills).toEqual([]);
  });

  it("lets a missing optional peer surface as the typed refusal", async () => {
    const sandbox = new E2BSandbox({ nodeVersion: "24.0.0" });
    await expect(sandbox.start({ shimSource: "PRELUDE" })).rejects.toThrow(MissingPeerDependencyError);
  });

  it("resolves dispose even when the vendor kill fails, so teardown cannot mask a result", async () => {
    const client = fakeClient({ failKill: true });
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    await sandbox.start({ shimSource: "PRELUDE" });
    await expect(sandbox.dispose()).resolves.toBeUndefined();
    await expect(sandbox.dispose()).resolves.toBeUndefined();
  });

  it("turns a guest tool request into the typed refusal the rule promises", async () => {
    const client = fakeClient({ emitToolCall: true });
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    await sandbox.start({ shimSource: "PRELUDE" });
    const result = await sandbox.run({
      code: "REFUSE_TOOL",
      timeoutMs: 1_000,
      signal: new AbortController().signal,
    });
    const refusal = result.frames.find((frame) => frame.type === "error") as
      | { name: string; message: string }
      | undefined;
    expect(refusal?.name).toBe("ToolRoundTripUnsupportedError");
    expect(refusal?.message).toContain('"echo"');
    await sandbox.dispose();
  });

  it("refuses a declared tool transfer at start without creating a sandbox", async () => {
    const client = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    await expect(
      sandbox.start({
        shimSource: "PRELUDE",
        transfer: {
          tools: [
            {
              name: "echo",
              description: "Echo.",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
          ],
          variables: { seed: 1 },
        },
      }),
    ).rejects.toThrow(UnsupportedOptionError);
    await expect(
      sandbox.start({
        shimSource: "PRELUDE",
        transfer: {
          tools: [
            {
              name: "echo",
              description: "Echo.",
              inputSchema: { type: "object", properties: {}, additionalProperties: false },
            },
          ],
          variables: { seed: 1 },
        },
      }),
    ).rejects.toThrow(/transfer\.tools/);
    expect(client.creates).toBe(0);
  });
});
