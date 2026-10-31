# @smolagents-ts/mcp

## 0.1.0

### Minor Changes

- A stdio server now starts with a short safe environment plus its `env`, not this process's whole environment; pass what a server needs in `env`. The HTTP transport refuses an Authorization header over plain http to a remote host unless `allowInsecureAuthorization` is set, caps responses with `maxResponseBytes`, and takes an optional `timeoutMs`.

- a41578f: Add the second v1.5 module: the MCP client.

  `@smolagents-ts/mcp` speaks JSON-RPC 2.0 over a transport seam, ships Streamable
  HTTP and stdio transports, and turns an MCP server's tools into this port's
  `Tool[]` through `MCPClient`, `withMCPClient` and `mcpTools`.
