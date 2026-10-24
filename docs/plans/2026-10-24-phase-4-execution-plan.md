# Phase 4 — protocol and tool breadth: execution plan

**Date:** 2026-10-24 · **Status:** in progress · **Owner:** lead · **Parent:**
[apply the competitor findings](2026-10-22-apply-the-competitor-findings-plan.md), rows 4.1–4.8.

**Contract**
- **Role:** the working plan for Phase 4 — item order, the design each item lands, and the
  acceptance tests registered before any code is written.
- **Mutability:** history plus a live checklist. Append to `## Changes` when an item lands or a
  criterion proves wrong; never rewrite a landed entry.
- **Read when:** executing or reviewing Phase 4.
- **Update when:** an item lands, a registered test turns out wrong about its design, or the phase closes.

## Why this phase

Phases 1 to 3 made one run durable, a second agent part of that durability, and the history
itself durable. Phase 4 widens the edges. The MCP client stops being a tool lister and speaks the
protocol's other verbs; tool availability becomes data a caller writes down; a generator tool
reports while it works; a remote guest receives declared tools and values; the E2B backend grows
the options a hosted sandbox really has; and the Docker backend stops polling a Jupyter kernel and
reaches its guest over `docker exec`. Done when the edges are honest: a capability a peer never
declared is refused by name, a tool the model may not see is absent rather than failing silently,
progress is visible while it happens, and a guest reaches a host tool only because a transfer said
so.

## Invariants

1. **Declared, then refused by name.** A capability or option a peer does not have is refused
   with a typed error naming it — before I/O where that is possible — never accepted and ignored.
2. **Additive on every surface.** Each new option defaults to today's behaviour: no run filters
   its tools, no MCP call sends a progress token, no transfer changes the shim, and no E2B or
   Docker option is required unless a caller asks for it.
3. **Policy is data and reaches every view.** A hidden tool is absent from the prompt, the
   request's tool specs, the executor's registry and the lookup that runs it, because one
   registry view feeds all four.
4. **Progress is advisory.** `action.progress` never ends a run and never changes a tool's
   result: a generator's return value is the result, its yields are the progress. The trace keeps
   a bounded count, not every value.
5. **No test needs a live peer.** MCP, Docker and E2B are driven through an injected transport, a
   fake runtime and a fake client; a green suite proves the seam, not a daemon or a hosted
   sandbox.
6. **No item's implementation starts before its pre-registered test has been watched failing.**

## Pre-registered acceptance tests

| item | test file | cases that must fail first |
|---|---|---|
| 4.1 | `packages/mcp/test/client-depth.test.ts` (11th mcp file), plus one case in `packages/mcp/test/http-transport.test.ts` | the handshake reads the server's `capabilities` and keeps them per connection; `getTools()` against a server that declared no tools capability rejects with `MCPCapabilityError` naming server and capability, and no `tools/list` reaches the transport; a server that answers `nextCursor` forever stops at `maxListPages` with `MCPListLimitError` naming the method and server; a non-2xx HTTP answer raises `MCPHttpStatusError` carrying the status and the method; a 404 carrying a session id clears the id, re-handshakes and retries the request once, and the retry carries the new session id; a second 404 after that re-handshake propagates instead of looping |
| 4.2 | `packages/mcp/test/resources.test.ts` (12th mcp file) | `listResources` and `readResource` return the typed shapes and walk two pages; `listPrompts` and `getPrompt` return a prompt's messages and arguments; `complete` returns the server's completion values; each verb is gated on its own capability with `MCPCapabilityError` and no wire call when it is absent; the `server` option selects one connection among two; two reads of the same resource make two requests (nothing is cached) |
| 4.3 | `packages/mcp/test/notifications.test.ts` (13th mcp file) | a `tools/call` carries `_meta.progressToken` and the server's `notifications/progress` for that token reaches the call's progress sink; the same notification reaches a client-wide listener typed as a progress notification, and an unsubscribe stops delivery; an aborted call sends `notifications/cancelled` with the request id and rejects; a second call's token does not receive the first call's progress; a `notifications/tools/list_changed` arrives as the typed list-changed notification and still marks the list stale |
| 4.4 | `packages/core/test/tool-policy.test.ts` (55th core file) | merge precedence: an allowed set intersects, hidden unions by name, a forced name outside allowed is dropped with a reason; a hidden tool is absent from the prompt, from the request's tool specs and from the registry the executor receives, and a scripted call to it yields `action.failed` with code `AGENT_TOOL_POLICY` and the reason while its body never runs; a forced tool is named in the prompt and the first answer is refused until it has been called in that step, then the next answer is accepted; a requirement refuses the first answer with one `tool.requirementUnmet` event and the run ends on the second answer; a requirement naming an unknown tool throws `ToolDefinitionError` at construction; the step's first event after `step.started` is `tool.policy` carrying advertised, hidden, forced and required names |
| 4.5 | `packages/core/test/tool-generator.test.ts` (56th core file) | a generator tool yields `"a"` and `"b"` and returns `"done"`: `execute` resolves `"done"` and the sink saw both yields; a slow generator rejects with `ToolTimeoutError`, proving the drain sits inside the deadline; a `ToolCallingAgent` run over that tool emits `action.requested`, two `action.progress` and one `action.result`, and the step's recorded result is `"done"`; a `ScriptedExecutor` emitting a progress tool event makes a `CodeAgent` run emit the same `action.progress`; a hosted tool is in the request's tool specs with its provider payload, absent from the registry the executor receives, and a model call naming it yields `action.failed` with code `AGENT_TOOL_HOSTED` naming the provider while its body never runs |
| 4.6 | `packages/exec-remote/test/transfer.test.ts` (13th exec-remote file), plus one case in `test/shim.test.ts` and one in `test/e2b.test.ts` | a declared variable is live in the guest before step 0 (`final_answer(seed + 1)` answers 42); a declared tool subset is the only set installed, and a run with no declared transfer still installs every registry tool; E2B refuses a declared `transfer.tools` at start with `UnsupportedOptionError` naming the option and never creates a sandbox; a variable name that is not a Python identifier is refused with `SerializationError` |
| 4.7 | `packages/exec-remote/test/e2b-depth.test.ts` (14th exec-remote file) | create carries `metadata` and the lifetime while `sandboxId` stays readable for lookup; a run's own `timeoutMs` reaches `runCode` without changing the lifetime; a step past `keepAliveMs` calls the lifetime setter first, and a client without that member is refused at start; `contextId` reaches every `runCode`; `guestMetrics()` returns the fake sample and `undefined` when the client has no metrics member |
| 4.8 | `packages/exec-remote/test/docker.test.ts` (rewritten) | deny-all creates the container with network mode `none` and no port bindings, and reports `network: "none"` instead of throwing; `start` resolves on the ready frame after interleaved guest output, with no HTTP client or WebSocket on the seam; a `tool_call` frame crosses the exec session's stdin and its reply is written back; an aborted step kills the exec session; `dispose` stops and removes the container exactly once |
| exit | `packages/mcp/test/phase-4-exit.test.ts` (14th mcp file) and `packages/exec-remote/test/phase-4-exit.test.ts` (13th exec-remote file) | mcp: a tool policy fixture hides a tool the model must not see, while a long `tools/call` reports progress and is cancelled; exec-remote: a remote guest calls a host tool by name through a declared transfer. The criterion spans two packages that cannot import each other, so it is pre-registered as two files and the phase report names both |

## Item designs

### 4.1 MCP depth: capabilities, bounded aggregation, session recovery

`ServerConnection` gains `capabilities: ServerCapabilities | undefined`, read from the
`initialize` result: an object whose `tools`, `resources`, `prompts`, `logging` and
`completions` members are kept when present and ignored when absent. Gating lives in one place —
`MCPClient.request` — by method family: `tools/*` needs `tools`, `resources/*` needs
`resources`, `prompts/*` needs `prompts`, `completion/complete` needs `completions`.
Gating is skipped until the handshake stored capabilities, so `initialize` itself is never
refused. A refused verb throws `MCPCapabilityError` (server name, capability, method) before a
message is sent.

`MCPClientOptions.maxListPages` (default 100) bounds every paginated read; a server that keeps
answering `nextCursor` stops with `MCPListLimitError` (method, server, pages) instead of
looping. The tools listing uses it now; 4.2's reads reuse the same helper.

The Streamable HTTP transport throws `MCPHttpStatusError extends MCPTransportError` carrying
`status` and `method` for a non-2xx answer (the body text stays in the message). The client
catches a 404 that arrives while the transport holds a session id: it clears `sessionId`, runs
the handshake again and retries the request once. A second 404, a 404 without a session id, or any
other status propagates. One recovery per connection at a time; a successful recovery resets it.

Three runtime names reach the barrel: `MCPCapabilityError`, `MCPListLimitError`,
`MCPHttpStatusError`. mcp pins 29 → 32.

### 4.2 Resources, prompts and completions

One method per verb on `MCPClient`, each taking an optional `{ server?: string; cursor?: string;
maxPages?: number }` and returning a typed result:

```ts
listResources(options?): Promise<MCPResource[]>
readResource(uri, options?): Promise<MCPResourceContents[]>
listPrompts(options?): Promise<MCPPrompt[]>
getPrompt(name, args?, options?): Promise<MCPPromptResult>
complete(request, options?): Promise<MCPCompletionResult>
```

The shapes mirror the protocol: a resource has `uri`, `name`, optional `description` and
`mimeType`; contents are `{ uri, mimeType?, text }` or `{ uri, mimeType?, blob }`; a prompt
has `name`, optional `description` and `arguments`; a prompt result is its messages; a
completion result is the values with the server's `total` and `hasMore`. `server` resolves by
the name `getTools()` already reports; omitting it means the first connection, as `request`
does. Nothing is cached: every read is a request, so a caller who needs freshness pays for it.
Pagination uses 4.1's bounded helper. Types only; no new runtime value, so mcp stays at 32.

### 4.3 Progress, cancellation and typed notifications

`MCPNotification` is a typed union built from the messages the client already retains:
`{ type: "progress", progressToken, progress, total? }`,
`{ type: "cancelled", requestId, reason? }`, `{ type: "toolsListChanged" }`,
`{ type: "resourcesListChanged" }`, `{ type: "promptsListChanged" }`, and
`{ type: "other", method, params }` for anything else. `MCPClientOptions.onNotification`
registers one listener at construction and `client.onNotification(listener)` registers another
later; both return an unsubscribe. `notifications` keeps its bounded raw history unchanged.

`MCPClient.request` grows an optional options argument `{ signal?, onProgress?, progressToken? }`
(the existing positional `signal` stays for compatibility). The pending entry remembers the
progress token, and a `notifications/progress` whose token matches one pending call invokes that
call's sink; a token nobody is waiting for is retained and logged, not an error. An abort now
sends `notifications/cancelled` with the request's id and a reason before it rejects, when the
transport is still live; the send is fire-and-forget with a logged failure, because the caller is
already leaving.

The MCP tool adapter issues one token per call when `ToolContext.onProgress` is present, adds
`_meta: { progressToken }` to `tools/call`, and forwards each progress notification to that
sink. Core's `ToolContext` gains the optional `onProgress` member here — a type-only addition
that 4.5 gives a producer and an event. Types and methods only; mcp stays at 32.

### 4.4 Per-step tool policy as data

New `packages/core/src/tool/policy.ts`, internal to the package:

```ts
interface ToolPolicy {
  allowed?: readonly string[];
  hidden?: readonly { name: string; reason?: string }[];
  forced?: readonly string[];
  require?: readonly { tool: string; reason: string }[];
}
type ToolPolicyProvider = (ctx: ToolPolicyContext) => ToolPolicy | Promise<ToolPolicy>;
```

`AgentOptions.toolPolicy` accepts a policy or a provider; a provider receives the step's run id,
step index, task, memory, state and usage. `mergeToolPolicy` combines the run's policy with the
step's: an allowed set intersects when both exist and is taken whole otherwise; hidden entries
union by name and the first reason wins; forced keeps only names the allowed set admits, and each
dropped name carries a reason; require concatenates, deduped by tool. `applyToolPolicy` returns
the step's registry in insertion order, with each hidden tool replaced by a stub whose `execute`
throws `ToolPolicyDeniedError` (code `AGENT_TOOL_POLICY`) carrying the reason. The stub is
what makes a call fail with an explanation instead of "unknown tool", and it is never advertised.

The loop resolves the policy once per step, before the request is built, and every reader uses
that one view: `renderToolDescriptions`, `modelOptions`, `CodeAgent.journaledTools` and the
`ToolCallingAgent` lookup. A forced tool is named in the prompt as this step's required call, and
the loop refuses an answer until it appears in that step's completed calls; a `require` entry is
checked against the whole run's completed calls. Both refusals turn the answer into a correction
observation and continue the step loop, with their own repair budget (2) and a terminal
`AgentGuardrailError` past it.

Two events: `{ type: "tool.policy", stepIndex, advertised, hidden, forced, required }` once per
step whose policy changes the visible set, and `{ type: "tool.requirementUnmet", stepIndex, tool,
reason }` per refusal. `describeEvent` and `buildTrace` learn both; the session reducer's
default already ignores them. One runtime name: `ToolPolicyDeniedError`. core pins 108 → 109.

### 4.5 Generator tools and hosted tools

`ToolDefinition.execute` may return `AsyncGenerator<TProgress, TOut>`; `progressSchema`
optionally validates each yield, and `ToolContext.onProgress` (landed by 4.3) receives the valid
ones. The `tool()` wrapper drains the iterable inside the same `withToolTimeout` call, so the
deadline still covers the whole tool and the resolved value is the generator's return, never the
generator itself. An invalid yield is logged and dropped; it never fails the call.

`ToolCallEvent` gains `{ type: "progress", callId, name, progress }`; the QuickJS executor's
`runTool` emits it from the sink it already builds; `CodeAgent` maps it to
`{ type: "action.progress", callId, name, progress }`; `ToolCallingAgent` collects progress in
`invoke` and yields the same event between `action.requested` and `action.result`. The event
is not a `.delta`, so `isAdvisory` stays honest; `buildTrace` records a bounded
`progressCount` and the last value.

A tool may declare `kind: "hosted"` with `hosted: { provider, spec }` instead of an
`execute`; `toSpec()` refuses a hosted tool that declares neither. Advertising keeps hosted
tools, and their `ToolSpec` carries the kind and the provider payload for an adapter to render in
the provider's own shape. Execution skips them: `journaledTools` leaves them out of the executor
registry, the `ToolCallingAgent` lookup does not run them, and a model call naming one yields
`action.failed` with `ToolHostedError` (code `AGENT_TOOL_HOSTED`) naming the provider, while
the body never runs. `withApproval` passes them through. One runtime name:
`ToolHostedError`. core pins 109 → 110.

### 4.6 A declared transfer into the guest

`SandboxTransfer` names what a guest may receive: `{ tools: readonly ToolSpec[]; variables:
Readonly<Record<string, unknown>> }`. `SandboxStartOptions.transfer` and
`RemoteExecutorOptions.transfer` carry it. With a transfer, the prelude installs exactly the
declared tools and binds each variable as a Python global through the existing `encodeValue`
wire; without one, the executor keeps today's behaviour — every registry tool, no variables — so
the change is opt-in.

A backend that cannot host the transfer refuses it at start, before it opens anything:
`UnsupportedOptionError` names the backend, the option (`transfer.tools`) and a remedy. E2B is
the first such backend, because its one-shot channel has no tool round trip. A variable name that
is not a Python identifier is refused with the existing `SerializationError`. Process and Docker
honour the transfer. One runtime name in the root entry: `UnsupportedOptionError`; exec-remote
root pins 9 → 10.

### 4.7 E2B depth

Four additions to the E2B backend, each defaulted to today's behaviour:

- `metadata` on create, so an orphaned guest can be found by the map the vendor stores.
- `executionTimeoutMs` (default 60 000) for a step that does not pass its own `timeoutMs`;
  the sandbox lifetime is never used as an execution deadline again.
- `keepAliveMs` with an optional `setTimeout` member on the client seam: a step past the
  interval refreshes the lifetime first, and a client that lacks the member is refused at start
  with `UnsupportedOptionError`.
- `contextId` on the backend options and on `SandboxRunOptions`, forwarded to `runCode`;
  process and Docker refuse it typed because they have one namespace.

`guestMetrics()` reads an optional `getMetrics` member and returns the vendor sample or
`undefined` — it stays out of `SandboxCapabilities`, because no runtime decision reads it and a
capability nothing consults would be a claim the backend cannot honour. Type-only additions
except the refusal shared with 4.6; exec-remote stays at 10.

### 4.8 The Docker exec transport (0021)

One long-lived `docker exec -i` Python process speaks the frame protocol over stdio. The
migration is ordered so each step compiles:

1. `SandboxFrame` gains `{ type: "ready" }`, `parseFrameLine` a case, and the guest's step
   loop emits it before it reads; the process backend shares that loop, and the executor ignores
   the frame.
2. `ContainerCreateRequest.networkMode` (`"none"` or `"bridge"`) and
   `ContainerRuntime.execSession(containerId, { argv, stdin })` returning a duplex session
   (`write`, `onData`, `onClose`, `end`, `kill`); `endpoint()` and `ContainerEndpoint`
   go. The dockerode implementation opens the exec with hijacked stdio; the kill path kills the
   container, because killing the exec client leaves the guest alive.
3. `DockerSandbox` starts the container with the derived network mode, opens one exec session
   with `shimSource + buildStepLoopSource()`, and resolves on the ready frame. The token, the
   published port, the readiness poll and the HTTP/WebSocket options go; the image is a plain
   Python base, so `DOCKERFILE` and `imageTagFor` follow.
4. Egress is enforced rather than refused: `deny-all` means `networkMode: "none"` and
   `capabilities.network` is `"none"`, the same derivation E2B already uses.
5. `jupyter.ts`, `rpc.ts`, `test/jupyter.test.ts`, `test/rpc.test.ts` and `test/ws-server.ts`
   are deleted; `test/docker.test.ts` is rewritten on a fake duplex runtime. The four entry pins
   are unchanged (root 10, process 3, docker 5, e2b 4).

## Public-surface accounting

Measured from each package's pinned list, not carried over from an earlier report:

- 4.1: mcp 29 → 32 (three new error classes).
- 4.2, 4.3: methods and types only; mcp stays 32.
- 4.4: core 108 → 109 (`ToolPolicyDeniedError`).
- 4.5: core 109 → 110 (`ToolHostedError`).
- 4.6: exec-remote root 9 → 10 (`UnsupportedOptionError`); process 3, docker 5 and e2b 4
  unchanged.
- 4.7, 4.8: type-level or internal; exec-remote stays 10.
- The two exit tests add no name.

## Verification per item

1. Run the item's new file before any code and watch it fail for the reason the table gives.
2. Implement to green, and run the touched package's suite and typecheck.
3. Append the item's `## Changes` entry, update the scoped `AGENTS.md` counts (mcp 10 files /
   111 tests, core 54 / 605, exec-remote 12 / 92 before this phase), add a handoff entry, and
   move the `T-45` row.
4. `python scripts/validate_context.py --root . --baseline docs/.baseline.json` reads 0/0,
   `python scripts/rotate.py --apply` is clean, and `pnpm gate` exits 0 (run as a background
   job; it outlives one tool call). Each item is one commit, staged by explicit path. Nothing is
   pushed.

## Close plan

Run the parent plan's exit criterion as the two pre-registered exit files; write the phase report
under `docs/reports/` with the evidence; check the parent plan's rows 4.1–4.8 against the code;
close `T-45`; add the handoff entry; run the final gate; commit. Nothing is pushed.

## Changes

*(newest first; an entry is written when an item lands or a criterion proves wrong)*

### 4.5 — Generator tools and hosted tools (2026-10-24)

Landed as `packages/core/test/tool-generator.test.ts` (nine cases, the 56th core file, watched
red on the missing drain, the missing `action.progress` and the absent `ToolHostedError`), plus
the two pin cases and one `events.test.ts` sample.

`ToolDefinition.execute` may return an async generator. `tool()` awaits what the declaration
returned and, when it is one, drains it inside the same `withToolTimeout` call: a generator that
never settles times out, each yield reaches `ToolContext.onProgress` (validated by
`progressSchema`; an invalid yield is logged and dropped) and the resolved value is the
generator's return. `Tool` keeps a required `execute`, so no consumer has to narrow; a hosted
tool's refuses with `ToolHostedError` and is never reached, because `journaledTools` leaves hosted
tools out of the executor registry and the `ToolCallingAgent` lookup refuses one by name first.

`ToolCallEvent` and `AgentEvent` gained `progress`/`action.progress`; the QuickJS and Pyodide
bridges emit it from the sink they build, `CodeAgent` maps it, `ToolCallingAgent` replays the
collected reports between `action.requested` and `action.result`, and `buildTrace` keeps a
`progressCount` plus `lastProgress` so a chatty tool cannot grow the span. A hosted tool is
advertised with `kind: "hosted"` and its `{ provider, spec }` payload, carried into `ToolSpec`
for an adapter to render in the provider's own shape, and `withApproval` passes it through.

Two honest deviations from the registered design: the hosted `kind`/`hosted` pair is validated
where the tool is declared rather than only in `toSpec()`, and a hosted `Tool` carries a refusing
`execute` — `Tool` stays uniform for every consumer — instead of having none. core: pins 110,
56 files, 631 tests.

### 4.4 — Per-step tool policy as data (2026-10-24)

Landed as `packages/core/test/tool-policy.test.ts` (13 tests, the 55th core file, watched red
on the missing module), plus two pin cases for the new error. The policy types and the pure
helpers live in the new internal `src/tool/policy.ts`; `AgentOptions.toolPolicy` accepts a
policy or a provider, the provider receiving the step's run id, index, task, memory, state and
usage.

`mergeToolPolicy` intersects two allowed sets, unions hidden entries by name keeping the first
reason, drops a forced name the allowed set does not admit (recording why) and concatenates
requirements deduped by tool. `applyToolPolicy` returns the step's registry in insertion
order with each hidden tool replaced by a stub that throws `ToolPolicyDeniedError`
(`AGENT_TOOL_POLICY`, naming the reason), and `advertisedToolRegistry` is the view without
those stubs. A static policy is validated where it is declared: a forced or required name no
tool registers throws `ToolDefinitionError` at construction.

The loop resolves one view per step, before the request is built, and every reader uses it:
`renderToolDescriptions`, the managed-agent section, `modelOptions`,
`CodeAgent.journaledTools` and the `ToolCallingAgent` lookup. The prompt gains a tool
requirements paragraph naming a forced tool and each requirement. An answering step whose forced
tool has not run in that step, or whose required tool has not run in the run, becomes a
correction observation with one `tool.requirementUnmet` event per unmet entry; a second refusal
is allowed, the third ends the run with `AgentGuardrailError`. `tool.policy` is announced once
per changed view, and `buildTrace` records both events. One runtime name,
`ToolPolicyDeniedError`, plus type-only policy exports; core pins 108 → 109, and core is 55
files / 620 tests.

### 4.3 — Progress, cancellation and typed notifications (2026-10-24)

Landed as `packages/mcp/test/notifications.test.ts` (5 tests, watched red on the missing
listener and progress plumbing). The typed union and its mapper live in a new internal
`src/notifications.ts`; `MCPClientOptions.onNotification` and `client.onNotification` both
register a listener and return its unsubscribe, and a listener that throws is logged and
skipped.

`request` grew a fifth argument, `MCPRequestOptions` (`signal`, `onProgress`,
`progressToken`); the positional `signal` stays and the options signal wins when both are
given. A pending entry remembers its token, so a `notifications/progress` reaches exactly the
call that asked for it, and the same message still reaches every client-wide listener as the
typed `progress` notification. An abort sends `notifications/cancelled` with the request id
and the method, fire-and-forget, before it rejects. The adapter issues one token per call
(`mcp-<server>-<callId>`), adds `_meta.progressToken` to `tools/call` only when the caller
supplied `ToolContext.onProgress`, and forwards each update to it. Core's `ToolContext` gained
that optional member here — a type-only addition, so core's pins and counts are unchanged.
mcp is 13 files / 134 tests, pins still 32.

### 4.2 — Resources, prompts and completions (2026-10-24)

Landed as `packages/mcp/test/resources.test.ts` (7 tests, watched red on the missing methods),
with one deviation: the read verbs take `{ server?, signal? }` and only the two listings take
`{ server?, cursor?, maxPages? }`, because a cursor means nothing to `readResource`,
`getPrompt` or `complete`. Every verb resolves its connection by the name `getTools()`
reports, and an unknown name raises `MCPConnectionError` listing the names the client knows.

The shapes and their parsers live in a new internal `src/catalog.ts`; a malformed answer raises
`MCPProtocolError` naming the method rather than passing a half-typed object to the caller. The
tools listing now shares the same bounded `paginate` helper, so one implementation enforces
`maxListPages`. Types only reach the barrel: mcp stays at 32 pins, 12 files / 129 tests.

### 4.1 — MCP depth (2026-10-24)

Landed as designed, with two deviations recorded here rather than silently:

- Gating sits in a private `requestFor` — used by `getTools`, the tool adapter and, from 4.2,
  the typed reads — not in the public `request`, which stays the raw escape hatch for a caller
  that already knows the server. The routing tests call `request("tools/list")` directly, which
  is exactly that escape hatch, so gating in `request` would have refused them.
- The pre-registered file is `packages/mcp/test/client-depth.test.ts` (8 tests). The HTTP status
  case extends the existing non-2xx case in `http-transport.test.ts` instead of adding a second
  test to it.

Two existing doubles now declare `capabilities: { tools: {} }` — `client.test.ts`'s
`PeerGoneTransport` and the stdio replay double — because both list tools. mcp is 11 files /
122 tests; pins 29 → 32.
