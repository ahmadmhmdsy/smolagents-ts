import {
  MissingPeerDependencyError,
  SandboxError,
  ToolRoundTripUnsupportedError,
  UnsupportedNodeVersionError,
  UnsupportedOptionError,
} from "../errors.js";
import type { EgressPolicy } from "../sandbox.js";
import type {
  RemoteSandbox,
  SandboxCapabilities,
  SandboxFrame,
  SandboxOutput,
  SandboxRunOptions,
  SandboxRunResult,
  SandboxStartOptions,
} from "../sandbox.js";
import { buildStepSource, parseFrameLine } from "../shim-source.js";

/**
 * The E2B backend. The vendor client is reached through the `E2BClient` seam, so a test drives
 * the whole backend with a double and no network. A hosted kernel has no stdin channel the host
 * can answer, so the shim is built with tool stubs that refuse by name and
 * `capabilities.toolRoundTrip` is false: a guest reaches `final_answer` and nothing else.
 */

/** The floor `@e2b/code-interpreter@2.9.0` declares, above this package's own `>=22.12`. */
export const E2B_NODE_FLOOR = "22.19.0";

export interface E2BExecutionError {
  readonly name: string;
  readonly value: string;
  readonly traceback?: string;
}

export interface E2BExecution {
  readonly error?: E2BExecutionError | null;
  readonly logs?: { readonly stdout?: readonly string[]; readonly stderr?: readonly string[] };
}

export interface E2BRunOptions {
  readonly timeoutMs?: number;
  readonly contextId?: string;
  readonly onStdout?: (line: string) => void;
  readonly onStderr?: (line: string) => void;
}

/** The narrow part of the vendor sandbox this backend uses. */
export interface E2BSandboxLike {
  readonly sandboxId: string;
  runCode(code: string, options?: E2BRunOptions): Promise<E2BExecution>;
  kill(): Promise<void>;
  /** Present when the vendor sandbox can extend its own lifetime; absent ones refuse keepAliveMs. */
  setTimeout?(timeoutMs: number): Promise<void>;
  /** Present when the vendor sandbox samples its guest; guestMetrics() reports undefined without it. */
  getMetrics?(): Promise<unknown>;
}

export interface E2BClient {
  create(options: {
    readonly apiKey?: string;
    readonly timeoutMs: number;
    readonly template?: string;
    readonly egress: EgressPolicy;
    /** The vendor stores this on the sandbox, so an orphan can be found by it. */
    readonly metadata?: Readonly<Record<string, string>>;
  }): Promise<E2BSandboxLike>;
}

export interface E2BSandboxOptions {
  readonly client?: E2BClient;
  /** Falls back to the SDK's own `E2B_API_KEY` lookup; never logged and never put on a command line. */
  readonly apiKey?: string;
  readonly template?: string;
  /** Sandbox lifetime, in milliseconds. */
  readonly timeoutMs?: number;
  /** Only for tests: the Node version to check the vendor floor against. */
  readonly nodeVersion?: string;
  /**
   * What the guest may reach. This backend enforces `deny-all` by passing the vendor's own
   * network option at create, so the guarantee is the vendor's and the capability reports the
   * reduced reach.
   */
  readonly egress?: EgressPolicy;
  /** Stored on the vendor sandbox at create, so an orphan can be found by this map. */
  readonly metadata?: Readonly<Record<string, string>>;
  /**
   * A step's deadline when the step names none. The sandbox lifetime is a different number and
   * is never used as an execution deadline.
   */
  readonly executionTimeoutMs?: number;
  /** Extend the lifetime before a step when this long has passed since the last extension. */
  readonly keepAliveMs?: number;
  /** Which guest context a step runs in; a step may name its own. */
  readonly contextId?: string;
}

const DEFAULT_TIMEOUT_MS = 300_000;

/** A step's deadline when neither the step nor the caller names one. */
const DEFAULT_EXECUTION_TIMEOUT_MS = 60_000;

/** Compare dotted version strings; true when `actual` is at or above `required`. */
export function satisfiesNodeFloor(actual: string, required: string): boolean {
  const left = actual.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const right = required.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

export class E2BSandbox implements RemoteSandbox {
  readonly capabilities: SandboxCapabilities;

  private readonly options: E2BSandboxOptions;
  private readonly executionTimeoutMs: number;
  private lastKeepAliveAt: number | undefined;
  private client: E2BClient | undefined;
  private sandbox: E2BSandboxLike | undefined;
  private disposed = false;
  private frameNonce: string | undefined;

  constructor(options: E2BSandboxOptions = {}) {
    const actual = options.nodeVersion ?? process.versions.node;
    if (!satisfiesNodeFloor(actual, E2B_NODE_FLOOR)) {
      throw new UnsupportedNodeVersionError("e2b", E2B_NODE_FLOOR, actual);
    }
    this.options = options;
    this.executionTimeoutMs = options.executionTimeoutMs ?? DEFAULT_EXECUTION_TIMEOUT_MS;
    this.capabilities = {
      isolation: "remote",
      network: options.egress === "deny-all" ? "none" : "direct",
      timers: true,
      toolRoundTrip: false,
    };
  }

  get sandboxId(): string | undefined {
    return this.sandbox?.sandboxId;
  }

  async start(options: SandboxStartOptions): Promise<void> {
    if (this.disposed) throw new SandboxError("This E2B sandbox has been disposed; one sandbox serves one run.");
    if (this.sandbox !== undefined) throw new SandboxError("This E2B sandbox has already started.");
    this.frameNonce = options.frameNonce;
    // A declared tool set needs the mid-run channel this backend does not have. Refuse before
    // the client is loaded or a sandbox is created, rather than install tools nothing can answer.
    if (options.transfer !== undefined && options.transfer.tools.length > 0) {
      throw new UnsupportedOptionError(
        "e2b",
        "transfer.tools",
        "its one-shot channel has no mid-run tool round trip, so a guest can reach final_answer() only; use the process or Docker backend for a declared tool set.",
      );
    }
    const client = this.options.client ?? (await loadE2BClient());
    this.client = client;
    const createOptions: {
      apiKey?: string;
      template?: string;
      timeoutMs: number;
      egress: EgressPolicy;
      metadata?: Readonly<Record<string, string>>;
    } = {
      timeoutMs: this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      egress: this.options.egress ?? "unmanaged",
    };
    if (this.options.apiKey !== undefined) createOptions.apiKey = this.options.apiKey;
    if (this.options.template !== undefined) createOptions.template = this.options.template;
    if (this.options.metadata !== undefined) createOptions.metadata = this.options.metadata;
    let sandbox: E2BSandboxLike;
    try {
      sandbox = await client.create(createOptions);
    } catch (error) {
      throw new SandboxError("The E2B sandbox could not be created.", { cause: error });
    }
    this.sandbox = sandbox;
    const keepAliveMs = this.options.keepAliveMs;
    if (keepAliveMs !== undefined) {
      if (sandbox.setTimeout === undefined) {
        // A lifetime that cannot be extended would expire mid-run; refusing beats a silent loss.
        this.sandbox = undefined;
        try {
          await sandbox.kill();
        } catch {
          // The refusal is the answer; a teardown failure must not replace it.
        }
        throw new UnsupportedOptionError(
          "e2b",
          "keepAliveMs",
          "this client seam exposes no setTimeout, so the lifetime cannot be extended before a slow step.",
        );
      }
      this.lastKeepAliveAt = Date.now();
    }
    // Install the prelude once; every later step shares the hosted kernel's globals.
    try {
      await sandbox.runCode(options.shimSource, { timeoutMs: this.executionTimeoutMs });
    } catch (error) {
      throw new SandboxError("The E2B prelude could not be installed.", { cause: error });
    }
  }

  async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    if (this.disposed) throw new SandboxError("This E2B sandbox has been disposed.");
    const sandbox = this.sandbox;
    if (sandbox === undefined) throw new SandboxError("This E2B sandbox has not been started.");
    await this.refreshLifetime(sandbox);
    const startedAt = Date.now();
    const frames: SandboxFrame[] = [];
    const outputs: SandboxOutput[] = [];
    const collect = (stream: "stdout" | "stderr", line: string): void => {
      if (line === "") return;
      let frame: SandboxFrame | undefined;
      try {
        frame = parseFrameLine(line, {
        allowPickle: options.allowPickle === true,
        frameNonce: this.frameNonce,
      });
      } catch (error) {
        frames.push({
          type: "error",
          name: "ProtocolError",
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      if (frame === undefined) {
        const output: SandboxOutput = { stream, text: line };
        outputs.push(output);
        options.onOutput?.(output);
        return;
      }
      if (frame.type === "tool_call") {
        // No channel exists on this backend; a frame here is refused rather than answered.
        frames.push({
          type: "error",
          name: "ToolRoundTripUnsupportedError",
          message: new ToolRoundTripUnsupportedError(frame.name, "e2b").message,
        });
        return;
      }
      frames.push(frame);
    };
    const contextId = options.contextId ?? this.options.contextId;
    const runOptions: E2BRunOptions = {
      timeoutMs: options.timeoutMs > 0 ? options.timeoutMs : this.executionTimeoutMs,
      onStdout: (line) => collect("stdout", line),
      onStderr: (line) => collect("stderr", line),
      ...(contextId === undefined ? {} : { contextId }),
    };
    let execution: E2BExecution;
    try {
      execution = await sandbox.runCode(buildStepSource(options.code), runOptions);
    } catch (error) {
      throw new SandboxError("The E2B code execution failed.", { cause: error });
    }
    if (execution.error != null && !frames.some((frame) => frame.type === "error")) {
      const frame: { type: "error"; name: string; message: string; traceback?: string } = {
        type: "error",
        name: execution.error.name,
        message: execution.error.value,
      };
      if (execution.error.traceback !== undefined) frame.traceback = execution.error.traceback;
      frames.push(frame);
    }
    if (!frames.some((frame) => frame.type === "step_end")) frames.push({ type: "step_end" });
    return { frames, outputs, exitStatus: null, durationMs: Date.now() - startedAt };
  }

  /** The vendor's own guest sample, or undefined when the seam exposes none. */
  async guestMetrics(): Promise<unknown> {
    const sandbox = this.sandbox;
    if (sandbox?.getMetrics === undefined) return undefined;
    return await sandbox.getMetrics();
  }

  /** Extend the lifetime first when the last extension is older than keepAliveMs. */
  private async refreshLifetime(sandbox: E2BSandboxLike): Promise<void> {
    const keepAliveMs = this.options.keepAliveMs;
    if (keepAliveMs === undefined) return;
    const last = this.lastKeepAliveAt ?? 0;
    if (Date.now() - last < keepAliveMs) return;
    const setTimeoutOnSandbox = sandbox.setTimeout;
    if (setTimeoutOnSandbox === undefined) return;
    await setTimeoutOnSandbox.call(sandbox, this.options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    this.lastKeepAliveAt = Date.now();
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    this.disposed = true;
    const sandbox = this.sandbox;
    this.sandbox = undefined;
    if (sandbox === undefined) return;
    try {
      await sandbox.kill();
    } catch {
      // A teardown failure must not replace the run's real result. dispose() resolves, exactly
      // as the process backend's does; the vendor sandbox is already unreachable from here.
    }
  }
}

interface VendorExecutionLike {
  readonly error?: { readonly name?: unknown; readonly value?: unknown; readonly traceback?: unknown } | null;
  readonly logs?: { readonly stdout?: readonly unknown[]; readonly stderr?: readonly unknown[] };
}

interface VendorSandboxLike {
  readonly sandboxId?: unknown;
  runCode(code: string, options?: Record<string, unknown>): Promise<VendorExecutionLike>;
  kill(): Promise<unknown>;
  setTimeout?(timeoutMs: number): Promise<unknown>;
  getMetrics?(): Promise<unknown>;
}

interface VendorSandboxConstructor {
  create(options: Record<string, unknown>): Promise<VendorSandboxLike>;
}

function asLine(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeExecution(execution: VendorExecutionLike): E2BExecution {
  const result: { error?: E2BExecutionError | null; logs?: { stdout: string[]; stderr: string[] } } = {};
  if (execution.error != null) {
    const error: { name: string; value: string; traceback?: string } = {
      name: typeof execution.error.name === "string" ? execution.error.name : "Error",
      value: typeof execution.error.value === "string" ? execution.error.value : "",
    };
    if (typeof execution.error.traceback === "string") error.traceback = execution.error.traceback;
    result.error = error;
  }
  if (execution.logs !== undefined) {
    result.logs = {
      stdout: (execution.logs.stdout ?? []).map(asLine),
      stderr: (execution.logs.stderr ?? []).map(asLine),
    };
  }
  return result;
}

/** Load the vendor SDK lazily; a missing optional peer is a typed refusal, not a resolution crash. */
async function loadE2BClient(): Promise<E2BClient> {
  const specifier = "@e2b/code-interpreter";
  let Sandbox: VendorSandboxConstructor;
  try {
    // The variable specifier keeps the client out of the static graph: it is neither typed nor bundled.
    const module = (await import(/* @vite-ignore */ specifier)) as { Sandbox?: unknown };
    Sandbox = (module.Sandbox ?? module) as VendorSandboxConstructor;
  } catch {
    throw new MissingPeerDependencyError("@e2b/code-interpreter", "@smolagents-ts/exec-remote/e2b");
  }
  return {
    async create(options) {
      const vendorOptions: Record<string, unknown> = { timeoutMs: options.timeoutMs };
      if (options.apiKey !== undefined) vendorOptions["apiKey"] = options.apiKey;
      if (options.template !== undefined) vendorOptions["template"] = options.template;
      // Deny-all is the vendor's own outbound rule, evaluated in the sandbox's network layer:
      // the vendor's guarantee, not one this package draws.
      if (options.egress === "deny-all") vendorOptions["network"] = { denyOut: ["0.0.0.0/0"] };
      if (options.metadata !== undefined) vendorOptions["metadata"] = options.metadata;
      const created = await Sandbox.create(vendorOptions);
      const setTimeoutOnVendor = created.setTimeout;
      const getMetricsFromVendor = created.getMetrics;
      return {
        sandboxId: typeof created.sandboxId === "string" ? created.sandboxId : "e2b",
        ...(setTimeoutOnVendor === undefined
          ? {}
          : {
              setTimeout: async (timeoutMs: number): Promise<void> => {
                await setTimeoutOnVendor.call(created, timeoutMs);
              },
            }),
        ...(getMetricsFromVendor === undefined
          ? {}
          : {
              getMetrics: async (): Promise<unknown> => await getMetricsFromVendor.call(created),
            }),
        async runCode(code, runOptions) {
          const vendorRun: Record<string, unknown> = {};
          if (runOptions?.timeoutMs !== undefined) vendorRun["timeoutMs"] = runOptions.timeoutMs;
          if (runOptions?.contextId !== undefined) vendorRun["contextId"] = runOptions.contextId;
          vendorRun["onStdout"] = (output: unknown) => {
            runOptions?.onStdout?.(asLine((output as { line?: unknown } | null)?.line));
          };
          vendorRun["onStderr"] = (output: unknown) => {
            runOptions?.onStderr?.(asLine((output as { line?: unknown } | null)?.line));
          };
          return normalizeExecution(await created.runCode(code, vendorRun));
        },
        kill: async () => {
          await created.kill();
        },
      };
    },
  };
}
