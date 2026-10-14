import { describe, expect, it } from "vitest";
import * as mcp from "../src/index.js";

/**
 * Every runtime value the package promises. Adding a name here is a deliberate act;
 * removing one is a breaking change and should be visible in a diff.
 */
const RUNTIME_EXPORTS = [
  // package metadata
  "VERSION",
  "CLIENT_INFO",
  // the client
  "MCPClient",
  "NOTIFICATION_HISTORY_LIMIT",
  // the parameters
  "LATEST_PROTOCOL_VERSION",
  "DEFAULT_NEGOTIATED_PROTOCOL_VERSION",
  "SUPPORTED_PROTOCOL_VERSIONS",
  "isStdioServerParameters",
  "isUrlServerParameters",
  // the tool adapter
  "adaptTools",
  "assertNoCollisions",
  "sanitizeToolName",
  // the composition helpers
  "mcpTools",
  "withMCPClient",
  // the errors
  "MCPError",
  "MCPParameterError",
  "MCPTransportError",
  "MCPClosedError",
  "MCPProtocolError",
  "MCPTimeoutError",
  "MCPConnectionError",
  "MCPToolError",
  "MCPToolCollisionError",
  // the wire
  "isErrorResponse",
  "isNotification",
  "isRequest",
  "isResponse",
  // the transports
  "StreamableHttpTransport",
  "createHttpTransport",
] as const;

describe("public surface", () => {
  for (const name of RUNTIME_EXPORTS) {
    it("exports " + name, () => {
      expect(mcp).toHaveProperty(name);
      expect((mcp as Record<string, unknown>)[name]).toBeDefined();
    });
  }

  it("keeps the total export count honest", () => {
    const unexpected = Object.keys(mcp).filter(
      (name) => !(RUNTIME_EXPORTS as readonly string[]).includes(name),
    );
    expect(unexpected).toEqual([]);
  });

  it("never re-exports the stdio transport, so a browser bundle cannot reach it", () => {
    expect(Object.keys(mcp)).not.toContain("StdioTransport");
    expect(Object.keys(mcp)).not.toContain("createStdioTransport");
    expect(Object.keys(mcp)).not.toContain("stdioClient");
    expect(Object.keys(mcp)).not.toContain("node:child_process");
  });

  it("names the latest revision and the accepted set", () => {
    expect(mcp.LATEST_PROTOCOL_VERSION).toBe("2025-11-25");
    expect(mcp.SUPPORTED_PROTOCOL_VERSIONS).toContain(mcp.LATEST_PROTOCOL_VERSION);
    expect(mcp.DEFAULT_NEGOTIATED_PROTOCOL_VERSION).toBe("2025-03-26");
  });

  it("carries this package's identity in the client info", () => {
    expect(mcp.CLIENT_INFO.name).toBe("@smolagents-ts/mcp");
    expect(mcp.CLIENT_INFO.version).toBe(mcp.VERSION);
  });
});
