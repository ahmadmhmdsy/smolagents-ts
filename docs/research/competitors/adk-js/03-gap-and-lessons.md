# adk-js — gap analysis and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline: A is a follow-on behind a seam we already ship, B is a deliberate
non-goal, C is absent from our vocabulary, and D is a depth gap in something we ship. The
matching column states the behaviour a parity implementation would have to reproduce at the
named seam; it is not a request to reproduce their code or their API. Fit names the file or seam
the change would land behind. Prices are S (a day or less), M (two to three days), L (a week or
more) and XL (a product, needs a decision first).

## A — roadmap follow-ons

| id | gap | matching means | fit | price |
|---|---|---|---|---|
| MA-02 | Control transfer persisted on the run | A transfer is a validated action whose target is an enum of agents reachable from here, stored on the step event; the next run routes back to the target because the log says so | `packages/core/src/agent/managed-agent.ts` plus the step interpreter | M |
| MA-05 | A state scope shared by agents in one run | Session state keyed app, user and turn; each agent's writes ride its event as a delta, are promoted out of the run and are visible to a sibling | `RunContext.state`, `AgentSession` | M |
| MA-03 | A typed child report rather than a string | The child declares an output schema; the returned value is validated against it, and a task-mode child must call a completion tool with schema-shaped arguments | `packages/core/src/agent/managed-agent.ts:53` | S |
| HL-02 | A pending approval carried as data | A pause is an event holding the pinned call, the prompt and a reply schema; the verdict is a later event whose id matches, and a mismatch aborts | `packages/core/src/agent/approval.ts`, `run-store.ts` | M |
| HL-04 | Resume from a second process | The stored log lets another process find the unanswered call, re-enter the agent that raised it and refuse a duplicate answer | `RunStore` plus a resume record | L |
| HL-06 | An interrupt answered later by a person | A step returns a request with a schema; the reply is validated after the fact and becomes that step's input | `multi-step-agent.ts` step loop plus checkpoint | M |
| HL-09 | Durable stores for the run seam | An on-disk store with the same append rules: partial events dropped, deltas ordered, prototype-safe maps, app and user scopes promoted | `RunStore` | M |
| HL-10 | A version marker on stored state | One version value in a metadata row, checked on open, with a fixed serialization contract for stored steps | `StepJSON`, `RunStore` | S |
| OB-02 | Span export to OpenTelemetry | A span per agent and per tool with GenAI operation names, plus a setup helper that attaches OTLP exporters from environment variables | `packages/core/src/monitoring/trace.ts` | M |
| OB-05 | Eval sets, mocked tools and named metrics | JSON fixtures with expected tool trajectories and expected text, a mocked tool seam, per-invocation metric results and a pass threshold | `monitoring/eval.ts` | L |
| OB-07 | A hook that can modify or veto an event | An ordered hook sees each event before persistence and may replace it | listeners in `packages/core/src/events.ts` | S |
| CL-03 | Answer a pause from the terminal | The CLI detects pending input, words the prompt by kind and sends the reply as the resume value | `packages/cli/src` | M |
| GR-06 | Re-ask after a schema mismatch | The completion tool returns a missing-argument error to the model instead of failing the run, so the model retries within the step budget | `multi-step-agent.ts:713` | S |

## C — unconsidered

| id | pattern | why it matters | fit | price |
|---|---|---|---|---|
| C-01 | One ordered hook set that pre-empts local callbacks | Their policy, logging, security and retry all land on one hook list; the first non-undefined verdict wins and outranks the agent's own callback. Ours is middleware plus a guardrail, so each new concern becomes another branch in the loop | middleware | L |
| C-02 | An approval bound to the exact call it approved | The verdict carries the original call, and a mismatch between what was shown and what would run aborts the invocation with a typed reason. Our gate is a boolean decided before the call | `approval.ts` | M |
| C-03 | Concurrent-safe state commits | A per-write order stamp and a null-prototype map keep two turns from clobbering state and keep a client-supplied prototype key inert | `AgentSession`, `RunStore` | M |
| C-04 | A typed projection of one event record for clients | A single projection maps each raw event onto thought, content, tool call, tool result, code, error or finished, so a renderer needs no model knowledge | `packages/core/src/events.ts` | M |
| C-05 | Paused-session inspection | A small API answers what a session is waiting for, of which kind, with which schema, and which requests are still unanswered; without it a client must parse function calls | `AgentSession` | S |
| C-06 | Recording a good run into a fixture | A real session becomes eval data, and the recorded tool outputs are replayed through the tool seam, so a fixture is produced by running the agent once | `monitoring/eval.ts` | M |
| C-07 | A URL policy for peer-provided endpoints | Card resolution refuses link-local hosts, redirects, insecure RPC and cross-origin RPC by default. Our remote executors accept a caller URL with no such policy | `exec-remote` backends | S |
| C-08 | Feature flags with a stage and a one-time warning | A feature declares wip, experimental or stable, defaults off, and can be forced by `ADK_ENABLE_*`; enabling an unstable one warns once | runtime options | S |

## D — depth gaps

| id | we ship | they ship | fit | price |
|---|---|---|---|---|
| RT-09 | A typed event stream with kinds for the UI | An event record with id, invocation, branch, node path, route, long-running ids and an action bag, plus a typed client projection | `packages/core/src/events.ts` | M |
| OB-03 | A trace fold with whatever attributes it collects | GenAI operation names on agent and tool spans, emitted through the OpenTelemetry API | `monitoring/trace.ts` | M |
| OB-04 | One expectation-shaped scorer for a finished run | Eval sets, recorded fixtures, a mocked tool seam, two named metrics and a threshold per metric | `monitoring/eval.ts` | M |
| CL-05 | One task per process | An interactive CLI that renders pauses by kind and continues the same session on the next line | `packages/cli/src` | M |
| MD-05 | Five adapters chosen by configuration | A registry matched by model-name pattern and a routed model that fails over between models per request | `packages/models` | M |

## B — non-goals

| capability | decision | note for the backlog |
|---|---|---|
| A2A server and client | 0018, the non-goal list names an agent-to-agent protocol | Recorded, not queued. The card URL policy (C-07) and the refusal of remote confirmations are separable lessons for our remote executors |
| A dev UI and an HTTP API server | 0018 keeps a dev UI out | Their server is 1,798 lines of routes over sessions, events, artifacts and evals; the CLI part of the same package stays in scope |
| Deployment commands | 0018 keeps deployment out | `deploy cloud_run` and `deploy agent_engine` are recorded here for completeness only |
| A workspace sandbox with shell and filesystem | 0018, and `EX-05` in the baseline | Their local executor is named unsafe on purpose; it is the opposite of our confinement story |
| Multimodal and live voice | 0018 keeps multimodal input and realtime out | The Live API path and transcription entries were located, not read |

## What we have that they lack

- A sandboxed program as the default action space. Their loop is a function-calling loop and code
  execution is one tool family behind it (`core/src/code_executors/`), while our loop's action is
  a model-authored program and the executor is the runtime's centre.
- A provider-neutral model seam. Their public event and request types are built on the Google
  GenAI types, so reading a stored transcript means depending on that package
  (`core/src/events/event.ts:74`), while our model seam has no provider type in it.
- One facade and generated version identity (`DS-01`, `DS-04`). Their three workspace packages
  release in lockstep, so a user installs the runtime and the dev tools separately.

## Patterns worth copying

1. **Constrain a handoff target by decoding it into the tool schema.** A per-invocation tool takes
   an enum of the agents reachable from here, so an invented name fails validation and returns as
   a retryable error (`core/src/agents/processors/agent_transfer_llm_request_processor.ts:42-59`).
   Copy this for MA-02 before copying anything about topology.
2. **Pin a pause to what the human saw.** The confirmation record holds the original call, the
   verdict and a payload; a mismatch is a typed error that aborts rather than runs
   (`core/src/tools/tool_confirmation.ts:45-57`). This is the cheapest hardening of `HL-01` and
   the precondition for `HL-02`.
3. **Make the log the resume state machine, not the checkpoint.** Routing a second process to the
   agent that asked is a scan over events, not a new snapshot format
   (`core/src/runner/runner.ts:937`, `core/src/workflow/workflow.ts:233-256`). Our checkpoint is
   between steps; the missing half is the settled-event log.
4. **Version the stored shape, then freeze the serialization.** One metadata row holds
   `schema_version` and the payload spelling is declared a cross-language contract
   (`core/src/sessions/db/schema.ts:19-21`, `:43`). That is a small, high-leverage answer to `HL-10`.
5. **Use model-free metrics for the first regression gate.** Exact tool-trajectory match plus
   ROUGE-1 against a fixture, with per-metric thresholds, catches a broken loop without a judge
   (`core/src/cli/cli_eval.ts:41-61`, `:393`). The recorded-session and mocked-tool path is what
   makes fixtures cheap enough to exist (`:499-507`, `:608`).
6. **Fail closed on a URL taken from a peer.** Redirects refused, link-local hosts refused,
   cross-origin RPC refused unless explicitly allowed, insecure RPC likewise
   (`core/src/a2a/agent_card.ts:84-126`). Our `exec-remote` backends take a caller-supplied
   endpoint and have no equivalent policy.

## Patterns to avoid

- A hook surface wider than its wiring. The plugin interface and manager expose agent, tool-selection
  and context-compaction hooks, and no production path calls them
  (`core/src/plugins/plugin_manager.ts:194`, `:212`, `:270`, `:288`; only a unit test reaches
  the agent pair). A public hook that never fires is worse than a missing one.
- Ported strings that no longer apply. `MISSING_EVAL_DEPENDENCIES_MESSAGE` still says to run
  `pip install google-adk[eval]` and nothing reads it (`core/src/cli/cli_eval.ts:35-36`).
- A doc comment that describes a state the code has outgrown. The loop-state doc says checkpoint
  fields arrive in a later phase while a rehydration map is declared and assigned on the same class
  (`core/src/workflow/workflow.ts:94`, `:104`, `:245`).
- Two coordination models shipped at once. Sequential, parallel and loop agents are deprecated in
  favour of the workflow graph and still exported
  (`core/src/agents/parallel_agent.ts:42-50`), so a reader must decide which story is current.
- Placeholders that throw from a public protocol surface. A2A task cancellation and live mode on a
  remote agent both raise "not supported yet" (`core/src/a2a/agent_executor.ts:218-220`,
  `core/src/agents/remote_agent.ts:258`).
- Mega-classes as the integration point. The LLM agent is 75.8 KB and the runner 40.8 KB, so a
  change's blast radius is hard to see.
- One provider's types in the public record. Extending the model response type means every event,
  saved session and client type is shaped by that vendor (`core/src/events/event.ts:74`); it buys
  parity with the Python sibling and costs independence.
- A workspace package with nothing in it. The integrations package exports a version string and
  ships in the same release train (`integrations/src/index.ts:7`).

## What this should change for us

1. **Add transfer as a first-class action (M).** Extend the step action set with a transfer whose
   target list is derived from the registry, persist it on the step event, and route the next run
   to that agent. This turns `MA-02` from absent to useful without a supervisor framework.
2. **Serialise approvals (M).** A pinned call record, a reply schema and a verdict event would close
   `HL-02`, harden `HL-01` and make `CL-03` and the chat surface straightforward.
3. **Make the settled-event log the resume source (L).** Append non-partial events, stamp state
   deltas, and let resume scan for unanswered calls; this is the shortest credible route to
   `HL-04` and `HL-06`.
4. **Version the checkpoint (S).** One version row and a frozen serialization contract closes
   `HL-10` cheaply and protects every later change to `HL-04`.
5. **Give evaluation a dataset and a mocked tool seam (M).** Recorded-run fixtures plus two
   model-free metrics with thresholds take `OB-04` to a regression gate and put `OB-05` within
   reach.
6. **Export the fold (M).** Emitting the existing span tree through the OpenTelemetry API, with
   GenAI operation names, closes `OB-02` without a new subsystem.
7. **Apply the card URL policy to remote executors (S).** Refusing redirects, link-local hosts and
   origin changes is a small change with a security payoff in `exec-remote`.

## Baseline corrections

No baseline status was contradicted by this read. Four notes belong in the backlog anyway.

- `MA-02` bundles two different mechanisms. A child exposed as a tool is delegation and we ship
  it under `MA-01`; what adk-js adds is control transfer, a persisted action plus routing on
  resume. Sharpening the row to say so keeps a future implementation from rebuilding delegation.
- `HL-10` reads as a large gap, but their answer is one version value plus a declared payload
  spelling (`core/src/sessions/db/schema.ts:19-21`, `:43`). Priced S, not L; `HL-04` is the L.
- `MA-03` is minimal for a cheap reason: typed child output there is schema validation on an
  existing call path, so an upgrade is S rather than M.
- A2A has no baseline id at all; the non-goal list names the protocol but the matrix cannot key a
  row to it. A dive that finds a separable lesson (C-07) has nowhere to point, which is a
  vocabulary hole rather than a status error.
