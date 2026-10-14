# Investigation — how a budget-exhausted run ends

- **Task:** T-18
- **Owner:** owner
- **Started:** 2026-10-14T10:05:00+03:00

## Contract

- **Role:** the evidence behind T-18, which asks the owner to choose what a run
  that spends its last step should do.
- **Mutability:** append-only once filed; the finding is pinned to the revision
  it was read at.
- **Read when:** deciding T-18, or re-checking why the loop raises instead of
  answering.
- **Update when:** a later milestone changes the ending or moves the state value
  it declares.

## Question

Which ending should a run that exhausts its step budget have: upstream's extra
model call and reported text, or this port's thrown `AgentMaxStepsError`?

## Hypothesis and falsification gate

**PREREGISTERED by the S1.5 plan (F6), written before this session.**

- **Prediction:** upstream reports the last model output as the final answer and
  stores a third step that repeats the previous one's data; this loop emits
  `run.maxStepsReached` and `run()` throws.
- **Falsified if:** the committed recording shows the stored third step differs
  from the second in its tool-call list or its error, or either side does
  something other than the two endings above.
- **Gate:** the committed recording and both source trees, read directly; PASS if
  every compared field's difference is attributable to a named mechanism.

## Setup

- **Environment:** `docs/02-environment.md` owns the toolchain; the recorder's
  Python wrote the recording and nothing was run for this read.
- **Inputs:** `scripts/parity/recordings/step-budget.json` (maxSteps 2, three
  scripted turns); the vendored clone under `smolagents/`; the tag `v1.14.0`;
  this port's `packages/core/src/agent/multi-step-agent.ts`.
- **Variants:** upstream v1.14.0 (the version every recording pins), the clone at
  1.27.0.dev0 (the version the design record pins), this port.
- **Budget:** a read-only source comparison; no live model call was made.

## Method

Read the loop and its terminal branch in all three trees, the design record's
sections 6.2 and 14.1, the S1.5 plan's F6, and the committed recording. Every
claim below was re-checked against the file it cites; the two version numbers
were read from the trees' own metadata.

## Results

| Variant | Metric | Result | Source artifact | Notes |
|---|---|---|---|---|
| upstream v1.14.0 | model calls on exhaustion | the scripted turns plus one "get unstuck" call | upstream `agents.py` | the extra call is not bounded by the step budget |
| upstream v1.14.0 | stored steps | task, action, action, synthetic action | upstream `agents.py` | the synthetic step carries the error and an empty tool-call list |
| upstream v1.14.0 | reported answer | the extra call's text | upstream `agents.py` | a failed extra call is swallowed into an error string |
| clone at 1.27.0.dev0 | the same three rows | the same shape | `smolagents/src/smolagents/agents.py` | the synthetic step also carries token usage, and the state it reports is `max_steps_error` |
| this port | model calls, steps, answer | the scripted turns, two action steps, no answer | `packages/core/src/agent/multi-step-agent.ts` | the loop emits `run.maxStepsReached` and returns |
| this port | `run()` | throws `AgentMaxStepsError` | `packages/core/src/agent/multi-step-agent.ts` | the terminal event is converted into a failure |
| this port | the declared run state | `"max_steps_reached"`, never produced | `packages/core/src/agent/run-result.ts` | the result builder is only ever called with `"success"` |
| recording | outcome, answer, steps | final answer, the third turn's raw text, three actions | `scripts/parity/recordings/step-budget.json` | the third action has an empty tool-call list and its error set |

## Gate verdict

| Gate | Required | Actual | Verdict |
|---|---|---|---|
| F6's prediction | every compared field explained by a named mechanism | the three endings are as predicted, but F6's account of the stored step is wrong | FAIL (the prediction), PASS (the gate) |

The gate passes: the difference is fully attributable. The preregistered
prediction fails on one detail — see below.

## Conclusion

The behavioural difference is larger than the design record's section 14.1
implies. That table presents the max-steps row as a vocabulary swap, while
upstream's ending also spends one model call outside the budget, appends an
error-carrying synthetic step, and returns rather than raising. Section 6.2 of
the same record commands the throw, so the record's rationale in 14.1 and its
loop diagram disagree with each other.

Three corrections to earlier records:

- The S1.5 plan's F6 says the stored third step repeats the previous one's data.
  It does not: the recording's third action has an empty tool-call list and its
  error set, while the second has the code call and no error. What repeats is the
  extra action step re-yielded on the stream, which exists because upstream has
  no event model.
- The vendored clone is **1.27.0.dev0**, not 1.14.0; 1.14.0 is the installed
  distribution and the version every recording pins. The two differ on this
  topic: 1.27 has a result type and a state, 1.14 has neither.
- The S1 plan left the dead state value to S1.5 ("makes it reachable or drops
  it"), and S1.5 did neither.

The evidence does **not** support: what the extra call would actually answer; how
the two releases differ in token accounting on the synthetic step; or that a real
provider's post-budget failure is handled well by either version.

## Levers to carry forward

- A terminal branch is part of a port's behaviour, not a name; when a design
  record lists a divergence as vocabulary, check the branch it names.
- The step budget means different things on the two sides: an action-step cap
  upstream, an exact loop cap here. Any decision on T-18 has to say which one the
  project documents, because the two cannot both hold.
- A pinned reference version belongs in one home; the design pins one upstream
  and the recordings pin another, so a later re-record silently changes what the
  comparison means.

## Close-out

- [x] filed under `docs/research/`
- [ ] result-ledger row, if one exists
- [ ] lesson shard and its registry row
- [ ] the T-18 row in `docs/04-tasks.md`
- [ ] artifacts kept per rules/09

## Addendum — the diff, the options and the recommendation

### The diff

The endings are structurally different rather than a one-line change: upstream finishes a Python `while` by calling the model once more and returning its text, while this port finishes a `for` loop by emitting an event that `run()` turns into a throw — `smolagents/src/smolagents/agents.py:545,606-611,625-637` against `packages/core/src/agent/multi-step-agent.ts:249,354,183-187`.

```diff
--- smolagents/src/smolagents/agents.py:545,606-611,625-637
+++ packages/core/src/agent/multi-step-agent.ts:249,354,183-187
@@ budget exhausted
-while not returned_final_answer and self.step_number <= max_steps:      # agents.py:545
-    ...                                                                 # one ActionStep per pass
-if not returned_final_answer and self.step_number == max_steps + 1:     # agents.py:606
-    final_answer = self._handle_max_steps_reached(task)                 # agents.py:607
-yield final_answer_step                                                 # agents.py:611
-def _handle_max_steps_reached(self, task):                              # agents.py:625
-    final_answer = self.provide_final_answer(task)                      # agents.py:627
-    final_memory_step = ActionStep(error=AgentMaxStepsError("Reached max steps."),
-        token_usage=final_answer.token_usage)                           # agents.py:628-632
-    final_memory_step.action_output = final_answer.content              # agents.py:634
-    self.memory.steps.append(final_memory_step)                         # agents.py:636
-    return final_answer.content
+for (let stepIndex = 0; stepIndex < this.maxSteps; stepIndex += 1) {    # multi-step-agent.ts:249
+  ...                                                                   // one action step per pass
+}
+yield this.emit({ type: "run.maxStepsReached", steps: this.maxSteps }); // multi-step-agent.ts:354
+case "run.maxStepsReached":                                             // multi-step-agent.ts:183
+  failure = new AgentMaxStepsError(
+    "Reached the maximum number of steps (" + String(event.steps) + ")");
```

### The full picture

Upstream's `while` counts action steps (`agents.py:545`); past the budget it spends one more model call through `provide_final_answer` (`agents.py:627`), appends a synthetic `ActionStep` carrying `AgentMaxStepsError` and the answer's usage (`agents.py:628-636`), and returns that text, so `run()` reports `state = "max_steps_error"` (`agents.py:523-526`). This port's `for` header is the whole budget (`multi-step-agent.ts:249`), emits `run.maxStepsReached` at `:354`, and throws at `:183-187`, as design D8 demands (`docs/design/2026-10-12-smolagents-ts-v1-design.md:424-428`).

The record's `## Results` measures upstream as "the scripted turns plus one 'get unstuck' call" storing "task, action, action, synthetic action", and this port as "the scripted turns, two action steps, no answer"; the recording shows `"outcome": "final-answer"` with a third action whose `"toolCalls"` is empty and `"error"` true, while `scripts/parity/scenarios/step-budget.json:37-44` pins our `"max-steps"` and null answer. A caller here gets a rejection with no output; there, the extra call's text, and `state: "max_steps_error"` under `return_full_result=True`; and the `"max_steps_reached"` state declared at `run-result.ts:4` is never produced.

### The options

| option | what changes | pros | cons | gaps |
|---|---|---|---|---|
| match upstream | post-budget `provide_final_answer` call, synthetic error `ActionStep`, return its text, no throw | the recorded divergence disappears at the source | one call lands outside `maxSteps`; overturns D8 | `packages/core/test/multi-step-agent.test.ts:160,173` pin the event and throw; `scripts/parity/scenarios/step-budget.json` must change; `scripts/parity/record.py:158` records the installed distribution, not the clone |
| keep ours and document it | no loop change; the dead `RunState` at `run-result.ts:4` and the 14.1 row corrected | keeps D8 and the tested throw (`multi-step-agent.test.ts:173`) | a caller still gets no answer where upstream returns one | no test asserts `"max_steps_reached"` (`packages/core/test/events.test.ts:31`); `docs/04-tasks.md` and design 14.1 go stale |
| a flag that selects either | an `AgentOptions` toggle branching at `multi-step-agent.ts:354` and in `run()` | a caller chooses without forking the loop | two terminal branches for a choice the project can state once | no recording covers the answer branch; a new public type must join `packages/core/test/public-surface.test.ts:16` |

### Recommendation

Keep ours and document it: D8 already forbids the extra call, `run()` throws under test at `multi-step-agent.test.ts:173`, and `parity.test.ts:10-12` commits recordings so a named divergence is acceptable. Smallest change: leave `multi-step-agent.ts:354` and `run()` at `:183-187` alone, delete `"max_steps_reached"` from `RunState` at `packages/core/src/agent/run-result.ts:4`, and correct design 14.1 at line 974; no test or recording moves. Reverse if `run()` must never throw on a spent budget, or if upstream brings the extra call inside the budget.

### The owner's decision

Question: T-18 — should a run that spends its last step keep this port's thrown `AgentMaxStepsError`, or return upstream's extra model call and its reported text?
Options: match upstream | keep ours and document it | a flag that selects either.

