import { describe, expect, it, vi } from "vitest";
import { MCPClient } from "../src/client.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { recordingLogger } from "./helpers.js";

/** Answers the handshake, then stays silent so a test can deliver messages itself. */
class HandshakeTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    this.sent.push(message);
    if ("method" in message && message.method === "initialize" && "id" in message) {
      const id = message.id;
      queueMicrotask(() =>
        this.onmessage?.({
          jsonrpc: "2.0",
          id,
          result: { protocolVersion: "2025-03-26", capabilities: {} },
        }),
      );
    }
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }

  deliver(message: MCPMessage): void {
    this.onmessage?.(message);
  }
}

async function twoServers(): Promise<{
  client: MCPClient;
  first: HandshakeTransport;
  second: HandshakeTransport;
  logger: ReturnType<typeof recordingLogger>;
}> {
  const first = new HandshakeTransport();
  const second = new HandshakeTransport();
  const logger = recordingLogger();
  const client = await MCPClient.create(
    [{ url: "http://first.invalid/mcp" }, { url: "http://second.invalid/mcp" }],
    {
      logger,
      requestTimeoutMs: 1_000,
      transportFactory: (parameters) =>
        "url" in parameters && parameters.url.includes("first") ? first : second,
    },
  );
  return { client, first, second, logger };
}

const lastId = (transport: HandshakeTransport): string | number => {
  const message = transport.sent.at(-1);
  if (message === undefined || !("id" in message)) throw new Error("no request was sent");
  return message.id;
};

describe("MCPClient: routing by connection", () => {
  it("ignores a response from a server the request did not go to", async () => {
    const { client, first, second, logger } = await twoServers();

    const pending = client.request("tools/list", {});
    const id = lastId(first);
    second.deliver({ jsonrpc: "2.0", id, result: { tools: ["spoofed"] } });
    first.deliver({ jsonrpc: "2.0", id, result: { tools: [] } });

    await expect(pending).resolves.toEqual({ tools: [] });
    expect(logger.messages.some((line) => line.includes("answered a request that went to"))).toBe(
      true,
    );
    client.disconnect();
  });

  it("answers a server's ping, on the connection it came from", async () => {
    const { client, first, second } = await twoServers();
    const before = first.sent.length;

    second.deliver({ jsonrpc: "2.0", id: "srv-1", method: "ping" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(second.sent.at(-1)).toEqual({ jsonrpc: "2.0", id: "srv-1", result: {} });
    expect(first.sent).toHaveLength(before);
    client.disconnect();
  });

  it("answers a server request it does not support with method-not-found", async () => {
    const { client, first } = await twoServers();

    first.deliver({ jsonrpc: "2.0", id: 9, method: "sampling/createMessage", params: {} });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(first.sent.at(-1)).toEqual({
      jsonrpc: "2.0",
      id: 9,
      error: { code: -32601, message: "Method not found: sampling/createMessage" },
    });
    client.disconnect();
  });

  it("takes its abort listener off a long-lived signal once the request settles", async () => {
    const { client, first } = await twoServers();
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");

    const pending = client.request("tools/list", {}, controller.signal);
    first.deliver({ jsonrpc: "2.0", id: lastId(first), result: {} });
    await pending;

    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    client.disconnect();
  });
});
