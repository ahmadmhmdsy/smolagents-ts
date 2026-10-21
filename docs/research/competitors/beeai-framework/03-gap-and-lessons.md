# beeai-framework — gap and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**How to use this file**

- Each row names a capability seen in this repository, the baseline row it would land on, how close the fit is, a bucket, and a price. Buckets and prices follow the method: A is a roadmap follow-on, B a non-goal, C unconsidered, D a depth gap, E upstream parity; S is at most a day, M two to three days, L a week or more.
- "Fit" is judged against the capability, not the code: an idea can fit our baseline even when their implementation is one we would not copy.
- Where the baseline id does not exist yet, the row says so rather than inventing an id.
- Fits are graded strong, partial, weak or new. A strong fit means the capability answers a question our baseline already asks; a weak fit usually means the capability is a non-goal.
- Nothing in this table was executed against the clone; the pricing is a judgement about our codebase, not a measurement of theirs.

**Row distribution**

| bucket | rows | reading |
|---|---|---|
| A | G-2, G-3, G-4, G-6, G-7, G-8, G-9, G-14, G-15 | four small seams and five medium ones that answer existing rows |
| B | G-10, G-12, G-13 | protocol identity, workspace and evaluation: mostly non-goals, with one identity lesson |
| C | G-1, G-5, G-11 | policy-as-data, run-scoped cache, ambient backends |
| D | G-16, G-17, G-18 | loop-style migration, snapshot migration, documentation parity |

No row is bucket E: nothing here shows an upstream capability we are supposed to match and do not.

**Gap rows**

| id | capability | baseline row | fit | bucket | effort | what it changes for us |
|---|---|---|---|---|---|---|
| G-1 | Rule-driven per-step tool policy (requirements compute allowed, forced and hidden tools) | none; closest is MA-01 managed agents, which is a different question | new: no baseline row expresses tool availability as inspectable data | C | M | gives agent design a declarative policy vocabulary; see the pattern section below |
| G-2 | Approval as a tool-start requirement (Python only) | HL-01 approval gate, HL-02 pending approval as state | partial: they can pause one tool call, not the run | A | M | their version proves the demand; it also shows how not to model it, since nothing durable records the pause |
| G-3 | Final answer forced as a synthetic tool call with re-ask | GR-05 structured output seam, GR-02 Zod final answer | strong: both stop the loop by forcing a terminal call | A | S | a low-risk way to harden our final answer against prose replies |
| G-4 | Per-tool timeout with a fresh child controller per attempt | TL-05 per-tool timeout absent | exact: the baseline row exists because we have no per-tool timeout | A | S | the race-a-child-controller shape is small and composable; their code is the reference implementation |
| G-5 | Tool result cache keyed by input hash with in-flight dedupe | none | orthogonal to our rows | C | S | useful for expensive tools (search, crawler) once we have a run-scoped cache seam |
| G-6 | Structured-output retry loop that feeds validator errors back | GR-05 structured output seam | strong: same goal, different sequencing | A | S | turns one-shot structured decoding into a correcting loop; costs no new state |
| G-7 | Whole-object-graph snapshot with a class registry and ref/cycle handling | RT-14 AgentSession snapshot | partial: broader than our snapshot, but still not a run journal | A | M | shows what "persist the graph" costs and where it stops short of resume |
| G-8 | Function deserialization disabled by default behind an explicit opt-in | none | new | A | S | a security posture we should copy the moment snapshots can carry callables |
| G-9 | Trace identity (group, run, parent) on every emitted event | RT-09 typed event stream | strong: same event spine, stronger identity discipline | A | M | makes hierarchy reconstructable without a separate trace store |
| G-10 | Protocol-level conversation continuation via A2A context and task ids | HL-08 conversation identity | partial | B | S | A2A is a decision-0018 non-goal, but the identity field is the smallest useful shape for HL-08 |
| G-11 | Ambient capability backends supplied by the host (Python filesystem and shell) | EX-01 to EX-03 executors, EX-05 workspace | partial: the capability is theirs, the injection pattern is the lesson | C | M | decouples a tool from the environment it runs in; lets a host override without forking tools |
| G-12 | Filesystem tools with a pluggable reading backend | EX-05 workspace | weak: we have no workspace by decision | B | M | do not build; delegate to MCP servers when the need arrives |
| G-13 | Evaluation adapters for DeepEval and Ragas (Python only) | OB-04 evaluation scorer | partial | B | M | confirms OB-04 is a Python-ecosystem problem, not a loop problem |
| G-14 | OpenTelemetry instrumentation as an external package (Python only) | OB-02 OTEL export absent | strong: same missing capability, proven approach | A | M | instrumenting at the event/emitter seam works without the core depending on OTEL |
| G-15 | Handoff implemented as clone-then-sub-run | MA-02 handoffs absent | partial: theirs is a call, not a transfer | A | M | lets us separate "call another agent" from "hand over the conversation" in the baseline |
| G-16 | Prompt-encoded tool calling, now being replaced by native tool calls | RT-01 code-as-action loop | partial: a third loop style | D | M | a signal that text-protocol loops are a maintenance burden, which bears on how much we invest in our own loop protocol |
| G-17 | Snapshot version integer with no migration path | HL-10 checkpoint schema versioning | partial | D | M | a stored snapshot that outlives a package version is unmanaged data; do better than one integer |
| G-18 | Dual-language documentation with language tabs | none | new | D | S | docs parity needs a mechanism, not a habit: one documented path was already dead at this commit |

**Four rows in detail**

*G-1, policy as data.* The requirement interface is small: `run(state)` returns rules, and a rule is a target tool name plus flags for allowed, forced, hidden, prevent-stop and a human-readable reason (`typescript/src/agents/requirement/requirements/requirement.ts:14-101`). `ConditionalRequirement` bakes in the common cases (`typescript/src/agents/requirement/requirements/conditional.ts:38-245`). A runner then merges all rules into one request object. The cost of adopting the idea is a new object in our agent contract; the benefit is that "the agent must call search before it answers" becomes inspectable configuration instead of loop code.

*G-2, approval by requirement.* The Python implementation stamps a handler on tool-start events and sets `data.output` to a blocking result (`python/beeai_framework/agents/requirement/requirements/ask_permission.py:29-108`). It can stop a single tool call and let the model see the refusal. It holds no pending record, so nothing outside the live process can answer "may this run proceed". We have the gate; this is evidence that the pause-state half is genuinely harder than the gate.

*G-3, terminal tool call.* Requiring a final-answer tool removes prose as a failure mode: a text response is converted, and if conversion fails the runner forces the tool and asks again (`typescript/src/agents/requirement/runner.ts:250-293`). It also lets the framework stream the answer through the same tool-result path. For us it is a bounded change behind the final-answer seam, not a loop rewrite.

*G-7, snapshot breadth.* The serializer handles `Map`, `Set`, `Date`, tasks, loggers, functions and framework classes, deduplicates shared references and breaks cycles with placeholders (`typescript/src/serializer/serializer.ts:62-190`). That is enough to clone a configured agent or move it between processes, and it is still not enough to resume a run, because no snapshots are taken during one. The lesson is scope discipline: decide which question the snapshot answers.

**Where the baseline can be sharpened**

Three observations from this read are not gaps but corrections to how our own rows are phrased. They are suggestions to the owning documents, not edits.

- **RT-14 and HL-04 are separate promises.** BeeAI can serialise an entire agent graph, including memory, but cannot resume an interrupted run. If our session snapshot is expected to seed resume, this is the counter-example: a graph snapshot without a journal gets no closer to HL-04. Worth stating explicitly in the resume design.
- **MA-02 conflates two things.** "Handoffs absent" reads as though the only shape is control transfer. BeeAI's `HandoffTool` is a sub-invocation with memory seeding (`tools/handoff.ts:56-91`), which is a different and cheaper mechanism, closer to a subagent call. Splitting "agent call" from "conversation transfer" would let us adopt the first without pretending we shipped the second.
- **HL-01 and HL-02 are worth keeping split.** The Python half gates a tool call from an event handler and stores nothing. That is a usable demo and a bad foundation: the interruption is invisible to a process restart. The split between "gate exists" and "pending state exists" is exactly the right cut.

**Patterns worth copying**

1. **Policy as data, not control flow.** A requirement object answers "at this step, which tools are allowed, forced or hidden" and the runner renders that into the model request. The distinct value is that the policy is inspectable and composable before the model is called (`typescript/src/agents/requirement/requirements/requirement.ts:14-101`). Our agents would gain a place to put "must call search before answering" without writing a bespoke loop.

2. **Retry with the validator's complaint.** Structured output asks for JSON, parses tolerantly, validates, and on failure re-prompts with the validation errors as a user message (`typescript/src/backend/chat.ts:361-476`). The loop is bounded and the error text is the repair instruction; no new state is needed. It is the cheapest quality upgrade in the repository.

3. **Deserialization as a capability you must grant.** Function values serialise to source and deserialise only when the caller opts in through an ambient flag, with the advisory cited in the code (`typescript/src/serializer/serializer.ts:40-52`). Snapshots are input from untrusted places; the default-deny posture is right, and cheap to copy.

4. **Ambient backend injection.** Python tools read a `FileBackend` or `ShellBackend` from a context variable and fail clearly when none is installed (`python/beeai_framework/tools/filesystem/_file_backend.py:19-50`, `python/beeai_framework/tools/code/_shell_backend.py:33-50`). One tool implementation then serves a CLI, an editor and a server. If an executor ever needs a host-provided capability, this is the seam shape that has been field-tested.

5. **Trace identity on every event.** Emitting `groupId`, `runId` and parent ids with each event (`typescript/src/emitter/emitter.ts:250-262`) means a consumer can rebuild the run tree from the stream alone. Our typed event stream has the events; the identity is the part worth adding deliberately.

**Patterns to avoid**

1. **A boolean as the only concurrency guard.** `BaseAgent.run` refuses a second call while a first is in flight (`typescript/src/agents/base.ts:35-45`). That is not wrong for a demo, but it means one agent instance cannot serve two conversations, and it is the same state that would have to become "current run id + status" before pause or resume could exist.

2. **Approval by mutating an event.** The Python requirement patches a tool's start event output to block execution (`python/beeai_framework/agents/requirement/requirements/ask_permission.py:29-108`). It works inside one process; a restarted process has no idea a decision was pending. If we ever add approvals on top of the emitter, this is the trap.

3. **Configuration precedence that inverts expectation.** The ReAct agent computes execution options as `this.input.execution ?? options?.execution ?? defaults` (`typescript/src/agents/react/agent.ts:118-126`), so a caller cannot override a constructor-level setting per run. Anyone debugging "my per-run limit is ignored" pays for this.

4. **A provider matrix wider than the manifest.** `zod` is used at runtime but declared only as a dev dependency (`typescript/package.json:141-166`, `:307`), and `@ibm-cloud/watsonx-ai` appears in peer metadata while missing from the peer list (`:167-241`). Installing without dev dependencies can break; extras that are never validated rot quietly.

5. **Three parsers and three prompt sets for one loop.** `granite`, `deepseek-r1` and default runners each carry their own instruction protocol (`typescript/src/agents/react/agent.ts:70-76`, `typescript/src/agents/react/prompts.ts:10-184`). The new requirement agent exists partly to escape this, and the old native-tool agent is already deprecated. Protocol-per-model is a maintenance tax with no product benefit.

6. **Memory writes deferred until success.** The user's prompt enters persistent memory only after the loop finishes (`typescript/src/agents/react/agent.ts:179-188`), so a failed or aborted run leaves no trace of what was asked. For an audit story that is the wrong default.

7. **Documentation that outruns implementation.** One docs page marks evaluation and observability Python-only while another links a RAG module that does not exist at this commit (`clone:/docs/src/content/docs/modules/rag.mdx:19`). In a two-language project the docs are the first casualty; a link checker over docs would have caught the dead path cheaply.

**What we have that this repository lacks**

- A checkpoint per step and a resume path (`HL-03`, `HL-04`); nothing in the TypeScript half writes run progress anywhere.
- Sandboxed executors we own (`EX-01` to `EX-03`); their only execution surface is a remote interpreter, and their local shell and filesystem tools are Python-only.
- A code-as-action loop (`RT-01`) rather than a text protocol the field is moving away from.
- Explicit non-goals and decision records; no equivalent list exists here, and the surface keeps growing (four protocol servers, two language halves) without one.
- Durable conversation stores (`HL-09`) as a first-class concern; here persistence is a component snapshot or a remote memory service.

**Pricing rationale**

- `S` rows here are single-seam changes: a retry loop, a timeout race, a flag on an existing helper. Their cost is review, not construction.
- `M` rows introduce an object or a store that did not exist: a rule type, a snapshot format, an identity field that must be threaded through every event.
- No row priced `L` was found. The expensive things in this repository (dual-language parity, a provider matrix, protocol servers) are investments we have already decided not to make.

**Questions this read could not answer**

- Whether the line-prefix parser holds up on models that were not tuned for the protocol; only source and tests were seen.
- How often the requirement cycle checker fires in practice, and whether its re-ask strategy converges.
- What the whole-agent snapshot does when a provider client holds a socket or a non-serialisable handle.
- Whether the docs drift is tracked anywhere; no issue or test enforces documentation parity between the halves.
- Whether the remote interpreter service is versioned together with the client; the URL is configurable and the default port is asserted only in an error message.

**One lesson that is not a gap**

The dual-language project is not twice the work; it is one design and two ports with drift. The drift here is visible, measured, and mostly documented rather than hidden: a missing serializer in Python, a missing evaluation harness in TypeScript, a version gap of fifty-four patch releases. When we design a seam that both our surface and a future second surface must carry, the cost is not the second port but the reconciliation tooling, and this repository has none beyond CI keeping the halves separate.
