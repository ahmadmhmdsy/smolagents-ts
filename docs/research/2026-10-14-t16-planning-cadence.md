# Investigation — the planning cadence and what a planner is shown

- **Task:** T-16
- **Owner:** owner
- **Started:** 2026-10-14T10:05:00+03:00

## Contract

- **Role:** the evidence behind T-16, which asks the owner to choose this port's
  planning cadence and the content the planner is given.
- **Mutability:** append-only once filed; the finding is pinned to the revision
  it was read at.
- **Read when:** deciding T-16, or re-checking why the loop plans where it does.
- **Update when:** a later milestone changes the cadence or re-authors the
  planning prompts.

## Question

Should a planning-enabled run plan before its first action, and with which
prompt, or keep this port's later, full-context plan?

## Hypothesis and falsification gate

**PREREGISTERED by the S1.5 plan (F7), written before this session.**

- **Prediction:** upstream plans before the first step while this loop plans after
  the first action, so the two cadences differ.
- **Falsified if:** the two conditions select the same 1-based step numbers, or
  the difference is narrower than a whole-cadence shift.
- **Gate:** both conditions read in the vendored clone and in the tag the
  recordings pin, plus the shipped loop and its test; PASS if every positional
  difference is explained and the remainder of the cadence matches.

## Setup

- **Environment:** `docs/02-environment.md` owns the toolchain; nothing was
  built or run for this read.
- **Inputs:** the vendored clone under `smolagents/`; the tag `v1.14.0`; this
  port's loop, memory and prompt directory; the planning-lane test.
- **Variants:** upstream v1.14.0 (what the recordings pin), the clone at
  1.27.0.dev0 (what the design pins), this port.
- **Budget:** a read-only source comparison; no model call.

## Method

Read the planning condition in both upstream trees, the loop and the planning
helper here, the memory writer that builds the planner's input, the prompt
directory, and the test that pins the lane. Each tree's version was read from its
own metadata.

## Results

| Variant | Metric | Result | Source artifact | Notes |
|---|---|---|---|---|
| upstream, both releases | 1-based steps that plan | the first, then every N+1 | upstream `agents.py` in both trees | one condition, unchanged between the releases |
| this port | 1-based steps that plan | every N+1, never the first | `packages/core/src/agent/multi-step-agent.ts` | the loop carries an extra guard the design pseudocode also carries |
| upstream | initial-plan input | one user message from a template | upstream `agents.py` | no system prompt and no memory |
| upstream | update-plan input | a system prelude, summary-mode memory, a user postlude | upstream `agents.py` and `memory.py` | summary mode drops the system prompt, the thoughts and earlier plans |
| this port | planner input | the whole transcript plus one fixed sentence | `packages/core/src/memory/memory.ts` and `packages/core/src/agent/multi-step-agent.ts` | the first plan therefore sees the first observation and its thought |
| this port | planning templates | none | `packages/core/src/prompts/` | upstream's planning section runs to 112 lines |
| this port | the test that pins it | the first plan is keyed to step index 1 | `packages/core/test/agent-session-planning.test.ts` | a unit assertion rather than a probe artifact |

## Gate verdict

| Gate | Required | Actual | Verdict |
|---|---|---|---|
| F7's prediction | both conditions read, every positional difference explained | only the first plan is missing; every later position already matches | FAIL (the prediction), PASS (the gate) |

The gate passes. The preregistered prediction overstates the gap: what differs is
one plan's presence, not the cadence.

## Conclusion

The port is faithful to its design record and the record is not faithful to
upstream. The design's pseudocode guards the planning branch with `stepIndex > 0`,
which upstream's condition does not have, so the initial plan is never taken; the
S1 plan copied that line and the shipped loop still carries it. The same record
calls the loop a port of upstream's stream method, which is true of the loop's
shape and false of this branch.

The content differs as well, and the design is silent on it: upstream splits an
initial plan from an update plan, wraps each in its own text, tells the planner
how many steps remain, and gives the update plan a summary of memory rather than
the transcript. This port sends the whole transcript with one hardcoded sentence,
so its first plan sees the first observation and the thought that produced it —
context upstream's initial plan never receives. The design record also names two
seams that were never built: a planning method on the model interface and a
summary-mode option on the memory writer.

The evidence does **not** support: whether the richer planner produces better
plans; whether the design dropped the planning templates deliberately (no
decision record mentions them); or whether a planned scenario can be added to the
corpus without changing the per-turn schema, which was reasoned about but not
tried.

## Levers to carry forward

- The first plan is the whole positional difference. A fix that only adds the
  first plan changes the model-call order for every planning-enabled user while
  still leaving the prompts divergent, so it buys a regression net and not a
  parity assertion.
- Before treating a prompt as ported, check the prompt directory: a hardcoded
  instruction in the loop looks nothing like a template file, and a claim that
  every upstream section was re-authored is not evidence that it was.
- An upstream condition belongs in the record as the condition, not as prose
  about it; the missing guard survived four milestones because the record stated
  the port's rule and called it upstream's.

## Close-out

- [x] filed under `docs/research/`
- [ ] result-ledger row, if one exists
- [ ] lesson shard and its registry row
- [ ] the T-16 row in `docs/04-tasks.md`
- [ ] artifacts kept per rules/09

## Addendum — the diff, the options and the recommendation

### The diff

The cadence difference is one condition; the input difference is a whole construction, so the block shows both. Upstream's condition and its two input branches are at `smolagents/src/smolagents/agents.py:550-552,639-657,684-713`; this port's condition and its one shared builder are at `packages/core/src/agent/multi-step-agent.ts:257,390-407`.

```diff
--- smolagents/src/smolagents/agents.py:550-552,639-657,684-713
+++ packages/core/src/agent/multi-step-agent.ts:257,390-407
@@ before the first action
-if self.planning_interval is not None and (                            # agents.py:550
-    self.step_number == 1 or (self.step_number - 1) % self.planning_interval == 0
-):                                                                     # agents.py:551
-    self.memory.steps.append(planning_step)                            # agents.py:567
+if (this.planningInterval > 0 && stepIndex > 0 &&
+    stepIndex % this.planningInterval === 0) {                          // multi-step-agent.ts:257
+  const planning = yield* this.runPlanningStep(stepIndex, context);     // :258
+}
@@ what the planner receives
-if is_first_step:                                                       # agents.py:643
-    input_messages = [ChatMessage(USER,
-        populate_template(self.prompt_templates["planning"]["initial_plan"],
-            variables={"task": task, "tools": self.tools, ...}))]       # agents.py:644-657
-else:
-    memory_messages = self.write_memory_to_messages(summary_mode=True)  # agents.py:684
-    input_messages = [plan_update_pre] + memory_messages + [plan_update_post]
+const messages = this.transcript();                                     # multi-step-agent.ts:395
+messages.push({ role: "user", content: PLANNING_INSTRUCTION });         // :396
+const completion = yield* this.streamCompletion(
+    messages, stepIndex, context, "planning");                          // :398
```

### The full picture

Upstream's condition has two arms — the counter is 1, or one past a multiple of the interval (`agents.py:550-552`) — so a planning-enabled run always plans before its first action. `is_first_step` is whether the task step is alone in memory (`agents.py:556`): the initial plan is one user template with tools and task (`agents.py:644-657`), the update plan a system prelude, summary-mode memory and a user postlude carrying `remaining_steps` (`agents.py:684-713`). This port adds `stepIndex > 0` (`multi-step-agent.ts:257`) and feeds both plans from the full transcript plus `PLANNING_INSTRUCTION` (`:395-398`, `:66-67`), the same guard the design pseudocode carries (`docs/design/2026-10-12-smolagents-ts-v1-design.md:391`).

The record's `## Results` measures planning at "the first, then every N+1" upstream and "every N+1, never the first" here, pinning the first plan to step index 1 at `packages/core/test/agent-session-planning.test.ts:38`; that assertion holds only because the loop runs the first action at index 0. It also measures upstream's planning section at 112 lines against none: `packages/core/src/prompts/templates.ts` holds no planning text and `packages/core/src/model.ts:80-89` has no `generateForPlanning`, so the seams at design `:393` were never built. A consumer here gets no plan before the first action and a first plan already containing the first observation; upstream's update plan drops the system prompt, the thoughts and the earlier plans in summary mode (`memory.py:174-183`). All five `scripts/parity/scenarios/*.json` declare `"planningInterval": 0`.

### The options

| option | what changes | pros | cons | gaps |
|---|---|---|---|---|
| match upstream in full | drop `stepIndex > 0`; port the initial and update templates and the model and memory seams | restores cadence and input split | large, and no recording covers the lane | no planning goldens in `packages/core/src/prompts/templates.ts`; `packages/core/test/agent-session-planning.test.ts:38` must move; the per-turn schema change was never tried |
| match the cadence only | delete `stepIndex > 0` at `multi-step-agent.ts:257` | closes the one positional difference the record names | both plans still share one input, so no parity assertion follows | `packages/core/test/agent-session-planning.test.ts:38` moves 1 to 0; design 391 goes stale; no recording covers the new call |
| keep ours and document it | no loop change; correct design 391 and add a 14.1 row | the shipped lane and its test stay untouched | the first action stays unplanned, with no decision record behind that | must supersede the record's `## Conclusion`; `packages/core/test/agent-session-planning.test.ts` still pins only index 1 |

### Recommendation

Match the cadence only: the guard is upstream's second arm without its first, no decision record chooses the later plan, and one line at `multi-step-agent.ts:257` restores the rule. Blast radius: `packages/core/test/agent-session-planning.test.ts:38` moves from 1 to 0, and design line 391 needs correcting; no recording moves, because the corpus pins `"planningInterval": 0`. Leave the prompt content to a separate decision, since porting `initial_plan` and summary-mode memory is larger and no recording can assert it yet. Reverse if the owner wants the prompts matched first, or if a decision records the later plan as deliberate.

### The owner's decision

Question: T-16 — should a planning-enabled run plan before its first action, or keep this port's plan after it?
Options: match upstream in full | match the cadence only | keep ours and document it.

