# T-13 Task 3 — the MCP client Implementation Plan

## Contract

- **Role:** the implementation plan for Task 3 of
  `docs/plans/2026-10-14-v1.5-modules-plan.md`.
- **Mutability:** once execution starts the steps below are frozen: a step that
  turned out wrong gets a note under the task that owns it, and the step's own
  text is not rewritten. Measured results are appended at the end.
- **Read when:** executing Task 3, or reviewing what Task 3 was supposed to
  deliver.
- **Update when:** a task's measured result differs from its prediction, or a
  task is added or dropped.

**Goal:** a seventh package, `@smolagents-ts/mcp`, whose `MCPClient` turns an
MCP server's tools into this port's `Tool[]` seam — upstream's
`mcp_client.py` plus the MCP half of `ToolCollection.from_mcp` — over a
transport seam the gate drives from a recorded fixture, with no third-party
runtime dependency and no live server in the gate.

**Architecture:** three layers, each replaceable on its own.

1. **Transport** (`src/transport.ts`) — messages in, messages out. `McpTransport`
   is a structural mirror of the official SDK's `Transport` declaration
   (`start()`, `send(message, options?)`, `close()`, `onclose`,
   `onerror`, `onmessage`, `sessionId?`, `setProtocolVersion?`). Nothing
   above it knows whether the peer is a subprocess or an HTTP endpoint, and a
   caller who needs a transport this package does not ship can pass the SDK's.
2. **Session** (`src/client.ts`) — JSON-RPC 2.0 over that seam: request ids,
   timeouts, `initialize` → `notifications/initialized` → `tools/list`
   (cursor pages) → `tools/call`, and the `tools/list_changed` refresh. It
   owns no schema and no tool.
3. **Tool adapter** (`src/tool-adapter.ts`) — one MCP tool spec to one `tool()`:
   the input schema through `z.fromJSONSchema`, an output schema when
   `structuredOutput` is on, and an `execute` that sends `tools/call` and
   flattens the result.

The session keeps upstream's surface: server parameters that are a stdio
parameter object, a URL parameter object, or an array of either; the connect
during construction; `tools` and `getTools()`; `disconnect()`;
`withMcpClient(...)` for upstream's context-manager entry; and
`structuredOutput`. Python's `with` has no `await using` equivalent under
this repository's base config — its `lib` is ES2023, which has no
`Symbol.asyncDispose` — so the context manager becomes a function plus an
explicit `disconnect()`, which is how the rest of the port handles one.

Two transports ship. Streamable HTTP lives in the root entry and uses `fetch`;
stdio lives behind `@smolagents-ts/mcp/stdio`, so a browser bundle that imports
the package never reaches `node:child_process`. The legacy HTTP+SSE transport is
refused by name, the way the CLI refuses upstream's `LiteLLMModel` and
`TransformersModel`.

**Tech Stack:** TypeScript 6, tsup 8 (ESM only), vitest 5, zod 4.6.6
(`fromJSONSchema`), `@smolagents-ts/core` for `tool()`,
`createAsyncQueue` and `Logger`, `fetch` and `node:child_process` in the
two transports, pnpm workspaces, changesets, the existing
`scripts/pack-smoke.mjs`.

**Spec:** design lines 341 (MCP servers as a tool source beside
`ToolCollection`), 942 (the deferred module and its size) and 962 (the S6 row);
upstream `src/smolagents/mcp_client.py`, `src/smolagents/tools.py` lines
949–1058, and `smolagents/docs/source/en/tutorials/tools.md` lines 91–140
for the documented usage; `docs/attribution.md` row 25; decision 0015 for the shape
this plan implements, 0013 for a new v1.5 package's version line, and 0006 for
the distribution.

**Depends on:** T-20 (`b76b596`) and the CLI and docs-site commits. No existing
source file changes: the work is a new package plus the router, the upstream map
and the pack smoke's package list.

**Dependency order:** 1 → 2 → 3 → 4, then 5 and 6 in either order, then 7 → 8 → 9
→ 10. Tasks 3 and 4 need task 2's fixture; tasks 8 and 9 need every source file
in place.

**Task ownership:** one writer at a time. Task 1 owns
`packages/mcp/package.json`, its four configs, `scripts/pack-smoke.mjs`,
`.changeset/` and the package README; tasks 2–7 own
`packages/mcp/src/**` and `packages/mcp/test/**`; task 8 owns
`packages/mcp/AGENTS.md`, the new component rule, the root `AGENTS.md` row and
`docs/attribution.md`; task 9 owns the root `package.json` and
`docs/02-environment.md` if either needs a line. No two tasks share a file.

## Findings measured before this plan (2026-10-14)

| # | Question | Measurement | Finding |
|---|---|---|---|
| 1 | What does a client-only SDK install cost? | `npm view @modelcontextprotocol/sdk version dependencies dist.unpackedSize` → 1.32.1, 17 direct dependencies including `express`, `hono`, `cors` and `express-rate-limit`, 4,490,363 bytes unpacked | The distribution ships a server stack beside its client, so a justification under R-07.2 for a client that needs three methods does not hold. Decision 0015 records the choice. |
| 2 | Can an MCP input schema become a `tool()` schema without a JSON-Schema library? | `node -e` importing `zod` in `packages/core` → `root fromJSONSchema: function`, and a parsed object schema round-tripped | zod 4.6.6 does it directly; no `json-schema-typed`, no converter of ours. |
| 3 | What shape must the seam mirror? | The SDK's published `shared/transport.d.ts` → `start()`, `send(message, options?)`, `close()`, `onclose?`, `onerror?`, `onmessage?`, `sessionId?`, `setProtocolVersion?` | A structurally compatible seam makes an SDK transport injectable with no adapter. |
| 4 | Which protocol revisions should the client offer? | The SDK's `types.d.ts` → `LATEST_PROTOCOL_VERSION = "2025-11-25"`, `DEFAULT_NEGOTIATED_PROTOCOL_VERSION = "2025-03-26"` | Send the latest, accept the published revisions, refuse anything else with both versions named. |
| 5 | Which primitives does the port already own? | `packages/core/src/utils/async-queue.ts` (`createAsyncQueue`), `packages/core/src/logger.ts` (`Logger`, `noopLogger`), `packages/models/src/sse.ts` (`parseSse`) | The queue and the logger come from core. `parseSse` stays in the models package: an MCP transport importing a provider package for forty lines is the wrong edge, so the HTTP transport carries its own reader. |

## Tasks

### Task 1: the package skeleton

**Deliverable:** `@smolagents-ts/mcp` exists, builds, typechecks and carries the
same metadata its siblings do; the pack smoke counts it.

**Files:** `packages/mcp/{package.json,tsconfig.json,tsconfig.test.json,tsup.config.ts,vitest.config.ts,README.md}`,
`packages/mcp/src/{index.ts,version.ts}`, `scripts/pack-smoke.mjs`,
`.changeset/v1-5-mcp-package.md`.

**Notes:** version `0.0.0` outside the fixed group, following decision 0013;
dependencies `@smolagents-ts/core` and `zod` only; two tsup entries
(`src/index.ts` and `src/transports/stdio.ts`) with `exports` entries
`.` and `./stdio`; `engines.node` at `>=22.12`; `prepack` and
`postpack` call `scripts/copy-licence.mjs`; `src/version.ts` carries the
marker the pack smoke imports. The root `vitest.config.ts` needs no edit — its
projects are globs — and `pnpm-workspace.yaml` already globs `packages/*`.

**Verification:** `pnpm --filter @smolagents-ts/mcp run build` exits 0 with
`dist/index.js` and `dist/transports/stdio.js` on disk; `pnpm pack:smoke`
prints 8 packages.

### Task 2: the transport seam and the recorded fixture

**Deliverable:** `McpTransport`, the JSON-RPC message types, and a test double
that replays a recorded transcript and records every send.

**Files:** `packages/mcp/src/transport.ts`, `packages/mcp/src/json-rpc.ts`,
`packages/mcp/test/{fixture-transport.ts,fixtures/*.json}`.

**Notes:** the fixture is a JSON file of steps, each pairing an expected request
(method, and `params.name` for a tool call) with the server's reply; the reply's
`id` is copied from the request, a step may carry a JSON-RPC error instead, and
an unmatched request fails the test with the method named. `transport.ts`
declares the eight seam members and nothing SDK-specific; `json-rpc.ts` holds
the request, response and notification shapes as a discriminated union.

**Verification:** a test replays a two-page `tools/list` and asserts the sends
the client recorded, in order.

### Task 3: the session and the protocol

**Deliverable:** `MCPClient` with upstream's lifecycle and the three methods the
tools need.

**Files:** `packages/mcp/src/client.ts`, `packages/mcp/src/parameters.ts`,
`packages/mcp/src/errors.ts`, `packages/mcp/test/client.test.ts`.

**Notes:** parameters accept `{command, args?, env?, cwd?}`,
`{url, transport?}` (default `streamable-http`) and an array of either, which
opens one transport per server and concatenates the tools in order; an unknown
transport string is refused naming the supported set, and `sse` is refused with a
message that names Streamable HTTP and calls the transport deprecated.
`connect()` runs during construction, like upstream. `initialize` sends
`2025-11-25`, empty capabilities and a `clientInfo` naming this port and its
version; a revision outside the published set fails with both versions named.
`tools/list` follows `nextCursor` to exhaustion. Requests carry ids from one
counter and a timeout (default 30 seconds) that rejects with the method named.
A `tools/list_changed` notification marks the cached list stale and refreshes
on the next read; any other notification is logged through the injected
`Logger`. `disconnect()` closes every transport once and is idempotent, and a
message after close is refused by name.

**Verification:** the fixture drives a session from `initialize` to a tool call
and a list-changed refresh; a second case asserts each refusal by name and
message; a third asserts a doubled `disconnect()` is quiet.

### Task 4: the tool adapter

**Deliverable:** each MCP tool is a `Tool` an agent can call, and a remote
failure is the tool's failure.

**Files:** `packages/mcp/src/tool-adapter.ts`, `packages/mcp/src/tools.ts`,
`packages/mcp/test/tool-adapter.test.ts`.

**Notes:** the input schema goes through `z.fromJSONSchema`; a missing
description falls back to the tool's name; `structuredOutput: true` adds the
output schema when the server sent one and returns `structuredContent` when the
response carries it, while `false` returns the joined text of the content
items. `isError: true` throws an error naming the tool and carrying the
server's text. A content item of a type this port does not read (`image`,
`audio`, `resource`) is kept as its JSON text rather than dropped. Two servers
exposing the same tool name are refused with an error naming both servers —
upstream merges them silently through `mcpadapt`, and a silently shadowed tool
is the one outcome a caller cannot debug. The trust acknowledgement belongs to
the collection helper, not to `MCPClient`, which is upstream's own split.

**Verification:** the fixture's text result, structured result and error result
each become the right call outcome; a tool with no input schema is still
callable; the collision and trust refusals are asserted by name.

### Task 5: the Streamable HTTP transport

**Deliverable:** a transport over `fetch` for a URL server.

**Files:** `packages/mcp/src/transports/http.ts`,
`packages/mcp/test/http-transport.test.ts`.

**Notes:** each message is a POST with `Accept: application/json,
text/event-stream` and `Content-Type: application/json`; a JSON body is one
message and an event-stream body is parsed by this transport's own reader; the
session id response header is captured and echoed on later requests, and the
protocol-version header follows the negotiated revision; `close()` sends a
DELETE when a session id exists. The fetch implementation is injectable, so the
suite needs no server. A non-2xx response becomes an error carrying the status
and the first bytes of the body.

**Verification:** a fake fetch returning JSON, one returning an event stream with
a notification then a response, and one returning a 500 that is asserted by
status.

### Task 6: the stdio subpath

**Deliverable:** a transport over a child process, importable only from
`@smolagents-ts/mcp/stdio`.

**Files:** `packages/mcp/src/transports/stdio.ts`,
`packages/mcp/test/stdio-transport.test.ts`,
`packages/mcp/test/architecture.test.ts`.

**Notes:** newline-delimited JSON on the child's stdin and stdout, stderr
forwarded line by line to the `Logger`, the child's exit reported as a close,
and `close()` killing the child once; the spawn function is injectable and
defaults to `node:child_process`. The architecture case walks the root entry's
import graph and fails on any `node:` specifier, mirroring
`packages/core/test/architecture.test.ts`. One integration case spawns
`node` running an inline fixture server to prove the framing over a real pipe,
and moves behind an environment flag if it proves flaky.

**Verification:** the injected-child case replays the same transcript; the
architecture case is proved load-bearing by a throwaway import of
`node:child_process` from the root entry, which must fail it.

### Task 7: the composition helpers and the public barrel

**Deliverable:** `withMcpClient`, `mcpTools`, and the barrel a consumer
imports.

**Files:** `packages/mcp/src/tools.ts`, `packages/mcp/src/index.ts`,
`packages/mcp/test/{tools.test.ts,public-surface.test.ts}`.

**Notes:** `withMcpClient(parameters, fn, options?)` connects, runs
`fn(tools)` and disconnects in a `finally`, which is upstream's
`with MCPClient(...) as tools`. `mcpTools(parameters, options?)` is
upstream's `ToolCollection.from_mcp` minus the collection class: it returns the
`Tool[]` a caller hands to a collection or an agent, and it requires the trust
acknowledgement, defaulting to `false` and refusing with upstream's wording. No
`ToolCollection.fromMcp` exists here, because it would make the tools package
depend on this one for a static factory that a single call replaces. The barrel
exports the client, the parameters, the tools, the errors and the HTTP
transport, and never the stdio module; the public-surface case pins the export
list, as core's does.

**Verification:** `withMcpClient` disconnects after the callback throws, which
the fixture asserts as a close; `mcpTools` refuses without the acknowledgement
and returns two tools with it.

### Task 8: the package's documents and the router

**Deliverable:** the new component is reachable from the router, and the upstream
map stops saying "planned".

**Files:** `packages/mcp/AGENTS.md`, the component rule for the new id in
the form `rules/components/<id>.md`, `AGENTS.md` (one row),
`docs/attribution.md` (rows 25 and 27),
`docs/04-tasks.md` (the T-13 row), `docs/03-handoff.md` (a new entry), and
`docs/05-memory.md` with `docs/memory/general.md` only if a lesson lands.

**Notes:** the scoped entry follows `packages/cli/AGENTS.md`'s form — what the
component is, its entry points, the smallest validation command, boundaries,
hazards, pointers — and stays under the entry cap; the component rule follows
`rules/components/cli.md`. The upstream map's row for `mcp_client.py` becomes
a port row naming `packages/mcp/src/*`, and the row for `cli.py` is corrected
in the same pass: that file's own contract says a module is not done until its
row is accurate, and the CLI landed with its row still reading "defer to v1.5".

**Verification:** `python scripts/validate_context.py --root . --json
--baseline docs/.baseline.json` ends with `new: []`, zero errors and zero
warnings, and `python scripts/rotate.py --check` exits 0.

### Task 9: the gate wiring

**Deliverable:** the new package is inside every gate stage that names packages.

**Files:** `scripts/pack-smoke.mjs` (task 1 already lists it), the root
`package.json` only if a script's filter misses it, and
`docs/02-environment.md` for the package and its suite size.

**Notes:** build, publint, attw and the pack smoke already reach
`packages/*` by glob, so the expected edits are the smoke's list and the
environment line.

**Verification:** `pnpm gate` exits 0 on a clean tree, with the mcp suite's file
and test counts visible in the output.

### Task 10: verification

**Deliverable:** the plan's claims are measured rather than asserted.

**Steps:** run the structural check that an official SDK transport fits the seam
in a scratch directory outside the repository (install the SDK into a temporary
folder, then a two-file `tsc --noEmit` assigning one of its transports to
`McpTransport`); add the live check to `docs/10-runbooks/` — a real stdio MCP
server, the reference `@modelcontextprotocol/server-everything` through
`npx`, driven by `MCPClient`, with its transcript recorded under
`packages/mcp/test/fixtures/` and the note that the check is manual because the
gate stays offline; write the T-13 row, the handoff entry and this plan's
measured results.

**Verification:** the scratch typecheck's output and the runbook's executed
commands are pasted into the measured results.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| The hand-rolled client misses a detail a real server relies on | The runbook's live check against the reference server, plus a seam that accepts an SDK transport | Delete `packages/mcp`; nothing published depends on it |
| The stdio integration case is flaky in CI | It is one case, and the injected-child case carries the coverage | Move it behind an environment flag |
| The recorded transcript drifts from the real protocol | It is recorded from the live run in task 10 rather than hand-written | Re-record it |

## Open questions for the owner

1. **The transport set.** stdio and Streamable HTTP first, legacy SSE refused by
   name. Upstream supports SSE while marking it deprecated. Reversing costs one
   transport file and one fixture.
2. **The dependency posture.** No SDK, per decision 0015. Reversing means adding
   an SDK-backed transport, which the seam already allows.
3. **The `structuredOutput` default.** Ported as `false` with upstream's
   notice through the logger, although upstream's own warning says `true` was
   intended at 1.25. A caller sets `true` today; flipping the default is a
   one-line change and a new decision record.
4. **The collision refusal.** Upstream merges two servers' same-named tools
   silently; this port refuses. A caller with two servers that share a name gets
   an error where upstream would give a shadowed tool.

## Measured results

### The seam accepts an SDK transport (measured 2026-10-14, part of task 10)

A scratch directory outside the repository (`%TEMP%\mcp-seam-check`) installed
`@modelcontextprotocol/sdk@1.32.1` and `typescript@6`, then compiled two files
under this repository's strictness (`strict`, `exactOptionalPropertyTypes`):

- A mirror of the SDK's transport with `result: Record<string, unknown>` and the
  required `jsonrpc`, `id` and `method` members compiles as the assignment
  `const ours: McpTransport = sdkTransport`; the compiler exited 0 with no
  diagnostics.
- A loose mirror, everything optional and `result?: unknown`, fails the same
  assignment, which that run proves by carrying `@ts-expect-error` on it: had it
  compiled, the compiler would have reported the unused directive.

Two facts follow for the implementation. A JSON-RPC response's `result` is a
record rather than `unknown`, and the seam's eight members are enough for the
SDK's own transport to be injected with no adapter. The package's suite pins both
directions against a local mirror of the SDK declaration, because the dependency

### The package's five commands (measured 2026-10-14, tasks 1 to 7 and 9)

| command | exit | result |
|---|---|---|
| `pnpm --filter @smolagents-ts/mcp run build` | 0 | ESM `dist/index.js`, `dist/transports/stdio.js` and a shared chunk, with a declaration file for each |
| `pnpm --filter @smolagents-ts/mcp run typecheck` | 0 | clean |
| `pnpm vitest run --project mcp` | 0 | 9 files, 106 tests, 0 failures |
| `pnpm exec eslint packages/mcp` | 0 | clean |
| `pnpm exec depcruise packages --config .dependency-cruiser.cjs` | 0 | no violations, 205 modules and 517 dependencies cruised |

The root entry reaches no Node builtin, and the architecture test holds that: only
`dist/transports/stdio.js` imports one.

### Four defects the first full suite exposed (measured 2026-10-14)

- A handshake that failed leaked its transport, because `connect()` assigned the
  connection's transport only after `start()` returned; the assignment now precedes
  the start, so the failure path has something to close.
- The stdio close could skip its kill: the 200 ms timer was cleared as soon as the
  old floor resolved. The close now ends stdin, waits, kills, and bounds its wait
  for the exit.
- `start()` latched its started flag before the spawn, so a spawn that threw could
  never be retried.
- Three fixtures were missing their `initialize` step and one had no second page,
  which is why the first run failed 13 of 101 cases.

### A transport failure must settle what is in flight (measured 2026-10-14, task 10)

The live check's first run ended at exit 13 with "Detected unsettled top-level
await": the client's transport-error handler wrote a warning and nothing else, and
the request timer is unref'd on purpose, so a handshake against a process that
never started had nothing left to keep the process alive. The client now records
the failure on the connection, rejects everything in flight on it, and refuses the
next request immediately. The same command then failed in 8 ms carrying the spawn
error, and two cases in `packages/mcp/test/client.test.ts` pin the error path and
the close path.

### The live check (measured 2026-10-14, task 10)

    root refused a subprocess: MCPParameterError
    connected in 410 ms, protocol 2025-11-25
    tools (13): echo, get_annotated_message, get_env, get_resource_links,
      get_resource_reference, get_structured_content, get_sum, get_tiny_image,
      gzip_file_as_resource, toggle_simulated_logging, toggle_subscriber_updates,
      trigger_long_running_operation, simulate_research_query
    echo "Echo: hello from the live check"

Two of this task's own steps were wrong and are recorded here rather than
rewritten. It said the check drives the server through `npx`; measured, Windows
resolves no extensionless `npx` for a spawn and refuses `npx.cmd` without a
shell, so the check installs the pinned server into a scratch directory and spawns
`process.execPath` with its entry. It also said the transcript lands under
`packages/mcp/test/fixtures/`; the recorded transcript is the runbook's
last-recorded-run line instead, because the fixture suite records protocol shapes
rather than a live server's own output.

### The schema fidelity table (measured 2026-10-14, task 4)

Eight input schemas were put through `z.fromJSONSchema` on zod 4.6.6 and none was
refused: an object with a string property; `$defs` with a `$ref` to a definition;
`anyOf` over a string and a number; an `enum`; `format: "date-time"` with
`additionalProperties: false`; an empty property list with
`additionalProperties: true`; the empty schema, which becomes a permissive
`ZodAny`; and `additionalProperties` carrying an integer schema. The table is now
a test, so a zod upgrade that starts refusing one of them fails by name instead of
silently dropping a tool. The skip path stays as it is; the refusals seen so far
are a bigint type, an unknown type, a `$ref` with no target, and an invalid
pattern.

### The documents (measured 2026-10-14, task 8)

`python scripts/validate_context.py --root . --json --baseline docs/.baseline.json`
reports `new: []`, 14 baselined, zero errors and zero warnings, and
`python scripts/rotate.py --check` exits 0.

itself stays out of the lockfile.
