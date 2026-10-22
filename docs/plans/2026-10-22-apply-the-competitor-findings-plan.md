# Plan — apply the competitor findings: fix the record, then build the three spines

**Contract**
- **Role:** the staged implementation plan derived from the 2026-10-21 competitor study; it orders work and sets exit criteria, and each phase becomes its own execution plan.
- **Mutability:** status and phase progress are edited in place; scope changes go through the open questions below, not through a quiet rewrite.
- **Read when:** deciding what to build next, or starting a phase.
- **Update when:** a phase lands, an open question is answered, or the research behind an item is superseded.

- **Status:** draft
- **Owner:** owner
- **Created:** 2026-10-22T14:20:00+03:00
- **Authorized by:** not yet approved

## Goal

Close the places where the library says one thing and does another, then build the three missing spines — durable runs, honest delegation, and protocol breadth — in an order where every phase is independently shippable and verifiably done.

## Why now

The study filed 565 gap rows against 97 capabilities, and 75 of those capabilities were contested by at least one neighbour. Two facts make this urgent rather than interesting. First, the cheapest findings are not features: five of the nine Release 1 items are corrections, and one of them (`EX-06`) is a capability claim nothing enforces. Second, every deeper item waits on the same missing seam: a run that can be paused, owned, journalled and resumed. Delegation, condensation, streaming resume and the CLI all become small once that record exists, and none of them can be built correctly before it does.

## Non-goals

- Nothing on the study's refuse list: no workspace sandbox, no MCP server authoring, no OAuth, no A2A, no graph engine, no job queue, no hosted control plane, no exporter on by default, no chat transport, no generative UI, no provider router.
- A re-run of the study. The research is a pinned snapshot; phases cite it and do not re-litigate it.
- Retrieval, multimodal and provider-spec versioning are in Phase 6 and gated by a decision, not assumed.
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

**Deliverable.** Ten small items that make the shipped surface honest: approval bound to the call it approves; the output schema bound to the final answer rather than to a model flag; one bounded repair attempt; egress enforced where a backend can and refused where it cannot; a schema version on stored state; a written rule for what a guardrail trip persists; a deadline on every tool; a conformance suite for stores; a request-owned budget with a typed stop reason; and structured output proven on a model that cannot call tools.

**Files likely affected.** `packages/core/src/agent/approval.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/agent/guardrail.ts`, `packages/core/src/model.ts`, `packages/core/src/events.ts`, `packages/core/src/session/run-store.ts`, `packages/core/src/agent/run-result.ts`, `packages/tools/src/index.ts`, `packages/exec-remote/src/backends/e2b.ts`, the model seam and its tests, and the tests beside each.

**Items, in order of independence.** All are S or M; none touches another item's files.

| # | item | ids | done when |
|---|---|---|---|
| 0.1 | approval records a request id and an input digest; a verdict for another call or another input is refused typed; malformed verdicts fail closed; the decision is an event | `HL-01`, `HL-12` | a test approves one call, edits one argument, and asserts no side effect |
| 0.2 | the schema binds to `final_answer` in both flavours, a mismatch returns as an observation, and `ModelCapabilities.structuredOutput` is removed (`0020` refuses the mode enum) | `GR-05` | a wrong-shaped answer names the offending path in the observation, and no model capability field is unread |
| 0.3 | one repair attempt: schema failure returns as a history message, with a separate budget, and never after a length finish | `GR-06` | a scripted model fails twice then returns valid; run succeeds with two attempts recorded |
| 0.4 | an `egress: "unmanaged" \| "deny-all"` policy axis; e2b passes the vendor's deny through its seam; docker and process refuse a deny-all request typed; `network` stays reach only | `EX-06` | the e2b double shows the deny option at create, and docker or process throws before the guest starts |
| 0.5 | stored records carry one integer version; old values load; a newer value is refused with a typed error | `HL-10` | a fixture written at version 1 loads, and a version beyond the current one refuses |
| 0.6 | a written and tested rule for what a tripped guardrail does to the checkpoint, the session and the trace | `GR-01` | blocked output is absent from every persisted artifact, and the trace says it was redacted |
| 0.7 | every tool gets a finite default deadline with an explicit opt-out and a typed timeout error | `TL-05` | a hanging tool fails the step; the error names which limit fired |
| 0.8 | an importable conformance suite covering the ten failure modes in the durability brief | `DS-09` | the file store passes it and the suite is documented as the contract |
| 0.9 | request-owned turn, output-token and total-token limits; typed stop reason; a result handle that continues the same budget | `RT-06`, `RT-08`, `RT-13` | a second call with the returned handle keeps counting and reports `limitTotalTokens` |
| 0.10 | structured output proven on a model that cannot call tools: the bound schema plus the repair turn, not a forced tool | `GR-06`, `GR-05` | a scripted model with `toolCalls: false` still ends with a schema-valid answer inside the attempt bound |

**Exit criterion.** No row in the baseline that this phase touches is described as "declared" while the code does nothing, and every item has a test that failed first.

**Verification.** `pnpm --filter @smolagents-ts/core test`, `pnpm --filter @smolagents-ts/models test`, `pnpm --filter @smolagents-ts/tools test`, `pnpm --filter @smolagents-ts/exec-remote test`, then `pnpm gate` exit 0.

### Phase 1 — The durability spine

**Deliverable.** A run is a record, not a checkpoint of steps. The record carries a schema version, a generation for ownership, a completed flag, an effects journal, a pending request, an agent fingerprint and a parent pointer. A second process cannot write it; a paused run resumes by request id; a crash inside a step replays the journal instead of the effect.

This phase is strictly ordered. Each item extends the type the previous one introduced, so no two items here are parallel.

| # | item | ids | depends on |
|---|---|---|---|
| 1.1 | the record type and its commit boundary; the loop commits at one place, the store never invents one | `HL-03`, `HL-04`, `HL-09` | Phase 0.5 |
| 1.2 | a pending request as state: kind, request id, digest, payload, and `resume(requestId, value)` | `HL-02`, `HL-06` | 1.1 |
| 1.3 | one owner at a time, by compare-and-set generation or a claim record; a stale writer is refused typed | `HL-04` | 1.1 |
| 1.4 | an effects journal: the model request and each wrapped tool call are recorded and replayed, with an explicit in-doubt state for effects we cannot verify | `HL-05` | 1.1–1.3 |
| 1.5 | a file store implementation that passes the Phase 0.8 suite | `HL-09` | 1.1–1.4 |
| 1.6 | `--resume` and `--approve` in the CLI, against the same store | `CL-03` | 1.2, 1.5 |
| 1.7 | a conversation identity that outlives a run, with the run pointing at it | `HL-08` | 1.1 |
| 1.8 | fork or replay from a named step, without repeating effects | `HL-07` | 1.4 |

**Files likely affected.** `packages/core/src/session/run-store.ts`, `packages/core/src/session/agent-session.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/agent/run-result.ts`, `packages/core/src/events.ts`, `packages/core/src/index.ts`, `packages/cli/src/args.ts`, `packages/cli/src/run.ts`, plus one new file for the file store and one for the conformance suite.

**Exit criterion.** In a single test: a run pauses on an approval, the first process stores it, a second process reads the record, refuses a wrong owner, resumes with `resume`, and finishes; separately, a crash injected after a tool call resumes without repeating it.

**Verification.** The store conformance suite, the ten failure-mode fixtures, `pnpm gate` exit 0, and one manual two-process run recorded in the phase report.

### Phase 2 — Delegation that survives its parent

**Deliverable.** A child returns a validated value or a typed error; control can transfer and that transfer is persisted; every event carries the path of the agents that produced it; a child can run in the background and be re-attached in a later run.

Depends on Phase 1.1 to 1.4. Build in this order because each one makes the next cheap: a typed report needs nothing new, a transfer needs the pending-request machinery, a background child needs ownership and a child row.

| # | item | ids | effort |
|---|---|---|---|
| 2.1 | a typed child report, with a typed failure channel separate from the value | `MA-03` | S |
| 2.2 | a transfer action, target validated against the declared agents, recorded in the run | `MA-02` | M |
| 2.3 | an agent path on every event, enriched at emission | `RT-09` | S |
| 2.4 | a bounded background child with its own row, a parent pointer and a concurrency cap | `MA-04` | L |
| 2.5 | one supervisor shape shipped as a tested example | `MA-06` | M |
| 2.6 | a message injected into a running turn at a step boundary | `RT-11` | M |

**Files likely affected.** `packages/core/src/agent/managed-agent.ts`, `packages/core/src/agent/action.ts`, `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/session/run-store.ts`, `packages/core/src/events.ts`, plus an example under `examples/`.

**Exit criterion.** A parent starts a child, ends, and a later run re-attaches to the child's typed result; a transfer survives a restart; a nested child's events filter by path.

**Verification.** New tests for each item, the existing managed-agent suite unchanged, `pnpm gate` exit 0.

### Phase 3 — Memory and streams

**Deliverable.** History growth is handled by an event that names what was forgotten, and a stream can be followed by a later process from a cursor rather than from zero.

| # | item | ids | effort |
|---|---|---|---|
| 3.1 | condensation as an event: forgotten ids, a summary, a read-time projection, hard and soft triggers, a protected system prompt | `HL-11` | M |
| 3.2 | a resumable stream cursor over the event log, for a reconnecting UI or a second process | `RT-09` | M |

**Exit criterion.** A long fixture session condenses, the trace shows the forgetting event, and a reconnecting client receives only the events after its cursor.

**Verification.** Core and react suites, `pnpm gate` exit 0.

### Phase 4 — Protocol and tool breadth

**Deliverable.** The MCP client is as complete as the reference client for the verbs we use; tool availability becomes data a caller configures; a generator tool can stream progress; a remote guest can host declared tools; the E2B backend stops being the thinnest one.

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

**Exit criterion.** A policy fixture hides a tool the model must not see; a long MCP tool call reports progress and can be cancelled; a remote guest calls a host tool by name.

**Verification.** MCP, tools and exec-remote suites, `pnpm gate` exit 0.

### Phase 5 — Observation and cost

**Deliverable.** Spans can be exported when a caller installs an exporter; usage is split into cached and uncached input; a run can be given a budget and stops before the next step when it is spent.

| # | item | ids | effort |
|---|---|---|---|
| 5.1 | an opt-in OTel exporter, never wired at import, with model, provider, tool, step and timing attributes | `OB-02`, `OB-03` | M |
| 5.2 | usage split, a dated price table, a decimal cost with its basis, and a budget checked between steps | `OB-06` | S/M |

**Exit criterion.** A run emits a span tree only when the caller asked; a run with a spent budget stops before the next step; an unknown price fails open, never as zero.

**Verification.** Core suite, one exporter fixture, `pnpm gate` exit 0.

### Phase 6 — Model and output depth

**Deliverable.** An adapter written against one interface version keeps working across the next; images are a message part; provider options have a typed home. Retrieval stays a decision, not an item.

| # | item | ids | effort | precondition |
|---|---|---|---|---|
| 6.1 | a numbered adapter interface, an upgrade shim, a conformance test per adapter | `MD-09` | L | the second breaking change is on the roadmap |
| 6.2 | image parts and a per-adapter capability flag | `MD-04` | M | a caller asks for it |
| 6.3 | a typed passthrough for cache markers and provider options | `MD-07` | S/M | none |
| 6.4 | retrieval: in or out, decided in writing | `MD-10` | L | open question 5 |

**Verification.** Models suite, the adapter conformance test, `pnpm gate` exit 0.

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

Every phase ends at a commit with `pnpm gate` green, so stopping between phases leaves the project usable. Phase 0 items are individually revertable because each touches one seam. **Phase 1.2 cannot be rolled back once a store holds a v2 record** — the checkpoint is the dual reader, and v1 may only be retired after one full phase has shipped on top of v2. **Phase 1.4 cannot be rolled back once a journal exists in a durable store**: the journal must stay an additive field that old readers ignore. Phase 2's background child is the only item that creates a new row type; it lands last in its phase and is guarded by a flag until the resume path is proven.

## Open questions

- [x] **`EX-06`**: answered by [`0020`](docs/09-decisions/0020-a-capability-is-a-claim.md) — a policy axis, enforced on e2b and refused typed on the backends that cannot confine; the allow-list waits for a fetch capability.
- [x] **Public API posture for Phase 0**: answered by [`0020`](docs/09-decisions/0020-a-capability-is-a-claim.md) — `structuredOutput` is removed now, while nothing is published; the mode enum lands with a model-seam schema channel and its consumer.
- [ ] **Docker deny-all**: a sidecar or an exec-based transport, decided when the guest contract lands. Not blocking.
- [ ] **Record vocabulary**: is the durable pause called a *pending request*, a *pause*, or an *interrupt*? Blocks Phase 1.2 naming, not its design.
- [ ] **`MA-05`**: confirm in writing that there is no shared blackboard by default. Not blocking.
- [ ] **`MD-10`**: retrieval in or out; the plan defaults to out. Blocks Phase 6.4 only.
- [ ] **The refuse list**: record it as an accepted decision so it stops being re-argued. Not blocking.
- [ ] **`T-14` timing**: if 0.1.0 publishes before Phase 0 lands, decide whether the known-wrong declarations ship with a documented note or wait. Blocks the release, not the work.
- [ ] **Execution wave**: one phase per session with its own plan, or Phase 0 items split across two sessions? Not blocking.

## Tasks

`T-40` covers the program: it is the row that says the backlog is filed and none of it is implemented. Per-phase rows are opened when a phase starts, because the task file carries a byte cap and the phase plan is the artifact that justifies the row.

| Task ID | Phase | Status |
|---|---|---|
| `T-40` | program | pending — owner picks the phase |
| reserved `T-41` | Phase 0 | not yet opened |
| reserved `T-42` | Phase 1 | not yet opened |
| reserved `T-43` | Phase 2 | not yet opened |
| reserved `T-44` | Phase 3 | not yet opened |
| reserved `T-45` | Phase 4 | not yet opened |
| reserved `T-46` | Phase 5 | not yet opened |
| reserved `T-47` | Phase 6 | not yet opened |

## Definition of done

The plan is done when every item in Phases 0 to 5 is either shipped with a test that failed first, or explicitly refused in a decision record; the record's failover is proven by the conformance suite; the validator reports no error and no warning; `pnpm gate` exits 0; and the research tree points at the code that closed each of its top twenty rows.

## Notes

- The research behind this plan is a pinned snapshot: [the ranked backlog](docs/research/competitors/_synthesis/20-ranked-backlog.md), [the gap matrix](docs/research/competitors/_synthesis/10-gap-matrix.md) and [the lane briefs](docs/research/competitors/README.md). Re-read a dive when starting the item it prices, not before.
- Start each phase by re-checking its rows against the code. The study already caught one stale record (`T-30`), so the first task of any phase is the cheapest possible proof that the row is still true.
- Phase 0 is deliberately unambitious. It is the phase that makes the rest trustworthy.
