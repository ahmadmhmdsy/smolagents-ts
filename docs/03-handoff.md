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

## 2026-10-21T16:20:00+03:00 — pushed: CI green on all six jobs, and Pages deployed only after it

**State.** `main` is pushed as `39566c1..e6b4661` (26 commits, including remediation `5b5fab8` and records `e6b4661`). CI run 39604784765 succeeded on all six jobs (gate on node 22, 24 and 26; runtime on node, bun and deno), with `version:check` in the chain; the context workflow run 39604784744 succeeded; Pages run 39605192267 built and deployed through `workflow_run`, so the site now waits for a green CI instead of deploying every push.

**Did.** Pushed the branch and watched both workflows with `gh run watch`.

**Verified.** `gh run view 39604784765` reports conclusion success with every job success; `gh run view 39605192267` reports success and the site is https://ahmadmhmdsy.github.io/smolagents-ts/ ; local `git status --short` is empty and `git worktree list` shows only the main tree.

**Unverified / open.** This records the state at `e6b4661`; this entry is a later commit and its own CI run is separate. 0.1.0 is still unpublished (T-14 needs registry credentials), and the follow-up items in the previous entry stand.

**Next.** T-14 publish when the credentials arrive; fold the two `checks.py` hardening items into a reviewed change.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** https://github.com/ahmadmhmdsy/smolagents-ts/actions/runs/39604784765 ; https://github.com/ahmadmhmdsy/smolagents-ts/actions/runs/39605192267 ; https://ahmadmhmdsy.github.io/smolagents-ts/

## 2026-10-21T16:10:00+03:00 — remediation committed, eleven-stage gate green, stale worktrees gone

**State.** HEAD `5b5fab8` is the review remediation on top of the four merged fix branches; the tree is clean. `pnpm gate` (eleven stages) exits 0: 134 test files / 945 tests, eleven packages built, publint/attw clean, `ci:check` OK, pack smoke green (11 tarballs incl. the `mcp/stdio` and `exec-remote` subpaths), site build green (76 pages). 32 stale worktrees (28 review exports, 4 merged fix worktrees) are removed and pruned; one empty ignored directory is held by a running process. CI has not run on this tree; `main` is not pushed yet.

**Did.** Committed version identity (0.1.0 in eleven packages, `version:check` in gate and CI, changelogs, publish runbook), executor hardening (process env allow-list, `network: "direct"`, write-time log caps, Docker port/memory/pid limits, the rule's Contract paragraph), the CLI bin symlink guard, StrictMode, the docs-site skip link, CI-gated Pages, the self-reading pack smoke, and the docs truth pass.

**Verified.** `pnpm gate` exit 0 at `5b5fab8` (`.superpowers/gate-output.txt`); validator 0 errors, no unbaselined warning; `git worktree list` only main; clean tree.

**Unverified / open.** CI and Pages have not run on the pushed tree. T-14 needs registry credentials. Backend `SandboxRunResult.outputs` stays step-bounded; the dockerode `HostConfig` mapping is type-checked only; the two `checks.py` hardening items are unscheduled.

**Next.** Push `main`, watch CI, confirm Pages deploys only the CI-proved sha.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md` (addendum); `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md`; `docs/10-runbooks/gate.md`; commit `5b5fab8`.

## 2026-10-21T15:55:00+03:00 — the review's fixes are merged, and the docs truth pass closes its drift

**State.** The 2026-10-21 review's fixes are merged as four commits (`e2c18fa`, `c5c4f5a`, `3c8d776`, `b323ae6`; HEAD `b323ae6`). This session ran the docs truth pass it asked for. 0.1.0 is unpublished; CI has never run on this tree. The 2026-10-16 entry's "whole post-0.1.0 roadmap" line overstated: S7–S11 was the closed roadmap, and 0018's sixth gap was never scheduled — 0019 records that.

**Did.** `scripts/_packmodel.py` skips `.claude`, so ignored worktree copies stop failing validation. `docs/10-runbooks/gate.md` lists the eleven stages in `package.json` order with eleven-package counts and the newest verified gate. `docs/06-glossary.md` and `docs/07-sources-of-truth.md` are corrected. `docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md` supersedes 0018's sixth gap. `docs/04-tasks.md` marks T-14, T-16, T-18, T-21, T-25 `blocked`; `docs/08-coordination.md` keeps T-13 `stale` and records this claim; the plans are marked landed. Stale test counts in every scoped entry are re-measured, `docs/memory/general.md` gains a lesson correcting the `network` reading, and `docs/.baseline.json` absorbs the two contract warnings with a 2026-11-20 review date.

**Verified.** `python scripts/validate_context.py --root .` exit 0, 0 errors, 16 baselined warnings; `--baseline` reports none new. `python scripts/selftest.py` pass, 23 tests. Own runs (files / tests): core 37 / 363, cli 8 / 59, react 11 / 51, tools 7 / 32, models 13 / 71; five more come from their owners' runs today.

**Unverified / open.** No full gate at `b323ae6`; other remediation scopes were uncommitted, so the tree is not the merged tree.

**Next.** Run the full gate on the merged tree and record it as the runbook's newest verified gate.

**Blockers.** T-14 needs registry credentials; T-16, T-18, T-21, T-25 need the owner's decision.

**Artifacts.** `docs/reports/2026-10-21-full-project-review.md`; 0019; `docs/10-runbooks/gate.md`.

<!-- rotate:end -->
