# crewAI — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Rows name the baseline capability they extend or contradict (`docs/research/competitors/_synthesis/00-our-baseline.md`),
the bucket from the method — A a follow-on behind a shipped seam, B a non-goal held out by decision 0018, C a
capability absent from our vocabulary, D a depth gap — and an effort estimate of S for a day or less, M for two
or three days, L for a week or more. Where no baseline row exists, the nearest row is named and its absence is
the finding.

## Gap rows

| baseline | what they have | bucket | effort | fit |
|---|---|---|---|---|
| MA-06 | a manager agent built by the framework: i18n role prompt, two delegation tools, every task routed through it; a caller-supplied manager with tools is rejected | A | M | a supervisor helper over the managed-agent seam; copy the topology, not the transport |
| MA-03 | a delegated child gets a freshly built untyped task and its answer returns as a tool-observation string | D | M | parity evidence that a typed child report is not the default, even where a typed slot exists |
| GR-02, GR-06 | schema text in the task prompt, strict validation at the task boundary, then a repair path that extracts embedded JSON or asks a model to coerce it | A | M | the run-level output schema seam can grow repair without a new interface |
| GR-01 | output validators that re-execute the whole task with the validator error as context, bounded by a retry count | D | M | depth: our tripwire halts, theirs spends another execution to keep going |
| MA-05, MD-06, no memory row | one memory class with a scope tree, LLM-inferred categories and importance, composite recall scoring, consolidation, local vector storage, automatic save and recall per task, and memory tools | C | M | scoped shared memory is vocabulary we lack; embeddings would live behind it |
| HL-04, HL-09 | a checkpoint listener on the event bus that snapshots crew, flow and agent state, a kickoff flag that resumes from it, plus fork, restore and prune | A | M | file-backed resume and a serialisable snapshot reached without threading durability through call sites |
| HL-07 | replay from a task id: reload stored outputs, find the first incomplete task, rerun the remainder | A | S | coarse time travel for a task list, cheaper than step-level replay |
| OB-05 | an evaluator model scores each task from 1 to 10 over N iterations, alongside training-data capture and feedback injection | A | M | LLM judging and regression runs on top of our eval fixture shape |
| OB-02 | an OpenTelemetry exporter on a private tracer provider: OTLP/HTTP batches, environment opt-out, attributes limited to names and booleans, exception class names only | A | S | an exporter seam that never registers a global provider |
| RT-09, OB-07 | one typed event bus carries every lifecycle event; tracing, telemetry and checkpointing are listeners | C | M | extension by subscription instead of middleware wrapping |
| RT-03 | a planning flag that has an agent write a plan into the task description before execution | D | M | planning as a prompt mutation, with no plan object or progress tracking |
| TL-02, TL-06 | a per-crew tool-result cache keyed by name and serialised input, refusing failures, shared with the manager | C | S | memoisation at the tool-use seam, not a second registry |
| RT-03, RT-08 nearest, no row | a decorator flow DSL compiled into a graph: starts, listeners, routers, typed state, persistence, crew composition and aggregated usage | C | L | orchestration above agents, a separate layer rather than a mode of the loop |
| MA-01 nearest, no row | prompt pack as data: role, format, criteria, schema and delegation descriptions all overridable from one translatable JSON file | C | S | prompt wording becomes a config surface with one audit point |

## What we have that they lack

- A code-as-action loop (RT-01) and a validated final answer at the run boundary (GR-02); their loop is a JSON
  tool-call ReAct grammar, and their typed value exists per task rather than per crew.
- A middleware chain around each step (RT-08); they extend by subscribing to a bus, which is a different shape
  with a different cost.
- An executor contract with declared capabilities (EX-04); their code execution is a permission flag on an
  agent rather than a separate executor interface with declared capabilities.
- A run store interface with a session snapshot (RT-14); their checkpoint is broader in scope but resumes at a
  task boundary, so a mid-task crash is not idempotent there either (HL-05 stays absent for both).

## The three that matter most

**The delegation boundary is text.** In hierarchical mode the manager does not call a child function; it emits a
tool call whose arguments are a coworker name, a task and context. The executor sanitises the name, matches a
role, synthesises a task with a one-line generic expected result and runs it
(`lib/crewai/src/crewai/tools/agent_tools/base_agent_tools.py:110-120`). The child's `TaskOutput` is dropped and
the string result becomes the observation. The manager therefore reasons over prose twice: once to write the
request and once to interpret the reply. That is the pattern to avoid copying.

**Validation is boundary-local and lossy.** A task with `output_pydantic` or `output_json` gets its value
validated in `_export_output` (`lib/crewai/src/crewai/task.py:1197-1213`), and the record keeps both raw text and
the typed value. Then context assembly joins `raw` fields with a divider, discarding the typed half
(`lib/crewai/src/crewai/crew.py:1878-1887`, `lib/crewai/src/crewai/utilities/formatter.py:16-26`). The next agent
sees validated prose, not a validated object. Their own marketing of a typed task API stops at the producer.

**Prompt machinery is the real protocol.** The per-task prompt can contain role, backstory, goal, tool
catalogue, ReAct format, task text, expected criteria, JSON schema, retrieved memories and assembled context
(`lib/crewai/src/crewai/utilities/prompts.py:93-130`, `lib/crewai/src/crewai/agent/utils.py:62-110`). A
delegation adds the manager's prompt, two tool schemas and a restatement of the parent context, because the
tool text instructs the manager to explain everything the child does not know
(`lib/crewai/src/crewai/translations/en.json:58-59`). Token cost grows with the chain and with each hop, and no
setting caps the restatement.

## Patterns worth copying

- Validate where the type is declared, and store both the text and the typed value so a consumer can choose.
- Treat a guardrail as a retrying validator with an explicit attempt count, keeping the failure text in the retry
  prompt so the model can correct itself.
- Scope telemetry attributes by privacy class: names, roles and booleans by default; task text and crew data
  behind an opt-in; exception class names but never exception messages
  (`clone:/docs/edge/en/telemetry.mdx:63`).
- Load prompts from a data file with a project-level override (`lib/crewai/src/crewai/utilities/i18n.py:11-60`);
  it makes prompt cost and wording reviewable in one place.
- Put durability and telemetry on the event bus as listeners, so neither is threaded through execution code.
- Refuse to cache a failed tool result, so a retry cannot replay a stale error.

## Patterns to avoid

- Synthesising an untyped task per delegation when the framework already has output types.
- An instruction that asks the manager to restate all context; it makes cost proportional to transcript length
  and hides the duplication from usage accounting.
- Concatenating every earlier raw output into each later context; prompt growth is quadratic in task count and
  structure is lost at every join.
- Repairing a schema mismatch by another model call as the default path; the fallback is useful but it makes
  cost and latency unpredictable under load.
- Files that keep growing around the execution path: `crew.py` is 99,774 bytes and `agent/core.py` 91 KB, with
  the same task crossing four modules before a result exists.
- A `Process` enum carrying a TODO for a third mode that no runner implements
  (`lib/crewai/src/crewai/process.py:4-11`).

## What this suggests for us

1. Price the typed child report (MA-03) as the next multi-agent step: the competitor proves both that the
   boundary can be typed cheaply and that everyone defaults to strings when the handoff is a tool call.
2. If a supervisor lands (MA-06), define the handoff before the topology. A typed request and a typed report
   remove the restatement instruction and the manager's second parse.
3. Add schema repair (GR-06) before adding an evaluator: repairing at the boundary is the cheaper half of what
   their validation stack does, and the guardrail re-run is the expensive half we can skip.
4. Add an event-listener seam (OB-07) before checkpointing (HL-04, HL-09); their checkpoint, tracing and
   telemetry all ride one bus, which is why none of them touches the loop.
5. Record the flow DSL and the unified memory as bucket C, not as non-goals; decision 0018 does not speak to
   either, and both are vocabulary gaps rather than missing features.

## Baseline corrections

- The baseline has no memory row at all. MA-05 and MD-06 are the nearest neighbours, and a scoped, scored,
  consolidated store is a distinct capability that our vocabulary currently cannot name.
- MA-03 is priced as minimal because our managed agent returns `z.string()`. crewAI's typed task output shows
  the producing side is cheap to type; the missing half is the receiving side, and that is where the effort is.
- GR-06 is absent and this dive shows two implementation routes: prompt-repair and model coercion. The row should
  say which route the backlog intends, because they differ in cost by an order of magnitude.
- OB-02 is absent on our side and shipped on theirs as a private-provider exporter. Price it S, not M: the hard
  part is attribute scoping, which their documentation already demonstrates.
- HL-07 is absent but should be priced against the task-level version, not a step-level one: reloading stored
  outputs and rerunning the tail is a small change on top of the run store.
- There is no row for an orchestration DSL. RT-03 and RT-08 are the nearest neighbours, and the absence hides a
  capability class that a second product surface in the same repository is built on.
- MA-06 is absent, but a supervisor is a prompt and two tools on top of the managed-agent seam; M is the honest
  price, not L, once the handoff type is decided.
