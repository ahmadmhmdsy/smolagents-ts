# strands-agents/harness-sdk — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Every row cites the clone at `79e0f89`; `implemented` means the path was traced end to end,
`declared` means a doc, type or flag claims it without a traced path, and `inferred` is
reasoned from structure. The subject is the TypeScript SDK unless the row says otherwise.

## The loop and its lifecycle controls

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| LC-01 | model-driven tool loop | implemented | `strands-ts/src/agent/agent.ts:1705-1715`, `:1773` | One `while (true)` cycles model call, tool execution and message append; each turn is one model call plus the tools it requests, and the loop exits when the model stops asking for tools | The core product: the caller supplies a prompt, not a control flow |
| LC-02 | closed stop-reason vocabulary | implemented | `strands-ts/src/types/messages.ts:710-726` | 15 named reasons cover completion, tool use, all three limits, cancellation, interrupt, checkpoint, provider caps, refusal, content filtering, guardrail intervention, pause and context overflow; the union still admits `string & {}` for unknown provider values | A run's ending must be inspectable without reading the loop |
| LC-03 | turn and token budgets | implemented | `strands-ts/src/types/agent.ts:182-191`; checked at `strands-ts/src/agent/agent.ts:1708` | `limits.turns`, `limits.outputTokens` and `limits.totalTokens` are optional; each is checked before a turn, so the previous turn's tools finish; priority is turns, then total, then output (`strands-ts/src/types/agent.ts:167-169`) | Unbounded loops and token spend are the two incidents every operator has |
| LC-04 | request-scoped usage that nested calls share | implemented | `strands-ts/src/agent/invocation-context.ts:44-112`; `strands-ts/src/models/model-proxy.ts:6-13` | An `InvocationContext` carries limits and usage; child agents, graphs, swarms and auxiliary calls add to the same counters, and the model proxy is the single accounting gate | Budget enforcement is meaningless if a subagent can spend outside it |
| LC-05 | continuation across calls | implemented | `strands-ts/src/types/agent.ts:143-171`, `:480` | Passing `result.invocationContext` to a later call continues on the same counters; a nested call may add stricter limits of its own | A chat turn and a resumed job are the same budget |
| LC-06 | cooperative cancellation | implemented | `strands-ts/src/agent/agent.ts:1120`, `:1706`, `:1811`, `:1977-1997`; `strands-ts/src/types/agent.ts:110-138` | `agent.cancel()` and an external `AbortSignal` are composed; the signal is checked at cycle top, during streaming and before tools; a cancelled run returns `stopReason: 'cancelled'` and pending tool calls get error results | A client disconnect must stop token spend immediately |
| LC-07 | interrupt and resume with a human value | implemented | `strands-ts/src/interrupt.ts:4-23`; `strands-ts/src/agent/agent.ts:1999-2012` | `event.interrupt()` or `ToolContext.interrupt()` halts with `stopReason: 'interrupt'`, registers an `Interrupt` with a source, and resumes when the next invocation carries `InterruptResponseContent` | Approval and clarification are pauses, not errors |
| LC-08 | checkpoint at cycle boundaries | implemented, experimental | `strands-ts/src/experimental/checkpoint.ts:7-41`; `strands-ts/src/agent/agent.ts:1841-1858` | With `checkpointing: true` the loop pauses after the model or after the tools and returns `stopReason: 'checkpoint'` plus a serializable `Checkpoint`; resume passes it back and skips completed work | Long jobs need a restart point that is not a re-run |
| LC-09 | history left reinvokable | implemented | `strands-ts/src/agent/agent.ts:1198-1201`, `:1898` | Assistant tool-use messages are appended only after valid results exist, so history never holds a dangling tool use, and any stop can be followed by another prompt | A halted run must be resumable by the caller with a new message |
| LC-10 | background tool execution | declared | `strands-ts/src/background-tasks/types.ts:8-20`; `strands-ts/src/agent/agent.ts:245` | `backgroundTasks` selects tools by name or lets the model choose; a task manager queues, runs with concurrency caps and returns results into the next turn | Slow tools should not block the loop |
| LC-11 | retry policy for model calls | implemented | `strands-ts/src/retry/default-model-retry-strategy.ts:1-19`; `strands-ts/src/hooks/events.ts:503-518` | A retry strategy inspects the failure, returns a decision, and the loop re-invokes the model; default is six attempts with exponential backoff over throttling | Throttling is routine, not exceptional |
| LC-12 | pause for long-running turns | implemented | `strands-ts/src/types/messages.ts:704` | `pauseTurn` is a provider stop reason that ends the run with the response to send back, without treating it as an error | Some providers ship a turn in pieces |

## Streaming and events

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EV-01 | typed agent stream | implemented | `strands-ts/src/hooks/index.ts:14-34`; `strands-ts/src/agent/agent.ts:1217-1222` | `stream()` is an async generator that yields a discriminated union of 17 event classes and returns the final `AgentResult`; `invoke()` drains the same generator | A renderer needs partial output, not a final object |
| EV-02 | model-level streaming events | implemented | `strands-ts/src/models/streaming.ts:66-344` | Providers emit message start, block start, delta, block stop, message stop, metadata and redaction events; the agent wraps them into its own stream events | Provider deltas are the finest granularity a UI can use |
| EV-03 | events double as hooks | implemented | `strands-ts/src/hooks/index.ts:1-11` | Every event extends `HookableEvent`, so the same object a consumer receives from `stream()` can be subscribed to by type through `addHook` | One taxonomy instead of two parallel observation APIs |
| EV-04 | local execution traces | implemented | `strands-ts/src/telemetry/tracer.ts:10-13`; `strands-ts/src/types/agent.ts:453-457` | A lightweight span tree is collected whether or not telemetry is configured and returned on `AgentResult.traces` | Debugging should not require an exporter |

## Tools

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TO-01 | generator-based tool contract | implemented | `strands-ts/src/tools/tool.ts:96-163` | `Tool.stream()` yields progress events and returns exactly one `ToolResultBlock`, so a long tool reports intermediate state and one final answer | A tool call is an operation with progress, not a function call |
| TO-02 | Zod and JSON Schema factories | implemented | `strands-ts/src/tools/tool-factory.ts:26-45`; `strands-ts/src/tools/zod-tool.ts:93-106` | `tool()` picks the implementation by schema type; Zod is converted to JSON Schema for the model and parsed on the way in | The model contract is JSON Schema, the author contract is Zod |
| TO-03 | tool context bundle | implemented | `strands-ts/src/tools/tool.ts:14-43` | A tool receives its `toolUse`, the agent, per-invocation state, its cancel signal and the request context, and may raise an interrupt | A tool needs the run, not just its arguments |
| TO-04 | spec and annotations | implemented | `strands-ts/src/tools/types.ts:13-43` | `ToolSpec` carries name, description, optional input and output schemas and an annotation bag; name rules are enforced at `tool.ts:213-225` | Provider APIs constrain names and accept hint metadata |
| TO-05 | registry with name normalisation | implemented | `strands-ts/src/registry/tool-registry.ts:73` | Lookup tolerates underscore-to-hyphen and case differences before failing | Models emit near-miss names |
| TO-06 | concurrent execution by default | implemented | `strands-ts/src/tools/executors/concurrent.ts:29-33`; `strands-ts/src/agent/agent.ts:156` | Parallel tool calls race per-tool generators, interleave events, keep each tool's order and isolate one failure from its siblings; an interrupt is deferred until siblings finish (`:76-101`) | Tool calls are independent and latency matters |
| TO-07 | direct tool invocation | implemented | `strands-ts/src/agent/agent.ts:1065-1078` | `agent.tool.<name>.invoke()` and `.stream()` call a registered tool with the same machinery, outside a turn | Testing and scripting reuse one path |
| TO-08 | structured output as a tool | implemented | `strands-ts/src/tools/structured-output-tool.ts:9-16`; `strands-ts/src/agent/agent.ts:1778-1790` | A hidden tool validates the model's arguments against the caller's Zod schema, returns a validation error the model can repair, and is forced by `toolChoice` | Structured output needs a retry path, not a single parse |
| TO-09 | typed tool results | implemented | `strands-ts/src/tools/types.ts:7`; `strands-ts/src/tools/tool.ts:201-211` | Every result is a `ToolResultBlock` with a success or error status; a thrown error becomes an error result with the original error attached | The model and the hooks need the same shape |
| TO-10 | vended tools | implemented | `strands-ts/src/vended-tools/index.ts:26-37` | Twelve ready-made tools ship as subpath exports, including shell, file editor, notebook, HTTP, web fetch, sleep, subagent and swarm | A capable default beats a blank toolbox |

## Extension surfaces

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EX-01 | hook bus over lifecycle events | implemented | `strands-ts/src/hooks/registry.ts:38`; `strands-ts/src/hooks/index.ts:14-34` | Callers subscribe to a class; callbacks run in registration order, with reverse order for `After*` events, and may mutate the event or request a retry | Observation and interception share one mechanism |
| EX-02 | mutable control fields on events | implemented | `strands-ts/src/hooks/events.ts:274-290`, `:503-518` | A before-tool hook may cancel, rewrite the tool use, or replace the tool with `selectedTool`; an after-model hook may set `retry`; interrupts are available on both | Hooks can steer the run without owning it |
| EX-03 | middleware stages | implemented | `strands-ts/src/middleware/stages.ts:76`, `:120`, `:149`; `strands-ts/src/middleware/README.md:3-45` | Three stages (invoke model, execute tool, agent stream) each expose input, output and wrap phases; the first registered is outermost, and hooks fire outside the chain so retries are invisible to them | Cross-cutting behaviour needs composition and short-circuiting |
| EX-04 | policy interventions | implemented | `strands-ts/src/interventions/handler.ts:12-66` | A handler overrides before or after invocation, tool and model methods and returns proceed, deny, guide, confirm or transform; a throwing handler defaults to throw, with `deny` available as fail-closed | Authorisation is a policy question, not a middleware concern |
| EX-05 | plugins | implemented | `strands-ts/src/plugins/plugin.ts:51-77` | A plugin has a name, an `initAgent` that registers hooks and middleware, and optional tools returned by `getTools` | Distribution unit above individual hooks |
| EX-06 | lifecycle observers | implemented | `strands-ts/src/types/lifecycle-observer.ts:9-20` | An observer receives the agent instance at initialisation and can attach its own instrumentation | Vendor integrations should not import the SDK internals |
| EX-07 | vended plugins | implemented | `strands-ts/src/vended-plugins/index.ts:10-13` | Four bundled behaviours ship in the tree: context injector, context offloader, goal loop and skills | The common extensions are the documentation |

## Sessions and state

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SS-01 | session manager with two snapshot kinds | implemented | `strands-ts/src/session/session-manager.ts:29-60` | `snapshot_latest` is a single mutable record for resume, and immutable snapshots with UUID v7 ids are appended when a caller trigger fires | Crash recovery and time travel are different needs |
| SS-02 | configurable save cadence | implemented | `strands-ts/src/session/session-manager.ts:50`, `:60` | Agents save per invocation, per message or per trigger; multi-agent orchestrators save per node or per invocation | Durability is a cost the caller should choose |
| SS-03 | versioned snapshot schema | implemented | `strands-ts/src/types/snapshot.ts:10-31`; `strands-ts/src/agent/snapshot.ts:22-30` | `SNAPSHOT_SCHEMA_VERSION` is `1.0`, `scope` separates agent from orchestrator, and the payload is split into framework data and untouched `appData` | Stored state outlives the process that wrote it |
| SS-04 | selectable snapshot fields | implemented | `strands-ts/src/agent/snapshot.ts:22-74` | A preset, include and exclude list choose among messages, state, system prompt, model state and interrupts; `session` is the full preset | A UI may want history without provider state |
| SS-05 | three storage backends | implemented | `strands-ts/src/storage/in-memory-storage.ts`, `local-file-storage.ts`, `s3-storage.ts` | A namespaced storage interface has in-memory, local-file and S3 implementations, and the session layer adapts them to snapshots | Local development and production should differ only in config |
| SS-06 | three kinds of state | implemented | `strands-ts/src/tools/tool.ts:27-36`; `strands-ts/src/types/agent.ts:104-110` | `appState` is durable JSON, `invocationState` is caller-owned and ephemeral, `modelState` holds provider state such as a response id | State lifetime is explicit rather than one bag |
| SS-07 | conversation history management | implemented | `strands-ts/src/conversation-manager/sliding-window-conversation-manager.ts:1` | Sliding-window compression with pinning and tool-pair repair keeps history under the context window | Long conversations overflow |

## Models

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MD-01 | narrow provider contract | implemented | `strands-ts/src/models/model.ts:312-359` | Six operations: update config, get config, model id, stateful flag, stream and token count; `streamAggregated` builds a message on top | A provider should implement streaming, not the loop |
| MD-02 | five provider families plus a router | implemented | `strands-ts/package.json:27-51` | Subpath exports for Anthropic, OpenAI, Bedrock, Google, Vercel and routing; OpenAI has chat, responses and mantle surfaces | Adoption depends on the model the caller already pays for |
| MD-03 | server-side stateful models | implemented | `strands-ts/src/models/model.ts:335-349` | A provider declares `stateful`; the loop then sends only the newest message and clears local history after each call | Some APIs keep the conversation for you |
| MD-04 | model router | implemented, provisional | `strands-ts/src/models/routing/router.ts:1-23` | A routing strategy selects among candidates before the first call and after unclaimed failures; each failure round uses a candidate once | Multi-model fallback belongs above providers |
| MD-05 | retry and backoff | implemented | `strands-ts/src/retry/default-model-retry-strategy.ts:4-19` | Retryable failures are classified, delay is computed by a backoff strategy, and the loop re-invokes through the after-model hook | Vendor throttling is expected |
| MD-06 | token counting before a call | declared | `strands-ts/src/models/model.ts:361-370` | The base class estimates with a character heuristic and providers may override with a native counting API; the context manager consumes it | Compression must trigger before overflow |

## Orchestration and multi-agent

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| MA-01 | graph orchestration | implemented | `strands-ts/src/multiagent/graph.ts:63`, `:114-128`, `nodes.ts:450` | Nodes are agents, orchestrators or custom node classes sharing one invocation state; edges are declared, and `maxSteps` bounds execution. The file documents where its semantics differ from Python | Explicit topology is easier to reason about than emergent delegation |
| MA-02 | swarm orchestration | implemented | `strands-ts/src/multiagent/swarm.ts:48`, `:118-120`, `:148` | Agents hand off to each other, and the run ends when a node reports a completion that is not interrupted; one `maxSteps` replaces Python's two separate caps | Handoff is the minimal multi-agent pattern |
| MA-03 | agent-to-agent protocol | implemented | `strands-ts/src/a2a/a2a-agent.ts:54`, `express-server.ts` | An `A2AAgent` is an agent implementation that proxies to a remote peer, and an Express server exposes one | Remote agents should look local |
| MA-04 | agents and swarms as tools | implemented | `strands-ts/src/vended-tools/subagent/index.ts`, `strands-ts/src/vended-tools/swarm/index.ts` | The model sees a subagent or a swarm as an ordinary tool; the orchestrator runs inside the call | Delegation is just a tool call |
| MA-05 | orchestrator limits and snapshots | implemented | `strands-ts/src/multiagent/graph.ts:168-175`, `:853`; `strands-ts/src/multiagent/snapshot.ts:39` | `maxSteps` and a timeout bound a graph, with a warning when neither is set; orchestrator state snapshots through the same session manager | A topology can loop as easily as a prompt can |

## Context, memory and policy

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CM-01 | context offload strategies | implemented, experimental | `strands-ts/src/context-manager/presets.ts:21-31` | Named presets summarise, truncate tool output, protect against overflow or drop stale results; raw strategies exist for pinned configurations | Presets are a stable contract, their expansion is not |
| CM-02 | agentic compression | implemented, experimental | `strands-ts/src/context-manager/modes/agentic/agentic-context.ts:1-5` | The model is given tools to compress or retrieve its own history, with auxiliary model calls counted against the request | Compaction is a judgement call the model can make |
| CM-03 | memory manager | implemented | `strands-ts/src/memory/memory-manager.ts:1-26` | A plugin extracts durable memories from messages, injects them on later turns and can expose add and search tools | Facts should outlive the conversation |
| CM-04 | shipped memory stores | implemented | `strands-ts/src/vended-memory-stores/file-memory-store/store.ts:156` | File, Bedrock knowledge base and test store implementations behind one interface | Memory is storage plus retrieval, not a new subsystem |
| GR-01 | guardrail and redaction plumbing | implemented, provider-dependent | `strands-ts/src/models/streaming.ts:344`; `strands-ts/src/models/model.ts:296-300` | A provider may report a redaction on input or output, and a guardrail stop reason ends the run with `guardrailIntervened` | Safety verdicts arrive from the provider, not the loop |
| GR-02 | policy engines as interventions | implemented | `strands-ts/src/vended-interventions/cedar/index.ts:1`, `hitl/`, `steering/` | Cedar authorisation, a human-in-the-loop approval and steering each ship as an intervention handler | Policy languages plug in without changing the loop |

## Packaging and quality

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PK-01 | npm workspace and subpath exports | implemented | `package.json:8-10`; `strands-ts/package.json:27-51` | One workspace package with a barrel plus per-subsystem subpaths, so a consumer does not pull every provider | Install weight matters |
| PK-02 | a TypeScript-only CLI | implemented | `strands-cli/package.json:2-20` | The CLI ships a terminal UI and a Python sidecar for voice (`:13`), and no Python CLI package appears in the tree | One tooling surface follows the language with the richer runtime |
| PK-03 | composed harness over the SDK | implemented | `harness-ts/package.json:3` | `@strands-agents/harness` exposes `createHarness()` as a thin composition of SDK pieces, versioned separately | A batteries-included entry point beside the primitives |
| PK-04 | test and gate stack | implemented | `strands-ts/package.json:221-235` | Vitest suites run in Node and in a browser, with coverage, lint, format and type-check gates plus a cognitive-complexity check | Browser support is a promise that needs tests |
| PK-05 | documentation site | declared | `strands-ts/README.md`, `site/` | An Astro site with per-page source links builds from the tree (`AGENTS.md`, doc sourceLinks section); pages were not fetched | Docs co-located with code rot less |

## Notable implementation notes

- The README advertises evals and an evals SDK (`README.md:39`), but no evals module exists under
  `strands-ts/src`; the capability is Python-side. Treat the README list as product-wide and the
  tree as per-language, which is inferred from the directory listing.
- The loop's deferred append is the subtlest design decision in the file. It buys reinvokable
  history and costs it back at checkpoint resume: the `afterModel` checkpoint re-invokes the
  model because the assistant message was never persisted, and the checkpoint doc names the
  Python SDK as the opposite choice (`strands-ts/src/experimental/checkpoint.ts:34-41`).
- Three interception layers coexist and the middleware README admits the tension: middleware is
  designed to supersede hooks eventually, while hooks remain the documented place for retries and
  telemetry (`strands-ts/src/middleware/README.md:3-22`).
- Concurrency is not a flag on a loop: it is an executor strategy object, and the concurrent one
  is the default because tool calls are independent by contract (`strands-ts/src/agent/agent.ts:305-306`).
- The Graph file documents its divergences from Python inline, including inverted limit and
  failure behaviour (`strands-ts/src/multiagent/graph.ts:114-128`), which is a parity practice
  worth copying whatever else is not.
