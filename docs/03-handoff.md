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

## 2026-10-25T02:30:00+03:00 — Phase 4 opened: protocol and tool breadth

**State.** Phase 4 is open and nothing in it has landed yet. `T-45` is the row that carries it.

**Did.** Wrote `docs/plans/2026-10-24-phase-4-execution-plan.md`: eight items, each with the
acceptance tests registered before its code, a design, the public-surface accounting (mcp 29 → 32,
core 108 → 110, exec-remote root 9 → 10) and a close plan. Opened `T-45` in `docs/04-tasks.md`,
moved the parent plan's row, and narrowed `T-40`'s gate cell to name the open phase.

**Verified.** Validator reads 0 errors / 0 warnings; rotation is clean; `pnpm gate` exits 0.

**Unverified / open.** No Phase 4 item is implemented. The pin counts above were measured from each
package's pinned list; the Phase 3 report's "core 115" does not match the 108-name list, so this
phase counts from the list itself.

**Next.** 4.1: write `packages/mcp/test/client-depth.test.ts` and watch it fail.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-24-phase-4-execution-plan.md:1`; the `T-45` row in
`docs/04-tasks.md`.

## 2026-10-25T02:05:00+03:00 — Phase 3 closed: memory and streams

**State.** Phase 3 is complete; 3.1 and 3.2 are landed and the exit criterion runs as two cases.
`T-44` is done and the parent plan's row says so. Nothing pushed; Phase 4 is not opened.

**Did.** The exit test `phase-3-exit.test.ts` (54th core file) runs the parent plan's criterion
over a `FileRunStore`: a three-note session condenses, `buildTrace` carries a
`memory.condensed` span whose forgotten ids equal the event's, and the record keeps the step and
the event; a reader's kept cursor, followed through a second store over the same files after a
continuation, returns exactly the later events with the new cursor and no truncation. The report
`docs/reports/2026-10-24-phase-3-report.md` records the outcome, the evidence, the two parent rows
and the open items; the execution plan is marked complete with a close entry.

**Verified.** Core 54 files/605 tests, CLI 11/77, react 12/56; pins core 115, react 13. `pnpm
gate` exit 0; validator 0/0; rotate clean. Commits: 3.1 `4631f0c`, 3.2 `cc7e947`, close follows.

**Unverified / open.** Condensation thresholds are character estimates, not a tokenizer; the event
cap counts entries, not bytes; `useRunEvents` re-reads the retained tail per commit; a store that
never calls `watch` listeners leaves a live client stale until it remounts. Publishing still waits
on `T-14` credentials.
<!-- rotate:end -->
