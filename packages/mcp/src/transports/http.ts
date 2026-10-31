import type { MCPMessage } from "../json-rpc.js";
import type { MCPTransport } from "../transport.js";
import { DEFAULT_NEGOTIATED_PROTOCOL_VERSION } from "../parameters.js";
import { MCPClosedError, MCPHttpStatusError, MCPTransportError } from "../errors.js";

/** The subset of fetch this transport uses. Injectable, so the suite needs no server. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

export interface HttpTransportOptions {
  readonly url: string;
  readonly fetch?: FetchLike;
  /** Extra headers for every request, e.g. an Authorization value. */
  readonly headers?: Readonly<Record<string, string>>;
  /**
   * How long the server may stay silent, in milliseconds, before the request is aborted. Each
   * chunk of a response restarts it, so a long event stream that keeps talking survives.
   * Absent by default: the client's own request timeout then stops waiting, but not the fetch.
   */
  readonly timeoutMs?: number;
  /** The most bytes of one JSON body or one stream event. Defaults to 32 MiB. */
  readonly maxResponseBytes?: number;
  /** Sends an Authorization header over plain http to a remote host, which is refused otherwise. */
  readonly allowInsecureAuthorization?: boolean;
}

const CLOSED_MESSAGE =
  "The MCP transport is closed: the client has already disconnected from this server.";

const SESSION_HEADER = "mcp-session-id";
const PROTOCOL_HEADER = "mcp-protocol-version";
const ACCEPT = "application/json, text/event-stream";
const DEFAULT_MAX_RESPONSE_BYTES = 32 * 1024 * 1024;
const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** True for a credential a network observer could read. An unparsable URL fails at fetch. */
function exposesAuthorization(url: string, headers: Readonly<Record<string, string>>): boolean {
  if (!Object.keys(headers).some((name) => name.toLowerCase() === "authorization")) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" && !LOOPBACK_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

/**
 * The Streamable HTTP transport: one POST per message.
 *
 * The event-stream reader is this file's own rather than the models package's
 * `parseSse`: importing a provider package for forty lines would give the models
 * layer a second reason to exist and make an MCP transport depend on a provider
 * adapter. The behaviour is the same one — LF line ends, a blank line ends an event,
 * `data:` lines join with LF.
 */
export class StreamableHttpTransport implements MCPTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  private readonly url: string;
  private readonly fetchImpl: FetchLike;
  private readonly headers: Readonly<Record<string, string>>;
  private readonly timeoutMs: number | undefined;
  private readonly maxResponseBytes: number;
  private protocolVersion = DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
  private started = false;
  private closed = false;

  constructor(options: HttpTransportOptions) {
    this.url = options.url;
    const found = options.fetch ?? globalThis.fetch;
    if (typeof found !== "function") {
      throw new MCPTransportError(
        "No fetch available for the MCP Streamable HTTP transport: pass options.fetch.",
      );
    }
    this.fetchImpl = found as FetchLike;
    this.headers = options.headers ?? {};
    if (options.allowInsecureAuthorization !== true && exposesAuthorization(this.url, this.headers)) {
      throw new MCPTransportError(
        "Refusing to send an Authorization header over plain http to " +
          this.url +
          ": use https, or pass allowInsecureAuthorization.",
      );
    }
    this.timeoutMs = options.timeoutMs;
    this.maxResponseBytes = options.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
    this.setProtocolVersion = (version) => {
      this.protocolVersion = version;
    };
  }

  start(): Promise<void> {
    this.started = true;
    return Promise.resolve();
  }

  async send(message: MCPMessage): Promise<void> {
    if (this.closed) throw new MCPClosedError(CLOSED_MESSAGE);
    if (!this.started) throw new MCPTransportError("send() before start()");
    const watchdog = new Watchdog(this.timeoutMs);
    try {
      await this.exchange(message, watchdog);
    } catch (error) {
      if (!watchdog.expired) throw error;
      throw new MCPTransportError(
        "The MCP server was silent for " + String(this.timeoutMs) + " ms, so the request was aborted.",
        { cause: error },
      );
    } finally {
      watchdog.stop();
    }
  }

  private async exchange(message: MCPMessage, watchdog: Watchdog): Promise<void> {
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify(message),
      ...(watchdog.signal === undefined ? {} : { signal: watchdog.signal }),
    });
    watchdog.restart();
    if (!response.ok) {
      const body = await this.readText(response, watchdog).catch(() => "");
      throw new MCPHttpStatusError(
        "The MCP server answered HTTP " +
          String(response.status) +
          " for " +
          ("method" in message ? message.method : "a response") +
          ": " +
          body.slice(0, 300),
        response.status,
        "method" in message ? message.method : undefined,
      );
    }
    const session = response.headers.get(SESSION_HEADER);
    if (session !== null && session !== "") this.sessionId = session;
    const contentType = response.headers.get("content-type") ?? "";
    if (contentType.includes("text/event-stream")) {
      await this.readEventStream(response, watchdog);
      return;
    }
    const text = await this.readText(response, watchdog);
    if (text.trim() === "") return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new MCPTransportError(
        "The MCP server answered with a body that is not JSON: " + text.slice(0, 300),
        { cause: error },
      );
    }
    this.deliver(parsed);
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    // The specification ends a session with a DELETE; a server that never sent a
    // session id has nothing to end.
    if (this.sessionId !== undefined) {
      try {
        await this.fetchImpl(this.url, {
          method: "DELETE",
          headers: this.requestHeaders(),
        });
      } catch (error) {
        this.onerror?.(toError(error));
      }
    }
    this.onclose?.();
  }

  private requestHeaders(): Record<string, string> {
    // The caller's headers go first: a custom value must not replace the session the
    // server assigned or the protocol version the client negotiated.
    return {
      ...this.headers,
      accept: ACCEPT,
      "content-type": "application/json",
      [PROTOCOL_HEADER]: this.protocolVersion,
      ...(this.sessionId === undefined ? {} : { [SESSION_HEADER]: this.sessionId }),
    };
  }

  private tooLarge(): MCPTransportError {
    return new MCPTransportError(
      "The MCP server sent more than " + String(this.maxResponseBytes) + " bytes in one message.",
    );
  }

  /** Reads a body within the cap, so a server cannot exhaust memory with one answer. */
  private async readText(response: Response, watchdog: Watchdog): Promise<string> {
    const body = response.body;
    if (body === null) return "";
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    let held = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return text + decoder.decode();
        watchdog.restart();
        held += value.byteLength;
        if (held > this.maxResponseBytes) throw this.tooLarge();
        text += decoder.decode(value, { stream: true });
      }
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private async readEventStream(response: Response, watchdog: Watchdog): Promise<void> {
    const body = response.body;
    if (body === null) return;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let held = 0;
    const data: string[] = [];
    const take = (): void => {
      held = 0;
      if (data.length === 0) return;
      const payload = data.join("\n");
      data.length = 0;
      if (payload.trim() === "") return;
      try {
        this.deliver(JSON.parse(payload));
      } catch (error) {
        this.onerror?.(toError(error));
      }
    };
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        watchdog.restart();
        held += value.byteLength;
        if (held > this.maxResponseBytes) throw this.tooLarge();
        buffer += decoder.decode(value, { stream: true });
        for (;;) {
          const index = buffer.indexOf("\n");
          if (index === -1) break;
          const raw = buffer.slice(0, index);
          buffer = buffer.slice(index + 1);
          const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
          if (line === "") {
            take();
            continue;
          }
          if (line.startsWith(":")) continue;
          const colon = line.indexOf(":");
          const field = colon === -1 ? line : line.slice(0, colon);
          let rest = colon === -1 ? "" : line.slice(colon + 1);
          if (rest.startsWith(" ")) rest = rest.slice(1);
          if (field === "data") data.push(rest);
        }
      }
      buffer += decoder.decode();
      if (buffer !== "") data.push(buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
      take();
    } catch (error) {
      await reader.cancel().catch(() => undefined);
      throw error;
    } finally {
      reader.releaseLock();
    }
  }

  private deliver(value: unknown): void {
    if (value === null || typeof value !== "object") return;
    const message = value as MCPMessage;
    if (!("jsonrpc" in message)) return;
    try {
      this.onmessage?.(message);
    } catch (error) {
      // A handler must not throw into the response-parsing path: inside the event-stream
      // reader that becomes an unhandled rejection in the read loop, and a message that
      // arrives after disconnect() is the ordinary way a handler throws.
      this.onerror?.(toError(error));
    }
  }
}

/** Aborts a request after a silence; with no budget it does nothing and carries no signal. */
class Watchdog {
  expired = false;
  private readonly controller: AbortController | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly budgetMs: number | undefined) {
    this.controller = budgetMs === undefined ? undefined : new AbortController();
    this.restart();
  }

  get signal(): AbortSignal | undefined {
    return this.controller?.signal;
  }

  restart(): void {
    if (this.budgetMs === undefined) return;
    this.stop();
    this.timer = setTimeout(() => {
      this.expired = true;
      this.controller?.abort();
    }, this.budgetMs);
  }

  stop(): void {
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }
}

/** Builds the transport for a URL server parameter. */
export function createHttpTransport(options: HttpTransportOptions): StreamableHttpTransport {
  return new StreamableHttpTransport(options);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
