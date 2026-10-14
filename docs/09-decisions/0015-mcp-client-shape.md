# 0015 — the MCP client is hand-rolled behind a transport seam

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before adding a dependency to the MCP package, before changing
  its transport set, or before wiring an official MCP SDK transport into it.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** this session, as the shape of the package Task 3 delivers; the
  owner may reverse the transport set or the dependency posture at T-14
- **Supersedes:** none

## Context

Task 3 delivers an MCP client behind the core's tool seam. Upstream does not
speak the protocol itself: `mcp_client.py` is a 142-line wrapper around
`mcpadapt` and the official Python SDK, and `ToolCollection.from_mcp`
(`tools.py`, lines 949–1058) repeats that wrapper for the collection case. This
port has no `mcpadapt` equivalent, so two questions had to be answered: which
package the client lives in, and whether it takes the official TypeScript SDK as
a dependency or speaks the protocol itself.

The first is already answered by the records. The design defers
`mcp_client.py` to a v1.5 `mcp` package (line 942), lists MCP servers as a
tool source beside `ToolCollection` (line 341), and `docs/attribution.md`
already names `planned packages/mcp` as the destination.

The second was measured. The official SDK at 1.32.1 is 4.49 MB unpacked and
carries 17 direct dependencies, among them `express`, `hono`, `cors` and
`express-rate-limit` — an HTTP server stack that a client never executes. Two
facts on this side point the other way: the model adapters already speak their
providers' protocols over `fetch` with zod-validated wire types, and
`zod@4.6.6` exports `fromJSONSchema`, so an MCP tool's JSON Schema becomes a
`tool()` input schema without a conversion library. The gate's own requirement —
a client driven from a recorded fixture, no live server — needs a transport seam
that belongs to this package whichever way the dependency question goes.

## Decision

1. The client ships as `@smolagents-ts/mcp`, a package of its own, depending on
   `@smolagents-ts/core` and `zod` only.
2. It speaks JSON-RPC 2.0 itself over a `McpTransport` seam. The official SDK is
   not a dependency. The seam is declared to be structurally compatible with the
   SDK's `Transport`, so a caller who needs the SDK's coverage can pass one of
   its transports with no adapter of ours in between.
3. The first release ships stdio (Node-only, behind the
   `@smolagents-ts/mcp/stdio` subpath) and Streamable HTTP (isomorphic
   `fetch`). Legacy HTTP+SSE is refused by name, with an error that names
   Streamable HTTP.
4. `MCPClient` keeps upstream's surface, including the connect during
   construction, and `structuredOutput` keeps upstream's default of `false`
   with its notice routed through the core's `Logger`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **A — the SDK as a regular dependency** | 4.49 MB and a server stack installed for three methods. R-07.2 asks what the dependency provides that this project cannot reasonably build; the answer here is protocol bookkeeping, and the bookkeeping is the part the fixture already tests. |
| **B — the SDK as an optional peer, imported lazily** | Consumers stay light, but the typecheck, the suite and the pack smoke all need it installed, so the repository carries the weight anyway, and one protocol gets two code paths to keep honest. |
| **C — hand-rolled, with an SDK transport injectable** (chosen) | Keeps the dependency out and the escape hatch open. |
| **D — a subpath of `@smolagents-ts/models`** | MCP is not a model provider. Putting a tool protocol inside the provider package contradicts the design's tool-source row and gives the models layer a second reason to exist. |

## Consequences

**Positive**

- No new runtime dependency, and no server stack in a client's install.
- The root entry is isomorphic by construction: only the `stdio` subpath may
  name a Node builtin, and a test enforces it.
- The gate stays offline and the protocol is testable line by line from a
  recorded transcript.

**Negative / accepted costs**

- The protocol revision, its resumability rules and its authorization flow are
  this project's to track. The first release sends the latest published revision,
  accepts the four that are published, and implements neither resumption nor
  OAuth.
- A server that requires the SDK's OAuth-protected HTTP transport needs a
  caller-supplied transport.
- SSE-based servers are unsupported until someone asks for one.

## Reversibility

Easy for the dependency and moderate for the protocol. Adding an SDK-backed
transport is one file plus a subpath export, with no change to `MCPClient`;
replacing the client wholesale rewrites one package that nothing published
depends on.

## Follow-up

- [ ] `docs/plans/2026-10-14-t13-mcp-client-plan.md` carries the tasks; the live
      server check is a runbook rather than a gate stage.
