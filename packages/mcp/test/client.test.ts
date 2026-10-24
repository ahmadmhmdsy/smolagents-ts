import { describe, expect, it } from "vitest";
import { CLIENT_INFO, MCPClient, NOTIFICATION_HISTORY_LIMIT } from "../src/client.js";
import { MCPConnectionError, MCPParameterError, MCPProtocolError, MCPTimeoutError } from "../src/errors.js";
import { LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS } from "../src/parameters.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { FixtureTransport, type Fixture } from "./fixture-transport.js";
import { SilentTransport, clientWithTransport, loadFixture, recordingLogger } from "./helpers.js";

const serverReply = (version: string): Fixture => ({
  steps: [
    {
      expect: { method: "initialize" },
      reply: {
        result: {
          protocolVersion: version,
          capabilities: {},
          serverInfo: { name: "fixture", version: "1" },
        },
      },
    },
  ],
});

describe("MCPClient: the session and the protocol", () => {
  it("initializes with the latest revision, empty capabilities and this port's identity", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const client = await clientWithTransport(transport);

    expect(transport.sent[0]).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: "@smolagents-ts/mcp", version: CLIENT_INFO.version },
      },
    });
    expect(transport.sent[1]).toEqual({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(client.protocolVersion).toBe("2025-11-25");
    client.disconnect();
  });

  it("accepts each published revision", async () => {
    for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
      const transport = new FixtureTransport(serverReply(version));
      const client = await clientWithTransport(transport);
      expect(client.protocolVersion).toBe(version);
      client.disconnect();
    }
  });

  it("refuses a revision it does not speak, naming both sides, and closes the transport", async () => {
    const transport = new FixtureTransport(serverReply("1999-01-01"));
    await expect(clientWithTransport(transport)).rejects.toThrow(MCPProtocolError);
    expect(transport.closed).toBe(true);

    const second = new FixtureTransport(serverReply("1999-01-01"));
    await expect(clientWithTransport(second)).rejects.toThrow(
      /1999-01-01.*2025-11-25.*2025-03-26/s,
    );
    expect(second.closed).toBe(true);
  });

  it("drives initialize, tools/list and a tool call from the recorded transcript", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const client = await clientWithTransport(transport);
    const tools = await client.getTools();
    expect(tools.map((entry) => entry.name)).toEqual(["echo", "add"]);

    const echo = tools.find((entry) => entry.name === "echo");
    if (echo === undefined) throw new Error("the echo tool is missing");
    const result = await echo.execute({ text: "anything" }, context());

    expect(result).toBe("hi");
    expect(transport.methods()).toContain("tools/call");
    client.disconnect();
  });

  it("marks the tool list stale on tools/list_changed and refreshes on the next read", async () => {
    const fixture: Fixture = {
      steps: [
        { expect: { method: "initialize" }, reply: loadFixture("initialize").steps[0]!.reply },
        {
          expect: { method: "tools/list" },
          reply: {
            result: {
              tools: [
                { name: "echo", description: "Echo.", inputSchema: { type: "object" } },
              ],
            },
          },
        },
        {
          expect: { method: "tools/list" },
          reply: {
            result: {
              tools: [
                { name: "echo", description: "Echo.", inputSchema: { type: "object" } },
                { name: "add", description: "Add.", inputSchema: { type: "object" } },
              ],
            },
          },
        },
      ],
    };
    const transport = new FixtureTransport(fixture);
    const client = await clientWithTransport(transport);

    const listings = (): number =>
      transport.methods().filter((method) => method === "tools/list").length;

    expect((await client.getTools()).map((entry) => entry.name)).toEqual(["echo"]);

    // The server announces the change after the listing was cached.
    transport.notify("notifications/tools/list_changed");
    expect((await client.getTools()).map((entry) => entry.name)).toEqual(["echo", "add"]);
    expect(listings()).toBe(2);

    // The refreshed list is current, so a third read does not fetch again.
    expect((await client.getTools()).map((entry) => entry.name)).toEqual(["echo", "add"]);
    expect(listings()).toBe(2);
    expect(
      client.notifications.some(
        (message) => "method" in message && message.method === "notifications/tools/list_changed",
      ),
    ).toBe(true);
    client.disconnect();
  });

  it("logs any other notification through the injected logger", async () => {
    const logger = recordingLogger();
    const transport = new FixtureTransport(loadFixture("initialize"));
    const client = await clientWithTransport(transport, { logger });
    transport.notify("notifications/message", { level: "info" });
    expect(logger.messages.some((message) => message.includes("notifications/message"))).toBe(true);
    client.disconnect();
  });

  it("is quiet on a doubled disconnect and refuses a message after close", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const client = await clientWithTransport(transport);
    client.disconnect();
    expect(() => client.disconnect()).not.toThrow();

    await expect(
      client.request("tools/list", {}),
    ).rejects.toThrow(MCPConnectionError);
    await expect(client.request("tools/list", {})).rejects.toThrow(/closed/i);
  });

  it("refuses a message the transport delivers after the close", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const client = await clientWithTransport(transport);
    client.disconnect();
    const delivered = transport.onmessage;
    if (delivered === undefined) throw new Error("the client did not install a handler");
    expect(() => delivered({ jsonrpc: "2.0", id: 99, result: {} })).toThrow(/closed/i);
  });

  it("times out a request that is never answered, naming the method", async () => {
    const silent = new SilentTransport();
    await expect(
      MCPClient.create([{ url: "http://fixture.invalid/mcp" }], {
        requestTimeoutMs: 5,
        transportFactory: () => silent,
      }),
    ).rejects.toThrow(MCPTimeoutError);
    await expect(
      MCPClient.create([{ url: "http://fixture.invalid/mcp" }], {
        requestTimeoutMs: 5,
        transportFactory: () => new SilentTransport(),
      }),
    ).rejects.toThrow(/initialize.*timed out/s);
  });

  it("warns about the structuredOutput default through the logger, not the console", async () => {
    const logger = recordingLogger();
    const client = await clientWithTransport(new FixtureTransport(loadFixture("initialize")), {
      logger,
    });
    expect(logger.messages.some((message) => message.includes("structuredOutput"))).toBe(true);
    client.disconnect();
  });
});

describe("MCPClient: the parameter refusals", () => {
  it("refuses an unknown transport string, naming the supported set", async () => {
    await expect(
      MCPClient.create([{ url: "http://x/mcp", transport: "websocket" as never }]),
    ).rejects.toThrow(MCPParameterError);
    await expect(
      MCPClient.create([{ url: "http://x/mcp", transport: "websocket" as never }]),
    ).rejects.toThrow(/streamable-http/);
  });

  it("refuses sse by name, calling it deprecated and naming Streamable HTTP", async () => {
    await expect(MCPClient.create([{ url: "http://x/mcp", transport: "sse" }])).rejects.toThrow(
      /SSE/,
    );
    await expect(MCPClient.create([{ url: "http://x/mcp", transport: "sse" }])).rejects.toThrow(
      /SSE.*deprecated/s,
    );
    await expect(MCPClient.create([{ url: "http://x/mcp", transport: "sse" }])).rejects.toThrow(
      /Streamable HTTP/,
    );
  });

  it("refuses a stdio parameter from the root entry, sending the caller to the subpath", async () => {
    await expect(MCPClient.create([{ command: "npx" }])).rejects.toThrow(MCPParameterError);
    // The message names real exports of that subpath, not a symbol the package lacks.
    await expect(MCPClient.create([{ command: "npx" }])).rejects.toThrow(
      /@smolagents-ts\/mcp\/stdio/,
    );
    await expect(MCPClient.create([{ command: "npx" }])).rejects.toThrow(/createStdioTransport/);
    await expect(MCPClient.create([{ command: "npx" }])).rejects.toThrow(/stdioClient/);
  });
});

describe("MCPClient: the notification history", () => {
  it("keeps the newest messages and warns once when it first drops one", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const logger = recordingLogger();
    const client = await clientWithTransport(transport, { logger });

    const total = NOTIFICATION_HISTORY_LIMIT + 5;
    for (let index = 0; index < total; index += 1) {
      transport.notify("notifications/message", { index });
    }

    const kept = client.notifications.map(
      (message) => (message as { params?: { index?: number } }).params?.index,
    );
    expect(kept).toHaveLength(NOTIFICATION_HISTORY_LIMIT);
    expect(kept[0]).toBe(5);
    expect(kept.at(-1)).toBe(total - 1);
    expect(logger.messages.filter((m) => m.includes("notification history is capped"))).toHaveLength(1);
    client.disconnect();
  });

  it("does not truncate a server that stays under the cap", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const logger = recordingLogger();
    const client = await clientWithTransport(transport, { logger });
    transport.notify("notifications/message", { index: 1 });
    expect(client.notifications).toHaveLength(1);
    expect(logger.messages.some((m) => m.includes("notification history is capped"))).toBe(false);
    client.disconnect();
  });
});

describe("MCPClient: a transport that fails", () => {
  it("rejects the connection when the transport errors while the handshake is in flight", async () => {
    const transport = new FailingTransport(new Error("spawn npx ENOENT"));
    await expect(clientWithTransport(transport)).rejects.toThrow(/ENOENT/);
    expect(transport.closed).toBe(true);
  });

  it("rejects an in-flight request when the peer goes away, and refuses the next one at once", async () => {
    const transport = new PeerGoneTransport();
    const client = await clientWithTransport(transport);

    await expect(client.getTools()).rejects.toThrow(MCPConnectionError);
    await expect(client.getTools()).rejects.toThrow(/fixture\.invalid/);
    client.disconnect();
  });
});

/**
 * A transport whose start() succeeds and whose first send reports the failure, which is
 * what a spawn that cannot find its command does: the child object exists, and the
 * error arrives on a later tick.
 */
class FailingTransport implements MCPTransport {
  closed = false;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  private readonly failure: Error;

  constructor(failure: Error) {
    this.failure = failure;
  }

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(): Promise<void> {
    queueMicrotask(() => this.onerror?.(this.failure));
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    this.onclose?.();
    return Promise.resolve();
  }
}

/** A transport that answers the handshake and then reports the peer gone on the next request. */
class PeerGoneTransport implements MCPTransport {
  closed = false;
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    const request = message as { id?: string | number; method?: string };
    if (request.method === "initialize") {
      this.onmessage?.({
        jsonrpc: "2.0",
        id: request.id as string | number,
        result: {
          protocolVersion: LATEST_PROTOCOL_VERSION,
          capabilities: { tools: {} },
          serverInfo: { name: "fixture", version: "1" },
        },
      } as MCPMessage);
      return Promise.resolve();
    }
    if (request.id !== undefined) this.onclose?.();
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

/** The ToolContext an agent would pass. Only the signal matters to this package. */
function context(): {
  signal: AbortSignal;
  fetch: typeof globalThis.fetch;
  callId: string;
  stepIndex: number;
  logger: ReturnType<typeof recordingLogger>;
} {
  return {
    signal: new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: recordingLogger(),
  };
}
