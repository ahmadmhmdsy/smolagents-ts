# 03 — Handoff (state)

**Contract**
- **Role:** narrative state — where we are.
- **Mutability:** **append-only, newest first.** Never edit or delete a past
  entry. Correct a past entry by writing a new entry that supersedes it.
- **Read when:** session start, before anything else.
- **Update when:** any milestone, incident, decision, or resume point.

**Why append-only:** the value of this file is that it records what was
believed at the time. Editing history destroys exactly that.

---

## Entry format

Copy _templates/handoff-entry.md. Every entry answers:

- **State** — where the project is right now.
- **Did** — what this session actually changed.
- **Verified** — what was checked, with the command and the result.
- **Unverified / open** — what was not checked and what remains.
- **Next** — the single next step.
- **Blockers** — anything gated, and on what.
- **Artifacts** — paths worth opening, as path:line where possible.

## Rotation

The newest entries stay inline, newest first. Older entries move verbatim to
`docs/handoff/archive-2026.md`; rotation never deletes and never rewrites. A new
entry is prepended inside the markers below.

---

<!-- rotate:begin -->
## 2026-10-25T04:10:00+03:00 — Phase 4.5 landed: generator and hosted tools

**State.** 4.1–4.5 are landed; 4.6–4.8 and the phase close remain.

**Did.** `tool-generator.test.ts` (9 tests, the 56th core file) was watched red on the missing
drain, the missing `action.progress` and the absent `ToolHostedError`, then 4.5 landed:
`ToolDefinition.execute` may return an async generator, and `tool()` drains it inside the same
`withToolTimeout` call — each yield goes to `ToolContext.onProgress` (validated by the new
`progressSchema`; an invalid yield is logged and dropped) and the return value is the result, so
a generator that never settles still times out. `ToolCallEvent` gained `progress`, mapped to
`action.progress`; the QuickJS and Pyodide bridges emit it, `ToolCallingAgent` replays collected
reports between `action.requested` and `action.result`, and `buildTrace` keeps
`progressCount` plus `lastProgress`. A tool may declare `kind: "hosted"` with
`hosted: { provider, spec }`: it is advertised with that payload in `ToolSpec`, excluded from the
executor registry, refused by the structured lookup with `ToolHostedError` (`AGENT_TOOL_HOSTED`,
naming the provider), and passed through by `withApproval`. `Tool` keeps a required `execute`
whose hosted form refuses, so no consumer narrows. core pins 109 → 110, 56 files / 631 tests.

**Verified.** `pnpm vitest run --project core` exits 0 (56 files, 631 tests); the core typecheck
passes; the 4.5 suite passes 9/9.

**Unverified / open.** 4.6–4.8 and the phase close are not implemented. Two honest deviations are
recorded in the plan's 4.5 entry (declaration-time hosted validation; the refusing hosted
`execute`).

**Next.** 4.6: write `packages/exec-remote/test/transfer.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `packages/core/src/tool/tool.ts`, `packages/core/src/errors.ts`,
`packages/core/src/events.ts`, `packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/test/tool-generator.test.ts`.

## 2026-10-25T03:48:00+03:00 — Phase 4.4 landed: per-step tool policy as data

**State.** 4.1–4.4 are landed; 4.5–4.8 and the phase close remain.

**Did.** `tool-policy.test.ts` (13 tests, the 55th core file) was watched red on the missing
module, then 4.4 landed: `src/tool/policy.ts` holds the policy types, `mergeToolPolicy`
(intersecting allowed sets, unioning hidden by name, dropping a forced name the allowed set does
not admit, concatenating requirements deduped by tool), `applyToolPolicy` (hidden tools become
stubs that throw `ToolPolicyDeniedError` with the reason), `advertisedToolRegistry` and
`validateToolPolicy` (a forced or required unknown name is a `ToolDefinitionError` at
construction). `AgentOptions.toolPolicy` takes a policy or a per-step provider; the loop resolves
one view per step and the prompt, the request specs, the executor registry and the lookup all
read it. A forced tool must run in that step and a requirement in the run before an answer is
accepted; a refusal is a correction observation plus `tool.requirementUnmet`, the third ends the
run with `AgentGuardrailError`. `tool.policy` is announced once per changed view, and
`buildTrace` learns both events. One runtime name, `ToolPolicyDeniedError`; type-only policy
exports; core pins 109, 55 files / 620 tests.

**Verified.** `pnpm vitest run --project core` exits 0 (55 files, 620 tests); the core typecheck
passes; the 4.4 suite passes 13/13.

**Unverified / open.** 4.5–4.8 and the phase close are not implemented.

**Next.** 4.5: write `packages/core/test/tool-generator.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `packages/core/src/tool/policy.ts`, `packages/core/src/errors.ts`,
`packages/core/src/events.ts`, `packages/core/src/agent/multi-step-agent.ts`,
`packages/core/test/tool-policy.test.ts`.

## 2026-10-25T03:22:00+03:00 — Phase 4.3 landed: progress, cancellation and typed notifications

**State.** 4.1–4.3 are landed; 4.4–4.8 and the phase close remain.

**Did.** `notifications.test.ts` (5 tests, the 13th mcp file) was watched red on the missing
listener and progress plumbing, then 4.3 landed: a typed `MCPNotification` union with a mapper
in `src/notifications.ts`; `MCPClientOptions.onNotification` and `client.onNotification` with an
unsubscribe, where a throwing listener is logged and skipped; `request` grew a fifth
`MCPRequestOptions` argument (`signal`, `onProgress`, `progressToken`) while the positional
signal stays; progress routes only to the call that owns its token and still reaches every
listener; an abort sends `notifications/cancelled` with the request id before rejecting; the
adapter issues one token per call and adds `_meta.progressToken` only when
`ToolContext.onProgress` exists. Core's `ToolContext` gained that optional member — type-only,
so core's pins and counts are unchanged. mcp is 13 files / 134 tests, pins still 32.

**Verified.** `pnpm vitest run --project core --project mcp` exits 0 (67 files, 739 tests); the
mcp and core typechecks pass; validator 0/0.

**Unverified / open.** 4.4–4.8 and the phase close are not implemented.

**Next.** 4.4: write `packages/core/test/tool-policy.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `packages/mcp/src/notifications.ts`, `packages/mcp/src/client.ts`,
`packages/mcp/src/tool-adapter.ts`, `packages/mcp/test/notifications.test.ts`.

## 2026-10-25T03:12:00+03:00 — Phase 4.2 landed: resources, prompts and completions

**State.** 4.1 and 4.2 are landed; 4.3–4.8 and the phase close remain.

**Did.** `resources.test.ts` (7 tests, the 12th mcp file) was watched red on the missing methods,
then the five reads landed on `MCPClient`: `listResources`, `readResource`, `listPrompts`,
`getPrompt` and `complete`. Shapes and parsers are internal in `src/catalog.ts`; a malformed
answer raises `MCPProtocolError` naming the method. `server` resolves by the name `getTools()`
reports and an unknown name raises `MCPConnectionError`. Nothing is cached, and both listings use
the same bounded `paginate` helper 4.1 gave the tools listing. Read verbs take `{ server?,
signal? }`; listings add `{ cursor?, maxPages? }`. mcp is 12 files / 129 tests, pins still 32.

**Verified.** `pnpm vitest run --project mcp` exits 0 (12 files, 129 tests); the mcp typecheck
passes; validator 0/0; `pnpm gate` exits 0.

**Unverified / open.** 4.3–4.8 and the phase close are not implemented.

**Next.** 4.3: write `notifications.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `packages/mcp/src/catalog.ts`, `packages/mcp/src/client.ts`,
`packages/mcp/test/resources.test.ts`.

## 2026-10-25T02:58:00+03:00 — Phase 4.1 landed: MCP depth

**State.** 4.1 is landed; 4.2–4.8 and the phase close remain.

**Did.** `client-depth.test.ts` (8 tests, the 11th mcp file) was watched red on the missing
exports, then 4.1 landed: each connection reads the `initialize` capabilities and a gated verb is
refused before sending (`MCPCapabilityError`); every paginated read is bounded by
`maxListPages` (default 100, `MCPListLimitError`); a 404 that arrives with a session id clears
it, re-handshakes and retries once, and `MCPHttpStatusError` keeps `status` and `method`.
Gating lives in a private `requestFor`, not the public raw `request`; two existing doubles now
declare `capabilities: { tools: {} }`. mcp is 11 files / 122 tests, pins 29 → 32.

**Verified.** `pnpm vitest run --project mcp` exits 0 (11 files, 122 tests); the mcp typecheck
passes; validator 0/0; `pnpm gate` exits 0.

**Unverified / open.** 4.2–4.8 and the phase close are not implemented.

**Next.** 4.2: write the resources/prompts/completions test and watch it fail.

**Blockers.** None.

**Artifacts.** `packages/mcp/src/client.ts`, `packages/mcp/test/client-depth.test.ts`,
`docs/plans/2026-10-24-phase-4-execution-plan.md` (Changes).
<!-- rotate:end -->
