# rules/17 — Learning loop

Deletable: removing this module and the Lesson row in docs/00-schema.md loses no safety.

**Purpose:** turn a repeated observation into a binding rule through an explicit
gate, and keep everything that has not passed the gate advisory.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every lesson, and every promotion into `rules/` or a scoped
  `AGENTS.md`.

## Rules

**R-17.1 — Promotion state machine.** MUST move a lesson only along this
machine, using the exact lesson status values from `docs/00-schema.md`:

    observed → candidate → validated → promoted
                        └──────────────→ rejected

*Why:* a lesson without a state is a lesson no one can act on or retire.

**R-17.2 — What each state means.** **observed** — written into a memory shard
immediately; advisory only, binds nobody. **candidate** — looks general and
repeatable, with at least one evidence pointer. **validated** — the evidence bar
in R-17.3 is met. **promoted** — the bounded diff of R-17.4, explicitly adopted,
with the rule citing the lesson path. **rejected** — recorded so it is not
re-litigated. *Why:* the gate is only as strong as its state definitions.

**R-17.3 — The evidence bar is two independent contexts.** MUST mark a lesson
`validated` only when evidence repeated across two independent sessions or
contexts, or one incident was severe enough to stand alone. *Why:* a single
context cannot tell a pattern from a coincidence.

**R-17.4 — Promotion is a bounded diff that cites the lesson.** Promotion MUST
be a bounded diff into `rules/` or a scoped `AGENTS.md`, MUST be explicitly
adopted, MUST set the rule status to `active`, and MUST cite the lesson path
from the promoted rule. *Why:* an untraceable rule cannot be retired later.

**R-17.5 — Demotion uses retired.** A promoted rule that proves wrong MUST move
to rule status `retired`, and the originating lesson MUST be annotated. *Why:*
`retired` ends the rule while keeping every old citation resolvable.

**R-17.6 — Facts enter freely; only rules need the gate.** A scoped `AGENTS.md`
MAY accept facts and pointers at any time; only rules go through the gate. An
unpromoted lesson is advisory, never binding. *Why:* the gate exists to bind
behavior, and an unpromoted lesson binds nothing.
