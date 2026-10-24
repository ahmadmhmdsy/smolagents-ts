# deepseek-harness — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

One row per capability, with the evidence this dive actually read. "Shipped" means a
default or first-class profile mounts it; "experimental" means it is a public package
behind an opt-in profile with no stability promise; "absent" means the tree does not
have it.

## Agent runtime and sessions

| capability | what it does | evidence | state |
|---|---|---|---|
| session log as truth | every turn appends events with `seq` and `time`; replay reconstructs state | `clone:/docs/subsystems/session.md`, `persistence.md` | shipped |
| runtime-context snapshots | model-visible state (identity, approval policy, team availability) appended as user messages, never by rewriting the system prompt | `clone:/docs/subsystems/approval.md` "Per-session policy"; `tool-agent-team` "Model Experience" | shipped |
| steering a running turn | a message lands at the target's nearest step boundary rather than queueing a new turn | `clone:/docs/subsystems/subagent.md:174-180`; team note "Mailbox and task transactions" | shipped |
| interruption | cancel the current turn, keep the inbox | `clone:/docs/subsystems/subagent.md:477,575` (`interruptByParent`) | shipped |
| compaction | condense retained history when the context budget is exceeded | `clone:/docs/subsystems/compaction.md` | shipped |
| same-session goals | one durable objective that survives turns and compaction | `clone:/docs/subsystems/goal.md` | shipped |
| plan mode | plan as logged state with recovery, a pre-step append and an exit tool | `clone:/docs/subsystems/plan.md` | shipped |
| format version and migrations | one hand-maintained session-format integer, one migration package per integer, a generated catalog that rejects gaps, and a newer minimum that refuses | `clone:/docs/session-format-status.md:20`; `clone:/docs/subsystems/persistence.md:147-152,189` | shipped |
| storage contract suite | the storage backend contract is normative clause by clause, and one shared suite in `tests/contract.ts` checks every backend | `clone:/docs/subsystems/storage.md:47` | shipped |
| token meter | an immutable measurement at one log revision, consumed by compaction before request derivation | `clone:/docs/subsystems/token-meter.md:9-27`; `compaction.md:101` | shipped |
| resume repairs forward | replay, then append synthetic `turn/end{kind:'interrupted'}` and the missing tool results; a concurrent writer refuses | `clone:/docs/subsystems/persistence.md:110-112` | shipped |
| projections | derived views published to clients from the owning session, never a second store | `clone:/docs/subsystems/session-projection.md` | shipped |

## Models, tools, execution

| capability | what it does | evidence | state |
|---|---|---|---|
| model adapters and streaming | provider adapters on a streaming seam; model selection per session | `clone:/docs/subsystems/llm-streaming.md`, `core.md` | shipped |
| declared tool results | every tool declares its complete result schema; the compiler checks `execute` against it and the runtime renders compact JSON | `tool-agent-team/README.md` "Design philosophy" | shipped |
| per-tool deadline | `timeoutMs` is a definition field never sent to the model; an around-wrapper swaps a derived deadline and replaces the result only when its own timer fired, typed `TOOL_TIMEOUT` | `clone:/packages/guard/timeout-policy/src/index.ts:18-79`; `clone:/docs/subsystems/tools.md:63-70` | shipped |
| deny-only guard stage | after the reorderable policy waterfall, a second stage whose return type has no allow result, so listener order cannot undo a denial | `clone:/docs/subsystems/tools.md:182,325-336,541-551` | shipped |
| tool pipeline with approval gate | approvals are asked inside the tool pipeline and callers fail closed | `clone:/docs/subsystems/approval.md`; `clone:/docs/subsystems/tool-execution-pipeline.md` | shipped |
| sandboxed execution | sandbox domain with profiles; shell and subprocess tools behind it | `clone:/docs/subsystems/sandbox.md`, `shell.md`, `subprocess.md` | shipped |
| background jobs | long-running processes with ids, status, an output ring and session lifecycle records | `clone:/docs/subsystems/jobs.md` | shipped |
| MCP client and server | MCP seam with transports | `clone:/docs/subsystems/mcp.md` | shipped |
| skills | a skill catalog loaded into the prompt on demand | `clone:/docs/subsystems/skills.md` | shipped |
| spill | large tool output spilled to a file the model can read later | `clone:/docs/subsystems/spill.md` | shipped |

## Subagents

| capability | what it does | evidence | state |
|---|---|---|---|
| activation seam | one `startActivation` contract for local and external backends | `clone:/docs/subsystems/subagent.md:7-11` | shipped |
| capability bag | `agentOptions`, `agentPreset`, `outputSchema`, `depthLimit` validated before start | `subagent.md:13-25` | shipped |
| delivery policy | `parent` notifies the model, `caller` returns the result only | `subagent.md:36-43` | shipped |
| continuable children | a local child has a durable session and at most one live activation; absent children cold-resume | `subagent.md:128-176` | shipped |
| typed results | `outputSchema` makes the captured result a `structured` value validated against the schema | `subagent.md:107-110, 248-255` | shipped at the backend seam; the model-facing `subagent` tool exposes only prompt, cwd and description (`clone:/docs/tool-catalog.md` "subagent") |
| durable child catalog | `listChildren` / `listDescendants` read the parent-owned catalog without resuming a child | `subagent.md:227-231, 375-395` | shipped |
| adjacent messaging | `sendMessage` authorizes the exact live sender for adjacent agents only | `subagent.md:174-180` | shipped |

## Agent teams (the owner's question)

| capability | what it does | evidence | state |
|---|---|---|---|
| implicit lead and flat roster | the root session is the lead; teammates are named, immutable, continuable direct children; only the lead creates or interrupts | `clone:/docs/subsystems/agent-team.md:9,24`; design note "Decision" | experimental |
| durable provisioning and recovery | a provisioning roster snapshot is flushed before the child starts; restart reconciles the record against the child session and settles `active` or `failed` | design note "Provisioning and recovery"; `roster.ts:275,322-399` | experimental |
| direct peer inbox messages | any member messages any other; the target records an ordinary user message with sender attribution; a running target is steered at its step boundary, an inactive one cold-resumes | `agent-team.md:41`; direct-inbox note | experimental |
| shared task board | tasks with owner, status, dependency DAG and advisory write scopes; every mutation is compare-and-set on a revision | `agent-team.md:58-77`; task-board internals | experimental |
| wait on an edge | `wait_agent` blocks on the next roster/task/message/status edge registered after the call, and returns `noProgress` when no peer can produce one | `tool-agent-team/src/index.ts:41-45,267-279` | experimental |
| lead-only interrupt | stops a teammate's turn, keeps its inbox and its task ownership | `roster.ts:187-198` | experimental |
| team projection | roster and non-deleted tasks published to the client panel from the lead session | `agent-team.md` "Web projection" | experimental |
| opt-in profile bundle | one bundle mounts both team packages, disables the same-named legacy subagent controls, and narrows `maxMembers` to 8 | `clone:/packages/experimental/agent-team-profile/`; `cordis.patch.yml:4-32` | experimental |

## Governance and documentation

| capability | what it does | evidence | state |
|---|---|---|---|
| subsystem pages | one page per seam with a generated, CI-verified API section | `clone:/docs/subsystems/` | shipped |
| implementation notes | one ADR-shaped note per feature under `/.agents/notes/`, including rejected alternatives | `/.agents/notes/` | shipped |
| experimental subtree | public incubating packages; no stability promise; release packages may not name them | `clone:/packages/experimental/AGENTS.md:7` | shipped |
| doc-sync | the docs' generated sections are regenerated and compared in CI | `scripts/gen-cordis-catalog.ts` reference | shipped |

## Absent or deliberately unsupported

- **No team engine.** No graph, no scheduler, no speaker-selection policy: the lead's
  model decides. This is the same line the findings plan draws.
- **No blackboard.** The task board stores claims and status, never shared data; the
  design note rejects a mailbox, a board and a checkout as coordination substitutes
  for typed results.
- **No cross-process teams.** One process, one shared checkout, no remote members, no
  worktrees by default, no filesystem lock.
- **No typed report at the team layer.** The subagent backend can validate an
  `outputSchema`, but `spawn_teammate` takes no schema, so a teammate's report is text.
- **No automatic task-owner release.** Idle, interruption, process exit and failed
  work all leave the owner in place.
- **No send retry or dedupe.** A failed send is reported to the caller and dropped;
  historical queued mail is never delivered.