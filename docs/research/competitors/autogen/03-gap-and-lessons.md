# autogen — gap analysis and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How a row reads

Buckets follow the baseline: A is a follow-on behind a seam we already ship, B is a non-goal under
decision 0018, C is absent from our vocabulary, and D is a depth gap in something we ship. The
matching column states the behaviour a parity implementation would have to reproduce at the named
seam, not an API to copy. Fit names the file or seam the change would land behind. Prices are S (a
day or less), M (two to three days), L (a week or more) and XL (a product, a decision first).

## A — roadmap follow-ons

| id | gap | matching means | fit | price |
|---|---|---|---|---|
| MA-02 | Control transfer as a first-class outcome | A call to a declared handoff becomes a typed transfer message whose target is one of the reachable agents, and the run ends there; a handoff-aware stop rule can then end the loop on a target | `packages/core/src/agent/managed-agent.ts` plus the action interpreter | M |
| MA-06 | One shipped group topology | A small team object owns a transcript, asks a selection function for the next participant and runs participants until a predicate stops it, with a turn cap enforced beside the predicate | new seam beside `multi-step-agent.ts` | M |
| MA-04 | Children that run in parallel or outlive the call | Their assistant gathers independent tool calls concurrently; a child would need a handle, a join point and a stop that does not cancel siblings | `managed-agent.ts`, `RunContext` | L |
| HL-06 | An interrupt answered by a person later | A human turn is modeled as a new run whose task is a typed handoff message; the earlier run ends with a stop reason that names the target | `multi-step-agent.ts` step loop, `run-store.ts` | M |
| TL-04 | A tool that streams intermediate output | A tool yields events before its return value, and the loop forwards them into the run's stream while still producing one result | `packages/core/src/tool/tool.ts`, `events.ts` | M |
| TL-06 | A tool surface with a lifecycle | A workbench can be started, stopped, reset and persisted, and its tool list is read per step instead of fixed at agent construction | `tool/registry.ts` | M |
| HL-10 | A version marker on stored state | Each saved participant carries a type name and version, and loading a mismatched shape fails with a message that names the expected generation | `StepJSON`, `RunStore` | S |
| OB-02 | Span export with GenAI names | The existing span fold is emitted through OpenTelemetry with operation names for tool, create-agent and invoke-agent, and a parent taken from the step or call that caused it | `monitoring/trace.ts` | M |

## C — unconsidered

| id | pattern | why it matters | fit | price |
|---|---|---|---|---|
| C-01 | A stop rule as an external predicate | Termination is an object called with the new messages only, never a branch inside the loop; two conditions combine with and and or, and firing is a typed result. A loop bound and a stop reason become separable concerns | new seam; today `AgentMaxStepsError` is both | S |
| C-02 | Speaker choice as a policy with a validated return | The manager asks a policy for a participant name, checks the name against its list and only then sends the request; rotation, model choice, handoff scan and ledger are four implementations of one method | team seam, none today | M |
| C-03 | The control plane as validated graph data | Nodes declare `all` or `any` activation, edges carry message conditions, and construction rejects a cycle that has no conditional exit. The topology is data before it is a run | new seam | L |
| C-04 | Control-plane decisions in the same event stream | Who speaks next and which thought preceded a call are typed events beside tool events, so a renderer needs no knowledge of the team's internals | `packages/core/src/events.ts` | S |
| C-05 | Pause that does not end the run | Pause and resume reach each participant over RPC and are no-ops by default, distinct from a termination condition and from cancellation | run control seam, none today | L |
| C-06 | A token budget as a stop rule | Prompt plus completion tokens are summed from each message's usage and compared with a ceiling, so cost stops a run the way a message count does | `monitoring/monitor.ts` plus a new predicate seam | S |
| C-07 | Handoff as tool, message and stop target together | One declaration yields a model-facing tool, a typed message naming the target and a condition that stops on that target; resumption is a new task carrying the message | `managed-agent.ts`, `events.ts` | M |
| C-08 | Bounded structured-output retry for a control call | A control-plane model call that must return JSON is retried up to a fixed count before the run fails, so a malformed ledger is not fatal on the first try | `GR-06` seam | S |

## D — depth gaps

| id | we ship | they ship | fit | price |
|---|---|---|---|---|
| RT-09 | A typed step and event stream for one loop | A stream that also carries inner messages, thoughts, tool request and execution events, and team decisions such as speaker selection and selector rationale | `packages/core/src/events.ts` | M |
| RT-14 | One agent's session snapshot for a UI | A snapshot of the manager, every participant and its buffer, keyed by participant name and rebuilt through the runtime so local and remote agents share one path | `session/agent-session.ts`, `run-store.ts` | M |
| OB-03 | A local span fold with whatever attributes it records | Runtime, create-agent, invoke-agent and tool spans with GenAI operation names and parents taken from message metadata | `monitoring/trace.ts` | M |
| TL-02 | A registry of zod tools fixed per agent | A workbench with a tool list per step, lifecycle hooks and its own saved state | `tool/registry.ts` | M |

## B — non-goals

| capability | decision | note for the backlog |
|---|---|---|
| A GUI for building and running teams | 0018 keeps a dev UI out | AutoGen Studio is a FastAPI backend and a React frontend over component configs; its own README calls it a prototype and warns it is not production-ready |
| A streaming UI transport | 0018 keeps one out | Studio's frontend and the team queue are the two halves of the same idea; recorded for completeness only |
| A shell or Docker workspace for the agent | 0018, and `EX-05` in the baseline | AutoGen's local and Docker command-line executors are exactly that model; the useful part is the approval hook in front of it |
| Multimodal and voice surfaces | 0018 keeps them out | The extension package ships a web surfer and a video surfer as agents; the pattern is a specialised agent per modality, not a model capability |

## What we have that they lack

- A confined default action space. Their code runs through a shell, a Docker container or a Jupyter
  kernel that the host must choose, while our default executor is a WASM guest with a declared
  capability bag (`EX-01`, `EX-04`).
- A provider-neutral model seam with no vendor types in the event record. Their message envelope
  carries typed model usage and their clients return provider results, but the public record is
  theirs to change; our adapters plug into one interface (`MD-01`).
- Guardrails and a schema-bound final answer on the run path (`GR-01`, `GR-02`). AutoGen validates
  structured output per message but has no input or output tripwire that halts a team.
- One facade and one version line for eleven packages (`DS-01`, `DS-04`). They release a core, a
  chat layer, an extension ring, a studio and a .NET port on separate schedules, which the archived
  tree now freezes in place.

## Patterns worth copying

1. **Make the stop rule a value, not a branch.** Conditions are called with a delta and return
   either a `StopMessage` or nothing (`conditions/_terminations.py:24-92`, `base/_termination.py:59`).
   Two conditions compose with `&` and `|`, and the manager resets the condition when it fires
   (`_base_group_chat_manager.py:200-207`). This is the cheapest route to a stop reason that is not
   a step budget.
2. **Let the manager enforce the cap the predicate cannot see.** `max_turns` is checked after the
   condition returns nothing (`_base_group_chat_manager.py:213-227`), so a custom rule cannot make a
   team run forever by accident.
3. **Validate a chosen speaker before dispatching.** `_transition_to_next_speakers` checks every
   returned name against the participant list, logs a `SelectSpeakerEvent` and only then publishes
   the request (`_base_group_chat_manager.py:172-193`); the policy never gets to address a stranger.
4. **Generate the handoff tool from the handoff declaration.** One `Handoff` model produces the
   model-facing function, and its call becomes a `HandoffMessage` with the target; the runtime never
   parses prose to learn where control went (`base/_handoff.py:12-51`,
   `_assistant_agent.py:1327-1406`).
5. **Save participants by name through the runtime.** `TeamState.agent_states` is keyed by agent
   name and filled through `runtime.agent_save_state`, which is why a remote participant needs no
   second serialization path (`_base_group_chat.py:766-796`).
6. **Trace from the envelope.** The runtime opens and closes spans around create, send, publish,
   process, ack and intercept with the parent taken from message metadata
   (`_single_threaded_agent_runtime.py:357-467`), so a trace follows the message, not the call stack.

## Patterns to avoid

- **A default that never stops.** Swarm, round robin and selector all default to no termination
  condition and no turn cap (`_round_robin_group_chat.py:117-119`; `_swarm_group_chat.py:145-146`),
  and the Swarm docstring says the chat will run indefinitely. A caller must remember a rule the
  library could have defaulted.
- **Two failure policies under one name.** Selector after three attempts silently reuses the
  previous speaker or the first participant (`_selector_group_chat.py:302-308`), while Magentic
  raises on an invalid name (`_magentic_one_orchestrator.py:429-434`). Both are speaker selection,
  so the difference is invisible until a run misbehaves.
- **State that omits its own wiring.** The runtime's `save_state` documents that subscription state
  is not saved (`_single_threaded_agent_runtime.py:438`), so a restored runtime is half restored
  and the host must rebuild subscriptions from the same code that built them.
- **A reset that loses the reason.** On a stop the manager resets the condition and zeroes the turn
  counter (`_base_group_chat_manager.py:210-227`), so a continuation begins with no memory of why
  the previous run ended; a cancelled run may skip the reset entirely (`_base_group_chat.py:256-263`).
- **Two generations in one tree.** The .NET packages keep a 0.2-derived set that its README says will
  be deprecated (`dotnet/README.md:3-5`), and the Python proxy package depends on the current chat
  layer while shipping an empty module. A reader cannot tell from the tree which story is current.

## What this should change for us

1. **Add a small team seam (M).** A controller that owns the transcript, calls a selection function
   for the next participant and enforces a turn cap would turn `MA-06` from absent to useful, and
   `MA-02` and `MA-04` become increments on it rather than new subsystems.
2. **Split stopping from stepping (S).** Give the loop a predicate called with the last step's delta
   and a typed stop reason, and keep `AgentMaxStepsError` as the backstop. This is the highest
   ratio lesson in the read and it does not need the team seam.
3. **Publish control-plane events in the existing stream (S).** `speaker.selected`, `team.terminated`
   and `tool.call` belong beside `code.delta` so a renderer shows why a run moved on (`RT-09`).
4. **Model handoff as a typed message plus a stop target (M).** An action that returns a target
   chosen from the reachable agents, a message type that names it, and a predicate that ends the run
   on it closes `MA-02` without persistence.
5. **Let one tool call stream (M).** A tool that yields events, forwarded into the run stream before
   its result, covers `TL-04` and makes `TL-06` a natural follow-on.

## Baseline corrections

- `MA-02` is cheaper than its wording suggests. Nothing in AutoGen persists a transfer: the handoff
  is a tool call that becomes a message, and the next run is a new task. An implementation that
  reuses our action and event types, with no store change, is M rather than L.
- `RT-09` reads as "already implemented", which it is, but the depth difference is specific: our
  stream has no event for a decision about who acts next. Recording that keeps the row honest.
- `HL-06` can be modeled as a new run rather than a suspended call. The baseline's wording pushes
  toward a suspended call, while AutoGen shows the cheaper shape: end the run with a typed reason,
  then start another with the human's message as the task.
- A new id is missing for the team control plane. `MA-06` covers a shipped topology, but nothing
  covers a selection policy or a manager transcript, so a dive that finds those has to file them as
  unconsidered rather than against a row.
