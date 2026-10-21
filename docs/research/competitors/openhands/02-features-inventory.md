# OpenHands — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Each row names its origin: `sdk` for the runtime repository, `canvas` for the product shell. A row
tagged both is a contract with implementation on the server and consumption in the client. Runtime
citations carry the `sdk:` prefix and are relative to `reference/competitors/openhands-sdk/`; client
citations carry `canvas:` and are relative to `reference/competitors/openhands/`. Status is
`implemented` when a path was traced end to end, `declared` when only a type, route or page asserts it.

## The loop

| capability | origin | status | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| tool-call step loop | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/agent/agent.py:690-892`, `conversation/impl/local_conversation.py:2201-2414` | one completion per step; response classified before dispatch; observations append; loop re-samples until content without calls or a limit | the model must see its own results before choosing the next call |
| response-type dispatch and repair | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/agent/response_dispatch.py:45-375` | tool calls, content, reasoning-only and empty are separate paths; malformed function calls and content-policy blocks become corrective user messages | a single bad completion should not end a run |
| parallel tool batches with resource locks | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/agent/parallel_executor.py:51-126`, `tool/tool.py:529` | a thread pool runs a batch; `declared_resources()` keys a lock manager so same-resource calls serialise and independent calls parallelise | modern models emit several calls per turn |
| confirmation policy over analysed risk | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/agent/agent.py:1127-1198`, `security/analyzer.py:29-108`, `conversation/state.py:123-127` | a security analyzer scores each action, the policy decides, status becomes `WAITING_FOR_CONFIRMATION`, and the next step executes whatever was approved | a human gate that suspends instead of failing |
| stuck detection | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/conversation/stuck_detector.py:24-325`, `local_conversation.py:761-784` | thresholds cover repeated action-observation pairs, repeated errors, monologue and alternating patterns; one nudge is injected, then the status becomes `STUCK` | tool loops repeat without progress |
| pause and interrupt | sdk | implemented | `sdk:…/local_conversation.py:2763-2821`, `:2575-2610` | pause takes effect at an iteration boundary; interrupt sets the cancellation token then cancels the tracked task; the cancelled run ends `PAUSED` with `InterruptEvent` and synthetic errors for orphaned actions | stopping mid-completion must leave a resumable history |
| conversation tree: fork, navigate, rerun | sdk | implemented | `sdk:…/conversation/state.py:175-189`, `local_conversation.py:814-852`, `:959-982`, `:3065` | events have parents; HEAD moves; fork copies the whole log or one branch; abandoned events stay on disk | trying an alternative should not destroy history |
| run limits and typed run errors | sdk | implemented | `sdk:…/local_conversation.py:737-759`, `:2384-2412` | iteration cap, budget check and stuck state each emit a typed `ConversationErrorEvent` code | bounded cost per run |

## Context

| capability | origin | status | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| condensation as an event-log tombstone | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/event/condenser.py:11-96`, `context/condenser/README.md:13-21` | a `Condensation` records forgotten event ids, a summary and an insertion offset; `apply()` removes them and inserts a summary event; a view projects the result | an append-only log must forget for the model without rewriting the log |
| summarizing condenser | sdk | implemented | `sdk:…/context/condenser/llm_summarizing_condenser.py:54-207`, `:556-566` | separate summarisation LLM; `max_size` 240 by default and 80 for the default agent preset; `keep_first` 2 or 4; token cap is the smaller of its own and the agent's effective limit | bounded prompts and a cheap cache rebuild |
| three condensation triggers | sdk | implemented | `sdk:…/context/condenser/llm_summarizing_condenser.py:140-207` | explicit request, token pressure and event count; token or request pressure is hard, event count alone is soft | not every threshold is a dead end |
| hard context reset | sdk | implemented | `sdk:…/context/condenser/base.py:111-198`, `llm_summarizing_condenser.py:358-409` | when a hard requirement cannot be met by balanced forgetting, the whole view is summarised with up to five retries, shrinking each event string by twenty percent per attempt | a full window can recover instead of raising |
| condensation safety rails | sdk | implemented | `sdk:…/context/condenser/llm_summarizing_condenser.py:282-356`, `:434-438`, `context/condenser/README.md:31-37` | forgetting starts on atomic tool-call boundaries, keeps the leading system event, and refuses a condensation below ten percent progress | provider message-shape rules reject broken pairs |
| manual compaction contract | sdk and canvas | implemented | `sdk:…/local_conversation.py:3011-3063`, `canvas:src/hooks/use-await-context-compaction.ts:57-66` | `/condense` appends a request event and forces one step; the ack only means work started, so the client waits for a `Condensation` plus a lower token count, giving up after ninety seconds | users expect an explicit "compact now" |
| planning condenser preset | canvas | implemented | `canvas:src/api/agent-server-adapter.ts:1276-1288` | the planner conversation is sent with a 100-event window, six pinned initial events and its own usage id so summarisation cost is attributed separately | a long planning session must not lose its plan |

## Skills and microagents

| capability | origin | status | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| progressive-disclosure skills | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/skills/skill.py:178-297`, `:1491-1517`, `context/agent_context.py:335-358` | each SKILL.md is parsed into name, description and content; the prompt lists name and description only; the location is deliberately omitted so the agent must call the skill tool | a large skill library cannot fit in every prompt |
| trigger injection | sdk | implemented | `sdk:…/context/agent_context.py:517-570`, `skills/trigger.py:13-39` | keyword and task triggers match whole tokens in the user message and append the skill body to that message, once per conversation | knowledge arrives when the request needs it |
| path rules | sdk | implemented | `sdk:…/context/agent_context.py:576-600`, `local_conversation.py:592-670` | glob triggers match a touched file path, inject the rule once and are forced non-invocable | repository conventions attach to files, not prompts |
| microagents as a legacy path | sdk | implemented | `sdk:…/skills/skill.py:952`, `:1086`, `:1147-1152`, `context/agent_context.py:97` | legacy microagent directories are still scanned after skills, with a deprecation note in the loader | the product renamed the feature without breaking users |
| activation bookkeeping | sdk | implemented | `sdk:…/conversation/state.py:129-150` | triggered, invoked and path-activated skills are recorded on conversation state | dedupe and resume both need a record |

## Delegation

| capability | origin | status | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| file-based subagent definitions | sdk | declared | `sdk:openhands-sdk/openhands/sdk/subagent/AGENTS.md:29-140`, `subagent/load.py`, `subagent/registry.py` | markdown with YAML frontmatter; project then user directories; first registration wins; tools, skills, model, permission mode and condenser per agent | user-defined specialists without code changes |
| delegate tool: spawn and delegate | sdk | implemented | `sdk:openhands-tools/openhands/tools/delegate/definition.py:16-46`, `impl.py:34-51`, `:133-285`, `:287-417` | spawn up to five named children with optional agent types; each child shares the parent workspace, gets an LLM copy with fresh metrics and streaming off; delegate runs tasks in parallel threads, joins, folds metrics and returns final responses | parallel investigation inside one parent step |
| task tool and manager | sdk | implemented | `sdk:…/tools/task/definition.py:47-84`, `:120-179`, `task/manager.py:100-510` | task ids, statuses, a subagent type per task, resume, per-task confirmation policy and observability metadata | long-lived child work with a handle the parent can name |
| same-backend child conversation | sdk | implemented | `sdk:…/tools/child_conversation/definition.py:22-41`, `:86-104` | a child conversation on the same backend, worktree isolation by default and shared optionally; the result reports id, status, url and which isolation was applied | delegated work that outlives the parent turn and is visible to the user |
| child launch from the browser | canvas | implemented | `canvas:src/services/child-conversation-launch.ts:265-344`, `:470-551` | the browser claims the tool call, launches a local worktree or shared child, falls back to shared when worktree creation fails, then posts the result as a client-tool message | the launch needs credentials and UI state the server does not hold |
| parent-child index on the server | sdk | declared | `sdk:…/agent_server/conversation_service.py:664-680`, `:1174` | the service keeps a children index and exposes it in conversation listings | the UI shows a family of conversations |

## Workspace, sandbox and server

| capability | origin | status | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| workspace interface | sdk | implemented | `sdk:openhands-sdk/openhands/sdk/workspace/base.py:28-282` | command execution with timeout, upload, download, git changes and diff, optional pause and resume, plus cost registration for a completion callback | one contract for a host directory and a remote sandbox |
| Docker workspace | sdk | implemented | `sdk:openhands-workspace/openhands/workspace/docker/workspace.py:53-128`, `:209-287` | starts the agent-server image, maps port 8000, forwards selected environment variables, mounts volumes, waits for health and then speaks HTTP | isolation without a client-side process manager |
| remote configuration fetch | sdk | implemented | `sdk:…/workspace/remote/base.py:355-404`, `:473-543`, `:897` | the workspace also fetches LLM profiles, secrets, MCP configuration and skills from the agent server | a local loop can run against a remote environment |
| other backends | sdk | declared | `sdk:openhands-workspace/openhands/workspace/{agent_sandbox,apptainer,cloud,remote_api}/workspace.py` | pod with port forwarding, Apptainer, hosted cloud sandbox, and a runtime API that starts or resumes a sandbox | deployment variety behind one interface |
| conversation event service | sdk | implemented | `sdk:…/agent_server/event_service.py:215-286`, `:1203-1312`, `:1487-1726` | one service per conversation owning the lease, event log, subscribers, run slot, persistence and stream fan-out | many conversations on one server |
| durable WebSocket stream | sdk | implemented | `sdk:…/agent_server/session_socket.py:63-120`, `:294-412`, `pub_sub.py:85-108` | sequence-numbered envelopes, replay from disk after a cursor, byte-bounded admission and connection drop as backpressure | reconnects must not lose events |
| client frame handling | canvas | implemented | `canvas:src/stores/use-event-store.ts:97-105`, `:212-226`, `canvas:src/utils/handle-event-for-ui.ts:164` | durable and delta frames are held separately; out-of-order durable frames are ordered by sequence; provisional delta text retires when the durable event arrives | token streaming without corrupting the rendered log |
| conversation catalogue and resume | sdk | declared | `sdk:…/agent_server/conversation_service.py:531-1114`, `:1463-1714` | search, start, resume, worktree creation, webhook notification and idle eviction | a product lists and reopens conversations |
| hooks | sdk | implemented | `sdk:…/hooks/types.py:9-17`, `conversation/impl/local_conversation.py:2216-2237`, `agent/agent.py:721-733` | PreToolUse, PostToolUse, UserPromptSubmit, SessionStart and Stop; a stop denial feeds feedback back as a user message and re-enters the loop | policy without forking the loop |
| goal loop with an LLM judge | sdk | implemented | `sdk:…/conversation/goal/judge.py:1-70`, `goal/controller.py:78-103`, `agent_server/event_service.py:1737-1940` | a judge scores the transcript against an objective; the controller decides continue or done and the server runs further rounds | objectives that outlive one completion |
| persisted settings with migrations | sdk | implemented | `sdk:…/agent_server/persistence/models.py:147-199` | versioned payload at version 6, merge-patch diffs, a secret-probe cipher that detects secret-bearing fields through the real serializer | upgrades must not silently lose settings |
| browser-owned tool calls | sdk and canvas | implemented | `canvas:src/services/child-conversation-launch.ts:470-551` | the server advertises a tool whose execution belongs to the client, acknowledges the call immediately, and the browser posts the result back as a message | capabilities that exist only in a browser can join the tool loop |

## How condensation behaves under pressure

The trigger computation is a set, not a boolean, so a view can be under several pressures at once.
`get_condensation_reasons` collects `REQUEST`, `TOKENS` and `EVENTS`; `condensation_requirement`
then maps token pressure and explicit requests to `HARD` and event-count pressure to `SOFT`
(`sdk:…/context/condenser/llm_summarizing_condenser.py:140-207`). When several reasons apply, the
forgetting calculation picks the strictest suffix length so one condensation satisfies all of them
(`:331-333`).

A soft requirement that cannot be satisfied returns the uncondensed view and nothing else happens;
the same trigger fires again on the next step (`sdk:…/context/condenser/base.py:163-202`). A hard
requirement that cannot be satisfied first tries a hard context reset, and only re-raises if that
returns nothing. That ordering is what keeps a run alive when the balanced strategy cannot meet
provider message-shape rules.

The summarisation itself is a plain completion with a system prompt and a user prompt containing one
stringified event per forgotten event, truncated to a shrinking maximum after each failed attempt
(`…/llm_summarizing_condenser.py:209-280`, `:358-409`). The returned `llm_response_id` is stored on
the condensation event, so the summary is traceable back to the completion that produced it.

## What the skill loader actually reads

A SKILL.md becomes a `Skill` model with name, description, body, optional allowed tools and optional
resource directories for scripts, references and assets
(`sdk:…/skills/skill.py:178-297`). Over-long descriptions are truncated with a notice that points at
the source path, and a missing description falls back to the first non-header line of the body
(`:293-297`, `:1491-1540`). The loader also supports a legacy OpenHands format with separate trigger
metadata, which is how the microagent files keep working.

One security-relevant detail: rendering a skill body executes inline command blocks of the form
`!`command`` and substitutes their output, with a working directory supplied by the caller
(`sdk:…/skills/skill.py:828-845`). A skill file is therefore executable content, not documentation, and
the trust boundary sits at whichever directory the loader was pointed at.

## Two delegation mechanisms, two isolation answers

The older `delegate` tool runs children as in-process conversations that share the parent's working
directory, copy the parent LLM, reset metrics and switch streaming off
(`sdk:…/tools/delegate/impl.py:168-238`). Their results are read after the threads join by taking the
child's final assistant response, so a parent receives prose, not a typed object
(`:343-404`). The newer `task` tool keeps a task id and status per child and supports resuming a task
with more instructions (`sdk:…/tools/task/manager.py:171-255`). The child-conversation tool is the only
one that offers branch-level isolation: a git worktree by default, the parent directory when asked
(`sdk:…/tools/child_conversation/definition.py:35-41`).

The lesson is that isolation and delegation are independent decisions. Sharing a workspace makes a
child cheap and makes concurrent edits a race; a worktree removes the race and makes the child's work
invisible to the parent until it is merged.

## Workspace as a protocol

For remote backends the workspace stops being an object that runs commands and becomes a service
contract. `RemoteWorkspace` speaks HTTP for execution, file transfer and git, and it also pulls the
LLM profile, secret values, MCP configuration and skill definitions it needs from the same server
(`sdk:…/workspace/remote/base.py:404-543`, `:897`). That is what allows a local Python agent loop to
drive a sandboxed environment it never executes inside.

`DockerWorkspace` makes the consequence concrete: it starts the agent-server image, publishes the
container port on loopback, forwards a small allowlist of environment variables, waits for a health
check and then substitutes itself with the HTTP client it just provisioned
(`sdk:…/openhands-workspace/openhands/workspace/docker/workspace.py:209-287`). Pause and resume map to
container or pod lifecycle rather than to process signals.

Completion is reported outward, not inward: the workspace posts a status and accumulated cost to a
URL from `AUTOMATION_CALLBACK_URL` when the run closes
(`sdk:…/workspace/base.py:88-156`). A scheduler therefore learns a run finished without polling the
conversation API.

## What a client must implement to render a run

Canvas is a worked example of the client half. It needs a durable-versus-delta split in its store, a
sequence cursor that survives reconnects, reconciliation for durable frames that arrive out of order,
retirement of provisional text when the real event lands, and a compaction flow that waits for a
`Condensation` before reporting success
(`canvas:src/stores/use-event-store.ts:97-105`, `:212-226`, `canvas:src/utils/session-seq-cursor.ts:1-6`,
`canvas:src/hooks/use-await-context-compaction.ts:57-66`). It also needs a claim ledger for client-owned
tool calls, because a replayed tool call for a launch would start a second billable conversation
(`canvas:src/services/child-conversation-launch.ts:505-525`).

That list is a useful specification for our own renderer work: the hard part is not drawing events, it
is agreeing on how a reconnecting client proves which events it has already seen.

## Failure handling in the loop

Provider failures are classified rather than caught generically. Authentication failure ends the
conversation with a typed error and a `ConversationRunError`; any other exception marks `ERROR` and
emits a typed `ConversationErrorEvent` unless the agent already emitted a more specific one
(`sdk:…/local_conversation.py:2611-2652`). Interruption is the exception that must not propagate: the
`CancelledError` handler deliberately swallows the cancellation, patches orphaned actions and leaves
the conversation `PAUSED` so it can be resumed later (`:2575-2610`).

## Notable implementation notes

- Every async method has a sync twin, from `LLM` through the condenser, agent, conversation and
  `EventService`, and base classes delegate to the sync implementation so a subclass that overrides
  only one side still works.
- The state lock is held across a step but released for the await on the network call, so a user
  message can land during a completion without deadlocking the loop
  (`sdk:…/local_conversation.py:1920-1943`).
- The lock is a FIFO lock that is reentrant per thread, not per task, and a source comment warns that
  an unrelated coroutine touching state on the same event-loop thread would silently re-enter it
  (`sdk:…/local_conversation.py:2297-2313`).
- The repository enforces a system-before-first-user message invariant for every request it builds,
  including condenser and judge calls, and the condenser is written to preserve it.
- Persisted event schemas are treated as permanent contracts: removed fields keep a deprecation
  handler so old conversations still load.
- A malformed tool-use history from one provider is mapped to a dedicated error and routed into
  condensation recovery, separately from true context exhaustion
  (`sdk:…/agent/agent.py:1039-1068`).
- Tool availability is filtered through the registry so a tool can declare itself unusable in an
  environment (for example a browser without Chromium) instead of failing at call time.
- The server's REST surface is versioned by an OpenAPI diff against the previous release with a
  five-minor-release deprecation runway; a contract break is a CI failure before it is a user break.
- Default condenser sizing differs by caller: 240 events with two pinned for a manually constructed
  agent, 80 with four for the default preset, 100 with six for the planner
  (`sdk:…/context/condenser/llm_summarizing_condenser.py:556-566`,
  `canvas:src/api/agent-server-adapter.ts:1283-1288`).
