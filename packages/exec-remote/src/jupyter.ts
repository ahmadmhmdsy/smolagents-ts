import { SandboxError } from "./errors.js";
import { RpcPeer, type RpcMessage, type RpcReply } from "./rpc.js";
import type { SandboxFrame, SandboxOutput, SandboxRunOptions, SandboxRunResult, SandboxToolCall } from "./sandbox.js";
import { encodeValue } from "./serialize.js";
import { parseFrameLine } from "./shim-source.js";

/**
 * The Jupyter Kernel Gateway driver. Docker (and, later, a Modal or Blaxel backend) shares
 * this text: an HTTP readiness poll and kernel create, then one persistent WebSocket whose
 * shell channel carries `execute_request` and whose stdin channel carries the guest's
 * blocking `input()` as `input_request`, answered with an `input_reply` that carries the
 * tool's JSON result. That stdin channel is what makes a tool round trip possible at all.
 *
 * The transport is injected: a test supplies a real WebSocket against a loopback server.
 */

export interface WebSocketLike {
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener(
    type: "open" | "message" | "error" | "close",
    listener: (event: { data?: unknown }) => void,
  ): void;
}

export type WebSocketFactory = (url: string) => WebSocketLike;

/** The Node (and browser) global WebSocket, structurally narrowed to the seam above. */
export function globalWebSocketFactory(url: string): WebSocketLike {
  return new WebSocket(url) as unknown as WebSocketLike;
}

export interface JupyterGatewayOptions {
  /** e.g. `http://127.0.0.1:8888`. */
  readonly baseUrl: string;
  readonly token: string;
  readonly webSocketFactory: WebSocketFactory;
  readonly fetch?: typeof globalThis.fetch;
  readonly readyAttempts?: number;
  readonly readyIntervalMs?: number;
  readonly requestTimeoutMs?: number;
}

const DEFAULT_READY_ATTEMPTS = 10;
const DEFAULT_READY_INTERVAL_MS = 1_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const WIRE_VERSION = "5.3";
const WIRE_USERNAME = "smolagents-ts";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One execution on a connected kernel. */
export class JupyterKernel {
  private readonly peer: RpcPeer;
  private readonly session: string;
  private readonly requestTimeoutMs: number;
  private readonly ready: Promise<void>;
  private closed = false;

  constructor(
    private readonly socket: WebSocketLike,
    options: { readonly requestTimeoutMs?: number; readonly session?: string } = {},
  ) {
    this.session = options.session ?? "smolagents-" + Math.random().toString(36).slice(2, 10);
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.peer = new RpcPeer({
      send: (message) => {
        if (!this.closed) this.socket.send(toWire(message, this.session));
      },
    });
    this.ready = new Promise<void>((resolve, reject) => {
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const settle = (error?: SandboxError): void => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        if (error === undefined) resolve();
        else reject(error);
      };
      // Bound the handshake by the request timeout: a stub that never opens must not leave a
      // run awaiting `ready` forever.
      if (this.requestTimeoutMs > 0) {
        timer = setTimeout(() => {
          settle(
            new SandboxError(
              "The kernel WebSocket did not open within " + String(this.requestTimeoutMs) + " ms.",
            ),
          );
        }, this.requestTimeoutMs);
      }
      socket.addEventListener("open", () => settle());
      socket.addEventListener("error", () => {
        if (!this.closed) settle(new SandboxError("The kernel WebSocket failed to open."));
      });
      socket.addEventListener("message", (event) => this.onMessage(event.data));
      socket.addEventListener("close", () => {
        this.closed = true;
        this.peer.dispose();
        // A close before the handshake rejects `ready` instead of leaving the run pending; after
        // the handshake it is a no-op because `ready` already resolved.
        settle(new SandboxError("The kernel WebSocket closed before it opened."));
      });
    });
  }

  async run(options: SandboxRunOptions): Promise<SandboxRunResult> {
    await this.ready;
    const frames: SandboxFrame[] = [];
    const outputs: SandboxOutput[] = [];
    const startedAt = Date.now();
    let pendingToolReply: Promise<string> | undefined;
    const toolCallWaiters: (() => void)[] = [];
    const notifyToolCall = (): void => {
      const waiters = toolCallWaiters.splice(0);
      for (const waiter of waiters) waiter();
    };

    const pushOutput = (stream: "stdout" | "stderr", text: string): void => {
      const output: SandboxOutput = { stream, text };
      outputs.push(output);
      options.onOutput?.(output);
    };
    const foldLine = (stream: "stdout" | "stderr", line: string): void => {
      let frame: SandboxFrame | undefined;
      try {
        frame = parseFrameLine(line, { allowPickle: options.allowPickle === true });
      } catch (error) {
        frames.push({
          type: "error",
          name: "ProtocolError",
          message: error instanceof Error ? error.message : String(error),
        });
        return;
      }
      if (frame === undefined) {
        pushOutput(stream, line);
        return;
      }
      frames.push(frame);
      if (frame.type === "tool_call") {
        pendingToolReply = this.answerToolCall(frame, options.callTool);
        notifyToolCall();
      }
    };

    const unsubscribe = this.peer.onRequest("input_request", async (): Promise<RpcReply> => {
      // The gateway carries iopub and stdin over separate sockets, so an input_request can
      // arrive before the tool_call frame it belongs to. Wait for the matching frame rather
      // than failing a legitimate call with "no tool call is pending".
      while (pendingToolReply === undefined) {
        await new Promise<void>((resolve) => {
          toolCallWaiters.push(resolve);
        });
      }
      const pending = pendingToolReply;
      pendingToolReply = undefined;
      return { type: "input_reply", content: { value: await pending } };
    });

    const fold = (message: RpcMessage): boolean => {
      switch (message.type) {
        case "stream": {
          const name = message.content["name"] === "stderr" ? "stderr" : "stdout";
          const text = typeof message.content["text"] === "string" ? message.content["text"] : "";
          for (const line of text.split("\n")) {
            if (line === "") continue;
            foldLine(name, line);
          }
          return false;
        }
        case "execute_result":
        case "display_data": {
          const data = message.content["data"];
          const text = isRecord(data) ? data["text/plain"] : undefined;
          if (typeof text === "string") foldLine("stdout", text);
          return false;
        }
        case "error": {
          const name = typeof message.content["ename"] === "string" ? message.content["ename"] : "Error";
          const text = typeof message.content["evalue"] === "string" ? message.content["evalue"] : "";
          const traceback = message.content["traceback"];
          const frame: { type: "error"; name: string; message: string; traceback?: string } = {
            type: "error",
            name,
            message: text,
          };
          if (Array.isArray(traceback)) frame.traceback = traceback.join("\n");
          frames.push(frame);
          return false;
        }
        case "status":
          return message.content["execution_state"] === "idle";
        default:
          return false;
      }
    };

    try {
      await this.peer.request(
        "execute_request",
        {
          code: options.code,
          silent: false,
          store_history: true,
          user_expressions: {},
          allow_stdin: true,
          stop_on_error: true,
        },
        {
          timeoutMs: options.timeoutMs > 0 ? options.timeoutMs : this.requestTimeoutMs,
          signal: options.signal,
          done: fold,
        },
      );
    } finally {
      unsubscribe();
    }
    frames.push({ type: "step_end" });
    return { frames, outputs, exitStatus: null, durationMs: Date.now() - startedAt };
  }

  dispose(): void {
    if (this.closed) return;
    this.closed = true;
    this.peer.dispose();
    try {
      this.socket.close(1000, "done");
    } catch {
      // The socket was already gone.
    }
  }

  private async answerToolCall(
    frame: { callId: string; name: string; args: unknown },
    callTool: ((call: SandboxToolCall) => unknown | Promise<unknown>) | undefined,
  ): Promise<string> {
    if (callTool === undefined) {
      return JSON.stringify({ ok: false, error: "This backend has no tool-call channel." });
    }
    const call: SandboxToolCall = { callId: frame.callId, name: frame.name, args: frame.args };
    try {
      return JSON.stringify({ ok: true, value: encodeValue(await callTool(call)) });
    } catch (error) {
      return JSON.stringify({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  }

  private onMessage(data: unknown): void {
    const text = typeof data === "string" ? data : data instanceof ArrayBuffer ? new TextDecoder().decode(data) : "";
    if (text === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }
    const message = fromWire(parsed);
    if (message !== undefined) this.peer.handle(message);
  }
}

export class JupyterGateway {
  private readonly options: JupyterGatewayOptions;

  constructor(options: JupyterGatewayOptions) {
    this.options = options;
  }

  /** Poll `/api/kernelspecs` until it answers 200, as upstream's readiness wait does. */
  async waitForReady(): Promise<void> {
    const attempts = this.options.readyAttempts ?? DEFAULT_READY_ATTEMPTS;
    const intervalMs = this.options.readyIntervalMs ?? DEFAULT_READY_INTERVAL_MS;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await this.fetchImpl()(this.withToken("/api/kernelspecs"));
        if (response.ok) return;
      } catch {
        // Not listening yet.
      }
      if (attempt < attempts - 1) await delay(intervalMs);
    }
    throw new SandboxError(
      "The kernel gateway did not answer /api/kernelspecs after " + String(attempts) + " attempts.",
    );
  }

  /** POST `/api/kernels`; a 201 body carries the kernel id. */
  async createKernel(): Promise<string> {
    const response = await this.fetchImpl()(this.withToken("/api/kernels"), { method: "POST" });
    if (response.status !== 201) {
      throw new SandboxError("The kernel gateway answered " + String(response.status) + " creating a kernel; expected 201.");
    }
    const body = (await response.json()) as unknown;
    const id = isRecord(body) ? body["id"] : undefined;
    if (typeof id !== "string" || id === "") {
      throw new SandboxError("The kernel create response carried no kernel id.");
    }
    return id;
  }

  connect(kernelId: string): JupyterKernel {
    const url = this.webSocketUrl("/api/kernels/" + encodeURIComponent(kernelId) + "/channels");
    const socket = this.options.webSocketFactory(url);
    const options: { requestTimeoutMs?: number } = {};
    if (this.options.requestTimeoutMs !== undefined) options.requestTimeoutMs = this.options.requestTimeoutMs;
    return new JupyterKernel(socket, options);
  }

  private fetchImpl(): typeof globalThis.fetch {
    return this.options.fetch ?? globalThis.fetch;
  }

  private withToken(path: string): string {
    const base = this.options.baseUrl.replace(/\/$/, "");
    return base + path + "?token=" + encodeURIComponent(this.options.token);
  }

  private webSocketUrl(path: string): string {
    const base = this.options.baseUrl.replace(/\/$/, "").replace(/^http/, "ws");
    return base + path + "?token=" + encodeURIComponent(this.options.token);
  }
}

function toWire(message: RpcMessage, session: string): string {
  return JSON.stringify({
    channel: message.type === "input_reply" ? "stdin" : "shell",
    header: {
      msg_id: message.id,
      username: WIRE_USERNAME,
      session,
      date: new Date().toISOString(),
      msg_type: message.type,
      version: WIRE_VERSION,
    },
    parent_header: message.parentId === undefined ? {} : { msg_id: message.parentId },
    metadata: {},
    content: message.content,
  });
}

export function fromWire(parsed: unknown): RpcMessage | undefined {
  if (!isRecord(parsed)) return undefined;
  const header = isRecord(parsed["header"]) ? parsed["header"] : {};
  const id = header["msg_id"];
  const type = header["msg_type"];
  if (typeof id !== "string" || typeof type !== "string") return undefined;
  const parent = isRecord(parsed["parent_header"]) ? parsed["parent_header"] : {};
  const parentId = parent["msg_id"];
  const base = {
    id,
    type,
    content: isRecord(parsed["content"]) ? parsed["content"] : {},
  };
  return typeof parentId === "string" ? { ...base, parentId } : base;
}
