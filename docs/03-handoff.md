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
## 2026-10-25T08:20:00+03:00 — Phase 6 opened: adapter numbering and typed provider options

**State.** Phase 6 is open as `T-47`; items 6.1 and 6.3 are scheduled, 6.2 is deferred and 6.4 is answered. Phases 0–5 stay closed and nothing has been pushed.

**Did.** Asked the owner the two questions the parent plan had left to them and recorded the answers in `docs/plans/2026-10-25-phase-6-execution-plan.md`: 6.1 executes because opening the phase is what puts the adapter-interface change on the roadmap (the contract is numbered without inventing a break), and 6.2 waits under decision 0018 because no caller has asked. Wrote [decision 0026](docs/09-decisions/0026-retrieval-is-in.md): retrieval is in, as an opt-in seam for a later phase with no core hook and no scheduled code, so 6.4 closes on the record. The plan pre-registers twelve cases across three new files: core `model-adapter.test.ts` and `model-options.test.ts`, models `adapter-conformance.test.ts` and `provider-options.test.ts`, plus the phase-exit file. Updated the parent plan (status, Phase 6 note, `MD-10` checkbox, task table) and opened the task row.

**Verified.** The parent plan, the decision index, the live task table and the plan agree on the same scope; `rotate --check` is clean; no source file changed yet.

**Unverified / open.** 6.1 and 6.3 have no code: their red tests have not been written. 6.2 remains a deferred row rather than a decision.

**Next.** Land 6.1: the version marker, `ModelAdapterV1`, `upgradeModelAdapter`, the adapter declarations and the conformance suite; then 6.3.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-25-phase-6-execution-plan.md`; `docs/09-decisions/0026-retrieval-is-in.md`.

## 2026-10-25T07:10:00+03:00 — Phase 5 closed: observation and cost done

**State.** Phases 0–5 are closed; Phase 6 is reserved and waits on the owner. `T-46` closed with
its report; nothing pushed.

**Did.** Wrote the exit criterion as `packages/core/test/phase-5-exit.test.ts` (59th core file,
three clauses): the same run posts nothing with no exporter and one span tree with one, a priced
turn crossing `maxCostUsd` emits `run.limitReached` with `limitCostUsd` while the model records
one call, and an unknown price completes with no `cost` and `costBasis: "unknown"`. Wrote
`docs/reports/2026-10-25-phase-5-report.md`; marked the phase plan complete, the parent plan's
`T-46` row done and its status at Phases 0–5; updated `T-40`'s gate text and moved the `T-46` row
verbatim to `docs/tasks/archive-2026.md`; refreshed the core count.

**Verified.** The exit file passes 3 of 3; whole repo 166 files / 1295 tests (core 59/655, models
13/74); pins core 119; validator 0/0; gate exit 0 at `56d2fb8`; the close commit is docs-only.

**Unverified / open.** No live collector or bill: the exporter is proven against its mapping, and
the three price rows are list prices read on 2026-10-25 that rot. A cap checks between steps, so
the crossing turn is paid for. A resumed run without a handle starts cost at zero. Streamed
Anthropic cache tokens are mapped but have no fixture.

**Next.** Phase 6 waits for the owner to open it; `T-47` is reserved.

**Blockers.** None.

**Artifacts.** `docs/reports/2026-10-25-phase-5-report.md`,
`docs/plans/2026-10-25-phase-5-execution-plan.md`,
`packages/core/test/phase-5-exit.test.ts`.

## 2026-10-25T06:40:00+03:00 — Phase 5.2 landed: priced cost and its cap

**State.** 5.1 and 5.2 are landed; the phase close remains.

**Did.** `TokenUsage` keeps the provider's cache split (absent when unreported) and the three
HTTP adapters fill it from `prompt_tokens_details.cached_tokens`,
`cache_read_input_tokens`/`cache_creation_input_tokens` and `cachedContentTokenCount`;
Anthropic's input total adds its cache counts, as its wire reports them apart. New
`monitoring/pricing.ts`: dated sourced rows, longest-prefix lookup, integer micro-USD cost and a
six-decimal string; a missing rate falls back to the input rate, an unknown model is
`undefined`. The budget gains `maxCostMicroUsd`/`costMicroUsd`, `limitCostUsd` and
`spendCostBudget`; the loop prices each model turn so the cap lands before the next call, and
the result reports `cost` plus `costBasis`. An unknown price completes with no cost and
`"unknown"`, never zero.

**Verified.** `usage-cost-budget.test.ts` (58th core file, seven cases) red first, then the
three adapter cases red on the missing fields; core 58 files / 652 tests and models 13 / 74
exit 0; typecheck clean. Totals and the pin count (119) are in the plan.

**Unverified / open.** The streamed Anthropic cache split has no fixture, only the
`message_start` mapping; the shipped rows are list prices read on 2026-10-25 and rot; a cap
that a turn crosses still pays for that turn before stopping, so one response overshoots. The
phase close is not started.

**Next.** Write `packages/core/test/phase-5-exit.test.ts` and watch its three clauses fail red.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-25-phase-5-execution-plan.md:230`,
`packages/core/src/monitoring/pricing.ts`, `packages/core/src/session/budget.ts`,
`packages/core/test/usage-cost-budget.test.ts`.

## 2026-10-25T06:10:00+03:00 — Phase 5.1 landed: the opt-in OTel exporter

**State.** Phase 5 is open as `T-46` and 5.1 is done; 5.2 is next. Phases 0–4 stay closed and nothing has been pushed.

**Did.** Opened the phase with `docs/plans/2026-10-25-phase-5-execution-plan.md`, pre-registering the tests for 5.1, 5.2 and the exit criterion, and committed it with the `T-46` row. Landed 5.1: `TraceBuilder` is the live fold over the event stream and `buildTrace` replays through it; the root span records the provider and every closed span its duration; `monitoring/otel.ts` maps a tree to an OTLP/HTTP JSON payload and posts it through an injected fetch only when `AgentOptions.exporter` is installed. A failing exporter logs a warning and never ends the run, and payload keys are dropped unless `includePayloads` is set.

**Verified.** `packages/core/test/otel-exporter.test.ts` was watched red first (the module did not exist). Core suite: 57 files, 639 tests; pins 110 → 113 (`TraceBuilder`, `toOtlpExport`, `createOtlpHttpExporter`); typecheck clean. The gate is the last thing before the 5.1 commit.

**Unverified / open.** No export has reached a real collector; the payload is checked against its own mapping only. 5.2 has not started.

**Next.** Land 5.2: the usage split, the dated price table, the decimal cost and the between-step cost cap.

**Blockers.** None.

**Artifacts.** `docs/plans/2026-10-25-phase-5-execution-plan.md`; `packages/core/src/monitoring/otel.ts`; `packages/core/src/monitoring/trace.ts`.
<!-- rotate:end -->
