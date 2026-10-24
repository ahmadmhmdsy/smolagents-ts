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
## 2026-10-24T15:20:00+03:00 — Phase 1 opened: the durability spine

**State.** Phase 0 is closed and pushed nowhere: ten correction commits, `pnpm gate`
exit 0, core 39 files and 460 tests. The owner said "continue to next phase", so Phase 1
is now open with its execution plan and `T-42` in `in_progress`. Nothing in Phase 1 has
landed yet. All the gated rows are unchanged: `T-14` waits on registry credentials,
`T-39` on the OmniRoute phase choice, `T-16`, `T-18` and `T-21` on owner decisions.

**Did.** Wrote [`docs/plans/2026-10-24-phase-1-execution-plan.md`](docs/plans/2026-10-24-phase-1-execution-plan.md):
eight strictly ordered items, each with a pre-registered acceptance test, a rollback and
a file scope, grounded in the durability brief and decision `0023`. Opened `T-42` with
the wave split: wave A is the record, the pending request, ownership and the journal
(1.1–1.4, one loop writer); wave B is the file store, the CLI flags, the conversation and
the fork (1.5–1.8).

**Verified.** Each criterion was checked against the shipped seam before being written:
the store still saves a `RunSnapshot` under `RunOptions.checkpoint`, `RunState` has two
values, and the Phase 0.8 contract suite is the one every store item extends. This entry
is docs only.

**Unverified / open.** No Phase 1 code exists, so no acceptance test has run. Four readings
are mine to prove or amend in `## Changes`: the
record's version 2 with a dual reader for v1/v0; `pending` as a fifth approval verdict;
the digest-and-step binding of a settled approval on replay; and a core file store over an
injected filesystem seam with the Node binding in the CLI.

**Next.** Write the 1.1 acceptance test red, then the record type and the one commit
boundary.

**Blockers.** None in this phase.

**Artifacts.** `docs/plans/2026-10-24-phase-1-execution-plan.md`,
`docs/04-tasks.md:56`, `docs/research/competitors/_synthesis/15-durability-design-brief.md`.

## 2026-10-24T14:20:00+03:00 — Phase 0 closed: all ten items landed

**State.** Phase 0 is done and `T-41` is `done`: ten correction items landed, each with
its pre-registered acceptance test, its plan entry, its handoff entry and its commit.
`pnpm gate` exits 0; core reports 39 files and 460 tests. Nothing is pushed, and the
unpublished `0.1.0` still waits on `T-14`'s credentials. `T-40` (the parent research
plan) stays `in_progress`: Phase 1 has not been opened.

**Did.** 0.10: the tool-calling agent advertises tools only to a model that claims
`toolCalls`, sends the bound schema in the prompt to one that does not, reads a JSON
text reply as the answer, and spends the bounded repair turn when the text answer has the
wrong shape. The acceptance test fails twice and then succeeds inside the attempt bound,
with no tool schema on the wire. No `packages/models` change was needed —
`CustomModel` already reports `toolCalls: false`.

**Verified.** `pnpm gate` exit 0; core 39 files, 460 tests; validator 0 errors,
0 warnings; `rotate.py --check` clean.

**Unverified / open.** Phase 1 is unopened. Two items remain parked outside this phase:
`MD-10` (deferred by the owner) and `T-14` (blocked on registry credentials). The
publication hold stands until the corrections ship.

**Next.** The owner picks the next phase (or a release); `T-40` is the row to reopen.

**Blockers.** None in this phase.

**Artifacts.** `docs/plans/2026-10-24-phase-0-execution-plan.md`,
`packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/src/agent/multi-step-agent.ts`,
`packages/core/test/guardrail.test.ts`.

## 2026-10-24T13:45:00+03:00 — 0.9 landed: a budget record, a typed limit, a handle

**State.** Nine Phase 0 items in (0.1–0.9). Last one is 0.10: structured output on a
model that cannot call tools.

**Did.** Added `session/budget.ts`: requested limits (turns, output tokens, total
tokens) clamped by the deployment ceiling, a `RunBudget` record on the run context and in
`RunResult.budget`, and a caller-held `RunBudgetHandle` that continues the counters into
the next run. A resumed checkpoint without a handle seeds its counters from its own steps,
so the budget does not reset. Crossing a limit ends the run with a new terminal event,
`run.limitReached`, carrying the typed reason; the session status became `limit_reached`
and the React label and CLI line were updated for it (both gates caught the missing React
entry).

**Verified.** `pnpm gate` exit 0; core 39 files, 458 tests (seven new: clamping, the
three typed reasons, the seed, the run-level limit, the shared handle and the
non-resetting resume).

**Unverified / open.** The ceiling is a module constant, not configuration; 0.9 has no
deployment-level wiring. A handle is in-memory only, so a process restart still needs the
checkpoint path to continue a budget.

**Next.** 0.10: bound a schema for a model with `toolCalls: false` and repair without a
forced tool.

**Blockers.** None.

**Artifacts.** `packages/core/src/session/budget.ts`,
`packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`,
`packages/core/test/budget.test.ts`, `packages/react/src/agent-run.tsx`,
`packages/cli/src/renderer.ts`.

## 2026-10-24T13:10:00+03:00 — 0.8 landed: the store contract, with counterexamples

**State.** Eight Phase 0 items in (0.1–0.8). Next is 0.9's budget record, then 0.10's
tool-less structured output.

**Did.** Wrote `test/contract/run-store.contract.ts`: ten store modes, each check paired
with a deliberately broken counterexample the suite must reject. Certified three
implementations — `MemoryRunStore`, an asynchronous wrapper and a temporary-file store
double that stands in for the durable file store Phase 1.5 has not built. The contract
found a real leak: `MemoryRunStore` handed out its internal steps array, so a caller that
mutated a loaded checkpoint changed the stored one. It now copies on both sides of the
boundary.

**Verified.** `pnpm gate` exit 0; core 38 files, 446 tests (the contract file alone
registers sixty).

**Unverified / open.** The file store certified here is a test double, not the 1.5
artifact; when 1.5 lands, its store joins this file and the double goes.

**Next.** 0.9: turn/output/total-token limits on the record, a typed terminal reason and
a handle that continues the budget.

**Blockers.** None.

**Artifacts.** `packages/core/test/contract/run-store.contract.ts`,
`packages/core/test/contract/run-store.conformance.test.ts`,
`packages/core/src/session/run-store.ts`.

## 2026-10-24T12:40:00+03:00 — 0.7 landed: every tool has a finite deadline

**State.** Seven Phase 0 items in (0.1–0.7). Next is 0.8's conformance suite, then 0.9's
budget record and 0.10's tool-less structured output.

**Did.** `tool()` now guards every tool with a deadline: 120 s by default, overridable
per definition, 0 to disable. The around-wrapper races the call against its timer,
replaces a result only when that timer fired, swallows a loser's late rejection, and
classifies an aborted run as cancellation rather than as a timeout. A deadline failure
is `ToolTimeoutError` (code `AGENT_TOOL_TIMEOUT`, limit in the message); the
tool-calling agent keeps that typed error instead of flattening it into a generic call
failure, and rethrows cancellation.

**Verified.** `pnpm gate` exit 0; core 37 files, 386 tests (four new: deadline failure,
cancellation classification, and the agent-level action failure carrying the code).

**Unverified / open.** A custom `Tool` implementation that does not go through `tool()`
gets no deadline; the seam guards the factory, not the interface.

**Next.** 0.8: the store conformance suite over ten failure modes.

**Blockers.** None.

**Artifacts.** `packages/core/src/tool/timeout.ts`,
`packages/core/src/tool/tool.ts`, `packages/core/src/agent/tool-calling-agent.ts`,
`packages/core/src/errors.ts`, `packages/core/test/tool.test.ts`,
`packages/core/test/tool-calling-agent.test.ts`.
<!-- rotate:end -->
