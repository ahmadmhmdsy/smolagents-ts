import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCKERFILE,
  DockerSandbox,
  type ContainerCreateRequest,
  type ContainerRuntime,
  type ImageBuildRequest,
} from "../src/backends/docker.js";
import { MissingPeerDependencyError, SandboxError } from "../src/errors.js";
import { globalWebSocketFactory } from "../src/jupyter.js";
import { startJupyterLoopback, type LoopbackJupyter } from "./ws-server.js";

// Force the optional peer's dynamic import to fail, so the typed missing-peer refusal is
// exercised even though the peer is installed in this workspace.
vi.mock("dockerode", () => {
  throw new Error("dockerode is not installed");
});

let server: LoopbackJupyter | undefined;

afterEach(async () => {
  await server?.close();
  server = undefined;
});

interface RecordingRuntime extends ContainerRuntime {
  readonly builds: ImageBuildRequest[];
  readonly creates: ContainerCreateRequest[];
  readonly starts: string[];
  readonly stops: string[];
  readonly removes: string[];
}

function recordingRuntime(endpoint: { host: string; port: number }, failStart = false): RecordingRuntime {
  const builds: ImageBuildRequest[] = [];
  const creates: ContainerCreateRequest[] = [];
  const starts: string[] = [];
  const stops: string[] = [];
  const removes: string[] = [];
  return {
    builds,
    creates,
    starts,
    stops,
    removes,
    async buildImage(request) {
      builds.push(request);
      return request.tag;
    },
    async createContainer(request) {
      creates.push(request);
      return "container-1";
    },
    async startContainer(containerId) {
      starts.push(containerId);
      if (failStart) throw new Error("the daemon refused to start the container");
    },
    async endpoint() {
      return endpoint;
    },
    async stopContainer(containerId) {
      stops.push(containerId);
    },
    async removeContainer(containerId) {
      removes.push(containerId);
    },
  };
}

function sandbox(runtime: RecordingRuntime, options: { readonly readyAttempts?: number } = {}): DockerSandbox {
  if (server === undefined) throw new Error("the loopback server is not running");
  return new DockerSandbox({
    runtime,
    token: "test-token",
    fetch: globalThis.fetch,
    webSocketFactory: globalWebSocketFactory,
    readyAttempts: options.readyAttempts ?? 3,
    readyIntervalMs: 10,
    requestTimeoutMs: 5_000,
  });
}

describe("the Docker backend", () => {
  it("builds the inline image, publishes 8888/tcp with the token and speaks the kernel protocol", async () => {
    server = await startJupyterLoopback({ token: "test-token" });
    const runtime = recordingRuntime({ host: server.host, port: server.port });
    const docker = sandbox(runtime);
    await docker.start({ shimSource: "print('prelude')" });
    expect(runtime.builds).toHaveLength(1);
    expect(runtime.builds[0]?.dockerfile).toBe(DOCKERFILE);
    expect(runtime.creates).toHaveLength(1);
    expect(runtime.creates[0]?.env).toContain("KG_AUTH_TOKEN=test-token");
    expect(runtime.creates[0]?.portBindings["8888/tcp"]?.[0]?.HostIp).toBe("127.0.0.1");
    expect(runtime.starts).toEqual(["container-1"]);
    const result = await docker.run({
      code: "print()",
      timeoutMs: 5_000,
      signal: new AbortController().signal,
    });
    expect(result.outputs.map((output) => output.text)).toEqual(["hello", "42"]);
    await docker.dispose();
    expect(runtime.stops).toEqual(["container-1"]);
    expect(runtime.removes).toEqual(["container-1"]);
  });

  it("stops and removes exactly once even when the start failed after the container was created", async () => {
    server = await startJupyterLoopback({ token: "test-token" });
    const runtime = recordingRuntime({ host: server.host, port: server.port }, true);
    const docker = sandbox(runtime);
    await expect(docker.start({ shimSource: "print('prelude')" })).rejects.toThrow(SandboxError);
    await docker.dispose();
    await docker.dispose();
    expect(runtime.stops).toEqual(["container-1"]);
    expect(runtime.removes).toEqual(["container-1"]);
  });

  it("refuses a missing optional peer with the typed error instead of burying it", async () => {
    const docker = new DockerSandbox({ token: "test-token" });
    await expect(docker.start({ shimSource: "print('prelude')" })).rejects.toThrow(MissingPeerDependencyError);
  });

  it("refuses a run before start", async () => {
    const runtime = recordingRuntime({ host: "127.0.0.1", port: 1 });
    const docker = new DockerSandbox({ runtime });
    await expect(
      docker.run({ code: "1", timeoutMs: 100, signal: new AbortController().signal }),
    ).rejects.toThrow(SandboxError);
    expect(runtime.builds).toEqual([]);
  });
});
