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
| T-13 | ship the v1.5 modules S6's design row names: CLI, MCP, remote executors, exec-pyodide, docs site, L4/L5 | in_progress | this session | new packages, `examples/**`, `apps/**` | the owner chose the sequence: the CLI first, then the docs site with the example's host, then MCP, exec-pyodide, remote executors and L4/L5; the CLI, the docs site, the MCP client and the Pyodide executor are delivered, and the plans for Tasks 3 to 5, decisions 0015 and 0016, and the Pyodide and remote-executor reconnaissances are filed, so what remains is building the remote executors, then L4/L5 | `docs/plans/2026-10-14-v1.5-modules-plan.md`, `docs/plans/2026-10-14-t13-mcp-client-plan.md`, `docs/plans/2026-10-14-t13-exec-pyodide-plan.md`, `docs/plans/2026-10-14-t13-remote-executors-plan.md`, `docs/research/2026-10-14-pyodide-recon.md`, `docs/research/2026-10-14-remote-executors-recon.md` |
| T-14 | publish 0.1.0 to the registry | pending | owner | `.changeset/**`, `packages/**` | the public repository exists and every manifest names it; the owner supplies registry credentials, then `docs/10-runbooks/publish-0.1.0.md` runs, and its first run records its own date there | the runbook exists and is unexecuted; no credential has been used |
| T-16 | decide our planning cadence: upstream plans before the first step, this loop skips that plan | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the cadence; the investigation separates the missing first plan from the divergent prompt content | `docs/research/2026-10-14-t16-planning-cadence.md` |
| T-18 | decide a budget-exhausted run's ending: upstream reports the last model output as the final answer, this loop raises `AgentMaxStepsError` | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the ending; the investigation prices both, including the call that falls outside the budget | `docs/research/2026-10-14-t18-max-steps-ending.md` |
| T-19 | grow the parity corpus a tool scenario | pending | next session | `scripts/parity/scenarios/*.json`, `scripts/parity/record.py`, `packages/core/test/parity.test.ts` | the owner deferred it; both readers must first learn to wire tools, because each refuses a non-empty tool list | - |
| T-21 | decide which upstream the parity recordings track | pending | owner | `scripts/parity/recordings/*.json`, `scripts/parity/record.py` | the design record pins 1.27.0.dev0 and the recordings pin 1.14.0; they differ on this session's two investigations | - |
| T-24 | give the Pyodide executor a worker-backed interrupt path | pending | next session | `packages/exec-pyodide/**` | decision 0016 defers it: a hard wall-clock timeout needs a worker entry and cross-origin isolation headers, which changes the deployment story | `docs/09-decisions/0016-pyodide-in-process-and-fidelity.md` |
<!-- rotate:end -->

## Blocked

None. A blocked row stays in the live table above with `status: blocked` and a
`gate` that names what unblocks it.
