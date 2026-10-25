# 0032 — the parity corpus grows a tool-calling scenario family

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new file that supersedes this one; this file is never rewritten.
- **Read when:** adding to the parity corpus, or asking why the corpus exercises a tool-calling agent rather than a code-called tool.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** the owner, answering `D-07` in the open-decisions plan
- **Supersedes:** none; it fills the tool gap `0007` left open while keeping that record's scope boundary

## Context

`T-19` asked for a tool scenario in the parity corpus because every recording declares an empty tool list, both readers refuse a scenario that names tools, and the corpus therefore compares the loop's structure everywhere except the tool branch.

Reading the harness before pricing the row changed the work. For a **code** turn upstream stores exactly one tool call on the step -- `python_interpreter` (`agents.py:1715-1721`) -- and keeps the tools the code actually called in the interpreter's state, not on the step. Our side fills `step.toolCalls` from the model completion (`multi-step-agent.ts:1183`), which is empty for a code turn, and `ScriptedExecutor` reports only `toolCallCount: number` (`executor.ts:55`). The trace compares step kinds, each step's error presence, the final-answer value and the roles of the messages sent to the model (`parity.test.ts:5-9`); prompt text, code text and observation text are never compared.

So a deterministic stub tool wired into the existing CodeAgent scenarios would change **no compared field**: the trace is identical with the tool present or absent. It would still remove the recorder's refusal, replacing an honest refusal with a scenario whose name promises coverage it does not have. The plan's option A priced that as the useful half; it is the empty half.

The tool branch is observable where the **model** emits the call. `ToolCallingAgent` records the calls it ran on the step (upstream `agents.py:1333-1436`, ours `tool-calling-agent.ts:82-213`), the trace already compares those names and their error presence, and both sides treat `final_answer` as a tool call (upstream `agents.py:402`, `:1406`; ours `multi-step-agent.ts:121`). Both scripted models can emit one: `MockModel` already accepts `toolCalls` turns (`mock-model.ts:7-12`), and upstream's `ChatMessage` carries `tool_calls`.

The execution environment is available: Python 3.13.7 with upstream `1.14.0` is installed on this machine, and the recorder is offline, so the new recordings are reproducible now.

## Decision

**The corpus gains a tool-calling scenario family: one success scenario and one unknown-tool failure scenario, post-release.**

**Schema.** A scenario gains an `agent` field, `"code" | "tool-calling"`, absent meaning `"code"`. The five existing scenarios and their five recordings are untouched -- no re-record is needed for them. A tool-calling turn carries `calls: [{ name, arguments }]` with `arguments` stored once as an object and serialized by each leg (the Python side passes the mapping, the TypeScript side a JSON string). `tools` keeps its meaning: an array of stub names, empty for code scenarios, empty for the failure scenario, and naming the shared stub in the success scenario.

**Stub.** One tool, `echo`, defined twice with identical name, description, single input `text: string` and identity result: a Python `Tool` subclass and a TypeScript tool definition in the test file. It is deterministic, so both legs produce the same final answer; the observation text is not compared, and no new trace field is introduced.

**Scenarios.** The success scenario calls `echo` once and then `final_answer`, so the compared facts are the two step kinds, the call names on each step, their error presence and the final value. The failure scenario declares no tools and calls `missing_tool` once, then recovers with `final_answer`. That scenario measures a difference already visible in the code: upstream raises `AgentToolExecutionError: Unknown tool` (`agents.py:1466`), which marks the step errored (`agents.py:597-599`) and leaves the step's call list empty; ours records the failed call and continues (`tool-calling-agent.ts:142-148`). If the measurement shows that divergence, the scenario is recorded with `parity: "divergent"`, the exact `differsOn` set and a `why`, and our side's values pinned in `ourTrace`. Aligning the loop to upstream's shape is a separate decision, not part of this row.

**Refusals.** The recorder's blanket refusal becomes precise: a code scenario must declare no tools, and a tool-calling scenario may declare only the registered stubs. The TypeScript reader mirrors that rule instead of refusing tool-naming scenarios outright.

**Scope boundary.** The corpus still says nothing about tools called from code: that needs a real executor on our leg and a new trace field, and `0007` already put executor semantics out of scope. Parallel tool calls (upstream runs them on threads; our loop is sequential) and approval gates are out of this family as well.

**Release.** Post-release: it is test-only, adds no public surface and no CI step, and no user-facing document claims tool parity. `0030` keeps it out of the 0.1.0 gate.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Option A as the plan wrote it: a stub tool in CodeAgent scenarios | Changes no compared field, so the scenario asserts nothing about tools while the corpus stops refusing the case -- the appearance of coverage without the content. |
| A plus a real executor and a `toolsCalled` trace field | The only way to observe code-called tools, but it grows `CodeResult`, couples the parity suite to an engine, and contradicts `0007`'s declared boundary; that is a future decision, not this row. |
| Keep the corpus tool-free and state the scope (`C`) | Honest, and cheap, but leaves the branch that matters for a tool-using agent unpinned while the harness exists to pin exactly that. |
| One scenario only (the success path) | The failure path is where the two sides' vocabularies differ most, so a success-only family would report a clean comparison and hide the interesting divergence. |

## Consequences

**Positive**

- The corpus compares a model-emitted tool call: parsing, registry lookup, argument handling, execution, observation and the recovery turn.
- The schema gains an `agent` axis that later scenarios (approvals, guardrails, managed agents) can use without another shape change.
- The recorder's refusal becomes sharper rather than weaker: it distinguishes "code scenarios must not name tools" from "tool-calling scenarios replay stubs".
- The existing five recordings stay byte-identical; only two files are added.

**Negative / accepted costs**

- The recorder grows a second scripted-model shape (tool-call turns) and a stub `Tool` subclass; the reader grows a stub tool definition and a schema branch.
- Two new recordings must be made against the pinned release, and the tool-call branch is where a divergence is most likely -- the failure scenario may add a pinned difference to the corpus rather than a clean equality.
- The family still cannot see tools called from code, and it does not test parallel calls or approvals.
- The runbook's scenario procedure must change with the schema, or the next re-record will follow a stale rule.

## Reversibility

The corpus is test data: dropping the family means deleting two scenario files, two recordings and the schema branch, with no public surface to deprecate. The `agent` field is additive in the other direction too -- a future agent kind extends it without touching the existing scenarios.

## Follow-up

- [ ] `T-19`: the `agent` axis and `calls` turns in both readers, the shared `echo` stub on both legs, the success scenario, the failure scenario, then record and replay -- owner: next session.
- [ ] `T-19`: the recorder's refusal becomes the precise rule, and the runbook's failure-table row and "Adding a scenario" step are rewritten for the family -- owner: next session.
- [ ] `T-48`: add the planning scenario `D-02` unblocked -- S1.5 declined one because the two sides planned at different points, which is no longer true -- and correct the runbook note that says two divergences ship as pinned facts, since only the max-steps one is corpus-pinned today -- owner: next session.
- [ ] If the failure scenario measures the step-error divergence, pin it; changing our loop to match upstream's shape is a new decision -- owner: next session.
