# mcp-typescript-sdk — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status vocabulary: `implemented` means a path was traced from a public entry point into the code that acts; `declared` means a documentation page, type or manifest claims it and no path was traced; `inferred` marks reasoning from structure. Paths are relative to `reference/competitors/mcp-typescript-sdk/`. Documentation pages are cited from the clone with a line, and the published copies sit at https://ts.sdk.modelcontextprotocol.io/v2/ (read 2026-10-21).

## Lifecycle and version negotiation
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| handshake | implemented | `packages/client/src/client/client.ts:1004`, `:1057` | `connect()` starts the transport, sends `initialize` with the newest revision the client supports, then stores the server's version, capabilities and instructions |
| supported revisions | implemented | `packages/core/src/constants.ts:1` to `:3` | five revisions from `2024-10-07` to `2025-11-25`; the list is a constant so both sides agree on what `initialize` may return |
| discover request | implemented | `packages/client/src/client/client.ts:1575` | the modern era's `server/discover` call, returning an advertisement a host could persist |
| probe and adopt | implemented | `packages/client/src/client/client.ts:1130`, `:1150`, `:1187`; `packages/client/src/client/versionNegotiation.ts:356`, `:437` | an opt-in `auto` mode asks whether the peer speaks the new era, then either adopts the envelope path or falls back to the handshake |
| conservative verdicts | implemented | `packages/client/src/client/probeClassifier.ts:130`; `packages/core-internal/src/errors/sdkErrors.ts:65` | network failures and 5xx are connect errors, auth walls are auth errors; neither becomes an era verdict, so a host cannot cache a wrong decision |
| pinning | implemented | `packages/client/src/client/versionNegotiation.ts:96`, `:132` | a caller can demand one revision and refuse to fall back, which is what a gateway fronting known servers wants |
| cached verdict | implemented | `packages/client/src/client/client.ts:1302`; `packages/client/src/client/probeClassifier.ts:109` | a host replays a `DiscoverResult` as `prior` and skips the probe; expiry is left to the host |
| era on the wire | implemented | `packages/client/src/client/client.ts:722`, `:1397`; `packages/core-internal/src/types/spec.types.2026-07-28.ts:74` | the modern era stamps `_meta` on every request and notification; the negotiated era is readable from the client |
| era-exact screening | implemented | `packages/client/src/client/client.ts:699`, `:838` | an inbound method the era lacks is dropped; a handler is validated against the era before it runs |
| capability gating | implemented | `packages/client/src/client/client.ts:1422`, `:1493`, `:1524` | per-method server capability, per-notification capability, and per-request-handler client capability, each with its own error |
| ping | implemented | `packages/client/src/client/client.ts:1567` | answered automatically on both sides; useful as a liveness check with its own timeout |
| server identity accessors | implemented | `packages/client/src/client/client.ts:1347`, `:1357`, `:1406` | capabilities, implementation and instructions are exposed after connect and undefined before it |
| experimental capabilities | declared | `test/e2e/requirements.ts:71`; `packages/core-internal/src/types/spec.types.2026-07-28.ts:781` | vendor-namespaced capability entries survive the handshake and stay readable on the capability object |

## Tools
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| list | implemented | `packages/client/src/client/client.ts:2556` | aggregates every page into one list; an explicit `cursor` returns that page raw |
| pagination bound | implemented | `packages/client/src/client/client.ts:1772`, `:1791`; `packages/core-internal/src/errors/sdkErrors.ts:56` | a 64-page default cap plus a no-progress break; exhaustion is a typed error rather than a truncated list |
| call | implemented | `packages/client/src/client/client.ts:2372` | validates the server advertised tools, resolves the tool definition, sends `tools/call` and returns content, structured content and the error flag |
| structured results | implemented | `packages/client/src/client/client.ts:2426`, `:2495`, `:2503` | when the tool declares an output schema the result must carry `structuredContent`, and it is validated against the schema before the caller sees it |
| validator pre-compilation | implemented | `packages/client/src/client/client.ts:2426` | the output validator is compiled once per definition, so a large schema does not recompile on every call |
| header mirroring | implemented | `packages/client/src/client/client.ts:2390` to `:2416` | arguments marked `x-mcp-header` become `Mcp-Param-*` headers on the modern era, with one refresh-and-retry on a mismatch |
| definition exclusion | implemented | `packages/client/src/client/client.ts:2601` | header-annotated parameters are stripped from the listed input schema and surfaced separately, so a schema-driven UI does not render them as body fields |
| tool annotations | declared | `clone:/docs/servers/tools.md:195` | read-only, destructive and open-world hints travel with the tool; the SDK passes them through rather than interpreting them |
| tool errors | implemented | `packages/client/src/client/client.ts:2372`; `clone:/docs/servers/errors.md:64` | a failed tool call is an ordinary result with `isError`; the server converts any thrown exception into that shape |
| multi-content results | declared | `clone:/docs/servers/tools.md:134` | text, image, audio, embedded resource and resource link blocks can be mixed in one result |
| input schemas | declared | `clone:/docs/get-started/packages.md:35` | Standard Schema accepts Zod, Valibot or ArkType; the server derives the advertised JSON Schema |
| per-call timeout | implemented | `packages/core-internal/src/shared/protocol.ts:103`, `:1582` | 60 seconds by default, overridable per request; expiry rejects with a timeout code |
| progress | implemented | `packages/core-internal/src/shared/protocol.ts:112`, `:1446`; `packages/client/src/client/client.ts:2372` | passing `onprogress` injects a progress token and routes matching notifications to the callback |
| cache-aware call | implemented | `packages/client/src/client/client.ts:1902` | the cached `tools/list` entry supplies the definition when the caller does not, which is why listing is not purely a convenience |

## Resources
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| list and templates | implemented | `packages/client/src/client/client.ts:1668`, `:1694` | two verbs, both auto-aggregating; templates return URI patterns rather than instances |
| read | implemented | `packages/client/src/client/client.ts:1920`, `:1926` | returns `contents` with text or base64 blob and a MIME type; the read is cacheable and generation-guarded |
| subscribe | implemented | `packages/client/src/client/client.ts:1960`, `:1965` | the old era's per-URI subscribe and unsubscribe; the notification they enable is `notifications/resources/updated` |
| listen filter | implemented | `packages/client/src/client/client.ts:1991` | the new era replaces per-resource subscribe with one filtered stream naming list-change types and specific URIs |
| honoured filter | implemented | `packages/client/src/client/client.ts:1991`; `clone:/docs/clients/subscriptions.md:32` | the server narrows the requested filter to its advertised capabilities and returns the subset it will deliver |
| stream closure | declared | `clone:/docs/clients/subscriptions.md:54` to `:67` | `closed` resolves once with local, graceful or remote, and the SDK does not silently re-listen |
| server registration | declared | `clone:/docs/servers/resources.md:9`, `:89` | static resources and URI templates with a list callback, a read callback and per-resource metadata |
| per-resource hints | declared | `clone:/docs/servers/resources.md:215`; `clone:/docs/clients/caching.md:45` | a resource can carry a cache hint that overrides the verb-level hint, field by field |
| resource errors | declared | `clone:/docs/servers/errors.md:115` | a missing URI raises a typed not-found error that becomes a JSON-RPC error, not a tool error |

## Prompts and completion
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| list | implemented | `packages/client/src/client/client.ts:1628` | advertises prompts with their argument names and descriptions |
| get | implemented | `packages/client/src/client/client.ts:1598` | fills arguments and returns messages ready for a model, including image and resource content |
| complete | implemented | `packages/client/src/client/client.ts:1582` | suggestions for a prompt argument or a resource-template variable, with the reference kind and partial value |
| completable arguments | declared | `packages/server/src/server/completable.ts`; `clone:/docs/servers/completion.md:8` | wrapping one schema field registers the completion handler and advertises the capability without further wiring |
| prompt errors | declared | `clone:/docs/servers/errors.md:102` | a prompt callback has no error flag, so a bad request is a protocol error |

## Server-initiated requests and multi-round-trip
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| sampling | implemented, deprecated | `packages/client/src/client/client.ts:1524`; `clone:/docs/servers/sampling.md:6` | a server handler asks the client's model for a completion; deprecated by SEP-2577 in favour of calling a provider directly |
| elicitation, form mode | implemented | `packages/client/src/client/client.ts:165`, `:1524`; `clone:/docs/servers/elicitation.md:8` | a flat primitive schema the host renders as a form; the accepted content is validated against it before the promise resolves |
| elicitation, url mode | implemented | `packages/client/src/client/client.ts:165`; `clone:/docs/servers/elicitation.md:165` | host opens a URL and reports completion; opt-in inside the capability object, form mode is the default |
| roots | implemented, deprecated | `packages/client/src/client/client.ts:2681`; `clone:/docs/clients/roots.md:6` | the client answers `roots/list` with file URIs; deprecated with nothing replacing it on the new era |
| input_required result | implemented | `packages/core-internal/src/shared/protocol.ts:157`, `:1542`; `packages/server/src/index.ts:108` | a handler returns the requests it needs instead of pushing them; the client answers and retries the call |
| auto-fulfilment | implemented | `packages/client/src/client/client.ts:259`; `packages/core-internal/src/shared/inputRequiredDriver.ts:81`, `:229` | the client's driver runs those rounds against the handlers already registered; ten rounds by default, or manual mode per call |
| round cap | implemented | `packages/core-internal/src/errors/sdkErrors.ts:47` | exhaustion is a typed error carrying the cap and the last payload, so a caller can resume manually |
| capability check before wire | declared | `clone:/docs/servers/input-required.md:51` | an embedded request for a capability the client never declared fails with a dedicated code before transmission |
| request state | implemented | `packages/server/src/index.ts:60`; `packages/server/src/server/requestStateCodec.ts` | the handler's cross-round state can be sealed with an HMAC codec so the client cannot read or forge it |

## Notifications and subscriptions
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| handlers | implemented | `packages/core-internal/src/shared/protocol.ts:1838`, `:616` | one registration per method plus a fallback for unknown notifications; the same registrations serve both delivery paths |
| debouncing | implemented | `packages/core-internal/src/shared/protocol.ts:97`, `:1639` | a configurable list of notification methods is coalesced, which suits list-changed bursts |
| list-changed handling | implemented | `packages/client/src/client/client.ts:430` to `:434`, `:1274` | the `listChanged` option opens the stream, re-fetches on change and also evicts the matching cache entries |
| auto-opened stream | implemented | `packages/client/src/client/client.ts:1274`; `clone:/docs/clients/subscriptions.md:103` | the SDK intersects configured types with advertised capabilities and exposes the handle on the client |
| server senders | declared | `clone:/docs/servers/notifications.md:27` | typed senders for the three list-changed notifications plus resource updates; registration handles notify on their own |
| capability requirement | declared | `clone:/docs/servers/notifications.md:70` | the low-level server refuses to send a notification its declared capabilities do not cover |
| event bus | declared | `packages/server/src/server/serverEventBus.ts:41` | publish and subscribe seam; in-memory by default, replaceable for multi-process fan-out |
| handler notification facade | declared | `clone:/docs/servers/notifications.md:74` | on the stateless HTTP entry the instance is per request, so updates are published through the handler instead |

## Response caching
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| server hints | declared | `clone:/docs/clients/caching.md:29` | each cacheable result carries `ttlMs` and `cacheScope`; with no hint the SDK emits a zero TTL and no client caches it |
| cacheable verbs | implemented | `packages/client/src/client/client.ts:1628`, `:1668`, `:1694`, `:1920` | the four list verbs and resource read consult the cache before sending |
| per-call modes | implemented | `packages/client/src/client/client.ts:183` | use, refresh or bypass, exposed through a per-call option rather than a separate API |
| store seam | implemented | `packages/client/src/client/responseCache.ts:92` | five methods, all allowed to be async, so a shared or persistent store is a drop-in |
| bounds | implemented | `packages/client/src/client/responseCache.ts`; `clone:/docs/clients/caching.md:48` | a 24-hour TTL cap and a default in-memory size bound keep a misbehaving server from pinning entries |
| partitioning | implemented | `packages/client/src/client/client.ts:183`; `clone:/docs/clients/caching.md:69` | private entries are keyed by caller partition so a shared store cannot leak one caller's resource bodies to another |
| invalidation | implemented | `packages/client/src/client/client.ts:430` | list-changed notifications drop list entries and resource-updated notifications drop that URI |
| opt-in default TTL | implemented | `packages/client/src/client/client.ts:183`; `clone:/docs/clients/caching.md:83` | against servers that send no hints, a client-level default is the only way to cache |

## Authorisation
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| bearer provider | implemented | `packages/client/src/client/auth.ts:81`; `packages/client/src/client/streamableHttp.ts:488` | one method returns a token; the transport attaches it and retries once after a 401 when a refresh hook exists |
| OAuth provider | implemented | `packages/client/src/client/auth.ts:248` | a browser-capable flow: redirect, state, PKCE verifier, client information and token persistence, each a caller-supplied method |
| discovery | implemented | `packages/client/src/client/auth.ts:1824`, `:1979` | protected-resource metadata then authorisation-server metadata, following the two RFCs and tolerating one trailing-slash difference |
| dynamic registration | implemented | `packages/client/src/client/auth.ts:248`; `clone:/docs/clients/oauth.md` | a provider may save and reuse client information, or publish a client metadata document instead |
| issuer validation | implemented | `packages/client/src/client/auth.ts:999`, `:163` | the callback's `iss` is checked against the recorded issuer before a code is redeemed, and stored credentials are stamped per issuer |
| scope step-up | implemented | `packages/client/src/client/auth.ts:1033`, `:1028` | a 403 naming a wider scope forces a fresh authorisation rather than a refresh, because a refresh grant cannot widen scope |
| token endpoint hardening | implemented | `packages/client/src/client/auth.ts:889` | a plaintext token endpoint is refused unless it is loopback, which is the one place a secret could leak in transit |
| DPoP | implemented | `packages/client/src/client/dpop.ts`; `packages/client/src/client/middleware.ts:149` | proof-of-possession wraps the transport fetch and upgrades the bearer header, handling nonce challenges |
| machine flows | declared | `packages/client/src/client/authExtensions.ts:168`, `:308`, `:632` | client credentials, private-key JWT and cross-app access providers, each with an expected issuer |
| typed auth errors | implemented | `packages/client/src/client/authErrors.ts` | issuer mismatch, insufficient scope, rejected registration and insecure endpoint each have a class, so a host can branch without string matching |
| server verification | declared | `packages/server/src/index.ts:42`; `clone:/docs/serving/authorization.md` | bearer verification, a scope challenge helper and a metadata response helper; the server never reads or verifies tokens itself |

## Transports
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| Streamable HTTP | implemented | `packages/client/src/client/streamableHttp.ts:488`, `:530`, `:575`, `:990` | one POST per message, JSON or SSE response, optional standalone GET stream, session header, bearer token, body-derived headers |
| resumption | implemented | `packages/client/src/client/streamableHttp.ts:1007`, `:1301` | a dropped stream can resume from the last event id the server issued |
| session teardown | implemented | `packages/client/src/client/streamableHttp.ts:967` | DELETE ends the server session; a 405 is tolerated because not every server implements it |
| redirect policy | implemented | `packages/client/src/client/streamableHttp.ts:478` | only same-origin redirects that keep method and userinfo are followed; a downgrade to plain http is surfaced, not followed |
| stdio | implemented | `packages/client/src/client/stdio.ts:10`, `:136`, `:233` | spawns the command, inherits a safelisted environment, streams stderr separately, escalates termination |
| legacy SSE | implemented | `packages/client/src/client/sse.ts:155` | the pre-Streamable-HTTP two-endpoint transport, kept for old servers and recommended only as a fallback |
| in-memory | implemented | `packages/core-internal/src/util/inMemory.ts:16` | a linked pair for tests and embedded hosting |
| reconnection policy | implemented | `packages/client/src/client/streamableHttp.ts:101` to `:142` | initial delay, growth factor, retry count and an injectable scheduler |
| auth on transport | implemented | `packages/client/src/client/streamableHttp.ts:175`, `:619` | either provider shape is accepted, and a 401 triggers the provider's refresh before one retry |

## Errors and diagnostics
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| local error codes | implemented | `packages/core-internal/src/errors/sdkErrors.ts:11` to `:99` | string codes for state, capability, transport and HTTP failures; a `SdkHttpError` carries the HTTP status |
| protocol errors | declared | `clone:/docs/servers/errors.md:100` | a `ProtocolError` with a numeric JSON-RPC code crosses the wire; non-protocol exceptions become internal errors |
| result validation errors | implemented | `packages/core-internal/src/shared/protocol.ts:1570`; `packages/core-internal/src/errors/sdkErrors.ts:32` | a result that fails local schema validation rejects as an invalid result rather than flowing on as `unknown` |
| unsupported result kinds | implemented | `packages/core-internal/src/errors/sdkErrors.ts:38`, `:47` | a result kind the client cannot consume, or an exhausted round budget, is a typed rejection carrying the payload |
| era mismatch | implemented | `packages/core-internal/src/errors/sdkErrors.ts:64` | calling a method the negotiated era lacks fails locally with the method and era attached |
| connection teardown | implemented | `packages/core-internal/src/shared/protocol.ts`; `clone:/docs/clients/connect.md:110` | closing rejects in-flight requests with a closed-connection code instead of leaving promises pending |

## Server authoring
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| registration API | implemented | `packages/server/src/server/mcp.ts:112`; `packages/server/src/index.ts:38` | tools, resources and prompts register with schemas and callbacks; each returns a handle |
| mutation handles | declared | `clone:/docs/servers/notifications.md:41` | update, enable, disable and remove each emit the matching list-changed notification |
| capability advertisement | declared | `clone:/docs/servers/notifications.md:64` | the high-level server advertises a capability when something registers; the low-level server requires an explicit declaration |
| HTTP entry | implemented | `packages/server/src/server/createMcpHandler.ts:681`, `:228` | a factory per request behind a `fetch` function, with `close`, `notify` and `bus` on the handle |
| legacy serving postures | implemented | `packages/server/src/server/createMcpHandler.ts:145` to `:168` | stateless legacy fallback by default, or reject legacy outright; hand-wired routing uses the classification predicate |
| response shaping | implemented | `packages/server/src/server/createMcpHandler.ts:171` to `:183` | auto, sse or json; json drops mid-call notifications and keeps the terminal result |
| size and keepalive bounds | implemented | `packages/server/src/server/createMcpHandler.ts:199` to `:215` | a 4 MiB body bound, a subscription cap and an SSE keepalive interval |
| stdio entry | implemented | `packages/server/src/server/serveStdio.ts:375` | one instance pinned per connection, owned transport, `close()` on the handle |
| request context | implemented | `packages/server/src/server/createMcpHandler.ts:93` | era, auth info, request info and per-request notifier reach the factory and the handler |
| origin and host guards | declared | `clone:/docs/serving/http.md:85` | Host and Origin checks are opt-in helpers placed in front of the handler, aimed at DNS rebinding on loopback binds |
| auth pass-through | declared | `clone:/docs/serving/http.md:91` | the handler never verifies a token; a verified `AuthInfo` is supplied to `fetch` and reaches handlers |
| cache hints | declared | `clone:/docs/clients/caching.md:33` | server options attach a TTL and scope to named cacheable results |

## Middleware and extensions
| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| client middleware | implemented | `packages/client/src/client/middleware.ts:14`, `:369` | a fetch wrapper composed around a transport, with logging, OAuth adaptation and DPoP variants supplied |
| skills extension | declared | `packages/client/src/ext/skills/`; `clone:/docs/clients/skills.md` | a namespaced catalogue extension with discovery, paging and reload |
| custom methods | declared | `clone:/docs/advanced/custom-methods.md` | handlers and schemas can be registered outside the specification's method set |
| migration packages | implemented | `packages/server-legacy/`, `packages/codemod/` | v1's SSE transport and authorisation-server helpers frozen, plus an import rewriter |

## Notable implementation notes

- Listing is not only a convenience: the client caches a tool definition so `callTool` can build headers and validate structured output without a second request (`packages/client/src/client/client.ts:1902`).
- The response cache is present on every client yet inert by default, because a result without a server hint carries a zero TTL (`clone:/docs/clients/caching.md:85`).
- The probe for the new era may spawn a sibling process on stdio, which is a costly mechanism kept behind an opt-in mode (`packages/client/src/client/versionNegotiation.ts:590`).
- Three capabilities are already deprecated upstream: sampling, roots and the logging-level setter (`clone:/docs/protocol-versions.md`; `packages/client/src/client/client.ts:1593`).
- Tool argument validation and tool result validation happen on opposite sides: the server validates input, the client validates output when it knows the schema.
- Error taxonomy is split by audience: string-coded local errors for the developer, numeric-coded protocol errors for the model or the host.
- Documentation examples are extracted from compiled source via `source=` markers, so a doc snippet that no longer typechecks fails the build (`clone:/docs/clients/calling.md:12`).
- The end-to-end suite treats known failures as expected passes, so a fix flips a test from pass to fail until the manifest entry is removed (`test/e2e/CLAUDE.md`).