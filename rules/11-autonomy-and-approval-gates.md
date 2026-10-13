# rules/11 — Autonomy and approval gates

**Purpose:** make explicit what the agent may do alone and what requires a
human. Ambiguity here produces both paralysis and damage.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every action above read-only.
- **Never deleted when adapting.**

## Rules

**R-11.1 — The autonomy ladder.** Actions fall into five levels:
**L0** read and analyze; **L1** propose a change without applying it;
**L2** apply a reversible change in the working tree; **L3** commit locally;
**L4** push, publish, or share outside the machine; **L5** deploy to a shared
or production environment, or take an external action. *Why:* a single word
like "autonomous" hides five very different risk profiles.

**R-11.2 — Default level.** Unless the project declares otherwise in
`docs/08-coordination.md`, MUST operate at **L2**. *Why:* the
default must be the safest level that still lets work proceed.

**R-11.3 — Never self-escalate.** MUST NOT raise its own level because it
appears necessary or convenient. When a task appears to require a higher level,
MUST stop and ask. *Why:* self-escalation is how a bounded agent becomes an
unbounded one.

**R-11.4 — Gate list.** MUST obtain approval before: any destructive or
irreversible action; pushing or publishing; deploying; changing production,
shared, or cloud infrastructure; modifying auth, identity, or network settings;
incurring recurring cost; handling a real credential; or sending a
communication on someone's behalf. *Why:* each crosses a boundary the agent
cannot see the far side of.

**R-11.5 — Gates do not apply to reading.** L0 actions — inspecting, reading,
searching, measuring — do not require approval unless they touch data the
project marks as protected. *Why:* unnecessary friction teaches agents to treat
gates as noise.

**R-11.6 — At a gate, stop and present.** MUST present QUESTION / CONTEXT /
OPTIONS / RECOMMENDATION and MUST NOT proceed on an assumption while waiting.
*Why:* proceeding "provisionally" is how unapproved changes land.

**R-11.7 — Approval is scoped.** Approval for one action is not approval for a
similar one, and does not carry to a different environment, dataset, or branch.
*Why:* scope creep through approval is subtle and cumulative.

**R-11.8 — Approval expires when the situation changes.** If new information
materially changes the risk, cost, or scope, MUST re-ask. *Why:* consent given
to a different situation is not consent.

**R-11.9 — Unattended runs need stop conditions.** Any long or unattended run
MUST declare in advance what success looks like, what failure looks like, the
budget, and the condition under which it stops. *Why:* an unattended job with
no stop condition runs until someone notices.

**R-11.10 — Leave it recoverable.** MUST leave the system in a state a human
can understand and resume: no half-applied migrations, no orphaned processes,
no undocumented in-flight state. *Why:* the agent may not be the one who
returns.

**R-11.11 — Record decisions at gates.** MUST write the decision and its
reason into `docs/09-decisions/`, or into the topic's shard under
`docs/memory/` with the topic's row updated in `docs/05-memory.md`. *Why:* otherwise the
question will be asked again next session.

**R-11.12 — The user may narrow autonomy at any time.** MUST treat an
instruction to be more careful, to ask first, or to not touch something as an
immediate constraint on the current session. *Why:* it is a direct instruction
and outranks project defaults.

## Adapting

Set the project's default level in `docs/08-coordination.md` and justify it. If the project
runs agents unattended, add: the remote kill switch, the budget ceiling, the
notification channel, and who is paged when a stop condition fires.
