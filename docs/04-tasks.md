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
| T-14 | publish 0.1.0 to the registry | blocked | owner | `.changeset/**`, `packages/**` | the pre-release set (`D-01`, `D-02`, and `D-06` if decided pre-release) is implemented and the gate is green on the release revision; the owner claims the npm scope and supplies a publish token with 2FA bypass; then the publish runbook runs | the gate and runbook amendments are recorded in decision `0030` (2026-10-25); no credential has been used and both names are still unclaimed |
| T-16 | decide our planning cadence: upstream plans before the first step, this loop skips that plan | blocked | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the cadence; the addendum prices three options and recommends matching only | `docs/research/2026-10-14-t16-planning-cadence.md` |
| T-18 | decide a budget-exhausted run's ending: upstream reports the last model output as the final answer, this loop raises `AgentMaxStepsError` | blocked | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the ending; the addendum prices three options | `docs/research/2026-10-14-t18-max-steps-ending.md` |
| T-19 | grow the parity corpus a tool scenario | pending | next session | `scripts/parity/scenarios/*.json`, `scripts/parity/record.py`, `packages/core/test/parity.test.ts` | the owner deferred it; both readers must first learn to wire tools | - |
| T-24 | give the Pyodide executor a worker-backed interrupt path | pending | next session | `packages/exec-pyodide/**` | decision 0016 defers it: a hard wall-clock timeout needs a worker entry and cross-origin isolation headers, which changes the deployment story | `docs/09-decisions/0016-pyodide-in-process-and-fidelity.md` |
| T-26 | harden the Gemini adapter against a null `usageMetadata` | pending | next session | `packages/models/src/gemini.ts` | the models fix closed this shape in the OpenAI adapter; Gemini documents no null, so this waits on evidence rather than a speculative fix | - |
| T-28 | let the session snapshot feed `ChatSurface` | pending | next session | `packages/core/src/session/` | the design's chat surface takes caller-supplied messages while the snapshot returns steps; decide whether the snapshot grows `messages` or the surface derives its rows | - |
| T-29 | settle `agent.on(type, handler)` against the shipped `agent.on(event)` | pending | next session | `packages/core/src/agent/` | a caller following the design gets a `TypeError`; add the overload or correct the design | - |
| T-48 | re-adjudicate the parity expectations after the endings and planning changes land | pending | next session | `packages/core/test/parity.test.ts`, `scripts/parity/scenarios/*.json` | the two pinned divergences describe the max-steps ending and the planning position, both of which `D-01` and `D-02` change by design; a moved `differsOn` set is a finding, not churn | - |
| T-39 | decide how OmniRoute gateway support ships: docs plus one fixture, or the pre-registered `models-gateway` package | blocked | owner | `docs/**`, `examples/**` and `packages/models/**` for phase 0; `packages/models-gateway/**` for phase 1 | the owner picks a phase; phase 1 needs a new record because 0019 leaves routing unscheduled | `docs/research/2026-10-21-omniroute-gateway-support.md` |
<!-- rotate:end -->

## Blocked

Four live rows are blocked on the owner, and each `gate` cell names what unblocks
it: T-14 waits on registry credentials, T-16 on the planning-cadence choice, T-18
on the max-steps ending, and T-39 on the owner picking a phase for OmniRoute
gateway support. A blocked row stays in the live
table above; only `done` rows rotate to `docs/tasks/archive-2026.md`.
