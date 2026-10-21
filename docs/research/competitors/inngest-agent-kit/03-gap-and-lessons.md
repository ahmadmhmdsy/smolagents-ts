# inngest/agent-kit — gaps and lessons for this port

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Baseline rows come from `docs/research/competitors/_synthesis/00-our-baseline.md`;
buckets and sizes follow `docs/research/competitors/_method.md`. Evidence cells
name a line in the clone at the pinned commit or a platform page read on
2026-10-21. A bucket B row is recorded for the register and is not a backlog
item.

**The axis, stated plainly**

Our loop runs in one process and writes its own checkpoints; their loop runs
inside a host that owns the step log. The interesting question is not which is
better but which guarantees a step boundary buys, because those are the
guarantees we would have to reproduce if we ever accepted a host. There are
three. A step's output is stored when it completes and returned unchanged on
every later attempt. A repeated step id is disambiguated by an occurrence
counter, so a loop can take the same branch twice without collision. Everything
outside a step runs again, so ids, writes and external calls have to be
tolerable twice.

Their own code is a fair test of that contract. Ids are generated inside steps
so a replay rebuilds the same row keys, the inference is a step so a replay does
not pay for a second model call, and the history hooks are handed the step tools
so a caller can wrap its writes. The tool handler is the hole in the wall, and
the code says why: a tool may need several steps of its own
(`clone:/packages/agent-kit/src/agent.ts:723-728`).

**Gaps, bucketed**

| bucket | capability | baseline row | fit | effort | evidence | what would change |
|---|---|---|---|---|---|---|
| A | a step boundary the host owns, so one model or tool call can be replayed instead of repeated | HL-05, HL-03 | `packages/core/src/session/run-store.ts` | L | step tools out of an async context (`clone:/packages/agent-kit/src/util.ts:34-46`); inference under an agent-named step (`clone:/packages/agent-kit/src/model.ts:50-56`) | a `step` seam in the loop; the host memoises, our store keeps history |
| A | resuming a run that another process started | HL-04, HL-09 | `packages/core/src/session/run-store.ts` | M | thread rows for history plus the host's run id (`clone:/packages/agent-kit/src/history.ts:322-339`) | store the transcript, let the host own in-flight state |
| A | an interrupt that waits for a person rather than a process | HL-06, HL-02 | `packages/core/src/agent/approval.ts` | M | `step.waitForEvent` with timeout and match inside a tool (`clone:/docs/src/content/docs/advanced-patterns/human-in-the-loop.mdx:26-49`) | the tool asks the host to wait and resumes with the answer in its result |
| C | replay or fork from a named boundary | HL-07 | `packages/core/src/session/run-store.ts` | M | step ids plus occurrence counters; the dev server can rerun a workflow | boundaries are step ids, not message indices |
| D | spans another collector can ingest | OB-02, OB-03 | `packages/core/src/monitoring/trace.ts` | M | step-level traces and per-inference token usage (`clone:/docs/src/content/docs/getting-started/local-development.mdx:101-110`) | export step begin and end; keep the local span tree as the shape |
| D | a default bound on loop passes | RT-06 | `packages/core/src/agent/multi-step-agent.ts` | S | `maxIter` defaults to zero and zero means unlimited (`clone:/packages/agent-kit/src/network.ts:101`, `:597-600`) | a typed default bound and a typed error instead of silence |
| D | retry and timeout per tool | TL-05 | `packages/core/src/tool/tool.ts` | M | a tool is not a step, so nothing retries it alone (`clone:/packages/agent-kit/src/agent.ts:723-740`) | retry at the step seam; per-tool policy stays an option on the tool |
| C | a blackboard every agent in a session can read and write | MA-05 | `packages/core/src/agent/run-context.ts` | M | typed `State.data` plus a results array, shared by agents, tools and router (`clone:/packages/agent-kit/src/state.ts:36-163`) | a session-scoped state bag passed into each call, not only a run |
| C | a topology primitive with a router | MA-06, MA-02 | `packages/core/src/agent/managed-agent.ts` | L | a router returning agents or nothing, a stack of pending agents, a model router as the default (`clone:/packages/agent-kit/src/network.ts:190-323`) | handoff as a router return value, not a graph type |
| A | a child agent that runs as its own durable function | MA-04 | `packages/core/src/agent/managed-agent.ts` | M | an Inngest function in `tools` is invoked with `step.invoke` (`clone:/packages/agent-kit/src/agent.ts:137-165`) | a background-agent seam; the host runs the child |
| D | a conversation identity that outlives the process | HL-08 | `packages/core/src/session/agent-session.ts` | S | thread id from client, from `createThread`, or a generated UUID (`clone:/packages/agent-kit/src/history.ts:198-243`) | name the thread on the session, not on the run |
| C | history as an adapter rather than a store | HL-08, RT-14 | `packages/core/src/session/agent-session.ts` | M | four optional hooks, each given state and step tools (`clone:/packages/agent-kit/src/history.ts:35-97`) | a seam a caller can implement against any database |
| C | forcing a structured answer through a tool call | GR-02, GR-05 | `packages/core/src/agent/multi-step-agent.ts` | S | `tool_choice` on the agent; the network comment notes forcing structured output with `maxIter: 0` (`clone:/packages/agent-kit/src/network.ts:636-637`) | a synthetic final tool instead of provider JSON mode |
| D | hooks that rewrite a prompt before a call or stop it | RT-08, GR-01 | `packages/core/src/middleware.ts` | S | `onStart`, `onResponse` and `onFinish` may replace the prompt, the history or the result (`clone:/packages/agent-kit/src/agent.ts:323-330`, `:371-380`, `:468-478`) | typed pre and post hooks that receive and return messages |
| D | versioning an in-flight run against a code change | HL-10 | `packages/core/src/session/run-store.ts` | S | stable ids with occurrence counters; a change of id is a new step (`https://www.inngest.com/docs/durable-execution/guides-and-advanced/versioning`) | name step ids and refuse a mismatch instead of replaying blind |
| D | cancellation observed by another process | RT-07 | `packages/core/src/events.ts` | M | the platform cancels a run, and the check happens at step boundaries (`https://www.inngest.com/docs/features/inngest-functions/cancellation`) | record intent; the host stops at the next boundary |
| A | a checksum on a saved record to make a retry harmless | HL-03 | `packages/core/src/session/run-store.ts` | S | `AgentResult` checksum and unique constraints in the docs (`clone:/docs/src/content/docs/concepts/history.mdx:404-449`) | checksum a checkpoint before writing it a second time |
| B | a deployment target and a hosted console | DS-05, UI-06 | decision 0018 keeps it out | XL | `createServer`, an Inngest Cloud sync, a realtime transport (`clone:/packages/agent-kit/src/server.ts:24-81`) | recorded, not queued |
| B | a workspace with a filesystem and a shell | EX-05 | decision 0018 keeps it out | XL | E2B and Daytona as tools (`clone:/docs/src/content/docs/integrations/e2b.mdx:16-36`, `:212-216`) | recorded; the neighbour does not ship one either |
| B | a chat UI wired to the run over the network | UI-06 | decision 0018 keeps it out | XL | the `use-agent` package and a realtime transport | recorded, not queued |

**What we ship that they lack**

- Three executors, including a WASM sandbox, against a library that delegates
  code execution to an npm package wrapped as a tool.
- Guardrails as a loop primitive: they have lifecycle hooks, and no typed
  tripwire that halts a run with a reason.
- A local span tree and a typed error taxonomy; their observability is the
  platform's UI and their failure surfaces are plain errors.
- A planning interval and code-as-action; their model surface is one inference
  per agent call, with tool calls as JSON.
- A typed event stream consumable in-process; their events are designed to leave
  the process and are chunked after the fact.

**Patterns worth copying**

- The step seam itself: pass an optional host object into the loop, use it for
  the model call and for tools that want it, and keep the loop's memory out of
  the payload.
- Generate identifiers inside the step, never before it. This is the cheapest
  way to make a replay idempotent and it costs one closure.
- Give the history hooks the same step handle the loop uses, so the caller can
  wrap writes without a second abstraction.
- Wait on an event with a timeout and a match field instead of persisting a
  pending approval row and polling it; the host already knows how to resume.
- Let the router return a list rather than one agent, and keep a stack; it makes
  fan-out a scheduling detail instead of a new type.
- Namespace a tool by its provider (`server` + tool name) so two MCP servers can
  both expose `search` without a rename pass.

**Patterns to avoid**

- Calling the same API durable on both sides of a context check: outside a host
  the inference is a bare `fetch` with no cache, no retry and no trace.
- Silent infinity: the loop's bound is an integer whose zero disables it, and
  the docs only suggest a bound when an LLM router is in use.
- A documentation claim that outruns the code, as with retries "for tool calls"
  when a tool is not a step.
- A tool contract that requires the developer to know the host's step semantics
  and get them right with no type-level help.
- Per-run state presented as memory in prose while the docs also say it dies
  with the run.
- Streaming that promises live tokens and delivers chunked completed text.

**What it should change for us**

1. Define a `StepHost` seam over the loop before any store grows: one method to
   run a named step, one flag for whether it is durable, and a documented
   purity rule for the code between calls.
2. Move the model call and each tool call behind that seam so HL-03 stops being
   the only durability we have; the checkpoint remains the fallback when no
   host is present.
3. Keep step payloads small and name them: step id, attempt, result. A host can
   then own replay, and our store can stay a history record.
4. Add the typed default bound and the typed error at the same time, so a
   network without a budget cannot loop forever.
5. Give tools an optional step handle, and document that a side effect outside a
   step will happen again.
6. Do not add a router topology yet; the blackboard and the router return value
   are the two ideas worth holding in reserve for MA-05 and MA-06.

**Baseline correction**

No row is contradicted. The baseline's note that a checkpoint lands between
steps, so a crash inside a step replays it (HL-05), reads differently after this
dive: the neighbour's answer is not a finer checkpoint but a different owner for
the boundary, and that is the design choice this register should record. The
E2B-as-tool arrangement also confirms that EX-05 stays a non-goal without
losing code execution entirely.
