/**
 * The public surface: the client, its parameters and options, the tool adapter, the
 * errors, the seam, and the Streamable HTTP transport.
 *
 * The stdio transport is deliberately absent: it is reachable only as
 * "@smolagents-ts/mcp/stdio", so a browser bundle that imports this package never
 * reaches node:child_process. The architecture test enforces the same rule.
 */
export {
  MCPClient,
  CLIENT_INFO,
  NOTIFICATION_HISTORY_LIMIT,
  type MCPToolSource,
} from "./client.js";
export {
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  LATEST_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  isStdioServerParameters,
  isUrlServerParameters,
  type MCPClientOptions,
  type MCPServerParameters,
  type MCPTransportKind,
  type StdioServerParameters,
  type UrlServerParameters,
} from "./parameters.js";
export {
  adaptTools,
  assertNoCollisions,
  sanitizeToolName,
  type AdaptToolsOptions,
  type MCPTool,
  type MCPToolListEntry,
} from "./tool-adapter.js";
export { mcpTools, withMCPClient, type MCPToolsOptions } from "./tools.js";
export {
  MCPCapabilityError,
  MCPClosedError,
  MCPConnectionError,
  MCPError,
  MCPHttpStatusError,
  MCPListLimitError,
  MCPParameterError,
  MCPProtocolError,
  MCPTimeoutError,
  MCPToolCollisionError,
  MCPToolError,
  MCPTransportError,
} from "./errors.js";
export type {
  MCPCompletionRequest,
  MCPCompletionResult,
  MCPListOptions,
  MCPPrompt,
  MCPPromptArgument,
  MCPPromptContent,
  MCPPromptMessage,
  MCPPromptResult,
  MCPReadOptions,
  MCPResource,
  MCPResourceContents,
} from "./catalog.js";
export type { MCPTransport } from "./transport.js";
export {
  isErrorResponse,
  isNotification,
  isRequest,
  isResponse,
  type JsonRpcError,
  type JsonRpcErrorResponse,
  type JsonRpcNotification,
  type JsonRpcRequest,
  type JsonRpcResponse,
  type MCPMessage,
} from "./json-rpc.js";
export {
  StreamableHttpTransport,
  createHttpTransport,
  type FetchLike,
  type HttpTransportOptions,
} from "./transports/http.js";
export { VERSION } from "./version.js";
