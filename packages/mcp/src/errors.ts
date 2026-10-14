/** The base of every failure this package raises, so one catch can name the module. */
export class MCPError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** A server parameter object this client cannot accept, refused before any I/O. */
export class MCPParameterError extends MCPError {}

/** The transport failed, or spoke something that is not JSON-RPC 2.0. */
export class MCPTransportError extends MCPError {}

/** The server answered with a JSON-RPC error object. */
export class MCPProtocolError extends MCPError {
  readonly code: number;

  constructor(message: string, code: number, options?: { cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

/** A request outlived its timeout. The message names the method. */
export class MCPTimeoutError extends MCPError {}

/** The client is closed, or the server's transport went away underneath it. */
export class MCPConnectionError extends MCPError {}

/**
 * A message reached a transport the client has already closed. Raised by the
 * transports themselves, so a caller can tell "you are done" from "the peer failed".
 */
export class MCPClosedError extends MCPTransportError {}

/**
 * A tool call the server reported as failed. Carries the server's own text, and names
 * the tool by its MCP name rather than the sanitised identifier a model writes.
 */
export class MCPToolError extends MCPError {
  readonly toolName: string;
  readonly server: string;

  constructor(message: string, toolName: string, server: string, options?: { cause?: unknown }) {
    super(message, options);
    this.toolName = toolName;
    this.server = server;
  }
}

/**
 * Two tools this client would register under one name. Upstream merges such a pair
 * silently through its adapter; a silently shadowed tool is the one outcome a caller
 * cannot debug, so this port refuses instead.
 */
export class MCPToolCollisionError extends MCPError {
  /** The two tools, as the servers named them. */
  readonly names: readonly [string, string];
  /** The two servers that exposed them. */
  readonly servers: readonly [string, string];

  constructor(
    message: string,
    names: readonly [string, string],
    servers: readonly [string, string],
  ) {
    super(message);
    this.names = names;
    this.servers = servers;
  }
}
