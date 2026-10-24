import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DOCKERFILE,
  DockerSandbox,
  type ContainerCreateRequest,
  type ContainerRuntime,
  type ImageBuildRequest,
} from "../src/backends/docker.js";
import { EgressUnsupportedError, MissingPeerDependencyError, SandboxError } from "../src/errors.js";
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
  readonly endpoints: number[];
  readonly starts: string[];
  readonly stops: string[];
  readonly removes: string[];
}

function recordingRuntime(
  endpoint: { host: string; port: number },
  failStart = false,
  failStop = false,
): RecordingRuntime {
  const builds: ImageBuildRequest[] = [];
  const creates: ContainerCreateRequest[] = [];
  const endpoints: number[] = [];
  const starts: string[] = [];
  const stops: string[] = [];
  const removes: string[] = [];
  return {
    builds,
    creates,
    endpoints,
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
    async endpoint(_containerId: string, containerPort: number) {
      endpoints.push(containerPort);
      return endpoint;
    },
    async stopContainer(containerId) {
      stops.push(containerId);
      if (failStop) throw new Error("the daemon refused to stop the container");
    },
    async removeContainer(containerId) {
      removes.push(containerId);
    },
  };
}

interface SandboxOptions {
  readonly readyAttempts?: number;
  readonly containerPort?: number;
  readonly memoryLimitBytes?: number;
  readonly pidsLimit?: number;
}

function sandbox(runtime: RecordingRuntime, options: SandboxOptions = {}): DockerSandbox {
  if (server === undefined) throw new Error("the loopback server is not running");
  return new DockerSandbox({
    runtime,
    token: "test-token",
    fetch: globalThis.fetch,
    webSocketFactory: globalWebSocketFactory,
    readyAttempts: options.readyAttempts ?? 3,
    readyIntervalMs: 10,
    requestTimeoutMs: 5_000,
    ...(options.containerPort === undefined ? {} : { containerPort: options.containerPort }),
    ...(options.memoryLimitBytes === undefined
      ? {}
      : { memoryLimitBytes: options.memoryLimitBytes }),
    ...(options.pidsLimit === undefined ? {} : { pidsLimit: options.pidsLimit }),
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
    expect(runtime.creates[0]?.containerPort).toBe(8888);
    // The container is capped by default, so a runaway guest cannot exhaust the host.
    expect(runtime.creates[0]?.memoryLimitBytes).toBe(512 * 1024 * 1024);
    expect(runtime.creates[0]?.pidsLimit).toBe(256);
    expect(runtime.endpoints).toEqual([8888]);
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

  it("builds the gateway for a configured containerPort and honours the limit overrides", async () => {
    server = await startJupyterLoopback({ token: "test-token" });
    const runtime = recordingRuntime({ host: server.host, port: server.port });
    const docker = sandbox(runtime, {
      containerPort: 9999,
      memoryLimitBytes: 128 * 1024 * 1024,
      pidsLimit: 64,
    });
    await docker.start({ shimSource: "print('prelude')" });
    const dockerfile = runtime.builds[0]?.dockerfile ?? "";
    expect(dockerfile).toContain("EXPOSE 9999");
    expect(dockerfile).toContain("--KernelGatewayApp.port=9999");
    expect(dockerfile).not.toContain("8888");
    expect(runtime.creates[0]?.portBindings["9999/tcp"]?.[0]?.HostIp).toBe("127.0.0.1");
    expect(runtime.creates[0]?.containerPort).toBe(9999);
    expect(runtime.creates[0]?.memoryLimitBytes).toBe(128 * 1024 * 1024);
    expect(runtime.creates[0]?.pidsLimit).toBe(64);
    expect(runtime.endpoints).toEqual([9999]);
    await docker.dispose();
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

  it("refuses deny-all before it builds an image", async () => {
    const runtime = recordingRuntime({ host: "127.0.0.1", port: 8888 });
    const sandbox = new DockerSandbox({ runtime, egress: "deny-all" });

    await expect(sandbox.start({ shimSource: "print('prelude')" })).rejects.toThrow(
      EgressUnsupportedError,
    );
    expect(runtime.builds).toEqual([]);
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

  it("resolves dispose and still removes the container when the stop fails", async () => {
    server = await startJupyterLoopback({ token: "test-token" });
    const runtime = recordingRuntime({ host: server.host, port: server.port }, false, true);
    const docker = sandbox(runtime);
    await docker.start({ shimSource: "print('prelude')" });
    // A teardown failure must not replace the run's real result with a rejection.
    await expect(docker.dispose()).resolves.toBeUndefined();
    expect(runtime.stops).toEqual(["container-1"]);
    expect(runtime.removes).toEqual(["container-1"]);
    await expect(docker.dispose()).resolves.toBeUndefined();
  });
});
