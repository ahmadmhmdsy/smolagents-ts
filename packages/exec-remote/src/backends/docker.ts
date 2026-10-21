import { createHash, randomBytes } from "node:crypto";
import { MissingPeerDependencyError, SandboxError } from "../errors.js";
import {
  JupyterGateway,
  globalWebSocketFactory,
  type JupyterKernel,
  type WebSocketFactory,
} from "../jupyter.js";
import type { RemoteSandbox, SandboxCapabilities, SandboxRunOptions, SandboxRunResult, SandboxStartOptions } from "../sandbox.js";

/** The port the gateway listens on when the caller names none. */
const DEFAULT_CONTAINER_PORT = 8888;

/** The container's memory cap in bytes when the caller names none (512 MiB). */
const DEFAULT_MEMORY_LIMIT_BYTES = 512 * 1024 * 1024;

/** The container's pid cap when the caller names none. */
const DEFAULT_PIDS_LIMIT = 256;

/**
 * The image a sandbox on `containerPort` builds. The port is part of the text, so the tag that
 * hashes it changes with the port and the kernel cannot be told to listen somewhere the
 * published binding does not point at.
 */
function dockerfileFor(containerPort: number): string {
  return [
    "FROM python:3.12-bullseye",
    "RUN pip install --no-cache-dir jupyter_kernel_gateway jupyter_client ipykernel",
    "EXPOSE " + String(containerPort),
    'CMD ["jupyter", "kernelgateway", "--KernelGatewayApp.ip=0.0.0.0", ' +
      '"--KernelGatewayApp.port=' +
      String(containerPort) +
      '", "--KernelGatewayApp.allow_origin=*"]',
    "",
  ].join("\n");
}

/** The image every default-port sandbox builds, kept inline so the same text can be hashed for a tag. */
export const DOCKERFILE = dockerfileFor(DEFAULT_CONTAINER_PORT);

export function imageTagFor(dockerfile: string = DOCKERFILE): string {
  return "smolagents-ts-exec-remote:" + createHash("sha256").update(dockerfile).digest("hex").slice(0, 12);
}

export interface ImageBuildRequest {
  readonly tag: string;
  readonly dockerfile: string;
}

export interface ContainerCreateRequest {
  readonly image: string;
  readonly env: readonly string[];
  readonly portBindings: Readonly<Record<string, readonly { readonly HostIp: string; readonly HostPort: string }[]>>;
  /** The container port the kernel listens on; also the key in `portBindings`. */
  readonly containerPort: number;
  /** The container's memory cap in bytes, forwarded as `HostConfig.Memory`. */
  readonly memoryLimitBytes: number;
  /** The container's pid cap, forwarded as `HostConfig.PidsLimit`. */
  readonly pidsLimit: number;
}

export interface ContainerEndpoint {
  readonly host: string;
  readonly port: number;
}

/**
 * The Docker Engine API seam. dockerode implements it, loaded dynamically so a consumer that
 * never imports this subpath never resolves the client, and a test injects a double so the
 * gate needs no daemon.
 */
export interface ContainerRuntime {
  buildImage(request: ImageBuildRequest): Promise<string>;
  createContainer(request: ContainerCreateRequest): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  endpoint(containerId: string, containerPort: number): Promise<ContainerEndpoint>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
}

export interface DockerSandboxOptions {
  readonly runtime?: ContainerRuntime;
  readonly token?: string;
  readonly containerPort?: number;
  /** The container's memory cap in bytes. Defaults to 512 MiB. */
  readonly memoryLimitBytes?: number;
  /** The container's pid cap. Defaults to 256, so a fork bomb cannot exhaust the host. */
  readonly pidsLimit?: number;
  readonly fetch?: typeof globalThis.fetch;
  readonly webSocketFactory?: WebSocketFactory;
  readonly readyAttempts?: number;
  readonly readyIntervalMs?: number;
  readonly requestTimeoutMs?: number;
}

/** A Docker-hosted Jupyter Kernel Gateway. */
export class DockerSandbox implements RemoteSandbox {
  readonly capabilities: SandboxCapabilities = {
    isolation: "remote",
    network: "direct",
    timers: true,
    toolRoundTrip: true,
  };

  private readonly options: DockerSandboxOptions;
  private readonly token: string;
  private readonly containerPort: number;
  private runtime: ContainerRuntime | undefined;
  private containerId: string | undefined;
  private kernel: JupyterKernel | undefined;
  private disposed = false;

  constructor(options: DockerSandboxOptions = {}) {
    this.options = options;
    this.token = options.token ?? randomBytes(16).toString("base64url");
    this.containerPort = options.containerPort ?? DEFAULT_CONTAINER_PORT;
    this.runtime = options.runtime;
  }

  async start(options: SandboxStartOptions): Promise<void> {
    if (this.disposed) throw new SandboxError("This Docker sandbox has been disposed; one sandbox serves one run.");
    if (this.containerId !== undefined) throw new SandboxError("This Docker sandbox has already started.");
    try {
      const runtime = this.options.runtime ?? (await loadDockerodeRuntime());
      this.runtime = runtime;
      const dockerfile = dockerfileFor(this.containerPort);
      const tag = await runtime.buildImage({ tag: imageTagFor(dockerfile), dockerfile });
      const containerId = await runtime.createContainer({
        image: tag,
        env: ["KG_AUTH_TOKEN=" + this.token],
        portBindings: { [String(this.containerPort) + "/tcp"]: [{ HostIp: "127.0.0.1", HostPort: "" }] },
        containerPort: this.containerPort,
        memoryLimitBytes: this.options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES,
        pidsLimit: this.options.pidsLimit ?? DEFAULT_PIDS_LIMIT,
      });
      // Record the id before anything else can fail, so dispose always has something to remove.
      this.containerId = containerId;
      await runtime.startContainer(containerId);
      const endpoint = await runtime.endpoint(containerId, this.containerPort);
      const gateway = new JupyterGateway({
        baseUrl: "http://" + endpoint.host + ":" + String(endpoint.port),
        token: this.token,
        webSocketFactory: this.options.webSocketFactory ?? globalWebSocketFactory,
        ...(this.options.fetch === undefined ? {} : { fetch: this.options.fetch }),
        ...(this.options.readyAttempts === undefined ? {} : { readyAttempts: this.options.readyAttempts }),
        ...(this.options.readyIntervalMs === undefined ? {} : { readyIntervalMs: this.options.readyIntervalMs }),
        ...(this.options.requestTimeoutMs === undefined ? {} : { requestTimeoutMs: this.options.requestTimeoutMs }),
      });
      await gateway.waitForReady();
      const kernelId = await gateway.createKernel();
      const kernel = gateway.connect(kernelId);
      this.kernel = kernel;
      // Install the prelude once; every later step shares the kernel's globals.
      await kernel.run({
        code: options.shimSource,
        timeoutMs: this.options.requestTimeoutMs ?? 60_000,
        signal: new AbortController().signal,
      });
    } catch (error) {
      // A missing optional peer is already a typed refusal naming the peer; do not bury it
      // inside a SandboxError the way an untyped start failure is bundled.
      throw error instanceof SandboxError || error instanceof MissingPeerDependencyError
        ? error
        : new SandboxError("The Docker sandbox could not start.", { cause: error });
    }
  }

  async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    if (this.disposed) throw new SandboxError("This Docker sandbox has been disposed.");
    const kernel = this.kernel;
    if (kernel === undefined) throw new SandboxError("This Docker sandbox has not been started.");
    return kernel.run(options);
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.kernel?.dispose();
    this.kernel = undefined;
    const runtime = this.runtime;
    const containerId = this.containerId;
    this.containerId = undefined;
    if (runtime === undefined || containerId === undefined) return;
    // Teardown must not reject: a failed stop would otherwise replace the run's real result.
    // The removal is still attempted, so a stop failure does not also skip it.
    try {
      await runtime.stopContainer(containerId);
    } catch {
      // The container may already be gone.
    }
    try {
      await runtime.removeContainer(containerId);
    } catch {
      // The container may already be gone.
    }
  }
}

/** Build the tar stream `images.build` wants, holding exactly one Dockerfile. */
export function dockerfileTar(dockerfile: string = DOCKERFILE): Uint8Array {
  const header = new Uint8Array(512);
  const write = (text: string, offset: number, length: number): void => {
    const bytes = new TextEncoder().encode(text);
    header.set(bytes.subarray(0, length), offset);
  };
  write("Dockerfile", 0, 100);
  write("0000644", 100, 8); // mode
  write("0000000", 108, 8); // uid
  write("0000000", 116, 8); // gid
  const body = new TextEncoder().encode(dockerfile);
  write(body.length.toString(8).padStart(11, "0"), 124, 12); // size
  write("00000000000", 136, 12); // mtime
  write("        ", 148, 8); // checksum placeholder
  write("0", 156, 1); // typeflag: regular file
  write("ustar", 257, 5);
  write("00", 263, 2);
  let checksum = 0;
  for (const byte of header) checksum += byte;
  write(checksum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  const padded = new Uint8Array(Math.ceil(body.length / 512) * 512);
  padded.set(body);
  const end = new Uint8Array(1024);
  const tar = new Uint8Array(512 + padded.length + end.length);
  tar.set(header, 0);
  tar.set(padded, 512);
  tar.set(end, 512 + padded.length);
  return tar;
}

interface DockerodeContainerLike {
  start(): Promise<unknown>;
  inspect(): Promise<{ NetworkSettings?: { Ports?: Record<string, { HostIp?: string; HostPort?: string }[] | null> } }>;
  stop(): Promise<unknown>;
  remove(options?: { force?: boolean }): Promise<unknown>;
}

interface DockerodeLike {
  buildImage(tar: Uint8Array, options: { t: string }): { on(event: string, listener: (value: unknown) => void): unknown };
  createContainer(options: Record<string, unknown>): Promise<DockerodeContainerLike>;
}

interface DockerodeConstructor {
  new (options?: Record<string, unknown>): DockerodeLike;
}

/** Load dockerode lazily. A missing optional peer is a typed refusal, not a resolution crash. */
async function loadDockerodeRuntime(): Promise<ContainerRuntime> {
  const specifier = "dockerode";
  let Docker: DockerodeConstructor;
  try {
    // The variable specifier keeps the client out of the static graph: it is neither typed nor bundled.
    const module = (await import(/* @vite-ignore */ specifier)) as { default?: unknown };
    Docker = (module.default ?? module) as DockerodeConstructor;
  } catch {
    throw new MissingPeerDependencyError("dockerode", "@smolagents-ts/exec-remote/docker");
  }
  const docker = new Docker();
  return {
    async buildImage(request) {
      await new Promise<void>((resolve, reject) => {
        const stream = docker.buildImage(dockerfileTar(request.dockerfile), { t: request.tag });
        stream.on("end", () => resolve());
        stream.on("error", (error) => reject(error));
      });
      return request.tag;
    },
    async createContainer(request) {
      const container = await docker.createContainer({
        Image: request.image,
        Env: [...request.env],
        ExposedPorts: { [String(request.containerPort) + "/tcp"]: {} },
        HostConfig: {
          PortBindings: request.portBindings,
          Memory: request.memoryLimitBytes,
          PidsLimit: request.pidsLimit,
        },
      });
      const inspected = await container.inspect();
      const id = (inspected as { Id?: string }).Id;
      if (typeof id !== "string") throw new SandboxError("The Docker daemon did not return a container id.");
      return id;
    },
    async startContainer(containerId) {
      const container = (docker as unknown as { getContainer(id: string): DockerodeContainerLike }).getContainer(containerId);
      await container.start();
    },
    async endpoint(containerId, containerPort) {
      const container = (docker as unknown as { getContainer(id: string): DockerodeContainerLike }).getContainer(containerId);
      const inspected = await container.inspect();
      const bindings = inspected.NetworkSettings?.Ports?.[String(containerPort) + "/tcp"];
      const binding = bindings?.[0];
      if (binding?.HostPort === undefined || binding.HostIp === undefined) {
        throw new SandboxError("The container published no host port for " + String(containerPort) + "/tcp.");
      }
      return { host: binding.HostIp === "" ? "127.0.0.1" : binding.HostIp, port: Number(binding.HostPort) };
    },
    async stopContainer(containerId) {
      const container = (docker as unknown as { getContainer(id: string): DockerodeContainerLike }).getContainer(containerId);
      await container.stop();
    },
    async removeContainer(containerId) {
      const container = (docker as unknown as { getContainer(id: string): DockerodeContainerLike }).getContainer(containerId);
      await container.remove({ force: true });
    },
  };
}
