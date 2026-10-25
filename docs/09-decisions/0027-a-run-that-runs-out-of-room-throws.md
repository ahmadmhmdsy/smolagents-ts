# 0027 — a run that runs out of room throws a typed error

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** implementing, documenting or catching the endings of `.run()`.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** owner, answering `D-01` in the open-decisions plan
- **Supersedes:** none; it settles the ending question `T-18` carried and the budget hole found beside it

## Context

Four of the loop's five endings reach `.run()` as a typed error, and the fifth does not. A step ceiling emits the terminal `run.maxStepsReached` and `.run()` throws `AgentMaxStepsError`. A cost, token or turn ceiling emits the terminal `run.limitReached`, and `.run()` had no branch for it, so its fallback threw a plain `AgentError` saying the run ended without a terminal event — a normal production condition reported as a missing record. The budget suites read `.stream()`, so no test met the wrong message.

Two smaller leftovers shared the same ground. `RunResult.state` declared `max_steps_reached`, and no path ever constructed it: `buildResult` is called with `success` or `waiting` only. And the design chapter described an earlier, upstream-shaped ending (one more model call after the budget, the text returned with an error state) that the port had already replaced by a throw; decision D8 recorded the divergence, the prose did not.

The forcing event is publication: the return type of `.run()` and the error taxonomy it exposes are public surface. A state value can be removed for free before 0.1.0 and is a breaking type change after it, and a return-shaped ending chosen later could not be added without redefining what every caller already destructures.

## Decision

`.run()` throws for every ending that is not a success, a wait or a transfer. The step ceiling keeps `AgentMaxStepsError`; a budget ceiling throws `AgentBudgetExceededError` with code `AGENT_BUDGET_EXCEEDED` and carries the `LimitStopReason` that ended the run. `RunState` loses `max_steps_reached` and keeps `success` and `waiting`. `.stream()` remains the channel that keeps partial output, because it yields every step and event before the terminal one, and the design chapter is corrected to describe the throw.

Two details are part of the record: the new error carries the stop reason only, not a usage snapshot, so the `run.limitReached` event keeps its current payload; and a child run that stops on a budget reports a new `budget` value on `ChildStopReason`, so the child vocabulary stays as precise as the run vocabulary.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Return a result shaped like a finished run, as upstream does after a ceiling | The returned text would have passed neither the guardrails nor the bound output schema, and the extra call would run outside the ceiling it reports reached. It also changes `.run()`'s return contract, which is a major version after publication. |
| Keep throwing by default and add an opt-in partial-result option | Two contracts to test, document and support before a caller has asked for the second. The partial data is already available through `.stream()`. |
| Keep the status quo and document it | Ships a public state value nothing produces and a misleading error for a normal ending. |

## Consequences

**Positive**

- Every non-success ending is one catch clause, and a caller can branch on the stop reason to decide between retrying with a larger ceiling and stopping.
- `RunResult.state` stops advertising an unreachable value, so a switch over it is exhaustive against reality.
- The design chapter and the code tell the same story, and the recorded divergence from upstream stays explicit rather than half-resolved.

**Negative / accepted costs**

- Callers who want the partial text still have to consume the event stream rather than read it off a result; that is the cost of keeping `output` meaning a certified answer.
- The port remains different from upstream in how a ceiling is reported. A later phase that decides to match upstream would add a separate entry point rather than change `.run()`.

## Reversibility

Cheap to extend, expensive to redefine. A value-returning variant can be added later as a new method or an additive overload without touching `.run()`; changing `.run()` itself to return instead of throw is a breaking change and would need a major version.

## Follow-up

- [ ] Add the error class, its code and the registry entry; branch on `run.limitReached` in `.run()`; remove the dead state; correct design chapter 14.1 — owner: lead, before 0.1.0.
- [ ] Pin the behaviour with `.run()` cases for both ceilings, a child-report case for the new stop reason, and the public-surface count — owner: lead, in the same unit.
