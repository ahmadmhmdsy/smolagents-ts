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

## 2026-10-22T15:05:00+03:00 — a capability must now be consulted or enforced: the two blocking questions are answered

**State.** Decision `0020` is accepted and the plan's Phase 0 is unblocked; no package source changed. The owner approved the egress answer (A) and the output answer (E) after a session that read the code behind both bags rather than the study's summary of them.

**Did.** Wrote `docs/09-decisions/0020-a-capability-is-a-claim.md`: four clauses (a bag field has a read site or is not a capability; every claim names its consuming site and its test; description and policy are separate axes; a backend refuses what it cannot honour) and two applications. Egress gains an `egress` policy axis beside `network`: e2b passes the vendor's deny through its seam, docker and process refuse typed, allow-lists wait for a fetch capability. Output drops `structuredOutput` instead of gaining a mode enum: the schema binds to `final_answer` in both flavours and a mismatch becomes a repair observation. Folded both into Phase 0 rows 0.2, 0.4 and 0.10, marked the two questions answered, added the Docker deny-all deferral, and cleared the plan's four leftover template placeholders.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json` reports 0 errors and 0 warnings; `python scripts/rotate.py --check` is clean; `pnpm --filter docs-site test` passes, including the unresolved-link check over the new decision and its index row.

**Unverified / open.** The plan itself is still draft: the owner approved the two decisions, not the program. Six questions remain, all non-blocking. Docker deny-all needs a sidecar or an exec-based transport, deferred to the guest contract. `0020`'s follow-ups are the Phase 0 items, so none of them has a bite-sized plan yet.

**Next.** The owner approves the program and picks Phase 0; its execution plan is the first artifact of the work, and 0.2 is the smallest entry into it.

**Blockers.** `T-14` unchanged; `T-40` waits on plan approval. Nothing else new.

**Artifacts.** `docs/09-decisions/0020-a-capability-is-a-claim.md`; `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md:50-61`; `docs/09-decisions/README.md:31`.

## 2026-10-22T14:15:00+03:00 — the findings became a six-phase plan; nothing approved, nothing built

**State.** `a8573e1` plus this entry; the study's ranked backlog is now sequenced into a plan with phases, exit criteria, risks and rollback. No package source changed.

**Did.** Wrote `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`: Phase 0 truth pass (ten small items), Phase 1 durability spine (record, pending request, owner, journal, file store, CLI — strictly ordered), Phase 2 delegation, Phase 3 memory and streams, Phase 4 protocol and tool breadth, Phase 5 observation and cost, Phase 6 model depth; pointed `T-40` at it.

**Verified.** Validator reports 0 errors and 0 warnings; `rotate.py --check` is clean; the docs-site suite passes 25 tests.

**Unverified / open.** Owner approval; eight open questions, of which `EX-06` (enforce or remove) blocks Phase 0.4 and the API posture blocks its changeset. No phase has a bite-sized execution plan yet.

**Next.** The owner answers the two blocking questions and picks Phase 0; its execution plan is the first artifact of the work.

**Blockers.** `T-14` unchanged; `T-40` waits on approval.

**Artifacts.** `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`; `docs/research/competitors/_synthesis/20-ranked-backlog.md`.

## 2026-10-21T19:55:00+03:00 — the competitor study is filed: 22 dives, 565 gap rows, and a ranked backlog nobody has started

**State.** `e6b4661` plus this session's untracked research tree; no package source changed. `docs/research/competitors/` holds thirteen deep dives and nine profiles, 22 folders and about 13.6k lines, plus a synthesis layer: the baseline, the long-tail sweep, lane briefs 15–19, two verification records, the gap matrix and the ranked backlog.

**Did.** Swept the field one repository at a time through seven teammates: clone at a pinned commit, read the loop and the state model at source, file five files for a deep dive and four for a profile. Then synthesised: a 75-row heat table over the 97 baseline ids, five lane briefs, `30-findings-about-us.md` (eight row corrections, ten candidate rows we never wrote down), and `20-ranked-backlog.md` — 39 items in six releases, a refuse list, and the trigger that would reopen each deferral. Brief verification checked 243 citations, found two wrong targets and fixed them in place; the record of the wrong values stays in `06b`.

**Verified.** `python scripts/validate_context.py --root . --baseline docs/.baseline.json` reports 0 errors and 0 warnings; `pnpm --filter docs-site test` passes 25 tests including the unresolved-link check. No competitor code was copied or executed; every clone sits under the gitignored `reference/competitors/`.

**Unverified / open.** None of the backlog is implemented. `strands` documentation was unreachable, so its doc-derived claims are marked declared; the OmniRoute findings are untouched by this session.

**Next.** T-40: the owner picks the first release from `20-ranked-backlog.md`; R1 is nine small items behind seams we already export.

**Blockers.** None new; T-14, T-16, T-18, T-21, T-25 and T-39 unchanged. T-30 is closed: the event is emitted and tested.

**Artifacts.** `docs/research/competitors/README.md`; `_synthesis/10-gap-matrix.md`; `_synthesis/20-ranked-backlog.md`; `_synthesis/30-findings-about-us.md`.
## 2026-10-21T19:05:00+03:00 — OmniRoute needs no code: gateway support is a documented recipe, and the package is the owner's call

**State.** `e6b4661` plus this session's records; no source file changed. A delegated investigation answered "add OmniRoute support": the shipped `OpenAICompatibleModel` already serves the gateway's `/v1` surface unmodified, verified against the frame shapes OmniRoute 3.8.53's own source emits.

**Did.** Cloned OmniRoute read-only and ran two research shards with teammates; filed `docs/research/2026-10-21-omniroute-gateway-support.md` with its two shards (`omniroute-api-surface.md`, `omniroute-integration-notes.md`); opened T-39; added one lesson to `docs/memory/general.md`.

**Verified.** Two throwaway Node probes (outside the tree) drove the unmodified `packages/models/dist` against a stand-in on `127.0.0.1:20128`: non-streaming text, `tool_calls`, streamed deltas, `[DONE]`, streamed usage, and all four gateway stream irregularities — a keepalive frame, an error-as-data frame with no key in the message, a `choices: []` usage chunk, and a synthesized finish. `python scripts/validate_context.py --root .` reports no error in any file this session wrote; every error in that run is inside `docs/research/competitors/**`, an untracked tree a concurrent writer was still creating during this session.

**Unverified / open.** No live OmniRoute instance was contacted (it needs a provider account); per-provider tool fidelity across ~375 providers and the fallback path's ordering are unread; no test or gate ran, because no code was written.

**Next.** T-39: the owner picks phase 0 (a docs page, an example and one hand-made gateway fixture, no decision needed) or phase 1 (open the pre-registered `models-gateway` package, which needs a new decision record).

**Blockers.** T-39 on that phase choice; T-14, T-16, T-18, T-21 and T-25 unchanged.

**Artifacts.** `docs/research/2026-10-21-omniroute-gateway-support.md`; `docs/design/2026-10-12-smolagents-ts-v1-design.md:664-669`; `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md:35-40`.

<!-- rotate:end -->
