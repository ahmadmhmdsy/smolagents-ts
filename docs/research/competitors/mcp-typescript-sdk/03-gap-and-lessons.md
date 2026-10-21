# mcp-typescript-sdk — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Rows are bucketed against the MCP section of the capability baseline measured 2026-10-21 (`docs/research/competitors/_synthesis/00-our-baseline.md:128` to `:134`). Each row names the baseline id it extends, what matching would mean, the seam a change lands behind, and an effort from the method's scale. Neighbour evidence is cited relative to `reference/competitors/mcp-typescript-sdk/`.

## Reading the buckets

The buckets answer different questions, and mixing them is how a research note turns into an unprioritised wish list. A rows are engineering we could schedule against a shipped seam. B rows are declines with a reason. C rows are decisions we have not taken, so their price is dominated by the decision rather than the code. D rows are quality work on something already present.

Two rules applied while pricing. First, a row is priced at the seam named in the baseline, not at the size of the neighbour's implementation: their OAuth module is 2,352 lines because it serves every RFC variant, while our seam would need a provider interface and a refresh hook. Second, a row that would require a second protocol era is priced L regardless of line count, because the compatibility cost is paid by every later change as well.

## Bucket A — roadmap follow-ons

These extend the MCP client seam we already ship. They are priced, not committed.

| gap | neighbour evidence | baseline | what matching means | seam | effort |
|---|---|---|---|---|---|
| resource reads | `packages/client/src/client/client.ts:1668`, `:1694`, `:1920` | `MC-03` | list, template list and read, returning text or blob contents with a MIME type | the verb surface next to the tool verbs in `packages/mcp/src/client.ts` | M |
| prompt reads | `packages/client/src/client/client.ts:1598`, `:1628` | `MC-03` | list prompts with arguments, then fetch a filled prompt as model-ready messages | the same verb surface | S |
| completions | `packages/client/src/client/client.ts:1582` | `MC-03` | suggestions for a prompt argument or resource-template variable while the user types | the same verb surface, plus a request shape | M |
| bounded list aggregation | `packages/client/src/client/client.ts:1772`, `:1791`; `packages/core-internal/src/errors/sdkErrors.ts:56` | `MC-01` | a no-cursor list call walks every page and returns one list, with a cap and a typed failure on a non-terminating server | `listTools` in `packages/mcp/src/client.ts` | S |
| structured tool results | `packages/client/src/client/client.ts:2495`, `:2503`, `:2426` | `MC-02` | a result with structured content is validated against the advertised output schema, and a missing or mismatched body rejects | `packages/mcp/src/tool-adapter.ts` | S |
| tool definition reuse | `packages/client/src/client/client.ts:1902`, `:2390` | `MC-02` | the cached listing entry supplies per-call metadata so a call does not need a fresh list round trip | the adapter's tool registry | S |
| capability gating | `packages/client/src/client/client.ts:1422`, `:1524`; `packages/core-internal/src/errors/sdkErrors.ts:22` | `MC-01` | a verb the server never advertised fails locally with a capability error, not a remote method-not-found | one assertion table shared by the verbs | S |
| request timeout | `packages/core-internal/src/shared/protocol.ts:103`, `:1582` | `MC-01` | 60 seconds by default, overridable per call, rejecting with a timeout code | the request funnel in `packages/mcp/src/json-rpc.ts` | S |
| progress reporting | `packages/core-internal/src/shared/protocol.ts:112`, `:1446` | `MC-05` | a per-call callback receives progress notifications, and the token is attached for the caller | the request funnel plus notification dispatch | S |
| cancellation | `packages/core-internal/src/shared/protocol.ts:1435`; `clone:/docs/servers/logging-progress-cancellation.md:144` | `MC-05` | a caller signal sends the cancellation notification, rejects the promise and reaches the server handler | the request funnel and both transports | S |
| notification dispatch | `packages/core-internal/src/shared/protocol.ts:1838`, `:1639` | `MC-05` | typed handlers per notification method with an optional debounce, replacing the bounded history | the notification path in `packages/mcp/src/client.ts` | M |
| list-changed refresh | `packages/client/src/client/client.ts:430`, `:1274` | `MC-05` | a changed list is re-fetched and handed to a callback, so a caller need not poll | the notification path plus the adapter's registry | M |
| typed local errors | `packages/core-internal/src/errors/sdkErrors.ts:11` | `MC-01` | local failures carry stable string codes and an HTTP status where relevant, so callers branch without parsing text | `packages/mcp/src/errors.ts` | S |
| per-URI subscription | `packages/client/src/client/client.ts:1960`, `:1965` | `MC-03` | the older era's subscribe and unsubscribe, feeding the same resource-updated notification | the verb surface | M |

## Bucket B — non-goals

Recorded because the neighbour ships them; decision 0018 keeps authoring out, and the deprecations make two more easy to decline.

| gap | neighbour evidence | baseline | position |
|---|---|---|---|
| MCP server authoring | `packages/server/src/server/mcp.ts:112`; `packages/server/src/server/createMcpHandler.ts:681` | `MC-07` | decision 0018 keeps it out; the neighbour shows the full cost — a registration API, two hosting entries, event bus and auth helpers |
| sampling and roots | `packages/client/src/client/client.ts:1524`, `:2681`; `clone:/docs/servers/sampling.md:6` | `MC-04` | deprecated upstream by SEP-2577, so building the push channel would be adopting a surface already on a retirement path |
| legacy HTTP+SSE transport | `packages/client/src/client/sse.ts:155` | `MC-01` | the neighbour keeps it only for servers that predate Streamable HTTP; our two transports cover current servers |
| authorisation-server implementation | `packages/server-legacy/` | `MC-06` | v2 itself keeps token issuing in a legacy package; verifying a caller's token is the maximum a client-side library needs |
| DPoP and cross-app access | `packages/client/src/client/dpop.ts`; `packages/client/src/client/authExtensions.ts:632` | `MC-06` | proof-of-possession and cross-app flows are enterprise authorisation products, not protocol minimums |
| skills extension | `packages/client/src/ext/skills/` | `MC-03` | a namespaced catalogue extension outside the specification; it would be a separate feature, not a verb |
| gateway and proxy helpers | `clone:/docs/advanced/gateway.md` | not in the baseline | deployment tooling for multi-server routing; a different product surface |

## Bucket C — unconsidered

Absent from our vocabulary at the baseline. These are the most informative rows and the ones that need a decision before they need code.

| gap | neighbour evidence | baseline | what matching means | seam | effort |
|---|---|---|---|---|---|
| era negotiation | `packages/client/src/client/client.ts:1130`, `:1302`; `packages/client/src/client/versionNegotiation.ts:132`, `:437` | `MC-01` | a connect-time decision about which wire revision a peer speaks, with probe, pin and cached-verdict modes | `connect()` in `packages/mcp/src/client.ts` | L |
| response cache | `packages/client/src/client/responseCache.ts:92`; `packages/client/src/client/client.ts:183` | `MC-01` | server-supplied TTL and scope honoured by a pluggable store, with per-call modes and eviction on change | the request funnel plus a store seam | M |
| subscription streams | `packages/client/src/client/client.ts:1991` | `MC-05` | one filtered stream per connection carrying every opted-in change type, with an honoured-filter result and a close reason | the notification path | M |
| multi-round-trip input | `packages/core-internal/src/shared/protocol.ts:157`; `packages/core-internal/src/shared/inputRequiredDriver.ts:95` | `MC-04` | a handler returns the input it needs, the client answers and retries, and the SDK caps the rounds | the call path in `packages/mcp/src/client.ts` | L |
| elicitation | `packages/client/src/client/client.ts:165`, `:1524`; `clone:/docs/servers/elicitation.md:8` | `MC-04` | a form request the host renders and answers, validated against the flat schema | a handler surface on the client plus a host callback | M |
| OAuth client flow | `packages/client/src/client/auth.ts:81`, `:248`, `:1824` | `MC-06` | discovery, registration, PKCE, issuer checks, refresh and scope step-up behind a transport option | a transport option plus a provider interface in `packages/mcp/src/transports/` | L |
| client middleware | `packages/client/src/client/middleware.ts:14`, `:369` | `MC-01` | a fetch wrapper composed around a transport for logging, auth and proof-of-possession | the transport constructor | M |
| transport resumption | `packages/client/src/client/streamableHttp.ts:1007`, `:1301` | `MC-01` | a dropped stream resumes from a server-issued event id instead of losing the in-flight request | `packages/mcp/src/transports/http.ts` | M |

## Bucket D — depth gaps

| gap | neighbour evidence | baseline | what matching means | seam | effort |
|---|---|---|---|---|---|
| stdio hardening | `packages/client/src/client/stdio.ts:10`, `:54`, `:233` | `MC-01` | a safelisted environment, a separate stderr channel and an escalated teardown sequence | `packages/mcp/src/transports/stdio.ts` | S |
| session lifecycle | `packages/client/src/client/streamableHttp.ts:967`, `:1249` | `MC-01` | explicit session termination, tolerance for a server that answers 405, and a closed-connection rejection for in-flight calls | `packages/mcp/src/transports/http.ts` | S |
| error surface | `packages/core-internal/src/errors/sdkErrors.ts:11`; `clone:/docs/servers/errors.md:144` | `MC-01` | one error taxonomy that separates local failures, protocol errors and tool errors by audience | `packages/mcp/src/errors.ts` | S |
| notification history | `packages/core-internal/src/shared/protocol.ts:1838`, `:616` | `MC-05` | a handler registration model and a fallback, instead of a bounded buffer a caller polls | `packages/mcp/src/client.ts` | S |

## Pricing notes

- `S` rows are additions inside one file or one table, testable through the in-memory transport the MCP package already uses in its own tests.
- `M` rows add a public type or a store seam, so they carry a documentation and compatibility cost beyond the code.
- `L` rows change the connect or call path for every caller: era negotiation, the OAuth flow and multi-round-trip fulfilment all qualify.
- Effort excludes tests and docs in every row; the neighbour's ratio suggests tests roughly match source for the protocol core, which is the number to budget against.

## The three rows that matter most

**Resources, prompts and completions.** This is the only part of the specification a caller of ours cannot reach at all, and the neighbour shows it is three verbs and two result shapes, not a subsystem. A resource read is a list-shaped call with text or base64 contents; a prompt get is a template plus arguments producing messages; a completion is one request with a reference and a partial value. The pricing is dominated by result types, not by transport or protocol work.

**Bounded aggregation and capability gating.** Both are small, and both prevent a class of failure we currently push onto callers: a server that paginates forever, or a verb called against a server that never advertised it. The neighbour treats each as a typed error with the offending method attached (`packages/core-internal/src/errors/sdkErrors.ts:22`, `:56`), which is the difference between a debuggable failure and a hang.

**Era negotiation, cache and OAuth are a different size.** They are individually coherent and collectively the reason this SDK is 11,346 lines of client. None is justified by our current usage: we connect to servers we choose, through transports whose headers a caller already owns. They belong on a watch list with a trigger, not in a backlog.

## What we have that they lack

- An agent runtime: the neighbour has no loop, no model provider and no notion of a turn, so it cannot consume its own protocol the way our tool adapter does.
- Action interpretation and approval surfaces, which turn a tool call into something a host can pause, resume and audit.
- An execution sandbox and a UI layer; the neighbour's answer to both is an example project and a framework adapter.
- A single package with one dependency direction. Their split buys runtime neutrality and migration paths at the cost of nine packages, a private internal package and an exports map that is itself pinned by a test.

## Patterns worth copying

**Behaviour as data.** `test/e2e/requirements.ts:15` is a manifest of 480 requirements, each with the specification clause it comes from, and the scenario files cite ids rather than duplicating prose. Known failures are declared in the same entry, so a fix flips an expected pass to a failure until the entry is removed (`test/e2e/CLAUDE.md`). A coverage test rejects a requirement no scenario cites. For us this is a cheap way to make an MCP conformance table that survives refactors: one row per capability per transport, with the baseline id attached.

**Bounds with typed exhaustion.** Both the pagination walk and the multi-round-trip driver stop at a limit and raise an error carrying the limit and the method, instead of returning a partial result (`packages/client/src/client/client.ts:1772`, `:1791`; `packages/core-internal/src/errors/sdkErrors.ts:47`, `:56`). A partial list that looks complete is the failure mode we should design out.

**Definition reuse at call time.** Because the client kept the `tools/list` entry, `callTool` can validate structured output and build header metadata with no extra round trip (`packages/client/src/client/client.ts:1902`, `:2390`). Our adapter already holds a tool definition; the lesson is to keep it reachable from the call path rather than only from the model-facing wrapper.

**Capability assertions in one table.** `assertCapabilityForMethod` maps a method to the server capability it needs, including the `subscribe` sub-gate, and is consulted before every request (`packages/client/src/client/client.ts:1422`). One table beats a check inside each verb.

**Pins for consumer-visible boundaries.** Error codes, export maps, schema strictness and the stdio environment list are frozen by tests that fail on any drift, and the repo's rule is to update the pin in the same change rather than loosen it (`clone:/docs/behavior-surface-pins.md:1`). Our MCP package has no equivalent guard for its request and error shapes.

## Patterns to avoid

**Negotiation machinery that spawns processes.** The stdio probe starts a sibling process to ask a question the real channel could answer, which is a lot of moving parts for an opt-in mode (`packages/client/src/client/versionNegotiation.ts:590`). If we ever negotiate, do it with the channel we already have.

**Two wire eras in one API.** The cost is visible: a cancellation branch with two mechanisms (`packages/core-internal/src/shared/protocol.ts:1435`), an envelope helper on every send, inbound screening, a 746-line support page and a migration guide. We should pick an era and make the boundary explicit rather than absorb both.

**Features that are on but inert.** Every client constructs a response cache, and it does nothing until a server sends a hint (`clone:/docs/clients/caching.md:85`). A reader cannot tell from the API whether caching is active. Our equivalent choice should be opt-in and visible.

**Call paths that depend on cached side data.** Header mirroring and output validation both need the tool definition inside `callTool`, including a refresh-and-retry when the header set disagrees (`packages/client/src/client/client.ts:2444`). It works, but it makes a verb depend on the freshness of an unrelated listing.

**Deprecated surfaces kept fully functional.** Sampling, roots and the logging setter remain implemented with a twelve-month window, which grows the compatibility matrix for a feature the specification has already replaced. We should not add one of these without a removal plan.

**Exposing hosting postures as options.** `legacy: 'stateless' | 'reject'` plus a classification predicate puts deployment strategy in the handler's signature (`packages/server/src/server/createMcpHandler.ts:145`, `:622`). Our library should keep hosting choices in the host, not the client or adapter API.

## What it should change for us

1. Add resource, prompt and completion verbs behind the same transport the tool verbs use, with result types as the bulk of the work and no new protocol layer.
2. Land capability gating and the typed error surface first, because every new verb needs both and retrofitting them is a breaking change.
3. Bound the list calls we already make: aggregate pages, cap the walk, and fail with an error that names the method and the cap.
4. Give `callTool` a per-call timeout, a progress callback and a cancellation signal, since those are three small additions to the existing request funnel.
5. Validate structured tool output when the definition carries an output schema, and require the field only then.
6. Keep era negotiation, response caching, subscription streams and OAuth out of scope for now, each with a written trigger that would reopen it.
7. Decline sampling and roots permanently on the deprecation evidence, and treat elicitation as a host-UI feature rather than a protocol feature.
8. Leave MCP server authoring to decision 0018, and cite the neighbour's nine-package split as the cost of the alternative.

No baseline correction came out of this read. One nuance: the baseline note that our authentication is left to the caller's transport matches the neighbour's own minimal `AuthProvider` seam (`packages/client/src/client/auth.ts:81`), so the gap is the OAuth flow above that seam rather than the token plumbing itself.