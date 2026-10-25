# Plan — apply the competitor findings: fix the record, then build the three spines

**Contract**
- **Role:** the staged implementation plan derived from the 2026-10-21 competitor study; it orders work and sets exit criteria, and each phase becomes its own execution plan.
- **Mutability:** status and phase progress are edited in place; scope changes go through the open questions below, not through a quiet rewrite.
- **Read when:** deciding what to build next, or starting a phase.
- **Update when:** a phase lands, an open question is answered, or the research behind an item is superseded.

- **Status:** done 2026-10-25 — Phases 0–6 closed
- **Owner:** owner
- **Created:** 2026-10-22T14:20:00+03:00
- **Authorized by:** owner, 2026-10-24 ("open Phase 0"); the dive's adoptable items and the delegation ruling are approved (`0025`), and Phase 0 executes under [`2026-10-24-phase-0-execution-plan.md`](docs/plans/2026-10-24-phase-0-execution-plan.md).

## Goal

Close the places where the library says one thing and does another, then build the three missing spines — durable runs, honest delegation, and protocol breadth — in an order where every phase is independently shippable and verifiably done.

## Why now

The study filed 565 gap rows against 97 capabilities, and 75 of those capabilities were contested by at least one neighbour. Two facts make this urgent rather than interesting. First, the cheapest findings are not features: five of the nine Release 1 items are corrections, and one of them (`EX-06`) is a capability claim nothing enforces. Second, every deeper item waits on the same missing seam: a run that can be paused, owned, journalled and resumed. Delegation, condensation, streaming resume and the CLI all become small once that record exists, and none of them can be built correctly before it does.

## Non-goals

- No shared data blackboard and no team shelf ([`0025`](docs/09-decisions/0025-no-blackboard.md)): a typed report, a message that is a record entry, and a claim board only when a background child exists. Delegation is opt-in and never gated by prose.
- Nothing on the study's refuse list ([`0022`](docs/09-decisions/0022-the-refuse-list-is-the-boundary.md)): no workspace sandbox, no MCP server authoring, no OAuth, no A2A, no graph engine, no job queue, no hosted control plane, no exporter on by default, no chat transport, no generative UI, no provider router.
- A re-run of the study. The research is a pinned snapshot; phases cite it and do not re-litigate it.
- Retrieval is in by [`0026`](docs/09-decisions/0026-retrieval-is-in.md); its seam waits on a later execution plan. Multimodal is deferred under `0018`, and provider-spec versioning landed as Phase 6.1.
- A Python port. The `strands` dive prices it as a second implementation, not a translation, and that is a product decision this plan does not take.
- A sandbox-level egress allow-list. `0020` keeps the policy axis additive; the list waits for a fetch or workspace capability.

## Approach

Four rules decide the shape, and they are the reason the phases are ordered this way.

1. **Truth before features.** A capability that is declared but not enforced is worse than an absent one, because a caller plans around it. Phase 0 exists to make ten declarations true and is mostly independent small items.
2. **One spine at a time.** The run record is a type that every later feature extends: pending requests, ownership, journals, background children, condensation and stream cursors all add fields to it. Building them in parallel would produce five incompatible state models, so Phase 1 lands the record first and the rest hang off it.
3. **A seam, never a special case.** Each item lands behind a seam the package already exports: an approval handler, a store, an exporter, a capability bag, a policy hook. If an item needs the loop to know about a provider or a host, it is mis-scoped.
4. **A failing test first.** Every item names the fixture that must fail before the code exists and pass after. That is how the study's "declared but not wired" class stops recurring.

Each phase below is a candidate for its own execution plan in this folder, with bite-sized tasks, exact files and commands. This file is the program; it does not restate those steps.

## Phases

### Phase 0 — Truth pass

**Execution plan.** [`2026-10-24-phase-0-execution-plan.md`](docs/plans/2026-10-24-phase-0-execution-plan.md) carries the item-by-item acceptance tests, write scopes and rollbacks.

**Deliverable.** Ten small items that make the shipped surface honest: approval bound to the call it approves; the output schema bound to the final answer rather than to a model flag; one bounded repair attempt; egress enforced where a backend can and refused where it cannot; a schema version on stored state; a written rule for what a guardrail trip persists; a deadline on every tool; a conformance suite for stores; a request-owned budget with a typed stop reason; and structured output proven on a model that cannot call tools.

**Files likely affected.** `packages/core/src/agent/approval.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/agent/guardrail.ts`, `packages/core/src/model.ts`, `packages/core/src/events.ts`, `packages/core/src/session/run-store.ts`, `packages/core/src/agent/run-result.ts`, `packages/tools/src/index.ts`, `packages/exec-remote/src/backends/e2b.ts`, the model seam and its tests, and the tests beside each.

**Items, in order of independence.** All are S or M; none touches another item's files.

| # | item | ids | done when |
|---|---|---|---|
| 0.1 | approval records a request id and an input digest; a verdict for another call or another input is refused typed; the outcome is the closed set `allowed-once \| rejected \| cancelled \| unavailable` and only `allowed-once` grants; a per-session `never` policy rejects before any answerer runs; the ask happens only inside an open turn; malformed verdicts fail closed; the decision event carries the call and its digest | `HL-01`, `HL-12` | a test approves one call, edits one argument, and asserts no side effect; a `never` session rejects without asking, and an ask outside a turn throws |
| 0.2 | the schema binds to `final_answer` in both flavours, a mismatch returns as an observation, and `ModelCapabilities.structuredOutput` is removed (`0020` refuses the mode enum) | `GR-05` | a wrong-shaped answer names the offending path in the observation, and no model capability field is unread |
| 0.3 | one repair attempt: schema failure returns as a history message, with a separate budget, and never after a length finish | `GR-06` | a scripted model fails twice then returns valid; run succeeds with two attempts recorded |
| 0.4 | an `egress: "unmanaged" \| "deny-all"` policy axis; e2b passes the vendor's deny through its seam; docker and process refuse a deny-all request typed until 4.8 replaces the docker transport; `network` stays reach only; the egress decision passes a deny-only stage after the policy hook, so a later listener can only subtract permission | `EX-06` | the e2b double shows the deny option at create; docker and process throw before the guest starts |
| 0.5 | stored records carry one integer version, one migration package per integer, and a version catalog that rejects gaps; old values load, a newer value is refused with a typed error, and a historical header is translated before the typed read | `HL-10` | a fixture written at version 1 loads, and a version beyond the current one refuses |
| 0.6 | a written and tested rule for what a tripped guardrail does to the checkpoint, the session and the trace | `GR-01` | blocked output is absent from every persisted artifact, and the trace says it was redacted |
| 0.7 | every tool gets a finite default deadline with an explicit opt-out, enforced by an around-wrapper that replaces the result only when its own timer fired; the timeout is one typed code shares with the classification, and cancellation is classified separately | `TL-05` | a hanging tool fails the step; the error names which limit fired |
| 0.8 | an importable conformance suite covering the ten failure modes in the durability brief, written against the store interface so every backend passes the same file, each refusal with a rejecting counterexample | `DS-09` | the file store passes it and the suite is documented as the contract |
| 0.9 | request-owned turn, output-token and total-token limits as fields on the run record, clamped by a deployment ceiling; a typed stop reason; exhaustion is terminal and a resume does not reset it; a result handle continues the same budget | `RT-06`, `RT-08`, `RT-13` | a second call with the returned handle keeps counting and reports `limitTotalTokens` |
| 0.10 | structured output proven on a model that cannot call tools: the bound schema plus the repair turn, not a forced tool | `GR-06`, `GR-05` | a scripted model with `toolCalls: false` still ends with a schema-valid answer inside the attempt bound |

**Sequencing.** Two waves, with the loop single-writer. Wave 1 is 0.1, 0.2 and 0.5 — the approval binding, the schema binding and the schema version, which Phase 1.1 depends on. 0.4 runs beside Wave 1 on its own scope, `packages/exec-remote/**` and its tests, so no writer touches `multi-step-agent.ts` twice. Wave 2 is 0.3, 0.6, 0.7, 0.8, 0.9 and 0.10, all behind the same loop surface. Each wave ends at a commit with `pnpm gate` green.

**Exit criterion.** No row in the baseline that this phase touches is described as "declared" while the code does nothing, and every item has a test that failed first.

**Verification.** `pnpm --filter @smolagents-ts/core test`, `pnpm --filter @smolagents-ts/models test`, `pnpm --filter @smolagents-ts/tools test`, `pnpm --filter @smolagents-ts/exec-remote test`, then `pnpm gate` exit 0.

### Phase 1 — The durability spine

**Deliverable.** A run is a record, not a checkpoint of steps. The record carries a schema version, a generation for ownership, a completed flag, an effects journal, a pending request, an agent fingerprint and a parent pointer. A second process cannot write it; a paused run resumes by request id; a crash inside a step replays the journal instead of the effect.

This phase is strictly ordered. Each item extends the type the previous one introduced, so no two items here are parallel.

| # | item | ids | depends on |
|---|---|---|---|
| 1.1 | the record type and its commit boundary; the loop commits at one place, the store never invents one; the public `checkpoint` option becomes `runId` ([`0023`](docs/09-decisions/0023-one-identity-per-run.md)) | `HL-03`, `HL-04`, `HL-09` | Phase 0.5 |
| 1.2 | a pending request as state: kind, request id, digest, payload, and `resume(requestId, value)` | `HL-02`, `HL-06` | 1.1 |
| 1.3 | one owner at a time, by compare-and-set generation or a claim record; a stale writer is refused typed; a resume repairs forward by appending synthetic closers, never by truncating, and a second live writer refuses rather than racing the repair | `HL-04` | 1.1 |
| 1.4 | an effects journal: the model request and each wrapped tool call are recorded and replayed, with an explicit in-doubt state for effects we cannot verify | `HL-05` | 1.1–1.3 |
| 1.5 | a file store implementation that passes the Phase 0.8 suite | `HL-09` | 1.1–1.4 |
| 1.6 | `--resume <runId>` and `--approve <requestId>` in the CLI, against the same store | `CL-03` | 1.2, 1.5 |
| 1.7 | a conversation identity that outlives a run, with the run pointing at it | `HL-08` | 1.1 |
| 1.8 | fork or replay from a named step, without repeating effects | `HL-07` | 1.4 |

**Files likely affected.** `packages/core/src/session/run-store.ts`, `packages/core/src/session/agent-session.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/agent/run-result.ts`, `packages/core/src/events.ts`, `packages/core/src/index.ts`, `packages/cli/src/args.ts`, `packages/cli/src/run.ts`, plus one new file for the file store and one for the conformance suite.

**Exit criterion.** In a single test: a run pauses on an approval, the first process stores it, a second process reads the record, refuses a wrong owner, resumes with `resume`, and finishes; separately, a crash injected after a tool call resumes without repeating it.

**Verification.** The store conformance suite, the ten failure-mode fixtures, `pnpm gate` exit 0, and one manual two-process run recorded in the phase report.

### Phase 2 — Delegation that survives its parent

**Deliverable.** A child returns a validated value or a typed error; a parent can message a running child and wait on it without polling; every event carries the path of the agents that produced it; a child can run in the background, be re-attached in a later run, and claim work from a board that stores claims rather than data. The delegation surface is opt-in.

Depends on Phase 1.1 to 1.4. The phase is cut into two slices because the first needs nothing new — a typed report, an agent path, a send and a wait all ride the existing loop. The second slice needs ownership and a child row: a transfer needs the pending-request machinery, and a background child and a claim board are new durable rows behind a flag. The team shelf (a named peer roster, a client panel) is out of scope by [`0025`](docs/09-decisions/0025-no-blackboard.md).

| slice | # | item | ids | effort |
|---|---|---|---|---|
| first | 2.1 | a typed child report: a value validated against a declared schema, a failure channel separate from the value, a stop reason, and a bounded provider diagnostic that excludes inputs and secrets | `MA-03` | S |
| first | 2.3 | an agent path on every event, enriched at emission | `RT-09` | S |
| first | 2.6 | a send: an ordinary record entry in the child's run carrying the sender, delivered at the child's next step, resuming an inactive child; acceptance is not processing | `new (dive addendum)` | M |
| first | 2.7 | a wait: blocks on the next status or message edge registered after the call, returns `noProgress` at once when nothing can change, and wakes nobody | `new (dive addendum)` | S |
| second | 2.2 | a transfer action, target validated against the declared agents, recorded in the run | `MA-02` | M |
| second | 2.4 | a bounded background child with its own row, a parent pointer, a concurrency cap, and a cold resume that reconciles a provisioning record against the child's run | `MA-04` | L |
| second | 2.5 | one supervisor shape shipped as a tested example | `MA-06` | M |
| second | 2.8 | a claim board: owner, status, blockers and advisory write scopes, compare-and-set revisions, tombstones, and no payload field | `new (dive addendum)` | M |

**Files likely affected.** `packages/core/src/agent/managed-agent.ts`, `packages/core/src/agent/action.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/session/run-store.ts`, `packages/core/src/events.ts`, plus an example under `examples/`.

**Exit criterion.** A parent starts a child, ends, and a later run re-attaches to the child's typed result; a send reaches a running child at its next step and a parked child resumes for it; a wait returns `noProgress` when no child can move; a transfer survives a restart; a nested child's events filter by path; a claim board refuses a stale revision.

**Verification.** New tests for each item, the existing managed-agent suite unchanged, a fixture that parks and resumes a child, `pnpm gate` exit 0.

### Phase 3 — Memory and streams

**Deliverable.** History growth is handled by an event that names what was forgotten, and a stream can be followed by a later process from a cursor rather than from zero.

| # | item | ids | effort |
|---|---|---|---|
| 3.1 | condensation as an event: forgotten ids, a summary, a read-time projection, hard and soft triggers, a protected system prompt | `HL-11` | M |
| 3.2 | a resumable stream cursor over the event log, for a reconnecting UI or a second process | `RT-09` | M |

**Exit criterion.** A long fixture session condenses, the trace shows the forgetting event, and a reconnecting client receives only the events after its cursor.

**Verification.** Core and react suites, `pnpm gate` exit 0.

### Phase 4 — Protocol and tool breadth

**Deliverable.** The MCP client is as complete as the reference client for the verbs we use; tool availability becomes data a caller configures; a generator tool can stream progress; a remote guest can host declared tools; the E2B backend stops being the thinnest one; the Docker backend reaches its guest over exec and enforces deny-all.

Items here are independent and can be interleaved with Phases 3 and 5 by package, which keeps writers disjoint.

| # | item | ids | effort |
|---|---|---|---|
| 4.1 | MCP depth: capability gating, request timeout, typed local errors, bounded list aggregation, session lifecycle | `MC-01` | S each |
| 4.2 | resources, prompts and completions through the client | `MC-03` | M |
| 4.3 | progress, cancellation and list-changed notifications surfaced as events | `MC-05` | S/M |
| 4.4 | per-step tool policy as data: allowed, forced, hidden, and requirement rules | `TL-06` | M |
| 4.5 | generator tools with typed progress events, and a declared kind for provider-hosted tools | `TL-04`, `TL-07` | S/M |
| 4.6 | declared transfer of tool definitions and variables into a remote guest | `EX-10` | M |
| 4.7 | E2B backend depth: settable lifetime, per-execution timeout, keepalive, metadata, metrics, contexts | `EX-11`, `EX-03`, `EX-06` | M |
| 4.8 | the Docker exec transport (`0021`): a stdio exec session on the runtime seam, a network mode on create, a handshake frame, `jupyter.ts` deleted, and deny-all enforced | `EX-06`, `EX-04` | L |

**Exit criterion.** A policy fixture hides a tool the model must not see; a long MCP tool call reports progress and can be cancelled; a remote guest calls a host tool by name.

**Verification.** MCP, tools and exec-remote suites, a fake-runtime test for the docker transport, `pnpm gate` exit 0.

### Phase 5 — Observation and cost

**Deliverable.** Spans can be exported when a caller installs an exporter; usage is split into cached and uncached input; a run can be given a budget and stops before the next step when it is spent.

| # | item | ids | effort |
|---|---|---|---|
| 5.1 | an opt-in OTel exporter, never wired at import, with model, provider, tool, step and timing attributes | `OB-02`, `OB-03` | M |
| 5.2 | usage split, a dated price table, a decimal cost with its basis, and a budget checked between steps | `OB-06` | S/M |

**Exit criterion.** A run emits a span tree only when the caller asked; a run with a spent budget stops before the next step; an unknown price fails open, never as zero.

**Verification.** Core suite, one exporter fixture, `pnpm gate` exit 0.

### Phase 6 — Model and output depth

**Deliverable.** An adapter written against one interface version keeps working across the next; provider options have a typed home. Images are deferred under `0018`, and retrieval is decided in [`0026`](docs/09-decisions/0026-retrieval-is-in.md) as a later phase's seam.

| # | item | ids | effort | precondition |
|---|---|---|---|---|
| 6.1 | a numbered adapter interface, an upgrade shim, a conformance test per adapter | `MD-09` | L | the second breaking change is on the roadmap |
| 6.2 | image parts and a per-adapter capability flag | `MD-04` | M | a caller asks for it |
| 6.3 | a typed passthrough for cache markers and provider options | `MD-07` | S/M | none |
| 6.4 | retrieval: in or out, decided in writing | `MD-10` | L | open question 5 |

**Verification.** Models suite, the adapter conformance test, `pnpm gate` exit 0.

**Opened 2026-10-25 as `T-47`.** Items 6.1 and 6.3 execute; 6.2 is deferred because no caller has asked under `0018`; 6.4 is answered by `0026`. The item-by-item acceptance tests are in [`2026-10-25-phase-6-execution-plan.md`](docs/plans/2026-10-25-phase-6-execution-plan.md).

**Closed 2026-10-25.** 6.1 and 6.3 shipped with their acceptance tests; 6.4 is answered by [`0026`](docs/09-decisions/0026-retrieval-is-in.md); 6.2 remains deferred under [`0018`](docs/09-decisions/0018-post-0.1.0-scope-boundary.md). See the [phase report](docs/reports/2026-10-25-phase-6-report.md).

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| A Phase 0 correction breaks a caller's build | medium: API churn before 0.1.0 is unpublished | honour and deprecate where possible; one changeset per break; document the old spelling for one minor | a package test or the example stops compiling |
| The record migration strands stored runs | high: silent data loss | dual reader for one phase; a stored v1 fixture in the suite; never retire v1 in the same phase that adds v2 | a saved fixture from the previous version fails to load |
| Phase 1 grows into a rewrite | high: the loop is 700+ lines and every later item touches it | one record type, additive fields, the loop reads through store methods; stop a phase if an item changes a public signature twice | the phase plan shows edits to five or more files outside `session/` |
| Scope creep from platform-shaped neighbours | medium: architecture drift | the refuse list is a hard boundary; an item needing a new package, daemon or hosted service is out by default | a proposal introduces a server process or a new top-level package |
| The research snapshot drifts from the code | medium: a repeat of `T-30` | every phase cites ids and re-checks the row before building; the validator and docs-site link test run in the gate | a dive row says "declared" and the code disagrees |
| Two writers on the same package | medium: lost edits | phase ownership and disjoint scopes; Phase 4 is interleaved by package only | a merge or a stale-version write fails |
| Publishing waits on credentials | low: the plan is code-complete but unreleased | bundle the release with `T-14`; the plan does not depend on publication | `T-14` still blocked when Phase 2 closes |

## Rollback

Every phase ends at a commit with `pnpm gate` green, so stopping between phases leaves the project usable. Phase 0 items are individually revertable because each touches one seam. **Phase 1.2 cannot be rolled back once a store holds a v2 record** — the checkpoint is the dual reader, and v1 may only be retired after one full phase has shipped on top of v2. **Phase 1.4 cannot be rolled back once a journal exists in a durable store**: the journal must stay an additive field that old readers ignore. Phase 2's background child and claim board are the only items that create new row types; they land last in the phase and stay behind a flag until the resume path is proven.

## Open questions

- [x] **`EX-06`**: answered by [`0020`](docs/09-decisions/0020-a-capability-is-a-claim.md) — a policy axis, enforced on e2b and refused typed on the backends that cannot confine; the allow-list waits for a fetch capability.
- [x] **Public API posture for Phase 0**: answered by [`0020`](docs/09-decisions/0020-a-capability-is-a-claim.md) — `structuredOutput` is removed now, while nothing is published; the mode enum lands with a model-seam schema channel and its consumer.
- [x] **Docker deny-all**: answered by [`0021`](docs/09-decisions/0021-docker-exec-transport.md) — the exec transport replaces the Jupyter port, so deny-all is enforced from 4.8; docker refuses until then.
- [x] **Record vocabulary**: answered by [`0023`](docs/09-decisions/0023-one-identity-per-run.md) — `runId` is the identity, `waiting` the state, `pending` the reason, `resume` the verb; the public `checkpoint` option is renamed in 1.1.
- [x] **`MA-05`**: answered by [`0025`](docs/09-decisions/0025-no-blackboard.md) — no data blackboard; a typed report, a message that is a record entry, and a claim board only with a background child; delegation is opt-in and the team shelf is out of scope.
- [x] **The dive's adoptable list**: approved 2026-10-24. The ten ideas are folded into 0.1, 0.4, 0.5, 0.7, 0.8, 0.9, 1.3 and the Phase 2 cut, and no new phase item is opened for them.
- [x] **`MD-10`**: answered by [`0026`](docs/09-decisions/0026-retrieval-is-in.md) — retrieval is in, as an opt-in seam with no core hook, scheduled for a later phase.
- [x] **The refuse list**: adopted by [`0022`](docs/09-decisions/0022-the-refuse-list-is-the-boundary.md), with the blackboard row held for the delegation decision.
- [x] **`T-14` timing**: answered by [`0024`](docs/09-decisions/0024-publication-waits-for-corrections.md) — 0.1.0 waits for the correction pass and for the package to be near finished.
- [x] **Execution wave**: answered — Phase 0 runs in two waves, the loop single-writer: Wave 1 is 0.1, 0.2, 0.5, with 0.4 beside it on the disjoint `exec-remote` scope; Wave 2 is 0.3, 0.6, 0.7, 0.8, 0.9, 0.10.

## Tasks

`T-40` covers the program: it is the row that says the backlog is filed and none of it is implemented. Per-phase rows are opened when a phase starts, because the task file carries a byte cap and the phase plan is the artifact that justifies the row. **The program is open**: the owner approved it on 2026-10-24 and opened each later phase; All six phases are closed.

| Task ID | Phase | Status |
|---|---|---|
| `T-40` | program | done 2026-10-25 — Phases 0–6 closed; [Phase 6 report](docs/reports/2026-10-25-phase-6-report.md) |
| `T-41` | Phase 0 | in progress — Wave 1 |
| reserved `T-42` | Phase 1 | not yet opened |
| `T-43` | Phase 2 | done 2026-10-24 — [report](docs/reports/2026-10-24-phase-2-report.md) |
| `T-44` | Phase 3 | done 2026-10-24 — [report](docs/reports/2026-10-24-phase-3-report.md) |
| `T-45` | Phase 4 | done 2026-10-24 — [report](docs/reports/2026-10-24-phase-4-report.md) |
| `T-46` | Phase 5 | done 2026-10-25 — [report](docs/reports/2026-10-25-phase-5-report.md) |
| `T-47` | Phase 6 | done 2026-10-25 — [report](docs/reports/2026-10-25-phase-6-report.md) |

## Definition of done

The plan is done when every item in Phases 0 to 6 is either shipped with a test that failed first, or explicitly refused in a decision record; the record's failover is proven by the conformance suite; the validator reports no error and no warning; `pnpm gate` exits 0; and the research tree points at the code that closed each of its top twenty rows.

## Notes

- The research behind this plan is a pinned snapshot: [the ranked backlog](docs/research/competitors/_synthesis/20-ranked-backlog.md), [the gap matrix](docs/research/competitors/_synthesis/10-gap-matrix.md) and [the lane briefs](docs/research/competitors/README.md). Re-read a dive when starting the item it prices, not before.
- Start each phase by re-checking its rows against the code. The study already caught one stale record (`T-30`), so the first task of any phase is the cheapest possible proof that the row is still true.
- Phase 0 is deliberately unambitious. It is the phase that makes the rest trustworthy.
