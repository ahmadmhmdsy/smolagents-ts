import type { MCPMessage } from "./json-rpc.js";

/**
 * The one seam every layer above sits on: messages in, messages out.
 *
 * The member list is the official SDK's `Transport` declaration mirrored, because
 * decision 0015 promises a caller can pass an SDK transport here without an adapter.
 * Nothing in this file, and nothing in src/client.ts, knows whether the peer is a
 * subprocess or an HTTP endpoint.
 */
export interface MCPTransport {
  /** Begins listening. The SDK calls this once, before the first send. */
  start(): Promise<void>;
  /** Delivers one message. The transport decides how to frame it. */
  send(message: MCPMessage, options?: { relatedRequestId?: string | number }): Promise<void>;
  /** Releases the peer. Called once by the client's disconnect. */
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
}
