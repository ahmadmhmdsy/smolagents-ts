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

## 2026-10-25T23:05:00+03:00 — T-48 lands: parity is re-adjudicated, planning is measured

**State.** The pre-release sequence is complete: `T-49`, `T-50`, `T-51`, `T-39` and `T-48` are done. Only `T-14`'s release gate remains; every other live row is post-release work.

**Did.** Re-recorded all six traces against upstream 1.14.0: the five existing traces are identical apart from `meta.recordedAt`, so the endings and planning changes moved no compared field, and no `differsOn` set changed. Added `planning-cadence`, the scenario S1.5 declined: planning at step 0, two actions, one scripted plan. The recorder and the replay now interleave a plan only where both sides' cadence asks for one, and both refuse a plan list the run never reaches. The scenario replays equal, step kinds and model-call roles included. Corrected the runbook's "two divergences ship" note to the one that remains (the max-steps terminal shape), taught it the `plans` field, and cited `0027` in the step-budget expectation.

**Verified.** `pnpm vitest run --project core`: 63 files and 681 tests, exit 0 (parity 7); every recording carries `upstreamVersion` 1.14.0 on Python 3.13.7; the validator and the full gate green.

**Unverified / open.** The plan text is a scripted reply, not a model's plan, so the scenario measures where planning sits and what it sends, never plan quality. The tool-calling family (`T-19`) still owns the schema's `agent` axis.

**Next.** The 0.1.0 release under `T-14`.

**Blockers.** `T-14` on npm credentials and the scope claim; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`planning-cadence.json`](../scripts/parity/scenarios/planning-cadence.json), [`parity.test.ts`](../packages/core/test/parity.test.ts), [`record-parity-traces.md`](10-runbooks/record-parity-traces.md), [`0027`](09-decisions/0027-a-run-that-runs-out-of-room-throws.md).

## 2026-10-25T22:55:00+03:00 — T-39 lands: D-08's phase 0 ships

**State.** `D-08`'s phase 0 is done. `T-48` (parity re-adjudication) is the last live row before the `T-14` release; phase 1 stays parked behind `T-54`'s demand.

**Did.** README gained "Gateways and proxies": the two-line `OpenAICompatibleModel` recipe, the CLI form with `--api-base`, `--model-id` and `--api-key`, the browser CORS and localhost-only rules, and the pin-the-id rule. `docs/10-runbooks/gateway-through-openai-compatible.md` carries discovery through `GET /v1/models`, the model id as the determinism boundary, `AbortSignal` ownership, retry-is-the-caller's, verification and failure modes. `examples/gateway/` drives `generate`, `generateStream` and one `CodeAgent` through the adapter and prints `SKIPPED`, exit 0, without `OMNIROUTE_BASE_URL`. The fixture `openai-compatible-gateway.sse.txt` and four cases pin the keepalive drop, the `choices: []` usage chunk, the synthesized finish and the error-as-data raise without the key.

**Verified.** Models 17 files and 93 tests, example-gateway 3 tests, both exit 0; `pnpm typecheck`, lint, the validator (0/0) and the full gate green.

**Unverified / open.** No live gateway was contacted: the fixture is hand-shaped from the research note at `3.8.53`, the example's tests drive an injected fetch, and the runbook records "never executed" as its verification. An error stream replaces the body it interrupts, so that fourth frame is an inline body in the test rather than a fixture line.

**Next.** `T-48`: re-adjudicate parity against the five scenarios that declare `planningInterval: 0`.

**Blockers.** `T-14` on npm credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`gateway-through-openai-compatible.md`](10-runbooks/gateway-through-openai-compatible.md), [`openai-compatible-gateway.test.ts`](../packages/models/test/openai-compatible-gateway.test.ts), [`examples/gateway/index.mjs`](../examples/gateway/index.mjs), [`README.md`](../README.md).
<!-- rotate:end -->