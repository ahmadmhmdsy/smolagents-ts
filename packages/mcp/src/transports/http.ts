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
}

const CLOSED_MESSAGE =
  "The MCP transport is closed: the client has already disconnected from this server.";

const SESSION_HEADER = "mcp-session-id";
const PROTOCOL_HEADER = "mcp-protocol-version";
const ACCEPT = "application/json, text/event-stream";

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
    const response = await this.fetchImpl(this.url, {
      method: "POST",
      headers: this.requestHeaders(),
      body: JSON.stringify(message),
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
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
      await this.readEventStream(response);
      return;
    }
    const text = await response.text();
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
    return {
      accept: ACCEPT,
      "content-type": "application/json",
      [PROTOCOL_HEADER]: this.protocolVersion,
      ...(this.sessionId === undefined ? {} : { [SESSION_HEADER]: this.sessionId }),
      ...this.headers,
    };
  }

  private async readEventStream(response: Response): Promise<void> {
    const body = response.body;
    if (body === null) return;
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    const data: string[] = [];
    const take = (): void => {
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

/** Builds the transport for a URL server parameter. */
export function createHttpTransport(options: HttpTransportOptions): StreamableHttpTransport {
  return new StreamableHttpTransport(options);
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
