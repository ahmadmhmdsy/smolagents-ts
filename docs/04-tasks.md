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
| T-14 | publish 0.1.0 to the registry | blocked | owner | `.changeset/**`, `packages/**` | the owner claims the npm scope and supplies a 2FA-bypass token; then `docs/10-runbooks/release-guide.md` from `release/0.1.0` (`0037`) | `0030`; `0037` |
| T-24 | give the Pyodide executor its pre-registered worker | pending | lead | `packages/exec-pyodide/**` | the owner chose on 2026-11-13 to build it ahead of `0033`'s triggers; `0041` supersedes the deferral and keeps the pre-registered shape; done when a Node test shows a busy loop cut at its deadline and `pnpm gate` is green | `docs/09-decisions/0041-the-pyodide-worker-is-built-ahead-of-its-trigger.md` |
| T-54 | open the `models-gateway` package | pending | lead | `packages/models-gateway/**`, `AGENTS.md` | the owner chose on 2026-11-13 to open it; `0040` sets the v1 scope (`GatewayModel`, `onResponse`, `listGatewayModels`) and keeps it outside the fixed group; done when the package packs and `pnpm gate` is green | `docs/09-decisions/0040-a-models-gateway-package-reads-gateway-headers-through-fetch.md` |
| T-70 | run the E2B path live | blocked | owner | `docs/10-runbooks/exec-remote-live-backends.md` | an `E2B_API_KEY` on this host | - |
<!-- rotate:end -->

## Blocked

Two rows wait on the owner: T-14 (credentials) and T-70 (E2B key). The owner
settled T-24, T-52 and T-54 on 2026-11-13; T-52 and T-77 closed the same day.
T-16, T-18 and T-28 left the live table on 2026-10-25 when their decisions were
recorded; T-74, T-75 and T-76 (the `0039` plugin contract) closed on 2026-11-13; T-49, T-50, T-51, T-39 and T-48 are done, so the pre-release sequence is complete and only T-14's gate stands between this tree and 0.1.0. A blocked row
stays in the live table above; only `done` rows rotate to
`docs/tasks/archive-2026.md`.
