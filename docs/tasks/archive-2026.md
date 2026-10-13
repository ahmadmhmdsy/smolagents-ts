# Task archive -- 2026

Completed task rows, moved verbatim from `docs/04-tasks.md`. Rotation moves; it never deletes.

---

## Closed 2026-10-14

| id | title | status | owner | scope | gate | evidence |
|---|---|---|---|---|---|---|
| T-8 | plan and execute S3: the tool system | done | maintainer | `packages/tools/`, `docs/` | a written S3 plan exists and its Definition of done holds | `docs/plans/2026-10-14-s3-tool-system-plan.md` — seven tasks, commits `744b72d`..`a48bb40`; `.superpowers/gate-s3.txt` — `pnpm gate` exit 0; tools suite 7 files and 28 tests, exit 0; validator `new: 0`, 0 errors |

## Closed 2026-10-13

| id | title | status | owner | scope | gate | evidence |
|---|---|---|---|---|---|---|
| T-1 | finish the context-pack adoption on this branch | done | maintainer | `AGENTS.md`, `docs/02-environment.md`, `docs/03-handoff.md`, `docs/04-tasks.md`, `packages/*/AGENTS.md`, `rules/components/*.md` | the validator exits 0 and no home marker remains | `.superpowers/validate-final.txt` — 0 errors, 0 warnings with `docs/.baseline.json`; `.superpowers/gate-output-final.txt` — `pnpm gate` exit 0 |
| T-3 | decide the sub-project after S1: S2 or S4 | done | owner | `docs/01-project.md` | the owner answers the open question in `docs/01-project.md` | `docs/01-project.md` revision log row 3 — owner chose S2 on 2026-10-13 |
| T-4 | confirm or upstream the local pack patch | done | owner | `scripts/_packmodel.py`, `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md` | the decision record moves from proposed to accepted | `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md` — Status accepted, 2026-10-13 |
| T-2 | close the two ToolCallingAgent gaps inherited from S1 | done | maintainer | `packages/core/src/agent/`, `packages/core/src/session/`, `packages/core/test/` | S2a plan Tasks 3 and 4; the gaps close when the schemas reach the request and the session records the call | `packages/core/test/tool-calling-agent.test.ts` asserts the advertised schemas; `packages/core/test/agent-session-toolcalls.test.ts` — 2 of its 3 tests fail against the pre-fix session; core suite 28 files and 286 tests, exit 0 |
| T-6 | execute the S2a plan: the model seam and the OpenAI-compatible adapter | done | maintainer | `packages/core/`, `packages/models/`, `tsconfig.base.json`, `docs/` | the plan's Definition of done holds and `pnpm gate` exits 0 | `.superpowers/gate-s2a.txt` — `pnpm gate` exit 0, 38 files and 319 tests, `pack-smoke OK`; commits `511f5e4`..`85f194e` |
| T-7 | plan and execute S2b: the Anthropic, Gemini and HuggingFace adapters | done | maintainer | `packages/models/`, `docs/` | a written S2b plan exists and its Definition of done holds | `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md` — eight tasks, commits `8424350`..`bda2663`; `.superpowers/gate-s2b.txt` — `pnpm gate` exit 0; models suite 13 files and 62 tests, exit 0; validator `new: 0`, 0 errors |
