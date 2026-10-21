# mcp-typescript-sdk — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

| path | role |
|---|---|
| `packages/client/` | the client role: `Client`, Streamable HTTP and legacy SSE transports, stdio transport, auth, response cache, client middleware |
| `packages/server/` | the server role: high-level `McpServer`, low-level `Server`, both HTTP entries, the stdio entry, auth and Host/Origin helpers |
| `packages/core/` | public Zod wire schemas and the protocol constants |
| `packages/core-internal/` | private protocol core, per-revision wire codecs, method registries, generated specification types |
| `packages/middleware/` | four thin HTTP adapters: `node`, `express`, `fastify`, `hono` |
| `packages/server-legacy/`, `packages/codemod/` | frozen v1 SSE and authorisation-server helpers; the v1 import rewriter |
| `docs/` | 50 pages that are both the published manual and the source of the declared-feature claims in this dive |
| `examples/` | 36 runnable projects, including dual-era, subscriptions, mrtr, gateway and auth demos |
| `test/e2e/` | the behaviour suite: 42 scenario files over a 480-entry requirements manifest |
| `test/conformance/` | harnesses that run the external conformance package against this SDK's client and server |
| `scripts/`, `skills/` | release and repo automation; maintainer skill packs, including the v1 to v2 upgrade guide the migration page is assembled from |

## Five layers

A request crosses the same five layers on both sides, and the era split is confined to the middle one.

1. **Specification types.** One generated file per revision (`packages/core-internal/src/types/`), a literal transcription of the schema so a reader can diff the SDK against the spec.
2. **Wire codec.** A per-revision object that encodes a method's params and decodes its result, including the `resultType` discriminator that only the `2026-07-28` era carries.
3. **Protocol core.** `Protocol` owns ids, the request funnel, handler maps, timeouts, progress routing and the inbound/outbound `_meta` envelope (`packages/core-internal/src/shared/protocol.ts:1276`).
4. **Transport.** One class per channel, behind a small interface: `start`, `send`, `close`, plus optional per-request streaming and resumption hooks (`packages/core-internal/src/shared/transport.ts:173`).
5. **Role class and entry point.** `Client` and `Server` add capability assertion and typed verbs; `McpServer` and `createMcpHandler` add authoring sugar and hosting postures.

## Core abstractions

| concept | where | what it owns |
|---|---|---|
| `Protocol` | `packages/core-internal/src/shared/protocol.ts:108`, `:1276` | per-request options, request and notification dispatch, progress tokens, cancellation, schema validation of results |
| `Transport` | `packages/core-internal/src/shared/transport.ts:173` | the channel contract; send options carry resumption token, per-request signal and extra headers (`:117`) |
| `Client` | `packages/client/src/client/client.ts:546` | every client verb, capability gates, era negotiation, response cache, subscription handles |
| `ClientOptions` | `packages/client/src/client/client.ts:183` | capabilities, negotiation mode, list-changed handlers, cache store and partition, input-required policy |
| `McpServer` | `packages/server/src/server/mcp.ts:112` | `registerTool`, `registerResource`, `registerPrompt`, mutation handles that notify on change |
| low-level `Server` | `packages/server/src/server/server.ts:264` | raw handlers, capability declaration, server-initiated requests, list-changed senders |
| `createMcpHandler` | `packages/server/src/server/createMcpHandler.ts:681` | the web-standard HTTP entry: factory per request, dual-era routing, `notify`/`bus` |
| `serveStdio` | `packages/server/src/server/serveStdio.ts:375` | the stdio entry: owns the transport, pins one instance per connection |
| wire codecs and registries | `packages/core-internal/src/wire/rev2026-07-28/registry.ts:59` | which methods exist per era, and how each result is shaped on that wire |
| `ResponseCacheStore` | `packages/client/src/client/responseCache.ts:92` | five-method seam for a shared or persistent cache |
| OAuth providers | `packages/client/src/client/auth.ts:81`, `:248`; `packages/client/src/client/authExtensions.ts:168` | bearer-token provider, interactive OAuth provider, machine-to-machine providers |
| `ServerEventBus` | `packages/server/src/server/serverEventBus.ts:41` | publish/subscribe seam behind `subscriptions/listen` streams |
| `InMemoryTransport` | `packages/core-internal/src/util/inMemory.ts:16` | linked pair used by tests and embedded hosts |

## One `callTool` round, legacy era

1. `connect()` starts the transport and, in the default negotiation mode, runs the `initialize` handshake (`packages/client/src/client/client.ts:1004`, `:1057`). The client sends `LATEST_PROTOCOL_VERSION`, its capabilities and its identity, then records the server's version, capabilities and instructions.
2. `callTool` first asserts the server advertised `tools`, then resolves the tool definition: a caller-supplied `toolDefinition` or the cached `tools/list` entry (`:2372`, `:1902`).
3. Arguments that the tool marks with `x-mcp-header` are mirrored into `Mcp-Param-*` HTTP headers on the modern era (`:2390` to `:2416`); the cached definition is what makes that possible mid-call.
4. The protocol core assigns a request id, merges a `progressToken` into `_meta` when the caller passed `onprogress`, arms the timeout and registers the response handler (`packages/core-internal/src/shared/protocol.ts:1446`, `:1582`).
5. The HTTP transport builds headers, then `POST`s one JSON-RPC message (`packages/client/src/client/streamableHttp.ts:530`, `:990`). The response is either one JSON body or an SSE stream, decided by the server.
6. Inbound frames go through transport `onmessage` to the response handler, which decodes with the era's codec and validates the result against the method schema; a decode or validation failure rejects with a typed code (`packages/core-internal/src/shared/protocol.ts:1533`).
7. Progress notifications for the same call arrive as separate `notifications/progress` frames and are routed by token to the caller's callback (`packages/core-internal/src/shared/protocol.ts:625`).
8. When the tool declared an `outputSchema`, `callTool` requires `structuredContent` and validates it before returning (`packages/client/src/client/client.ts:2495`, `:2503`); on a header mismatch it refreshes the definition once and retries (`:2444`).
9. A tool-level failure is an ordinary result with `isError`; unknown tools, timeouts and schema violations reject. Timeout and abort share one cancel path: legacy sends `notifications/cancelled`, while a modern per-request stream is aborted instead (`packages/core-internal/src/shared/protocol.ts:1435`).

## One modern connection, no handshake

1. `versionNegotiation: { mode: 'auto' }` routes `connect()` to the negotiated path (`packages/client/src/client/client.ts:1130`).
2. The probe asks `server/discover`. Over HTTP it is one unauthenticated POST; over stdio the SDK spawns a sibling process to ask, because the real channel must not be consumed (`:1150` to `:1167`, `packages/client/src/client/versionNegotiation.ts:356`).
3. The probe result is classified into an era verdict, and the client adopts the era: it stores the discover result, sets the protocol version, and stops sending `initialize` (`packages/client/src/client/client.ts:1130` to `:1187`).
4. Every subsequent request gets the per-request `_meta` envelope: protocol version, client identity, capabilities, subscription id (`packages/client/src/client/client.ts:722`).
5. A `listChanged` configuration opens the `subscriptions/listen` stream during connect and exposes the handle as `autoOpenedSubscription` (`packages/client/src/client/client.ts:1274`).
6. On the server side, `createMcpHandler` classifies each inbound HTTP request by body and era and serves it through the matching leg (`packages/server/src/server/createMcpHandler.ts:622`).
7. Inbound requests the era does not define are dropped rather than answered (`packages/client/src/client/client.ts:699`), and outbound methods the era lacks fail locally before transmit.

## Era negotiation

| mode | behaviour | evidence |
|---|---|---|
| default | plain `initialize`; the server echoes a version, the client downgrades within its supported list | `packages/client/src/client/client.ts:1023`, `:1057`; `packages/core/src/constants.ts:3` |
| `auto` | probe, then adopt the modern era or fall back to the handshake | `packages/client/src/client/client.ts:1130`; `packages/client/src/client/versionNegotiation.ts:465` |
| `pin` | target one revision and never fall back | `packages/client/src/client/versionNegotiation.ts:90` |
| `prior` | a host-supplied cached verdict skips the probe entirely | `packages/client/src/client/client.ts:1302`; `packages/client/src/client/probeClassifier.ts:109` |

The probe is deliberately conservative: a network failure or a 5xx is a connect error, never an era verdict, and an auth wall is classified as auth so a cached verdict cannot be minted from an unauthorised exchange (`packages/core-internal/src/errors/sdkErrors.ts:78`).

## One server-served request

1. `createMcpHandler(factory)` returns `{ fetch, close, notify, bus }`; `fetch` is the whole HTTP surface (`packages/server/src/server/createMcpHandler.ts:228`).
2. Each call classifies the inbound body: a modern envelope is served by a per-request transport and instance, a legacy body by the stateless fallback leg unless the option rejects it (`:145`).
3. The transport hands the message to a `Server` instance; handlers registered in the factory run with a context that carries the era, auth info, request meta, progress notifier and abort signal.
4. The result goes back through the same per-request transport, as JSON or SSE according to `responseMode` and whether the handler emitted anything before its result.
5. Sessionful wiring is still possible by mounting a transport yourself; the entry's default posture deliberately holds nothing between requests.

## State and persistence

| state | owner | lifetime |
|---|---|---|
| negotiated version, server capabilities, instructions | client instance | one connection |
| MCP session id | HTTP transport | until `DELETE` or server close |
| resumption token and event store | server entry; client keeps the token | reconnectable stream |
| response cache entries | client, in memory by default | TTL from the server hint, capped at 24 hours |
| era verdict | the host, passed back as `prior` | host policy; the SDK never expires it |
| multi-round-trip `requestState` | server handler, optionally sealed by a codec | one retried call |
| subscription stream | client handle; server bus | until either side closes |
| server instance | per request by default; per connection when sessionful | the request or the connection |

## Transport and streaming

| transport | shape | session and resumption | cancellation |
|---|---|---|---|
| Streamable HTTP | one POST per message; a JSON response or an SSE stream per request; an optional standalone GET stream | `mcp-session-id`; `last-event-id` resumes a dropped stream; `DELETE` terminates | abort the per-request stream on the modern era, else send `notifications/cancelled` |
| stdio | newline-delimited JSON over the child's stdin and stdout | none; EOF ends the connection | the same notification rule; the transport also owns process teardown |
| legacy HTTP+SSE | a GET event stream plus a POST endpoint | none | as stdio |
| in-memory | a linked pair of transports in one process | none | as stdio |

The HTTP transport is the most opinionated file in the client: it mirrors body fields into headers, keeps the session id in a case-insensitive map, follows only same-origin redirects that preserve method and userinfo, and treats a 405 on the standalone stream as normal (`packages/client/src/client/streamableHttp.ts:478`, `:488`, `:575`, `:1249`).

The stdio transport is small but careful: it inherits only a safelisted environment by default, drops values that look like a shell function, passes stderr through as a separate stream, and escalates `SIGTERM` to `SIGKILL` on close (`packages/client/src/client/stdio.ts:10`, `:54`, `:233`).

## Where the era split costs most

- The envelope is a cross-cutting concern: every outbound request and notification may need `_meta`, and every inbound one must be screened for era membership (`packages/core-internal/src/shared/envelope.ts:13`).
- Cancellation has two mechanisms with different wire consequences, so the protocol core carries a branch that no single-era client needs (`packages/core-internal/src/shared/protocol.ts:1435`).
- Server-to-client requests survive only on the old era; on the new one a handler returns an `input_required` result and the client's driver retries, which is why both a push channel and a round-trip engine exist.
- Probe classification is a state machine of its own, with a stdio path that spawns a sibling process and an HTTP path that must not be mistaken for an auth failure.

## Build and test stack

pnpm workspaces with project references; each package builds dual ESM and CJS through tsc, and the root exports map is checked by a topology pin. Unit suites sit beside each package (220 test files), the end-to-end suite hosts every transport and both handler arms in process, and the conformance harness runs an externally pinned package against the SDK's own everything-server and everything-client.

The testing idea worth noting is that behaviour is data. `test/e2e/requirements.ts:15` is a manifest of 480 requirements, each naming the spec clause it comes from; scenario files cite requirement ids, known failures are recorded rather than skipped, and a coverage gate rejects an uncited requirement. Separately, a set of pins freezes consumer-visible boundaries such as error codes, export maps and the stdio environment list (`clone:/docs/behavior-surface-pins.md:1`).