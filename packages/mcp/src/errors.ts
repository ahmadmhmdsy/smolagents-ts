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
 * The server never declared the capability a verb needs. The client refuses before a
 * message is sent, so the caller learns which side is missing what instead of reading a
 * protocol error the server did not have to produce.
 */
export class MCPCapabilityError extends MCPError {
  /** The server, as the client names it. */
  readonly server: string;
  /** The capability the verb needed, e.g. "tools". */
  readonly capability: string;
  /** The verb that was refused. */
  readonly method: string;

  constructor(message: string, server: string, capability: string, method: string) {
    super(message);
    this.server = server;
    this.capability = capability;
    this.method = method;
  }
}

/**
 * A paginated listing that did not finish inside the client's page bound. A server that
 * keeps answering a cursor would otherwise keep one read alive forever.
 */
export class MCPListLimitError extends MCPError {
  readonly method: string;
  readonly server: string;
  readonly pages: number;

  constructor(message: string, method: string, server: string, pages: number) {
    super(message);
    this.method = method;
    this.server = server;
    this.pages = pages;
  }
}

/**
 * The HTTP answer was not 2xx. The status is kept because it is the difference between a
 * lost session (404) and a real failure, and only the transport sees it.
 */
export class MCPHttpStatusError extends MCPTransportError {
  readonly status: number;
  readonly method: string | undefined;

  constructor(message: string, status: number, method?: string, options?: { cause?: unknown }) {
    super(message, options);
    this.status = status;
    this.method = method;
  }
}

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
