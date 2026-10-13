# rules/12 — Coordination and multi-agent work

**Purpose:** multiple writers must not corrupt each other's work, and
delegation must not become unattributed guessing.

## Contract

- **Mutability:** approval-only.
- **Applies to:** any session with more than one writer — another agent, another
  human, or a background job.
- **Never deleted when adapting.** Mark it inactive if the project is genuinely
  single-writer, but keep it.

## Rules

**R-12.1 — Single writer by default.** Assume exactly one writer at a time
unless the project declares otherwise. *Why:* concurrency is the exception that
must be designed, not the default that is assumed.

**R-12.2 — Declare owner and scope before editing.** Every concurrent task MUST
name its owner and its write scope — the file or directory prefixes it expects
to modify — before any edit. *Why:* an undeclared scope is a collision waiting
for a timing.

**R-12.3 — Disjoint scopes or an explicit handoff.** Two writers MUST NOT edit
the same file concurrently. Overlap requires sequencing or a handoff, never a
race. *Why:* last-writer-wins silently discards a complete change.

**R-12.4 — One owner per artifact.** Advisory scope overlap MUST be resolved by
the owner of the artifact, not by whoever writes last. *Why:* ownership is what
makes a decision possible.

**R-12.5 — A delegation brief has six parts.** Deliverable, reason it is
needed, inputs, acceptance criterion, write scope, and stop condition. A brief
missing any of these MUST be completed before dispatch. *Why:* the receiving
agent cannot infer what was not said.

**R-12.6 — Delegate independent subtrees.** SHOULD delegate work that is
self-contained and would otherwise consume many turns of the critical path.
MUST NOT delegate the critical path itself. *Why:* delegation trades latency
for context, which only pays off off the critical path.

**R-12.7 — Delegated output is a claim.** The delegating agent MUST verify the
deliverable before accepting it. *Why:* unchecked delegation is unverified work
with an extra step.

**R-12.8 — Serialize exclusive resources.** Builds, test runs, ports,
databases, deployments, and any shared device MUST be used by one writer at a
time. *Why:* interleaved use produces failures that look like defects.

**R-12.9 — Communicate through durable artifacts.** Inter-agent state MUST live
in files (handoff, tasks, coordination), not in ephemeral messages. *Why:* the
next session and the next agent cannot read a conversation that is gone.

**R-12.10 — On a version conflict, re-read and rebase.** When a write is
rejected because the file changed, MUST re-read the current content, reapply the
intent onto it, and retry. MUST NOT overwrite with a stale copy. *Why:*
clobbering a peer's change is indistinguishable from data loss.

**R-12.11 — Never revert another writer's work.** MUST NOT undo, reset, or
reformat changes that are not part of the current task. *Why:* it destroys
someone else's completed work.

**R-12.12 — Escalate disagreement, do not fight.** When two agents reach
conflicting conclusions, MUST record both with evidence and escalate to the
owner. *Why:* alternating edits on a contested file lose the actual argument.

**R-12.13 — One agent owns the final report.** The delegating or lead agent
MUST produce the final verified claim; a peer's summary is an input to it.
*Why:* a spliced report has no single accountable author.

**R-12.14 — Mark inactive coordination.** If the project is single-writer,
docs/08-coordination.md MUST say so explicitly, so a future second writer knows
the rules were not considered. *Why:* silence reads as "no rule exists".

## Adapting

Record in docs/08-coordination.md: the write-scope conventions, the branch
strategy, the shared resources and how they are serialized, and the escalation
path. If the project uses a team of agents, add the roster and each role's
owned paths.
