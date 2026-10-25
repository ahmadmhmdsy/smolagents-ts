# Open decisions — release and after: decision plan

**Date:** 2026-10-25 · **Status:** in_progress · **Owner:** lead · **Revision reviewed:** `d7e1677` (main equals origin/main)

**Contract**
- **Role:** the decision agenda that follows the Phase 0–6 program — every open row, the options behind it, a recommendation, the longer-term cost of each choice, and the register that records what the owner picks.
- **Mutability:** a live register plus pinned option comparisons. A decision updates its register row and appends to `## Changes`; an option comparison is corrected by a new `## Changes` entry, never rewritten in place.
- **Read when:** choosing the next unit of work, or executing the implementation once the register is settled.
- **Update when:** the owner decides a row, a recommendation is accepted or rejected, or a premise stops matching the code.

**Status:** filed 2026-10-25. D-01 to D-08 are decided; the rest of the register is open. Implementation starts only after the register is settled. Each discussion picks one row, so this file is the durable copy of the agenda and the decisions.

## Why this plan

The six-phase program closed at `d7e1677` with a clean tree, green CI and 1317 passing tests. What remains is not repair work: four rows stand between the tree and a publishable 0.1.0, five rows are post-release improvements, two rows are stale because the code already ships the behaviour, and the rest are parked decisions whose date is the owner's to set. The value of writing them down in one place is that each one can be decided on the same evidence, and none is settled by accident while fixing its neighbour.

One finding came out of writing this file rather than out of the task board: the budget ending and the step ending reach `.run()` through different paths and are reported differently, and the budget one is reported wrongly. It is folded into D-01 because deciding the step ending alone would hard-code the inconsistency.

## What this plan covers

Sources swept, all at `d7e1677`:

- the eleven live rows in [the task file](../04-tasks.md);
- the `## Open` section of each of the six phase reports (see [the Phase 6 report](../reports/2026-10-25-phase-6-report.md) for the newest);
- decisions [0016](../09-decisions/0016-pyodide-interrupt-boundary.md), [0017](../09-decisions/0017-supply-chain-posture.md), [0018](../09-decisions/0018-post-0.1.0-scope-boundary.md), [0019](../09-decisions/0019-no-gateway-package.md), [0024](../09-decisions/0024-release-waits-for-correction-pass.md) and [0026](../09-decisions/0026-retrieval-is-in.md);
- the T-16 and T-18 research addenda and the T-39 gateway note under `docs/research/`;
- [the release-readiness plan](2026-10-16-release-0.1.0-readiness-plan.md) and [the publish runbook](../10-runbooks/publish-0.1.0.md).

## The board today

| row | item | real state | gate | effort |
|---|---|---|---|---|
| `T-14` | publish 0.1.0 | ready except credentials; `main` in sync, CI green on the first push | owner: npm token and scope | 20–30 min plus propagation |
| `T-16` | planning cadence | code still plans later than upstream; one-line guard | owner decision | XS |
| `T-18` | budget-exhausted ending | throws a typed error; the dead state value is still declared | owner decision | XS |
| `T-19` | parity tool scenario | corpus refuses tool scenarios on purpose; both readers ignore `tools` | none | M |
| `T-21` | recordings versus design pin | recordings track the installed 1.14.0; the design pins 1.27.0.dev0 | owner decision | XS |
| `T-24` | Pyodide interrupt | in-process executor cannot interrupt a CPU-bound loop; 0016 defers | none | M |
| `T-25` | supply-chain posture | quarantine and three exclusions stand; unconfirmed in writing | owner confirmation | XS |
| `T-26` | Gemini null usage | **stale** — handled and tested | close the row | XS |
| `T-28` | `ChatSurface` transcript | takes caller-supplied messages; no session projection | none | S |
| `T-29` | `agent.on(type, handler)` | **stale** — the overload shipped and is tested | close the row | XS |
| `T-39` | OmniRoute | phase 0 decided (option A) 2026-10-25; phase 1 parked as `T-54` | none for phase 0 | S/M for phase 0, L for phase 1 |

## Rows that are stale — close, do not decide

### T-26 — Gemini's null `usageMetadata`

`fromWireUsage` takes `undefined | null` and answers the empty usage object, and the stream side tolerates a null usage on a later event without zeroing the total. Two cases already pin it by name: `gemini.test.ts` (the generate-content answer) and `gemini-stream.test.ts` (the late null). The row asked for hardening once a provider was seen sending null; the code hardened in the same phase that wrote the guard, so the row is a leftover.

**Recommendation:** close it with the two test names as evidence. Nothing else to do.

### T-29 — `agent.on(type, handler)`

The loop already declares the two-overload signature, filters by type, returns an unsubscribe and throws a `TypeError` when the handler is missing; `core-loop-fixes.test.ts` has a describe block named after the overload. The design chapter and the code agree today.

**Recommendation:** close it, citing that describe block. Nothing else to do.

Both closes are one tasks edit and no code; they can ride with the first decision's commit.

## The decisions

### D-01 — what `.run()` does when a run runs out of room (T-18, plus the budget hole)

**Row:** T-18. **Blocks 0.1.0:** yes, it changes a public type or a public method's contract. **Effort:** S.

#### What the code does today

- When the step loop is used up, the loop emits the terminal `run.maxStepsReached`, commits the record as failed, and `.run()` throws `AgentMaxStepsError` with code `AGENT_MAX_STEPS`. `.stream()` returns normally after the terminal event.
- `RunResult.state` still offers `max_steps_reached`, and no path ever returns a result in that state. The value is a leftover from the design's earlier shape and nothing consumes it.
- The cost, token and turn ceilings end through the terminal `run.limitReached` instead. `.run()` has no branch for that event, so its generic tail throws a plain `AgentError` whose message says the run ended without a terminal event — which is both untrue and unhelpful for a condition that is normal in production. The budget suites only read the stream, so no test catches this.
- Upstream 1.14 spends one more model call after the budget, appends an action step that carries the error and the usage, and returns the text with the state `max_steps_error`. That divergence is already recorded as D8 in the design; nothing here is a surprise.

The two endings raise one contract question, not two: what a caller gets when the run stopped for lack of room. Fixing only the step ending would leave the budget ending mislabeled.

#### Options

| option | what changes | cost | consequence |
|---|---|---|---|
| A. Throw, but type it and tell the truth | add an `AgentBudgetExceededError` carrying the stop reason and the spent usage; delete the dead `max_steps_reached` state; document that `.stream()` is how partial output is kept; correct the design chapter | S | every non-success ending is one catch clause; the public contract says throws without exceptions; the error taxonomy grows additively |
| B. Follow upstream and return a result | after the ceiling, append a synthetic step (and optionally one more model call), return the text with the state set, never throw for a ceiling | M/L | closest to upstream; a run that did not finish returns a value shaped like a finished one; the returned text skipped the guardrails and the output schema; the extra call sits outside the ceiling it just hit |
| C. Let the caller opt in | keep throwing by default, return a partial result under a new run option | M | two contracts to keep tested and supported before a single caller has asked for the second one |
| D. Keep today and document it | no code | XS | keeps a public type value nothing produces and a misleading error for budget stops |

#### Recommendation: A

Error classes grow additively and can be renamed or widened without breaking a consumer; the return shape of `.run()` cannot change without a major version. A caller that wants the partial transcript already has it: `.stream()` yields every step and every event before the terminal one, so option B buys nothing that streaming does not already provide, and it buys it at the price of making an unfinished run look finished. That matters beyond aesthetics: guardrails and the bound output schema exist to certify an answer, and the upstream-style post-ceiling text has passed neither.

Option A also turns the budget hole from a wrong message into a named error, which is the difference between a caller writing `catch (error instanceof AgentMaxStepsError || error instanceof AgentBudgetExceededError)` and a caller debugging a message that says a terminal event was missing when it was not.

#### Why this is the right choice long term

The library will keep its error taxonomy for the whole 1.x line; adding names to it later is easy, redefining what `.run()` returns later is a major. Streaming as the partial-output channel is already the design's spine — the session store, the React layer, the CLI and the trace exporter all consume it — so making the error the only non-success signal keeps one story for a run that stopped early. If a caller ever needs a value-returning variant, it can land as a separate method or an additive overload rather than as a change to `.run()`.

#### If you choose otherwise

Option B needs a second decision attached: whether the extra model call is allowed outside the ceiling, whether the returned text must pass the guardrails, and whether the budget stop then becomes a `RunResult.state` value or keeps throwing under a different name. It is a coherent design, but it is a phase-sized one, not a pre-release edit.

#### Decision (2026-10-25)

**Option A.** Both ceilings throw typed errors; `AgentBudgetExceededError` (code `AGENT_BUDGET_EXCEEDED`) joins `AgentMaxStepsError`; the dead `max_steps_reached` state is removed; `.stream()` stays the partial-output channel; design chapter 14.1 is corrected to say exhaustion throws.

Two sub-choices travel with the implementation and are recorded here so they are not lost:

- **What the error carries.** Reason only keeps the `run.limitReached` event untouched; reason plus the spent snapshot needs one optional field on that event. Default: reason only, with the spent numbers left to the event and the budget handle.
- **Child stop reason.** A budget-exhausted child currently lands in `"failure"` because only the max-steps error is mapped. Default: add `"budget"` to `ChildStopReason` and map the new error, so the child vocabulary stays as precise as the run vocabulary.

Implementation is deferred until the register is settled, per the plan's contract.

### D-02 — planning cadence (T-16)

**Row:** T-16. **Blocks 0.1.0:** changes model-call order for anyone who enables planning. **Effort:** S.

#### Context

Upstream plans before the first action (step 0), then every `planning_interval` steps. The port guards on `stepIndex > 0`, so it plans after the first action instead. The design chapter's pseudocode shows the guard, so the code follows the document — but the document was written from an early reading of upstream, not from a decision. The T-16 note records three separate gaps: the cadence, the fact that upstream re-plans with a different input (summary-mode memory plus a separate message) where this port reuses the same input, and two seams to host those. Only the first gap is a one-line change.

#### Options

| option | what changes | cost | consequence |
|---|---|---|---|
| A. Port the whole lane | cadence, both prompt templates, the model and memory seams | L | full parity for planning, at the price of surface the phase plan never scoped |
| B. Match the cadence only | delete the `stepIndex > 0` guard at `multi-step-agent.ts:1114`; re-order the planning tests' scripted turns (four test files pin the order); correct design line 391 | S | the first plan happens when upstream's does; the prompt input still differs, and no recording can show either way because every scenario leaves the interval at 0 |
| C. Keep it and record the divergence | one note | XS | the port keeps an unscheduled, unexplained difference from upstream |

#### Recommendation: B

The guard is an artefact of transcription, not a choice anyone made: the design's own pseudocode has it because the reading it came from had it. Restoring upstream's rule is one line in the loop, and it is cheaper before 0.1.0 than after, because it changes which turns carry a planning message. The blast radius is wider than the research note estimated: four test files script a plan turn in the second position, so the loop's first call changing from an action to a plan re-orders each of them, alongside the design line. The remaining gap — a different input for the summary plan — should be named in the record and left to the phase that can schedule it, so nobody reads the cadence fix as a parity claim.

Long term, planning is a niche lane (most callers never set an interval), so spending a phase on prompt parity before the release would delay the release for a feature with no recordings behind it. Doing the one-line half now removes the accidental divergence; the deliberate half gets its own row.

#### Decision (2026-10-25)

**Option A, structurally.** The owner chose the whole lane, on the scale argument: planning exists for long runs, and only the summary-mode update input keeps the planning call from growing with the transcript. The lane matches upstream's behaviour shape — a plan at step 0 and every interval after, an initial-plan template carrying the task, tools and managed agents, update plans from a system prelude, summary-mode memory and a remaining-steps postlude, the `<end_plan>` stop sequence and the plan wrapper. `AgentMemory.toMessages` gains the summary-mode branch.

**Boundary:** the three templates are re-authored in this project's voice with upstream's structure, not copied; wording parity is not claimed. Byte-level fidelity, if ever wanted, is a new record. Decision [`0028`](../09-decisions/0028-planning-is-structurally-upstream-shaped.md) records the choice and its costs, including the extra planning call before the first action.

### D-03 — supply-chain confirmation (T-25)

**Row:** T-25. **Blocks 0.1.0:** only as a confirmation. **Effort:** XS.

#### Context

Decision [0017](../09-decisions/0017-supply-chain-posture.md) froze a quarantine window and three exact-version exclusions after the September incident review. The row asks the owner to confirm the posture rather than change it. Nothing in the tree has moved since: the package manager settings and the lockfile held through six phases, and CI installs from the lockfile.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Confirm | XS | the posture stays frozen; the row closes with the confirmation date |
| B. Reverse or relax it | S | reopens a security decision with no new evidence, and needs its own record |
| C. Leave the row open | XS | the board keeps a dead row, which is how boards stop being read |

#### Recommendation: A

A confirmation is the cheapest useful outcome and it is what the row was written for. Record the date and the fact that nothing changed, then close; if the owner later wants the exclusions re-examined, that is a new decision with fresh evidence, which is exactly the rule 0017 was written to enforce.

#### Decision (2026-10-25)

**Option A — confirmed, with the scope sentence and the release rule recorded.** The quarantine and the three exact-version exclusions stand unchanged. They apply to this development tree only and ship with no package, and the exclusion list is the evidence the quarantine is active — `pnpm config get minimumReleaseAge` prints `undefined` on a machine where it plainly is. Each exclusion is temporary: at the next vendor-peer bump it is deleted unless the frozen-lockfile install still needs it. The one weakness — nothing stops a local install appending a fourth entry to the tracked list — is deliberately left to the post-release hardening batch (D-12) rather than fixed here.

### D-04 — which upstream the recordings track (T-21)

**Row:** T-21. **Blocks 0.1.0:** no. **Effort:** XS (or M to re-record).

#### Context

The parity corpus under `scripts/parity/recordings/` was recorded against the installed 1.14.0 distribution. The design specification pins the 1.27.0.dev0 source clone. Both are honest at once — a recording is evidence of what one version did — but a reader who finds one pin in the design and a different one in the tests cannot tell which comparison is current. The research memory already warns that two upstream pins are two different comparisons.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Keep 1.14.0 recordings and record the split | XS | the recordings keep saying what was observed; one sentence tells a reader where the other pin lives |
| B. Re-record everything against 1.27.0.dev0 | M | one pin everywhere, at the price of replacing the whole corpus and losing the comparisons the six phases were reviewed against |
| C. Keep both corpora | M | double maintenance for a question nobody is asking today |

#### Recommendation: A

Recordings are observations, and the observation happened on 1.14.0; rewriting them to a newer pin would discard the evidence the phases were built on. The fix is to put the split where a reader meets it — the design's pin line or the parity README — and to note that re-recording is a new comparison, not a correction. If the owner wants a 1.27 comparison later, that is a task with a purpose, not maintenance.

#### Decision (2026-10-25)

**Option A — keep the corpus, state the split, and rule the re-record.** The corpus stays on the 1.14.0 release. The design's pin names what the design read (`main` at commit `96f33fa`, `v1.27.0.dev0`); each recording names what the corpus observed; neither is a support range. The live split and the "no upstream API-compatibility range is claimed" statement go in [`docs/01-project.md`](../01-project.md), because the design record is history and is not edited. A re-record is a deliberate comparison with a purpose, and when it happens the suite constant, the runbook and the recordings move in one change — recorded in [`0029`](../09-decisions/0029-the-parity-corpus-stays-on-the-release.md) and in the recording runbook.

### D-05 — the 0.1.0 gate (T-14)

**Row:** T-14. **Blocks:** everything intended for the first release. **Effort:** 20–30 min plus registry propagation.

#### Context

The publish runbook is written and its preconditions are now satisfied except the credentials: the tree is clean, `main` equals `origin/main`, the first CI run on `d7e1677` passed, versions and changesets were reconciled in the 2026-10-21 correction pass, and the validator and gate are green. The runbook is irreversible in one direction: the fixed version group means the version cannot be republished, and a tag that disagrees with the registry is the failure mode it warns about most.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Publish as soon as the token exists | XS | the program becomes a release; D-01 and D-02 must be decided first because both change behaviour |
| B. Publish after the post-release rows land | days | delays value for additive work and keeps the repository in an unreleased state longer, which is the risk 0024 was written to avoid |
| C. Publish a prerelease first | S | the runbook forbids it without a record, and a second release path needs its own maintenance |

#### Recommendation: A, after D-01 through D-04 are decided

The release is the point of the program; the clean tree and the green CI are the evidence the corrections pass was waiting for. The only rows that must precede it are the ones that change public behaviour or public types (D-01, D-02) and the two record-only confirmations (D-03, D-04), which cost minutes. Everything else in this plan is additive and can ship in 0.2.0.

Two things belong to the release but are not code: a one-line scope statement in the release note that 0.1.0 contains the six phases, and a post-publish consumer check from the registry — the runbook already includes a fresh-directory install, so the second is a step to run, not a task to add.

#### Decision (2026-10-25)

**Option A — publish after the pre-release set, under a stated gate.** 0.1.0 contains the six-phase program plus `D-01` and `D-02` (and `D-06` if it is decided pre-release); the additive rows ship later. The gate is recorded in [`0030`](../09-decisions/0030-the-0-1-0-gate.md): the two behaviour decisions implemented and documented, the gate and CI green on the exact release revision, the `@smolagents-ts` scope owned and a publish token with 2FA bypass in `~/.npmrc`, a release note on the facade tag carrying the scope line, and the runbook's post-publish consumer check. The four items flagged in the discussion are folded in: the stale step-3 expectation and the missing token/recovery rows are corrected in the runbook, the release-note step is added, the scope-ownership precondition is now a checklist step with commands, and the first-run evidence is named a deliverable.

### D-06 — the transcript `ChatSurface` renders (T-28)

**Row:** T-28. **Blocks 0.1.0:** no. **Effort:** S.

#### Context

`ChatSurface` takes `messages` from its caller and renders them, while the run it sits in is fully described by the session's snapshot. The example therefore hands it a fixed transcript, which is the one place in the React package where the rendering and the run can disagree. The session already holds the steps; the loop already builds the transcript it sends to the model.

#### Options

| option | cost | consequence |
|---|---|---|
| A. The snapshot grows a `messages` projection, and `ChatSurface` reads it | S | one source of truth across CLI, React and the model call; one additive snapshot field |
| B. Derive the rows inside the React package from the steps | S | core stays smaller, but the role and part mapping is written twice and drifts from what the model saw |
| C. A separate hook builds the projection on the client | S | same duplication, plus another tested surface |

#### Recommendation: A, immediately after the release

Additive, small, and it removes a class of divergence rather than one instance: the transcript the UI shows should be the transcript the next model call sees. Doing it after the release keeps 0.1.0's surface smaller and lets the example change in a normal feature commit; doing it at all is what makes the React layer honest.

#### Decision (2026-10-25)

**Option A with the lossy projection (A1), pre-release.** The row's binary framing was incomplete: `AgentMemory.toChatMessages()` already exists, is documented as "the derived chat view used by the React shell (design spec 5.3)", is tested, and was never wired. The choice is therefore to finish the seam, not to build one.

The snapshot gains `messages`: the task, each action's assistant output, inter-agent messages and the final answer -- not `toMessages`, so observations and plan wrappers stay out of the conversation. `MultiStepAgent` gains one read-only accessor delegating to the memory renderer, so there is one implementation. The session recomputes the list at step boundaries only, never on a delta, which is also why the step in flight is absent from it. `ChatSurfaceProps.messages` becomes optional and defaults to the snapshot's value, so the change is source-compatible and the example drops its constant; a caller that wants the model transcript or the run view keeps using `toMessages` or `RunInspector`.

Two consequences are recorded with the decision rather than left to implementation: the transcript mirrors memory, so it spans turns only for a checkpointed session (without one it resets per run), and the projection is lossy by design, so no surface may claim to show the run. Decision [`0031`](../09-decisions/0031-the-snapshot-carries-the-conversation.md) records the choice and its costs. Implementation is deferred until the register is settled.

### D-07 — a tool scenario in the parity corpus (T-19)

**Row:** T-19. **Blocks 0.1.0:** no. **Effort:** M.

#### Context

Every recording in the corpus declares an empty tool list, and the Python recorder refuses a scenario that names tools, because it builds no tool for the model to call. The TS reader has the same gap. The corpus therefore compares the loop's structure everywhere except the branch that actually matters for a tool-using agent.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Teach both readers to wire a deterministic tool, add one scenario and its recording | M | the structural comparison reaches the tool branch; the recorder's refusal becomes a real assertion in the other direction |
| B. Keep the corpus tool-free | XS | parity claims stay silent about the main surface, which is worse than a narrower claim |
| C. Wire tools on one side only | S | compares two runs that behave differently, so the diff is noise |

#### Recommendation: A, after the release

It is the unfinished half of the harness, and it is test-only work with no public surface, which makes it safe to do between releases. The recorder's refusal is the work item: both readers need a stub tool whose answer is fixed, then a scenario that calls it once and observes the result.
#### Decision (2026-10-25)

**Option B, with two scenarios, post-release.** Reading the harness first corrected the row: a stub tool inside a CodeAgent scenario changes no compared field, because upstream records only `python_interpreter` on the step (`agents.py:1715-1721`), our code turns carry no tool calls (`multi-step-agent.ts:1183`), and prompt, code and observation text are never compared. The observable branch is the model-emitted call.

So the scenario schema gains an `agent` axis (`"code" | "tool-calling"`, absent meaning `"code"`) and tool-calling turns gain `calls`; one shared `echo` stub is defined identically on both legs; the family adds a success scenario (call the stub, then answer) and an unknown-tool failure scenario (call a missing name, then recover). The trace fields do not change. The failure scenario is expected to measure a real difference -- upstream marks the step errored and keeps no call list (`agents.py:1466`, `:597-599`), ours records the failed call and continues (`tool-calling-agent.ts:142-148`) -- so a divergence there is pinned with `differsOn` and a `why`, and aligning the loop is a separate decision.

The five existing scenarios and recordings stay untouched; the recorder's blanket refusal narrows to a precise rule; the runbook's scenario procedure is rewritten with the family. Code-called tools stay out (`0007`'s executor boundary), as do parallel calls and approvals. Decision [`0032`](../09-decisions/0032-the-corpus-grows-a-tool-calling-family.md) records the choice and its costs.

### D-08 — OmniRoute intake (T-39)

**Row:** T-39. **Blocks 0.1.0:** no. **Effort:** S/M for phase 0, L for phase 1.

#### Context

The research note confirms the gateway speaks the OpenAI-compatible wire and therefore already works through `OpenAICompatibleModel`; nothing in the code needs to change to use it. The gap is documentation, an example, and a fixture that keeps the claim from rotting. A first-class package or adapter would need a decision record and the anti-sprawl test's approval.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Phase 0: docs page, example, one four-frame fixture | S/M | the working path is documented and regression-tested; no package, no new export |
| B. Phase 1: a `models-gateway` package | L | a home for routing and cost metadata, at the price of the seventh package and a decision record |
| C. A named adapter class | S | one permanent export for a `baseUrl` the compatible adapter already takes |
| D. Extend the model seam with headers | M | makes one gateway a core concept; breaks every adapter for a value that already flows through options |

#### Recommendation: A now; B only on the owner's word

Phase 0 is the research's own recommendation and needs no decision. Phase 1 is legitimate but should be opened as a phase of its own with a record, not slipped in under a research row. C and D should stay refused: the compatible adapter already carries the gateway, and the extra seam would teach the core a provider field, which is the one invariant both Phase 6 and 0019 protect.

#### Decision (2026-10-25)

**Option A.** Reachability is documented and regression-tested; the gateway package is not opened.

- **Docs.** A "Gateways and proxies" subsection in `README.md` — the two-line constructor recipe, the exact CLI form (`--model-type OpenAIModel --api-base http://localhost:20128/v1 --model-id auto --api-key …`), the browser-CORS note, the localhost-only-while-`REQUIRE_API_KEY=false` note and a link — plus a new runbook under `docs/10-runbooks/` with an index row, carrying preconditions, steps, verification, rollback, the model-id determinism rule, the `GET /v1/models` discovery note, the `AbortSignal` timeout hook, and the statement that retry is the caller's.
- **Example.** A new `examples/gateway/`, shaped like `examples/live-provider`: it prints SKIPPED and exits 0 without `OMNIROUTE_BASE_URL`, then drives `generate`, `generateStream` and one `CodeAgent` run through `OpenAICompatibleModel`. Extending `live-provider` was refused — one purpose per example, and its test pins its skip message.
- **Fixture.** `packages/models/test/fixtures/openai-compatible-gateway.sse.txt`, hand-shaped from the research shard's frame inventory, with a test pinning the keepalive drop, the error-as-data throw with no key in the message, one usage chunk from a `choices: []` frame and one finish chunk. Named by wire shape, not by the gateway, because LiteLLM and Portkey emit the same frames; the comment cites the shard and `3.8.53` and never claims a recording.
- **Scheduling.** Phase 0 is additive — no public export, no core change, no gate change — so it gates nothing. It is scheduled after the pre-release implementation set if the owner's timing allows, otherwise immediately post-release.
- **Phase 1.** Not opened now. It needs its own record because `0019` leaves provider routing unscheduled, and its metadata channel is unsettled: a last-response struct read off a model instance is shared mutable state under concurrent sessions, so instance state, an additive `GenerateOptions` callback and core events must be chosen before the package is built. Parked as `T-54` with that trigger written down.

### D-09 — Pyodide interrupt (T-24)

**Row:** T-24. **Blocks 0.1.0:** no. **Effort:** M/L.

#### Context

The in-process Pyodide executor cannot interrupt a synchronous loop, so it executes with a flouting guard instead of a wall-clock one; the fidelity report already says so. A worker-backed executor with interchangeable messages could interrupt by terminating the worker, at the price of COOP/COEP headers and a new deployment story. 0016 deferred it with that calculation written down.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Worker entry plus isolation headers | L | a real wall-clock timeout in the browser, and a cross-origin isolation requirement every host must meet |
| B. Keep in-process, documented | XS | no risk; a synchronous loop stays uninterruptible |
| C. Cooperative checks between tool calls | S | does not interrupt the loop it claims to bound |

#### Recommendation: B, until a caller reports the CPU-bound case

The deferred decision was right: the fix changes what everyone who hosts the executor must configure. The right trigger is a report, not a roadmap slot. If it reopens, it should be an opt-in executor, never the default, so existing hosts keep working.

#### Decision (2026-10-25)

**Option B, with the record corrected.** Keep in-process and document it. The audit found the row's cost premise wrong: COOP/COEP belong to the shared-interrupt-buffer variant, not to a worker as such, and the injectable-loader escape hatch is Node-only because `PyodideRuntime` carries synchronous members a browser main thread cannot proxy. So the deferred worker is terminate-based and needs no hosting change.

The posture holds for 0.1.0 on the portfolio argument: untrusted or unbounded Python is `exec-remote`'s job, browser code is QuickJS's, and this executor's niche is real Python, in-process, trusted or local. A second executor path whose headline behaviour only a runbook can prove is the wrong thing to add on the eve of a release, and the capability bag already reports no CPU budget.

The conditions: the package README gains the limitation paragraph in this commit; `T-24` becomes the parked worker row, gated on evidence the repository can see rather than on a first report; and [`0033`](../09-decisions/0033-the-pyodide-interrupt-stays-deferred.md) corrects 0016's two premises and pre-registers the terminate shape (`cpuTimeLimitMs` reported, state lost on interrupt, `dispose()` reclaims the runtime, message-round-trip tool calls, browser half a runbook claim).



### D-10 — when retrieval gets built (0026)

**Row:** none yet. **Effort:** L.

#### Context

[0026](../09-decisions/0026-retrieval-is-in.md) says retrieval is in, opt-in, and does not belong in the core. The seam it describes is an embedding function supplied by the caller, a vector-store interface with one in-memory implementation, and a retriever that inserts an ordinary transcript turn. None of that is scheduled, and no package exists.

#### Options

| option | cost | consequence |
|---|---|---|
| A. Schedule it after 0.1.0 as its own execution plan | L | the promise becomes a capability; packaging and embedding provider are chosen with evidence |
| B. Leave the record and build nothing | XS | the decision stays true and buys nothing |
| C. Build it inside the core | M | fastest, and the first violation of the invariant that the core owns no retrieval |

#### Recommendation: A, as the first new phase after the release

Retrieval is the main capability the program deliberately deferred, and the decision already names the shape that keeps it out of the core. It should get a plan like the one that closed Phase 6, with the package question answered inside it. Starting before the release would delay 0.1.0 for a large surface.

### D-11 — multimodal stays parked (0018)

**Row:** none. **Effort:** none unless reopened.

0018 defers multimodal until a caller asks and a seam hosts it; no caller has asked. The only mark in the tree is the unused capability flag. **Recommendation: confirm the park.** Reopening would need the content-part union, permission checks on image access, per-adapter mapping and a schema change, which is a phase, not a patch.

### D-12 — residual-risk chores

**Rows:** none (each was an `## Open` note in a phase report). **Effort:** S each.

| chore | from | why it matters | recommendation |
|---|---|---|---|
| fork at a step holding an in-doubt `intent` | Phase 1 | the combination is legal and untested; today it surfaces `EffectOutcomeUnknownError` | one test, now |
| claim-board parent fence and the background-child store rule | Phase 2 | the CAS is per parent generation, so two rows can still race the fence; the store rule is documented, not enforced | document until a second store exists |
| Anthropic streamed cache split | Phase 5 | the split is proven on generate only | one fixture, when an adapter changes |
| a resumed run starts its cost counter at zero | Phase 5 | a resumed run can spend past a cost cap set for the whole conversation | document in the budget guide, then decide |
| live Docker and E2B verification | Phase 4 | the seam is proven, the live provider is not | runbook check when an account or daemon exists |
| adapter v2 translation path | Phase 6 | unproven by construction until a v2 exists | none until v2 is planned |
| handoff size and the 16 baselined validator findings | 0008, Phase 0 | the handoff sits at the rotation edge; the baseline hides findings | one cleanup pass when a session is otherwise idle |

## Not on the board — additions I propose

1. **A docs page for the provider-options seam.** No page under `docs/` mentions `providerOptions`, the three typed interfaces or the adapter version; the only account is in the AGENTS entries and the report. A library whose first release hides its newest seam is a library whose users will not find it. Add a short page after the release, pointing at the typed interfaces rather than repeating them.
2. **A changelog truth pass before the tag.** The runbook checks that changesets exist and that versions match; it does not check that the prose names the six phases' new surfaces. Fifteen minutes with the changeset output closes that.
3. **A required status check on `main`.** CI went green on its first run; nothing yet stops a red push. Making the gate a required check is a repository setting, not code, and it is the cheapest insurance the program can buy.
4. **Branch cleanup.** Five merged local branches and one worktree; deleting the branches is one command and keeps `git branch` readable.
5. **A v2 deprecation policy while v1 is fresh.** The contract number exists and the shim works; the policy for how long v1 adapters keep working after a v2 lands does not exist. Record it when v2 is first planned, not after.
6. **A release scope line.** No decision says what 0.1.0 contains. A sentence in the release note (0.1.0 is the six-phase program) prevents a later reader from inventing a boundary.

## Order of execution, as the decisions now stand

1. **Implement the pre-release set:** D-01 (endings), D-02 (planning lane) and D-06 (the conversation projection on the snapshot, consumed by `ChatSurface`). T-48 re-adjudicates the parity expectations after the first two land. Then D-08 phase 0, which is additive and gates nothing.
2. **Publish 0.1.0** under the `0030` gate, once the owner claims the scope and supplies a token with 2FA bypass.
3. **Post-release:** D-07 (the tool-calling scenario family), then T-48's re-adjudication and planning scenario, then D-12 (the hardening batch, including D-03's exclusion-list guard), and the not-on-the-board hygiene items accepted so far.
4. **D-10** as its own planned phase (retrieval).
5. **Parked:** D-09 (a worker is pre-registered in `0033` and waits on a browser runner or a caller who cannot use the remote executors), D-11 (waits on a caller), D-08 phase 1 (waits on a demand).


## Decision register

| id | item | status | choice | date |
|---|---|---|---|---|
| D-01 | the `.run()` ending contract (T-18) | decided 2026-10-25 | A — typed errors for both ceilings, dead state removed, stream stays the partial channel | 2026-10-25 |
| D-02 | planning cadence (T-16) | decided 2026-10-25 | A — the whole lane, structurally; prompt text re-authored | 2026-10-25 |
| D-03 | supply-chain confirmation (T-25) | decided 2026-10-25 | A — confirm; dev-tree scope and the shrink-at-next-bump rule recorded | 2026-10-25 |
| D-04 | which upstream the recordings track (T-21) | decided 2026-10-25 | A — keep the 1.14.0 corpus, state the split, re-record only as a deliberate comparison | 2026-10-25 |
| D-05 | the 0.1.0 gate (T-14) | decided 2026-10-25 | A — publish after the pre-release set, under the recorded gate | 2026-10-25 |
| D-06 | the transcript `ChatSurface` renders (T-28) | decided 2026-10-25 | A+A1 — the snapshot carries the conversation projection, `ChatSurface` defaults to it; pre-release | 2026-10-25 |
| D-07 | a tool scenario in the parity corpus (T-19) | decided 2026-10-25 | B — a tool-calling scenario family (success and unknown-tool), post-release; the row's option A was a no-op | 2026-10-25 |
| D-08 | OmniRoute intake (T-39) | decided 2026-10-25 | A — phase 0 now (README section, runbook, gateway example, four-frame fixture); phase 1 parked as `T-54` | 2026-10-25 |
| D-09 | Pyodide interrupt (T-24) | decided 2026-10-25 | B — keep in-process and document it; `0033` corrects 0016's premises and pre-registers the terminate worker | 2026-10-25 |
| D-10 | when retrieval gets built (0026) | open | | |
| D-11 | multimodal stays parked (0018) | open | | |
| D-12 | residual-risk chores | open | | |

## Flagged items and where they landed

Every item raised as "missed" in a decision discussion lands in one of four places: a clause in the decision record, a live document edit, a task row, or an explicit deferral with a destination named here. Chat text alone is not a home.

| item | raised in | home |
|---|---|---|
| The error carries the stop reason only, and a child budget stop gains its own `ChildStopReason` value | D-01 | recorded as defaults in `0027` and the register; **owner confirmation is still outstanding** |
| A guard that stops a local install appending a fourth exclusion to the tracked list | D-03 | deferred to D-12 (post-release hardening); named in the D-03 decision text and the handoff |
| The user-facing statement that the design pin is a reading, the corpus an observation, and no upstream compatibility range is claimed | D-04 | decision `0029` item 3; implemented in `docs/01-project.md` |
| The pin is declared three times by design; a re-record moves all three in one change | D-04 | decision `0029` item 5 |
| The parity expectations must be re-adjudicated after D-01 and D-02 land | D-04 | **`T-48`** — found in the audit of this section, not recorded when D-04 was taken |
| The scope is unclaimed, the token needs 2FA bypass, a partial publish needs a recovery rule, step 3's expectation is stale, and the release note has no home | D-05 | decision `0030` gate; the four runbook amendments |
| First-run evidence is a deliverable, and CI and Pages are checked on the release revision | D-05 | the runbook's notes; `0030` gate item 4 |
| The transcript spans turns only for a checkpointed session; a live surface without one resets per run | D-06 | decided and recorded in `0031`; documentation is part of the wiring |
| The plan's "one source of truth across CLI, React and the model call" overstates: the projection is not the model transcript, and the CLI renders events | D-06 | corrected in `0031`'s semantics; the accurate claim is one conversation projection, shared by its consumers |
| Recomputing the projection on every event, deltas included, would be quadratic | D-06 | recorded as the boundary-only rule in `0031` and its follow-up |
| The example's comment claims the surface reads the run while it renders a constant | D-06 | `0031` follow-up: delete the constant, correct the comment |
| A stub tool in a CodeAgent scenario changes no compared field; upstream records only `python_interpreter` on the step | D-07 | recorded in `0032`; option A is replaced by the tool-calling family |
| D-02 unblocks a planning scenario, which S1.5 had ruled out because the two sides planned at different points | D-07 | `T-48`'s gate gains it, and the runbook's "two divergences" note is corrected when it lands |
| The runbook's "Adding a scenario" step says a scenario's `tools` stays empty | D-07 | `0032` follow-up rewrites that step and the failure-table row |
| The failure scenario may expose a step-error divergence: upstream marks the step errored and keeps no call list; ours records the failed call and continues | D-07 | `0032`: pinned with `differsOn` if measured; changing the loop is a new decision |
| A site page and a runbook page are all the pack has for a user-facing guide; the published site is the internal pack plus README | D-08 | **`T-52`**, a blocked decision row on where user guides live |
| `--api-base` is silently ignored unless `--model-type OpenAIModel` is also passed | D-08 | **`T-53`** |
| The four-frame fixture outlives the gateway version it was read from | D-08 | `T-39`: the fixture cites its shard and `3.8.53`, and the new runbook's update-when trigger names a gateway major |
| No live gateway was contacted, so phase 0 may not claim "tested with OmniRoute" | D-08 | `T-39`: the docs say wire-compatible by construction with a frame-shape regression, and the runbook's last-verified says never executed until it is |
| One gateway id can front a tool-less model while `capabilities.toolCalls` is `true` | D-08 | `T-39`: the README and runbook say to pin a known tool-capable id for `ToolCallingAgent` |
| Retry and backoff are the caller's; the adapter stays policy-free | D-08 | `T-39`: the runbook states the timeout hook is `AbortSignal` and retry is the caller's |
| Gateway CORS is deny-by-default and `REQUIRE_API_KEY` defaults to `false` | D-08 | `T-39`: both are gateway-side settings, stated in the README and the runbook |
| A routed gateway must never enter the golden or parity corpus | D-08 | `T-39`: the runbook states gateways live in examples and runbooks, with a pinned model id |
| Phase 1's last-response metadata on a model instance is shared mutable state under concurrent sessions | D-08 | **`T-54`**: the record must settle instance state vs a `GenerateOptions` callback vs core events |
| A `docs/guides/` tree would need a new artifact kind, a template and a router row on a frozen surface | D-08 | recorded in the D-08 decision text; the question is `T-52`'s |

| A worker does not need COOP/COEP headers; only the shared-interrupt-buffer variant does | D-09 | corrected in `0033`; the plan's `## Changes` records that D-09's row was priced with it |
| 0016's "worker-backed runtime through the injectable loader" is Node-only: `PyodideRuntime` has synchronous members | D-09 | corrected in `0033` |
| The package README omitted that `timeoutMs` is reported late and the runtime is never reclaimed | D-09 | the limitation paragraph in `packages/exec-pyodide/README.md`, same commit as `0033` |
| No browser test runner exists, so a browser worker's claim would be a runbook claim | D-09 | `0033` point 6; named as the cost of A rather than left implied |
| "Wait for a caller report" makes the first hang victim the test | D-09 | `T-24`'s gate names a browser runner, a user who cannot use the remote executors, or a recorded hang |
| The worker would report `cpuTimeLimitMs`; the in-process bag stays without one | D-09 | `0033` point 3; the pre-registered shape names the capability it earns |
| State loss on interrupt is a recovery cost, not a bug; a worker's tool calls become message round trips | D-09 | `0033` point 3 |

## Changes

- 2026-10-25: D-09 decided as option B, keep in-process and document it. The row's premise was wrong: COOP/COEP belong to the shared-interrupt-buffer variant, and the injectable-loader escape hatch is Node-only. The worker is pre-registered terminate-based in `0033`, the README gains the limitation paragraph, and `T-24`'s trigger is evidence the repository can see rather than a first report.
- 2026-10-25: D-08 decided as option A, phase 0 only. The gateway already works at the wire level, so the work is discoverability: a README subsection, a runbook, one example and a hand-shaped four-frame fixture named by wire shape rather than by OmniRoute. Phase 1 stays parked as `T-54` with its metadata-channel question written down; the missing user-guide tree and the silently ignored `--api-base` become `T-52` and `T-53`.
- 2026-10-25: filed at `d7e1677`. While checking D-01's premise, found that a budget stop reaches `.run()` through the generic fallback, so a normal condition is reported as a missing terminal event; folded into D-01. Two board rows found stale (T-26, T-29).
- 2026-10-25: D-01 decided as option A. Two sub-choices recorded with defaults: the error carries the reason only, and a child budget stop gains its own `ChildStopReason` value.
- 2026-10-25: D-02 decided as option A, after the owner weighed the scale case against the lead's release-economics recommendation. The lead's D-02 blast-radius estimate was corrected to four test files before this decision.
- 2026-10-25: D-03 decided as option A; `T-25` closed. The record gains a scope sentence (development tree only) and a release rule for the exclusion list (shrink it at the next vendor-peer bump).
- 2026-10-25: D-04 decided as option A; `T-21` closed. The corpus stays on the 1.14.0 release, the design's pin stays a design reading, and the split plus the no-compatibility-range statement are live in `docs/01-project.md`.
- 2026-10-25: D-05 decided as option A; `T-14` stays blocked on credentials and the scope claim. The release gate, the four flagged runbook corrections and the release-note step are recorded in `0030`; the runbook is amended. A missed consequence of D-04's group is now a live row: the parity expectations must be re-adjudicated after D-01 and D-02 land, because the endings and the planning position are what the two pinned divergences describe.
- 2026-10-25: D-06 decided as option A with the lossy projection (A1), pre-release. Reading the code first shrank the question: `toChatMessages()` already existed, documented as the React shell's chat view, tested, and unused, so the work is a wire, not a renderer. The checkpoint-continuity trap, the overstated "one source of truth" rationale, the delta-recomputation cost and the example's false comment are recorded in `0031`.
- 2026-10-25: D-07 decided as option B with two scenarios, post-release. The row's option A was a no-op: a stub tool in a CodeAgent scenario changes no compared field, because upstream records only `python_interpreter` on the step and prompt, code and observation text are never compared. The family exercises the model-emitted call instead, and its failure scenario is pre-registered as a likely pinned divergence; `0032` also records that D-02 unblocks the planning scenario S1.5 declined.
