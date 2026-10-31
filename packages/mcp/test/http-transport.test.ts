import { describe, expect, it } from "vitest";
import { StreamableHttpTransport, type FetchLike } from "../src/transports/http.js";
import { MCPClosedError, MCPHttpStatusError, MCPTransportError } from "../src/errors.js";
import type { MCPMessage } from "../src/json-rpc.js";

interface RecordedCall {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(response: Response | (() => Response)): {
  fetch: FetchLike;
  calls: RecordedCall[];
} {
  const calls: RecordedCall[] = [];
  return {
    calls,
    fetch: (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(typeof response === "function" ? response() : response);
    },
  };
}

describe("the HTTP transport's limits", () => {
  const ping: MCPMessage = { jsonrpc: "2.0", id: 1, method: "ping" };

  function chunks(...parts: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        for (const part of parts) controller.enqueue(new TextEncoder().encode(part));
        controller.close();
      },
    });
  }

  it("refuses an Authorization header over plain http to a remote host", () => {
    const headers = { Authorization: "Bearer x" };

    expect(() => new StreamableHttpTransport({ url: "http://remote.test/mcp", headers })).toThrow(
      /plain http/,
    );
    for (const url of [
      "https://remote.test/mcp",
      "http://localhost:3000/mcp",
      "http://127.0.0.1:3000/mcp",
      "http://[::1]:3000/mcp",
    ]) {
      expect(() => new StreamableHttpTransport({ url, headers })).not.toThrow();
    }
    expect(
      () =>
        new StreamableHttpTransport({
          url: "http://remote.test/mcp",
          headers,
          allowInsecureAuthorization: true,
        }),
    ).not.toThrow();
  });

  it("does not let a custom header replace the session or the protocol version", async () => {
    const { fetch, calls } = fakeFetch(() => jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }));
    const transport = new StreamableHttpTransport({
      url: "https://remote.test/mcp",
      fetch,
      headers: { "mcp-protocol-version": "forged", "x-trace": "kept" },
    });
    await transport.start();
    await transport.send(ping);

    const sent = calls[0]?.init.headers as Record<string, string>;
    expect(sent["mcp-protocol-version"]).not.toBe("forged");
    expect(sent["x-trace"]).toBe("kept");
  });

  it("refuses a JSON body over the cap", async () => {
    const body = new Response(chunks("x".repeat(64)), {
      headers: { "content-type": "application/json" },
    });
    const { fetch } = fakeFetch(body);
    const transport = new StreamableHttpTransport({
      url: "https://remote.test/mcp",
      fetch,
      maxResponseBytes: 16,
    });
    await transport.start();

    await expect(transport.send(ping)).rejects.toThrow(/more than 16 bytes/);
  });

  it("refuses a stream event over the cap, and counts each event alone", async () => {
    const small = 'data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n';
    const stream = (...parts: string[]): Response =>
      new Response(chunks(...parts), { headers: { "content-type": "text/event-stream" } });
    const open = async (response: Response): Promise<StreamableHttpTransport> => {
      const transport = new StreamableHttpTransport({
        url: "https://remote.test/mcp",
        fetch: fakeFetch(response).fetch,
        maxResponseBytes: 64,
      });
      await transport.start();
      return transport;
    };

    await expect((await open(stream(small, small, small, small))).send(ping)).resolves.toBeUndefined();
    await expect((await open(stream("data: " + "x".repeat(32), "y".repeat(64)))).send(ping)).rejects.toThrow(
      /more than 64 bytes/,
    );
  });

  it("aborts after the silence budget, and a chunk restarts it", async () => {
    const fetchImpl: FetchLike = (_url, init) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          reject(new Error("aborted"));
        });
      });
    const silent = new StreamableHttpTransport({
      url: "https://remote.test/mcp",
      fetch: fetchImpl,
      timeoutMs: 5,
    });
    await silent.start();
    await expect(silent.send(ping)).rejects.toThrow(MCPTransportError);
    await expect(silent.send(ping)).rejects.toThrow(/silent for 5 ms/);

    let pushes = 0;
    const slow = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await new Promise((resolve) => setTimeout(resolve, 20));
        pushes += 1;
        if (pushes === 4) controller.close();
        else controller.enqueue(new TextEncoder().encode(": ping\n\n"));
      },
    });
    const talking = new StreamableHttpTransport({
      url: "https://remote.test/mcp",
      fetch: fakeFetch(
        new Response(slow, { headers: { "content-type": "text/event-stream" } }),
      ).fetch,
      timeoutMs: 50,
    });
    await talking.start();
    await expect(talking.send(ping)).resolves.toBeUndefined();
  });
});

function jsonResponse(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json", ...headers },
  });
}

function eventStreamResponse(chunks: string[]): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

const REQUEST: MCPMessage = { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} };

describe("the Streamable HTTP transport", () => {
  it("POSTs with the accept, content-type and protocol headers and delivers a JSON body", async () => {
    const delivered: MCPMessage[] = [];
    const fake = fakeFetch(jsonResponse({ jsonrpc: "2.0", id: 1, result: { tools: [] } }));
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    transport.onmessage = (message) => delivered.push(message);
    transport.setProtocolVersion?.("2025-06-18");
    await transport.start();
    await transport.send(REQUEST);

    expect(fake.calls).toHaveLength(1);
    const call = fake.calls[0]!;
    expect(call.url).toBe("http://x/mcp");
    expect(call.init.method).toBe("POST");
    expect(call.init.headers).toMatchObject({
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2025-06-18",
    });
    expect(JSON.parse(String(call.init.body))).toEqual(REQUEST);
    expect(delivered).toEqual([{ jsonrpc: "2.0", id: 1, result: { tools: [] } }]);
  });

  it("parses an event-stream body, delivering a notification then the response", async () => {
    const delivered: MCPMessage[] = [];
    const fake = fakeFetch(() =>
      eventStreamResponse([
        'event: message\ndata: {"jsonrpc":"2.0","method":"notifications/message","params":{"level":"info"}}\n\n',
        'data: {"jsonrpc":"2.0","id":1,\n',
        'data: "result":{"tools":[]}}\n\n',
      ]),
    );
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    transport.onmessage = (message) => delivered.push(message);
    await transport.start();
    await transport.send(REQUEST);

    expect(delivered).toEqual([
      { jsonrpc: "2.0", method: "notifications/message", params: { level: "info" } },
      { jsonrpc: "2.0", id: 1, result: { tools: [] } },
    ]);
  });

  it("captures the session id header and echoes it on later requests", async () => {
    let call = 0;
    const fake = fakeFetch(() => {
      call += 1;
      return call === 1
        ? jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, { "mcp-session-id": "session-42" })
        : jsonResponse({ jsonrpc: "2.0", id: 2, result: {} });
    });
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    await transport.start();
    await transport.send({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(transport.sessionId).toBe("session-42");
    await transport.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });

    expect(fake.calls[1]!.init.headers).toMatchObject({ "mcp-session-id": "session-42" });
  });

  it("sends a DELETE on close only when a session id arrived", async () => {
    const withSession = fakeFetch(
      jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }, { "mcp-session-id": "s" }),
    );
    const first = new StreamableHttpTransport({ url: "http://x/mcp", fetch: withSession.fetch });
    await first.start();
    await first.send({ jsonrpc: "2.0", id: 1, method: "initialize" });
    await first.close();
    expect(withSession.calls.at(-1)?.init.method).toBe("DELETE");

    const without = fakeFetch(jsonResponse({ jsonrpc: "2.0", id: 1, result: {} }));
    const second = new StreamableHttpTransport({ url: "http://x/mcp", fetch: without.fetch });
    await second.start();
    await second.send({ jsonrpc: "2.0", id: 1, method: "initialize" });
    await second.close();
    expect(without.calls.every((call) => call.init.method === "POST")).toBe(true);
  });

  it("turns a non-2xx response into an error carrying the status and the body", async () => {
    const fake = fakeFetch(
      () =>
        new Response("the server exploded", {
          status: 500,
          headers: { "content-type": "text/plain" },
        }),
    );
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    await transport.start();
    await expect(transport.send(REQUEST)).rejects.toThrow(MCPTransportError);
    await expect(transport.send(REQUEST)).rejects.toThrow(/HTTP 500.*server exploded/s);

    // The typed status is what lets a client tell a lost session (404) from a real failure.
    const lost = fakeFetch(() => new Response("session lost", { status: 404 }));
    const second = new StreamableHttpTransport({ url: "http://x/mcp", fetch: lost.fetch });
    await second.start();
    const error = await second.send(REQUEST).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MCPHttpStatusError);
    expect((error as MCPHttpStatusError).status).toBe(404);
    expect((error as MCPHttpStatusError).method).toBe("tools/list");
  });

  it("refuses a send after close and a body that is not JSON", async () => {
    const notJson = fakeFetch(new Response("{not json", { status: 200 }));
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: notJson.fetch });
    await transport.start();
    await expect(transport.send(REQUEST)).rejects.toThrow(/not JSON/);
    await transport.close();
    await expect(transport.send(REQUEST)).rejects.toThrow(MCPClosedError);
    await expect(transport.send(REQUEST)).rejects.toThrow(/closed/);
  });

  it("reports a nonzero-ok 202 with an empty body quietly", async () => {
    const fake = fakeFetch(new Response("", { status: 202 }));
    const delivered: MCPMessage[] = [];
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    transport.onmessage = (message) => delivered.push(message);
    await transport.start();
    await transport.send({ jsonrpc: "2.0", method: "notifications/initialized" });
    expect(delivered).toEqual([]);
  });

  it("routes a message that arrives after close to onerror, not out of the read loop", async () => {
    let controller!: ReadableStreamDefaultController<Uint8Array>;
    const stream = new ReadableStream<Uint8Array>({
      start(value) {
        controller = value;
      },
    });
    const response = new Response(stream, {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
    const fake = fakeFetch(response);
    const transport = new StreamableHttpTransport({ url: "http://x/mcp", fetch: fake.fetch });
    const errors: Error[] = [];
    transport.onerror = (error) => errors.push(error);
    transport.onmessage = () => {
      throw new Error("the handler was too late");
    };
    await transport.start();

    // The POST is in flight (the reader is parked on its first read), then the client
    // disconnects, then the server's response arrives.
    const sending = transport.send(REQUEST);
    await transport.close();
    controller.enqueue(new TextEncoder().encode('data: {"jsonrpc":"2.0","id":1,"result":{}}\n\n'));
    controller.close();
    await sending;

    expect(errors.map((error) => error.message)).toEqual(["the handler was too late"]);
  });
});
