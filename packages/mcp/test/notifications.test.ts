import { describe, expect, it } from "vitest";
import type { ToolContext } from "@smolagents-ts/core";
import type { MCPNotification } from "../src/index.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { FixtureTransport } from "./fixture-transport.js";
import { clientWithTransport, recordingLogger } from "./helpers.js";

/** The ToolContext an agent would pass, with the progress sink under test. */
function context(onProgress?: (progress: unknown) => void): ToolContext {
  return {
    signal: new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: recordingLogger(),
    ...(onProgress === undefined ? {} : { onProgress }),
  };
}

/** A transport that answers the handshake and a listing, and reports progress on each call. */
class ProgressTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  private calls = 0;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    this.sent.push(message);
    if (!("method" in message) || !("id" in message)) return Promise.resolve();
    const id = message.id;
    queueMicrotask(() => {
      if (message.method === "initialize") {
        this.reply(id, {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "progress", version: "1" },
        });
        return;
      }
      if (message.method === "tools/list") {
        this.reply(id, {
          tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object" } }],
        });
        return;
      }
      if (message.method === "tools/call") {
        this.calls += 1;
        const params = message.params as Record<string, unknown> | undefined;
        const meta = params?.["_meta"] as Record<string, unknown> | undefined;
        const progressToken = meta?.["progressToken"];
        this.notify("notifications/progress", { progressToken, progress: 0.25 });
        this.notify("notifications/progress", { progressToken, progress: 0.75, total: 1 });
        this.reply(id, { content: [{ type: "text", text: "done" }] });
      }
    });
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }

  /** How many tools/call messages reached this transport. */
  get callCount(): number {
    return this.calls;
  }

  notify(method: string, params: Record<string, unknown>): void {
    this.onmessage?.({ jsonrpc: "2.0", method, params });
  }

  private reply(id: string | number, result: Record<string, unknown>): void {
    this.onmessage?.({ jsonrpc: "2.0", id, result });
  }
}

/** A transport that answers the handshake and leaves every tools/call pending. */
class ManualTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    this.sent.push(message);
    if (!("method" in message) || !("id" in message)) return Promise.resolve();
    const id = message.id;
    if (message.method === "initialize") {
      queueMicrotask(() => {
        this.onmessage?.({
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: { tools: {} },
            serverInfo: { name: "manual", version: "1" },
          },
        });
      });
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

  requestId(method: string): string | number {
    const found = this.sent.find(
      (message) => "method" in message && message.method === method,
    ) as { id: string | number };
    return found.id;
  }
}

describe("MCPClient: progress", () => {
  it("puts a token on tools/call and forwards the server's progress to the call's sink", async () => {
    const transport = new ProgressTransport();
    const client = await clientWithTransport(transport);
    const tools = await client.getTools();
    const progress: unknown[] = [];

    const result = await tools[0]!.execute(
      { text: "hello" },
      context((update) => progress.push(update)),
    );

    expect(result).toBe("done");
    expect(progress).toEqual([{ progress: 0.25 }, { progress: 0.75, total: 1 }]);
    const call = transport.sent.find(
      (message) => "method" in message && message.method === "tools/call",
    ) as { params?: Record<string, unknown> };
    const meta = call.params?.["_meta"] as Record<string, unknown> | undefined;
    expect(meta?.["progressToken"]).toBeDefined();
    client.disconnect();
  });

  it("reaches a client-wide listener as a typed notification, and an unsubscribe stops it", async () => {
    const transport = new ProgressTransport();
    const seen: MCPNotification[] = [];
    const client = await clientWithTransport(transport, {
      onNotification: (notification) => seen.push(notification),
    });
    const tools = await client.getTools();

    await tools[0]!.execute(
      { text: "one" },
      context(() => {
        // The sink itself is asserted elsewhere; here it only makes the call ask for progress.
      }),
    );
    expect(seen.filter((entry) => entry.type === "progress")).toHaveLength(2);
    const first = seen.find((entry) => entry.type === "progress");
    expect(first).toMatchObject({ type: "progress", progress: 0.25 });

    const later: MCPNotification[] = [];
    const off = client.onNotification((notification) => later.push(notification));
    off();
    await tools[0]!.execute({ text: "two" }, context());
    expect(later).toEqual([]);
    expect(transport.callCount).toBe(2);
    client.disconnect();
  });

  it("sends notifications/cancelled with the request id and rejects when the caller aborts", async () => {
    const transport = new ManualTransport();
    const client = await clientWithTransport(transport);
    const controller = new AbortController();
    const pending = client.request(
      "tools/call",
      { name: "slow", arguments: {} },
      controller.signal,
    );

    controller.abort();
    await expect(pending).rejects.toThrow(/aborted/);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const call = transport.sent.find(
      (message) => "method" in message && message.method === "tools/call",
    ) as { id: string | number };
    const cancelled = transport.sent.find(
      (message) => "method" in message && message.method === "notifications/cancelled",
    ) as { params?: Record<string, unknown> };
    expect(cancelled).toBeDefined();
    expect(cancelled.params?.["requestId"]).toBe(call.id);
    client.disconnect();
  });

  it("keeps one call's progress away from another call's token", async () => {
    const transport = new ManualTransport();
    const client = await clientWithTransport(transport);
    const first: unknown[] = [];
    const second: unknown[] = [];

    const a = client.request("tools/call", { name: "echo", arguments: {} }, undefined, undefined, {
      progressToken: "token-a",
      onProgress: (update) => first.push(update),
    });
    const b = client.request("tools/call", { name: "echo", arguments: {} }, undefined, undefined, {
      progressToken: "token-b",
      onProgress: (update) => second.push(update),
    });

    transport.deliver({
      jsonrpc: "2.0",
      method: "notifications/progress",
      params: { progressToken: "token-a", progress: 0.5 },
    });
    expect(first).toEqual([{ progress: 0.5 }]);
    expect(second).toEqual([]);

    transport.deliver({
      jsonrpc: "2.0",
      id: transport.requestId("tools/call"),
      result: { content: [{ type: "text", text: "a" }] },
    });
    await a;
    transport.deliver({
      jsonrpc: "2.0",
      id: (transport.sent.filter(
        (message) => "method" in message && message.method === "tools/call",
      )[1] as { id: string | number }).id,
      result: { content: [{ type: "text", text: "b" }] },
    });
    await b;
    client.disconnect();
  });
});

describe("MCPClient: typed notifications", () => {
  it("delivers a tools/list_changed as a typed notification and still marks the list stale", async () => {
    const transport = new FixtureTransport({
      steps: [
        {
          expect: { method: "initialize" },
          reply: {
            result: {
              protocolVersion: "2025-11-25",
              capabilities: { tools: {} },
              serverInfo: { name: "fixture", version: "1" },
            },
          },
        },
        {
          expect: { method: "tools/list" },
          reply: {
            result: {
              tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object" } }],
            },
          },
        },
        {
          expect: { method: "tools/list" },
          reply: {
            result: {
              tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object" } }],
            },
          },
        },
      ],
    });
    const client = await clientWithTransport(transport);
    const seen: MCPNotification[] = [];
    client.onNotification((notification) => seen.push(notification));

    await client.getTools();
    transport.notify("notifications/tools/list_changed");
    expect(seen).toEqual([{ type: "toolsListChanged" }]);

    await client.getTools();
    expect(transport.methods().filter((method) => method === "tools/list")).toHaveLength(2);
    client.disconnect();
  });
});
