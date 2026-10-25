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
## 2026-10-25T09:50:00+03:00 — Phase 6 closed, and with it the program

**State.** Phases 0–6 are closed. `T-47` and `T-40` are done; nothing is pushed. Publication still waits on `T-14`.

**Did.** `packages/models/test/phase-6-exit.test.ts` proves the three clauses: a shimmed pre-numbering model finishes a run, a cache hint set through agent options reaches the Anthropic body, and the barrel's adapters are exactly the conformance list. The list moved to a shared test module. Report, parent plan, tasks and the execution plan closed in one commit.

**Verified.** Exit file 3 passed; core 61/662, models 16/89, whole repository 171/1317; validator 0 errors and 0 warnings; `pnpm gate` exit 0.

**Unverified / open.** No v2 exists, so the shim's translation path is unproven by construction. 6.2 reopens only when a caller asks under 0018. Retrieval has a decision and no date.

**Next.** `T-14` when the owner supplies credentials; otherwise the pending rows in the task file.

**Blockers.** None.

**Artifacts.** [`2026-10-25-phase-6-report.md`](reports/2026-10-25-phase-6-report.md).

## 2026-10-25T09:30:00+03:00 — Phase 6.3 landed: provider options have a typed home

**State.** Phase 6 is open as `T-47`; 6.3 is done and the exit criterion is next. 6.2 stays deferred under 0018 and 6.4 stays answered by 0026. Nothing pushed.

**Did.** `GenerateOptions.providerOptions` is an opaque record; `AgentOptions.modelOptions` pins options for every turn and is spread beneath the loop's signal and advertised tools. The three wire adapters export typed interfaces with `extraBody`, Anthropic adds up to three cache breakpoints with a `5m`/`1h` lifetime, OpenAI names its prompt-cache key and retention, Gemini names `cachedContent`. Widened request parameters keep `Model` assignability.

**Verified.** Both case files were watched red: the core file on the absent option, the adapter file on the missing fields. `pnpm typecheck` clean; core 61 files / 662 tests (two cases), models 15 / 86 (six cases).

**Unverified / open.** No provider was reached; bodies come from recorded fixtures. The breakpoint cap is three, under Anthropic's four, because three are what a fixture can prove. The back-compat claim is one test: no options yields the same body shape as before.

**Next.** Write the exit file, the report, close the phase.

**Blockers.** None.

**Artifacts.** `packages/models/test/provider-options.test.ts`; `packages/core/test/model-options.test.ts`.

## 2026-10-25T09:10:00+03:00 — Phase 6.1 landed: the adapter contract is numbered

**State.** Phase 6 is open as `T-47`; 6.1 is done and 6.3 is next. Phases 0–5 stay closed and nothing has been pushed.

**Did.** `packages/core/src/model.ts` exports `MODEL_ADAPTER_VERSION` (1), `ModelAdapterV1` and `upgradeModelAdapter`; the shim returns a declared adapter by identity and otherwise supplies the version while forwarding `generate` and `generateStream`. `OpenAICompatibleModel`, `AnthropicModel`, `GeminiModel` and `CustomModel` declare the version; `HuggingFaceModel` inherits it. `packages/models/test/adapter-conformance.test.ts` drives all five adapters over their recorded fixtures with one request-bound fetch, plus a bare model through the shim. Three core cases and two pins.

**Verified.** `model-adapter.test.ts` was watched red (the export was not a function); the conformance file was red for the four wire adapters and green after the declarations, with the Gemini case red once more until the stream URL picked the SSE fixture. Core suite 60 files / 660 tests, models 14 / 80, pins 121, `pnpm typecheck` exit 0.

**Unverified / open.** No second contract version exists, so the shim is proven on a pre-numbering model, not on a v1-to-v2 translation; that path is owed by whichever change bumps the number. The conformance file is a list, and the exit test will import it.

**Next.** Land 6.3: the opaque `providerOptions` field, `AgentOptions.modelOptions`, and the three typed adapter interfaces with their cache markers.

**Blockers.** None.

**Artifacts.** `packages/core/src/model.ts`; `packages/models/test/adapter-conformance.test.ts`.

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
<!-- rotate:end -->
