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

## 2026-11-12T10:00:00+03:00 — Upstream contribution: #1816 triage comment posted

- Posted the #1816 triage comment. It recommends #2239, which yields the max-steps step that memory holds. https://github.com/huggingface/smolagents/issues/1816#issuecomment-6826104861
- Upstream main is still 96f33fa. None of the watched threads has a reply yet.
- Next: the #1998 draft (section C of reports/upstream-triage-draft.md), on another day and with approval.

## 2026-11-11T18:00:00+03:00 — Upstream contribution: bug triage, #1849 comment posted

- Reproduced three zero-comment bugs on upstream main 96f33fa, offline with a scripted model:
  - #1998: a syntax error repeats the previous step's prints.
  - #1816: a duplicate ActionStep yield, and an UnboundLocalError at `max_steps=0`.
  - #1849: `from_dict` leaks the parent's settings into managed agents, even with no kwargs.
- Compared the 15 competing PRs by diff only. None was run.
- Posted the #1849 triage comment, which recommends #2534, or #2218 if `model=` should reach the children: https://github.com/huggingface/smolagents/issues/1849#issuecomment-6798697894
- Drafts for #1816 (recommends #2239) and #1998 (recommends #2048 or #2111) are in reports/upstream-triage-draft.md. Post them on later days; each needs approval.
- Gotcha: the upstream clone has an untracked `src/smolagents/.claude/` that its .gitignore doesn't cover. Keep it out of PR branches.
## 2026-11-11T08:00:00+03:00 — Upstream contribution: option 5 memory-condensation comment on issue #901 is posted

**State.** Nothing in this repo's packages changed. The owner approved, and we posted a [comment on issue #901](https://github.com/huggingface/smolagents/issues/901#issuecomment-6797764045), naming the TypeScript port in one line. It builds on hegu-1's point (compaction changes what the model sees, not what was recorded). It places compaction at `write_memory_to_messages()` (agents.py:758), which builds every model input. It proposes an append-only `CondensationStep` with covered step ids, soft and hard limits with a fallback summary, keeping the last k steps, and a pluggable summarizer. It links PR #2153 and offers a PR if a maintainer agrees with the shape. On purpose, nothing was posted to the hook threads (#2117/#2654/#2557, vendor-heavy; PR #2126 is open), skills (#1848) or async (#1342).

**Verified.** We read upstream `main` 96f33fa: :684, :832, :1284 and :1646 all go through `write_memory_to_messages`. Nothing was run.

**Unverified / open.** Upstream memory steps have no ids today, so the proposal would add them. No maintainer has replied in any option 5 thread.

**Next.** All 5 options are done. Watch #3135 (for status:accepted, then the test-only PR), #2686, #2687, #3016, #2724, #963 and #901. Any #901 PR waits behind the #3135 PR (one open PR at a time).

## 2026-11-10T17:30:00+03:00 — Upstream contribution: option 4 design comment on PR #963 is posted

**State.** Nothing in this repo's packages changed. The owner approved, and we posted a [comment on PR #963](https://github.com/huggingface/smolagents/pull/963#issuecomment-6770349035), IlyaGusev's tool-images-as-observations PR. It names the TypeScript port in one line. The comment answers aymeric-roucher's 2025-07 accidental-trigger objection with four points: tools opt in, images are collected at call time, the model is checked before the run, and each image stays on its own step. It closes with a list of related threads: #1184, #3025, #3007/#2725, #1368 and #2393. We chose this over a new RFC issue because about 10 media issues are already open and most are claimed.

**Verified.** `repro_opt4.py` (session scratchpad) ran on `main` 96f33fa with a fake model. A 4-step `run(images=[img])` sends 1, 2, 3, then 4 image items, because agents.py:574 puts the run's images on every `ActionStep`. This is the mechanism behind the already-reported #1487 (PR #1439).

**Unverified / open.** The PR #963 branch was not run. The comment says the design is "shipped" in the port, but T-56 is still unmerged on `release/0.2-multimodal`.

**Next.** Option 5, the design RFCs (skills #1848, pre-tool hook #2117/#2654/#2557, memory summary #901/#694, async #1342). Watch #3135, #2686, #2687, #3016, #2724 and #963.

## 2026-11-10T16:30:00+03:00 — Upstream contribution: option 3 review of PR #2724 is posted

**State.** Nothing in this repo's packages changed. The owner approved, and we posted a COMMENT review on [PR #2724](https://github.com/huggingface/smolagents/pull/2724#pullrequestreview-5843298514), the pluggable-executors PR for #2722. The review names the TypeScript port in one line. Daytona had already validated the PR, so the review raises only two points the thread had not covered:
- `FINAL_ANSWER_EXCEPTION_BASE = "Exception"` lets `except Exception` in model code swallow the final answer. Our shim writes the answer frame before it raises.
- Two lifecycle gaps: the factory's `TypeError` path drops the created executor without cleanup, and the `cleanup()` docstring implies `CodeAgent` cleans up after a failed `__init__`.

**Did.** Read the diff at 5d49484 and upstream `main` 96f33fa. Compared the final-answer path with `packages/exec-remote/src/shim-source.ts:255`.

**Verified.** The CPython script `repro_swallow.py` (session scratchpad) shows that a `BaseException` base reaches the executor and an `Exception` base is swallowed. `gh` shows the review as `COMMENTED` by ahmadmhmdsy.

**Unverified / open.** The PR branch was not run. Upstream `DockerExecutor.cleanup()` uses `container.stop()` with the default 10 s timeout, the same bug we fixed with `t: 0`. That stop has not been timed upstream, so it's a possible separate issue.

**Next.** Option 4, the multimodal tool-media RFC (#963, #1184, #3025, #3007). Keep watching #3135, #2686, #2687, #3016 and #2724.

**Blockers.** Maintainer responses.

**Artifacts.** [`upstream-comments-option3-draft.md`](../reports/upstream-comments-option3-draft.md).

## 2026-11-10T15:00:00+03:00 — Upstream contribution: option 2 evidence and reviews are posted

**State.** Nothing in this repo's packages changed. The owner approved and we posted three upstream comments, each naming the TypeScript port in one line: a design-evidence comment on [#2686](https://github.com/huggingface/smolagents/issues/2686#issuecomment-6769479425), and COMMENT reviews on [PR #2687](https://github.com/huggingface/smolagents/pull/2687#pullrequestreview-5843178227) and [PR #3016](https://github.com/huggingface/smolagents/pull/3016#pullrequestreview-5843178635). #3130 / PR #3134 were skipped: the bug is already reproduced and claimed, and our port has no evidence to add.

**Did.** Reproduced #2686 and #3015 on upstream `main` 96f33fa. Found an unreported variant: in a two-call batch where one call is rejected, the valid call runs but the step keeps `tool_calls=None` and `observations=None`. The #2686 comment argues for failing closed, as decision `0027` does.

**Verified.** The repro scripts ran in `smolagents/.venv`. `gh` shows both reviews as `COMMENTED` by ahmadmhmdsy.

**Unverified / open.** The PR branches were not run (running external PR code was declined), so the review points come from reading the diffs. The batch variant has no upstream issue yet.

**Next.** Watch #3135, #2686, #2687 and #3016 for replies, then move on to option 3 (review of #2724 for #2722).

**Blockers.** Maintainer responses.

**Artifacts.** [`upstream-comments-option2-draft.md`](../reports/upstream-comments-option2-draft.md).

## 2026-11-10T12:00:00+03:00 — Upstream contribution: the executor conformance proposal is posted

**State.** Nothing in this repo's packages changed. The owner wants to build a reputation with HF maintainers, with attention for smolagents-ts as a plus. The first upstream outward action is the proposal issue [huggingface/smolagents#3135](https://github.com/huggingface/smolagents/issues/3135), posted with the owner's approval. It is open, has no labels, and is waiting for `status:accepted`.

**Did.** Surveyed upstream's open issues and PRs, plus its CONTRIBUTING.md (issue first, one open PR, AI disclosure). Ranked five options: the conformance tests, which are this issue; evidence comments on #2686/#2687 and #3015/#3130; a review of #2724; a multimodal RFC; and design RFCs. Created `smolagents/.venv` (Python 3.12.9, upstream editable). The global Python 3.13 + smolagents 1.14.0 recorder is untouched. Wrote a CPython-vs-LocalPythonExecutor prototype test.

**Verified.** On upstream `main` 96f33fa the prototype gives 6 passed and 24 strict xfails, and each divergence was checked by hand. It passes `ruff check` and `ruff format` under upstream's settings. Upstream's own `test_local_python_executor.py` gives 5 failures in this venv, all from the environment: scipy and sklearn are missing, the pandas message changed, and `os.system` behaves differently on Windows.

**Unverified / open.** Whether maintainers accept the issue. The auto-compact hook added `.claude/handoffs/` to `smolagents/.gitignore`, and that line must stay out of any upstream PR.

**Next.** Wait for `status:accepted` on #3135, then open the test-only PR from `reports/test_executor_conformance.py`. Every further upstream post needs the owner's approval.

**Blockers.** Upstream maintainers' response.

**Artifacts.** [`upstream-issue-draft-executor-conformance.md`](../reports/upstream-issue-draft-executor-conformance.md), [`test_executor_conformance.py`](../reports/test_executor_conformance.py).

## 2026-11-09T23:20:00+03:00 — Fallback, local runtimes and retrieval are on main, unpublished

**State.** `main` is at `390544e`, 24 commits ahead of `origin/main`, unpushed; so are `release/0.1.0` and `release/0.2-multimodal`. Nothing is published: the owner publishes later by `docs/10-runbooks/release-guide.md`. Every follow-up in decision `0038` is done.

**Did.** `T-71` `FallbackModel` (`a0659b8`). `T-72` local runtime presets and `pnpm local:smoke` (`c377590`). `T-55` the new package `@smolagents-ts/retrieval`, outside the fixed group (`390544e`, plan `docs/plans/2026-11-09-retrieval-plan.md`). Added `rules/components/retrieval.md` under the owner's "proceed with them", since a component needs its rule file; `rules/` is approval-only, so the owner should review it. Retrieval left the `docs/01-project.md` non-goals.

**Verified.** `pnpm vitest run --project retrieval`: 4 files, 31 passed. `pnpm gate`: exit 0. `validate_context.py` and `rotate.py --check`: exit 0.

**Unverified / open.** No live run of `openAICompatibleEmbedder` or of a local runtime preset; none runs on this host.

**Next.** The owner reviews the retrieval rule file, then pushes `main` and the two release branches.

**Blockers.** Pushing and publishing wait on the owner.

**Artifacts.** `packages/retrieval/AGENTS.md`, `rules/components/retrieval.md`, `docs/tasks/archive-2026.md`.

## 2026-11-01T01:10:00+03:00 — Multimodal is built on its branch, and a live run found an old bug

**State.** All seven `T-56` phases are committed on `release/0.2-multimodal`, unpushed and unmerged. `main` is unchanged at `90e9b72`. `T-56` stays `in_progress` until the merge.

**Did.** Phase 7: the README and models README sections, the capability table, `examples/vision`, the changeset. Fixed a defect that predates `T-56`: a `ToolCallingAgent` with no `outputSchema` never offered `final_answer` on the request, so a real provider could not finish a run.

**Verified.** `pnpm gate`, `validate_context.py`, `selftest.py` and `rotate.py --check`. Live `examples/vision` on `gemini-2.5-flash`: the image reached the model, which called `final_answer` on step one and answered "Red".

**Unverified / open.** OpenAI-compatible and Anthropic media have not run live, no key on this host. OpenAI chat completions' `image_url` shape and `mp3` audio are not confirmed by a provider page. `withAttachments` has not run against a live provider. The plan's open question on a live image call as a release requirement is the owner's.

**Next.** The owner reviews the branch and decides its merge against `T-14`.

**Blockers.** The merge on the owner; `T-14` on npm credentials and timing; `T-24`, `T-52`, `T-54`, `T-70` on the owner.

**Artifacts.** `docs/plans/2026-10-31-multimodal-input-plan.md`, `examples/vision/index.mjs`, `packages/core/src/agent/multi-step-agent.ts`.

## 2026-10-31T23:58:00+03:00 — The multimodal plan is written, the build waits for the owner

**State.** `T-56`'s execution plan exists in draft and is uncommitted. No multimodal code exists. `main` stays the unpublished 0.1.0 at `81d0598`.

**Did.** Wrote the plan: seven phases on `release/0.2-multimodal`, so `main` stays publishable until `T-14`; memory holds only `MediaRef`s, resolved in one awaited step before the model call; strings stay strings; tool media arrives as a `user` turn. It records that `0034` item 6 reads backward: the shim has to flatten text parts for a version-1 adapter, not wrap its strings.

**Verified.** `validate_context.py`, `selftest.py` and `rotate.py --check` at close. Code references in the plan were checked against the tree. No code ran.

**Unverified / open.** The allowlist and the caps are not yet checked against current provider docs; Phase 2 does that. The plan's Open questions are the owner's.

**Next.** The owner approves the plan and picks whether the build waits for `T-14`.

**Blockers.** `T-56`'s build on that approval; `T-14` on npm credentials and timing; `T-24`, `T-52`, `T-54`, `T-70` on the owner.

**Artifacts.** [`2026-10-31-multimodal-input-plan.md`](plans/2026-10-31-multimodal-input-plan.md), [`0034`](09-decisions/0034-multimodal-input-is-in-and-scheduled.md).

## 2026-10-31T23:40:00+03:00 — Docker runs live, the audit is down to three, the version stays 0.1.0

**State.** Supersedes the 12:52 entry: T-58 to T-66 are committed at `18d9c03`, CI green. T-67 to T-69 are done; only `T-14` and the owner's other rows remain before release, and the owner has put publishing off. Nothing is published.

**Did.** Ran the Docker backend against a real daemon, with `docker-live.test.ts` as an opt-in suite. That found a live bug the doubles could not: the stop waited out a 10 s grace period PID 1 ignores, so it now stops with `t: 0`. Pinned `python:3.12-slim` by digest. Bumped eslint, tsup, vite and jsdom. Recorded `0035`: the fixed group stays at six and no version moves; the review changeset is folded into the 0.1.0 changelogs.

**Verified.** `pnpm gate` exit 0, 176 files passed and 1 skipped, 1397 tests passed and 7 skipped. `SMOLAGENTS_LIVE_DOCKER=1` live suite 7 of 7, no container left. `node scripts/exec-remote-smoke.mjs docker` five checks ok, 916 ms. `pnpm audit --prod` clean.

**Unverified / open.** E2B never ran: no key on this host (`T-70`). The live run covers Docker 28.3.2 on cgroup v1; the v2 branch of the caps test has not executed. `pnpm audit` keeps 1 low and 2 moderate, all dev-only and accepted: esbuild through tsup 8 (tsup 9 needs Node ^22.18, above the 22.12 floor), minimatch through eslint, and glob through e2b. The plan's other Open questions stay with the owner.

**Next.** The owner picks when to run `T-14`; until then, `T-19` or `T-57`.

**Blockers.** `T-14` on npm credentials and the owner's timing; `T-24`, `T-52`, `T-54`, `T-70` on the owner.

**Artifacts.** [`docker-live.test.ts`](../packages/exec-remote/test/docker-live.test.ts), [`0035`](09-decisions/0035-the-fixed-group-stays-and-hardening-ships-in-0-1-0.md), [`exec-remote-live-backends.md`](10-runbooks/exec-remote-live-backends.md).

## 2026-10-31T12:52:00+03:00 — The review's findings are fixed in the tree, not committed

**State.** T-53 and T-58 to T-66 are done on `main` at `4ba765c` plus an uncommitted tree. Nothing is committed or pushed. CI stays red until the lockfile fix lands.

**Did.** Fixed the workflows and docs; closed the remote guest boundary, the dockerode shim and the kill path; made `visit_webpage` refuse private hosts on every hop; bounded the MCP transports and cut the stdio server's environment to a safe list; added CLI warnings and a same-origin guard on the Vite proxy. Added `.changeset/review-hardening.md`.

**Verified.** `pnpm gate` exit 0, 176 files and 1396 tests. `scripts/validate_context.py`, `selftest.py` and `rotate.py --check` ran at close.

**Unverified / open.** No live Docker or E2B run: doubles only, and the base image digest cannot be resolved offline. On Windows a guest that exits cleanly leaves its grandchild; forced dispose kills the tree. `visit_webpage` reads the URL, not DNS, so rebinding passes. T-53's premise was wrong: `--api-base` is honoured on the default type and sends `HF_TOKEN` there, so D-08's "silently ignored" no longer describes the code. The commit must keep the separate `scripts/` and `pnpm-lock.yaml` work this session did not write; earlier handoff lines 50 and 66 stand as written.

**Next.** Owner decides the plan's Open questions, then authorizes commit and push.

**Blockers.** Owner approval for commit and push.

**Artifacts.** `docs/reports/2026-10-31-full-project-review.md`, `docs/plans/2026-10-31-review-fixes-plan.md`.
<!-- rotate:end -->
