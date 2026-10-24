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

**State.** The harness we run inside is dive twenty-two: five files under `docs/research/competitors/deepseek-harness/` plus a register addendum row, read at `687f282e86` (MIT, 0.2.1-rc.2; the owner's rc.3 is newer and changes client menus only). No package source changed; the plan is unapproved and nothing from this dive is applied to it.

**Did.** Read the team subsystem page, both team READMEs, the design note and its rejected alternatives, the subagent seam, approval, jobs, goal and plan, and 117 team commits across seven waves. Filed: a flat roster of named continuable children, peer messages as inbox writes at a step boundary, a task board of claims rather than data, wait edges with a typed `noProgress`, and closed approval outcomes with a per-session `never` policy. Also recorded what not to copy: the durable mailbox that became dead decoder code, nine tools before a usage shape, separate profile layers, a shared checkout with advisory write scopes.

**Verified.** Validator 0/0 after this rotation; harness paths are prefixed `clone:/` so they never resolve into this tree; contracts in all five files. Not verified: the adjacent-feature sweep was still running at filing time.

**Unverified / open.** `MA-05` is now answerable from evidence — no blackboard for data, messages as record entries, a claim board only when background children exist — but the owner has not decided. The program is unapproved, so no phase row is open.

**Next.** Brainstorm the five adoptable ideas and get the `MA-05` wording and a Phase 2 amendment approved or rejected.

**Blockers.** `T-40` on approval; `T-14` on credentials and `0024`.

**Artifacts.** `docs/research/competitors/deepseek-harness/`; `docs/research/competitors/README.md` addendum.


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

<!-- rotate:end -->
