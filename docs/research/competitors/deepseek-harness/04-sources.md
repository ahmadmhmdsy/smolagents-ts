# deepseek-harness — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Method and its deviations

The study's method (`docs/research/competitors/_method.md`) asks for a clone at a
pinned commit under `reference/competitors/`, read at source. This dive reads the
working checkout the session runs inside, at `687f282e86`; it is the same tree the
other twenty-one dives would have read had the repository been in the 2026-10-21
field list. The worktree was clean at the read. Two consequences are recorded rather
than hidden:

- The checkout can move under a future session; the commit id above is the pin, and a
  later read that disagrees must file a newer dive rather than edit this one.
- The cited line numbers are the ones this read saw. Files under
  `clone:/packages/experimental/agent-team/` and `tool-agent-team/` are still incubating,
  so a later commit may shift them.

The owner cited release `dsh-v0.2.1-rc.3` (2026-10-23). The checkout reports
`0.2.1-rc.2` and predates it by six days; the rc.3 notes in the release page describe
client-menu and draft fixes, so no team claim here depends on rc.3.

## Repository

| source | what it is | read for |
|---|---|---|
| `clone:/README.md` | project statement, developer-preview warning, plugin claim | profile |
| `clone:/package.json`, `pnpm-workspace.yaml` | workspace shape and version | profile |
| `clone:/LICENSE` | MIT text | licence position |
| `git log`, `git tag` | pinned commit, `dsh-v0.2.*` tags, 117 team-matching commits since 2025-09-01 | chronology |
| `clone:/packages/` | 57 packages, domains | architecture |

## Team feature sources

| source | what it is | read for |
|---|---|---|
| `clone:/clone:/docs/subsystems/agent-team.md` | the authoritative team page: identity, roster, messages, task DAG, projections, replay, generated service API | data model, semantics |
| `clone:/clone:/packages/experimental/agent-team/README.md` | usage, limits, durability, model experience, known limitations | limits and behaviour |
| `clone:/clone:/packages/experimental/agent-team/src/types.ts`, `roster.ts`, `task-board.ts`, `task-graph.ts`, `task-view.ts`, `journal.ts`, `projection.ts`, `activity.ts`, `validation.ts`, `index.ts` | implementation | internals, limits, error codes |
| `clone:/clone:/packages/experimental/agent-team/tests/team.spec.ts`, `persistence.spec.ts`, `projection-events.spec.ts` | pinned behaviour | failure modes |
| `clone:/clone:/packages/experimental/tool-agent-team/README.md` and `src/index.ts` | the nine model tools, the fixed policy text, scoped registration, identity snapshots | what the model sees |
| `clone:/clone:/packages/experimental/tool-agent-team/tests/tool-team.spec.ts` | schema and wait tests | pinned behaviour |
| `clone:/clone:/packages/experimental/agent-team-profile/` | the opt-in bundle: patch file, disabled controls, narrowed limits | enabling |
| `clone:/.agents/notes/implemented/feature/2026-08-05-agent-teams.md` | the design note: decision, rejected alternatives, testing, consequences | the "why" |
| `clone:/.agents/notes/implemented/simplification/2026-09-26-team-direct-inbox.md` | direct-inbox decision | messaging rationale |
| `clone:/.agents/notes/archived/simplification/2026-08-30-team-send-message-steer.md` | one-verb steer decision | messaging evolution |
| `clone:/.agents/notes/architecture/2026-10-13-team-identity-runtime-context.md` | identity as runtime context | identity lesson |

## Subagent seam sources

| source | what it is | read for |
|---|---|---|
| `clone:/clone:/docs/subsystems/subagent.md` | capabilities, activations, continuable children, messaging, catalog, API | the layer teams stand on |
| `clone:/clone:/docs/tool-catalog.md` sections for `subagent`, `subagent_fork`, `list_agents`, `wait_agent`, `team_task_*`, `send_message`, `interrupt_agent` | model-facing schemas | what the model can actually call |
| `clone:/clone:/packages/subagent/` | seam packages | activation and continuation |

## Adjacent subsystems

| source | what it is | read for |
|---|---|---|
| `clone:/clone:/docs/subsystems/approval.md` | closed outcomes, policy, audit pair | approval comparison |
| `clone:/clone:/docs/subsystems/jobs.md` | background job runtime | background work comparison |
| `clone:/clone:/docs/subsystems/goal.md`, `plan.md` | goals and plan mode | durable-turn comparison |
| `clone:/clone:/docs/subsystems/persistence.md`, `session.md` | session store and log | durability comparison |
| `clone:/clone:/docs/subsystems/tool-execution-pipeline.md` | tool pipeline | approval and deadline comparison |
| `clone:/clone:/docs/config-catalog.md` | team and tool-agent-team keys | limits |

## Not read

The web client internals beyond the team panel's documented behaviour, the desktop
shells, credential stores, MCP transport details, the Python side tree, and the
provider adapters. None of them changes this dive's claims.

## External

| source | what it is | used for |
|---|---|---|
| https://github.com/deepseek-ai/deepseek-harness/releases | release notes, including the cited rc.3 | version context only |