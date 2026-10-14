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
import { mcpTools, withMCPClient } from "@smolagents-ts/mcp";

await withMCPClient({ url: "http://localhost:8000/mcp" }, async (tools, client) => {
  // tools is Tool[] from @smolagents-ts/core; client is the live MCPClient
});

// Or the Tool[] directly, once the server is trusted:
const tools = await mcpTools({ url: "http://localhost:8000/mcp" }, { trustRemoteCode: true });
```

A stdio server — the only entry point that imports a Node builtin:

```ts
import { stdioClient } from "@smolagents-ts/mcp/stdio";

const client = await stdioClient({ command: "node", args: ["/path/to/some-mcp-server/index.js"] });
try {
  const tools = await client.getTools();
} finally {
  client.disconnect();
}
```

Pass the server's own executable rather than a package manager's shim: a command a
terminal accepts is not always a command a spawn can start, so point `command` at the
interpreter and put the server's installed entry in `args`.

Several servers at once, and the manual lifecycle, are on `MCPClient`:

```ts
import { MCPClient } from "@smolagents-ts/mcp";

const client = await MCPClient.create([
  { url: "http://localhost:8000/mcp" },
  { command: "node", args: ["/path/to/another-server/index.js"] },
]);
try {
  const tools = await client.getTools();
} finally {
  client.disconnect();
}
```

The constructor is private: `MCPClient.create(...)` connects during construction, as
upstream does, and a construction that cannot connect closes what it opened.

## What is not supported

- The legacy HTTP+SSE transport is refused by name; the error names Streamable HTTP.
- Resumption and the OAuth-protected HTTP flow are not implemented. A server that
  requires the latter needs a caller-supplied transport.
- Two servers that expose a tool with the same name are refused rather than merged.
