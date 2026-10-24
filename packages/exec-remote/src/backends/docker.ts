import { createHash } from "node:crypto";
import { MissingPeerDependencyError, SandboxError, UnsupportedOptionError } from "../errors.js";
import type {
  EgressPolicy,
  RemoteSandbox,
  SandboxCapabilities,
  SandboxFrame,
  SandboxOutput,
  SandboxRunOptions,
  SandboxRunResult,
  SandboxStartOptions,
  SandboxToolCall,
} from "../sandbox.js";
import { encodeValue } from "../serialize.js";
import { buildStepLoopSource, parseFrameLine } from "../shim-source.js";

/** The container's memory cap in bytes when the caller names none (512 MiB). */
const DEFAULT_MEMORY_LIMIT_BYTES = 512 * 1024 * 1024;

/** The container's pid cap when the caller names none. */
const DEFAULT_PIDS_LIMIT = 256;

/** How long start waits for the guest's ready frame when the caller names no budget. */
const DEFAULT_START_TIMEOUT_MS = 60_000;

const DOCKERFILE_LINES: readonly string[] = [
  "FROM python:3.12-slim",
  'CMD ["python", "-u", "-c", "import time; time.sleep(31536000)"]',
  "",
];

/**
 * The image a sandbox builds: a plain Python base whose only job is to stay alive, because the
 * guest arrives through `docker exec` and speaks the frame protocol on that session's stdio.
 * It publishes no port and installs no kernel gateway.
 */
export const DOCKERFILE = DOCKERFILE_LINES.join("\n");

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
  /** `none` is how `deny-all` is enforced; `bridge` is the daemon's own default reach. */
  readonly networkMode: "none" | "bridge";
  /** The container's memory cap in bytes, forwarded as `HostConfig.Memory`. */
  readonly memoryLimitBytes: number;
  /** The container's pid cap, forwarded as `HostConfig.PidsLimit`. */
  readonly pidsLimit: number;
}

/** What one long-lived guest session needs to be opened. */
export interface ExecSessionOptions {
  readonly argv: readonly string[];
  /** Keep the guest's stdin open: both the step requests and the tool replies arrive there. */
  readonly stdin: boolean;
}

/**
 * A duplex stdio session onto a running container. One session serves the whole run: the prelude
 * is its program and every later step is a JSON line on its stdin.
 */
export interface ExecSession {
  write(data: string): void;
  onData(listener: (chunk: string) => void): void;
  onClose(listener: (info: { readonly code: number | null }) => void): void;
  end(): void;
  /**
   * Kill the guest. Killing the exec client alone would leave the interpreter running, so a
   * backend's implementation stops the container.
   */
  kill(): Promise<void>;
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
  execSession(containerId: string, options: ExecSessionOptions): Promise<ExecSession>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
}

export interface DockerSandboxOptions {
  readonly runtime?: ContainerRuntime;
  /** The container's memory cap in bytes. Defaults to 512 MiB. */
  readonly memoryLimitBytes?: number;
  /** The container's pid cap. Defaults to 256, so a fork bomb cannot exhaust the host. */
  readonly pidsLimit?: number;
  /** How long start waits for the guest's ready frame. Defaults to 60 000 ms. */
  readonly startTimeoutMs?: number;
  /**
   * What the guest may reach. `deny-all` is enforced by creating the container with network
   * mode `none`, so the guarantee is the daemon's network layer; the capability reports it.
   */
  readonly egress?: EgressPolicy;
}

interface PendingStep {
  resolve: (result: SandboxRunResult) => void;
  reject: (error: unknown) => void;
  readonly startedAt: number;
  readonly options: SandboxRunOptions;
  readonly frames: SandboxFrame[];
  readonly outputs: SandboxOutput[];
  detach: (() => void) | undefined;
  settled: boolean;
}

interface ReadyWaiter {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * A Docker-hosted guest reached over one long-lived `docker exec` session. The guest program is
 * the generated prelude plus the step loop; the host answers tool frames on the same stdin the
 * step arrived on, exactly as the process backend does.
 */
export class DockerSandbox implements RemoteSandbox {
  readonly capabilities: SandboxCapabilities;

  private readonly options: DockerSandboxOptions;
  private readonly egress: EgressPolicy;
  private runtime: ContainerRuntime | undefined;
  private containerId: string | undefined;
  private session: ExecSession | undefined;
  private buffer = "";
  private pending: PendingStep | undefined;
  private ready: ReadyWaiter | undefined;
  private disposed = false;
  private exited = false;

  constructor(options: DockerSandboxOptions = {}) {
    this.options = options;
    this.egress = options.egress ?? "unmanaged";
    this.runtime = options.runtime;
    this.capabilities = {
      isolation: "remote",
      network: this.egress === "deny-all" ? "none" : "direct",
      timers: true,
      toolRoundTrip: true,
    };
  }

  async start(options: SandboxStartOptions): Promise<void> {
    if (this.disposed) throw new SandboxError("This Docker sandbox has been disposed; one sandbox serves one run.");
    if (this.containerId !== undefined) throw new SandboxError("This Docker sandbox has already started.");
    try {
      const runtime = this.options.runtime ?? (await loadDockerodeRuntime());
      this.runtime = runtime;
      const tag = await runtime.buildImage({ tag: imageTagFor(DOCKERFILE), dockerfile: DOCKERFILE });
      const containerId = await runtime.createContainer({
        image: tag,
        env: [],
        networkMode: this.egress === "deny-all" ? "none" : "bridge",
        memoryLimitBytes: this.options.memoryLimitBytes ?? DEFAULT_MEMORY_LIMIT_BYTES,
        pidsLimit: this.options.pidsLimit ?? DEFAULT_PIDS_LIMIT,
      });
      // Record the id before anything else can fail, so dispose always has something to remove.
      this.containerId = containerId;
      await runtime.startContainer(containerId);
      const session = await runtime.execSession(containerId, {
        argv: ["python3", "-u", "-c", options.shimSource + buildStepLoopSource()],
        stdin: true,
      });
      this.session = session;
      session.onData((chunk) => this.onChunk(chunk));
      session.onClose((info) => this.onExit(info.code));
      await this.waitForReady();
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
    if (options.contextId !== undefined) {
      throw new UnsupportedOptionError(
        "docker",
        "contextId",
        "it runs one guest with a single namespace, so there is no second context to select.",
      );
    }
    if (this.session === undefined || this.exited) {
      throw new SandboxError("This Docker sandbox has not been started.");
    }
    if (this.pending !== undefined) throw new SandboxError("A step is already running on this Docker sandbox.");
    const pending: PendingStep = {
      resolve: () => undefined,
      reject: () => undefined,
      startedAt: Date.now(),
      options,
      frames: [],
      outputs: [],
      detach: undefined,
      settled: false,
    };
    const result = new Promise<SandboxRunResult>((resolve, reject) => {
      pending.resolve = resolve;
      pending.reject = reject;
    });
    this.pending = pending;
    if (options.signal.aborted) {
      // Settle on the next tick, so the caller always receives the promise it just made.
      queueMicrotask(() => this.abortStep(pending));
    } else {
      const onAbort = (): void => this.abortStep(pending);
      options.signal.addEventListener("abort", onAbort, { once: true });
      pending.detach = () => options.signal.removeEventListener("abort", onAbort);
    }
    // A write failure settles the step through fail(), not by rejecting here.
    this.write(JSON.stringify({ type: "step", code: options.code }) + "\n");
    return result;
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    this.exited = true;
    const session = this.session;
    this.session = undefined;
    const runtime = this.runtime;
    const containerId = this.containerId;
    this.containerId = undefined;
    const pending = this.pending;
    if (pending !== undefined) this.finish(pending);
    // The session is closed before the container, so the guest sees its stdin end.
    if (session !== undefined) {
      try {
        session.end();
      } catch {
        // The stream may already be closed.
      }
      try {
        await session.kill();
      } catch {
        // The kill path may already have stopped the container.
      }
    }
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

  /** Resolve once the guest announces it is reading; a session that closes first is a failure. */
  private waitForReady(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.ready = undefined;
        reject(
          new SandboxError(
            "The guest did not announce readiness within " +
              String(this.options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS) +
              " ms.",
          ),
        );
      }, this.options.startTimeoutMs ?? DEFAULT_START_TIMEOUT_MS);
      this.ready = { resolve, reject, timer };
    });
  }

  private onChunk(chunk: string): void {
    const combined = this.buffer + chunk;
    const lines = combined.split("\n");
    this.buffer = lines.pop() ?? "";
    for (const raw of lines) {
      this.handleLine(raw.endsWith("\r") ? raw.slice(0, -1) : raw);
    }
  }

  private handleLine(line: string): void {
    let frame: SandboxFrame | undefined;
    try {
      frame = parseFrameLine(line, { allowPickle: this.pending?.options.allowPickle === true });
    } catch (error) {
      this.fail(error);
      return;
    }
    if (frame === undefined) {
      const pending = this.pending;
      if (pending !== undefined) this.pushOutput(pending, line);
      return;
    }
    if (frame.type === "ready") {
      const ready = this.ready;
      if (ready !== undefined) {
        this.ready = undefined;
        clearTimeout(ready.timer);
        ready.resolve();
      }
      return;
    }
    const pending = this.pending;
    if (pending === undefined) return;
    pending.frames.push(frame);
    if (frame.type === "step_end") {
      this.finish(pending);
      return;
    }
    if (frame.type === "tool_call") void this.answerToolCall(pending, frame);
  }

  /** Answer a guest tool frame on the same stdin the step arrived on. */
  private async answerToolCall(
    pending: PendingStep,
    frame: { callId: string; name: string; args: unknown },
  ): Promise<void> {
    const call: SandboxToolCall = { callId: frame.callId, name: frame.name, args: frame.args };
    const callTool = pending.options.callTool;
    let reply: { ok: boolean; value?: unknown; error?: string };
    if (callTool === undefined) {
      reply = { ok: false, error: "This backend has no tool-call channel." };
    } else {
      try {
        reply = { ok: true, value: encodeValue(await callTool(call)) };
      } catch (error) {
        reply = { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    }
    this.write(JSON.stringify(reply) + "\n");
  }

  private write(text: string): void {
    const session = this.session;
    if (session === undefined || this.exited) {
      this.fail(new SandboxError("The guest session's stdin is not writable."));
      return;
    }
    try {
      session.write(text);
    } catch (error) {
      this.fail(new SandboxError("Writing to the guest session failed.", { cause: error }));
    }
  }

  /** A step that loses its signal: the session's kill path stops the container, then it settles. */
  private abortStep(pending: PendingStep): void {
    if (pending.settled) return;
    const session = this.session;
    this.session = undefined;
    this.exited = true;
    this.finish(pending);
    if (session !== undefined) {
      // The kill path stops the container; a failure here cannot change the step's outcome.
      session.kill().catch(() => undefined);
    }
  }

  private fail(error: unknown): void {
    const pending = this.pending;
    if (pending !== undefined) this.finish(pending, error);
    const ready = this.ready;
    if (ready !== undefined) {
      this.ready = undefined;
      clearTimeout(ready.timer);
      ready.reject(
        error instanceof SandboxError ? error : new SandboxError("The Docker sandbox could not start.", { cause: error }),
      );
    }
  }

  private onExit(code: number | null): void {
    this.exited = true;
    this.session = undefined;
    const ready = this.ready;
    if (ready !== undefined) {
      this.ready = undefined;
      clearTimeout(ready.timer);
      ready.reject(new SandboxError("The guest exited before it announced readiness, with code " + String(code) + "."));
    }
    const pending = this.pending;
    if (pending !== undefined) this.finish(pending, undefined, code);
  }

  private pushOutput(pending: PendingStep, text: string): void {
    const output: SandboxOutput = { stream: "stdout", text };
    pending.outputs.push(output);
    pending.options.onOutput?.(output);
  }

  private finish(pending: PendingStep, error?: unknown, exitStatus: number | null = null): void {
    if (pending.settled) return;
    pending.settled = true;
    pending.detach?.();
    pending.detach = undefined;
    if (this.pending === pending) this.pending = undefined;
    if (error !== undefined) {
      pending.reject(error);
      return;
    }
    pending.resolve({
      frames: pending.frames,
      outputs: pending.outputs,
      exitStatus,
      durationMs: Date.now() - pending.startedAt,
    });
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

interface DockerodeStreamLike {
  write(data: string): unknown;
  end(): unknown;
  on(event: string, listener: (value: unknown) => void): unknown;
}

interface DockerodeExecLike {
  start(options: { hijack?: boolean; stdin?: boolean }): Promise<DockerodeStreamLike>;
}

interface DockerodeContainerLike {
  start(): Promise<unknown>;
  stop(): Promise<unknown>;
  remove(options?: { force?: boolean }): Promise<unknown>;
  inspect(): Promise<{ Id?: string }>;
  exec(options: Record<string, unknown>): Promise<DockerodeExecLike>;
}

interface DockerodeLike {
  buildImage(tar: Uint8Array, options: { t: string }): { on(event: string, listener: (value: unknown) => void): unknown };
  createContainer(options: Record<string, unknown>): Promise<DockerodeContainerLike>;
  getContainer(id: string): DockerodeContainerLike;
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

  const stopContainer = async (containerId: string): Promise<void> => {
    await docker.getContainer(containerId).stop();
  };
  /** Killing the exec client alone would leave the interpreter alive, so this stops the container. */
  const killContainer = async (containerId: string): Promise<void> => {
    try {
      await stopContainer(containerId);
    } catch {
      // A container that is already stopped is already dead for this purpose.
    }
  };

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
        HostConfig: {
          // Deny-all is the daemon's own network rule: the container has no interface to reach out.
          NetworkMode: request.networkMode,
          Memory: request.memoryLimitBytes,
          PidsLimit: request.pidsLimit,
        },
      });
      const inspected = await container.inspect();
      if (typeof inspected.Id !== "string") throw new SandboxError("The Docker daemon did not return a container id.");
      return inspected.Id;
    },
    async startContainer(containerId) {
      await docker.getContainer(containerId).start();
    },
    async execSession(containerId, options) {
      const exec = await docker.getContainer(containerId).exec({
        Cmd: [...options.argv],
        AttachStdin: options.stdin,
        AttachStdout: true,
        AttachStderr: true,
        Tty: false,
      });
      const stream = await exec.start({ hijack: true, stdin: options.stdin });
      return {
        write(data) {
          stream.write(data);
        },
        onData(listener) {
          stream.on("data", (chunk) => {
            listener(typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk as Uint8Array));
          });
        },
        onClose(listener) {
          let done = false;
          const close = (): void => {
            if (done) return;
            done = true;
            listener({ code: null });
          };
          stream.on("end", close);
          stream.on("close", close);
          stream.on("error", close);
        },
        end() {
          stream.end();
        },
        async kill() {
          await killContainer(containerId);
        },
      };
    },
    async stopContainer(containerId) {
      await stopContainer(containerId);
    },
    async removeContainer(containerId) {
      await docker.getContainer(containerId).remove({ force: true });
    },
  };
}
