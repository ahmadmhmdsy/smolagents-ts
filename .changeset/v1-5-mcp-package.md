---
"@smolagents-ts/mcp": minor
---

Add the second v1.5 module: the MCP client.

`@smolagents-ts/mcp` speaks JSON-RPC 2.0 over a transport seam, ships Streamable
HTTP and stdio transports, and turns an MCP server's tools into this port's
`Tool[]` through `MCPClient`, `withMCPClient` and `mcpTools`.
