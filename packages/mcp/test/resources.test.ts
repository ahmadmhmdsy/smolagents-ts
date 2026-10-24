import { describe, expect, it } from "vitest";
import { MCPCapabilityError, MCPClient, MCPConnectionError } from "../src/index.js";
import type { FixtureStep } from "./fixture-transport.js";
import { FixtureTransport } from "./fixture-transport.js";
import { clientWithTransport } from "./helpers.js";

const ALL_CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {},
  completions: {},
} as const;

/** A fixture whose handshake declares every capability, followed by the steps given. */
function catalog(
  steps: readonly FixtureStep[],
  capabilities: Record<string, unknown> = ALL_CAPABILITIES,
): FixtureTransport {
  return new FixtureTransport({
    steps: [
      {
        expect: { method: "initialize" },
        reply: {
          result: {
            protocolVersion: "2025-11-25",
            capabilities,
            serverInfo: { name: "catalog", version: "1" },
          },
        },
      },
      ...steps,
    ],
  });
}

const RESOURCE = {
  uri: "file:///notes/a.txt",
  name: "a.txt",
  description: "The first note.",
  mimeType: "text/plain",
};

describe("MCPClient: resources", () => {
  it("walks both pages of a resource listing and returns the typed shapes", async () => {
    const transport = catalog([
      {
        expect: { method: "resources/list" },
        reply: {
          result: {
            resources: [RESOURCE],
            nextCursor: "page-2",
          },
        },
      },
      {
        expect: { method: "resources/list" },
        reply: {
          result: {
            resources: [{ uri: "file:///notes/b.txt", name: "b.txt" }],
          },
        },
      },
    ]);
    const client = await clientWithTransport(transport);

    const resources = await client.listResources();
    expect(resources).toEqual([
      RESOURCE,
      { uri: "file:///notes/b.txt", name: "b.txt" },
    ]);
    expect(transport.methods().filter((method) => method === "resources/list")).toHaveLength(2);
    const second = transport.sent.filter(
      (message) => "method" in message && message.method === "resources/list",
    )[1] as { params?: Record<string, unknown> };
    expect(second.params).toEqual({ cursor: "page-2" });
    client.disconnect();
  });

  it("reads a resource's text and blob contents", async () => {
    const transport = catalog([
      {
        expect: { method: "resources/read" },
        reply: {
          result: {
            contents: [
              { uri: "file:///a.txt", mimeType: "text/plain", text: "hello" },
              { uri: "file:///b.png", mimeType: "image/png", blob: "aGVsbG8=" },
            ],
          },
        },
      },
    ]);
    const client = await clientWithTransport(transport);

    const contents = await client.readResource("file:///a.txt");
    expect(contents).toEqual([
      { uri: "file:///a.txt", mimeType: "text/plain", text: "hello" },
      { uri: "file:///b.png", mimeType: "image/png", blob: "aGVsbG8=" },
    ]);
    const sent = transport.sent.filter(
      (message) => "method" in message && message.method === "resources/read",
    )[0] as { params?: Record<string, unknown> };
    expect(sent.params).toEqual({ uri: "file:///a.txt" });
    client.disconnect();
  });

  it("asks twice for two reads: nothing is cached", async () => {
    const readStep: FixtureStep = {
      expect: { method: "resources/read" },
      reply: { result: { contents: [{ uri: "file:///a.txt", text: "hello" }] } },
    };
    const transport = catalog([readStep, readStep]);
    const client = await clientWithTransport(transport);

    await client.readResource("file:///a.txt");
    await client.readResource("file:///a.txt");
    expect(transport.methods().filter((method) => method === "resources/read")).toHaveLength(2);
    client.disconnect();
  });
});

describe("MCPClient: prompts", () => {
  it("lists a prompt with its arguments and fetches it with the caller's values", async () => {
    const transport = catalog([
      {
        expect: { method: "prompts/list" },
        reply: {
          result: {
            prompts: [
              {
                name: "summarise",
                description: "Summarise a note.",
                arguments: [{ name: "tone", description: "How to sound.", required: true }],
              },
            ],
          },
        },
      },
      {
        expect: { method: "prompts/get" },
        reply: {
          result: {
            description: "Summarise a note.",
            messages: [
              { role: "user", content: { type: "text", text: "Summarise this in a calm tone." } },
            ],
          },
        },
      },
    ]);
    const client = await clientWithTransport(transport);

    const prompts = await client.listPrompts();
    expect(prompts).toEqual([
      {
        name: "summarise",
        description: "Summarise a note.",
        arguments: [{ name: "tone", description: "How to sound.", required: true }],
      },
    ]);
    const result = await client.getPrompt("summarise", { tone: "calm" });
    expect(result.messages).toEqual([
      { role: "user", content: { type: "text", text: "Summarise this in a calm tone." } },
    ]);
    const sent = transport.sent.filter(
      (message) => "method" in message && message.method === "prompts/get",
    )[0] as { params?: Record<string, unknown> };
    expect(sent.params).toEqual({ name: "summarise", arguments: { tone: "calm" } });
    client.disconnect();
  });
});

describe("MCPClient: completions", () => {
  it("returns the server's completion values and its total", async () => {
    const transport = catalog([
      {
        expect: { method: "completion/complete" },
        reply: {
          result: { completion: { values: ["calm", "cheerful"], total: 2, hasMore: false } },
        },
      },
    ]);
    const client = await clientWithTransport(transport);

    const completion = await client.complete({
      ref: { type: "ref/prompt", name: "summarise" },
      argument: { name: "tone", value: "c" },
    });
    expect(completion).toEqual({ values: ["calm", "cheerful"], total: 2, hasMore: false });
    client.disconnect();
  });
});

describe("MCPClient: each verb is gated on its own capability", () => {
  it("refuses resources, prompts and completions on a server that declared only tools", async () => {
    const verbs: readonly [string, (client: MCPClient) => Promise<unknown>][] = [
      ["resources", (client) => client.listResources()],
      ["resources", (client) => client.readResource("file:///a.txt")],
      ["prompts", (client) => client.listPrompts()],
      ["prompts", (client) => client.getPrompt("summarise")],
      [
        "completions",
        (client) =>
          client.complete({
            ref: { type: "ref/prompt", name: "summarise" },
            argument: { name: "tone", value: "c" },
          }),
      ],
    ];
    for (const [capability, call] of verbs) {
      const transport = catalog([], { tools: {} });
      const client = await clientWithTransport(transport);
      const error = await call(client).catch((caught: unknown) => caught);
      expect(error).toBeInstanceOf(MCPCapabilityError);
      expect((error as MCPCapabilityError).capability).toBe(capability);
      expect(transport.methods()).toEqual(["initialize", "notifications/initialized"]);
      client.disconnect();
    }
  });
});

describe("MCPClient: choosing a server", () => {
  it("sends a read to the connection the caller named", async () => {
    const first = catalog([
      {
        expect: { method: "resources/list" },
        reply: { result: { resources: [{ uri: "file:///first.txt", name: "first.txt" }] } },
      },
    ]);
    const second = catalog([
      {
        expect: { method: "resources/list" },
        reply: { result: { resources: [{ uri: "file:///second.txt", name: "second.txt" }] } },
      },
    ]);
    const transports: Record<string, FixtureTransport> = {
      "http://first.invalid/mcp": first,
      "http://second.invalid/mcp": second,
    };
    const client = await MCPClient.create(
      [
        { url: "http://first.invalid/mcp" },
        { url: "http://second.invalid/mcp" },
      ],
      {
        transportFactory: (parameters) =>
          transports[(parameters as { url: string }).url] as FixtureTransport,
      },
    );

    const resources = await client.listResources({ server: "http://second.invalid/mcp" });
    expect(resources).toEqual([{ uri: "file:///second.txt", name: "second.txt" }]);
    expect(first.methods()).toEqual(["initialize", "notifications/initialized"]);
    expect(second.methods()).toEqual([
      "initialize",
      "notifications/initialized",
      "resources/list",
    ]);

    await expect(client.listResources({ server: "http://absent.invalid/mcp" })).rejects.toThrow(
      MCPConnectionError,
    );
    client.disconnect();
  });
});
