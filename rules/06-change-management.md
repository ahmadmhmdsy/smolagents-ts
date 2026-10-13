# rules/06 — Change management

**Purpose:** every change is minimal, reviewable, reversible, and attributable.

## Contract

- **Mutability:** approval-only.
- **Applies to:** any modification to tracked files.

## Rules

**R-06.1 — Smallest change wins.** MUST make the smallest change that completely
solves the stated task. *Why:* every extra changed line is extra review surface
and extra risk with no requested benefit.

**R-06.2 — No unrelated changes.** MUST NOT refactor, reformat, rename, or
reorganize outside the task's scope. SHOULD record out-of-scope findings in the
task list instead of fixing them silently. *Why:* bundled changes hide defects
and make review unreliable.

**R-06.3 — Match the surrounding style.** Before editing, MUST read the
surrounding code and match naming, formatting, import order, and idioms. If the
project has a formatter, MUST run it on the edited file. *Why:* a diff that is
mostly formatting destroys the reviewer's ability to see the real change.

**R-06.4 — Preserve compatibility unless changed deliberately.** MUST NOT
silently change a public interface, schema, configuration semantic, or serialized
format. *Why:* downstream consumers break invisibly.

**R-06.5 — Checkpoint before substantial work.** SHOULD create a commit,
branch, or backup before a large or risky change. *Why:* it is what makes the
change abandonable.

**R-06.6 — Know the undo before the do.** MUST be able to state how the change
would be reverted before making it. *Why:* if you cannot describe the rollback,
you do not yet understand the change.

**R-06.7 — Review the full diff before finishing.** MUST inspect every changed
line, remove unrelated modifications, and check for secrets and generated
files. *Why:* the diff is the only complete description of what actually
happened.

**R-06.8 — Commit only as expected.** MUST commit when the project workflow or
the user expects it; otherwise MUST leave the working tree in a described
state. *Why:* unprompted commits impose someone else's decision on history.

**R-06.9 — Atomic, descriptive commits.** SHOULD keep one logical change per
commit, with a message that states what changed and why, referencing the task
identifier. *Why:* history is the only record that survives the session.

**R-06.10 — Never rewrite shared history.** MUST NOT reset another writer's
work, force-push, rewrite history, or delete branches without explicit
authorization. When a rewrite is sanctioned, MUST use a lease-checked force
push, never a bare force. *Why:* these operations destroy other people's work
irrecoverably.

**R-06.11 — Preserve uncommitted work.** MUST identify and leave untouched any
modification that is not part of the current task. *Why:* it may be the only
copy.

**R-06.12 — Verify after the change, once.** MUST verify after completing a
batch of edits, not in the middle of it. *Why:* intermediate states fail for
reasons that no longer exist.

## Adapting

Record the project's branch strategy, commit-message convention, required
review process, and any pre-commit hooks in `docs/08-coordination.md`.
