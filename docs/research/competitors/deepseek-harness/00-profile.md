# deepseek-harness — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Filed:** 2026-10-24, after the 2026-10-21 synthesis. This dive is a post-synthesis
addendum: the study itself stays frozen, and this folder cites the synthesis rather
than rewriting it.

## Identity

| field | value |
|---|---|
| repository | https://github.com/deepseek-ai/deepseek-harness |
| register row | post-synthesis addendum; focus "agent teams, durable sessions, approval and the plugin seam" |
| licence | MIT ("MIT License", "Copyright (c) 2026 DeepSeek") — no copyleft, no field-of-use clause |
| read commit | `687f282e86` (2026-10-17 15:22:43 +0800), the checkout this session runs inside |
| release cited by the owner | `dsh-v0.2.1-rc.3` (2026-10-23) — newer than the checkout, whose `package.json` reports `0.2.1-rc.2`; the delta in the rc.3 notes is UI menus and a draft fix, not team behaviour |
| clone | not cloned under `reference/competitors/`: the working copy is `E:\\deepseek-harness`, read in place, worktree clean at the read |
| version read | `package.json` reports `@deepseek-ai/dsh-root` `0.2.1-rc.2` |
| language and stack | TypeScript on Node; pnpm workspace with 57 packages; Cordis plugin kernel; Vitest; tsdown; oxlint; a Python side tree under `python/` |
| size signal | five apps (`cli`, `web`, `desktop`, `desktop-host`, `plugin-market-generator`) over the 57 packages; `docs/subsystems/` carries 66 subsystem pages, each with a Chinese pair |
| documentation source | `clone:/docs/` (subsystems, user guide, cookbook) plus `clone:/.agents/notes/` — an implementation-note archive that owns the *why* of each decision |

## What it is

DeepSeek Harness is an open-source agent harness: a coding agent, a web and desktop
client, a CLI, and the plugin runtime underneath them. Its architecture claim is
"everything is a plugin" on Cordis, whose unit is a service registered on a scoped
`ctx`; an Agent is a live turn runner over a durable Session log, and every
capability — tools, models, approvals, subagents, teams, jobs, MCP, sandbox — is a
mounted plugin that contributes a service, a model-facing tool, or a client surface.

Three properties make it worth a dive for this port. It is **MIT**, so its ideas are
usable in a way its code would not be. It is **the harness this project is developed
inside**, so its team feature is simultaneously the reference implementation and the
environment whose semantics the lead and teammates here actually run. And it solves,
in production shape, the exact seam the findings plan calls Phase 1 and Phase 2:
durable sessions that survive process death, a typed child-agent seam with cold
resume, and a user-approval domain with closed outcomes.

## What the study already covered

The 2026-10-21 synthesis priced multi-agent work as `MA-05` ("confirm no shared
blackboard by default") and read twenty-one neighbours. It did not read this
repository: teams landed in the 0.2 branch (design note dated 2026-08-05) and the
study's field list was fixed before the release. Its four delegate shapes — child as
tool, control transfer, background child, conversation fork — still describe the
space; the gap is that DSH implements a fifth thing the brief called "a channel with
a reducer", and it does so without a report schema at the team layer and without a
blackboard at all.

## Scope of this dive

Read: the team packages, the subagent seam, approval, jobs, goal, plan, session
persistence, the tool layer, and the implementation notes behind them. Not read: the
web client internals, the desktop shells, credential stores, MCP transport details,
and the Python side. Those appear only where a team feature depends on them.

## Licence position

No code is copied. Files here describe behaviour and cite `path:line`. MIT would
permit copying, and this tree still does not: the port's value is that its design is
argued from evidence rather than transcribed from a neighbour.
