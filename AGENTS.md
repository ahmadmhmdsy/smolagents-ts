# AGENTS.md — router

This file is the pack's entry point and map. It states no rule and no live
value: every obligation and every fact lives in the file named below as its
home, and a reader reaches all of them from these pointers alone.

## Boot set (read in this order)

1. `SOUL.md` — identity, the same in every project.
2. `AGENTS.md` — this router.
3. the nearest scoped `AGENTS.md` above the working directory, when one exists.
4. `docs/08-coordination.md` (active claims).
5. `docs/03-handoff.md` (newest entry).
6. `docs/04-tasks.md` (Now).
7. `docs/02-environment.md` (if running anything).

## Precedence

The resolution order is owned by `R-01.1`; its scoped extension is owned by
`R-16.1`. Both are stated once, in the rule modules registered by
`rules/00-index.md`. This file names no level of that order and restates none
of it, so the hierarchy keeps a single home and cannot drift into a second copy
here.

## Component table

One row per component, one component per published package. Every scoped
`AGENTS.md` in the tree has a row here, and every row names a file that exists.
The path scope is the package directory, because a session working inside one
package should reach that component's entry without being told where to look.

| id | path scope | scoped entry | component rule |
|---|---|---|---|
| core | `packages/core/` | `packages/core/AGENTS.md` | `rules/components/core.md` |
| exec-quickjs | `packages/exec-quickjs/` | `packages/exec-quickjs/AGENTS.md` | `rules/components/exec-quickjs.md` |
| models | `packages/models/` | `packages/models/AGENTS.md` | `rules/components/models.md` |
| react | `packages/react/` | `packages/react/AGENTS.md` | `rules/components/react.md` |
| smolagents-ts | `packages/smolagents-ts/` | `packages/smolagents-ts/AGENTS.md` | `rules/components/smolagents-ts.md` |
| tools | `packages/tools/` | `packages/tools/AGENTS.md` | `rules/components/tools.md` |

Resolution and the scoped-entry contract are owned by `R-16.1`, `R-16.2`, and
`R-16.3` in the modules registered by `rules/00-index.md`; the form for a
scoped entry is in `_templates/`.

## Frozen surfaces

These surfaces are frozen. The rule modules change only through their
`## Contract` section, and `SOUL.md` only through its `## Change control`
section:

- `SOUL.md` — identity.
- `AGENTS.md` — this router.
- the rule modules registered by `rules/00-index.md` — the normative text.
- `_templates/` — the artifact forms.
- `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/pack.mdc`,
  `.github/copilot-instructions.md` — pointer-only adapters, each pointing at
  this file and `SOUL.md`.

Project surfaces with the same protection:

- `LICENSE`, `NOTICE` and `docs/attribution.md` — the licence text, the
  derivation notice and the upstream map, kept verbatim and never regenerated.
- line one of `README.md` — the statement that this is an independent
  implementation, which the upstream licence and downstream readers rely on.

## Project document trees

Two trees hold project documentation, and each kind of truth has one home:

| tree | holds |
|---|---|
| the numbered documents, `docs/00` through `docs/10` | the mechanism: schema, spec, environment, handoff, tasks, memory, sources of truth, coordination, decisions, runbooks |
| the project's own records: `docs/design/`, `docs/plans/`, `docs/reports/`, `docs/research/`, `docs/attribution.md` | the design record, the implementation plans, the completion reports and the upstream research behind them |

A record under `docs/design/`, `docs/plans/`, `docs/reports/` or
`docs/research/` is history pinned to the revision it was written at; it is
never the live answer to a status question.

## Where truth lives

| concern | home |
|---|---|
| Rule modules and their canonical paths | `rules/00-index.md` (the registry) |
| Every controlled value and record field | `docs/00-schema.md` |
| Identity | `SOUL.md` |
| What the project is | `docs/01-project.md` |
| What the machine and toolchain are | `docs/02-environment.md` |
| Where we are now | `docs/03-handoff.md` — newest entry |
| What is next | `docs/04-tasks.md` — Now and Blocked |
| Topics the project has learned about | `docs/05-memory.md` — the topic registry |
| A topic's full lessons | `docs/memory/<topic>.md` |
| Which artifact wins for a reportable number | `docs/07-sources-of-truth.md` |
| Domain vocabulary | `docs/06-glossary.md` |
| Owners, claims, exclusive resources | `docs/08-coordination.md` |
| Accepted decisions | `docs/09-decisions/` |
| Repeatable procedures | `docs/10-runbooks/` |
| Forms to copy | `_templates/` |
| Optional module packs | `modules/` |
| Destructive actions, secrets, permission gates | modules 03, 04, and 11, indexed in `rules/00-index.md` |

## Update triggers

| when | home that changes |
|---|---|
| a session ends or a milestone lands | a new entry in `docs/03-handoff.md` |
| a task starts, finishes, or blocks | its row in `docs/04-tasks.md` |
| a lesson is learned | the topic's shard `docs/memory/<topic>.md`, and that topic's row in the `docs/05-memory.md` registry |
| the machine or toolchain changes | `docs/02-environment.md` |
| a decision is accepted | a new file in `docs/09-decisions/` |
| a procedure changes | its file in `docs/10-runbooks/` |
| a rule changes | the module registered in `rules/00-index.md` |
| a new kind of artifact appears | its form in `_templates/`, plus a pointer here |
| a new component appears | a row in the component table above |
