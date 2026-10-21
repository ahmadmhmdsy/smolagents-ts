# openai-agents-js — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Rows are bucketed against the capability baseline measured 2026-10-21 at `59b295f` (`docs/research/competitors/_synthesis/00-our-baseline.md`). A row names the baseline id it extends, what matching would mean for us, the seam a change would land behind, and an effort from the method's scale. Neighbour evidence is cited relative to `reference/competitors/openai-agents-js/`.

## Bucket A — roadmap follow-ons

These extend a seam we already ship in the S7 to S11 spirit. They are priced, not committed.

| gap | neighbour evidence | baseline | what matching means | seam | effort |
|---|---|---|---|---|---|
| transfer action | `handoff.ts:160`, `:230`; `runner/toolExecution.ts:2741` | `MA-02` | the model chooses between calling a child and handing control over; the receiving agent continues the same history | the interpreted-action path in `packages/core/src/agent/multi-step-agent.ts` | M |
| typed child result | `agent.ts:1042` to `:1080` | `MA-03` | a managed agent declares a structured output schema and the caller gets a validated object, not a string | `managed-agent.ts:53` output schema | M |
| approval as durable state | `runState.ts:3090`, `:3218` | `HL-02` | a run suspends with pending items, serializes, and resumes when a human decides | the approval seam plus `RunStore` | M |
| shipped durable stores | `examples/memory/sessions/file.ts`, `examples/memory/sessions/prisma.ts` | `HL-09` | a file or SQLite store ships as a package with a conformance test, not as a sample | `packages/core/src/session/run-store.ts` | M |
| checkpoint versioning | `runState.ts:195` to `:221`, `:3544` | `HL-10` | every persisted step document names a schema version and an unknown one fails with repair advice | the step serialization envelope | M |
| exporter seam | `tracing/processor.ts:67`, `:124` | `OB-07` | a caller plugs in an exporter behind our trace builder instead of copying spans out of a listener | `buildTrace` in `packages/core/src/monitoring/trace.ts` | M |
| concurrent guardrails | `guardrail.ts:78`; `runner/guardrails.ts:171` | `GR-03` | blocking checks are awaited while the rest overlap the model call, with one settle point before commit | the guardrail seam in `packages/core/src/agent/guardrail.ts` | S |
| per-tool timeout and error text | `tool.ts:2324`, `:2472` | `TL-05` | one tool can time out or fail without ending the run, and its error is visible to the model | `tool()` in `packages/core/src/tool/tool.ts` | S |
| tool output validation | `tool.ts:2225`, `:2361` | `GR-02` | a structured tool result is validated at the boundary rather than trusted into the loop | `tool()` | S |
| wider structured-output seam | `utils/tools.ts:109` | `GR-05` | Standard Schema and JSON Schema reach the provider's structured-output mode, not just Zod | the model capability seam | M |

## Bucket B — non-goals

Recorded because a neighbour ships them; decision 0018 keeps them out unless a user asks and a seam can host them.

| gap | neighbour evidence | baseline | position |
|---|---|---|---|
| workspace sandbox with filesystem and shell | `packages/agents-core/src/sandbox/`; README quickstart for sandbox agents | `EX-05` | their sandbox is a product surface with provider clients; ours is a decision not to own a workspace |
| realtime and voice | `packages/agents-realtime/` | not in the baseline | device and transport work with no overlap with a text runtime |
| provider-hosted tools | `packages/agents-openai/src/tools.ts` | `TL-07` | web search, file search and computer use execute at the provider; copying the factory without the service is meaningless |
| MCP server authoring | no server package | `MC-07` | we consume MCP servers; authoring one is a separate product |
| streaming UI transport | `events.ts:80` is a stream, not a wire protocol | `UI-06` | a chat protocol is deployment surface, excluded by decision 0018 |
| multimodal input | `types/protocol.ts` input image and file items | `MD-04` | the executor and browser core make image pipelines a different design problem |
| dev UI or studio | none shipped | not in the baseline | examples and a React layer cover our inspector needs |

## Bucket C — unconsidered

Vocabulary absent from our design documents. These are the cheapest findings to act on because most are conventions rather than products.

| pattern | neighbour evidence | baseline | what it is, and why it matters | seam | effort |
|---|---|---|---|---|---|
| capability interfaces over one fat store | `memory/session.ts:265` to `:303` | `HL-04` | history storage stays a small interface and richer behaviour is opt-in, so a plain store keeps working as the runner grows | `AgentSession` and `RunStore` | M |
| history write transactions | `memory/memorySession.ts:115` to `:156` | `HL-03`, `HL-09` | a write carries an operation id and, for rewrites, the suffix it expects; a retried or conflicting write fails instead of duplicating | `RunStore` append path | M |
| compaction as a decorator | `openaiResponsesCompactionSession.ts:131`, `:187` | `HL-08` | a session wrapper replaces old history with a summary when a threshold is crossed, without the agent knowing | session decorator beside `AgentSession` | L |
| ownership matrix for conversation state | `run.ts:462` to `:471`, `:338` | `HL-04`, `HL-08` | exactly one of five strategies owns history, and invalid combinations are refused up front rather than reconciled later | documented option validation | S |
| stop policies for tool results | `agent.ts:617`; `toolExecution.ts:2928` | `RT-02` | whether a tool result ends the run is configuration, which lets one agent serve several product shapes | agent options and the tool-calling loop | S |
| event-emitter hooks per agent and per run | `lifecycle.ts:101`, `:173` | `RT-09` | five named moments on two objects give a host observability without parsing the event stream | `packages/core/src/events.ts` surface | S |
| raw provider events with a typed source | `events.ts:18`; `rawModelEvents.ts:9` | `RT-05`, `RT-09` | unnormalised provider chunks reach the consumer with a discriminant, so a UI can use fields the SDK does not model | the streamed event union | S |
| approval fingerprints | `runContext.ts:405` to `:451` | `HL-01` | an approval binds to the arguments it approved, which blocks the replay a queue would otherwise permit | the approval record | S |
| admitted-turn accounting | `run.ts:545`; `result.ts:339` | `RT-06` | a turn denied by a limit or a guardrail is not charged, so resume counts stay honest | the loop budget | S |
| bounded forwarding for nested streams | `result.ts:470` to `:487`; `agent.ts:990` | `MA-01` | a child cannot outrun its parent consumer because the pending queue has a ceiling and reports overflow | the managed-agent tool call | S |
| telemetry switches per run | `run.ts:356` to `:363`, `:390` | `OB-02` | traces can carry structure while prompts stay out, and credentials can differ per run | the trace builder | S |
| bounded or unbounded budget | `run.ts:467` | `RT-06` | a null budget is a deliberate host decision, distinct from a default that a caller forgot to raise | loop budget | S |
| explicit missing-tool policy | `run.ts:416` | `TL-06` | a model that calls an unknown tool either fails the run or receives an error it can recover from | tool resolution | S |
| collision policy for tool names | `run.ts:426` | `TL-02` | duplicate names are a registration problem, so the runtime can refuse before spending a model call | tool registry | S |
| reasoning-id replay policy | `run.ts:456` | `RT-05` | some providers reject replayed reasoning ids, so the policy belongs to the run rather than to one adapter | model request assembly | S |
| placeholder text for blocked output | `run.ts:451` | `GR-01` | what a session stores after a rejection is a policy decision, not an accident of a stack trace | output guardrail path | S |

## Bucket D — depth gaps

We ship the capability, more thinly than the neighbour.

| gap | neighbour evidence | baseline | what deeper means | effort |
|---|---|---|---|---|
| guardrails run one after another at a single point | `guardrail.ts:78`; `runner/guardrails.ts:171`, `:2129` | `GR-01` | overlap independent checks with the model call and settle them before any write | M |
| a checkpoint is a step array, not a commit boundary | `run.ts:2155`; `memory/memorySession.ts:115` | `HL-03` | writes are prepared, ordered and committed with the step so a failure cannot leave a half-turn | M |
| resume works in one process only | `runState.ts:3504`; `:196` | `HL-04` | a resumed run rebuilds the agent graph, approvals and pending input from a versioned document | L |
| a trace is a flat fold | `spans.ts:142`; `provider.ts:224` | `OB-01` | a span tree with per-turn and per-task usage instead of a list a consumer re-parents | M |
| span attributes are minimal | `spans.ts:14` to `:107` | `OB-03` | model, tokens, tool input and output, and guardrail outcome on the span that owns them | S |
| the event stream ends at four terminal shapes | `events.ts:36`, `:80` | `RT-09` | item-level events, provider events and an agent-change event, all derivable from one item vocabulary | M |
| tools take Zod only | `utils/tools.ts:109` | `TL-01` | three schema dialects normalise to one strict JSON Schema, so a caller is not forced into one library | S |
| tool-calling loop has fixed stop behaviour | `agent.ts:617` | `RT-02` | stop policies and tool-choice reset are configuration, not caller-side branching | S |

## What we have that they lack

- A model-authored program as the default action space (`RT-01`). Every neighbour action here is a JSON tool call; our loop can run a block of logic in one step.
- An executor capability bag with three shipped backends (`EX-01` to `EX-04`). They ship a sandbox product, but not an interchangeable in-process interpreter.
- A browser-capable core (`DS-01`). Their supported list is Node, Deno, Bun and experimental Workers.
- A run inspector and copy-in React layers (`UI-03`, `UI-04`). Their visual story is the hosted tracing UI, not components.
- An eval scorer and a fixture-shaped expectation (`OB-04`). Their examples run; they do not grade.
- A CLI with a verbosity-aware renderer (`CL-01`, `CL-02`). Their command line is example scripts.
- Middleware around a step (`RT-08`), a seam their loop does not have.

## Patterns worth copying

1. Optional capability interfaces with runtime guards, instead of growing the store interface (`memory/session.ts:265` to `:303`). A plain store stays valid while a richer one advertises what it can do.
2. A tracker that owns background work and is awaited exactly once before commit (`runner/guardrails.ts:30` to `:105`; `run.ts:2129`). Concurrency without scattering joins through the loop.
3. A version ladder with fail-closed parsing and repair advice (`runState.ts:195` to `:221`, `:3544`). Durable data outlives the code that wrote it, so refusal must be legible.
4. Idempotent writes with a precondition instead of a blind append (`memory/memorySession.ts:115` to `:156`). The precondition is what makes a retry safe rather than merely likely.
5. First-transfer-only with the ignored call items removed from history (`runner/toolExecution.ts:2772` to `:2786`). A model that emits two transfers leaves no ghost tool call behind.
6. Typed narrowing of provider events by source (`packages/agents-openai/src/rawModelEvents.ts:9` to `:15`). Rich data for the UI, one stable union for the loop.
7. A batch exporter with a bounded queue, an unref'd timer and a draining shutdown (`tracing/processor.ts:124` to `:356`). Telemetry that neither leaks the process nor loses the last batch.
8. Binding an approval to a fingerprint of the invocation (`runContext.ts:405` to `:451`). Cheap, and it closes the replay hole a resumable queue creates.

## Patterns to avoid

- Import-time global side effects. `@openai/agents` sets a default provider and tracing exporter before user code runs (`packages/agents/src/index.ts:1` to `:8`), which makes network egress and model selection invisible and hard to override in tests.
- One 7,500-line module for durable state. `runState.ts` holds the schema, the guards, approval rehydration and the resume API; a change to one concern is a change to all of them, and the file's size is the reason the compatibility guards multiplied.
- Two public spellings for one decision. `RunState.approve` delegates to `RunContext.approveTool` (`runState.ts:3168`; `runContext.ts:1297`), so a reader must check both to learn what a decision does.
- Documentation that outruns the source. The human-in-the-loop guide describes options and boundaries that this read did not trace to code; treat such sentences as declared until a path is found.
- Analytics on by default. The bundle's exporter is wired at import and only skips when no key is present (`packages/agents-openai/src/openaiTracingExporter.ts:296` to `:302`), so the default posture is egress-when-configured rather than opt-in.

## What it should change for us

1. Approvals as state before anything else (`HL-02`, bucket A, M). Serialize a pending decision into the step document, resume from it, and the CLI can approve from the terminal (`CL-03`) without a new runtime.
2. Version the checkpoint envelope (`HL-10`, A, M) before a second store lands. The neighbour's ladder back to `1.0` is the evidence that a bare step array will not survive one format change.
3. A handoff action behind the interpreter (`MA-02`, A, M) with the neighbour's two rules: first transfer only, and an input filter that cannot coexist with server-owned history.
4. Split the session seam into capability interfaces (`HL-04`, C, M) and add transactional writes (`HL-03`, C, M). This is the cheapest structural import in the whole dive.
5. Parallel guardrails with one settle point (`GR-03`, A, S), reusing the tracker shape rather than inventing a scheduler.
6. An exporter interface behind the trace builder (`OB-07`, A, M) and richer span attributes (`OB-03`, D, S), with telemetry off unless a caller installs an exporter.
7. A typed child result (`MA-03`, A, M) and bounded stream forwarding for managed agents (`MA-01`, C, S).

Do not copy the compaction decorator yet (`HL-08`, C, L): it depends on a provider-side compaction endpoint, and a local summariser is a new subsystem rather than a seam. Record it and revisit when a summariser exists.

## Confidence and use

Effort letters compare neighbours against our seams, not against a measured schedule: an `S` row is a shape we already own, an `M` row adds state or a package, and an `L` row needs a subsystem. Where a row depends on a provider endpoint we do not have, it says so.

The order above is a reading order for design work, not a plan. Two rows are prerequisites for others: checkpoint versioning before any durable store, and the session capability split before transactional writes. Both are cheap and both prevent a rewrite.

Bucket B rows are recorded so a future reviewer does not rediscover them; they are not a to-do list. A bucket C row becomes a task only when a capability on the Now table needs it.

## Cross-dive questions

Three questions are better answered by a second dive than by more reading here:

- How does a graph runtime version a checkpoint when the graph itself changes shape (row for the langgraphjs dive)? This repository versions the snapshot but leaves graph substitution to the caller.
- Does a workflow engine treat guardrails as a step result or as an exception? The distinction decides whether a rejected run can resume (compare the mastra processor pipeline).
- Which exporter convention should our trace builder target: the processor model here, or OpenTelemetry spans? `OB-02` stays open until that is answered, and the generic interface in `tracing/processor.ts:67` is the cheaper first step.

## One correction to record

No error was found in the baseline rows used above. Baseline `RT-05` already states that the source contradicts open task `T-30`, so the action is to close that task rather than to re-open the capability question.