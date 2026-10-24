# deepseek-harness — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Read at `687f282e86`; every claim cites `path:line` or a note under
`clone:/.agents/notes/`.

## Repository layout

A pnpm workspace of 57 packages under `packages/`, grouped by domain rather than by
layer: `core/` (agent, tools, system-prompt), `session/`, `subagent/` (seam plus
`tool-subagent`, `tool-subagent-control`), `interaction/` (user-approval,
user-questions), `jobs/`, `goal/`, `plan/`, `sandbox/`, `shell/`, `llm/`,
`mcp/`, `skill/`, `storage/`, and an `experimental/` subtree that holds the team
packages. Five apps consume them: `cli`, `web`, `desktop`, `desktop-host`,
`plugin-market-generator`.

Two documentation trees matter for a reader. `clone:/docs/subsystems/` has one page per
seam, each with a generated "Cordis API" section checked fresh in CI instead of
hand-written. `/.agents/notes/` is an implementation-note archive in the
problem/decision/alternatives/consequences form — an ADR per feature, filed under
`implemented/`, `archived/` and `architecture/`. The team design note
(`/.agents/notes/implemented/feature/2026-08-05-agent-teams.md`) is where the
"why" lives that the subsystem page does not carry.

## Everything is a plugin

Cordis supplies the kernel: a `ctx` per scope, services registered on it, `inject`
declaring what a plugin needs, events on the context, and disposal that unwinds
registrations in reverse order. A deployment is a list of plugins, so a bundle is
composition, not code. Two consequences the rest of this file relies on:

- **Capability = a mounted service plus, optionally, a model-facing tool.** A domain
  package owns the semantics; a `tool-*` package owns schemas and guidance.
- **Scoped registration.** Tools register on a member's own `ctx`, so the same tool
  name can mean a different thing to a team member than to an ordinary session; the
  team adapter shadows same-named legacy controls only for members
  (`clone:/packages/experimental/tool-agent-team/src/index.ts:180-200`).

The `experimental/` subtree is an incubation lane: packages are public and usable,
contracts carry no stability promise, and a release package may not name an
experimental one (`clone:/packages/experimental/AGENTS.md:7`).

## The durable unit: a session log

An Agent is a live turn runner; the durable truth is its Session log. Every event
carries `seq` and `time`, so ordering is the log's, never a snapshot's
(`clone:/docs/subsystems/agent-team.md` "Replay"). State the model must see is delivered as
*runtime-context snapshots* appended to that log — identity, approval policy, team
availability — rather than by rewriting the system prompt
(`clone:/docs/subsystems/approval.md` "Per-session policy"; `tool-agent-team` "Team policy
and tools"). Clients read *projections*, derived views published from the lead
session (`SessionProjectionMap.agentTeam` in `clone:/docs/subsystems/agent-team.md`).

Persistence is a plugin (`dsh-session-persistence-jsonl`), and a store is required
for teams (`clone:/packages/experimental/agent-team/README.md:34-41`). Recovery is replay:
the team projection selects records by `TeamId`, and an ordinary fork inherits its
ancestor's records but is excluded from the new root's state
(`clone:/docs/subsystems/agent-team.md` "Replay").

## The subagent seam

`clone:/docs/subsystems/subagent.md` is the layer teams are built on, and it is richer than
"child as tool":

- **Backends and capabilities.** Every backend `startActivation`s; a capability bag
  (`agentOptions`, `agentPreset`, `outputSchema`, `depthLimit`) validates a request
  before anything starts (`subagent.md:7-25`).
- **Delivery policy.** An activation is `delivery: 'parent' | 'caller'`: parent
  delivery notifies the model, caller delivery only returns the result
  (`subagent.md:36-43`). Local children always enter the parent catalog.
- **Continuable children.** A local child has a durable Session and at most one live
  activation; an absent child can cold-resume (`subagent.md:128-176`).
- **Typed results.** `outputSchema` on a request makes the child's result a
  `structured` value validated against that schema (`subagent.md:107-110, 248-255`).
- **Adjacent messaging.** `sendMessage` authorizes the exact live sender and permits
  adjacent local agents only; a running child is steered at its next step boundary,
  an absent one resumes (`subagent.md:174-180`).
- **Durable catalog.** `listChildren` / `listDescendants` read a parent-owned catalog
  without loading or resuming a child (`subagent.md:227-231, 375-395`).

## The team domain on top

The team layer (`clone:/packages/experimental/agent-team`, `.../tool-agent-team`) makes
four additions to that seam, and the "why" is in the design note:

1. **An implicit flat roster.** The root session *is* the lead (`TeamId` is its
   `SessionId`); there is no creation event. Teammates are named, immutable,
   continuable direct children, capped (`maxMembers` 16 by default, 8 in the profile
   bundle) and never renamed, deleted or reused (`agent-team.md` "Identity and
   roster"; README "Known Limitations").
2. **Peer messages without a mailbox.** Any member may `send_message` any other
   member; delivery is Steer into the target's own inbox at a step boundary, cold
   resuming an inactive target. The old lead-log mailbox remains only as a readable
   historical format (`agent-team.md` "Messages and historical mailbox";
   `/.agents/notes/implemented/simplification/2026-09-26-team-direct-inbox.md`).
3. **A task board as coordination state, not a blackboard.** Tasks are whole
   snapshots with monotonic revisions, an owner, a dependency DAG, and advisory
   `writeScopes`; every mutation is compare-and-set. It stores *claims and status*,
   never shared data (`agent-team.md` "Shared task DAG").
4. **Edges, not polling.** `waitForChange` blocks on the next roster, task, message
   or live-status edge registered after the call starts, and returns `noProgress`
   immediately when no peer is running or provisioning (`agent-team.md` "Cordis
   API"; `tool-agent-team` policy text at `src/index.ts:41-45`).

Identity is injected as required runtime context ("You are the Team Lead named
`lead`"), restored after compaction, and shared policy and schemas are identical for
leads and members; authority is enforced at execution, not by hiding tools
(`tool-agent-team/README.md` "Model Experience"; identity note
`/.agents/notes/architecture/2026-10-13-team-identity-runtime-context.md`).

## Adjacent seams this dive touches

| seam | what it owns | read in |
|---|---|---|
| approval | closed outcomes `allowed-once`/`rejected`/`cancelled`/`unavailable`, per-session `ask`/`never` policy, an audit pair per ask | `clone:/docs/subsystems/approval.md` |
| jobs | background processes: ids, status, session lifecycle records, an output ring | `clone:/docs/subsystems/jobs.md` |
| goal | a same-session objective that survives turns, with durable changes | `clone:/docs/subsystems/goal.md` |
| plan | plan mode as logged state with recovery and a pre-step append | `clone:/docs/subsystems/plan.md` |
| tools | declared complete result schemas rendered as compact JSON | `tool-agent-team` "Design philosophy" |

## One team turn's data flow

A request reaches the lead's turn → the model calls `spawn_teammate` → the service
appends a provisioning roster snapshot to the lead log, starts a continuable child
session, appends `active` → the lead creates a task and sends a message → the message
binds to the child's inbox and the child runs its own turn → the lead calls
`wait_agent` and blocks on a status edge → the child settles, the edge fires, the
lead re-reads the roster and task board → the lead aggregates and answers. If the
child is inactive the same send cold-resumes it; an interrupt preserves the inbox and
leaves task ownership untouched.

## State and persistence model

Durable: session logs; roster phases; whole task snapshots with revisions; the
historical mailbox format; the child catalog; approvals as ask/decide pairs; goals
and plan state. Not durable by design: pending team send intent (no outbox, no
resend dedupe), a target's live turn, and mailbox records written before the
direct-inbox change.

## Build and test stack

pnpm workspace; Vitest suites colocated per package; a keyless team-profile snapshot
pins the policy text and the nine tool schemas; a CLI composition test checks
persisted team and child logs; a doc-sync job regenerates and verifies the Cordis API
sections.