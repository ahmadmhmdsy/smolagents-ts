# openai-agents-js — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Status vocabulary follows the method: `implemented` means the path was traced from a public entry point to the code that acts; `declared` means a type, factory or doc claims it and no path was traced; `inferred` means the row is reasoned from structure and says so. Paths are relative to `reference/competitors/openai-agents-js/`. Documentation citations are URLs, with the date read.

## Turn loop and execution

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| turn loop | implemented | `packages/agents-core/src/run.ts:1655`; step vocabulary at `runner/steps.ts:1` | one model request per turn, then a resolution step; the loop continues on a run-again step, changes agent on a handoff step, or ends on a final-output step |
| turn budget | implemented | `runner/constants.ts:2`; check at `runner/turnPreparation.ts:155`; error at `src/errors.ts:38` | default ten turns; a thrown error rather than a truncated answer, so a caller cannot mistake exhaustion for success |
| admitted-turn accounting | implemented | `run.ts:545`, `:552`; `result.ts:339` | the counter is rolled back when the model request never starts, so a resume does not charge a turn that did no work |
| cancellation | implemented | `run.ts:2181`; combined signals in `agent.ts:917` | caller signal and nested-run signals are combined; abort surfaces as an error, not a partial value |
| streaming and non-streaming parity | implemented | `run.ts:491`, `:504`; two result classes at `result.ts:52`, `:303` | the mode is a discriminated option, and both paths share the same loop and the same step resolution |
| tool-use behaviour | implemented | `agent.ts:617`; resolution at `runner/toolExecution.ts:2928` | four policies decide whether a tool result ends the run: run the model again, stop on the first tool, stop at named tools, or a caller function |
| tool-choice reset | implemented | `agent.ts:618` | a forced tool choice is cleared after a tool call so the model is not trapped into repeating it |
| pre-model input filter | implemented | `run.ts:438` | the host can rewrite instructions or items immediately before the request, which is where redaction and prompt shaping live |
| per-kind error handlers | implemented | `run.ts:485` | a caller can convert a failure into a result without wrapping the whole run in a try block |
| lifecycle hooks | implemented | `lifecycle.ts:101`, `:173` | typed emitters for agent and run events, including tool start and end, on the agent object and on the runner |
| convenience entry point | implemented | `run.ts:599` | a shared default runner so a one-shot script is one call; the class at `:723` is the configurable form |

## Handoffs

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| handoff as a transfer tool | implemented | `handoff.ts:64`, `:160`, `:230`; execution at `runner/toolExecution.ts:2741` | the target agent becomes a model-callable function named `transfer_to_<name>`; the model chooses a transfer in the same way it chooses a tool |
| transfer acknowledgement | implemented | `handoff.ts:52` | the tool output is a small JSON object naming the assistant, which the next agent sees as the trigger of its turn |
| handoff input schema | implemented | `handoff.ts:177` to `:188` | an empty strict object by default; a caller can give the transfer typed arguments, and strict mode is on unless disabled |
| input filter | implemented | `handoff.ts:220`; application at `toolExecution.ts:2839` to `:2861` | the receiving agent can be given a rewritten history; the filter sees prior items, new items and the run context |
| filter and server conversation ids are mutually exclusive | implemented | `run.ts:338`; contract note at `handoff.ts:217` | a rewritten history cannot be reconciled with a server-side conversation, so the combination is refused instead of silently losing items |
| conditional handoff | implemented | `handoff.ts:274` | an async predicate makes a transfer available only for the current run, which supports routing by tenant or state |
| one transfer per turn | implemented | `toolExecution.ts:2772` to `:2786` | when the model asks for several transfers the first wins, and the ignored call items are removed so they never persist to history |
| handoff observability | implemented | `events.ts:68`; `toolExecution.ts:2834` | an agent-updated stream event plus both hook emitters, so a UI can repaint the active agent |
| typed output union across handoffs | implemented | `agent.ts:530` | `Agent.create` allows the compiler to union the outputs of reachable agents instead of forcing a cast |

## Agents as tools

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| nested run inside a tool call | implemented | `agent.ts:765` | the tool starts a second `Runner` with its own `RunState`, so the child can use its own model, tools and guardrails |
| forked run context | implemented | `agent.ts:906`; `runContext.ts:1496`, `:1506` | the child shares usage and approval state but can carry its own tool input, which keeps accounting and approvals run-wide |
| resumable nested run | implemented | `agent.ts:917` to `:941` | an interrupted child serializes a resume marker into tool details, so the outer run can pause and later restart the child where it stopped |
| stream forwarding | implemented | `agent.ts:990` to `:1013` | child events are re-emitted on the parent stream with a bounded pending buffer, so a slow consumer cannot grow memory without limit |
| custom result extraction | implemented | `agent.ts:1042` to `:1080` | a caller can turn the child result into a value other than its final text, which is the seam our string-only child result lacks |
| approvals surface on the outer run | implemented | `runState.ts:3112`, `:3118` | a pending child tool run is tracked by agent tool name and call id, so the outer pause can carry it |

## Guardrails

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| input guardrails | implemented | `runner/turnPreparation.ts:281` to `:332` | run on the first turn only, after turn accounting and before the model request; a resumed interruption does not re-run them |
| output guardrails | implemented | `run.ts:1520`, `:1540`; `runner/guardrails.ts:326` | run against the selected final output, not against every model message |
| parallel execution by default | implemented | `guardrail.ts:78`; `runner/guardrails.ts:171` to `:250` | guardrails in a list start together and the run waits once, which keeps latency flat as policy count grows |
| blocking and parallel split | implemented | `runner/turnPreparation.ts:264` | a guardrail that must see the input first is awaited; the rest run alongside the model call |
| tracker awaited before commit | implemented | `runner/guardrails.ts:30` to `:105`; awaits at `run.ts:1911` and `:2129` | a background guardrail can fail after the model answered, so the run must not persist or return until it settles |
| typed tripwire errors | implemented | `runner/guardrails.ts:307`, `:316`; `errors.ts:159` | a triggered tripwire carries the guardrail result, and an execution failure is distinguishable from a policy stop |
| rejected output redaction | implemented | `runner/guardrails.ts:398` to `:546` | a blocked final output is replaced by a placeholder before session persistence, so a policy decision does not write the offending text to storage |
| tool input and output guardrails | declared | `toolGuardrail.ts`; typed results imported at `result.ts:26` to `:29` | a per-tool guardrail layer with reject or throw behaviour; the file exists and is wired into result types, but the execution path was not traced in this read |
| pre-approval tool guardrails | declared | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ (read 2026-10-21) | an option re-runs input guardrails before an approval prompt so a stale call is re-checked after a human decides |

## Approvals and human-in-the-loop

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| approval requirement on a tool | implemented | `tool.ts:110`, `:2761` | `needsApproval` is a boolean or an async predicate evaluated after arguments parse, so a decision can depend on the call |
| pause and interruptions | implemented | `runState.ts:3090`; result field at `result.ts:112` | instead of executing, the run records approval items and returns them; nothing has side effects while paused |
| sticky and per-call decisions | implemented | `runState.ts:3168`, `:3195`; `runContext.ts:1297`, `:1343` | a decision can cover one call or the rest of the run, and a rejection can carry the text the model will see |
| serialize and resume | implemented | `runState.ts:3218`, `:3489`, `:3504` | the paused snapshot is JSON with a schema version; resuming rebuilds the agent graph and continues from the exact step |
| input while paused | implemented | `runState.ts:3028`, `:3021` | new user input can be staged into the snapshot and admitted before the next model call, which is how a chat queue resumes a wait |
| replay protection for approvals | implemented | `runContext.ts:405` to `:451` | an approval is bound to a fingerprint of the invocation, and a reused call id with different arguments is refused |
| secrets kept out of snapshots | implemented | `runState.ts:3212` to `:3219` | tracing API keys are dropped by default; a caller must opt in to move them with the state |
| operator guidance for server-owned approvals | declared | https://openai.github.io/openai-agents-js/guides/human-in-the-loop/ (read 2026-10-21) | the page spells out authentication, authorisation, atomic consumption and replay rules for a host that stores snapshots; it is documentation, not code |

## Sessions and durability

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| session interface | implemented | `packages/agents-core/src/memory/session.ts:1` to `:260` | five methods: id, list with an optional limit, append, pop, clear; the runner reads before the turn and writes after it |
| capability interfaces and guards | implemented | `memory/session.ts:265` to `:303` | optional interfaces for context-aware, rewrite-aware, transaction-aware and compaction-aware stores, with type guards so a plain store stays valid |
| in-memory store | implemented | `memory/memorySession.ts:25` | clones on read and write, returns the most recent window for a limit, and keeps operation ids so a retry cannot apply a write twice |
| idempotent history transactions | implemented | `memory/memorySession.ts:115` to `:156` | append or replace-suffix writes keyed by an operation id, with a suffix precondition that fails loudly if the history moved |
| server conversation store | implemented | `packages/agents-openai/src/memory/openaiConversationsSession.ts:31` | the OpenAI Conversations API is the history store; items are converted both ways and operations are serialised |
| compaction decorator | implemented | `packages/agents-openai/src/memory/openaiResponsesCompactionSession.ts:131`; threshold at `:109` | wraps another session and calls the provider's compaction endpoint once stored history passes a threshold, replacing the stored window |
| compaction is opt-in per decorator | implemented | `openaiResponsesCompactionSession.ts:179` to `:181` | auto or manual mode, with a pluggable decision hook for token-based triggers |
| snapshot schema versioning | implemented | `runState.ts:195`, `:196`, `:3544` | a literal current version and an explicit supported list; an unknown version fails with an instruction to reserialize rather than a best-effort parse |
| durable stores as packages | inferred | `examples/memory/sessions/file.ts`, `examples/memory/sessions/prisma.ts` | file and Prisma stores exist as examples with their own tests, not as published packages; a host still supplies storage |
| conversation ownership strategies | implemented | `run.ts:462` to `:471`; conflict at `:338`; `handoff.ts:217` | replay, session, conversation id, previous response id or resumable state; the list is deliberately exclusive rather than layered |

## Tracing

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| processor interface | implemented | `tracing/processor.ts:25` to `:62` | start and end callbacks for traces and spans, plus flush and shutdown, so a processor can batch or stream |
| exporter interface | implemented | `tracing/processor.ts:67` | one method over a batch of traces and spans with an abort signal; exporters stay unaware of the loop |
| batch processor with backpressure | implemented | `processor.ts:124` to `:356` | bounded buffer, drop-with-error when full, a timer that is unref'd so it does not hold the process, and a shutdown that drains |
| multiple processors | implemented | `processor.ts:358` | fan-out to several processors, which is how a console logger and a remote exporter coexist |
| span taxonomy | implemented | `spans.ts:14` to `:155` | agent, task, turn, function, generation, response, handoff, custom, guardrail, MCP tools, and speech or transcription for realtime |
| global provider with no-op spans | implemented | `tracing/provider.ts:34` to `:240` | one provider creates traces and spans, returns no-ops when tracing is disabled or unmatched, and owns the processor list |
| OpenAI ingest exporter | implemented | `packages/agents-openai/src/openaiTracingExporter.ts:265` to `:380` | posts batches to an ingest endpoint, retries with backoff, honours a retry hint header, treats client errors as non-fatal, and skips without a key |
| per-run and per-item keys | implemented | `openaiTracingExporter.ts:284` to `:302`; config at `run.ts:390` | batches are grouped by tracing key so a multi-tenant host can export different runs with different credentials |
| sensitive-data control | implemented | `run.ts:356` to `:363`; sanitisation at `openaiTracingExporter.ts:172` | a run can include or exclude prompts, tool inputs and outputs; the exporter also strips reasoning fields before ingest |
| no OpenTelemetry exporter | inferred | `tracing/` contains no OTel dependency or adapter | the exporter seam is generic enough for one, but none ships in this repository |

## Tools and schemas

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| function tool factory | implemented | `tool.ts:2287` to `:2694` | name, description, schema, execute, error handling, timeout and approval in one call |
| three schema inputs | implemented | `utils/tools.ts:109` | Zod v3 or v4, Standard Schema, or plain JSON Schema; the provider-neutral JSON Schema is derived once and reused |
| strict by default | implemented | `tool.ts:2308` to `:2316` | Zod and Standard Schema tools require strict schemas, because a loose schema invites malformed calls that no parser can rescue |
| name normalisation | implemented | `utils/tools.ts:87` | whitespace and non-alphanumerics become underscores, so a display name is also a legal function name |
| output schema validation | implemented | `tool.ts:2225`, `:2361` | a declared output schema is validated at the boundary; a mismatch raises a typed invalid-output error instead of poisoning the loop |
| per-tool timeout | implemented | `tool.ts:2324` to `:2349`; `errors.ts:193` | a timeout with a policy of returning an error as a result or raising, because a hung tool must not hang a run |
| model-visible tool errors | implemented | `tool.ts:2472` to `:2506` | a thrown tool error becomes a message the model can react to, which is often better than failing the run |
| tool namespaces | implemented | `tool.ts:2719` | grouped tools get a prefixed model-facing name, which avoids collisions when several servers expose the same tool name |
| hosted tools | declared | `packages/agents-openai/src/tools.ts:94`, `:159`, `:217`, `:241`, `:263`, `:322`; `tool.ts:716`, `:1086`, `:1180` | web search, file search, code interpreter, image generation, programmatic tool calling, tool search, computer, shell and apply-patch; the factories exist, execution happens at the provider |
| MCP tool adapters | implemented | `tool.ts:1234`; agent fields at `agent.ts:546` to `:570` | server tools become model-facing tools with approval support, and `mcpServers` configures discovery |
| MCP server authoring | inferred absent | no server package among the five | the repository consumes MCP servers and does not ship one |

## Streaming

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| three event classes | implemented | `events.ts:18`, `:52`, `:68`, `:80` | raw model events, run-item events and an agent-updated event; consumers choose how deep they want to look |
| raw provider passthrough | implemented | `packages/agents-openai/src/rawModelEvents.ts:9` to `:15` | provider chunks are preserved with a source discriminant, so a rich UI can use fields the SDK does not normalise |
| item event naming | implemented | `events.ts:36` to `:46`; mapping at `runner/streaming.ts:20` | ten names covering messages, handoffs, tools, search, reasoning, compaction and approvals |
| stream lifecycle | implemented | `result.ts:470` to `:580` | queued events, a completion promise, error settlement and cancellation; a consumer may abandon the stream and the run aborts |
| text convenience stream | implemented | `result.ts:600` to `:621` | only text deltas are forwarded, optionally as a Node stream, which is the smallest useful surface for a terminal UI |
| nested agent stream buffering | implemented | `result.ts:470` to `:487`; `agent.ts:990` | an agent tool forwards child events with a bounded queue, so parent backpressure is visible to the child |

## Models

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| minimal model interface | implemented | `model.ts:688` to `:715` | two required methods plus optional retry advice; an adapter is a small amount of code, not a framework |
| provider registry | implemented | `model.ts:722`; `packages/agents-openai/src/openaiProvider.ts` | a string model name is resolved through a provider, which lets one run switch models per agent |
| retry advice | implemented | `model.ts:712`; `packages/agents-openai/src/retryAdvice.ts` | the adapter can tell the runner whether replaying a failed request is safe, which matters when a request may have been accepted |
| prompt templates | declared | `model.ts:734` to `:751`; request field at `:609` | a prompt id and variables can be sent instead of instructions; OpenAI-hosted prompts are the target |
| Responses and Chat Completions | declared | `packages/agents-openai/src/openaiResponsesModel.ts`, `openaiChatCompletionsModel.ts` | two adapters with their own converters and streaming paths; behaviour at the wire was not exercised |
| websocket responses transport | declared | `packages/agents-openai/src/responsesWebSocketConnection.ts` | a pooled websocket transport for repeated calls |
| external model stacks | declared | `packages/agents-extensions/` | adapters for other ecosystems; the package was sized, not read |

## Platforms outside this register's focus

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| realtime and voice | declared | `packages/agents-realtime/`; https://openai.github.io/openai-agents-js/ (read 2026-10-21) | sessions, transports and audio for spoken agents; outside our focus and outside decision 0018's scope |
| sandbox agents | declared | `packages/agents-core/src/sandbox/`; https://openai.github.io/openai-agents-js/ (read 2026-10-21) | a filesystem workspace with provider clients for local, Docker and hosted sandboxes; recorded for the non-goal row, not studied |

## Structured output

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| one output type, four shapes | implemented | `agent.ts:274` to `:279`, `:596` to `:615` | text, a Zod object, a Standard Schema with JSON, or a JSON Schema; the union is validated at construction and rejected early when unsupported |
| schema reaches the model request | declared | `model.ts:589` | the request carries a serialized output type, so a provider can enforce it; enforcement at the wire was not traced |
| final output validation | declared | `runner/items.ts:656` | the run extracts generated output items, but this read did not find a local parse against the output type, so enforcement may be provider-side |
| compile-time output union | implemented | `agent.ts:530` | `Agent.create` unions the outputs of reachable agents so a handoff graph types correctly |

## Run options vocabulary

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| unbounded turn budget | implemented | `run.ts:467` | `maxTurns` accepts null, which hands budgeting to the host |
| missing-tool policy | implemented | `run.ts:416` | raise an error or return a model-visible error and continue; the choice is per run |
| tool-name collision policy | implemented | `run.ts:426` | warn and keep the dispatch winner, or refuse before the model is called |
| reasoning-id policy | implemented | `run.ts:456` | controls whether reasoning item ids are replayed to the provider, which matters for models that reject them |
| blocked-output placeholder | implemented | `run.ts:451` | a formatter decides what a session stores when an output guardrail rejects a terminal tool result |
| session input callback | implemented | `run.ts:432` | merges stored history with the current turn's input, so a host can reorder or trim before the request |

## MCP

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| server configuration on an agent | implemented | `agent.ts:546` to `:570`; `tool.ts:1234` | a server entry becomes a tool set with namespacing and approval support |
| hosted MCP approval records | declared | `runContext.ts:216` | hosted approval decisions are scoped by server label and tool name; the hosted execution path was not read |
| MCP caching and filtering | declared | `mcpConfig` option on the agent | a configuration object exists for discovery behaviour; its semantics were not traced |

## Quality and operations

| capability | status | evidence | how it works, and why it exists |
|---|---|---|---|
| typed error hierarchy | implemented | `errors.ts:33` to `:193` | one base class and a leaf per caller-actionable failure, so a host can branch without string matching |
| scripted model double | implemented | `packages/agents-core/src/testing/scriptedModel.ts:737` | a model that plays a scripted response, including text deltas, so loop tests need no provider |
| released-API contract gate | declared | root `package.json` scripts `api-contract:*` | the public surface is compared across source, dist and pack; no gate was run in this read |
| local registry verification | declared | root `package.json` `local-npm:*` scripts | packed packages are installed against a local Verdaccio registry before release |

## Notable implementation notes

- The unit of progress is a step result, not an event. A step resolves to one of four discriminated outcomes, which is why the loop has no special cases for tools (`packages/agents-core/src/runner/steps.ts:1`).
- Concurrency is explicit: guardrails start in the background, the model call proceeds, and a single await before commit decides whether the turn survives (`runner/guardrails.ts:30`; `run.ts:2129`).
- Persistence is a transaction boundary. Session writes are prepared, tracked and only then admitted, and a rewrite must carry the operation id that produced it (`memory/memorySession.ts:115`).
- The serialized state carries its own version and refuses unknown ones. Compatibility is a ladder of guards, not a single parse (`runState.ts:195`; `:3544`).
- Approval identity is argument-sensitive. A decision is bound to a fingerprint, so a replay with edited arguments is rejected rather than approved by name (`runContext.ts:405`).
- Streaming is a projection of items, so a new item type automatically gains an event name, persistence and tracing support when it is added to the mapping (`runner/streaming.ts:20`).
- The model seam is two methods. Everything else — retry, prompt templates, transport pooling — is optional, which keeps a custom adapter cheap.
- Tracing is processor-centric and fail-soft: an exporter error is logged and the run continues, because telemetry must never break the product (`tracing/processor.ts:220`).
- Item-level tracing keys let one process export different runs to different accounts, which is unusual in a library-shaped SDK (`openaiTracingExporter.ts:288`).
- The bundle's import-time defaults are the convenience seam and the sharp edge: `@openai/agents` installs a provider and an exporter before any user code runs (`packages/agents/src/index.ts:1` to `:8`).