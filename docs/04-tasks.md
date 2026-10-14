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
| T-5 | confirm the pruning-walker pack patch | pending | owner | `scripts/_packmodel.py`, `scripts/checks.py`, `docs/09-decisions/0003-pruning-surface-walker.md` | the decision record moves from proposed to accepted | - |
| T-12 | ship the runnable React example the S5 definition names | pending | owner | `examples/**` | T-13 picks the example's host and build | - |
| T-10 | settle the handoff's cap debt | pending | owner | `docs/03-handoff.md`, `docs/handoff/archive-2026.md`, `scripts/_packmodel.py` | the S2 entry (2598 bytes) now sits in the archive, because rotation refuses to move an entry over the per-entry cap; the owner chooses between shortening it there, raising the cap in `scripts/_packmodel.py`, and leaving it as it stands | - |
| T-13 | ship the v1.5 modules S6's design row names: CLI, MCP, remote executors, exec-pyodide, docs site, L4/L5 | pending | owner | new packages, `examples/**`, `apps/**` | the owner picks the next module and where it runs | - |
| T-14 | publish 0.1.0 to the registry | pending | owner | `.changeset/**`, `packages/**` | registry credentials and a repository URL, neither of which this session has | - |
| T-16 | decide our planning cadence: upstream plans before the first step, this loop plans after it | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the cadence; F7 in the S1.5 plan | - |
| T-18 | decide a budget-exhausted run's ending: upstream reports the last model output as the final answer, this loop raises `AgentMaxStepsError` | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the ending; F6 in the S1.5 plan | - |
<!-- rotate:end -->

## Blocked

None. A blocked row stays in the live table above with `status: blocked` and a
`gate` that names what unblocks it.
