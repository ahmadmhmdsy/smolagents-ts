# mastra — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Strength words are used exactly: `implemented` means the source path was traced end to
end; `declared` means a type, flag or documentation page claims it but no path was traced;
`inferred` means reasoning from structure, said so in the row. Rows are grouped by our
baseline families so the gap file can cite them.

## Agents and delegation

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| AG-01 | One options bag for an agent, repeatable per call | implemented | `packages/core/src/agent/agent.types.ts:460` agent-level, `:596` call-level | Call-level options override agent-level ones; model, memory, processors, scorers, limits and approval policy are all overridable per request | Lets a host change model, thread or safety policy without rebuilding the agent |
| AG-02 | Supervisor delegation to sub-agents and workflows | declared | `packages/core/src/agent/agent.types.ts:816`; https://mastra.ai/docs/agents/networks (read 2026-10-21) | The options declare delegation hooks that can rewrite a child prompt, reject a delegation with a reason or bail sibling work; the networks page states supervisor agents replace networks | Multi-agent coordination without a separate orchestration program |
| AG-03 | Routing-agent network | declared, deprecated | `packages/core/src/loop/network/index.ts:26` builds the network as a workflow; https://mastra.ai/docs/agents/networks (read 2026-10-21) | A router model picks primitives and order; the network edits state until a completion check passes | Superseded by supervisor agents, kept for compatibility |
| AG-04 | Completion scoring inside the loop | implemented | `packages/core/src/agent/agent.types.ts:753`; `packages/core/src/loop/loop-builder.ts:251` | The `isTaskComplete` step runs scorers after an iteration and injects failure feedback as a message | Turns an eval scorer into loop control, so a supervisor keeps working until a rubric passes |
| AG-05 | Tool-call concurrency policy | implemented | `packages/core/src/agent/agent.types.ts:765`; `packages/core/src/loop/loop-builder.ts:391` | Default limit ten, but any registered approval or suspend-capable tool forces sequential execution; a `called` strategy resolves the limit from the calls the model actually made | Preserves ordering for approval-sensitive calls while allowing parallel safe calls |
| AG-06 | Eager tool execution from a partial stream | implemented | `packages/core/src/agent/agent.types.ts:598` | A tool starts as soon as its complete call part is streamed, instead of waiting for the model step to end | Cuts latency on slow tool calls; durable agents reject the mode |
| AG-07 | Structured final output through a processor | implemented | `packages/core/src/processors/processors/structured-output.ts:45` | An output processor calls a structuring model with a schema and emits typed output as it settles | Separates answer generation from schema conformance |
| AG-08 | Memory binding per call | implemented | `packages/core/src/agent/agent.types.ts:616`, `:625` | `memory.thread` and `memory.resource` select the conversation; `scopes` can carry the same identity and must agree when both are set | Multi-user and multi-tenant hosts pass thread identity with the request |
| AG-09 | Processor retry budget | implemented | `packages/core/src/agent/agent.types.ts:700`; `packages/core/src/processors/retry-budget.ts:20` | A day-one cap of three processor-triggered retries per generation, configurable per call, warns once when it falls back | Stops a retry loop between processors from becoming an unbounded spend |
| AG-10 | Approval policy resolution | implemented | `packages/core/src/agent/agent.types.ts:760`; `packages/core/src/loop/workflows/agentic-execution/tool-approval-verdict.ts:60`, `:107` | A global boolean, a per-call predicate or a per-tool function decides; `beforeApproval` runs validation and a hook first, and a policy error defaults to requiring approval | Fails closed when the policy itself is broken |

## Workflows and durability

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| WF-01 | Workflow DSL over typed steps | implemented | `packages/core/src/workflows/create.ts:24`, `:124` | `createWorkflow` returns a builder with `then`, `parallel`, `foreach`, `dowhile`, `map` and `commit`, and the agent loop uses the same builder | One composition model for user workflows and the agent turn |
| WF-02 | Suspend and resume inside a step | implemented | `packages/core/src/workflows/step.ts:164`; `packages/core/src/workflows/workflow.ts:4860` | `suspend(payload)` pauses the step and saves the run; `resume({resumeData})` re-enters it with the payload validated against `resumeSchema`, and the step can read its original `suspendData` | External input, timers and human approval without holding a process open |
| WF-03 | Resume targeting | implemented | `packages/core/src/workflows/state-reader.ts:25`, `:106`; `packages/core/src/workflows/workflow.ts:4860` | Resume names a step, a resume label or a `foreach` index; a reader exposes suspended paths and labels without the raw snapshot | Operators and UIs resume a specific pause, not merely the last one |
| WF-04 | Nested suspension paths | implemented | `packages/core/src/workflows/workflow.ts:3354` | A nested workflow's suspend path is flattened into the parent's suspended list with workflow metadata | One resume protocol covers composed workflows |
| WF-05 | Durable snapshots | implemented | `packages/core/src/storage/workflow-snapshot.ts:44`; `packages/core/src/workflows/workflow.ts:3029`, `:3054` | Step results, active and suspended paths, labels and the serialised graph live in one snapshot document loaded by `createRun` | Resume and recovery across deployments |
| WF-06 | Idempotent resume | implemented | `packages/core/src/workflows/workflow.ts:4854`, `:5095`; `packages/core/src/loop/workflows/stream.ts:447` | A resume claim is persisted with the snapshot; a second resume is rejected or warns unless the workflow allows unclaimed resumes | Duplicate webhooks and retried HTTP calls must not run a step twice |
| WF-07 | Ownership lease and fencing | implemented | `packages/core/src/workflows/run-ownership.ts:24`, `:37`, `:46` | The driving process claims a lease with a TTL and heartbeats it; stores that cannot fence degrade to a no-op | A recovery sweep on another replica can distinguish an orphan from a live run |
| WF-08 | Snapshot pruning | implemented | `packages/core/src/loop/loop-builder.ts:345`; `packages/core/src/loop/workflows/prune-snapshot.ts:523` | The loop supplies a prune hook so per-run state stays bounded; the loop writes snapshots only for pending, paused and suspended statuses (`loop-builder.ts:327`) | Long loops must not accumulate unbounded run state |
| WF-09 | Restart and time travel | implemented | `packages/core/src/workflows/workflow.ts:4939`; `packages/core/src/workflows/execution-engine.ts:235` | `restart` re-enters a completed run; the engine's `execute` accepts time-travel parameters | Replay a run after a policy or prompt change |
| WF-10 | Sleep and wait states | declared | https://mastra.ai/docs/workflows/suspend-and-resume (read 2026-10-21) | `sleep` and `sleepUntil` pause at workflow level with status `waiting`, distinct from a step-level suspension | Schedule a delayed continuation without an external queue |
| WF-11 | Scheduled workflows on a worker engine | declared | `packages/core/src/workflows/create.ts:61`, `:85`; `packages/core/src/workflows/scheduler/` | Declaring `schedule` plus a worker environment switches the workflow to the evented engine | Cron-shaped agents without a separate scheduler service |
| WF-12 | State reader for recovery | implemented | `packages/core/src/workflows/state-reader.ts:106` | A typed view over `WorkflowState` exposes suspended steps and resume labels | A UI or an operator endpoint can recover a run without knowing snapshot internals |

## Memory

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MM-01 | Threads and resources | implemented | `packages/core/src/memory/memory.ts:568`, `:694`; `packages/memory/src/index.ts:1121` | A thread record is scoped by a resource; both identifiers are required for recall and working-memory writes | Conversation identity separate from user identity |
| MM-02 | Semantic recall | implemented | `packages/memory/src/index.ts:801` | Vector search over thread or resource scope, a threshold, `messageRange` expansion around hits, then a token-limited history load | Bring back relevant older turns without stuffing the window |
| MM-03 | Working memory | implemented | `packages/core/src/memory/types.ts:1072`; `packages/core/src/processors/memory/working-memory.ts:47` | A markdown template or JSON schema record, resource-scoped by default or thread-scoped, injected as a system message or a state signal | A durable profile the model reads and updates |
| MM-04 | Working-memory update and merge | implemented | `packages/memory/src/tools/working-memory.ts:125`; `packages/memory/src/index.ts:1365`; `packages/core/src/memory/memory.ts:733` | A tool writes the record; updates take a per-key mutex; atomic merge is used when the store advertises the capability, with null deleting a field | Concurrent turns must not lose an update |
| MM-05 | Memory as auto-registered processors | implemented | `packages/core/src/memory/memory.ts:778`, `:793`, `:809`, `:853`, `:887`, `:943` | The memory instance contributes input, output and error processors, and skips any the user already configured by id | Memory features compose with the same pipeline as guardrails and need no loop changes |
| MM-06 | Token-budgeted history with a persisted boundary | implemented | `packages/core/src/memory/message-history-config.ts:59`; `packages/core/src/memory/memory.ts:964` | Trimming oldest-first records a boundary on the thread so trimmed messages stay out of later requests while remaining stored | Bound context cost without deleting history |
| MM-07 | Observational memory | implemented | `packages/memory/src/processors/observational-memory/processor.ts:147`; `packages/memory/src/processors/observational-memory/observational-memory.ts:422` | An observer agent compresses message batches into observations, a reflector rewrites them, and recall tools query the record; buffering can run asynchronously | Long conversations where a summary beats raw history |
| MM-08 | Thread copy and title generation | declared | `packages/memory/src/index.ts:3434`; `packages/core/src/memory/types.ts:1120` | Clone and copy operations duplicate a thread's messages; title generation is configurable | Fork a conversation and label it in a list |
| MM-09 | Read-only memory and merged runtime config | implemented | `packages/core/src/memory/types.ts:1000`; `packages/core/src/memory/memory.ts:788` | A read-only flag suppresses writes; a runtime memory config from the request context is merged over the stored thread config | Internal routing agents read memory without polluting it |
| MM-10 | Many storage and vector adapters | inferred | `packages/core/src/storage/domains/`; the memory constructor accepts separate storage, vector and embedder | Store and index are injected rather than assumed | Deployments bring their own database |

## Evals and scorers

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EV-01 | Scorer builder with four steps | implemented | `packages/core/src/evals/base.ts:1984`, `:753`, `:307` | `createScorer` returns an immutable builder; each of `preprocess`, `analyze`, `generateScore` and `generateReason` is a function or a prompt object, and each call returns a new typed scorer | A rubric is data plus judge prompts, not a bespoke script |
| EV-02 | Built-in scorer catalogue | implemented | `packages/evals/src/scorers/prebuilt/index.ts:1` | LLM judges cover relevancy, faithfulness, context precision and recall, hallucination, bias, toxicity, rubric, trajectory and more; code scorers cover similarity, keywords, tone and tool-call accuracy | Teams start from a validated rubric |
| EV-03 | Sampling and declarative filters | implemented | `packages/core/src/evals/base.ts:2014`, `:2022` | A scorer entry carries a sampling config and a predicate that decides whether a run is scored at all | Judging every run is too expensive |
| EV-04 | Scorers on agents and steps | implemented | `packages/core/src/agent/agent.types.ts:715` | Agent options accept a scorer map; workflow steps accept scorers too | Score production traffic and individual steps |
| EV-05 | Batch evaluation with gates | implemented | `packages/core/src/evals/run/index.ts:231`, `:317` | `runEvals` takes data items, scorers, optional gates that must score 1.0, concurrency and a per-item callback | Turn a dataset into a pass or fail signal |
| EV-06 | Datasets and experiments | implemented | `packages/core/src/datasets/dataset.ts:44`; `packages/core/src/datasets/experiment/analytics/compare.ts:55` | A dataset holds versioned items; an experiment runs a target over them, stores scores and compares two experiments | Regression tracking across prompt and model changes |
| EV-07 | CI gating and judge cost tracking | declared | https://mastra.ai/docs/evals/gates-and-verdicts and https://mastra.ai/docs/evals/running-in-ci (read 2026-10-21) | Gates and verdicts are documented as a CI contract; judge calls are metered through the model layer | Makes evaluation a release gate rather than a dashboard |
| EV-08 | Judge calls metered like model calls | declared | `packages/core/src/evals/base.ts:384`; https://mastra.ai/docs/evals/custom-scorers (read 2026-10-21) | A prompt step names a judge model, so judge usage runs through the model layer and can be traced and priced like any other call | A judge is a model call and should be budgeted as one |

## MCP server

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MS-01 | Convert tools, agents and workflows into MCP tools | implemented | `packages/mcp/src/server/server.ts:93`; `packages/mcp/src/server/server.ts:374` | A config names tool sets, agents and workflows; agents become tools whose name is derived from a key, and resume schemas must be form-representable | Publish an existing agent surface without writing a protocol layer |
| MS-02 | Authorized listing and per-round authorization | implemented | `packages/mcp/src/server/server.ts:829`, `:850` | `tools/list` returns only entries the principal may see; `tools/call` re-checks permission on every round | Tool visibility and execution permission can differ |
| MS-03 | Protocol-correct tool results | implemented | `packages/mcp/src/server/server.ts:946`, `:962`, `:1446` | Validation failures return `isError`; a tool with an output schema returns `structuredContent`; unknown tools return an error result | Clients can distinguish a tool error from a protocol error |
| MS-04 | Continuation when input is required | implemented | `packages/mcp/src/server/server.ts:761`, `:781`, `:793` | A suspension becomes one keyed elicitation form derived from the resume schema; a signed state envelope carries method, name, argument hash, round, suspend payload, principal and issue time | A server can ask a client for missing input mid-call without losing its place |
| MS-05 | Continuation validation | implemented | `packages/mcp/src/server/server.ts:809` | Resume data is validated against the same schema; a mismatch is a protocol `InvalidParams` error | A client cannot smuggle a different payload |
| MS-06 | Transports with network checks | implemented | `packages/mcp/src/server/server.ts:1206`, `:1224`, `:1194` | stdio uses the SDK's `serveStdio` with legacy sessions rejected; Streamable HTTP adds path, host and origin validation | Local and remote clients without a bespoke HTTP layer |
| MS-07 | Capabilities and extensions | implemented | `packages/mcp/src/server/server.ts:181`, `:526`, `:538` | Reports tools, resources, prompts, logging and two extensions: MCP Apps UI resources and an events extension | Clients negotiate what the server can do |
| MS-08 | OAuth server middleware | declared | `packages/mcp/src/server/oauth-middleware.ts` | Middleware validates bearer tokens and exposes auth info to tool execution | Hosted servers need a standard auth path |
| MS-09 | Signing-key configuration for continuations | implemented | `packages/mcp/src/server/server.ts:251`, `:259` | The state codec gets a key and TTL from config; the default is a per-process key with a warning | Prevents a silent failure when several instances serve one deployment |

## Processors and guardrails

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PR-01 | A wide processor hook surface | implemented | `packages/core/src/processors/index.ts:681` to `:862` | Input, input step, LLM request, LLM response, output stream, output step, tool result, output result and API error hooks, plus state signals, a state lane, an order index and registration | One seam for safety, memory, caching, retries and output shaping |
| PR-02 | Runner semantics | implemented | `packages/core/src/processors/runner.ts:63`, `:633` | Processors run in order; `abort()` throws a `TripWire`; violations invoke `onViolation` unless the path is documented as silent | Consistent failure and telemetry behaviour across processors |
| PR-03 | Retry budget | implemented | `packages/core/src/processors/retry-budget.ts:20`, `:54` | Three retries by default, one message per agent when the safety cap applies | Bounds a retry dialogue between processors |
| PR-04 | Default stability error processors | implemented | `packages/core/src/processors/stability-defaults.ts:64`, `:143`, `:147` | Four processors in a load-bearing order repair malformed history, prefill errors, unsupported files and transport resets; ECONNRESET backs off from one second, Gemini malformed calls from half a second; bad-request retry is opt-in | Transient provider failures are the normal case in production |
| PR-05 | Tripwire with retry as feedback | implemented | `packages/core/src/agent/trip-wire.ts:16`, `:35`, `:75` | A tripwire carries `retry` and typed metadata; the loop can retry with the reason as a user-visible message instead of failing | Structured-output and safety failures become a correction round |
| PR-06 | Built-in guardrails | implemented | `packages/core/src/processors/processors/` | Classifier, moderation, PII, prompt-injection, system-prompt scrubber, regex filter, unicode normaliser, token limiter, batch parts, token cost control, response cache, tool search, file upload | Ship safety and cost controls as configuration |
| PR-07 | Model-backed guardrail error strategy | implemented | `packages/core/src/processors/processors/classifier.ts:105`; https://mastra.ai/docs/agents/guardrails (read 2026-10-21) | `strict` fails closed when the guardrail model fails; `warn` logs and passes content | An unavailable safety model must not silently allow content |
| PR-08 | State-signal delivery | implemented | `packages/core/src/processors/index.ts:742`, `:751` | Processors can compute a signal per state lane instead of editing messages; working memory uses this to switch delivery modes | Cleanly separates context data from message history |
| PR-09 | Processor composition as workflows | declared | https://mastra.ai/docs/agents/processors (read 2026-10-21) | A workflow of processors runs them sequentially, in parallel, then maps the branch whose mutated messages should survive | Parallel guardrails and ordered redaction in one graph |
| PR-10 | Processor spans | implemented | `packages/core/src/processors/index.ts:651`, `:663`, `:677` | Each hook can declare a span type, a span name and attributes; the runner opens the span around the processor call | Guardrail latency and decisions appear in traces |

## Notable implementation notes

- The loop persists state only for resumable statuses, and prunes on the way out; the
  persistence predicate is a constructor option of both engines, which is how an agent run
  and a user workflow can share one executor with different retention.
- A tool call's suspension payload is not a bespoke type per feature. Approval and tool
  suspension share a record shape that names the tool, its run id, its resume schema and
  its pending state, and the step code writes both under one of two metadata keys
  (`packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:202`).
- Memory's processor provider is the clearest example of the feature-as-processor policy:
  it deduplicates by processor id, throws typed configuration errors when a required adapter
  is missing, and can hand working memory over to a state signal instead of a system message
  (`packages/core/src/memory/memory.ts:778` to `:1004`).
- The observational-memory subsystem is large enough to be its own product: buffering
  coordinator, observer and reflector agents, temporal markers, token counting, extraction
  and knowledge tools, a pinned-state processor and resource-scoped strategies, all under
  `packages/memory/src/processors/observational-memory/`.
- Evals are not a separate runtime. Scorer entries are sampling plus a predicate, and the
  same scorer type can gate a loop iteration or a CI batch, which is why gates and
  task-completion checks reuse one contract.
- The MCP server treats a suspension as a protocol-level continuation: the envelope is
  signed, bound to an argument hash and a round, and re-authorized on every round, so a
  resumed call is a new authorized request rather than an extension of trust.
- Guardrail composition is documented as a workflow of processors, and the documentation
  warns about ordering: cheap limiters run before batching, and redaction chains stay
  sequential so a later stage sees the earlier stage's output.
- Network multi-agent coordination is deprecated in favour of supervisor agents, and the
  source still carries the network workflow implementation for compatibility, with an
  explicit error for observational memory because the network does not propagate the
  thread identity that memory requires (`packages/core/src/loop/network/index.ts:59`).
- The default error processors are ordered deliberately: repair processors run before the
  transport retry processor because error processors short-circuit on the first retry
  verdict (`packages/core/src/processors/stability-defaults.ts:64`).
- The processor directory also holds provider-compatibility work that no user configures:
  history repair (`packages/core/src/processors/provider-history-compat.ts`), prefill error
  handling, unsupported-file handling and a trailing-assistant guard. This is where model
  adapter quirks are repaired centrally; the surrounding behaviour is inferred from the
  file names and their size, not from a traced path.
- A suspended tool call and a suspended user workflow are the same suspension: the tool-call
  step is an ordinary step that returns `suspend()` with a resume schema, and the agent
  stream resumes it through the same run API as any workflow (`packages/core/src/workflows/workflow.ts:4860`).
- Documentation and source diverge on multi-agent coordination: the published page marks
  networks deprecated, while `packages/core/src/loop/network/index.ts` still builds and
  maintains the network workflow. This is a deliberate compatibility window, and the
  divergence is reported rather than resolved here.

## Coverage of this inventory

Rows cover the six focus areas of the dive: agents and delegation, workflows and durability,
memory, evaluation, MCP server authoring, and processors and guardrails. The repository also
ships deployment, Studio, sandbox, harness and connections areas; those were located in the
documentation tree but not read, and they are outside both the focus and the licence-scoped
tree this dive covers.
