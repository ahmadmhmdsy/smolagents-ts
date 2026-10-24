import { MCPProtocolError } from "./errors.js";

/** A resource the server lists. The shapes mirror the protocol's own field names. */
export interface MCPResource {
  readonly uri: string;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
}

/** One block a resource read returned: either text or base64 blob, never both. */
export type MCPResourceContents =
  | { readonly uri: string; readonly mimeType?: string; readonly text: string }
  | { readonly uri: string; readonly mimeType?: string; readonly blob: string };

/** One argument a prompt accepts. */
export interface MCPPromptArgument {
  readonly name: string;
  readonly description?: string;
  readonly required?: boolean;
}

/** A prompt the server lists. */
export interface MCPPrompt {
  readonly name: string;
  readonly description?: string;
  readonly arguments?: readonly MCPPromptArgument[];
}

/** The content blocks a prompt message can carry. */
export type MCPPromptContent =
  | { readonly type: "text"; readonly text: string }
  | { readonly type: "image"; readonly data: string; readonly mimeType: string }
  | { readonly type: "resource"; readonly resource: MCPResourceContents };

/** One message a prompt expands to. */
export interface MCPPromptMessage {
  readonly role: "user" | "assistant";
  readonly content: MCPPromptContent;
}

/** What a prompt expands to. */
export interface MCPPromptResult {
  readonly description?: string;
  readonly messages: readonly MCPPromptMessage[];
}

/** What a completion request asks about. */
export interface MCPCompletionRequest {
  readonly ref:
    | { readonly type: "ref/prompt"; readonly name: string }
    | { readonly type: "ref/resource"; readonly uri: string };
  readonly argument: { readonly name: string; readonly value: string };
}

/** The completion values the server offers, with its own total when it sends one. */
export interface MCPCompletionResult {
  readonly values: readonly string[];
  readonly total?: number;
  readonly hasMore?: boolean;
}

/** Options every read takes. Omitting `server` means the first connection, as `request` does. */
export interface MCPReadOptions {
  /** The server's name, as `getTools()` reports it. */
  readonly server?: string;
  readonly signal?: AbortSignal;
}

/** Options a paginated listing takes. */
export interface MCPListOptions extends MCPReadOptions {
  /** Where to start; the server's own cursor value. */
  readonly cursor?: string;
  /** Overrides the client's `maxListPages` for this listing. */
  readonly maxPages?: number;
}

function objectOf(value: unknown, method: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new MCPProtocolError(
      "The MCP server's " + method + " answer carried an entry that is not an object.",
      -32603,
    );
  }
  return value as Record<string, unknown>;
}

function stringOf(value: unknown, field: string, method: string): string {
  if (typeof value !== "string") {
    throw new MCPProtocolError(
      "The MCP server's " + method + " answer carried no string '" + field + "'.",
      -32603,
    );
  }
  return value;
}

function optionalString(
  record: Record<string, unknown>,
  field: string,
): string | undefined {
  const value = record[field];
  return typeof value === "string" ? value : undefined;
}

/**
 * Copies the optional fields a caller listed when the answer carried them, keeping the
 * protocol's own spelling: a field the server omitted stays omitted, never undefined.
 */
function withOptionalFields<T extends object>(
  record: Record<string, unknown>,
  base: T,
  fields: readonly string[],
): T {
  const merged = { ...base } as Record<string, unknown>;
  for (const field of fields) {
    const value = record[field];
    if (typeof value === "string" || typeof value === "boolean" || typeof value === "number") {
      merged[field] = value;
    }
  }
  return merged as T;
}

/** Parses one entry of a resources/list answer. */
export function parseResource(value: unknown): MCPResource {
  const record = objectOf(value, "resources/list");
  return withOptionalFields(
    record,
    {
      uri: stringOf(record["uri"], "uri", "resources/list"),
      name: stringOf(record["name"], "name", "resources/list"),
    },
    ["description", "mimeType"],
  );
}

/** Parses one content block of a resources/read answer. */
export function parseResourceContentsEntry(
  value: unknown,
  method = "resources/read",
): MCPResourceContents {
  const record = objectOf(value, method);
  const uri = stringOf(record["uri"], "uri", method);
  const mimeType = optionalString(record, "mimeType");
  const head = mimeType === undefined ? { uri } : { uri, mimeType };
  if (typeof record["text"] === "string") return { ...head, text: record["text"] };
  if (typeof record["blob"] === "string") return { ...head, blob: record["blob"] };
  throw new MCPProtocolError(
    "The MCP server's " + method + " answer carried a content block with neither text nor blob.",
    -32603,
  );
}

/** Parses a resources/read answer into its content blocks. */
export function parseResourceContents(
  result: Record<string, unknown>,
  method = "resources/read",
): MCPResourceContents[] {
  const contents = result["contents"];
  if (!Array.isArray(contents)) {
    throw new MCPProtocolError(
      "The MCP server's " + method + " answer carried no 'contents' array.",
      -32603,
    );
  }
  return contents.map((entry) => parseResourceContentsEntry(entry, method));
}

/** Parses one entry of a prompts/list answer. */
export function parsePrompt(value: unknown): MCPPrompt {
  const record = objectOf(value, "prompts/list");
  const base = { name: stringOf(record["name"], "name", "prompts/list") };
  const argumentsValue = record["arguments"];
  const withDescription = withOptionalFields(record, base, ["description"]);
  if (!Array.isArray(argumentsValue)) return withDescription;
  return {
    ...withDescription,
    arguments: argumentsValue.map((argument) => {
      const entry = objectOf(argument, "prompts/list");
      return withOptionalFields(
        entry,
        { name: stringOf(entry["name"], "name", "prompts/list") },
        ["description", "required"],
      ) as MCPPromptArgument;
    }),
  };
}

/** Parses one content block of a prompts/get answer. */
export function parsePromptContent(value: unknown, method = "prompts/get"): MCPPromptContent {
  const record = objectOf(value, method);
  const type = stringOf(record["type"], "type", method);
  if (type === "text") return { type: "text", text: stringOf(record["text"], "text", method) };
  if (type === "image") {
    return {
      type: "image",
      data: stringOf(record["data"], "data", method),
      mimeType: stringOf(record["mimeType"], "mimeType", method),
    };
  }
  if (type === "resource") {
    return {
      type: "resource",
      resource: parseResourceContentsEntry(record["resource"], method),
    };
  }
  throw new MCPProtocolError(
    "The MCP server's " + method + " answer carried a content block of unknown type '" + type + "'.",
    -32603,
  );
}

/** Parses a prompts/get answer into its messages. */
export function parsePromptResult(result: Record<string, unknown>, method = "prompts/get"): MCPPromptResult {
  const messages = result["messages"];
  if (!Array.isArray(messages)) {
    throw new MCPProtocolError(
      "The MCP server's " + method + " answer carried no 'messages' array.",
      -32603,
    );
  }
  const parsed = messages.map((message) => {
    const record = objectOf(message, method);
    const role = stringOf(record["role"], "role", method);
    if (role !== "user" && role !== "assistant") {
      throw new MCPProtocolError(
        "The MCP server's " + method + " answer carried an unknown role '" + role + "'.",
        -32603,
      );
    }
    return { role, content: parsePromptContent(record["content"], method) } as MCPPromptMessage;
  });
  const description = optionalString(result, "description");
  return description === undefined ? { messages: parsed } : { description, messages: parsed };
}

/** Parses a completion/complete answer. */
export function parseCompletion(
  result: Record<string, unknown>,
  method = "completion/complete",
): MCPCompletionResult {
  const completion = objectOf(result["completion"], method);
  const values = completion["values"];
  if (!Array.isArray(values) || values.some((value) => typeof value !== "string")) {
    throw new MCPProtocolError(
      "The MCP server's " + method + " answer carried no 'values' array of strings.",
      -32603,
    );
  }
  const total = completion["total"];
  const hasMore = completion["hasMore"];
  return {
    values: values as string[],
    ...(typeof total === "number" ? { total } : {}),
    ...(typeof hasMore === "boolean" ? { hasMore } : {}),
  };
}
