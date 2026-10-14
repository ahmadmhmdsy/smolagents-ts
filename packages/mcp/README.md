# @smolagents-ts/mcp

The MCP (Model Context Protocol) client for this port: JSON-RPC 2.0 hand-rolled over
a transport seam, a Streamable HTTP transport built on `fetch`, a stdio transport
behind the `./stdio` subpath, and an adapter that turns a server's tools into this
port's `Tool[]`.

The package depends on `@smolagents-ts/core` and `zod` only. The official
`@modelcontextprotocol/sdk` is deliberately not a dependency (decision 0015); the
transport seam is declared to be structurally compatible with the SDK's
`Transport`, so a caller who needs a transport this package does not ship can pass
one of the SDK's with no adapter.

## Usage

A Streamable HTTP server, through the composition helper:

```ts
import { mcpTools, withMcpClient } from "@smolagents-ts/mcp";

await withMcpClient({ url: "http://localhost:8000/mcp" }, async (tools) => {
  // tools is Tool[] from @smolagents-ts/core
});

// Or the Tool[] directly, once the server is trusted:
const tools = await mcpTools({ url: "http://localhost:8000/mcp" }, { trustRemoteCode: true });
```

A stdio server — the only entry point that imports a Node builtin:

```ts
import { stdioClient } from "@smolagents-ts/mcp/stdio";

const client = await stdioClient({ command: "npx", args: ["-y", "some-mcp-server"] });
try {
  const tools = await client.getTools();
} finally {
  client.disconnect();
}
```

Several servers at once, and the manual lifecycle, are on `MCPClient`:

```ts
import { MCPClient } from "@smolagents-ts/mcp";

const client = await new MCPClient([
  { url: "http://localhost:8000/mcp" },
  { command: "npx", args: ["-y", "another-server"] },
]).connect();
try {
  const tools = await client.getTools();
} finally {
  client.disconnect();
}
```

## What is not supported

- The legacy HTTP+SSE transport is refused by name; the error names Streamable HTTP.
- Resumption and the OAuth-protected HTTP flow are not implemented. A server that
  requires the latter needs a caller-supplied transport.
- Two servers that expose a tool with the same name are refused rather than merged.
