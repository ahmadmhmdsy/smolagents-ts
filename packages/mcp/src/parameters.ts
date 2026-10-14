import type { MCPTransport } from "./transport.js";
import type { Logger } from "@smolagents-ts/core";
import { MCPParameterError } from "./errors.js";

/** Protocol revisions this client offers and accepts. Published by the MCP specification. */
export const LATEST_PROTOCOL_VERSION = "2025-11-25";
export const DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26";
export const SUPPORTED_PROTOCOL_VERSIONS: readonly string[] = [
  "2024-11-05",
  "2025-03-26",
  "2025-06-18",
  "2025-11-25",
];

/** The two transport strings this port knows. "sse" is refused by name. */
export type MCPTransportKind = "streamable-http" | "sse";

/** Parameters for a subprocess server. The shape mirrors the SDK's StdioServerParameters. */
export interface StdioServerParameters {
  readonly command: string;
  readonly args?: readonly string[];
  readonly env?: Readonly<Record<string, string>>;
  readonly cwd?: string;
}

/** Parameters for an HTTP server. */
export interface UrlServerParameters {
  readonly url: string;
  /** Defaults to "streamable-http". The legacy "sse" value is refused by name. */
  readonly transport?: MCPTransportKind;
}

export type MCPServerParameters = StdioServerParameters | UrlServerParameters;

export function isUrlServerParameters(
  parameters: MCPServerParameters,
): parameters is UrlServerParameters {
  return "url" in parameters;
}

export function isStdioServerParameters(
  parameters: MCPServerParameters,
): parameters is StdioServerParameters {
  return "command" in parameters;
}

/** What the client needs to run, beyond the server parameters. */
export interface MCPClientOptions {
  /** Where protocol warnings and unexpected notifications go. Defaults to noopLogger. */
  readonly logger?: Logger;
  /** Per-request timeout in milliseconds. Defaults to 30 seconds. */
  readonly requestTimeoutMs?: number;
  /**
   * Upstream's structured-output switch. Defaults to false, with upstream's notice
   * routed through the logger; when true, a tool's output schema is validated and the
   * response's structuredContent is returned instead of the joined text.
   */
  readonly structuredOutput?: boolean;
  /**
   * Builds the transport for one server. The default builds this package's Streamable
   * HTTP transport for a URL parameter and refuses a stdio parameter, because the root
   * entry must not reach node:child_process — a caller with a subprocess server passes
   * the transport from "@smolagents-ts/mcp/stdio" here instead.
   */
  readonly transportFactory?: (parameters: MCPServerParameters) => MCPTransport;
}

export function normalizeParameters(
  parameters: MCPServerParameters | readonly MCPServerParameters[],
): MCPServerParameters[] {
  return Array.isArray(parameters) ? [...parameters] : [parameters as MCPServerParameters];
}

/**
 * Refuses a parameter object before any I/O. A URL parameter is checked here rather
 * than in the transport factory so a bad transport string never becomes a transport.
 */
export function validateParameters(parameters: MCPServerParameters): void {
  if (!isUrlServerParameters(parameters)) {
    if (typeof parameters.command !== "string" || parameters.command === "") {
      throw new MCPParameterError("An MCP server parameter needs a non-empty 'command' or 'url'.");
    }
    return;
  }
  const transport = parameters.transport ?? "streamable-http";
  if (transport === "sse") {
    throw new MCPParameterError(
      "The legacy HTTP+SSE MCP transport is deprecated and this client does not ship it: use " +
        "Streamable HTTP ('transport: \"streamable-http\"', the default).",
    );
  }
  if (transport !== "streamable-http") {
    throw new MCPParameterError(
      "Unsupported MCP transport: " +
        String(transport) +
        ". Supported transports are 'streamable-http' and the deprecated 'sse', which this " +
        "client refuses.",
    );
  }
}
