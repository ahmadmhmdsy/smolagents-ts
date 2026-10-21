# vercel/eve — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Pointers are relative to the clone root at commit `c543585`. A pointer that
begins with `clone:/` names a path inside the clone whose first segment our
validator would otherwise check against our own tree.

**What sits where**

| path | contents |
|---|---|
| `packages/eve/` | the framework, the `eve` CLI, compiler, harness, runtime, sandbox adapters and the client; 2,902 TypeScript files |
| `packages/eve-catalog/` | internal, unpublished catalog library |
| `packages/eve-code/` | source of the `eve/extensions/code` extension |
| `packages/eve-computer-use/`, `packages/eve-git/`, `packages/eve-self-modification/` | optional extension packages |
| `packages/tracing/` | tracing helpers shared by the framework |
| `apps/docs/` | Fumadocs site over `clone:/docs` |
| `apps/fixtures/` | agents reused by e2e, TUI smoke tests and local development |
| `apps/frameworks/`, `apps/templates/`, `apps/package-artifacts/`, `apps/benchmarks/` | integration, packaging and benchmark harnesses |
| `clone:/docs/` | 107 published documentation pages |
| `clone:/research/` | 47 issue-backed design notes |
| `clone:/skills/eve/SKILL.md` | the repository's own skill, which points agents at the bundled docs |
| `e2e/` | fixture-owned `eve eval` suites that run in CI |

The workspace is pnpm with turbo, oxlint and oxfmt, changesets and vitest. The
root scripts show the shape (`package.json:8-36`): separate unit, integration,
scenario, TUI, web-chat, framework-fixture and e2e tiers, plus
`guard:invariants` for mechanically checked code invariants and `docs:check` for
the documentation tree. `packages/eve` is the only published runtime package;
its `bin` entry is the `eve` CLI and it also exposes `eve/client`
(`packages/eve/package.json:34-40`).

**Compile: a directory becomes an agent**

`compileAgent` resolves the project, discovers the agent tree, writes artifacts
under `.eve`, and throws when discovery produced an error diagnostic
(`packages/eve/src/compiler/compile-agent.ts:79-88`). Discovery reads the
filesystem through a `ProjectSource`, so the same pipeline serves the disk and
an in-memory source (`:116-129`). The compiled manifest is the runtime's input;
authored TypeScript configures the agent but does not run as the session.

Every capability has a slot, and the slot table is the authoring contract
(`clone:/docs/reference/agent-files.md:47-65`):

| slot | capability, name derived from the path |
|---|---|
| `agent.ts` | model, compaction, build and experimental options |
| `instructions.md` or `instructions/` | the base prompt, files concatenated |
| `tools/` | authored tools, module-backed |
| `skills/` | on-demand procedures, flat files or packaged |
| `subagents/` | child agents in their own directories, nestable |
| `sandbox/` | the sandbox definition and workspace seed files |
| `hooks/` | lifecycle and stream-event subscribers |
| `connections/` | MCP and OpenAPI services |
| `channels/` | HTTP and messaging entry points, root only |
| `schedules/` | recurring jobs, root only |
| `memory.ts`, `lib/`, `instrumentation/`, `extensions/` | providers, helper code, telemetry, mounted capabilities |

Names come from paths, not from fields: `agent/tools/get_weather.ts` is the
tool `get_weather`, and a subagent takes its directory name
(`clone:/docs/reference/agent-files.md:32-43`). Files matching `*.test.*`,
`*.spec.*` and `__tests__/` are skipped during discovery (`:67-81`). A flat
layout without `agent/` also works, and a workspace puts members under
`agents/<name>/agent/` (`:101-114`). `eve info` prints what discovery found,
which is how a missing slot is debugged (`:116-119`).

**The vocabulary**

| term | what it is | pointer |
|---|---|---|
| session | the durable conversation and its open turn; a channel addresses one | `packages/eve/src/execution/session/entry.ts:68` |
| run | one workflow execution; a handoff starts a successor while the original stays the stream anchor | `packages/eve/src/execution/workflow-runtime.ts:143` |
| turn | one delivered message and its work, identified as `turn_<n>` | `packages/eve/src/execution/session/program.ts:264` |
| step | the durable boundary that commits a bounded batch of model steps | `packages/eve/src/execution/session/turn-step.ts:110` |
| task | deferred work with a receipt and a record in the session state | `packages/eve/src/execution/tasks/table.ts:79` |
| inbox | the ordered set of hooks the owner reads commands and results from | `packages/eve/src/execution/session-inbox/inbox.ts:130` |
| durable session | the persisted projection a step loads and rewrites | `packages/eve/src/execution/durable-session-store.ts:46` |
| cursor | owns history and serialized context, applies each step's delta | `packages/eve/src/execution/session/state-cursor.ts:22` |
| event stream | append-only NDJSON, readable live or backwards from the tail | `packages/eve/src/execution/session-event-stream.ts:97` |
| harness | the model-and-tool loop that runs inside a step | `packages/eve/src/harness/tool-loop.ts` |

**One turn, end to end**

1. A channel or the client posts a message. The runtime validates idempotency
   keys, serializes the caller context, stamps attributes including the eve
   version, and starts or continues a workflow on the deployment that owns the
   session (`packages/eve/src/execution/workflow-runtime.ts:143-266`, `:598`).
2. `workflowEntry` runs as `"use workflow"` and chooses an owner path: initial
   boot, forced handoff when the checkpoint says version 3 or later, or released
   handoff (`packages/eve/src/execution/session/entry.ts:68-76`).
3. The owner claims the stable inbox hook token plus any alias tokens, and
   settles an alias conflict rather than guessing
   (`packages/eve/src/execution/session/entry.ts:165-266`,
   `packages/eve/src/execution/session-inbox/address.ts:29-40`).
4. `runPreparedSession` builds the cursor from the boot values and enters
   `runSessionLoop`, which asks the input queue for the next delivery and
   increments `turnIndex` (`packages/eve/src/execution/session/program.ts:93-125`,
   `:207-264`).
5. The loop calls `turnStep`, marked `"use step"`, which hydrates the durable
   session, deserializes the context and runs the harness until it returns a
   result, a park, or a cancellation
   (`packages/eve/src/execution/session/turn-step.ts:110-118`).
6. The harness calls the model, then executes tool calls. Inline tools run
   inside the step; a deferred action becomes a `RuntimeActionRequest` or a
   `RuntimeWorkflowTaskRequest` (`packages/eve/src/shared/action-types.ts:139-192`).
7. When the step result carries `pendingCoordinationCallIds`, the turn records
   the calls it must wait for (`packages/eve/src/execution/session/turn.ts:203`).
8. The session dispatches the work: workflow tool runs, local subagent child
   sessions, or remote children. A task record is written before dispatch and
   `task.started` is published from the dispatch step
   (`packages/eve/src/execution/tasks/start.ts:88-125`,
   `packages/eve/src/execution/session/turn.ts:300`).
9. `waitForRuntimeActionResults` parks the turn and reads the inbox
   (`packages/eve/src/execution/session/turn.ts:411-494`). A local child reports
   through `resumeHook` with a `runtime-action-result` payload; a remote child
   posts `turn.completed` or `turn.failed` to the session callback
   (`packages/eve/src/subagents/parent-notification.ts:262-304`).
10. The resumed step appends results to history, applies the state delta and
    advances the cursor with the new history, which is the only place history
    may change (`packages/eve/src/execution/session/state-cursor.ts:57-102`).
11. The turn ends only at `turn.completed`; while a task works the loop emits
    `turn.waiting` and parks again, and no result ever starts a turn on its own
    (`clone:/docs/tools/tasks.md:212-217`).
12. The run parks on the inbox until the next message, steering, cancellation
    or timeout, and the stream reader tails the NDJSON log in the meantime
    (`packages/eve/src/execution/ndjson-stream.ts:19-83`).

**State and persistence**

The durable record is a projection, not the live session. It keeps the
continuation token, root session id, sandbox state, session state, compaction
thresholds, the last applied system prompt and an optional output schema
(`packages/eve/src/execution/durable-session-store.ts:24-67`). Runtime-only
fields are dropped on write and rebuilt on the next step, so a retry cannot
reuse a stale in-memory handle (`:38-44`).

History is carried by the workflow as its own value and is not serialized into
the session record; a step that ran without history is refused permission to
change it, which keeps a cheap step from rewriting the transcript
(`packages/eve/src/execution/session/state-cursor.ts:57-96`). A step claims any
continuation addresses it created, and a mismatch between claimed and returned
addresses throws rather than silently forking the session.

Ownership is explicit because a newer deployment may need to take over a run
whose code version no longer exists. Forced handoff takes a lease before it
claims hooks and hands the lease back afterwards; released handoff waits for
the previous owner to let go (`packages/eve/src/execution/session/entry.ts:328-429`).
A run built by another eve version is *stranded*: commands that would need it
refuse with `409 session_stranded`, `reset` ends it and starts a successor, and
the old stream stays readable (`packages/eve/src/execution/workflow-runtime.ts:296-336`).

Compaction is a handoff too. The default threshold is ninety percent of the
context window with a small recent window kept verbatim, and when it is crossed
the successor run receives the compacted history while the previous run stops
receiving messages (`packages/eve/src/execution/session.ts:12-33`,
`clone:/docs/concepts/execution-model-and-durability.mdx:209-224`).

Retries sit under all of this. A step may run up to four attempts, and each
attempt re-emits its events under new ids, so a client treats `meta.id` as the
identity of a record rather than of a fact
(`clone:/docs/concepts/sessions-runs-and-streaming.md:189-199`).

The world decides durability. On Vercel it is Vercel Workflow; locally and
under self-hosted `eve start` it is the SDK's local world, whose state lives in
`.eve/.workflow-data`; a Postgres world is configurable
(`clone:/docs/concepts/execution-model-and-durability.mdx:16-24`,
`clone:/docs/guides/deployment/self-hosting.md:29`).

**Transport and streaming**

The HTTP surface is built from route definitions that cover HTTP verbs and
WebSocket upgrades, plus session, stream, cancel and info routes
(`packages/eve/src/channel/routes.ts:181-306`). The client is a typed wrapper
over those routes: `GET /eve/v1/info` is the inspection payload
(`packages/eve/src/client/client.ts:83`), and the session routes are wrapped by
`packages/eve/src/client/session.ts` and `packages/eve/src/client/sessions.ts`.

Events are appended as NDJSON. `session.started` precedes everything a session
records, and every envelope carries `meta.id`; a reconnect replays from the last
index the client saw, which is why the id is stable across reconnects while a
retried step's re-emission is not (`clone:/docs/concepts/sessions-runs-and-streaming.md:162-171`).

Reads can be bounded instead of followed. `follow: false` ends at the durable
tail observed when the read opens, and a negative start index counts back from
that tail, which is how a snapshot pins a point without racing new events
(`packages/eve/src/execution/session-event-stream.ts:12-122`). The client's
stream follower and message reducer consume this: deltas accumulate, and
completed events are authoritative (`packages/eve/src/client/message-reducer.ts`).

A live response can hold a lease. The stream sends heartbeats every ten
seconds and a sixty-second lease, and a client that loses the lease receives a
control record telling it the response ended; leases apply only to nonnegative
cursor reads that would otherwise reconnect
(`clone:/docs/concepts/sessions-runs-and-streaming.md:271-300`).

The client boundary is deliberately narrow: `result()` resolves at a response
boundary, `for await` exposes the live event sequence, `turn.waiting` is
informational rather than terminal, and a subagent's own stream is followed
through the `agent.started` handle (`clone:/docs/guides/client/streaming.mdx:43-63`,
`:267-279`).

**Build and test stack**

Node 24 or newer, pnpm 12.7.0, turbo across the workspace, and vitest in four
tiers with separate config files: unit tests beside the source, integration
tests that combine modules in memory, scenario tests that start a real process
or bundler, and fixture-owned e2e evals that run only in CI
(`package.json:49-52`, `clone:/AGENTS.md:180-190`).

Quality gates are mechanical where possible: `guard:invariants` checks import
and write-site invariants, `docs:check` validates frontmatter and navigation,
`check:templates` and `check:template-files` keep templates consistent,
syncpack keeps dependency versions aligned, and API Extractor configs pin the
public surface (`package.json:8-36`). Every PR touching the published package
needs a changeset (`clone:/AGENTS.md:254-263`).

Release is pre-1.0 on purpose: a patch may break an API, and the framework
prefers correctness over compatibility, which is stated as a coding principle
rather than an accident (`clone:/AGENTS.md:142-144`).
