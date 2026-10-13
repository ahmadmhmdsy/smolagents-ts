# _templates/ — artifact forms

Copy the relevant form **before** starting the artifact. Filling a form after
the fact produces a rationalization, not a record.

## Index

| Form | Produces | Close-out when finished |
|---|---|---|
| plan.md | a plan for a feature or a project phase | tasks created in docs/04-tasks.md; spec updated if scope moved |
| investigation.md | a question answered with evidence | result recorded; lesson added to a shard under `docs/memory/` with the topic's row updated in `docs/05-memory.md`; task status updated |
| handoff-entry.md | one entry in docs/03-handoff.md | affected task rows updated |
| task-row.md | one row in docs/04-tasks.md | evidence cell cites the artifact that proves it |
| lesson.md | one entry in a topic shard under `docs/memory/` | dated, with its condition and source |
| incident.md | a record of something that broke | timeline, root cause, follow-up tasks, and a lesson |
| session-close.md | the shutdown ritual | all four state documents updated |
| component-agents.md | a scoped AGENTS.md for one component | the component has a row in the root component table |
| delegation-brief.md | one dispatched delegated task | the delegator has checked the return against the acceptance criterion |

Two forms live beside the artifacts they produce, not here:

- **Decision records** -> docs/09-decisions/0000-template.md
- **Runbooks** -> docs/10-runbooks/_template.md

That split is deliberate: a form stays where the artifact is created, so the
form and its index cannot drift apart. Do not copy those two here.

## Close-out rules

- **Creation is not completion.** An artifact is finished only when its
  close-out column has been satisfied. (R-15.10)
- **Every number cites its source.** See docs/07-sources-of-truth.md.
- **Every gate is written before the work.** A criterion invented after the
  result is not a criterion.
- **Every artifact ends with a next step.** An artifact that ends with a
  conclusion and no next action gets re-opened next session.
