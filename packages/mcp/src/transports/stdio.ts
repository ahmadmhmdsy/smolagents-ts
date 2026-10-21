import { spawn as nodeSpawn } from "node:child_process";
import { noopLogger, type Logger } from "@smolagents-ts/core";
import type { MCPMessage } from "../json-rpc.js";
import type { MCPTransport } from "../transport.js";
import { isStdioServerParameters, type StdioServerParameters } from "../parameters.js";
import { MCPClosedError, MCPParameterError, MCPTransportError } from "../errors.js";
import { MCPClient, type MCPClientOptions } from "../client.js";

/** The write end of the child's stdin, as this transport uses it. */
export interface WritableStreamLike {
  write(chunk: string): unknown;
  end(): unknown;
  /** A real pipe emits EPIPE here when the child has gone; optional so a test can omit it. */
  on?(event: "error", listener: (error: Error) => void): unknown;
}

const CLOSED_MESSAGE =
  "The MCP transport is closed: the client has already disconnected from this server.";

/** How long a server gets to exit on its own after its stdin is closed. */
const STDIN_GRACE_MS = 200;
/** After a kill, how long to wait for the exit before giving up on it. */
const EXIT_TIMEOUT_MS = 5_000;

/** The features of a spawned child this transport uses. Structural, so a test can fake it. */
export interface ChildProcessLike {
  readonly stdin: WritableStreamLike | null;
  readonly stdout: { on(event: "data", listener: (chunk: Uint8Array | string) => void): unknown } | null;
  readonly stderr: { on(event: "data", listener: (chunk: Uint8Array | string) => void): unknown } | null;
  readonly killed: boolean;
  readonly exitCode: number | null;
  on(event: "error", listener: (error: Error) => void): unknown;
  on(event: "exit", listener: (code: number | null, signal: string | null) => void): unknown;
  kill(signal?: string): boolean;
}

/** The spawn signature this transport needs; defaults to node:child_process's. */
export interface SpawnOptions {
  env?: Record<string, string>;
  cwd?: string;
  stdio: ["pipe", "pipe", "pipe"];
}

export type SpawnLike = (
  command: string,
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcessLike;

export interface StdioTransportOptions {
  readonly logger?: Logger;
  /** Injected in tests; defaults to node:child_process.spawn. */
  readonly spawn?: SpawnLike;
}

/**
 * The stdio transport: one child process, newline-delimited JSON on its stdin and
 * stdout, its stderr forwarded line by line to the logger.
 *
 * This module is the package's only Node-specific entry. It is reachable as
 * "@smolagents-ts/mcp/stdio" and never from the barrel, so a browser bundle that
 * imports the package never reaches node:child_process.
 */
export class StdioTransport implements MCPTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  private readonly logger: Logger;
  private readonly spawnImpl: SpawnLike;
  private readonly parameters: StdioServerParameters;
  private child: ChildProcessLike | undefined;
  private started = false;
  private closed = false;
  private closedNotified = false;
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private readonly stdoutDecoder = new TextDecoder();
  private readonly stderrDecoder = new TextDecoder();

  constructor(parameters: StdioServerParameters, options: StdioTransportOptions = {}) {
    this.parameters = parameters;
    this.logger = options.logger ?? noopLogger;
    this.spawnImpl = options.spawn ?? (nodeSpawn as unknown as SpawnLike);
  }

  /** Spawns the child and starts listening. */
  start(): Promise<void> {
    if (this.started) return Promise.resolve();
    const args = [...(this.parameters.args ?? [])];
    const env = this.parameters.env === undefined ? undefined : { ...this.parameters.env };
    const options: SpawnOptions = {
      stdio: ["pipe", "pipe", "pipe"],
      ...(env === undefined ? {} : { env }),
      ...(this.parameters.cwd === undefined ? {} : { cwd: this.parameters.cwd }),
    };
    let child: ChildProcessLike;
    try {
      child = this.spawnImpl(this.parameters.command, args, options);
    } catch (error) {
      return Promise.reject(
        new MCPTransportError(
          "Could not spawn the MCP server '" +
            this.parameters.command +
            "': " +
            (error instanceof Error ? error.message : String(error)),
          { cause: error },
        ),
      );
    }
    this.child = child;
    this.started = true;
    child.stdout?.on("data", (chunk) => {
      this.consumeStdout(
        typeof chunk === "string" ? chunk : this.stdoutDecoder.decode(chunk, { stream: true }),
      );
    });
    child.stderr?.on("data", (chunk) => {
      this.consumeStderr(
        typeof chunk === "string" ? chunk : this.stderrDecoder.decode(chunk, { stream: true }),
      );
    });
    // A write to a child that already exited fails asynchronously as an `error` on the
    // stdin stream; with no listener there, Node rethrows it and the whole process dies.
    child.stdin?.on?.("error", (error) => {
      this.onerror?.(
        new MCPTransportError(
          "Writing to the MCP server '" + this.parameters.command + "' failed: " + error.message,
          { cause: error },
        ),
      );
    });
    child.on("error", (error) => this.onerror?.(error));
    // The child's exit is this transport's close: a peer that went away is a closed
    // connection even though nothing here asked for one.
    child.on("exit", () => this.notifyClosed());
    return Promise.resolve();
  }

  async send(message: MCPMessage): Promise<void> {
    if (this.closed) throw new MCPClosedError(CLOSED_MESSAGE);
    const child = this.child;
    const stdin = child?.stdin;
    if (child === undefined || stdin === null || stdin === undefined) {
      throw new MCPTransportError("The MCP stdio transport is not started.");
    }
    if (child.killed) throw new MCPClosedError(CLOSED_MESSAGE);
    // One message per line, the whole line written at once: a chunked write would let
    // two messages interleave on the wire.
    stdin.write(JSON.stringify(message) + "\n");
  }

  async close(): Promise<void> {
    if (this.closed) {
      // A second close is quiet, but the caller still gets the connection-closed event
      // once, because the process may have gone away before the first close ran.
      this.notifyClosed();
      return;
    }
    this.closed = true;
    const child = this.child;
    if (child === undefined) {
      this.notifyClosed();
      return;
    }
    const exited = childExit(child);
    try {
      child.stdin?.end();
    } catch {
      // The pipe may already be gone; the kill below is the real end of the process.
    }
    // A server that exits on its own after stdin closes is asked to; one that does not
    // is killed rather than left running, because a leaked subprocess outlives the client.
    await waitFor(exited, STDIN_GRACE_MS);
    try {
      if (child.exitCode === null && !child.killed) child.kill();
    } catch {
      // Already gone.
    }
    await waitFor(exited, EXIT_TIMEOUT_MS);
    this.notifyClosed();
  }

  /** Delivers one line of the child's stdout, buffering until a newline arrives. */
  private consumeStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    for (;;) {
      const index = this.stdoutBuffer.indexOf("\n");
      if (index === -1) break;
      const line = this.stdoutBuffer.slice(0, index).trim();
      this.stdoutBuffer = this.stdoutBuffer.slice(index + 1);
      if (line === "") continue;
      this.deliver(line);
    }
  }

  /** Forwards the child's stderr line by line. A server logs there; it is not protocol. */
  private consumeStderr(chunk: string): void {
    this.stderrBuffer += chunk;
    for (;;) {
      const index = this.stderrBuffer.indexOf("\n");
      if (index === -1) break;
      const line = this.stderrBuffer.slice(0, index);
      this.stderrBuffer = this.stderrBuffer.slice(index + 1);
      if (line.trim() === "") continue;
      this.logger.info("mcp[stderr]: " + line);
    }
  }

  private deliver(line: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (error) {
      this.onerror?.(
        new MCPTransportError(
          "The MCP server wrote a line that is not JSON: " + line.slice(0, 300),
          { cause: error },
        ),
      );
      return;
    }
    if (parsed === null || typeof parsed !== "object" || !("jsonrpc" in parsed)) {
      this.onerror?.(
        new MCPTransportError(
          "The MCP server wrote a message that is not JSON-RPC: " + line.slice(0, 300),
        ),
      );
      return;
    }
    try {
      this.onmessage?.(parsed as MCPMessage);
    } catch (error) {
      // A handler must not throw into the stdout data callback: an uncaught throw on an
      // EventEmitter takes the process down, and a message that arrives after
      // disconnect() is the ordinary way a handler throws. The failure still reaches
      // the client's logger through onerror.
      this.onerror?.(toError(error));
    }
  }

  /** Reports the peer's departure, once per transport. */
  private notifyClosed(): void {
    if (this.closedNotified) return;
    this.closedNotified = true;
    this.onclose?.();
  }
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/** Resolves when the child exits or errors. */
function childExit(child: ChildProcessLike): Promise<void> {
  return new Promise<void>((resolve) => {
    let settled = false;
    const done = (): void => {
      if (settled) return;
      settled = true;
      resolve();
    };
    child.on("exit", done);
    child.on("error", done);
  });
}

/** Resolves when the promise does, or after the budget — without leaking a pending timer. */
async function waitFor(promise: Promise<void>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms);
  });
  try {
    await Promise.race([promise, budget]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Builds a stdio transport for one subprocess server. */
export function createStdioTransport(
  parameters: StdioServerParameters,
  options: StdioTransportOptions = {},
): StdioTransport {
  return new StdioTransport(parameters, options);
}

/**
 * A connected `MCPClient` whose servers are subprocesses.
 *
 * The root entry cannot open a subprocess — it must stay isomorphic, and the
 * architecture test enforces it — so this subpath is where a stdio parameter is turned
 * into a transport and handed to the generic client.
 */
export async function stdioClient(
  parameters: StdioServerParameters | readonly StdioServerParameters[],
  options: MCPClientOptions = {},
): Promise<MCPClient> {
  const list = Array.isArray(parameters) ? parameters : [parameters as StdioServerParameters];
  for (const parameter of list) {
    if (!isStdioServerParameters(parameter)) {
      throw new MCPParameterError(
        "stdioClient() accepts a { command } parameter object, not a URL: use MCPClient.create() " +
          "for a Streamable HTTP server.",
      );
    }
  }
  const transportOptions: StdioTransportOptions =
    options.logger === undefined ? {} : { logger: options.logger };
  return MCPClient.create(list, {
    ...options,
    transportFactory: (parameter) =>
      createStdioTransport(parameter as StdioServerParameters, transportOptions),
  });
}
