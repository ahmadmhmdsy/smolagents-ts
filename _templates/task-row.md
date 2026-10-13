| id | title | status | owner | scope | gate | evidence |
|---|---|---|---|---|---|---|
| T-NNN | <one-line deliverable> | pending | <owner> | <paths> | <what unblocks it> | <artifact> |

<!--
Fill rules:
- `status` is one of: pending | in_progress | blocked | done. The vocabulary is
  docs/00-schema.md.
- `blocked` MUST name its `gate`. A task waiting on a user decision is blocked,
  not in_progress.
- `scope` is required whenever more than one writer is active. It is the file or
  directory prefix this task may modify.
- `evidence` is required for done. It is the command, file, or run that proves
  the status, cited as a path. A done row with an empty `evidence` cell is not
  done (R-08.15).
- `id` format: T-NNN, stable, never reused.
- Pre-register the acceptance criterion in the `title` or `gate` cell before
  starting work that is expensive or hard to reverse.
-->
