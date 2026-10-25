# 0028 — the planning lane is structurally upstream-shaped, and its prompt text is ours

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is recorded as a new file that supersedes this one; this file is not edited.
- **Read when:** implementing, testing or documenting planning, or comparing this port with upstream's planning behaviour.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** owner, answering `D-02` in the open-decisions plan
- **Supersedes:** none; it settles the planning-cadence question `T-16` carried and narrows the divergence recorded by the T-16 research note

## Context

Upstream plans before the first action and every interval after it; this port planned only after the first action, because the design pseudocode carried upstream's second condition without its first. That was one difference. The other was the planner's input: upstream builds the first plan from a user template carrying the task, the tools and the managed agents, and every later plan from a system prelude, a summary-mode memory and a user postlude carrying the remaining steps. The port fed both plans the full transcript plus one fixed instruction, and never told the planner how much room was left.

Nothing measured the lane: no planning golden, and every parity scenario declares no interval. The question was whether to fix the one positional difference, keep the divergence and document it, or close both gaps.

The scale argument settles it. Planning exists for long-horizon runs. Under the port's input rule the planner reads the whole transcript, so the planning call grows with every step and earlier plans keep influencing later ones; under upstream's rule the update plan sees observations and a few preludes, so its size stays flat. A cadence-only fix would leave exactly that growth in place — the one feature meant for long runs carrying the cost profile of a short one.

## Decision

Port the plan lane structurally:

1. **Cadence.** Plan at step 0, then every `planningInterval` step, which is upstream's two-armed condition.
2. **First plan.** One user turn built from an initial-plan template carrying the task, the tool prompts and the managed agents; the reply ends at the `<end_plan>` stop sequence and is wrapped the way upstream wraps a plan.
3. **Update plans.** A system prelude carrying the task, the summary-mode memory, and a user postlude carrying the tools, the managed agents and the remaining steps.
4. **Summary mode.** `AgentMemory.toMessages` gains the mode: the system prompt and earlier planning steps render nothing, an action step renders its tool calls and its observations without the model output, and the task and the condensation summaries stay.
5. **Text.** The three templates are re-authored in this project's voice with upstream's structure, not copied from it. Wording parity is not claimed; if byte-level fidelity is ever wanted, that is a new record.

The cost is one extra planning model call before the first action of a planning-enabled run, and the plan content a user sees changes with it.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Fix the cadence only | Leaves the planner's input growing with the transcript — the scale defect the lane exists to avoid — and leaves plan quality dependent on text upstream never shows its planner. |
| Keep the port's lane and document it | Enshrines an accident of transcription as a choice, and leaves a future reader to rediscover it against upstream's source. |
| Copy upstream's prompt text verbatim | Legally available under the notice this repository already carries, but it conflicts with the re-expression stance every other prompt here follows and would drift on upstream's next prompt rewrite. It is a separate record if demanded. |

## Consequences

**Positive**

- The planner's context stays bounded as a run grows, which is the behaviour long-horizon users need.
- The first action is guided by a plan instead of followed by one, and later plans know how many steps remain.
- Cadence, inputs, stop sequence and wrapper match upstream structurally, so a migration comparison is meaningful.

**Negative / accepted costs**

- One more model call, and its tokens, before the first action of a planning-enabled run.
- Planning users see different plan content after this lands; it is a behaviour change, not an API one.
- Three more templates to keep current as upstream's prompts evolve, with the wording permanently ours.

## Reversibility

Behaviour, not API: the plan text is data, and the mode is an option on an internal projection. Tuning the templates or the cadence later breaks no caller; only a revert to the old input rule would change what planning users see again.

## Follow-up

- [ ] Loop: cadence, the two message shapes, the stop sequence and the wrapper — owner: lead, before 0.1.0.
- [ ] Memory: the summary-mode branch and its unit cases — owner: lead, in the same unit.
- [ ] Tests: plan before the first step, the update shape, the stop sequence, the wrapper, the budget turn, and the four re-ordered scripts — owner: lead, in the same unit.
- [ ] Docs: design 6.2, the 14.1 divergence table and the `planningInterval` comment — owner: lead, in the same commit.
