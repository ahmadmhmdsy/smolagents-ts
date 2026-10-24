# mcp — scoped entry

## What this component is

`@smolagents-ts/mcp` is the MCP client: JSON-RPC 2.0 over a transport seam, a
Streamable HTTP transport, a stdio transport behind its own subpath, and an
adapter that turns a server's tools into this port's tools. It ports the
lifecycle of upstream `mcp_client.py` — connect during construction, expose
`getTools()`, tear down with `disconnect()` — and it depends on the core and
zod alone, so a caller who injects the official SDK's transport takes no SDK
dependency from this package.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/mcp/src/index.ts` | the client, its parameters, the adapter, the errors and the HTTP transport |
| stdio subpath | `packages/mcp/src/transports/stdio.ts` | the only module that reaches `node:child_process`; published as `@smolagents-ts/mcp/stdio` |
| HTTP transport | `packages/mcp/src/transports/http.ts` | Streamable HTTP over an injected fetch |
| client | `packages/mcp/src/client.ts` | the lifecycle, the request map, the handshake and the tool listing |
| transport seam | `packages/mcp/src/transport.ts` | `MCPTransport`, the members the official SDK's transport also declares |
| wire shapes | `packages/mcp/src/json-rpc.ts` | the JSON-RPC 2.0 union and its guards |
| tool adapter | `packages/mcp/src/tool-adapter.ts` | name sanitisation, schema conversion, the collision refusal |
| parameters | `packages/mcp/src/parameters.ts` | the server parameter shapes, the protocol revisions and the `sse` refusal |
| composition | `packages/mcp/src/tools.ts` | `withMCPClient` and `mcpTools` |
| errors | `packages/mcp/src/errors.ts` | one class per refusal |
| version marker | `packages/mcp/src/version.ts` | the value the pack smoke imports |

## Smallest validation command

    pnpm vitest run --project mcp

Expected result: twelve files with one hundred and twenty-nine tests, exit code 0. The
suite drives a recorded fixture transport, so it needs no live server and no
key. Run
`pnpm --filter @smolagents-ts/mcp run typecheck` beside it: the runner erases
types, and the seam's assignability to the official SDK's transport is a
type-level claim only the compiler checks.

## Boundaries

The package owns the client, its two transports and the tool adapter. It owns no
agent loop, no model adapter and no executor: the loop, the events and the
`Tool` contract come from the core. The root entry is isomorphic by
construction and the architecture test enforces it, so a browser bundle that
imports the barrel reaches no Node builtin. A subprocess server's transport comes
from the `/stdio` subpath, either directly or through `transportFactory`.

## Hazards

- `sse` is the other transport string upstream accepts, and this client refuses
  it by name: the legacy HTTP+SSE transport is deprecated and none ships here.
- A server's tool name is not always a JavaScript identifier. The adapter
  sanitises it, keeps the server's own name for `tools/call`, and refuses a pair
  that would register under one identifier instead of shadowing one of them.
- A tool spec whose input schema cannot be represented is left out of the listing
  with a logged warning rather than carried as a permissive schema.
- `structuredOutput` defaults to false and routes upstream's change notice
  through the injected logger; with it true, a tool answers with the server's
  structured content rather than the joined text of its content blocks.
- The client connects during construction, so `MCPClient.create(...)` is the
  entry point and the constructor is private; a construction that cannot connect
  closes what it opened and rejects with the original failure.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule: `rules/components/mcp.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
