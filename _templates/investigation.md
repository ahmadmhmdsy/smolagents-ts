# Investigation — <title>

- **Task:** <task ID in docs/04-tasks.md>
- **Owner:** <owner>
- **Started:** <ISO 8601 with offset>

## Question

One sentence. What does this investigation decide? If it decides nothing, it is
not an investigation — it is curiosity, and it belongs in a scratch file.

## Hypothesis and falsification gate

**PREREGISTERED — write this before running anything.**

- **Prediction:** a falsifiable statement of the expected outcome.
- **Falsified if:** the specific observation that would prove the prediction
  wrong.
- **Gate:** the number, threshold, or condition that separates pass from fail.

A result reported against a gate written afterwards is not evidence.

## Setup

- **Environment:** what it ran on, with versions or a link to
  docs/02-environment.md.
- **Inputs:** data, fixtures, or configuration, with their exact locations.
- **Variants:** each arm or condition, and what is held **identical** across
  them.
- **Budget:** the time, cost, or resource ceiling, and the stop condition.

## Method

What was actually done, in enough detail to repeat it. Commands verbatim.

## Results

Every number cites the artifact it came from. Never merge two sources into one
table without saying so.

| Variant | Metric | Result | Source artifact | Notes |
|---|---|---|---|---|
| | | | | |

## Gate verdict

| Gate | Required | Actual | Verdict |
|---|---|---|---|
| **ADAPT** | **ADAPT** | **ADAPT** | PASS / FAIL |

Verdicts use PASS, FAIL, SKIPPED, or BLOCKED with a reason. There is no
"mostly passed".

## Conclusion

What was learned, in the plainest available language. State what the evidence
does **not** support as clearly as what it does.

## Levers to carry forward

Concrete, transferable findings with the conditions under which they hold. What
should a future session do differently because of this?

- **ADAPT**

## Close-out

- [ ] Report finished and filed.
- [ ] Row added to the project's result ledger, if one exists.
- [ ] Lesson added to the topic's shard, `docs/memory/<topic>.md`, and that topic's row updated in `docs/05-memory.md`.
- [ ] Task status updated in docs/04-tasks.md.
- [ ] Artifacts retained or cleaned up per rules/09.
