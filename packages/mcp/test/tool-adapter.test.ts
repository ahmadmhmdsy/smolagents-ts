import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { ToolContext } from "@smolagents-ts/core";
import { adaptTools, assertNoCollisions, sanitizeToolName, type MCPTool } from "../src/tool-adapter.js";
import { MCPToolCollisionError, MCPToolError, MCPConnectionError } from "../src/errors.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { FixtureTransport } from "./fixture-transport.js";
import { clientWithTransport, loadFixture, recordingLogger } from "./helpers.js";

/** Answers each tools/call with a canned result, and records the request. */
class ScriptedTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  constructor(
    private readonly results: Readonly<Record<string, Record<string, unknown>>> = {},
    private readonly fail = false,
  ) {}

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    if (!("method" in message) || !("id" in message)) return Promise.resolve();
    this.sent.push(message);
    if (this.fail) return Promise.reject(new Error("the pipe is gone"));
    const name = String((message.params as { name?: unknown } | undefined)?.name);
    const result = this.results[name];
    if (result === undefined) {
      return Promise.reject(new Error("ScriptedTransport has no result for " + name));
    }
    this.onmessage?.({ jsonrpc: "2.0", id: message.id, result });
    return Promise.resolve();
  }

  close(): Promise<void> {
    return Promise.resolve();
  }
}

const ENTRIES = [
  {
    name: "echo",
    description: "Echo a string back.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "structured",
    description: "Return a structured total.",
    inputSchema: { type: "object", properties: { a: { type: "number" } } },
    outputSchema: { type: "object", properties: { total: { type: "number" } } },
  },
  { name: "noSchema" },
  {
    name: "rich",
    description: "Return text and an image.",
    inputSchema: { type: "object", properties: {} },
  },
];

function context(signal?: AbortSignal): ToolContext {
  return {
    signal: signal ?? new AbortController().signal,
    fetch: globalThis.fetch,
    callId: "call-1",
    stepIndex: 0,
    logger: recordingLogger(),
  };
}

describe("the tool adapter", () => {
  it("turns each spec into a tool whose execute sends tools/call with the server's name", async () => {
    const transport = new ScriptedTransport({
      echo: { content: [{ type: "text", text: "hi" }] },
      structured: { structuredContent: { total: 3 } },
      noSchema: { content: [{ type: "text", text: "called with no schema" }] },
      rich: { content: [{ type: "text", text: "before" }, { type: "image", data: "aGk=" }] },
    });
    const logger = recordingLogger();
    const adapted = adaptTools(ENTRIES, "http://fixture.invalid/mcp", {
      logger,
      structuredOutput: false,
      request: async (method, params) => {
        const response = await new Promise<Record<string, unknown>>((resolve, reject) => {
          transport.onmessage = (message) => {
            if ("result" in message) resolve(message.result);
            else reject(new Error("unexpected error response"));
          };
          void transport.send({ jsonrpc: "2.0", id: 1, method, ...(params === undefined ? {} : { params }) });
        });
        return response;
      },
    });

    expect(adapted.map((entry) => entry.name)).toEqual(["echo", "structured", "noSchema", "rich"]);
    const echo = adapted[0]!;
    expect(echo.mcpName).toBe("echo");
    expect(echo.server).toBe("http://fixture.invalid/mcp");
    await expect(echo.execute({ text: "anything" }, context())).resolves.toBe("hi");

    const call = transport.sent.find(
      (message) => "method" in message && message.method === "tools/call",
    );
    expect(call).toMatchObject({ method: "tools/call", params: { name: "echo", arguments: { text: "anything" } } });
  });

  it("joins the text of the content items, and keeps an unread type as its JSON", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async () => ({
        content: [
          { type: "text", text: "before" },
          { type: "image", data: "aGk=", mimeType: "image/png" },
        ],
      }),
    });
    const rich = adapted.find((entry) => entry.name === "rich");
    if (rich === undefined) throw new Error("the rich tool is missing");
    const text = await rich.execute({}, context());
    expect(text).toBe('before\n{"type":"image","data":"aGk=","mimeType":"image/png"}');
  });

  it("returns structuredContent when structuredOutput is on and the schema holds", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: true,
      request: async () => ({ structuredContent: { total: 3 } }),
    });
    const structured = adapted.find((entry) => entry.name === "structured");
    if (structured === undefined) throw new Error("the structured tool is missing");
    await expect(structured.execute({ a: 1 }, context())).resolves.toEqual({ total: 3 });
  });

  it("falls back to parsing the text block when structuredContent is absent", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: true,
      request: async () => ({ content: [{ type: "text", text: '{"total":7}' }] }),
    });
    const structured = adapted.find((entry) => entry.name === "structured");
    if (structured === undefined) throw new Error("the structured tool is missing");
    await expect(structured.execute({ a: 1 }, context())).resolves.toEqual({ total: 7 });
  });

  it("returns plain text when structured output is off even if the server sends the object", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async () => ({ structuredContent: { total: 3 }, content: [{ type: "text", text: "3" }] }),
    });
    const structured = adapted.find((entry) => entry.name === "structured");
    if (structured === undefined) throw new Error("the structured tool is missing");
    await expect(structured.execute({ a: 1 }, context())).resolves.toBe("3");
  });

  it("makes a remote isError the tool's failure, naming the tool and carrying the text", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async () => ({ isError: true, content: [{ type: "text", text: "bad input" }] }),
    });
    const echo = adapted[0]!;
    await expect(echo.execute({ text: "x" }, context())).rejects.toThrow(MCPToolError);
    await expect(echo.execute({ text: "x" }, context())).rejects.toThrow(/echo.*bad input/s);
  });

  it("wraps a protocol failure in the tool's name", async () => {
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async () => {
        throw new Error("the server rejected tools/call (code -32603)");
      },
    });
    const echo = adapted[0]!;
    await expect(echo.execute({ text: "x" }, context())).rejects.toThrow(/echo.*-32603/s);
  });

  it("sanitises an MCP name into an identifier and keeps the wire name", async () => {
    expect(sanitizeToolName("read-file")).toBe("read_file");
    expect(sanitizeToolName("2fa_status")).toBe("_2fa_status");
    expect(sanitizeToolName("mcp.server/echo")).toBe("mcp_server_echo");
    expect(sanitizeToolName("")).toBe("_");

    const adapted = adaptTools(
      [{ name: "read-file", description: "Read a file.", inputSchema: { type: "object" } }],
      "server",
      {
        logger: recordingLogger(),
        structuredOutput: false,
        request: async (method, params) => {
          expect(params?.["name"]).toBe("read-file");
          return { content: [{ type: "text", text: "contents" }] };
        },
      },
    );
    expect(adapted[0]!.name).toBe("read_file");
    expect(adapted[0]!.mcpName).toBe("read-file");
    await expect(adapted[0]!.execute({}, context())).resolves.toBe("contents");
  });

  it("falls back to the tool's own name when the server sent no description", () => {
    const adapted = adaptTools([{ name: "noSchema" }], "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async () => ({}),
    });
    expect(adapted[0]!.description).toBe("noSchema");
  });

  it("skips a tool whose input schema cannot be represented, logging the skip", () => {
    const logger = recordingLogger();
    const adapted = adaptTools(
      [
        { name: "broken", inputSchema: { type: "object", properties: { x: { type: "bigint" } } } },
        { name: "fine", description: "Fine.", inputSchema: { type: "object" } },
      ],
      "server",
      { logger, structuredOutput: false, request: async () => ({}) },
    );
    expect(adapted.map((entry) => entry.name)).toEqual(["fine"]);
    expect(logger.messages.some((message) => message.includes("skipping the tool broken"))).toBe(true);
  });

  it("refuses two tools that would share an identifier, naming both pairs", () => {
    const make = (mcpName: string, server: string): MCPTool => {
      const [entry] = adaptTools([{ name: mcpName, description: "x" }], server, {
        logger: recordingLogger(),
        structuredOutput: false,
        request: async () => ({}),
      });
      return entry!;
    };
    expect(() => assertNoCollisions([make("read-file", "a"), make("read.file", "b")])).toThrow(
      MCPToolCollisionError,
    );
    expect(() => assertNoCollisions([make("read-file", "a"), make("read.file", "b")])).toThrow(
      /read_file.*server a.*read-file.*server b.*read\.file/s,
    );
    // Distinct identifiers do not collide, whatever servers they came from.
    expect(() =>
      assertNoCollisions([make("read-file", "a"), make("write_file", "b")]),
    ).not.toThrow();
  });

  it("passes the caller's abort signal into the request", async () => {
    const controller = new AbortController();
    controller.abort();
    const adapted = adaptTools(ENTRIES, "server", {
      logger: recordingLogger(),
      structuredOutput: false,
      request: async (_method, _params, signal) => {
        if (signal?.aborted === true) throw new MCPConnectionError("aborted");
        return { content: [{ type: "text", text: "too late" }] };
      },
    });
    await expect(adapted[0]!.execute({ text: "x" }, context(controller.signal))).rejects.toThrow(
      /aborted/,
    );
  });
});

describe("the tool adapter over the recorded transcript", () => {
  it("drives the fixture's text, structured and error results through one client", async () => {
    const transport = new FixtureTransport(loadFixture("tool-calls"));
    const client = await clientWithTransport(transport, { structuredOutput: true });
    const tools = await client.getTools();
    const byName = new Map(tools.map((entry) => [entry.name, entry]));

    await expect(byName.get("echo")!.execute({ text: "hi" }, context())).resolves.toBe("hi");
    await expect(byName.get("structured")!.execute({ a: 1 }, context())).resolves.toEqual({
      total: 3,
    });
    await expect(byName.get("broken")!.execute({}, context())).rejects.toThrow(/broken.*refused/s);
    await expect(byName.get("noSchema")!.execute({}, context())).resolves.toBe(
      "called with no schema",
    );
    await expect(byName.get("rich")!.execute({}, context())).resolves.toContain('"type":"image"');
    await expect(byName.get("jsonError")!.execute({}, context())).rejects.toThrow(
      /jsonError.*blew up/s,
    );
    client.disconnect();
  });

  it("refuses a fixture whose two names sanitise to one identifier, naming both", async () => {
    await expect(
      clientWithTransport(new FixtureTransport(loadFixture("collisions"))).then((client) =>
        client.getTools(),
      ),
    ).rejects.toThrow(MCPToolCollisionError);
    await expect(
      clientWithTransport(new FixtureTransport(loadFixture("collisions"))).then((client) =>
        client.getTools(),
      ),
    ).rejects.toThrow(/read_file.*read-file.*read\.file/s);
  });
});

/**
 * How faithful zod's JSON Schema bridge is to what a real MCP server sends.
 *
 * This table is a measurement, recorded so a zod upgrade that changes it fails here by
 * name rather than silently dropping tools in production. Every schema in it was sent
 * by a real server shape; the outcome is what `z.fromJSONSchema` did.
 */
const FIDELITY_CASES: readonly { readonly name: string; readonly schema: unknown }[] = [
  { name: "plain object", schema: { type: "object", properties: { a: { type: "string" } } } },
  {
    name: "$ref into $defs",
    schema: {
      $defs: { P: { type: "object", properties: { x: { type: "number" } } } },
      type: "object",
      properties: { p: { $ref: "#/$defs/P" } },
    },
  },
  {
    name: "anyOf union",
    schema: { type: "object", properties: { v: { anyOf: [{ type: "string" }, { type: "number" }] } } },
  },
  { name: "string enum", schema: { type: "object", properties: { mode: { enum: ["fast", "slow"] } } } },
  {
    name: "date-time format, closed object",
    schema: {
      type: "object",
      properties: { at: { type: "string", format: "date-time" } },
      additionalProperties: false,
    },
  },
  {
    name: "open object",
    schema: { type: "object", properties: {}, additionalProperties: true },
  },
  { name: "the empty schema", schema: {} },
  {
    name: "additionalProperties as a schema",
    schema: {
      type: "object",
      properties: { o: { type: "object", additionalProperties: { type: "integer" } } },
    },
  },
];

describe("schema fidelity, measured", () => {
  it("converts every shape in the table rather than dropping the tool", () => {
    const outcomes = FIDELITY_CASES.map((entry) => {
      try {
        const converted: unknown = z.fromJSONSchema(entry.schema as never);
        return { name: entry.name, outcome: "returned", zod: converted instanceof z.ZodType };
      } catch (error) {
        return {
          name: entry.name,
          outcome: "threw: " + (error instanceof Error ? error.message.split("\n")[0] : String(error)),
          zod: false,
        };
      }
    });
    expect(outcomes).toEqual(
      FIDELITY_CASES.map((entry) => ({ name: entry.name, outcome: "returned", zod: true })),
    );
  });

  it("keeps a closed object's date-time working when the caller passes only its keys", () => {
    const converted = z.fromJSONSchema(FIDELITY_CASES[4]!.schema as never);
    expect(converted.safeParse({ at: "2020-01-01T00:00:00Z" }).success).toBe(true);
    // The measured caveat: additionalProperties:false rejects unknown keys, so a model
    // that hallucinates an extra argument fails validation here rather than at the server.
    expect(converted.safeParse({ at: "2020-01-01T00:00:00Z", extra: 1 }).success).toBe(false);
  });

  it("turns the empty schema into an any, not an object that rejects everything", () => {
    const converted = z.fromJSONSchema({} as never);
    expect(converted.safeParse({ anything: true }).success).toBe(true);
  });

  it("still refuses a schema it cannot represent, which is the skip path", () => {
    expect(() => z.fromJSONSchema({ type: "object", properties: { x: { type: "bigint" } } } as never)).toThrow();
  });
});
