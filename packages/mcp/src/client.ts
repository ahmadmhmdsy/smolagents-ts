import { noopLogger, type Logger, type Tool } from "@smolagents-ts/core";
import type { MCPMessage } from "./json-rpc.js";
import { isErrorResponse, isResponse } from "./json-rpc.js";
import type { MCPTransport } from "./transport.js";
import {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  isUrlServerParameters,
  normalizeParameters,
  validateParameters,
  type MCPClientOptions,
  type MCPServerParameters,
} from "./parameters.js";
export type { MCPClientOptions } from "./parameters.js";
import {
  MCPConnectionError,
  MCPParameterError,
  MCPProtocolError,
  MCPTimeoutError,
  MCPTransportError,
} from "./errors.js";
import { createHttpTransport } from "./transports/http.js";
import {
  adaptTools,
  assertNoCollisions,
  type MCPTool,
  type MCPToolListEntry,
} from "./tool-adapter.js";
import { VERSION } from "./version.js";

/** The client's own protocol identity, sent in clientInfo. */
export const CLIENT_INFO = { name: "@smolagents-ts/mcp", version: VERSION } as const;

const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** How many non-response messages the public `notifications` array retains. */
export const NOTIFICATION_HISTORY_LIMIT = 100;

/** How one connection is addressed. A caller uses the value getTools() gave it. */
export interface MCPToolSource {
  request(
    method: string,
    params: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ): Promise<Record<string, unknown>>;
  readonly server: string;
}

/** One connected peer: its transport, its server name, and its cached tool list. */
interface ServerConnection extends MCPToolSource {
  readonly parameters: MCPServerParameters;
  transport: MCPTransport;
  tools: Tool[] | undefined;
  stale: boolean;
  /** The first failure this connection reported, kept so a later request refuses at once. */
  failure: Error | undefined;
}

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout> | undefined;
  method: string;
  connection: ServerConnection;
}

/**
 * An MCP client.
 *
 * The client keeps upstream's lifecycle: it connects during construction, exposes
 * `getTools()`/`tools`, and is torn down by `disconnect()`. Python's `with` has no
 * `await using` equivalent under this repository's base config — `lib` is ES2023,
 * which has no `Symbol.asyncDispose` — so the context manager is the `withMCPClient`
 * helper in `src/tools.ts` plus an explicit `disconnect()`, which is how the rest of
 * the port handles one.
 *
 * `connect()` runs during construction, as upstream's does; a construction that
 * cannot connect closes whatever it opened and rejects with the original failure.
 * The constructor is therefore private, and `MCPClient.create(...)` is the entry.
 */
export class MCPClient {
  /**
   * The messages the server sent that were not responses, in arrival order, capped at
   * NOTIFICATION_HISTORY_LIMIT: only the most recent are kept, so a server that logs
   * for a day cannot grow this array for a day.
   */
  readonly notifications: MCPMessage[] = [];

  private readonly logger: Logger;
  private readonly requestTimeoutMs: number;
  private readonly transportFactory: (parameters: MCPServerParameters) => MCPTransport;
  private readonly structuredOutput: boolean;
  private readonly connections: ServerConnection[] = [];
  private readonly pending = new Map<string | number, PendingRequest>();
  private nextId = 1;
  private closed = false;
  private connected = false;
  private negotiation: string = DEFAULT_NEGOTIATED_PROTOCOL_VERSION;
  private cachedTools: Tool[] | undefined;
  private notificationHistoryTruncated = false;

  private constructor(parameters: readonly MCPServerParameters[], options: MCPClientOptions) {
    this.logger = options.logger ?? noopLogger;
    this.requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
    this.transportFactory = options.transportFactory ?? defaultTransportFactory;
    this.structuredOutput = options.structuredOutput ?? false;
    if (options.structuredOutput === undefined) {
      // Upstream warns that the default flips to true at 1.25; the notice is routed
      // through the injected logger rather than the console, which the library never writes to.
      this.logger.warn(
        "mcp: 'structuredOutput' was not specified. It defaults to false; set it explicitly " +
          "to silence this notice. Upstream intends to flip the default to true.",
      );
    }
    for (const parameter of parameters) {
      validateParameters(parameter);
      const index = this.connections.length;
      this.connections.push({
        // The transport is created in connect(), not here, so a parameter that cannot
        // be accepted is refused before any process or socket is opened.
        parameters: parameter,
        transport: undefined as unknown as MCPTransport,
        server: serverName(parameter),
        tools: undefined,
        stale: false,
        failure: undefined,
        request: (method, params, signal) =>
          this.request(method, params, signal, this.connections[index]),
      });
    }
  }

  /** Connects, as upstream does during construction, and returns the live client. */
  static async create(
    parameters: MCPServerParameters | readonly MCPServerParameters[],
    options: MCPClientOptions = {},
  ): Promise<MCPClient> {
    const client = new MCPClient(normalizeParameters(parameters), options);
    await client.connect();
    return client;
  }

  /**
   * Opens every server's transport and completes the MCP handshake on each.
   *
   * Idempotent: a second call returns the same client without a second handshake.
   */
  async connect(): Promise<this> {
    if (this.connected) return this;
    try {
      for (const connection of this.connections) {
        const transport = this.transportFactory(connection.parameters);
        installHandlers(transport, this, connection);
        // Assigned before start(), so a handshake that fails still has something to
        // close: a transport whose handshake fails would otherwise stay open.
        connection.transport = transport;
        await transport.start();
        await this.handshake(connection);
      }
    } catch (error) {
      this.closeAll();
      throw error;
    }
    this.connected = true;
    return this;
  }

  /** The tools every connected server exposes, concatenated in parameter order. */
  async getTools(): Promise<Tool[]> {
    if (this.cachedTools === undefined || this.connections.some((connection) => connection.stale)) {
      this.cachedTools = await this.listTools();
    }
    return this.cachedTools;
  }

  /** The tools, for a caller that already awaited the connection. */
  get tools(): Promise<Tool[]> {
    return this.getTools();
  }

  /**
   * Closes every transport once. Idempotent: a second call is quiet, and a message
   * that arrives after the close is refused rather than answered.
   */
  disconnect(): void {
    this.closeAll();
  }

  /** The negotiated protocol revision, once connect() has run. */
  get protocolVersion(): string {
    return this.negotiation;
  }

  /**
   * Sends one request over one server's transport and awaits its response.
   *
   * `signal` lets a caller's abort stop waiting immediately rather than at the
   * timeout; the request itself still reaches the server. Omitting `source` uses the
   * first connection.
   */
  async request(
    method: string,
    params: Record<string, unknown> | undefined,
    signal?: AbortSignal,
    source?: ServerConnection,
  ): Promise<Record<string, unknown>> {
    if (this.closed) {
      throw new MCPConnectionError(
        "The MCP client is closed: " + method + " cannot be sent after disconnect().",
      );
    }
    const connection = source ?? this.connections[0];
    if (connection === undefined) {
      throw new MCPConnectionError("The MCP client has no server connected.");
    }
    if (connection.failure !== undefined) {
      // A transport that already failed answers nothing: refusing here is what keeps a
      // caller from waiting on a response that can never arrive.
      throw connection.failure;
    }
    const id = this.nextId;
    this.nextId += 1;
    const message: MCPMessage = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      const entry: PendingRequest = { resolve, reject, timer: undefined, method, connection };
      this.pending.set(id, entry);
      if (signal?.aborted === true) {
        this.pending.delete(id);
        reject(abortError(method));
        return;
      }
      if (signal !== undefined) {
        signal.addEventListener(
          "abort",
          () => {
            const waiting = this.pending.get(id);
            if (waiting === undefined) return;
            this.pending.delete(id);
            if (waiting.timer !== undefined) clearTimeout(waiting.timer);
            waiting.reject(abortError(method));
          },
          { once: true },
        );
      }
      entry.timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new MCPTimeoutError(
            "The MCP request " +
              method +
              " timed out after " +
              String(this.requestTimeoutMs) +
              " ms.",
          ),
        );
      }, this.requestTimeoutMs);
      // A pending request must not keep the process alive on its own.
      (entry.timer as { unref?: () => void }).unref?.();
    });
    try {
      await connection.transport.send(message);
    } catch (error) {
      const waiting = this.pending.get(id);
      if (waiting !== undefined) {
        this.pending.delete(id);
        if (waiting.timer !== undefined) clearTimeout(waiting.timer);
      }
      throw error;
    }
    return promise;
  }

  /** Routes one incoming message. Exposed so the transports can be unit-tested apart. */
  handleMessage(message: MCPMessage): void {
    if (this.closed) {
      throw new MCPConnectionError(
        "The MCP client is closed: a message arrived after disconnect() and was refused.",
      );
    }
    if (isResponse(message)) {
      const waiting = this.pending.get(message.id);
      if (waiting === undefined) {
        this.logger.debug("mcp: a response with no pending request", message.id);
        return;
      }
      this.pending.delete(message.id);
      if (waiting.timer !== undefined) clearTimeout(waiting.timer);
      if (isErrorResponse(message)) {
        waiting.reject(
          new MCPProtocolError(
            "The MCP server rejected " +
              waiting.method +
              ": " +
              message.error.message +
              " (code " +
              String(message.error.code) +
              ")",
            message.error.code,
          ),
        );
        return;
      }
      waiting.resolve(message.result);
      return;
    }
    if ("method" in message) {
      this.recordNotification(message);
      if (message.method === "notifications/tools/list_changed" && !("id" in message)) {
        for (const connection of this.connections) connection.stale = true;
        this.logger.debug("mcp: the tool list changed; it refreshes on the next read");
        return;
      }
      this.logger.debug("mcp: notification " + message.method, message.params);
      return;
    }
    throw new MCPTransportError(
      "The MCP transport delivered a message that is neither a response nor a notification.",
    );
  }

  /**
   * Retains the newest notifications and drops the oldest past the cap. The drop is
   * logged once, so a long-lived server that logs every request is visible without
   * the log itself becoming the unbounded growth.
   */
  private recordNotification(message: MCPMessage): void {
    this.notifications.push(message);
    if (this.notifications.length <= NOTIFICATION_HISTORY_LIMIT) return;
    this.notifications.shift();
    if (this.notificationHistoryTruncated) return;
    this.notificationHistoryTruncated = true;
    this.logger.warn(
      "mcp: the notification history is capped at " +
        String(NOTIFICATION_HISTORY_LIMIT) +
        " messages; the oldest are dropped as new ones arrive.",
    );
  }

  /**
   * Where a transport reports its own failure. Public because a transport is external.
   *
   * The failure settles everything in flight on that connection, because a transport
   * that has failed can no longer answer: without this a handshake against a process
   * that never started would wait for a reply that is not coming.
   */
  handleTransportError(error: Error, connection?: ServerConnection): void {
    this.logger.warn("mcp: transport error", error);
    if (connection !== undefined) this.failConnection(connection, error);
  }

  /** Where a transport reports that the peer went away. */
  handleTransportClose(connection?: ServerConnection): void {
    this.logger.debug("mcp: the transport closed");
    if (connection === undefined) return;
    this.failConnection(
      connection,
      new MCPConnectionError(
        "The MCP transport for '" +
          connection.server +
          "' closed before the request was answered.",
      ),
    );
  }

  /** Records why a connection failed and rejects everything in flight on it. */
  private failConnection(connection: ServerConnection, error: Error): void {
    connection.failure ??= error;
    for (const [id, waiting] of this.pending) {
      if (waiting.connection !== connection) continue;
      if (waiting.timer !== undefined) clearTimeout(waiting.timer);
      this.pending.delete(id);
      waiting.reject(error);
    }
  }

  private async handshake(connection: ServerConnection): Promise<void> {
    const result = await this.request(
      "initialize",
      {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: CLIENT_INFO.name, version: CLIENT_INFO.version },
      },
      undefined,
      connection,
    );
    const version = result["protocolVersion"];
    if (typeof version !== "string" || !SUPPORTED_PROTOCOL_VERSIONS.includes(version)) {
      throw new MCPProtocolError(
        "The MCP server negotiated protocol version " +
          String(version) +
          ", which this client does not speak. It offered " +
          LATEST_PROTOCOL_VERSION +
          " and accepts " +
          SUPPORTED_PROTOCOL_VERSIONS.join(", ") +
          ".",
        -32600,
      );
    }
    this.negotiation = version;
    connection.transport.setProtocolVersion?.(version);
    await connection.transport.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  private async listTools(): Promise<Tool[]> {
    const collected: MCPTool[] = [];
    for (const connection of this.connections) {
      const entries: MCPToolListEntry[] = [];
      let cursor: string | undefined;
      for (;;) {
        const params: Record<string, unknown> = cursor === undefined ? {} : { cursor };
        const result = await this.request("tools/list", params, undefined, connection);
        const page = result["tools"];
        if (Array.isArray(page)) entries.push(...(page as MCPToolListEntry[]));
        const next = result["nextCursor"];
        if (typeof next !== "string" || next === "") break;
        cursor = next;
      }
      const adapted: MCPTool[] = adaptTools(entries, connection.server, {
        logger: this.logger,
        structuredOutput: this.structuredOutput,
        request: (method, params, signal) => connection.request(method, params, signal),
      });
      connection.tools = adapted;
      connection.stale = false;
      collected.push(...adapted);
    }
    assertNoCollisions(collected);
    return collected;
  }

  private closeAll(): void {
    if (this.closed) return;
    this.closed = true;
    for (const [, waiting] of this.pending) {
      if (waiting.timer !== undefined) clearTimeout(waiting.timer);
      waiting.reject(
        new MCPConnectionError("The MCP client closed while " + waiting.method + " was in flight."),
      );
    }
    this.pending.clear();
    for (const connection of this.connections) {
      const transport: MCPTransport | undefined = connection.transport;
      if (transport === undefined) continue;
      try {
        const closing = transport.close();
        void Promise.resolve(closing).catch((error: unknown) => {
          this.logger.warn("mcp: closing a transport failed", error);
        });
      } catch (error) {
        this.logger.warn("mcp: closing a transport failed", error);
      }
    }
  }
}

function serverName(parameters: MCPServerParameters): string {
  return isUrlServerParameters(parameters) ? parameters.url : parameters.command;
}

function installHandlers(
  transport: MCPTransport,
  client: MCPClient,
  connection: ServerConnection,
): void {
  transport.onmessage = (message) => client.handleMessage(message);
  transport.onerror = (error) => client.handleTransportError(error, connection);
  transport.onclose = () => client.handleTransportClose(connection);
}

function abortError(method: string): MCPConnectionError {
  return new MCPConnectionError("The MCP request " + method + " was aborted by the caller.");
}

/**
 * Refuses a stdio parameter rather than reaching for a Node builtin: the root entry
 * is isomorphic by construction, and the architecture test enforces it. A caller
 * with a subprocess server passes the transport from "@smolagents-ts/mcp/stdio".
 */
function defaultTransportFactory(parameters: MCPServerParameters): MCPTransport {
  if (isUrlServerParameters(parameters)) {
    return createHttpTransport({ url: parameters.url });
  }
  throw new MCPParameterError(
    "A stdio server needs a transport from @smolagents-ts/mcp/stdio: import { createStdioTransport } " +
      "from there and pass it as transportFactory, or use stdioClient(). " +
      "The root entry cannot open a subprocess.",
  );
}
