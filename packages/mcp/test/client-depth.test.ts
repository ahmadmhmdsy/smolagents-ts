import { describe, expect, it } from "vitest";
import { MCPClient } from "../src/client.js";
import { MCPCapabilityError, MCPHttpStatusError, MCPListLimitError } from "../src/errors.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { StreamableHttpTransport } from "../src/transports/http.js";
import { FixtureTransport, type Fixture } from "./fixture-transport.js";
import { clientWithTransport, loadFixture, recordingLogger } from "./helpers.js";

/** The handshake reply a fixture uses when the test wants a specific capability set. */
function handshake(capabilities: Record<string, unknown>): Fixture {
  return {
    steps: [
      {
        expect: { method: "initialize" },
        reply: {
          result: {
            protocolVersion: "2025-11-25",
            capabilities,
            serverInfo: { name: "fixture-server", version: "1.0.0" },
          },
        },
      },
    ],
  };
}

/** A server that answers every tools/list with another page and never finishes. */
class EndlessPagesTransport implements MCPTransport {
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
    if (!("id" in message) || !("method" in message)) return Promise.resolve();
    const id = message.id;
    queueMicrotask(() => {
      if (message.method === "initialize") {
        this.onmessage?.({
          jsonrpc: "2.0",
          id,
          result: { protocolVersion: "2025-11-25", capabilities: { tools: {} } },
        });
        return;
      }
      if (message.method === "tools/list") {
        this.onmessage?.({
          jsonrpc: "2.0",
          id,
          result: { tools: [], nextCursor: "another-page" },
        });
      }
    });
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }

  count(method: string): number {
    return this.sent.filter((message) => "method" in message && message.method === method).length;
  }
}

interface HttpCall {
  readonly method: string;
  readonly session: string | undefined;
}

/**
 * A fake Streamable HTTP endpoint for the session-recovery cases: it hands out a session id on
 * every initialize, and decides each tools/list by the session header it arrived with.
 */
function sessionServer(options: {
  readonly toolsStatus: (session: string | undefined) => number;
  readonly initializeSession?: (attempt: number) => string | undefined;
}): { fetch: (url: string, init: RequestInit) => Promise<Response>; calls: HttpCall[] } {
  const calls: HttpCall[] = [];
  let initializes = 0;
  return {
    calls,
    fetch: (_url, init) => {
      const body = JSON.parse(String(init.body)) as { method?: string; id?: unknown };
      const requestId = body.id;
      const headers = (init.headers ?? {}) as Record<string, string>;
      const method = body.method ?? "(response)";
      calls.push({ method, session: headers["mcp-session-id"] });
      if (method === "initialize") {
        initializes += 1;
        const session =
          options.initializeSession === undefined
            ? "session-" + String(initializes)
            : options.initializeSession(initializes);
        const response = jsonResponse(
          {
            jsonrpc: "2.0",
            id: requestId,
            result: {
              protocolVersion: "2025-11-25",
              capabilities: { tools: {} },
              serverInfo: { name: "http", version: "1" },
            },
          },
          session === undefined ? {} : { "mcp-session-id": session },
        );
        return Promise.resolve(response);
      }
      if (method === "notifications/initialized") {
        return Promise.resolve(new Response("", { status: 202 }));
      }
      if (method === "tools/list") {
        const status = options.toolsStatus(headers["mcp-session-id"]);
        if (status !== 200) return Promise.resolve(new Response("session lost", { status }));
        return Promise.resolve(
          jsonResponse({
            jsonrpc: "2.0",
            id: requestId,
            result: {
              tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object" } }],
            },
          }),
        );
      }
      return Promise.resolve(new Response("", { status: 202 }));
    },
  };
}

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function clientOverHttp(
  fetchImpl: (url: string, init: RequestInit) => Promise<Response>,
): Promise<MCPClient> {
  return MCPClient.create([{ url: "http://fixture.invalid/mcp" }], {
    transportFactory: () =>
      new StreamableHttpTransport({ url: "http://fixture.invalid/mcp", fetch: fetchImpl }),
  });
}

describe("MCPClient: the declared capabilities", () => {
  it("refuses tools/list when the server never declared the tools capability", async () => {
    const transport = new FixtureTransport(handshake({}));
    const client = await clientWithTransport(transport);

    await expect(client.getTools()).rejects.toThrow(MCPCapabilityError);
    await expect(client.getTools()).rejects.toThrow(/tools/);
    await expect(client.getTools()).rejects.toThrow(/fixture\.invalid/);
    expect(transport.methods()).not.toContain("tools/list");
    client.disconnect();
  });

  it("lists tools when the capability is declared, and only then", async () => {
    const transport = new FixtureTransport(loadFixture("tools-list"));
    const client = await clientWithTransport(transport);

    expect((await client.getTools()).map((entry) => entry.name)).toEqual(["echo", "add"]);
    client.disconnect();
  });
});

describe("MCPClient: bounded aggregation", () => {
  it("stops a listing that never finishes, naming the method and the bound", async () => {
    const transport = new EndlessPagesTransport();
    const client = await clientWithTransport(transport, { maxListPages: 3 });

    const error = await client.getTools().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MCPListLimitError);
    expect((error as Error).message).toMatch(/tools\/list/);
    expect((error as Error).message).toMatch(/3/);
    expect(transport.count("tools/list")).toBe(3);
    client.disconnect();
  });
});

describe("MCPClient: the HTTP session lifecycle", () => {
  it("carries the status on a non-2xx answer", async () => {
    const transport = new StreamableHttpTransport({
      url: "http://fixture.invalid/mcp",
      fetch: () => Promise.resolve(new Response("gone", { status: 404 })),
    });
    await transport.start();

    await expect(transport.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).rejects.toThrow(
      MCPHttpStatusError,
    );
    try {
      await transport.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
      throw new Error("the transport did not refuse the second 404");
    } catch (error) {
      expect(error).toBeInstanceOf(MCPHttpStatusError);
      expect((error as MCPHttpStatusError).status).toBe(404);
      expect((error as MCPHttpStatusError).method).toBe("tools/list");
    }
  });

  it("clears the session, re-handshakes and retries once when the server forgets it", async () => {
    const server = sessionServer({
      toolsStatus: (session) => (session === "session-2" ? 200 : 404),
    });
    const client = await clientOverHttp(server.fetch);

    const tools = await client.getTools();
    expect(tools.map((entry) => entry.name)).toEqual(["echo"]);
    expect(server.calls.filter((call) => call.method === "initialize")).toHaveLength(2);
    const retried = server.calls.filter((call) => call.method === "tools/list").at(-1);
    expect(retried?.session).toBe("session-2");
    client.disconnect();
  });

  it("propagates a second 404 instead of re-handshaking forever", async () => {
    const server = sessionServer({ toolsStatus: () => 404 });
    const client = await clientOverHttp(server.fetch);

    await expect(client.getTools()).rejects.toThrow(MCPHttpStatusError);
    expect(server.calls.filter((call) => call.method === "initialize")).toHaveLength(2);
    client.disconnect();
  });

  it("does not re-handshake when no session id was ever issued", async () => {
    const server = sessionServer({
      toolsStatus: () => 404,
      initializeSession: () => undefined,
    });
    const client = await clientOverHttp(server.fetch);

    await expect(client.getTools()).rejects.toThrow(MCPHttpStatusError);
    expect(server.calls.filter((call) => call.method === "initialize")).toHaveLength(1);
    client.disconnect();
  });

  it("logs the recovery through the injected logger", async () => {
    const logger = recordingLogger();
    const server = sessionServer({
      toolsStatus: (session) => (session === "session-2" ? 200 : 404),
    });
    const client = await MCPClient.create([{ url: "http://fixture.invalid/mcp" }], {
      logger,
      transportFactory: () =>
        new StreamableHttpTransport({ url: "http://fixture.invalid/mcp", fetch: server.fetch }),
    });

    await client.getTools();
    expect(logger.messages.some((message) => message.includes("session"))).toBe(true);
    client.disconnect();
  });
});
