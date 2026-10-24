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
## 2026-10-25T06:10:00+03:00 — Phase 5.1 landed: the opt-in OTel exporter

**State.** Phase 5 is open as `T-46` and 5.1 is done; 5.2 is next. Phases 0–4 stay closed and nothing has been pushed.

**Did.** Opened the phase with `docs/plans/2026-10-25-phase-5-execution-plan.md`, pre-registering the tests for 5.1, 5.2 and the exit criterion, and committed it with the `T-46` row. Landed 5.1: `TraceBuilder` is the live fold over the event stream and `buildTrace` replays through it; the root span records the provider and every closed span its duration; `monitoring/otel.ts` maps a tree to an OTLP/HTTP JSON payload and posts it through an injected fetch only when `AgentOptions.exporter` is installed. A failing exporter logs a warning and never ends the run, and payload keys are dropped unless `includePayloads` is set.

**Verified.** `packages/core/test/otel-exporter.test.ts` was watched red first (the module did not exist). Core suite: 57 files, 639 tests; pins 110 → 113 (`TraceBuilder`, `toOtlpExport`, `createOtlpHttpExporter`); typecheck clean. The gate is the last thing before the 5.1 commit.

**Unverified / open.** No export has reached a real collector; the payload is checked against its own mapping only. 5.2 has not started.

**Next.** Land 5.2: the usage split, the dated price table, the decimal cost and the between-step cost cap.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-25-phase-5-execution-plan.md`; `packages/core/src/monitoring/otel.ts`; `packages/core/src/monitoring/trace.ts`.

## 2026-10-25T05:20:00+03:00 — Phase 4 closed: protocol and tool breadth done

**State.** Phases 0–4 are closed; Phase 5 is not opened and waits on the owner. Nothing pushed.

**Did.** Wrote the parent plan's exit criterion as its two pre-registered files.
`packages/mcp/test/phase-4-exit.test.ts` (14th mcp file): an agent over adapted MCP tools with
`secret` hidden — absent from prompt and request specs, named in `tool.policy` — plus the adapted
`slow` tool called with a progress sink, which gets the notification while an abort ends the call.
`packages/exec-remote/test/phase-4-exit.test.ts` (13th exec-remote file): a `ProcessSandbox`
guest under a declared transfer calls `host_tool(seed + 1)`, the body runs once and answers 42;
a tool outside the transfer is not installed, so the step fails with `NameError`. Closed the
phase: report, plan complete, parent `T-45` row done, task row archived, scoped counts refreshed
(mcp 14/136, exec-remote 13/95).

**Verified.** Both exit files 4 passed; whole repo 163 files / 1268 tests (core 56/631, mcp 14/136,
tools 7/32, exec-remote 13/95, CLI 11/77, react 12/56); pins core 110, mcp 32, react 13,
exec-remote root 10; validator 0/0; gate exit 0 at `c9dfa90`.

**Unverified / open.** No live daemon or sandbox was touched; dockerode's exec path is proven only
through the seam's double. The mcp exit test's second case initially failed because the harness
closed the client first — a test bug, recorded in the report.

**Next.** Open Phase 5 (observation and cost) with its plan and `T-46`, or hand back to the owner.

**Blockers.** None.

**Artifacts.** `docs/reports/2026-10-24-phase-4-report.md`,
`packages/mcp/test/phase-4-exit.test.ts`,
`packages/exec-remote/test/phase-4-exit.test.ts`.

## 2026-10-25T04:58:00+03:00 — Phase 4.8 landed: the Docker exec transport

**State.** 4.1–4.8 are landed; the phase close remains (two exit tests, report, parent-plan
check, `T-45` closed).

**Did.** `docker.test.ts` was rewritten (9 tests) and watched red on the deny-all refusal, the
missing `endpoint` on the new seam and every exec assertion. The Docker backend now starts one
container from a plain `python:3.12-slim` image, opens one long-lived `docker exec` session
whose program is the prelude plus the step loop, and resolves `start` on the guest's `ready`
frame; steps and tool replies both cross that session's stdin, and an aborted step kills the
session, whose kill path stops the container. `ContainerRuntime` replaced `endpoint()` with
`execSession()`, `ContainerCreateRequest` carries `networkMode` instead of a published port,
and `deny-all` is enforced as `none` and reported in the capability instead of refused.
`jupyter.ts`, `rpc.ts` and their two tests plus `test/ws-server.ts` are deleted; the live docs
that described the kernel gateway are updated.

**Verified.** `pnpm vitest run --project exec-remote` → 12 files / 93 tests, exit 0; `pnpm -r
typecheck` and `pnpm lint` are clean; `python scripts/validate_context.py` → 0 errors, 0
warnings; the item gate is recorded in the plan.

**Unverified / open.** No live daemon was touched: the dockerode exec implementation (hijacked
stdio, kill-stops-container) is exercised only by the seam's double. The phase close is not
started.

**Next.** Write `packages/mcp/test/phase-4-exit.test.ts` and `packages/exec-remote/test/phase-4-exit.test.ts` and watch them fail red.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-24-phase-4-execution-plan.md:222` and `:276`,
`packages/exec-remote/src/backends/docker.ts`, `packages/exec-remote/test/docker.test.ts`.

## 2026-10-25T04:38:00+03:00 — Phase 4.7 landed: E2B depth

**State.** 4.1–4.7 are landed; 4.8 and the phase close remain.

**Did.** `e2b-depth.test.ts` (8 tests, the 14th exec-remote file) was watched red on all eight
cases, then the E2B backend gained four additions, each defaulted to today's behaviour:
`metadata` reaches the vendor create call so an orphan is findable; `executionTimeoutMs`
(default 60 000) is a step's deadline when it names none, so neither the prelude install nor a
step borrows the sandbox lifetime again; `keepAliveMs` extends the lifetime before a step past
the interval, and a seam without `setTimeout` is refused at start with `UnsupportedOptionError`
after the created sandbox is killed; `contextId` may be declared on the backend or on a step
(the step wins) and reaches every `runCode`, while the process and Docker backends refuse it
typed because they own one namespace. `guestMetrics()` reports the seam's sample or
`undefined` and stays out of `SandboxCapabilities`.

**Verified.** `pnpm vitest run --project exec-remote` → 14 files / 105 tests, exit 0; the
package typecheck is clean; `python scripts/validate_context.py` → 0 errors, 0 warnings; the
item gate is recorded in the plan.

**Unverified / open.** The vendor path (`loadE2BClient`) passes metadata, contextId,
setTimeout and getMetrics through, but no test touches it: a double cannot prove the vendor
accepts them. 4.8 is not started.

**Next.** Rewrite `packages/exec-remote/test/docker.test.ts` on the exec transport and watch it
fail red.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-24-phase-4-execution-plan.md:204` and `:280`,
`packages/exec-remote/src/backends/e2b.ts`, `packages/exec-remote/test/e2b-depth.test.ts`.
<!-- rotate:end -->
