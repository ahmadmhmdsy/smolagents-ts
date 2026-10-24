import { describe, expect, it, vi } from "vitest";
import {
  DOCKERFILE,
  DockerSandbox,
  type ContainerCreateRequest,
  type ContainerRuntime,
  type ExecSession,
  type ExecSessionOptions,
  type ImageBuildRequest,
} from "../src/backends/docker.js";
import { MissingPeerDependencyError, SandboxError } from "../src/errors.js";
import { FRAME_PREFIX } from "../src/shim-source.js";

// Force the optional peer's dynamic import to fail, so the typed missing-peer refusal is
// exercised even though the peer is installed in this workspace.
vi.mock("dockerode", () => {
  throw new Error("dockerode is not installed");
});

interface Records {
  readonly builds: ImageBuildRequest[];
  readonly creates: ContainerCreateRequest[];
  readonly starts: string[];
  readonly execs: ExecSessionOptions[];
  readonly stops: string[];
  readonly removes: string[];
  readonly writes: string[];
  readonly replies: string[];
  kills: number;
  ends: number;
}

interface RuntimeOptions {
  readonly failStart?: boolean;
  readonly failStop?: boolean;
}

/**
 * A duplex double: the fake guest answers on the session's own stdin, so the test exercises the
 * frame protocol without a daemon, an HTTP client or a WebSocket.
 */
function fakeRuntime(options: RuntimeOptions = {}): { runtime: ContainerRuntime; records: Records } {
  const records: Records = {
    builds: [],
    creates: [],
    starts: [],
    execs: [],
    stops: [],
    removes: [],
    writes: [],
    replies: [],
    kills: 0,
    ends: 0,
  };
  const dataListeners: ((chunk: string) => void)[] = [];
  const closeListeners: ((info: { code: number | null }) => void)[] = [];
  const emit = (text: string): void => {
    for (const listener of dataListeners) listener(text);
  };
  const frame = (payload: Record<string, unknown>): string =>
    FRAME_PREFIX + JSON.stringify(payload) + "\n";

  const runtime: ContainerRuntime = {
    async buildImage(request) {
      records.builds.push(request);
      return request.tag;
    },
    async createContainer(request) {
      records.creates.push(request);
      return "container-1";
    },
    async startContainer(containerId) {
      records.starts.push(containerId);
      if (options.failStart === true) throw new Error("the daemon refused to start the container");
    },
    async execSession(_containerId, execOptions) {
      records.execs.push(execOptions);
      const session: ExecSession = {
        write(text) {
          records.writes.push(text);
          queueMicrotask(() => answer(text));
        },
        onData(listener) {
          dataListeners.push(listener);
          // The guest boots and prints before it announces readiness, so start has to ignore
          // the noise and resolve on the frame.
          if (dataListeners.length === 1) {
            setTimeout(() => {
              emit("booting the guest\n");
              emit(frame({ type: "ready" }));
            }, 0);
          }
        },
        onClose(listener) {
          closeListeners.push(listener);
        },
        end() {
          records.ends += 1;
        },
        async kill() {
          records.kills += 1;
          for (const listener of closeListeners) listener({ code: null });
        },
      };
      const answer = (text: string): void => {
        let record: { type?: string; code?: string; ok?: boolean };
        try {
          record = JSON.parse(text) as { type?: string; code?: string; ok?: boolean };
        } catch {
          return;
        }
        if (record.type === "step") {
          const code = record.code ?? "";
          if (code.includes("ECHO_TOOL")) {
            emit(frame({ type: "tool_call", callId: "call-1", name: "echo", args: { text: "hi" } }));
            return;
          }
          if (code.includes("HANG")) return;
          emit("guest says hi\n");
          emit(frame({ type: "final_answer", value: "done" }));
          emit(frame({ type: "step_end" }));
          return;
        }
        if (record.ok === true) {
          records.replies.push(text);
          emit(frame({ type: "final_answer", value: "done" }));
          emit(frame({ type: "step_end" }));
        }
      };
      return session;
    },
    async stopContainer(containerId) {
      records.stops.push(containerId);
      if (options.failStop === true) throw new Error("the daemon refused to stop the container");
    },
    async removeContainer(containerId) {
      records.removes.push(containerId);
    },
  };
  return { runtime, records };
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("the Docker backend", () => {
  it("starts a plain Python container on network mode none for deny-all, and reports network none", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime, egress: "deny-all" });
    await docker.start({ shimSource: "print('prelude')" });
    expect(records.builds[0]?.dockerfile).toBe(DOCKERFILE);
    expect(DOCKERFILE).toContain("FROM python:");
    expect(DOCKERFILE).not.toContain("jupyter");
    expect(records.creates[0]?.networkMode).toBe("none");
    expect(records.creates[0]).not.toHaveProperty("portBindings");
    expect(records.creates[0]?.memoryLimitBytes).toBe(512 * 1024 * 1024);
    expect(records.creates[0]?.pidsLimit).toBe(256);
    expect(docker.capabilities.network).toBe("none");
    await docker.dispose();
  });

  it("resolves start on the ready frame after interleaved guest output, on one exec session", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime, egress: "unmanaged" });
    await docker.start({ shimSource: "print('prelude')" });
    expect(records.creates[0]?.networkMode).toBe("bridge");
    expect(docker.capabilities.network).toBe("direct");
    expect(records.execs).toHaveLength(1);
    expect(records.execs[0]?.stdin).toBe(true);
    expect(records.execs[0]?.argv.join(" ")).toContain("_step_loop()");
    expect(records.execs[0]?.argv.join(" ")).toContain("print('prelude')");
    expect(records.starts).toEqual(["container-1"]);
    await docker.dispose();
  });

  it("crosses a tool_call frame's reply back over the session's stdin", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime });
    await docker.start({ shimSource: "print('prelude')" });
    const calls: unknown[] = [];
    const result = await docker.run({
      code: "ECHO_TOOL()",
      timeoutMs: 5_000,
      signal: signal(),
      callTool: async (call) => {
        calls.push(call);
        return "hi";
      },
    });
    expect(calls).toEqual([{ callId: "call-1", name: "echo", args: { text: "hi" } }]);
    expect(records.replies).toHaveLength(1);
    expect(JSON.parse(records.replies[0] as string)).toEqual({ ok: true, value: "hi" });
    expect(result.frames.map((frame) => frame.type)).toEqual(["tool_call", "final_answer", "step_end"]);
    await docker.dispose();
  });

  it("kills the exec session when the step is aborted", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime });
    await docker.start({ shimSource: "print('prelude')" });
    const controller = new AbortController();
    const running = docker.run({ code: "HANG()", timeoutMs: 5_000, signal: controller.signal });
    setTimeout(() => controller.abort(), 10);
    const result = await running;
    expect(records.kills).toBe(1);
    expect(result.frames).toEqual([]);
    await docker.dispose();
  });

  it("stops and removes the container exactly once, however often dispose is called", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime });
    await docker.start({ shimSource: "print('prelude')" });
    await docker.dispose();
    await docker.dispose();
    expect(records.stops).toEqual(["container-1"]);
    expect(records.removes).toEqual(["container-1"]);
  });

  it("stops and removes exactly once even when the start failed after the container was created", async () => {
    const { runtime, records } = fakeRuntime({ failStart: true });
    const docker = new DockerSandbox({ runtime });
    await expect(docker.start({ shimSource: "print('prelude')" })).rejects.toThrow(SandboxError);
    await docker.dispose();
    await docker.dispose();
    expect(records.stops).toEqual(["container-1"]);
    expect(records.removes).toEqual(["container-1"]);
  });

  it("resolves dispose and still removes the container when the stop fails", async () => {
    const { runtime, records } = fakeRuntime({ failStop: true });
    const docker = new DockerSandbox({ runtime });
    await docker.start({ shimSource: "print('prelude')" });
    await expect(docker.dispose()).resolves.toBeUndefined();
    expect(records.stops).toEqual(["container-1"]);
    expect(records.removes).toEqual(["container-1"]);
  });

  it("refuses a missing optional peer with the typed error instead of burying it", async () => {
    const docker = new DockerSandbox();
    await expect(docker.start({ shimSource: "print('prelude')" })).rejects.toThrow(
      MissingPeerDependencyError,
    );
  });

  it("refuses a run before start", async () => {
    const { runtime, records } = fakeRuntime();
    const docker = new DockerSandbox({ runtime });
    await expect(docker.run({ code: "1", timeoutMs: 100, signal: signal() })).rejects.toThrow(
      SandboxError,
    );
    expect(records.builds).toEqual([]);
  });
});
