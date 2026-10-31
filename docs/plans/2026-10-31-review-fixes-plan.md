# Plan — fix the 2026-10-31 review findings

- **Status:** in_progress
- **Owner:** lead
- **Created:** 2026-10-31T11:00:00+03:00
- **Authorized by:** the owner in chat, 2026-10-31: "save the report then create a plan to fix them all then proceed". That covers changes in the tree. It does not cover a commit or a push.

Status values are defined in docs/00-schema.md, the vocabulary authority.

## Goal

Every finding in [the review](../reports/2026-10-31-full-project-review.md) is fixed in the tree with a test where the behaviour can be tested, or named below as an owner decision with the reason it was not done.

## Why now

`T-14` is the next release step, and findings 2 to 6 sit on the guest boundary of a backend that ships in it. Fixing them after 0.1.0 would mean a published executor that cannot start on real Docker.

## Non-goals

- Editing frozen surfaces. Audit claims 6 and 8 touch `AGENTS.md` and the rule modules, so they stay owner decisions.
- Rewriting the two past handoff lines the uncommitted diff changed. Reverting restores two dead links, and the diff is the owner's work. A new entry records the conflict.
- Splitting `multi-step-agent.ts`. It is 2311 lines, works, and is covered; a split before release adds risk with no behaviour gained. It stays a follow-up.
- Claiming a live result. No Docker daemon, E2B account or browser is reached here.

## Approach

Work runs in the review's order of harm, test first for code. The exec-remote executor copies the QuickJS tool path: resolve against the granted list, `safeParse`, pass `parsed.data`, and give the tool a full `ToolContext`. The frame prefix gains a per-run nonce, and a line that fails to parse becomes output, not a thrown error. The nonce stops accidental and echoed text; code in the interpreter can still read it, and the plan does not claim otherwise.

The dockerode shim gets its true shape: `buildImage` awaited, the stream followed through `modem.followProgress`, and exec output split with `modem.demuxStream` into sinks with one streaming decoder each. Tests inject a double through a new client option, so these are proved against a fake with dockerode's documented shape, not a daemon.

The tools, MCP and CLI items are local guards with their own tests. CI and docs items are configuration and text.

## Phases

### Phase 1 — records and CI

- **Deliverable:** `T-58`: a lockfile check, the handoff entry for the uncommitted `scripts/` work, and the docs and governance list. `T-66`: workflow hardening and README's packaging wording.
- **Files likely affected:** `docs/02-environment.md`, `docs/03-handoff.md`, `docs/04-tasks.md`, `README.md`, `.gitignore`, `.github/workflows/*.yml`, `.changeset/config.json`
- **Exit criterion:** `pnpm install --frozen-lockfile` passes; every workflow declares top-level `permissions`; the validator's errors stay at 0.
- **Verification:** `pnpm install --frozen-lockfile --ignore-scripts`, `python scripts/validate_context.py --root .`, `python scripts/selftest.py`

### Phase 2 — the remote guest boundary

- **Deliverable:** `T-59`: tool frames validated and narrowed, the full `ToolContext`, a per-run frame nonce, and a malformed frame kept as output. `T-60`: the dockerode shim works against dockerode's real shape. `T-61`: container hardening and a process-group kill.
- **Files likely affected:** `packages/exec-remote/src/executor.ts`, `shim-source.ts`, `backends/docker.ts`, `backends/process.ts`, `packages/exec-remote/test/**`, `packages/exec-remote/AGENTS.md`
- **Exit criterion:** new tests fail before the change and pass after it: bad arguments rejected before `execute`, an ungranted tool refused, a forged fixed-prefix line stays output, `buildImage` consumed as a Promise, a framed stream demuxed, a split multibyte character intact.
- **Verification:** `pnpm vitest run --project exec-remote`, `pnpm --filter @smolagents-ts/exec-remote run typecheck`

### Phase 3 — tools, MCP and CLI

- **Deliverable:** `T-62`: the `visitWebpageTool` SSRF guard across redirects, and unclosed `DROPPED` tags. `T-63`: MCP http timeout, read bounds, bearer-over-http refusal and protected headers; stdio's env allow-list, read bound and backpressure. `T-64`: `T-53`'s warning, an `--api-key` warning, and a same-origin limit on the Vite forwarder.
- **Files likely affected:** `packages/tools/src/**`, `packages/mcp/src/transports/**`, `packages/cli/src/**`, `examples/vite-app/vite.config.ts`, their tests and `AGENTS.md` counts
- **Exit criterion:** each behaviour has a test; loopback, link-local and private literals are refused directly and after a redirect, unless the caller opts in.
- **Verification:** `pnpm vitest run --project tools`, then `mcp`, then `cli`, one at a time

### Phase 4 — close

- **Deliverable:** `T-65`: the full gate, task rows settled, the claim released, a handoff entry.
- **Files likely affected:** `docs/03-handoff.md`, `docs/04-tasks.md`, `docs/08-coordination.md`, `.changeset/*.md`
- **Exit criterion:** `pnpm gate` exits 0, or every failing stage is reported as failing.
- **Verification:** `pnpm gate`, `python scripts/validate_context.py --root .`, `python scripts/rotate.py --check`

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| The dockerode double drifts from dockerode | The shim is green and still wrong on a daemon | Shape the double from the installed `dockerode` and `docker-modem` source; state "double only" in the handoff | The docker runbook fails on first live use |
| Read-only root or a non-root user breaks the Python shim | Containers fail to start | Mount a tmpfs at `/tmp`, and write the program there | Same runbook, a permission error on `/tmp` |
| The SSRF guard blocks a real localhost use | A local fetch starts failing | An explicit `allowPrivateNetwork` option | A caller reports a refused local URL |
| Tightening MCP env inheritance breaks a server needing `PATH` | The stdio server fails to spawn | Pass the SDK's safe default set, and let `env` add to it | An MCP stdio test or a user report of a spawn failure |
| A finding fix overlaps the owner's uncommitted work | Their change is lost | Touch no line of `scripts/` or the lockfile; prepend only in the handoff | `git diff` shows a change in those lines beyond theirs |

## Rollback

Everything stays uncommitted in the tree, grouped by task, so any phase can be dropped by path with the owner's say. No phase changes data or published state.

## Open questions

None block phase 1. Owner decisions the plan will not make alone are listed in `T-65`'s handoff entry:

- [ ] Commit and push: needed before CI can go green, since the lockfile fix exists only in the tree.
- [ ] Adding the five public packages outside the changeset `fixed` group.
- [ ] Bumping `jsdom` and the other dev dependencies behind `pnpm audit` (rule 07).
- [ ] Prettier: 302 files are unformatted and the gate does not check it.
- [ ] Audit claims 6 and 8, and `context-pack.json`'s five components.
- [ ] Deleting the local `.dsh/` and `.superpowers/` directories, and whether `reports/` is tracked.

## Tasks

| Task ID | Phase | Status |
|---|---|---|
| T-58 | 1 | done |
| T-59 | 2 | done |
| T-60 | 2 | done |
| T-61 | 2 | done |
| T-62 | 3 | done |
| T-63 | 3 | done |
| T-64 | 3 | done |
| T-65 | 4 | done |
| T-66 | 1 | done |

## Notes

`T-53` already owned the `--api-base` warning, so `T-64` closes it rather than duplicating it.

`docs/04-tasks.md`'s region has about 1200 bytes free and the handoff region about 280, so rows stay short and `rotate.py --apply` runs before the closing entry.
