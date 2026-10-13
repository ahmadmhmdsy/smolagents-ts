# 04 — Tasks (live status)

**Contract**
- **Role:** the current truth about what is being worked on.
- **Mutability:** **rewritten in place.** This is the one document where editing
  history is correct — the table always shows the present.
- **Read when:** session start.
- **Update when:** a task starts, finishes, changes owner, or becomes gated.

**Statuses:** pending | in_progress | blocked | done.
**Blocked always names its gate.** A task waiting on a user decision is blocked,
not in_progress.

---

## Columns

| Column | Meaning |
|---|---|
| id | stable identifier; never reused |
| title | what it delivers, in one line |
| status | the task's workflow state — `docs/00-schema.md` owns the values |
| owner | who is accountable right now |
| scope | the paths this task may modify — required when more than one writer is active |
| gate | what unblocks it, or the immediate next step |
| evidence | the artifact that proves the status — required for done |

**Evidence rule:** a row marked done with an empty Evidence cell is not done.
Cite the command, file, or run that proves it.

**Pre-registration rule:** write the acceptance criterion before starting work
that is expensive or hard to reverse. A criterion invented afterwards is not a
criterion.

## Now

Only `Now` and `Blocked` rows stay inline. Completed rows move verbatim to
`docs/tasks/archive-2026.md`; rotation moves, it never deletes. The column order
is fixed by `_templates/task-row.md`, so a row can be copied from that form.

<!-- rotate:begin -->
| id | title | status | owner | scope | gate | evidence |
|---|---|---|---|---|---|---|
| T-2 | close the two ToolCallingAgent gaps inherited from S1 | in_progress | maintainer | `packages/core/src/agent/`, `packages/core/src/session/`, `packages/core/test/` | S2a plan Tasks 3 and 4; the gaps close when the schemas reach the request and the session records the call | - |
| T-5 | confirm the pruning-walker pack patch | pending | owner | `scripts/_packmodel.py`, `scripts/checks.py`, `docs/09-decisions/0003-pruning-surface-walker.md` | the decision record moves from proposed to accepted | - |
| T-6 | execute the S2a plan: the model seam and the OpenAI-compatible adapter | pending | maintainer | `packages/core/`, `packages/models/`, `tsconfig.base.json`, `docs/` | the plan's Definition of done holds and `pnpm gate` exits 0 | - |
<!-- rotate:end -->

## Blocked

None. A blocked row stays in the live table above with `status: blocked` and a
`gate` that names what unblocks it.
