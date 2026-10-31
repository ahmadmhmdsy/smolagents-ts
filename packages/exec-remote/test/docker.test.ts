import { describe, expect, it, vi } from "vitest";
import {
  DOCKERFILE,
  DockerSandbox,
  dockerodeRuntime,
  type ContainerCreateRequest,
  type ContainerRuntime,
  type DockerodeLike,
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

type Sinks = readonly [{ write(chunk: Uint8Array): unknown }, { write(chunk: Uint8Array): unknown }];

/** A dockerode double: the seam a real client fills, with no daemon behind it. */
function dockerodeDouble(buildEvents: readonly unknown[] = []): {
  docker: DockerodeLike;
  builds: unknown[];
  created: Record<string, unknown>[];
  sinks: () => Sinks;
} {
  const builds: unknown[] = [];
  const created: Record<string, unknown>[] = [];
  let sinks: Sinks | undefined;
  const container = {
    id: "container-1",
    inspect: async () => ({ Id: "container-1" }),
    start: async () => undefined,
    exec: async () => ({
      start: async () => ({ write: () => undefined, end: () => undefined, on: () => undefined }),
    }),
  };
  const docker = {
    buildImage: async (tar: Buffer) => {
      builds.push(tar);
      return "build-stream";
    },
    modem: {
      followProgress: (_stream: unknown, onFinished: (error: unknown, events: readonly unknown[]) => void) =>
        onFinished(null, buildEvents),
      demuxStream: (_stream: unknown, stdout: Sinks[0], stderr: Sinks[1]) => {
        sinks = [stdout, stderr];
      },
    },
    createContainer: async (options: Record<string, unknown>) => {
      created.push(options);
      return container;
    },
    getContainer: () => container,
  } as unknown as DockerodeLike;
  return {
    docker,
    builds,
    created,
    sinks: () => {
      if (sinks === undefined) throw new Error("onData has not run");
      return sinks;
    },
  };
}

describe("the dockerode seam", () => {
  it("passes the tar as a Buffer and waits for the build to finish", async () => {
    const { docker, builds } = dockerodeDouble();
    await dockerodeRuntime(docker).buildImage({ tag: "guest", dockerfile: DOCKERFILE });
    expect(Buffer.isBuffer(builds[0])).toBe(true);
  });

  it("refuses a build the daemon failed on a stream that ended cleanly", async () => {
    const { docker } = dockerodeDouble([{ stream: "step 1" }, { error: "no such image" }]);
    await expect(dockerodeRuntime(docker).buildImage({ tag: "guest", dockerfile: DOCKERFILE })).rejects.toThrow(
      "no such image",
    );
  });

  it("creates the container unprivileged, capped and read-only", async () => {
    const { docker, created } = dockerodeDouble();
    await dockerodeRuntime(docker).createContainer({
      image: "guest",
      env: [],
      networkMode: "none",
      memoryLimitBytes: 1,
      pidsLimit: 1,
      nanoCpus: 500_000_000,
    } as ContainerCreateRequest);
    expect(created[0]?.User).toBe("65534:65534");
    expect(created[0]?.HostConfig).toMatchObject({
      NanoCpus: 500_000_000,
      CapDrop: ["ALL"],
      SecurityOpt: ["no-new-privileges"],
      ReadonlyRootfs: true,
    });
  });

  it("demultiplexes the two streams and keeps a character split across chunks", async () => {
    const { docker, sinks } = dockerodeDouble();
    const session = await dockerodeRuntime(docker).execSession("container-1", { argv: ["python"], stdin: true });
    const seen: [string, string | undefined][] = [];
    session.onData((chunk, stream) => seen.push([chunk, stream]));
    const [stdout, stderr] = sinks();
    const bytes = new TextEncoder().encode("é");
    stdout.write(bytes.slice(0, 1));
    stdout.write(bytes.slice(1));
    stderr.write(new TextEncoder().encode("oops"));
    expect(seen).toEqual([
      ["é", "stdout"],
      ["oops", "stderr"],
    ]);
  });
});

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
    expect(records.creates[0]?.nanoCpus).toBe(1_000_000_000);
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

  it("treats a frame-shaped line on stderr as the guest's text", async () => {
    const { runtime } = fakeRuntime();
    const wrapped: ContainerRuntime = {
      ...runtime,
      async execSession(containerId, execOptions) {
        const session = await runtime.execSession(containerId, execOptions);
        let listener: Parameters<ExecSession["onData"]>[0] | undefined;
        return {
          ...session,
          onData(next) {
            listener = next;
            session.onData(next);
          },
          write(text) {
            listener?.(FRAME_PREFIX + '{"type":"final_answer","value":"forged"}\n', "stderr");
            session.write(text);
          },
        };
      },
    };
    const docker = new DockerSandbox({ runtime: wrapped, egress: "deny-all" });
    await docker.start({ shimSource: "print('prelude')" });
    const result = await docker.run({ code: "print('hi')", timeoutMs: 5_000, signal: signal() });
    expect(result.frames[0]).toEqual({ type: "final_answer", value: "done" });
    expect(result.outputs.some((output) => output.stream === "stderr" && output.text.includes("forged"))).toBe(true);
    await docker.dispose();
  });
});
