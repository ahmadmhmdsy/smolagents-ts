# microsoft/agent-framework — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Buckets and prices

Bucket letters, effort prices and row ids follow `docs/research/competitors/_synthesis/00-our-baseline.md`; that file defines them and this one does not restate the definitions.
The axis for this read is narrower than the other dives: what a vendor-neutral abstraction looks like when it must hold across two languages, and which parts are portable design rather than one runtime's machinery.

## Bucket C — absent from our vocabulary

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| C-1 | split a session into serializable state and reattachable behaviour (`dotnet/src/Microsoft.Agents.AI.Abstractions/AgentSession.cs:59`, `:85`) | `HL-03`, `HL-08` | a stored conversation restored in a new process, with its providers reattached | `AgentSession` in `packages/core` | M |
| C-2 | a general external-request port that pauses a run for any caller input, not only tool approval (`dotnet/src/Microsoft.Agents.AI.Workflows/IWorkflowContext.cs:35`, `dotnet/src/Microsoft.Agents.AI.Workflows/RequestInfoEvent.cs:8`) | `HL-06` | one pause primitive, so approval, clarification and plan review share a path | run loop in `packages/core` | M |
| C-3 | checkpoint a graph execution through a manager with a pluggable store and marshaller (`dotnet/src/Microsoft.Agents.AI.Workflows/CheckpointManager.cs:14`, `:48`) | `HL-04`, `HL-09` | resume after a crash from the last committed point, with a store we choose | run store in `packages/core` | L |
| C-4 | one execution engine serves every orchestration pattern; patterns are builders (`dotnet/src/Microsoft.Agents.AI.Workflows/AgentWorkflowBuilder.cs:27`, `:183`) | `RT-02` | a graph seam multi-agent arrangements compose over instead of each inventing a loop | step loop in `packages/core` | L |
| C-5 | a feature lifecycle: ids, experimental and release-candidate stages, one warning per use (`python/packages/core/agent_framework/_feature_stage.py:43`, `:70`) | `none` | a way to ship a capability before it is stable without hiding it | build and docs policy | S |
| C-6 | an anonymous feature-usage bit mask carried in the client identity (`python/packages/core/agent_framework/_telemetry.py:36`) | `none` | knowing which optional features users actually exercise | telemetry in `packages/core` | S |
| C-7 | decisions recorded as perpetual documents and treated as the contract between two implementations (`clone:/docs/decisions/0005-python-naming-conventions.md:40`) | `none` | design intent that survives the people who wrote it | `docs/09-decisions` | S |

Four rows here have no baseline id: nothing in our plan names them, which is what the bucket is for.
The decision-log row is the cheapest and the likeliest to matter, because the other three rows are the kind of gap a record like that catches before code exists.

## Bucket A — roadmap follow-on

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| A-1 | an approval decision as message content, able to suspend a remote run and resume later (`clone:/docs/decisions/0006-userapproval.md:15`) | `HL-01`, `HL-02` | approval that works when the human is not in the same process | approval seam in `packages/core` | M |
| A-2 | workflow checkpoints with in-memory and JSON stores (`dotnet/src/Microsoft.Agents.AI.Workflows/CheckpointManager.cs:34`, `:48`) | `HL-04` | resumable runs on top of the store we already plan | run store in `packages/core` | M |
| A-3 | a streaming run whose events are typed and documented (`dotnet/src/Microsoft.Agents.AI.Workflows/IWorkflowContext.cs:49`) | `RT-09` | one event vocabulary a renderer can switch on | `events.ts` in `packages/core` | M |
| A-4 | OpenTelemetry as a wrapper plus one activity, event and tag vocabulary (`dotnet/src/Microsoft.Agents.AI/OpenTelemetryAgent.cs:33`; `dotnet/src/Microsoft.Agents.AI.Workflows/Observability/ActivityNames.cs:5`) | `OB-02`, `OB-03` | spans a tracing backend can join across steps and agents | monitor in `packages/core` | M |
| A-5 | evaluation helpers for agents and workflows (`dotnet/src/Microsoft.Agents.AI/Evaluation/AgentEvaluationResults.cs:14`; `dotnet/src/Microsoft.Agents.AI.Workflows/Evaluation/WorkflowEvaluationExtensions.cs:16`) | `OB-04`, `OB-05` | completed runs scored without a second harness | eval in `packages/core` | M |
| A-6 | provider code extracted into provider-leading packages, core kept vendor-free (`clone:/docs/decisions/0021-provider-leading-clients.md:34`) | `MD-01`, `MD-02` | adapters that install independently of the core | `packages/models` packaging | M |
| A-7 | YAML agent and workflow definitions compiled into the same runtime (`dotnet/src/Microsoft.Agents.AI.Workflows.Declarative/DeclarativeWorkflowBuilder.cs:41`) | `none` | a configuration path to an agent without writing code | loader beside `packages/core` | M |

A-6 is the packaging expression of the neutrality idea the model layer expresses in types; for us it would be a build decision before it is an API one.

## Bucket D — depth gaps

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| D-1 | approvals as typed request and response contents, with a documented unanswered outcome (`clone:/docs/decisions/0045-dotnet-unanswered-tool-approvals.md:1`) | `HL-01`, `HL-02` | a gate whose refusal and silence both have defined behaviour | approval seam in `packages/core` | S |
| D-2 | each provider declares the session state keys it owns (`dotnet/src/Microsoft.Agents.AI.Abstractions/ChatHistoryProvider.cs:88`) | `HL-08` | no key collisions when two memory providers attach to one session | session in `packages/core` | S |
| D-3 | per-run ambient context on an async-local slot, readable anywhere (`dotnet/src/Microsoft.Agents.AI.Abstractions/AIAgent.cs:102`) | `RT-13` | call-scoped facts without threading parameters through every function | run context in `packages/core` | S |
| D-4 | scoped workflow state with read and queued update in the executor context (`dotnet/src/Microsoft.Agents.AI.Workflows/IWorkflowContext.cs:68`, `:139`) | `RT-08` | executor-local state that checkpoints with the run | step loop in `packages/core` | M |
| D-5 | a finished run exposing outputs, request events and a status timeline (`python/packages/core/agent_framework/_workflows/_workflow.py:131`, `:171`, `:192`) | `RT-09`, `RT-13` | callers reading a run's history without re-deriving it | `RunResult` in `packages/core` | S |
| D-6 | checkpoint index retrieval and latest-checkpoint lookup (`dotnet/src/Microsoft.Agents.AI.Workflows/CheckpointManager.cs:73`) | `HL-04` | resuming the newest point without an external index | run store in `packages/core` | S |
| D-7 | executors register restore callbacks so state is rebuilt after deserialization (`dotnet/src/Microsoft.Agents.AI.Workflows/Executor.cs:202`) | `HL-05` | a mid-step crash that replays without duplicating an effect | step loop in `packages/core` | M |

Row D-5 duplicates two baseline ids on purpose: the result views in this repository are a projection of its event stream, and our equivalent sits between the two.

## Bucket B — non-goals

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| B-1 | hosting agents on a managed platform, with per-user session isolation (`clone:/docs/decisions/0031-hosted-per-user-session-storage-isolation.md:1`) | `none` | decision 0018 keeps deployment and hosting out of scope | none | L |
| B-2 | a developer UI for inspecting and replaying runs (`README.md:62`) | `UI-06` | decision 0018 keeps a dev UI out; ours is a library and a CLI | none | L |
| B-3 | the same framework written twice, once per language (`README.md:43`) | `none` | a second implementation is not a goal, and neither is a third in Go | none | L |

## Reading the buckets together

Three observations connect the rows above.

First, their portability is achieved by discipline, not by machinery: no shared schema, no code generation, only a written decision log and a rename table that both teams maintain by hand. That is cheaper than it looks up to a point, and the AG-UI divergence is where the point lies.
Second, the durable-run design is decomposed into three small interfaces: a session of state, a request port that pauses, and a checkpoint manager that stores. Each can be adopted on its own, which is why C-1 to C-3 are separate rows rather than one big one.
Third, the .NET-specific machinery is concentrated in the places we would not copy: hosting middleware, dependency injection, the `Microsoft.Extensions.AI` type system. Everything above that line is portable design.
Fourth, the cost of the approach is paid at release time rather than at design time: the design records are short, and the packaging that carries them is enormous.

## What we have that they lack

- A code-as-action loop with an executor layer and declared capabilities (`RT-01`, `EX-04`); their local CodeAct is a package, not the primary loop.
- Guardrails as a first-class layer (`GR-01`), where their answer to misuse is documented approval plus provider content types.
- A release gate over published artifacts (`DS-02`, `DS-03`, `DS-04`); they rely on solution builds and per-package release trains.
- A terminal product with a verbosity-aware renderer (`CL-01`, `CL-02`); their developer surface is a browser UI.
- An evaluation harness wired into the run store (`OB-04`), against helper classes that assume the caller supplies results.
- A pack-level version identity (`DS-04`); 43 Python projects and 34 .NET projects version apart from one another.
- A planning interval inside the loop (`RT-03`), which in this repository is a property of one orchestration pattern rather than of every run.
- A guardrail refusal that halts with a typed reason (`GR-01`), where their equivalent is a documented approval flow.

## Patterns worth copying

1. Session holds state, providers hold behaviour. A restored session is a plain object, and the agent attaches the providers that give it meaning.
2. A pause is a value: an external request has an id, a type and a place in the event stream, so approval and checkpoints reuse one mechanism.
3. Checkpointing sits behind a manager with a store interface and a marshaller, so memory, JSON and a remote store differ only in wiring.
4. Every orchestration pattern is a builder over one engine, so adding a pattern never adds an execution model.
5. Write the decision before the divergence; a short rename table is why two hand-written implementations can still be read side by side.
6. Gate features by id and stage rather than a boolean flag, warn once at first use, and count the id anonymously afterwards.
7. Keep protocol conversion at the edge: the core speaks its own types, and adapters translate on entry and exit.

## Patterns to avoid

1. Two full implementations with no shared test corpus. The drift is visible in the tree: AG-UI was removed on the .NET side while Python still carries an approval lifecycle for it.
2. Decision records that run to several hundred lines. The rationale is real, but a reader needs the outcome in the first screen.
3. A project count that doubles the release surface: 337 project files for one framework, each on a separate version.
4. Naming parity maintained by a growing exception table. Correlation helps; a rejected-alternatives column per row is maintenance debt.
5. Analysing a run only through its event stream while exposing result views separately, which is how D-5's duplication arises on their side too.
6. Requiring a long behavioural spec before a contributor can touch one loop; the guarantee is real, and so is the onboarding cost.

## What it should change for us

- Make the session a serializable state bag and keep behaviour in providers, before adding another memory feature (`C-1`).
- Add a general request port above tool approval, so clarification, plan review and approval share one pause path (`C-2`).
- Put checkpoints behind a store interface with an in-memory default, then reuse it for the run store (`C-3`, `A-2`).
- Adopt the feature-id and stage pattern for anything experimental, with one warning and no second flag (`C-5`).
- Write one page per accepted design decision and cite it from the code that implements it (`C-7`).
- Leave the graph engine out of scope for now: a step loop plus a request port covers the multi-agent cases we plan to support (`C-4` deferred).

## Limits on these rows

- The read covered abstract types, builders and records, not the execution loop, so superstep timing and concurrency semantics are unverified.
- Provider adapters were not read, so provider-leading naming is a packaging claim only.
- Hosted surfaces were read as route registration, not as protocol behaviour.
- The documentation site was not read; readme claims are marked as declared.
- No test file was read, so every claim about behaviour rests on source shape rather than on a pinned expectation.
- Clip-level details of the magentic ledger, the handoff filtering rules and the group-chat manager were not read past their type definitions.
