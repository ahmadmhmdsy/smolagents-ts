/**
 * The JSON-RPC 2.0 wire shapes MCP uses, as a discriminated union.
 *
 * These four declarations mirror the official SDK's `JSONRPCMessage` union member for
 * member. The mirror is deliberately exact rather than loose — `result` is a record
 * rather than `unknown`, `jsonrpc` is the literal "2.0", and `id` and `method` are
 * required — because decision 0015 promises that a caller can inject an official SDK
 * transport into `MCPTransport` with no adapter of ours in between, and that promise
 * only holds if the two declarations are structurally assignable. A test pins it.
 */

/** Requests the client sends and the server answers. */
export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/** Notifications carry no id and are never answered. */
export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: string | number;
  result: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcErrorResponse {
  jsonrpc: "2.0";
  id: string | number;
  error: JsonRpcError;
}

export type MCPMessage =
  | JsonRpcRequest
  | JsonRpcNotification
  | JsonRpcResponse
  | JsonRpcErrorResponse;

/** Narrows any incoming message to the responses that answer a request. */
export function isErrorResponse(message: MCPMessage): message is JsonRpcErrorResponse {
  return "error" in message;
}

/** The response side of the union, whether it succeeded or failed. */
export function isResponse(message: MCPMessage): message is JsonRpcResponse | JsonRpcErrorResponse {
  return "id" in message && !("method" in message);
}

export function isRequest(message: MCPMessage): message is JsonRpcRequest {
  return "id" in message && "method" in message;
}

export function isNotification(message: MCPMessage): message is JsonRpcNotification {
  return !("id" in message) && "method" in message;
}
