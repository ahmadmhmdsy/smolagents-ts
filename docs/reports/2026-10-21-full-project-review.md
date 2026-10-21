# smolagents-ts — full project review

**Date:** 2026-10-21 · **Repository:** `E:\python_projects\smolagents_ts` (branch `main`, HEAD `48cf29d`)

**Status:** findings open. The gate is green on this tree, but 0.1.0 should not be published from it.

## Outcome

Six independent, read-only reviews (core loop, integrations, executors + security, frontend/a11y,
docs/context pack, packaging/release) were run in parallel and spot-checked by the Lead, which also ran the
full gate and four engine probes against the built `dist`. The architecture is sound and unusually well
enforced; the release state is not. The dominant theme is **work that exists but has not landed**: four local
branches carry six reviewed fix commits (+1,568/−138), one fix is uncommitted, `main` is nine commits ahead
of `origin/main`, and CI has never run on the release candidate.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at this HEAD (with the two pre-existing modified files) | exit 0 |
| `pnpm test` | 127 files / 855 tests, exit 0 |
| context validator `python scripts/validate_context.py --root .` | **exit 1 — 56 errors**, all inside ignored `.claude/worktrees/**` |
| abort during model call (probe) | `["run.started","step.started","run.failed"]` — should be `run.cancelled` |
| throwing input guardrail (probe) | `["run.started"]`, exception escapes — no terminal event |
| `reset:false` resume (probe) | two `SystemPromptStep`s; final answer step absent from checkpoint |
| shared `ToolRegistry` + managed agent (probe) | `ToolDefinitionError: Duplicate tool name` |
| built `dist` vs manifests | `VERSION = "0.0.0"` in every package; manifests are `0.1.0` / `0.0.0` |

## Findings

### Blockers — do not publish 0.1.0

1. **Wrong runtime version.** All eleven `packages/*/src/version.ts` export `"0.0.0"`; the comment claims a
   release workflow syncs them, but no such workflow or runbook step exists. `packages/core/dist/index.js`
   contains `var VERSION = "0.0.0"`. Smoke tests assert only `typeof VERSION === "string"`.
2. **The release candidate is not on GitHub.** `main` is 9 commits ahead of `origin/main`; `origin` has one
   branch and no tags. CI triggers only on push, so the first push is the first CI run. The publish runbook's
   precondition ("`main` equals `origin/main`") fails.
3. **Six reviewed fixes are unmerged.** `claude/core-loop-fixes-278197` (`56b48e2`),
   `claude/executor-fixes-3ff03e` (`2186a9b`), `claude/integrations-fixes-5447aa` (`27ff227`, `f9d2f45`),
   `claude/ui-cli-fixes-fbd8cd` (`ad017a6`, `78a82ba`). A Pyodide late-call fix and two tools fixes are
   uncommitted in those worktrees. 33 worktrees are registered, 28 of them stale `.superpowers/review/*`.
4. **Release notes and changesets disagree with what ships.** 0.1.0 was cut before S7–S11; the six fixed-group
   packages have no changesets, the five existing changesets target the 0.0.0 packages, and the runbook expects
   the six to move together. `packages/core/CHANGELOG.md` duplicates its first-release bullet and omits S7–S11.
   Root `CHANGELOG.md`/`VERSION` are the context pack's 2.0.0, and the runbook stages root `CHANGELOG.md`.

### High — live on `main`

- **Core terminal-event contract is not guaranteed.** A throwing input guardrail emits only `run.started`
  (`multi-step-agent.ts:323`); abort during a model call is reported `run.failed` (`:366`);
  `AgentError.fromInfo` rebuilds a plain `AgentError` (`errors.ts:57`) so subclasses lose `instanceof`.
- **Resume corrupts memory.** Every run appends `TaskStep` + `SystemPromptStep` even when restoring
  (`multi-step-agent.ts:311-318`); `complete()` never checkpoints.
- **Caller's `ToolRegistry` is mutated** (`:142`, `:156-159`) — reusing it across agents throws.
- **`on(type, handler)` silently never fires**; only `on(listener)` exists (`:198`).
- **QuickJS: a timed-out step's tool call can answer the next step**; late settle can touch a disposed
  context (`packages/exec-quickjs/src/executor.ts:213/281/299-322`). Fixed on `2186a9b`.
- **Pyodide: coroutines outlive the step and can call tools after it reported**
  (`packages/exec-pyodide/src/{executor,bridge}.ts`). Partial fix uncommitted.
- **Process backend leaks `{...process.env}` into model-written Python and reports `network:"none"`**
  (`packages/exec-remote/src/backends/process.ts:55-60,92`); `docs/02` records a live `GOOGLE_API_KEY`.
- **MCP server-initiated requests are unanswered; responses matched only by global id; stdin EPIPE**
  (`packages/mcp/src/client.ts:95,312-320`). Fixed on `f9d2f45`.
- **Gemini `usageMetadata: null` throws** (`packages/models/src/gemini.ts:174-176,212`); split calls and
  mid-stream errors also unhandled. Fixed on `27ff227`.
- **CLI is a no-op when installed through a POSIX symlink** (`packages/cli/src/main.ts:85-91`); pack-smoke
  invokes the real path and cannot catch it.
- **React drops a task changed mid-run and does not cancel on unmount** (`packages/react/src/agent-run.tsx:26-33`).
- **Docs site fails WCAG 2.4.1** — `<main class="content">` with no id and no skip link
  (`apps/docs-site/src/page.ts:77`).

### Medium — docs, packaging, assurance

- Context validator fails because `SKIP_TOP` omits `.claude` (`scripts/_packmodel.py:41`); the pack's own
  health threshold is unreachable on this checkout.
- `docs/10-runbooks/gate.md` says nine stages / five packages; the gate has ten stages and eleven packages.
- Decision `0018` claims six roadmap gaps including provider router/local runtimes; the adopted plan defers
  those to "later candidates" and the handoff calls S7–S11 "the whole roadmap".
- `docs/08-coordination.md` keeps the expired T-13 claim active; commits wrote in its scope without reclaim.
- `docs/04-tasks.md` says owner-decision work is `blocked` but five such rows are `pending`, Blocked is "None".
- `docs/07-sources-of-truth.md:45-49` still derives counts from "five directories under `packages/`".
- Plans still say "approved" after landing; validator c03/c04/c05 have blind spots (plan status, archived
  evidence, handoff field names); ADAPT prose produces false positives.
- pack-smoke checks root barrels only: it never imports `@smolagents-ts/mcp/stdio` or
  `exec-remote/{process,docker,e2b}`, never asserts `LICENSE`/`NOTICE`/version in tarballs.
- Pages deploys on push with no CI dependency; gate/CI have no `changeset status`.
- QuickJS/remote logs are unbounded; Docker `containerPort` cannot work; no container memory/pids limits;
  bare-sandbox `RemoteExecutor` bricks after one timeout; Jupyter token only in the query string.

### Low

- `packages/cli/src/version.ts` doc comment is one of eleven false "release workflow" claims.
- `scripts/exec-remote-smoke.mjs` is referenced by nothing; Prettier is installed but no stage formats.
- Validator component-rule column is never read; `rules/components/` is not globbed by c00_index.

## What is strong

- Architecture is enforced, not asserted: depcruise, architecture tests, isomorphic core, public-surface pins.
- Gate parity with CI is programmatic (`scripts/check-ci.mjs`), and the gate is genuinely green.
- Packaging is release-shaped (ESM, exports/types, sideEffects, engines, publishConfig, files, prepack licence).
- Licence/attribution is honest for a derived work: pinned upstream revision, modification list, no vendoring.
- Executor docs are candid about non-isolation; Pyodide poisoning and QuickJS sealing are real.
- Lockfile/manifests agree across all 18 importers; no secrets committed; supply chain clean.
- The context-pack design (single-home rule, append-only handoff, claims, schema) is excellent; execution drifted.

## Recommended order

1. Land the four branches (run their suites), commit the Pyodide/tools WIP, delete the stale worktrees; add the
   branches' regression tests to the gate.
2. Derive/sync `VERSION` from `package.json`; assert equality per package and in pack-smoke.
3. Choose 0.1.0 as the first release (nothing is published or tagged): rewrite/dedupe the six changelogs, run
   `changeset version` for the five pending packages, reconcile the runbook.
4. Push `main`, let CI run, gate Pages deploy on CI success.
5. Close the core lifecycle holes (mostly covered by `56b48e2`).
6. Harden executors: merge QuickJS fix, per-run bridge generation for Pyodide, env allow-list in the process
   backend, cap log buffers.
7. Fix the CLI bin guard and React unmount/mid-run task.
8. Truth pass on docs: `.claude` in `SKIP_TOP`, regenerate the gate runbook, supersede 0018, fix tasks/claims/07,
   mark plans done.
9. Add skip link and `<main id="main">` to the docs site.

## Limits

No live provider, Docker, E2B, registry publish, POSIX shell or browser accessibility scan was used. Branch
test outcomes were not executed before merge. Gate/publint/attw/pack-smoke results apply to this working tree
only; CI has never run these commits. REA was loaded but not used: its rule says ordinary source-repository
analysis uses normal repository tools, and nothing outside the project was touched.
