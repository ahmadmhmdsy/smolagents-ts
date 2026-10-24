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

## 2026-10-24T09:20:00+03:00 — deepseek-harness filed as a post-synthesis dive; its team model answers the delegation question

**State.** The harness we run inside is now dive twenty-two: five files under `docs/research/competitors/deepseek-harness/` and an addendum row in the register, read at `687f282e86` (MIT, version 0.2.1-rc.2; the owner's cited rc.3 is six days newer and changes only client menus). No package source changed. The plan is still unapproved and nothing from this dive is applied to it.

**Did.** Read the team subsystem page, both team package READMEs, the design note with its rejected alternatives, the subagent seam, approval, jobs, goal and plan pages, and the timing of 117 team commits in seven waves. Filed the dive: roster of named continuable children, peer messages as inbox writes delivered at a step boundary, a task board that stores claims not data, wait edges with a typed `noProgress`, and a closed approval outcome set with a per-session `never` policy. Recorded what not to copy: the durable mailbox that became dead decoder code, the nine tools before the usage shape, the separate profile layers, and a shared checkout with advisory write scopes.

**Verified.** Validator 0 errors and 0 warnings; every harness path in the dive is prefixed `clone:/` so it does not resolve into this tree; contracts present in all five files. Not verified: the adjacent-feature sweep (approval/jobs/goal/plan transferable ideas) was still running when the dive was filed; its findings belong in the dive's gap file as a follow-up edit or a newer note.

**Unverified / open.** `MA-05` is now answerable from evidence: no blackboard for data, messages as record entries, a claim board only when background children exist. The owner has not decided. The program is still unapproved, so no phase row is open.

**Next.** Brainstorm the five adoptable ideas with the owner — messaging at step boundaries, edge waits, claim board, closed approval outcomes, identity in runtime context — and get the `MA-05` wording and the Phase 2 amendment approved or rejected.

**Blockers.** `T-40` on program approval; `T-14` on credentials and on `0024`.

**Artifacts.** `docs/research/competitors/deepseek-harness/00-profile.md` through `04-sources.md`; `docs/research/competitors/README.md` addendum.

## 2026-10-24T08:05:00+03:00 — five of the six design questions are decided; delegation is the last one open

**State.** Decisions `0022` (refuse list), `0023` (one identity per run) and `0024` (publication ordering) are accepted, and the plan records the two-wave Phase 0 cut. No package source changed. `MA-05` waits on an explanation of the delegation model; `MD-10` is deferred by the owner.

**Did.** Adopted the study's refuse list as the boundary with each reopen trigger paraphrased, holding the blackboard row for the delegation answer; fixed the run vocabulary (`runId`, `waiting`, `pending`, `resume`, and the public `checkpoint` option renamed in Phase 1.1); made 0.1.0 wait for the correction pass. Folded all three into the plan: non-goals cite `0022`, Phase 1.1 carries the rename, 1.6 names `--resume <runId>`, Phase 0 gained its wave sequencing, and four open questions closed.

**Verified.** Validator 0 errors and 0 warnings; `rotate.py --check` clean; docs-site suite passes with three new decisions linked from the index and the plan.

**Unverified / open.** `MA-05`: the owner asked what the delegation process actually is and whether agents form teams or message each other, so the answer comes before the decision. `MD-10` stays open deliberately. The program itself is still unapproved, so no phase row is open.

**Next.** Explain the delegation model — typed child report, transfer, background child, steering, no peer messaging — then decide `MA-05`, then write the Phase 0 execution plan.

**Blockers.** `T-14` on credentials and now on `0024`; `T-40` on program approval.

**Artifacts.** `docs/09-decisions/0022-the-refuse-list-is-the-boundary.md`; `0023-one-identity-per-run.md`; `0024-publication-waits-for-corrections.md`; `docs/research/competitors/_synthesis/17-multi-agent-brief.md:88-106`.

## 2026-10-22T15:20:00+03:00 — Docker abandons the published Jupyter port for exec, so deny-all becomes enforceable there too

**State.** Decision `0021` accepted; `0020` stands with its Docker clause superseded. No source changed.

**Did.** Recorded the owner's choice of the exec transport: one long-lived `docker exec -i` Python process speaks the frame protocol over stdio, the container is created with `network mode` derived from egress, no port is published, readiness is a handshake frame, and `jupyter.ts` plus the WebSocket options are deleted. Added Phase 4.8 for the L-sized transport, made 0.4 say Docker refuses until it lands, and closed the Docker open question.

**Verified.** Validator 0 errors and 0 warnings; `rotate.py --check` clean; docs-site suite passes with the new decision linked from the index and the plan.

**Unverified / open.** The transport is unbuilt, so deny-all is enforced only by E2B today and Docker refuses. Signal-to-guest interruption and stdio buffering are the two design hazards the phase plan must cover.

**Next.** The owner decides the six remaining questions below (vocabulary, blackboard, retrieval, refuse list, publication timing, execution wave); then Phase 0's execution plan.

**Blockers.** `T-14`; `T-40` on plan approval.

**Artifacts.** `docs/09-decisions/0021-docker-exec-transport.md`; `packages/exec-remote/src/backends/docker.ts:25-36`, `:120-158`.

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

<!-- rotate:end -->
