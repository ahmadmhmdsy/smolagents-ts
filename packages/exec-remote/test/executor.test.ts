import { AgentCancelledError, AgentTimeoutError, ToolRegistry, noopLogger, tool } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SandboxError } from "../src/errors.js";
import { RemoteExecutor } from "../src/executor.js";
import { createProcessExecutor } from "../src/process.js";
import type {
  RemoteSandbox,
  SandboxCapabilities,
  SandboxRunOptions,
  SandboxRunResult,
  SandboxStartOptions,
} from "../src/sandbox.js";
import { FRAME_PREFIX, parseFrameLine } from "../src/shim-source.js";

class FakeSandbox implements RemoteSandbox {
  readonly supportsToolRoundTrip: boolean;
  readonly capabilities: SandboxCapabilities;
  starts = 0;
  disposals = 0;
  lastStart: SandboxStartOptions | undefined;
  lastRun: SandboxRunOptions | undefined;
  private readonly impl: (options: SandboxRunOptions) => Promise<SandboxRunResult>;

  constructor(
    impl: (options: SandboxRunOptions) => Promise<SandboxRunResult>,
    settings: { readonly supportsToolRoundTrip?: boolean } = {},
  ) {
    this.impl = impl;
    this.supportsToolRoundTrip = settings.supportsToolRoundTrip ?? true;
    this.capabilities = { isolation: "process", network: "none", timers: false };
  }

  async start(options: SandboxStartOptions): Promise<void> {
    this.starts += 1;
    this.lastStart = options;
  }

  async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    this.lastRun = options;
    return this.impl(options);
  }

  async dispose(): Promise<void> {
    this.disposals += 1;
  }
}

function registry(): ToolRegistry {
  return new ToolRegistry([
    tool({
      name: "echo",
      description: "Echo the text back",
      inputSchema: z.object({ text: z.string() }),
      execute: (input) => "echoed:" + input.text,
    }),
  ]);
}

function options(overrides: Partial<Parameters<RemoteExecutor["execute"]>[1]> = {}) {
  return {
    tools: registry(),
    finalAnswer: { name: "final_answer", submit: () => undefined },
    signal: new AbortController().signal,
    timeoutMs: 5_000,
    stepIndex: 0,
    logger: noopLogger,
    ...overrides,
  };
}

const answer = (value: unknown): SandboxRunResult => ({
  frames: [{ type: "final_answer", value }, { type: "step_end" }],
  outputs: [],
  exitStatus: null,
  durationMs: 1,
});

describe("the remote executor", () => {
  it("starts lazily, installs the shim with the tool specs and folds a final answer", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      runOptions.onOutput?.({ stream: "stdout", text: "hello" });
      return answer({ ok: true });
    });
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("print('hi')", options());
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toEqual({ ok: true });
    expect(result.logs).toBe("hello");
    expect(result.toolCallCount).toBe(0);
    expect(sandbox.starts).toBe(1);
    expect(sandbox.lastStart?.shimSource).toContain("echo");
    const second = await executor.execute("print('again')", options());
    expect(second.isFinalAnswer).toBe(true);
    expect(sandbox.starts).toBe(1);
  });

  it("answers a tool frame through the registry and reports both events", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      const output = await runOptions.callTool?.({ callId: "call-1", name: "echo", args: { text: "hi" } });
      return answer(output);
    });
    const executor = new RemoteExecutor({ sandbox });
    const events: unknown[] = [];
    const result = await executor.execute("echo()", options({ onToolCall: (event) => events.push(event) }));
    expect(result.isFinalAnswer).toBe(true);
    expect(result.value).toBe("echoed:hi");
    expect(result.toolCallCount).toBe(1);
    expect(events.map((event) => (event as { type: string }).type)).toEqual(["requested", "result"]);
  });

  it("refuses an unregistered tool by name and reports the failure event", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      try {
        await runOptions.callTool?.({ callId: "call-9", name: "missing", args: {} });
      } catch {
        return {
          frames: [{ type: "error", name: "RuntimeError", message: "ToolNotFoundError" }],
          outputs: [],
          exitStatus: null,
          durationMs: 1,
        };
      }
      return answer("unreachable");
    });
    const executor = new RemoteExecutor({ sandbox });
    const events: unknown[] = [];
    const result = await executor.execute("missing()", options({ onToolCall: (event) => events.push(event) }));
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error?.code).toBe("AGENT_EXECUTION");
    expect((events[0] as { error: { name: string } }).error.name).toBe("ToolNotFoundError");
  });

  it("maps a guest failure frame to AGENT_EXECUTION", async () => {
    const sandbox = new FakeSandbox(async () => ({
      frames: [
        { type: "error", name: "ValueError", message: "boom" },
        { type: "step_end" },
      ],
      outputs: [],
      exitStatus: null,
      durationMs: 1,
    }));
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("raise", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error).toEqual({
      name: "ValueError",
      message: "boom",
      code: "AGENT_EXECUTION",
      stepIndex: 0,
    });
  });

  it("names the backend cause when start throws a SandboxError", async () => {
    const sandbox = new FakeSandbox(async () => answer("unreachable"));
    const cause = new Error("connect ENOENT //./pipe/dockerDesktopLinuxEngine");
    sandbox.start = async () => {
      throw new SandboxError("The Docker sandbox could not start.", { cause });
    };
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("print()", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error?.code).toBe("AGENT_EXECUTION");
    expect(result.error?.message).toContain("The Docker sandbox could not start.");
    expect(result.error?.message).toContain("connect ENOENT //./pipe/dockerDesktopLinuxEngine");
  });

  it("times out, disposes the loser and makes the next step a fresh sandbox", async () => {
    const sandboxes: FakeSandbox[] = [];
    const executor = new RemoteExecutor({
      sandbox: () => {
        const sandbox = new FakeSandbox(() => new Promise<SandboxRunResult>(() => undefined));
        sandboxes.push(sandbox);
        return sandbox;
      },
    });
    const timedOut = await executor.execute("loop", options({ timeoutMs: 20 }));
    expect(timedOut.isFinalAnswer).toBe(false);
    expect(timedOut.error).toEqual(
      new AgentTimeoutError("Code execution timed out after 20 ms", { stepIndex: 0 }).info,
    );
    expect(sandboxes[0]?.disposals).toBe(1);
    expect(sandboxes).toHaveLength(2);
    expect(sandboxes[1]?.starts).toBe(0);
    const cancelled = await executor.execute("loop", options({
      signal: AbortSignal.abort(),
    }));
    expect(cancelled.error).toEqual(
      new AgentCancelledError("Code execution was cancelled", { stepIndex: 0 }).info,
    );
  });

  it("aborts a running step when the signal fires", async () => {
    const sandbox = new FakeSandbox(() => new Promise<SandboxRunResult>(() => undefined));
    const executor = new RemoteExecutor({ sandbox });
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 5);
    const result = await executor.execute("loop", options({ signal: controller.signal }));
    expect(result.error?.code).toBe("AGENT_CANCELLED");
    expect(sandbox.disposals).toBe(1);
  });

  it("reports a non-zero interpreter exit with no frames as a failure, not an empty success", async () => {
    const sandbox = new FakeSandbox(async () => ({
      frames: [],
      outputs: [],
      exitStatus: 3,
      durationMs: 1,
    }));
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("import os; os._exit(3)", options({ stepIndex: 2 }));
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error).toEqual({
      name: "SandboxError",
      message: "The interpreter exited with code 3 before step 2 produced a final answer.",
      code: "AGENT_EXECUTION",
      stepIndex: 2,
    });
  });

  it("leaves a clean zero exit with no frames as a plain done result", async () => {
    const sandbox = new FakeSandbox(async () => ({
      frames: [],
      outputs: [],
      exitStatus: 0,
      durationMs: 1,
    }));
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("pass", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error).toBeUndefined();
  });

  it("disposes a sandbox whose start threw so the half-live resource does not leak", async () => {
    const sandbox = new FakeSandbox(async () => answer("unreachable"));
    sandbox.start = async () => {
      throw new SandboxError("The sandbox could not start.");
    };
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("print()", options());
    expect(result.isFinalAnswer).toBe(false);
    expect(result.error?.message).toContain("The sandbox could not start.");
    expect(sandbox.disposals).toBe(1);
  });

  it("rebuilds from the factory after a failed start so a retry gets a fresh backend", async () => {
    const built: FakeSandbox[] = [];
    let attempts = 0;
    const factory = (): FakeSandbox => {
      const sandbox = new FakeSandbox(async () => answer("recovered"));
      sandbox.start = async () => {
        attempts += 1;
        if (attempts === 1) throw new SandboxError("The sandbox could not start.");
      };
      built.push(sandbox);
      return sandbox;
    };
    const executor = new RemoteExecutor({ sandbox: factory });
    const first = await executor.execute("print('one')", options());
    expect(first.isFinalAnswer).toBe(false);
    expect(first.error?.message).toContain("The sandbox could not start.");
    // The failed instance was disposed and the retry must run on the replacement the factory
    // handed out, not on the disposed instance.
    expect(built).toHaveLength(2);
    expect(built[0]?.disposals).toBe(1);
    const second = await executor.execute("print('two')", options());
    expect(second.isFinalAnswer).toBe(true);
    expect(second.value).toBe("recovered");
    expect(second.error).toBeUndefined();
  });

  it("drives a public factory through a timeout and then a successful step", async () => {
    const executor = createProcessExecutor({ gracePeriodMs: 50 });
    try {
      const timedOut = await executor.execute("while True: pass", options({ timeoutMs: 100 }));
      expect(timedOut.isFinalAnswer).toBe(false);
      expect(timedOut.error?.code).toBe("AGENT_TIMEOUT");
      const next = await executor.execute('final_answer("alive")', options());
      expect(next.isFinalAnswer).toBe(true);
      expect(next.value).toBe("alive");
    } finally {
      await executor.dispose?.();
    }
  });

  it("truncates logs to the 50,000-character cap", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      runOptions.onOutput?.({ stream: "stdout", text: "x".repeat(70_000) });
      return answer(1);
    });
    const executor = new RemoteExecutor({ sandbox });
    const result = await executor.execute("print()", options());
    // The cap bounds the whole result, notice included; 70,000 characters must be clipped to
    // the cap rather than to something merely smaller than the input.
    expect(result.logs.length).toBeLessThanOrEqual(50_000);
    expect(result.logs.length).toBeGreaterThanOrEqual(49_900);
    expect(result.logs).toContain("truncated");
  });

  it("forwards every line to onLog and refuses a run after dispose", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      runOptions.onOutput?.({ stream: "stdout", text: FRAME_PREFIX });
      runOptions.onOutput?.({ stream: "stdout", text: "line" });
      return answer(1);
    });
    const executor = new RemoteExecutor({ sandbox });
    const lines: string[] = [];
    await executor.execute("print()", options({ onLog: (line) => lines.push(line) }));
    expect(lines).toEqual([FRAME_PREFIX, "line"]);
    await executor.dispose();
    await executor.dispose();
    expect(sandbox.disposals).toBe(1);
    const after = await executor.execute("print()", options());
    expect(after.isFinalAnswer).toBe(false);
    expect(after.error?.name).toBe("AgentExecutionError");
  });

  it("refuses a pickle by default and carries its raw bytes when allowPickle is true", async () => {
    const sandbox = new FakeSandbox(async (runOptions) => {
      const frame = parseFrameLine(
        FRAME_PREFIX + JSON.stringify({ type: "final_answer", value: "pickle:" + btoa("hello") }),
        { allowPickle: runOptions.allowPickle === true },
      );
      return {
        frames: frame === undefined ? [] : [frame, { type: "step_end" }],
        outputs: [],
        exitStatus: null,
        durationMs: 1,
      };
    });
    const refused = await new RemoteExecutor({ sandbox }).execute("x", options());
    expect(refused.isFinalAnswer).toBe(false);
    expect(refused.error?.name).toBe("PickleRefusedError");
    const carried = await new RemoteExecutor({ sandbox, allowPickle: true }).execute("x", options());
    expect(carried.isFinalAnswer).toBe(true);
    expect(carried.value).toBeInstanceOf(Uint8Array);
  });
});
