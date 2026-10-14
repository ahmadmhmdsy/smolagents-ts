import type { Tool } from "@smolagents-ts/core";
import { MCPClient } from "./client.js";
import { MCPError } from "./errors.js";
import type { MCPClientOptions, MCPServerParameters } from "./parameters.js";

export interface MCPToolsOptions extends MCPClientOptions {
  /**
   * Acknowledges that the MCP server's tools execute code on this machine. Required,
   * as upstream's ToolCollection.from_mcp requires it, and false by default.
   */
  readonly trustRemoteCode?: boolean;
}

/**
 * Connects, hands the callback the server's tools, and disconnects afterwards — even
 * when the callback throws. This is upstream's `with MCPClient(...) as tools`: Python's
 * `with` has no `await using` equivalent here, so the context manager is a function
 * plus an explicit `disconnect()` in a `finally`.
 */
export async function withMCPClient<T>(
  parameters: MCPServerParameters | readonly MCPServerParameters[],
  fn: (tools: Tool[], client: MCPClient) => T | Promise<T>,
  options: MCPClientOptions = {},
): Promise<T> {
  const client = await MCPClient.create(parameters, options);
  try {
    return await fn(await client.getTools(), client);
  } finally {
    client.disconnect();
  }
}

/**
 * The server's tools as a plain `Tool[]`, which is upstream's
 * `ToolCollection.from_mcp` minus the collection class: there is no
 * `ToolCollection.fromMCP`, because it would make the tools package depend on this
 * one for a static factory that a single call replaces.
 */
export async function mcpTools(
  parameters: MCPServerParameters | readonly MCPServerParameters[],
  options: MCPToolsOptions = {},
): Promise<Tool[]> {
  if (options.trustRemoteCode !== true) {
    throw new MCPError(
      "Loading tools from MCP requires you to acknowledge you trust the MCP server, " +
        "as it will execute code on your local machine: pass `trustRemoteCode: true`.",
    );
  }
  const { trustRemoteCode: _trustRemoteCode, ...clientOptions } = options;
  const client = await MCPClient.create(parameters, clientOptions);
  try {
    return await client.getTools();
  } finally {
    client.disconnect();
  }
}

/** The logger type, re-exported so a caller can name the option without importing core. */
export type { Logger } from "@smolagents-ts/core";
