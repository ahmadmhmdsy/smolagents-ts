# Multi-agent — cross-dive brief

**Contract**
- **Role:** synthesis for the multi-agent lane, drawn from the dives already filed; it does not replace them.
- **Mutability:** pinned to the revisions of the dives it cites.
- **Read when:** designing delegation, control transfer, a background child, or a supervisor seam.
- **Update when:** a cited dive is superseded or a decision moves a recommendation.

## Scope

This brief follows one lane: how a run hands work to another agent, what crosses the boundary, who may write shared state, how a topology is expressed, and which shapes survive a restart.
It reads the filed dives, never their clones; the row ids and their statuses are owned by `docs/research/competitors/_synthesis/00-our-baseline.md` and only the ids are repeated here.
A citation is a path relative to the clone the dive names, or a documentation path with its read date, or a claim marked as inference.
OpenHands citations keep that dive's `sdk:` and `canvas:` prefixes because it read two repositories under one name.

| dive | what this brief takes from it |
|---|---|
| `docs/research/competitors/openai-agents-js/02-features-inventory.md:27` | handoffs, agents as tools, and the resumable nested run |
| `docs/research/competitors/adk-js/02-features-inventory.md:14` | transfer with a decoded target, agent tool with validated I/O, task mode |
| `docs/research/competitors/autogen/02-features-inventory.md:53` | teams, speaker selection, and handoff as tool, message and stop target |
| `docs/research/competitors/agent-framework/02-features-inventory.md:52` | the graph engine and its five pattern builders |
| `docs/research/competitors/langgraphjs/02-features-inventory.md:56` | channels, checkpoints, forks, and the swarm and supervisor packages |
| `docs/research/competitors/crewai/02-features-inventory.md:43` | string delegation and the sequential-context rule |
| `docs/research/competitors/openhands/02-features-inventory.md:50` | threaded delegate, task handle, and child conversation |
| `docs/research/competitors/claude-agent-sdk/02-features-inventory.md:59` | the four declared child shapes and transcript resume |
| `docs/research/competitors/cloudflare-agents/02-features-inventory.md:80` | facets, detached agent-tool runs, and progress |
| `docs/research/competitors/voltagent/02-features-inventory.md:11` | a supervisor that is an ordinary agent |
| `docs/research/competitors/vercel-eve/01-architecture.md:113` | children dispatched as tasks with receipts |
| `docs/research/competitors/beeai-framework/02-features-inventory.md:48` | handoff as a sub-invocation, the naming counter-example |

## 1. Four different things called a subagent

The word covers four mechanisms that differ in one question: who owns the turn after the call.
A child call returns to the caller, a transfer does not, a background child outlives the caller's wait, and a fork never had the caller's turn to begin with.

| shape | what actually happens | who ships it | evidence |
|---|---|---|---|
| child exposed as a callable tool | the model calls a tool; a second run starts and its answer returns into the same step | openai-agents-js `asTool()`, adk-js `AgentTool`, langgraph supervisor, voltagent, smolagents, crewai, openhands | `packages/agents-core/src/agent.ts:765`; `core/src/tools/agent_tool.ts:20`; `libs/langgraph-supervisor/src/supervisor.ts:118-205`; `packages/core/src/agent/subagent/index.ts:758`; `lib/crewai/src/crewai/tools/agent_tools/base_agent_tools.py:46-124` |
| control transfer | the receiving agent continues the same conversation; the caller's turn ends and is not resumed | openai-agents handoffs, adk-js transfer, autogen handoff and swarm, langgraph-swarm, agent-framework handoff builder | `handoff.ts:64`, `:160`; `core/src/agents/processors/agent_transfer_llm_request_processor.ts:42-59`; `base/_handoff.py:12-51`; `libs/langgraph-swarm/src/handoff.ts:61-99`; `HandoffWorkflowBuilder.cs:561` |
| detached or background child | the parent keeps a handle and reads the answer later; the child may outlive the request | cloudflare agent-tool runs, claude subagents, agno, openhands task and child conversation, vercel-eve tasks, inngest | `packages/agents/src/index.ts:5684-5698`; `sdk.d.ts:83`, `:1902`; `openhands-tools/openhands/tools/task/manager.py:171-255`; `packages/eve/src/execution/tasks/table.ts:79`; `clone:/packages/agent-kit/src/agent.ts:137-165` |
| conversation fork | a copy of the transcript at a chosen point becomes a new conversation | claude, openhands, langgraph, agno, crewai restore | `sdk.d.ts:855`, `:1742`; `sdk:openhands-sdk/openhands/sdk/conversation/state.py:175-189`; `libs/langgraph-core/src/pregel/index.ts:1579-1614`; `lib/crewai/src/crewai/state/checkpoint_listener.py:1-60` |

The line between the first two is not the tool wrapper: both are model-callable functions.
It is whether the framework returns the child's answer into the parent step or rewrites which agent owns the conversation.
AutoGen is the cleanest statement of the second shape because one declaration yields a model-facing tool, a typed message naming the target, and a termination condition on that target (`docs/research/competitors/autogen/03-gap-and-lessons.md:40`).

The line between the first and the third is who awaits.
A call is a join point the parent cannot miss; a background child needs a record, a status and a place to put the answer, which is why the neighbours that ship one also ship an inspection surface (`packages/agents/src/index.ts:6476`, `:5675`).

The fourth is not delegation at all, and that is why it appears in different files: it is a storage and identity feature that a delegation feature can use.
Claude ships fork twice over, once for sessions (`sdk.d.ts:855`) and once for a child's inherited context (`subagents.md:228-246`); langgraph's fork is a checkpoint copy with a stale-base check (`libs/langgraph-core/src/pregel/index.ts:1579-1614`, `checkpoint.ts:103-114`); crewAI's is a whole-crew snapshot restore (`docs/research/competitors/crewai/02-features-inventory.md:108`).

BeeAI is the useful counter-example, because its `HandoffTool` clones the target, resets its memory, seeds filtered messages and sub-runs it, then returns text (`typescript/src/tools/handoff.ts:29-93`).
That is shape one wearing shape two's name, and the beeai dive says the baseline's "handoffs absent" conflates precisely this pair (`docs/research/competitors/beeai-framework/03-gap-and-lessons.md:66`).
The lesson for `MA-02` is to name the shape before the feature: we already ship a child call and we ship no transfer.
Each shape buys its own resume story, and section 5 takes them in the same order.

## 2. The delegation contract

| neighbour | what the child receives | what comes back | typed | progress visible | failure surfaces as | evidence |
|---|---|---|---|---|---|---|
| crewai | a fresh `Task` with a generic expected result, plus a prompt that must restate every detail | the child's text | no | no | a formatted list of valid coworkers | `base_agent_tools.py:46-124`; `translations/en.json:58-59`, `:88-108`; `crew.py:1878-1887` |
| openhands `delegate` | the parent's workspace, an LLM copy, fresh metrics, streaming off, up to five children in threads | final assistant text after the threads join and metrics fold | no | no | a child exception through the tool call (inference) | `sdk:…/tools/delegate/impl.py:168-238`, `:343-404` |
| openhands `task` | a task id, a subagent type, a confirmation policy | a handle with status, resumable with more instructions | no | status per task | status, not an exception | `sdk:…/tools/task/manager.py:100-510` |
| openai-agents-js | a forked `RunContext`: own tool input, shared usage and approvals | final text, or a caller-supplied extractor's value | optional extractor | forwarded stream with a bounded buffer | the child run's error at the tool boundary (inference) | `agent.ts:906`, `:1042-1080`, `:990-1013`; `runContext.ts:1496` |
| adk-js `AgentTool` | a nested runner against the parent session with artifact forwarding | a value validated against the child's output schema | yes, schema-validated | artifacts and events flow | a tool error | `core/src/tools/agent_tool.ts:61-72`, `:122` |
| adk-js task mode | the declared output schema as the shape of `finish_task` | the `finish_task` arguments become the node output | yes | no | the loop cannot settle without the call | `core/src/tools/finish_task_tool.ts:49`; `llm_agent.ts:369-373` |
| voltagent | a target name and a task string | result, messages and usage; parallel returns an array of prose objects | no | tool events forwarded by default | a formatted string, or a JSON error object | `subagent/index.ts:319`, `:860`, `:579`, `:875`, `:928` |
| cloudflare | a typed stub; for a run, the parent owns the record and the child owns the turn | a typed stub's return, or a detached run's snapshot | via stub | an ephemeral progress part plus a latest-wins snapshot | a run status | `index.ts:5637`, `:5684`, `:5661` |

The two extremes are both text-both-ways, for opposite reasons.
CrewAI cannot pass a type because the child is a new task with no shared history, so the only carrier is prose and a restatement instruction; OpenHands can share everything and still returns prose because its threads join on the final assistant message.
Neither product is careless: crewAI's division is intentional (a coworker knows nothing) and OpenHands's parallel children are cheap precisely because nothing has to be merged.

The middle is a handle plus a declared report, and it is not what most neighbours default to.
The declared half exists in adk-js twice, as an output schema on `AgentTool` and as `finish_task` in task mode, and in openai-agents-js as a custom result extractor.
The handle half exists in openhands `task`, cloudflare's detached runs, claude's `parent_tool_use_id` attribution, and voltagent's stream forwarding.
Only cloudflare comes close, and its typing is the host's method signature rather than a schema the runtime validates; openhands ships a stringly child too (`docs/research/competitors/openhands/03-gap-and-lessons.md:37`), and the cloudflare dive prices a typed child report at S while the openai dive prices the same capability at M (`docs/research/competitors/cloudflare-agents/03-gap-and-lessons.md:37`, `docs/research/competitors/openai-agents-js/03-gap-and-lessons.md:18`).

Two details deserve to be contractual rather than conventional.
Failures that arrive as a status or a formatted string let the parent's model decide what to do; a thrown exception ends the parent's step, which is why voltagent's delegation result is data even when empty (`subagent/index.ts:875`).
And progress is a rendering concern with a correctness shadow: an unattributed child event cannot be placed in the parent's transcript, which is why claude stamps every forwarded message (`sdk.d.ts:1902`).

## 3. Shared state

Every neighbour answers "what may a child write" with a scope, not a permission.
The scope decides the merge rule, and the merge rule decides whether a restart can reconstruct the run.

| neighbour | shared medium | what a child may write | who owns the durable copy | evidence |
|---|---|---|---|---|
| autogen | the team's message thread; participant state keyed by name | messages only | the host, through the team save path | `state/_states.py:27-72`; `_base_group_chat.py:748-796` |
| langgraph | channels, one fold per key | through its own node writes, settled by the channel's reducer | the checkpointer, per thread and namespace | `libs/langgraph-core/src/channels/last_value.ts:34-48`; `untracked_value.ts:21`; `constants.ts:147-148` |
| adk-js | the session, with `app:`, `user:` and `temp:` scopes | only keys its schema declares; `temp:` never persists | the session service, per app and user | `sessions/state.ts:11`, `:28-31`, `:74-85`; `base_session_service.ts:169-200` |
| crewai | one memory store, saved after each agent finish | distilled facts, not raw state | the memory store's backend | `unified_memory.py:76-165`; `base_agent_executor.py:31-69` |
| openhands | the workspace directory | files, by default shared | the workspace, or a worktree when isolation is asked for | `sdk:…/tools/child_conversation/definition.py:35-41`; `docs/research/competitors/openhands/03-gap-and-lessons.md:36` |
| cloudflare | nothing by default; a facet owns its own storage | its own facet state; the parent holds the run record only | the parent, for a durable run record | `docs/research/competitors/cloudflare-agents/00-profile.md:75`; `index.ts:5684` |
| voltagent | the parent's memory, read-only, plus a per-call context map | child turns tagged as its own and filtered out of the parent's reads | the memory manager | `memory-manager.ts:247`, `:282` |
| vercel-eve | separate child session slots | its own session | the session store, by slot | `parent-notification.ts:262-304` |

The four real answers are: nothing, a declared slice, the workspace, and a channel with a reducer.
Blackboards are the workspace answer with a vocabulary, and the openhands dive draws the line exactly: sharing a directory makes a child cheap and concurrent edits a race, while a worktree removes the race and hides the work until it is merged (`docs/research/competitors/openhands/02-features-inventory.md:123-125`).
The channel answer is the only one that also gives replay, because a fold over writes can be recomputed; the untracked channel exists because sometimes that cost is not wanted (`untracked_value.ts:21`).

Our `MA-05` says the seam is absent and `RunContext.state` is per run and not exposed to a child (`docs/research/competitors/_synthesis/00-our-baseline.md:42`).
That is the cheapest correct position, and the dives price moving off it at cloudflare L and openhands M (`docs/research/competitors/cloudflare-agents/03-gap-and-lessons.md:39`, `docs/research/competitors/openhands/03-gap-and-lessons.md:36`).
The question a child actually asks is not "may I see the blackboard" but "may I write this key, and who resolves two writers"; a typed child report answers that without a store, which is why section 6 puts the report before any shared state.

## 4. Topology as code versus topology as configuration

| neighbour | topology object | where the topology lives | who chooses the next participant | evidence |
|---|---|---|---|---|
| crewai | a `Crew` with a process string and a task list | configuration on one object | declaration order, or a manager agent in the hierarchical process | `crew.py:1522-1529`, `:1531-1562`, `:1727-1730` |
| autogen | a team: participants, a manager, a selection policy, termination conditions | engine objects; the selection policy is swappable | a policy object: round-robin index, model selector, newest handoff scan, or the magentic ledgers | `_selector_group_chat.py:152-217`; `_swarm_group_chat.py:100-112`; `_magentic_one/_magentic_one_orchestrator.py:134-190` |
| agent-framework | a workflow graph built by one of five builders | code that constructs validated data: executors, edges, fan-out, fan-in | the graph, with the magentic builder driving a manager | `AgentWorkflowBuilder.cs:27`, `:87`, `:138`, `:156`, `:183`; `WorkflowBuilder.cs:254` |
| adk-js | a `Workflow` with static edges or a dynamic entry | graph data with per-node retry, timeout and schema | the graph; the older composite agents are deprecated in its favour | `workflow/workflow.ts:137-167`; `parallel_agent.ts:42-55` |
| langgraph | ordinary graphs; the supervisor and swarm are shipped graph shapes | code over the same runtime; the handoff tool returns a route command | the graph router, or the model through the handoff tool | `libs/langgraph-swarm/src/handoff.ts:61-99`; `docs/research/competitors/langgraphjs/02-features-inventory.md:183-185` |
| mastra | a supervisor agent with delegation hooks; the routing network is a deprecated workflow | configuration on the agent, executed by the loop | the supervisor model | `loop/network/index.ts:26`; `agent.types.ts:816` |
| voltagent | no separate type: an agent with a `subAgents` list | configuration on the agent, compiled into a prompt and a tool | the model's choice among generated delegation tools | `subagent/index.ts:96`, `:236`, `:758` |
| vercel-eve | an engine; subagents are directories | files on disk, dispatched as durable tasks | the engine, through the session's action requests | `docs/research/competitors/vercel-eve/01-architecture.md:56`, `:113-122` |
| inngest | no topology of its own; a child is a function invocation | host code | the host's orchestration | `clone:/packages/agent-kit/src/agent.ts:137-165` |

The split is not code versus configuration; both camps write code.
The split is whether the topology gets its own execution model.
AutoGen, agent-framework, adk-js's workflow and vercel-eve are engines: the graph or team is the unit that starts, checkpoints, pauses and resumes, and an agent is a node inside it.
LangGraph, voltagent, mastra and openai-agents-js's handoffs are libraries: the topology compiles down to prompts, tool calls and loop control, and no new primitive appears.
The langgraph dive states the test plainly, that its multi-agent packages add no runtime primitive (`docs/research/competitors/langgraphjs/02-features-inventory.md:183-185`), while agent-framework's decision log prices "one engine serves every pattern" at L (`docs/research/competitors/agent-framework/03-gap-and-lessons.md:21`).

Magentic is the case that makes the split concrete.
Two neighbours ship it, both as engine builders, and both keep serializable ledgers as state (`_magentic_one/_magentic_one_orchestrator.py:58`, `:300-450`; `_magentic.py:274`, `:310`).
The behaviour is a plan, a progress review and a stall count; the durability is the ledger.
A library can prompt the same behaviour and cannot promise the review happened, which is exactly the kind of guarantee a checkpoint makes and a prompt does not.

For a library our size the engine is a second product.
Our loop is already the only engine; a topology shipped as code over it costs a seam and a prompt, while a graph engine costs the L rows above and every later orchestration feature would land in the engine rather than the loop.
That is the reading section 6 takes: ship one supervisor shape, refuse the graph.

## 5. The resume question for each shape

| shape | survives a restart today in | what carries it | evidence |
|---|---|---|---|
| child call | openai-agents-js, and only for a nested child | a resume marker serialized into the tool call's details, so the outer run can restart the child where it stopped | `agent.ts:917-941` |
| child call, task mode | openhands, adk-js within the parent session | a task id and status; adk's child runs on the parent session, so the session carries what a resume would need (inference on resume) | `sdk:…/tools/task/manager.py:171-255`; `core/src/tools/agent_tool.ts:61-72` |
| control transfer | adk-js; autogen as a new run, not a resumed one | adk stores the transfer action on the event and reads it again when routing resumes; autogen ends the run and a later run takes a handoff message as its task | `core/src/events/event_actions.ts:37`; `conditions/_terminations.py:313-341`; `_swarm_group_chat.py:188-221` |
| detached child | cloudflare, agno, vercel-eve, openhands, claude | a run record plus a reconcile tick; a job row with a lease; a task record written before dispatch with the turn parked; a server conversation; a transcript subpath | `index.ts:6476`; `docs.agno.com/agent-os/background-execution/durable-queue` (read 2026-10-21); `packages/eve/src/execution/tasks/start.ts:88-125`; `sdk:…/agent_server/conversation_service.py:664-680`; `sdk.d.ts:6891-6894` |
| conversation fork | claude, langgraph, openhands, crewai restore | transcript ids rewritten under a new session; a checkpoint cloned under a new parent with a stale-base check; an event tree with a movable head; a whole-crew snapshot | `sdk.d.ts:855`; `libs/langgraph-core/src/pregel/index.ts:1579-1614`; `sdk:…/conversation/local_conversation.py:814-852`; `libs/crewai/src/crewai/state/checkpoint_listener.py:1-60` |

Resuming a child is three questions, and neighbours answer them separately.
First, can the parent resume while the child is still pending? That needs the pending child to be in the parent's checkpoint, which is why cloudflare's reconcile tick exists rather than a callback.
Second, can the child itself resume? Only openai-agents-js does that inside a tool call, by making the nested run's marker part of the parent's serialized state (`agent.ts:917-941`).
Third, can a finished or abandoned child be re-attached? That needs an identity and a status row; openhands' task manager and cloudflare's ledger are the two cheapest versions (`:171-255`, `index.ts:6476`).

No neighbour claims the mid-step version.
LangGraph's own note is the honest one: a resume re-enters the node from its first line, so the node body is not idempotent by default, and the durability modes are the only place a guarantee is stated (`docs/research/competitors/langgraphjs/02-features-inventory.md:123-126`, `:143-146`).
Claude's recovery is coarser still, resuming at a turn boundary and replaying what the turn had not finished (`docs/research/competitors/claude-agent-sdk/03-gap-and-lessons.md:44`).

For us this section is gated before it starts: `HL-04` is minimal with only `MemoryRunStore`, and `HL-09` and `HL-10` are absent (`docs/research/competitors/_synthesis/00-our-baseline.md:53`, `:58`, `:59`).
A child record in a memory store survives nothing, so the durable store is a prerequisite for the third shape, not a companion to it.

## 6. A recommended shape for us

Three primitives, over the loop we already have: a delegation call with a typed report, a transfer that ends the parent's turn, and a background child with a record and a handle.
Everything else in this lane is either a rendering feature, a hosting feature, or a second engine.

| step | change | price | why this price |
|---|---|---|---|
| S1 typed child report | widen `outputSchema` at `managed-agent.ts:53` from `z.string()` to a schema, validate at the boundary, and return `{status, output, usage}` instead of text | S | cloudflare's price is S and openai's M (`docs/research/competitors/cloudflare-agents/03-gap-and-lessons.md:37`, `docs/research/competitors/openai-agents-js/03-gap-and-lessons.md:18`); voltagent calls the typed report the cheapest structural win on its list (`docs/research/competitors/voltagent/03-gap-and-lessons.md:68`) |
| S2 transfer action | one interpreted action that names a target and a typed payload, is terminal for the parent, and starts the target's run with the payload as its task | M | openai and autogen both land here and both price it M (`docs/research/competitors/openai-agents-js/03-gap-and-lessons.md:17`, `docs/research/competitors/autogen/03-gap-and-lessons.md:21`) |
| S3 background child | a child run row in `RunStore`, a handle on the parent run for join, collect and cancel, and caps on depth, concurrency and spend | L | cloudflare's detached ledger is L and openhands' parallel children M without restart (`docs/research/competitors/cloudflare-agents/03-gap-and-lessons.md:28`, `docs/research/competitors/openhands/03-gap-and-lessons.md:35`); claude's caps are declared, not shipped (`docs/research/competitors/claude-agent-sdk/02-features-inventory.md:70`) |
| S4 progress attribution | an `agentPath` on child events, and child turns filtered on memory reads | S | voltagent ships both and the row is S (`subagent/index.ts:928`; `memory-manager.ts:282`; `docs/research/competitors/voltagent/03-gap-and-lessons.md:64`) |
| S5 transfer stop reason | a stop that names the transfer target so a renderer can show "handed to X" and a caller can branch on it | S | autogen keeps handoff target as a termination condition; our loop bound and stop reason are the same object today (`conditions/_terminations.py:313-341`; `docs/research/competitors/autogen/03-gap-and-lessons.md:34`) |

`RunStore` gains one row shape for all three primitives, not three: a child run id, the parent run id, the shape (`call`, `transfer`, `background`), a status, the output, usage and timestamps.
The parent's checkpoint gains a pending-children list and, when a transfer happened, the target and payload, so a restart can re-attach or fail loudly rather than guess.
Both carry a schema version, because `HL-10` is the cheap row that stops a stored child from outliving the code that wrote it (`docs/research/competitors/_synthesis/00-our-baseline.md:59`).

No exactly-once claim belongs in that record.
A background child that already ran is re-attached, and if its record is missing the parent fails; starting a second child silently is the failure mode the langgraph replay note warns about, where replay is cheaper than re-execution and re-execution is not idempotent (`docs/research/competitors/langgraphjs/02-features-inventory.md:101-104`).

The caller's surface would be small; the names are placeholders, the shapes are the claim.

```ts
const report = z.object({ finding: z.string(), confidence: z.number() });
const scout = managedAgent({ agent: researcher, outputSchema: report });

// call: a join point
const run = await runner.run(parent, input, { tools: [scout.asTool()] });

// transfer: the parent's turn ends, the target continues
run.stop.kind; // "transferred" | "completed" | "steps_exhausted"
run.stop.target; // "writer"

// background: a handle, not a result
const child = await runner.startChild(parent, scout, { caps: { steps: 10 } });
child.status; // "pending" | "running" | "settled" | "failed" | "cancelled"
await child.join(); await child.cancel(); await child.result();
```

Refusals, with the price of not refusing (each price is a dive's own column, cited here or earlier):

- a graph workflow engine behind the topology seam (`docs/research/competitors/agent-framework/03-gap-and-lessons.md:21` and `docs/research/competitors/autogen/03-gap-and-lessons.md:36`, both L): we would own a second execution model and every orchestration feature would land there instead of the loop.
- a shared mutable blackboard by default (cloudflare L, openhands M): without an owner and a merge rule the workspace becomes the state and the run stops being reconstructable.
- parallel fan-out before a typed report (voltagent's first lesson): prose multiplied, with no way to tell success from failure in the join.
- a conversation-fork product surface (openhands prices the log tree L at `docs/research/competitors/openhands/03-gap-and-lessons.md:30`, and claude's fork is product work): a fork without a picker is a storage feature we do not need, and decision 0018 keeps the studio out.
- A2A and other agent-to-agent protocols (`docs/09-decisions/0018-post-0.1.0-scope-boundary.md`; beeai records the identity field as the only part worth copying).
- a durable job queue and scheduler (agno's `agno_jobs`, eve's tasks and world): that is hosting, and the host already owns it.
- the name "handoff" for a clone-then-subrun (beeai's counter-example): the vocabulary is what keeps a transfer resumable as one action.

Two ordering constraints close the lane.
S1 before S3, because a background child with a string report is a paragraph you cannot join; and S2 after S1 if its payload is to be typed.
S3 after the durable store, because a child ledger in `MemoryRunStore` is a record that survives exactly as long as the process it was meant to outlive.

## Where the dives disagree

- Typed by default. Cloudflare prices the typed report at S, openai at M, openhands ships a stringly child and calls it parity, and voltagent calls the schema the cheapest win. The direction is agreed; only the scope is contested, and the scope depends on whether the schema is also the join key.
- Transfer versus clone. BeeAI names a sub-invocation a handoff; autogen, adk-js and langgraph treat transfer as control. Only a real transfer can be stored as one action and resumed as one (`core/src/events/event_actions.ts:37`); a clone can be re-run, never continued.
- Engine versus library. Agent-framework, autogen, adk-js and eve build a control plane; langgraph, voltagent, mastra and openai's handoffs do not. Both are coherent, and the failure mode is a library that grows half an engine: a topology object that checkpoints something the loop cannot resume.
- What resume means. openai-agents-js resumes a nested child, adk resumes a transfer, cloudflare and eve re-attach a detached child, and no neighbour does all three. Nobody claims mid-step idempotence, which suggests we should not be the first to promise it.

## Confidence and gaps

Every claim in sections 1 to 5 is a dive's line-level finding, read at the clone by that dive on 2026-10-21; this brief opened no clone, per its assignment, so a source path here is quoted from the dive rather than re-read.
Declared-only evidence is marked as such where it matters: claude's subagent rows and eve's subagent surface come from documentation and type declarations, and the pydantic and smolagents background rows are README-level (`docs/research/competitors/pydantic-ai/02-features-inventory.md:171`, `docs/research/competitors/huggingface-smolagents/02-features-inventory.md:40-42`).
Not read for this brief: inngest's invocation internals beyond its one gap row, and mastra's delegation hooks, which its dive records as declared.
The price table is a design sketch that borrows each neighbour's own price column; none of those prices was measured against our code, and `S3` is an L because the dives say L, not because a spike says L.

## Open questions

1. Is a transfer a new interpreted action, or a stop reason on a managed-agent tool? The answer decides whether `RunStore` needs a transfer record at all; autogen splits the same idea across an action, a message and a condition.
2. Does a background child get an identity of its own (`HL-08`) or a run id under the parent? The answer decides the listing key and what "resume this child" means.
3. Is the report schema declared per agent or per call? adk-js declares it per agent; openai-agents-js extracts per tool call; our `outputSchema` sits on the managed agent, which biases S1 toward per agent.
4. Does a child share the parent's session (adk-js) or receive a forked context (openai-agents-js)? That is the default `MA-05` answer, and it should be chosen before the first child writes anything.
5. Where do caps live: quota rows in `RunStore`, or in-process counters? Claude's caps are product configuration with a spend basis; we have neither, so S3's cap clause is the least specified part of the plan.
