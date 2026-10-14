import { describe, expect, it } from "vitest";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";

/**
 * The official SDK's transport declaration, mirrored structurally.
 *
 * \`@modelcontextprotocol/sdk\` is deliberately not a dependency, so the mirror is written
 * here rather than imported: what is checked is the shapes, not a runtime module. The
 * members below are the published declaration as of the version decision 0015 names —
 * \`params\` is the SDK's inline index signature, and \`result\` is a record rather than
 * \`unknown\`. If this file stops compiling, the decision's promise (an SDK transport works
 * in \`MCPTransport\` with no adapter of ours) has stopped holding.
 */
type RequestId = string | number;

interface SdkJsonRpcRequest {
  jsonrpc: "2.0";
  id: RequestId;
  method: string;
  params?: { [key: string]: unknown };
}

interface SdkJsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: { [key: string]: unknown };
}

interface SdkJsonRpcResponse {
  jsonrpc: "2.0";
  id: RequestId;
  result: Record<string, unknown>;
}

interface SdkJsonRpcError {
  jsonrpc: "2.0";
  id: RequestId;
  error: { code: number; message: string; data?: unknown };
}

type SdkJsonRpcMessage =
  | SdkJsonRpcRequest
  | SdkJsonRpcNotification
  | SdkJsonRpcResponse
  | SdkJsonRpcError;

interface SdkTransport {
  start(): Promise<void>;
  send(message: SdkJsonRpcMessage, options?: { relatedRequestId?: RequestId }): Promise<void>;
  close(): Promise<void>;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: SdkJsonRpcMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;
}

// The two directions of the promise. Either failing to compile breaks the build, which
// is the point: the seam is a type-level claim, and the test runner erases types.
const clientAcceptsAnSdkTransport = (transport: SdkTransport): MCPTransport => transport;
const sdkAcceptsOurTransport = (transport: MCPTransport): SdkTransport => transport;
const messageCrossesBothWays = (message: SdkJsonRpcMessage): MCPMessage => message;

describe("the transport seam against the official SDK's declaration", () => {
  it("drives an SDK-shaped transport through the client's seam", async () => {
    const received: MCPMessage[] = [];
    const sdkTransport: SdkTransport = {
      start: () => Promise.resolve(),
      send: (message) => {
        received.push(messageCrossesBothWays(message));
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    };

    const seam = clientAcceptsAnSdkTransport(sdkTransport);
    await seam.start();
    await seam.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });
    await seam.close();

    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, method: "tools/list" }]);
  });

  it("hands an SDK caller this package's transport, unchanged", () => {
    const sent: SdkJsonRpcMessage[] = [];
    const seam: MCPTransport = {
      start: () => Promise.resolve(),
      send: (message) => {
        sent.push(messageCrossesBothWays(message));
        return Promise.resolve();
      },
      close: () => Promise.resolve(),
    };

    expect(sdkAcceptsOurTransport(seam)).toBe(seam);
  });

  it("refuses a shape that is not a transport, and a loose message", async () => {
    const seam: MCPTransport = {
      start: () => Promise.resolve(),
      send: () => Promise.resolve(),
      close: () => Promise.resolve(),
    };

    // @ts-expect-error a transport must declare start, send and close.
    const incomplete: MCPTransport = { start: () => Promise.resolve() };
    expect(incomplete).toBeDefined();

    await seam.send(
      { jsonrpc: "2.0", id: 1, method: "tools/list" },
      // @ts-expect-error the send options carry only relatedRequestId.
      { relatedRequestId: 1, extra: true },
    );

    const loose: unknown = {};
    // @ts-expect-error a response's result is a record, not unknown.
    const message: SdkJsonRpcMessage = { jsonrpc: "2.0", id: 1, result: loose };
    expect(message).toBeDefined();
  });
});
