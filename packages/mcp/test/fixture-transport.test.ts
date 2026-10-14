import { describe, expect, it } from "vitest";
import { FixtureTransport } from "./fixture-transport.js";
import { clientWithTransport, loadFixture } from "./helpers.js";

describe("the transport seam and the recorded fixture", () => {
  it("replays a two-page tools/list and records the sends in order", async () => {
    const transport = new FixtureTransport(loadFixture("tools-list"));
    const client = await clientWithTransport(transport);
    const tools = await client.getTools();

    expect(tools.map((entry) => entry.name)).toEqual(["echo", "add"]);
    expect(transport.methods()).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/list",
      "tools/list",
    ]);
    client.disconnect();
  });

  it("sends a second tools/list carrying the first page's cursor", async () => {
    const transport = new FixtureTransport(loadFixture("tools-list"));
    const client = await clientWithTransport(transport);
    await client.getTools();

    const second = transport.sent.filter(
      (message) => "method" in message && message.method === "tools/list",
    );
    expect(second[0]).toMatchObject({ params: {} });
    expect(second[1]).toMatchObject({ params: { cursor: "page-2" } });
    client.disconnect();
  });

  it("copies the reply id from the request, so a fixture carries none", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    const client = await clientWithTransport(transport);
    const request = transport.sent[0];
    expect(request).toBeDefined();
    if (request === undefined || !("id" in request)) throw new Error("no request was recorded");
    expect(client.protocolVersion).toBe("2025-11-25");
    client.disconnect();
  });

  it("fails an unmatched request with the method named", async () => {
    const transport = new FixtureTransport({
      steps: [{ expect: { method: "tools/list" }, reply: { result: { tools: [] } } }],
    });
    await transport.start();
    await expect(transport.send({ jsonrpc: "2.0", id: 1, method: "tools/call" })).rejects.toThrow(
      /expected tools\/list but the client sent tools\/call/,
    );
  });

  it("fails a tool call whose name does not match, naming both", async () => {
    const transport = new FixtureTransport({
      steps: [
        {
          expect: { method: "tools/call", name: "echo" },
          reply: { result: { content: [{ type: "text", text: "hi" }] } },
        },
      ],
    });
    await transport.start();
    await expect(
      transport.send({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "wrong" },
      }),
    ).rejects.toThrow(/expected the tool echo but the client called wrong/);
  });

  it("reports a transcript shorter than the conversation", async () => {
    const transport = new FixtureTransport(loadFixture("initialize"));
    await transport.start();
    await transport.send({ jsonrpc: "2.0", id: 1, method: "initialize" });
    await expect(transport.send({ jsonrpc: "2.0", id: 2, method: "tools/list" })).rejects.toThrow(
      /no steps left for tools\/list/,
    );
  });
});
