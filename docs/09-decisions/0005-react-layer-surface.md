# 0005 — the React layer's public surface

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before changing the React layer's surface, or before wondering why the
  design's section 10 sketch and the shipped primitives differ.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14T02:06:00+03:00
- **Decided by:** maintainer
- **Supersedes:** none

## Context

The design record's section 10 sketches the React layer's surface: a
`useAgentRun(agent, { autoStart })` hook with no task argument, step components
discriminated by a `kind` field, and a `components` override map. The core that
actually shipped presents a different shape. `AgentSession` is the state machine and owns
the run: it takes the task in `send`, it reports planning through its own `planning.*`
events rather than as a step of the action sequence, and its snapshot is the only supported
way to read a run. Three of the design's sketch details therefore have nothing to bind to,
and the S5 plan had to choose between inventing state in the React layer and following the
store.

## Decision

The React layer renders the session and owns no state. `AgentRun` starts one run from an
effect keyed on the session and the task, so the design's `autoStart` option does not
exist; planning is a lane (`snapshot.planning` plus `AgentStep.Planning`) rather than a
kind of step; and the surface adds `useAgentRunSnapshot()` so a consumer inside
`<AgentRun>` can compose the primitives against the same snapshot.
`AgentStep.FinalAnswer` renders the step's observation while `AgentRun.FinalAnswer`
renders the run's output.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Implement `autoStart` on `useAgentRun` | The hook has no task to start, and a run started by two mounted hooks would either duplicate or need a guard the store already provides. Starting from `AgentRun` gives the option one meaning: the component that holds the task starts the run. |
| Interleave planning into `steps` behind a `kind` discriminator | The store keeps planning out of `steps` because the loop emits it on its own cadence rather than inside the action sequence; a merged array would make every consumer filter it back out, and the step's index in the list would stop matching the index in the event stream. |
| Export the session through context instead of a snapshot getter | `<AgentRun>` owns the `AgentSession` that `useAgentRun` memoises, so a consumer could reach the store directly; a snapshot getter is the smaller promise and keeps the session itself private. |
| Drop `AgentStep.FinalAnswer` | The design lists it, a final-answer step still renders its own observation, and a consumer that wants the raw value in both places overrides the slot. |

## Consequences

**Positive**

- One source of state: every primitive reads the snapshot, so a second mount cannot diverge from the store.
- The surface is ten runtime names, pinned by `packages/react/test/public-surface.test.ts`.
- Planning is readable while it streams, without changing the step contract.

**Negative / accepted costs**

- The design's section 10.1 example does not compile as written — an upstream reader comparing the two finds a divergence, which is why this record exists.
- `AgentRun` starts a run as a side effect of mounting, so an agent created inline in a render body starts a new session on every render; the hook's doc comment states the stability requirement.

## Reversibility

Easy. Each choice is additive or local: adding an `autoStart` option, merging planning into
`steps`, or removing `useAgentRunSnapshot` is one commit inside `packages/react`, and
nothing released depends on them while the package is private.

## Follow-up

- [ ] Revisit `autoStart` and a merged step array if a run inspector ever needs planning interleaved with actions — owner: maintainer, after v1.
- [ ] Decide in S6 whether the React layer ships on the same version line as the core — owner: owner.
