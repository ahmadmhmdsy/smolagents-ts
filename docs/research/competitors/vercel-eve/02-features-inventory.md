# vercel/eve — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status uses the three strengths from the dive method: implemented (source path
traced), declared (docs or a type promise it; no path traced), inferred (reasoned
from structure). Pointers without a leading `clone:/` are relative to the clone
root at commit `c543585`; documentation pages were read on 2026-10-21.

**Durable turns and resumption**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| a session as a durable workflow | implemented | `packages/eve/src/execution/session/entry.ts:68-76` | the entry function runs under `"use workflow"`, so the session survives process boundaries and redeploys | a conversation must outlive the request that started it |
| a turn as delivered work | implemented | `packages/eve/src/execution/session/program.ts:207-264` | the loop takes one delivery from the input queue, assigns `turn_<n>`, and runs steps until the turn settles | one message is the unit a caller can cancel, steer or observe |
| step checkpoint batching | implemented | `packages/eve/src/execution/session/turn-step.ts:110-118`, `packages/eve/src/execution/model-call-batching.ts:5-49` | one step commits a bounded batch of model calls; `experimental.workflow.modelCallsPerStep` raises the ceiling above the default of one | fewer durable writes per turn, trading replay granularity for speed |
| delivery into a suspended run | implemented | `packages/eve/src/execution/session-inbox/address.ts:29-40`, `packages/eve/src/execution/workflow-runtime.ts:433-470` | a stable command token names the inbox; the runtime resumes the hook with the command, and the run wakes at its next step boundary | the sender needs no handle on the running process |
| idempotent start | implemented | `packages/eve/src/execution/workflow-runtime.ts:143-266` | start input is validated and keyed so a retried request cannot start a second owner | channel retries are normal, double turns are not |
| steering versus queueing | implemented | `clone:/docs/tools/tasks.md:245-249` | a message from the turn's own caller interrupts a wait when `turnPolicy` is `steer`; another caller's message waits for the turn to end | a person watching work wants to redirect it without cancelling |
| ownership handoff | implemented | `packages/eve/src/execution/session/entry.ts:328-429` | forced handoff leases the hooks and hands the lease back; released handoff takes over after the old owner lets go | a new deployment must adopt sessions built by the previous version |
| stranded session detection | implemented | `packages/eve/src/execution/workflow-runtime.ts:296-336`, `packages/eve/src/channel/session-stranded-error.ts` | an owner built by another eve version is marked stranded; reads still work, `reset` starts a successor | a deployment that cannot run the old code must fail clearly instead of hanging |
| compaction as a handoff | implemented | `packages/eve/src/execution/session.ts:12-33`, `clone:/docs/concepts/execution-model-and-durability.mdx:209-224` | at the threshold the session summarizes, then moves to a fresh run that inherits the compacted state | compaction may need a model call that must not bloat the run it replaces |
| idle timeout as a durable timer | implemented | `clone:/docs/agent-config.md:277-282`, `clone:/docs/concepts/execution-model-and-durability.mdx:141` | the owner arms a timer for the idle window, 30 days by default, and the session completes when it fires | an abandoned session should not run forever or leak a world record |
| usage limit as a function | implemented | `packages/eve/src/execution/effective-agent-config.ts:28-36`, `clone:/docs/agent-config.md:265-334` | before each model call the session asks the agent's `limits.sessionUsage` callback with window and total usage | cost policy is deployment-specific, so it is code rather than a constant |

**Runtime calls and the wait/report protocol**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| runtime action requests | implemented | `packages/eve/src/shared/action-types.ts:187-192` | tool, subagent, remote-agent, workflow-tool and load-skill calls are typed requests the harness surfaces to the session | the step decides what runs inline and what must be deferred |
| workflow task requests | implemented | `packages/eve/src/shared/action-types.ts:130-160` | a call names a run entry point (`execute`, `task`, `serve`, `receive`) plus a workflow id and optional task id | one protocol covers starting, continuing and answering durable work |
| park instead of poll | implemented | `packages/eve/src/execution/session/turn.ts:203`, `:411-494` | a deferred call returns `park` with `pendingCoordinationCallIds`; the turn waits on the inbox until a result or an interrupt arrives | polling wastes a durable run's lifetime and cannot survive a restart |
| result for a local child | implemented | `packages/eve/src/subagents/parent-notification.ts:301-318` | the child's settled outcome is resumed into the parent hook as `runtime-action-result` | the parent's pending call becomes an ordinary tool result |
| result for a remote child | implemented | `packages/eve/src/subagents/parent-notification.ts:262-296` | the child posts `turn.completed` or `turn.failed` to the session callback URL | a remote agent shares no process and no world |
| at-least-once settlement trade-off | implemented | `packages/eve/src/shared/action-types.ts:237-267` | results bind to the call by `callId`; a replay-orphaned duplicate may settle it, and the code says this is accepted | exactly-once delivery costs more than duplicated identical arithmetic |
| task receipts | implemented | `clone:/docs/subagents/index.mdx:13-17`, `packages/eve/src/execution/tasks/table.ts:79-97` | a deferred call returns a receipt at once and the reply arrives later as a task result | the model keeps working while the task runs |
| task controls | implemented | `clone:/docs/tools/tasks.md:212-295`, `packages/eve/src/execution/tasks/table.ts:176-200` | `eve__task_wait` and `eve__task_cancel` are model-visible calls over the task table | waiting and stopping are model decisions, not only host ones |
| turn holds on working tasks | implemented | `packages/eve/src/execution/session/turn.ts:241-283`, `clone:/docs/tools/tasks.md:212-217` | a turn that tries to end while tasks work parks and resumes when one settles | otherwise a result could start a turn nobody was attending |
| durable sleep race | implemented | `packages/eve/src/execution/session/turn.ts:601-623` | a task-wait timeout is a durable sleep raced against the inbox, and `timeout: 0` returns immediately | a bounded wait must survive a restart without a wall clock |
| cancellation | implemented | `clone:/docs/tools/tasks.md:251-265`, `packages/eve/src/execution/tasks/table.ts:365` | cancelling settles waiting calls, tells the run, and returns at once; the run bounds its own unwind at 30 seconds | the caller must not block on cleanup it cannot see |
| working-task cap | implemented | `packages/eve/src/execution/tasks/table.ts:18` | 32 working tasks per session, idle resumable tasks excluded | a backstop against accidental fan-out |
| dispatch separate from runtime actions | implemented | `packages/eve/src/shared/action-types.ts:71-77` | subagent dispatch requests are internal and deliberately outside the runtime-action union | a workflow task is not a framework control |

**Subagents**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| built-in `agent` tool | implemented | `clone:/docs/subagents/index.mdx:9-17` | a root agent gets one tool that copies its own configuration into a child with fresh state | delegation without declaring anything |
| declared subagents | implemented | `clone:/docs/subagents/index.mdx:190-207`, `clone:/docs/reference/agent-files.md:87-99` | `agent/subagents/<name>/` is its own agent root with instructions, tools, skills, sandbox and hooks | a specialist needs its own surface, not the parent's |
| isolation boundary | implemented | `clone:/docs/subagents/index.mdx:190-207` | a declared child inherits no authored slot; shared procedures are packaged and mounted deliberately | implicit inheritance makes a child's behaviour impossible to read |
| continuation by task id | implemented | `clone:/docs/subagents/index.mdx:246-248`, `packages/eve/src/execution/session.ts:154` | a child parks after answering; a later call with its `taskId` continues the conversation | research and follow-up are one relationship, not two calls |
| nested subagents | implemented | `clone:/docs/subagents/index.mdx:217` | a declared child may declare its own children; there is no separate depth cap | a specialist may itself need a specialist |
| child stream and event proxy | implemented | `clone:/docs/subagents/index.mdx:236-238`, `packages/eve/src/subagents/event-proxy-step.ts` | the parent publishes `agent.started` with the child's stream path, and local or remote children are proxied | a UI must follow a child while the parent still works |
| human input routed through the chain | implemented | `clone:/docs/tools/human-in-the-loop.md:12-16`, `packages/eve/src/subagents/hitl-proxy.ts` | a child's question or approval travels to the root, and the answer routes back by request id | only a root has a person attached |
| subagent sandbox reuse | implemented | `packages/eve/src/runtime/resolve-sandbox.ts:9-18`, `clone:/docs/sandbox/index.mdx:104-110` | a definition marked `inheritsParent` resolves to the dispatching parent's sandbox | a child that edits files should see the parent's files |
| workspace peers | declared | `clone:/docs/subagents/index.mdx:89-105` | `defineWorkspaceAgent` exposes another workspace member as a remote subagent | composition across deployments without a shared process |
| dynamic subagents | declared | `clone:/docs/guides/dynamic-capabilities.md` | a tool or hook can add a subagent at runtime, recorded in session state | a tenant-specific specialist cannot be compiled ahead of time |

**Skills**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| `SKILL.md` discovery | implemented | `packages/eve/src/execution/skills/instructions.ts:29-49` | files under `agent/skills/` contribute a name and description to the system prompt | the model should know a procedure exists before reading it |
| progressive disclosure | implemented | `packages/eve/src/shared/action-types.ts:162-178` | `eve__skill({name})` returns instructions and files only when the model asks | static listing keeps the prompt small |
| deferred skills | implemented | `clone:/docs/skills.mdx:24-33` | a deferred skill is not named in context; only its namespace is advertised | a large catalog should cost almost nothing until used |
| `defineSkill` TypeScript form | implemented | `clone:/docs/skills.mdx:60-77` | compilation generates `SKILL.md` and sibling package files from a typed module | generated content and typed values are not expressible in markdown |
| sandbox materialization | implemented | `packages/eve/src/shared/skill-paths.ts:5-6`, `packages/eve/src/execution/skills/instructions.ts:43` | skill trees are seeded at `$HOME/.agents/skills`, with `/workspace/skills` as fallback | a skill's scripts must be executable where the shell runs |
| per-agent scope | implemented | `clone:/docs/skills.mdx:90-96` | skills belong to the declaring agent; a subagent's are invisible to the root | capability boundaries match the isolation rule |
| dynamic skills | declared | `clone:/docs/guides/dynamic-capabilities.md` | a hook can announce skills at runtime; announcements override static ones by name | per-tenant procedures without a rebuild |

**Approval and human input**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| approval as a tool property | implemented | `packages/eve/src/approval/definition.ts:142-166` | a tool or connection declares `approval` with an optional prompt function | consent belongs next to the side effect it guards |
| request policy helpers | implemented | `clone:/docs/tools/human-in-the-loop.md:28-47` | `never()`, `once()`, `always()` and `auto()` cover the common policies; `auto()` consults a decision model | most agents want one of four answers |
| response authorization | implemented | `packages/eve/src/approval/definition.ts:111-146`, `clone:/docs/tools/human-in-the-loop.md:107-185` | a response policy sees the authenticated principal and returns allowed or rejected with a reason | a pending approval must not be settleable by anyone who can see the id |
| candidate event | implemented | `clone:/docs/tools/human-in-the-loop.md:183-185` | every evaluated response is recorded as `approval.candidate` before it takes effect | an audit trail exists even when a policy refuses |
| a pending approval parks the turn | implemented | `clone:/docs/tools/tasks.md:229-239` | the stream emits `input.requested`, then `turn.waiting` with `on: "input"` | the turn stays open rather than failing or blocking a thread |
| question tool | implemented | `clone:/docs/tools/human-in-the-loop.md:221-223` | `ask_question` is an opt-in tool that returns the person's answer as the tool result | a model sometimes needs a fact only a person has |
| sign-in holds the turn | implemented | `clone:/docs/guides/client/streaming.mdx:171-173` | an authorization callback pending keeps the response attached and the turn waiting | OAuth cannot finish inside one request |
| several pending requests | implemented | `clone:/docs/tools/human-in-the-loop.md:65` | a reusable grant applies only after earlier matching requests resolve | out-of-order answers must not grant future calls |
| replay-safe consent | implemented | `clone:/docs/tools/human-in-the-loop.md:105` | a grant and its effect are recorded so a replayed step does not re-ask or re-charge | durability and side effects otherwise fight |

**Sandbox**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| one workspace per agent | implemented | `clone:/docs/reference/agent-files.md:83-85` | every session gets a `/workspace` with shell access, files and seeded trees | tools need a real filesystem, not a value-passing boundary |
| selector plus environment export | implemented | `packages/eve/src/runtime/resolve-sandbox.ts:9-48` | the definition exports a selector and an environment; the build prepares immutable inputs before a session exists | preparation must happen once, not per turn |
| prepared artifact | implemented | `clone:/docs/sandbox/index.mdx:76-98` | `prepare` runs against a reusable artifact: a Vercel snapshot, a Docker image, a microsandbox template or a just-bash tree | first-touch latency belongs in the build |
| start once, resume later | implemented | `clone:/docs/sandbox/index.mdx:228-234` | core calls `start()` for a new durable session and `resume()` with the persisted state afterwards | a sandbox outlives the step that created it |
| provider probe order | implemented | `packages/eve/src/sandbox/providers/default.ts:30-56` | Vercel, Docker, microsandbox and just-bash are probed in that order unless the caller overrides | local development and production share one definition |
| durable sandbox state | implemented | `packages/eve/src/sandbox/state.ts:7-22`, `packages/eve/src/execution/durable-session-store.ts:58` | provider name, protocol version and provider state persist in the durable session | resuming must find the same live sandbox |
| workspace seeds and resources | implemented | `clone:/docs/sandbox/index.mdx:127-152` | `agent/sandbox/workspace/` seeds `/workspace`; compiled trees mount read-only under `/eve/resources` | authored files and runtime files need different writability |
| attachment staging | implemented | `clone:/docs/sandbox/index.mdx:154-171` | inbound bytes are written to `/workspace/.eve/attachments/` and only a reference enters history | the model can reread a file the provider no longer holds |
| network policy | implemented | `clone:/docs/sandbox/index.mdx:66` | the environment opens with a policy such as `deny-all`, and providers map it to their own control | guest code should not inherit the app's network reach |
| credential brokering | implemented | `clone:/docs/concepts/security-model.md` | secrets stay in the app runtime; the sandbox gets brokered calls rather than raw keys | a compromised guest must not exfiltrate long-lived credentials |
| lifecycle end hook | implemented | `clone:/docs/sandbox/index.mdx:228-234` | `onSessionEnd` runs on completion, expiry or failure with the artifact and state | remote resources must be released deterministically |

**Streaming to a client**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| durable NDJSON log | implemented | `packages/eve/src/execution/session-event-stream.ts:32-60` | events are appended before a step completes, so a reader can start from any index | a dropped HTTP connection is not a lost turn |
| stable event identity | implemented | `clone:/docs/concepts/sessions-runs-and-streaming.md:162-199` | `meta.id` is an `evt_` ULID minted once and stored; a retried step re-emits under new ids | ingestion can deduplicate reconnects without deduplicating retries |
| reconnect from an index | implemented | `clone:/docs/guides/client/streaming.mdx:175-181` | the client tracks consumed events and reopens the stream from that count | long turns outlive connections |
| bounded catch-up | implemented | `packages/eve/src/execution/session-event-stream.ts:12-122` | `follow: false` stops at the durable tail; a negative index counts back from it | a snapshot must not race new events |
| leased responses | implemented | `clone:/docs/concepts/sessions-runs-and-streaming.md:273-300` | renewable leases, ten-second heartbeats and a sixty-second expiry keep one reader authoritative | two live readers would double-render deltas |
| stream version negotiation | implemented | `clone:/docs/concepts/sessions-runs-and-streaming.md:109-113`, `packages/eve/src/client/stream-version.ts` | the client sends a version and normalizes older delta shapes | wire changes must not break deployed clients |
| result boundaries | implemented | `clone:/docs/guides/client/streaming.mdx:43-76` | `result()` resolves at a real end or at an input wait; `for await` exposes the live sequence | most callers want a reply, some want progress |
| subagent follow | implemented | `clone:/docs/guides/client/streaming.mdx:267-279`, `packages/eve/src/client/agent-stream-follower.ts` | `agent.started` yields a handle whose `stream()` follows the child, locally or proxied | a UI should not poll the parent to see a child |
| cancel responses | implemented | `packages/eve/src/protocol/cancel-turn.ts:6-20` | the call reports accepted or no active turn, distinct from the later stream confirmation | a cancel is a request, not an outcome |
| in-process attach | implemented | `packages/eve/src/client/sessions.ts:39`, `clone:/docs/concepts/sessions-runs-and-streaming.md:315` | `sessions.attach(id)` streams without an HTTP hop when the client shares the runtime | tests and embedded UIs need the same semantics |
| reducer over deltas | implemented | `packages/eve/src/client/message-reducer.ts` | deltas accumulate into a projection and completed events replace it | rendering must survive reconnects and gaps |

**Also present, outside the six focus seams**

| capability | status | evidence | how it works | why it exists |
|---|---|---|---|---|
| context control | implemented | `clone:/docs/concepts/context-control.md`, `clone:/docs/concepts/default-harness.md` | compaction, tool-result trimming and memory recall run before model calls | a long session must fit a context window |
| memory providers | implemented | `clone:/docs/memory/overview.mdx` | `agent/memory.ts` mounts a provider consulted across sessions | durable facts belong outside a transcript |
| hooks | implemented | `clone:/docs/guides/hooks.md` | `agent/hooks/` subscribes to lifecycle and stream events | a host needs reactions without changing the loop |
| channels | implemented | `clone:/docs/channels/overview.mdx`, `packages/eve/src/channel/routes.ts:181-306` | HTTP, WebSocket and messaging adapters share route and delivery types | the same agent should answer Slack, HTTP and MCP |
| MCP and OpenAPI connections | implemented | `clone:/docs/connections/mcp.mdx`, `clone:/docs/connections/openapi.mdx` | `agent/connections/` declares services whose tools appear beside authored ones | integration surface stays declarative |
| evals | implemented | `clone:/docs/evals`, `e2e/README.md` | fixture agents carry eval suites asserted on events, run in CI | behaviour changes need behavioural checks |

**Notable implementation notes**

- One ordered inbox per run, fed by one hook reader per claimed token. The
  queue mirrors durable hook state rather than replacing it, so the source of
  truth survives an owner change (`packages/eve/src/execution/session-inbox/inbox.ts:170-174`).
- Cancellation shares the hook's ordered stream with ordinary deliveries, which
  is why the pump never applies backpressure: holding a cancel behind a queued
  message would make it useless (`packages/eve/src/execution/session-inbox/inbox.ts:170-174`).
- The harness's terminate branch returns `held` with the working task ids, and
  one guarded site sends the caller's reply; this is enforced by
  `guard:invariants` (`clone:/research/eve-tasks.md:581-590`).
- A task record that fails to decode fails its task, not the session, and the
  failure reads as an unreadable-state error (`packages/eve/src/execution/tasks/table.ts:470-480`).
- Step retries re-emit events rather than reusing ids, so client code must treat
  duplicated *intent* as normal and duplicated *identity* as the only safe
  deduplication key (`clone:/docs/concepts/sessions-runs-and-streaming.md:189-199`).
- The emitted event vocabulary is versioned by wire version, not by package
  version; the client accepts a range and normalizes (`packages/eve/src/client/stream-version.ts`).

**Declared but thin or absent**

- No task priority, no queue fairness and no per-task timeout: a body that needs
  a deadline races `sleep` itself (`clone:/docs/tools/tasks.md:311-314`).
- No cross-session shared memory of the blackboard kind; memory providers are
  keyed stores, not shared working state (`clone:/docs/memory/overview.mdx`).
- No handoff primitive in the multi-agent sense: subagents and tasks are the
  only composition mechanisms (`clone:/docs/subagents/index.mdx:190-207`).
- Approval grants are session-scoped, with no org-level grant store
  (`clone:/docs/tools/human-in-the-loop.md:65`).
- No cost accounting beyond usage totals and the `sessionUsage` callback; there
  is no price table (`clone:/docs/agent-config.md:140`).
