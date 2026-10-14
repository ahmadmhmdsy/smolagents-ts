import { z } from "zod";
import { tool, type Logger, type Tool, type ToolContext } from "@smolagents-ts/core";
import { MCPToolCollisionError, MCPToolError } from "./errors.js";

/** One entry of a tools/list page, as the protocol defines it. */
export interface MCPToolListEntry {
  readonly name: string;
  readonly description?: string;
  readonly inputSchema?: Record<string, unknown>;
  readonly outputSchema?: Record<string, unknown>;
}

/** The extra surface an adapted tool carries, so a caller can see where it came from. */
export interface MCPTool extends Tool {
  /** The name the server knows, which is what goes on the wire. */
  readonly mcpName: string;
  /** The server that exposed the tool. */
  readonly server: string;
}

export interface AdaptToolsOptions {
  readonly logger: Logger;
  readonly structuredOutput: boolean;
  /** The connection serving this server's tools. */
  readonly request: (
    method: string,
    params: Record<string, unknown> | undefined,
    signal?: AbortSignal,
  ) => Promise<Record<string, unknown>>;
}

/** Every character a JavaScript identifier does not allow becomes an underscore. */
export function sanitizeToolName(name: string): string {
  const replaced = name.replace(/[^A-Za-z0-9_]/g, "_");
  if (replaced === "") return "_";
  return /^[0-9]/.test(replaced) ? "_" + replaced : replaced;
}

/**
 * Turns a server's tool specs into this port's tools.
 *
 * A spec whose input schema cannot be represented is skipped rather than fatal: one
 * unreadable tool must not take the whole server's listing with it, and the skip goes
 * through the logger so it is visible.
 */
export function adaptTools(
  entries: readonly MCPToolListEntry[],
  server: string,
  options: AdaptToolsOptions,
): MCPTool[] {
  const adapted: MCPTool[] = [];
  for (const entry of entries) {
    try {
      adapted.push(adaptTool(entry, server, options));
    } catch (error) {
      options.logger.warn(
        "mcp: skipping the tool " + entry.name + " from " + server + ": " + describe(error),
      );
    }
  }
  return adapted;
}

/**
 * Refuses two tools one client would register under one identifier.
 *
 * Upstream merges a same-named pair silently, through mcpadapt; a silently shadowed
 * tool is the one outcome a caller cannot debug, so this port names both pairs
 * instead. Both the sanitised identifier and the MCP names are in the message,
 * because a collision on `read_file` can come from `read-file` and `read.file`.
 */
export function assertNoCollisions(tools: readonly MCPTool[]): void {
  const seen = new Map<string, MCPTool>();
  for (const candidate of tools) {
    const previous = seen.get(candidate.name);
    if (previous !== undefined) {
      throw new MCPToolCollisionError(
        "Two MCP tools would both be registered as '" +
          candidate.name +
          "': the server " +
          previous.server +
          " exposes '" +
          previous.mcpName +
          "' and the server " +
          candidate.server +
          " exposes '" +
          candidate.mcpName +
          "'. Rename one server's tool, or connect the servers separately.",
        [previous.mcpName, candidate.mcpName],
        [previous.server, candidate.server],
      );
    }
    seen.set(candidate.name, candidate);
  }
}

function adaptTool(entry: MCPToolListEntry, server: string, options: AdaptToolsOptions): MCPTool {
  // The server's own name is not always a JavaScript identifier (read-file, 2fa_status,
  // mcp.server/echo), and tool() refuses anything else because that name is what the
  // model writes in generated code. Upstream's adapter has the same problem; it
  // generates Python calls, so it sanitises too.
  const identifier = sanitizeToolName(entry.name);
  const inputSchema = inputSchemaFor(entry, server);
  const outputSchema =
    options.structuredOutput && entry.outputSchema !== undefined
      ? z.fromJSONSchema(entry.outputSchema)
      : undefined;
  const base = tool({
    name: identifier,
    description: entry.description ?? entry.name,
    inputSchema,
    ...(outputSchema === undefined ? {} : { outputSchema }),
    execute: async (input: unknown, ctx: ToolContext): Promise<unknown> =>
      callTool(entry, server, options, input, ctx),
  });
  return Object.assign(base, { mcpName: entry.name, server });
}

/** An input schema the server did not send still has to accept the model's call. */
function inputSchemaFor(entry: MCPToolListEntry, server: string): z.ZodType {
  if (entry.inputSchema === undefined) return z.record(z.string(), z.unknown());
  try {
    const schema: unknown = z.fromJSONSchema(entry.inputSchema);
    if (schema instanceof z.ZodType) return schema;
    return z.record(z.string(), z.unknown());
  } catch (error) {
    throw new MCPToolError(
      "The MCP tool '" +
        entry.name +
        "' on " +
        server +
        " has an input schema this port cannot represent: " +
        describe(error),
      entry.name,
      server,
      { cause: error },
    );
  }
}

async function callTool(
  entry: MCPToolListEntry,
  server: string,
  options: AdaptToolsOptions,
  input: unknown,
  ctx: ToolContext,
): Promise<unknown> {
  const args =
    input !== null && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};
  let result: Record<string, unknown>;
  try {
    result = await options.request(
      "tools/call",
      { name: entry.name, arguments: args },
      ctx.signal,
    );
  } catch (error) {
    if (error instanceof MCPToolError) throw error;
    // A server that rejects the call outright (an unknown tool, a protocol error) is
    // this tool's failure, and the failure has to name the tool the server knows.
    throw new MCPToolError(
      "The MCP tool '" + entry.name + "' on " + server + " failed: " + describe(error),
      entry.name,
      server,
      { cause: error },
    );
  }
  if (result["isError"] === true) {
    throw new MCPToolError(
      "The MCP tool '" +
        entry.name +
        "' on " +
        server +
        " reported a failure: " +
        contentText(result["content"]),
      entry.name,
      server,
    );
  }
  if (options.structuredOutput) {
    if ("structuredContent" in result) return result["structuredContent"];
    // The specification's fallback: a server may put the structured result in the
    // text block. Only parse when it is an object; a plain string is not one.
    const text = contentText(result["content"]);
    try {
      const parsed: unknown = JSON.parse(text);
      if (parsed !== null && typeof parsed === "object") return parsed;
    } catch {
      // Not JSON, so the text itself is the answer.
    }
    return text;
  }
  return contentText(result["content"]);
}

/**
 * The result's content as text. A type this port does not read (image, audio,
 * resource) is kept as its JSON text rather than dropped, so a caller can still see
 * that the server answered with one.
 */
function contentText(content: unknown): string {
  if (!Array.isArray(content)) return typeof content === "string" ? content : "";
  const parts: string[] = [];
  for (const item of content) {
    if (item === null || typeof item !== "object") {
      parts.push(String(item));
      continue;
    }
    const record = item as Record<string, unknown>;
    if (record["type"] === "text" && typeof record["text"] === "string") {
      parts.push(record["text"]);
      continue;
    }
    parts.push(JSON.stringify(record));
  }
  return parts.join("\n");
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
