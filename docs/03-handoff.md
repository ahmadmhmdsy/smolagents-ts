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

## 2026-10-25T04:24:00+03:00 — Phase 4.6 landed: declared transfers

**State.** 4.1–4.6 are landed; 4.7–4.8 and the phase close remain.

**Did.** `transfer.test.ts` (3 tests, the 13th exec-remote file) was watched red on variables
that never reached the guest, a transfer that did not narrow the installed set, and an
unrefused bad variable name; one case each was added to `shim.test.ts` and `e2b.test.ts`, and
one pin case for the new error. `SandboxTransfer { tools, variables }` is declared on
`RemoteExecutorOptions.transfer` and carried to the backend as `SandboxStartOptions.transfer`.
With one, the prelude installs exactly the declared tool specs and binds each variable through
the existing value wire (`globals()["seed"] = _decode(41)`) before step 0; without one, every
registry tool is installed and no variable is bound. E2B refuses a declared `transfer.tools`
with the new `UnsupportedOptionError` (backend, option, remedy) before it loads the client or
creates a sandbox. Two honest deviations: the executor reports the bad-name refusal as a failed
step named `SerializationError` because a `CodeExecutor` returns failures rather than throwing,
and the accepted name set is Python's ASCII subset.

**Verified.** `pnpm vitest run --project exec-remote` → 13 files / 97 tests, exit 0; the
package typecheck is clean; `python scripts/validate_context.py` → 0 errors, 0 warnings; the
item gate is recorded in the plan.

**Unverified / open.** No live daemon or hosted sandbox was touched; 4.7 and 4.8 are not
started. The declared transfer has no facade-level test yet.

**Next.** Write `packages/exec-remote/test/e2b-options.test.ts` and watch it fail red.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-24-phase-4-execution-plan.md:280`,
`packages/exec-remote/src/sandbox.ts`, `packages/exec-remote/src/shim-source.ts`,
`packages/exec-remote/src/backends/e2b.ts`, `packages/exec-remote/test/transfer.test.ts`.

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
<!-- rotate:end -->
