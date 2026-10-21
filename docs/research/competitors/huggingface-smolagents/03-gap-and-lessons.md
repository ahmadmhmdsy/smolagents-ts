# huggingface/smolagents — gap analysis and lessons for this port

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Baseline row ids come from `docs/research/competitors/_synthesis/00-our-baseline.md`.
Buckets, effort sizes and the meaning of "fit" are defined in
`docs/research/competitors/_method.md`. Every upstream pointer is relative to the
clone root at commit `96f33fa`.

## Gaps, bucketed

| bucket | capability | baseline row | fit | effort | evidence | what would change |
|---|---|---|---|---|---|---|
| D | several tool calls per step | RT-02 | `packages/core/src/agent/tool-calling-agent.ts` | S | `src/smolagents/agents.py:1426-1434` | one step may return a batch, executed concurrently and answered in call order |
| E | plan before the first action | RT-03 (T-16) | `packages/core/src/agent/multi-step-agent.ts:412` | S | `src/smolagents/agents.py:550-552` | a first plan is generated before step one when an interval is set |
| E | a usable answer when the budget ends | RT-06 (T-18) | `packages/core/src/agent/multi-step-agent.ts` | S | `src/smolagents/agents.py:606-637`, `:523-526` | result carries a state value; the extra answer call becomes optional and budgeted |
| E | interrupt plus in-process continuation | HL-06 (HL-03) | `packages/core/src/agent/multi-step-agent.ts:400-410` | M | `src/smolagents/agents.py:754-756`, `:440`, `:477-480` | a step-boundary stop distinct from an abort, then resume from stored state |
| A | review gate on a plan | HL-06, HL-02 | `packages/core/src/middleware.ts` | M | `examples/plan_customization/plan_customization.py:62-97` | a plan callback can edit the plan, reject it or pause for a person |
| D | replay a finished run | HL-07 | `packages/core/src/session/run-store.ts` | S | `src/smolagents/memory.py:248-277` | the inspector renders a stored run step by step |
| C | agent definition written to disk | none | `packages/smolagents-ts/` | L | `src/smolagents/agents.py:892-968`, `:1010-1158` | a folder or single file that reloads to an equivalent agent |
| C | tool artifact with its requirements | TL-01, TL-02 | `packages/tools/src/collection.ts` | M | `src/smolagents/tools.py:292-359` | a portable tool record carrying schema, source and dependencies |
| C | getting tools and variables into a remote guest | EX-03, EX-04 | `packages/exec-remote/src/backends/` | M | `src/smolagents/remote_executors.py:94-133` | a defined boundary contract with tests, not an implicit one |
| C | interpreter exposed as a tool | RT-02, EX-02 | `packages/tools/src/collection.ts` | S | `src/smolagents/default_tools.py:39-80` | tool-calling agents get the existing executor behind a tool |
| C | browser demonstration | EX-09 | `packages/tools/src/collection.ts` | M | `src/smolagents/vision_web_browser.py:66-80`, `:240` | a demo package outside core, with a note that the browser is not sandboxed |
| E | CLI parity defects fixed locally | CL-01 | `packages/cli/src/interactive.ts` | S | `src/smolagents/cli.py:158`, `:168`, `:195-216` | the chosen action type survives setup and every offered model class loads |
| E | an exporter seam for telemetry | OB-02, OB-07 | `packages/core/src/monitoring/trace.ts` | S | `pyproject.toml:69-73`, `tests/test_telemetry.py:26-36` | spans reach a sink the caller supplies; no vendor SDK in core |
| D | one usage accounting path | RT-11, RT-13 | `packages/core/src/monitoring/monitor.ts` | S | `src/smolagents/monitoring.py:100-118` against `src/smolagents/agents.py:506-521` | monitor and result derive from the same step records |
| D | a step-typed observer | RT-08 | `packages/core/src/middleware.ts` | S | `src/smolagents/memory.py:280-316` | middleware may already cover this; decide before adding a second mechanism |
| B | image and audio in task, observation and answer | MD-04 | decision 0018 keeps it out | XL | `src/smolagents/agent_types.py:74-140`, `src/smolagents/memory.py:112-124` | recorded, not queued; revisit only if 0018 changes |

## What upstream lacks that we already ship

- A typed event stream that a renderer subscribes to; upstream hands out step
  objects and text deltas and lets the loop drive a Rich display.
- An approval gate before a tool runs. Upstream has final-answer checks and step
  callbacks, but nothing suspends a call for consent.
- A checkpoint after each step and a store seam. Upstream memory exists only in
  the process, so a crash loses the run.
- Cancellation that reaches into an awaited model or tool call; the upstream flag
  is polled once per iteration.
- Guardrails with typed reasons. Upstream stops at caller checks and its error
  hierarchy.
- A non-Python runtime. There is no JavaScript or browser-targeted executor in
  upstream, which is the port's differentiator.
- Schema-validated final answers. Upstream returns whatever `final_answer` was
  given.

## Patterns worth copying

1. **A callback registry over step types.** `CallbackRegistry` stores callbacks
   by class, walks the step's MRO and adapts to one-parameter or two-parameter
   signatures (`src/smolagents/memory.py:280-316`). It is a small amount of code
   for a durable extension point, and old one-argument callbacks keep working.
   Land it behind RT-08 or the step boundary described in HL-06.

2. **A public single-step operation.** `step(memory_step)` returns the last item
   of one step's generator (`src/smolagents/agents.py:782-787`), so tests, custom
   loops and stepwise UIs reuse the loop instead of imitating it. Fits HL-03.

3. **An executor factory named by a string.** `executor_type` plus keyword
   arguments selects and builds one of five executors
   (`src/smolagents/agents.py:1583-1616`), all behind one three-method interface
   (`src/smolagents/local_python_executor.py:1677-1686`). A serialised agent
   configuration can name its executor without shipping an instance.

4. **A reduced projection for planning.** Summary mode removes the system prompt
   and earlier plans before a plan update (`src/smolagents/agents.py:684`,
   `src/smolagents/memory.py:174-183`). The same step objects serve both the full
   transcript and the compact planning context.

5. **Allowlist registries instead of dynamic imports.** Models and agents reload
   through literal dictionaries of known classes
   (`src/smolagents/agents.py:1023-1041`, `src/smolagents/models.py:2070`),
   which keeps a saved agent from importing arbitrary names.

6. **Two renderings of one tool.** The same tool object produces a Python
   signature for code agents and a JSON schema for calling agents
   (`src/smolagents/tools.py:258`, `:289`). One registry then serves both loops.

7. **Requirements derived from the source.** Tool serialisation extracts imports
   and turns them into an install list (`src/smolagents/tools.py:357`), so an
   exported artifact states what it needs to run.

## Patterns to avoid

1. **Building a language runtime to get safety.** The interpreter is 1768 lines
   with a larger test file, and its own docstring says it is not a sandbox
   (`src/smolagents/local_python_executor.py:1693`). We already pay for a real
   isolation boundary in WASM; a second interpreter would be a maintenance
   product, not a feature.

2. **A timeout that abandons a thread.** On expiry the caller is unblocked while
   the evaluation keeps running (`src/smolagents/local_python_executor.py:298-316`).
   A resource limit that cannot stop the work is a promise the runtime cannot
   keep.

3. **Loading tool definitions by executing their source.** Reload runs
   `exec` on the stored string behind a boolean trust flag
   (`src/smolagents/tools.py:572-575`, `:521-560`). Prefer a data format the
   runtime interprets, and keep `exec` out of the load path.

4. **Mutating history to save tokens.** The browser demo deletes screenshots from
   earlier steps to keep the context small
   (`src/smolagents/vision_web_browser.py:71-73`). That makes the record depend on
   the rendering policy; budget decisions belong in the projection, not the store.

5. **Calling a UI renderer from inside the loop.** Planning opens a Rich display
   mid-generator (`src/smolagents/agents.py:662`, `:717`), so every consumer
   inherits console behaviour.

6. **Letting two accounting paths disagree.** The monitor totals action steps only,
   while the result object adds planning steps
   (`src/smolagents/monitoring.py:100-118`, `src/smolagents/agents.py:506-521`).
   A dashboard and a stored record then report different costs for one run.

7. **Hiding an extra model call in the budget ending.** The forced answer is an
   unbudgeted call whose failure text can become the answer
   (`src/smolagents/agents.py:627`, `:846-853`). If we copy the policy, expose the
   call and keep failures as failures.

8. **A serialised agent with no version and no tool configuration.** Reload
   forgets tool constructor arguments (`tests/test_agents.py:2440-2442`) and
   writes no schema version anywhere, so a reader cannot detect drift.

## What this should change for us

1. **T-16, planning cadence.** Adopt "plan first, then every interval" or record
   why our first-action-first choice is better; either way the divergence becomes
   a decision, not a drift (S).

2. **T-18, the ending.** Add a state field to the result, and make any forced
   answer an explicit, budgeted option. Do not double-yield the last step (S/M).

3. **RT-02, batched calls.** Accept a list of tool calls per step, run
   independent calls concurrently, return results in call order, keep one-call
   steps the default (S/M).

4. **HL-06, stop and continue.** A stop at a step boundary plus resume from the
   existing checkpoint is a smaller change than a new state machine, and it turns
   plan review and approvals into consumers of the same seam (M).

5. **HL-02, pending approvals.** Upstream has no pattern to copy here; design the
   suspended call as serialised state that a queue or UI can carry, and do not
   imitate the callback-plus-exception example (M).

6. **HL-07, replay.** Render a stored run for the inspector and the console; that
   is the whole of upstream's replay, and it needs no execution (S).

7. **OB-02, export.** Ship a sink interface and keep vendor SDKs out of core. The
   upstream precedent is an external instrumentor listed as an optional extra,
   which is evidence that the ecosystem route works (S).

8. **RT-11 and RT-13, usage.** Fold planning usage into the monitor and derive
   both views from the step records (S).

9. **TL-01 and TL-02, portable tools.** Add a tool record that carries schema,
   dependencies and a content hash, and decide the remote-shipping contract
   before implementing it (M).

10. **CL-01, inherited defects.** Fix the discarded action type and the
    unloadable model choice in our own CLI rather than preserving upstream
    behaviour (S).

## Baseline corrections and calibrations

- No competitor-facing status in the baseline was contradicted. The rows this
  dive could test against upstream (RT-02, RT-03, RT-06, HL-06, CL-01) describe
  our surface accurately.
- The baseline has no row for the prompt-template seam, although core ships it
  (`packages/core/src/prompts/templates.ts`,
  `packages/core/src/prompts/populate-template.ts`). Propose a new RT row so the
  comparison does not depend on reading package code.
- The baseline has no row for writing an agent definition to disk or reading it
  back. Upstream ships that capability, so our parity tracking has a hole; a row
  with status absent would make the gap visible without claiming work.
- MA-03 is calibrated by this read: upstream also returns a string from a managed
  agent, so our minimal status matches the neighbour. An upgrade would put us
  ahead of it, not at parity.
- HL-06 is calibrated: upstream's interrupt is a polled flag and its continuation
  is in-process memory only. Treat interrupt as parity and durability as ours.
- RT-05 stays ahead: upstream streams raw text, never code-block deltas, so this
  read neither supports nor weakens the T-30 note.
- OB-02 stays ahead: with no exporter in upstream, our planned OTel work has no
  competitor implementation to copy, only the external-instrumentor precedent.

## Questions this read leaves open

- How our remote executors receive tools and variables is not settled by this
  dive, which did not read our executor packages. Upstream's
  `send_tools` and `send_variables` are the contract to compare against.
- Whether our CLI should remain upstream-shaped at all is a T-21 question; the
  two defects make the answer matter.
- Whether an agent definition format is in scope is undecided; no task or
  decision names it, and upstream's version is Hub-shaped rather than portable.
- Whether a step-typed observer is needed on top of middleware is a design
  question this dive cannot answer; the callback registry is evidence that the
  pattern works, not proof that we lack it.
