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
| T-19 | grow the parity corpus a tool-calling scenario family | pending | next session | `scripts/parity/**`, `packages/core/test/parity.test.ts` | decision `0032` is accepted: an `agent` axis (default `code`), `calls` turns, one shared `echo` stub on both legs, a success scenario and an unknown-tool failure scenario; the five existing recordings stay untouched | - |
| T-24 | give the Pyodide executor a worker-backed interrupt path | pending | next session | `packages/exec-pyodide/**` | decision 0016 defers it: a hard wall-clock timeout needs a worker entry and cross-origin isolation headers, which changes the deployment story | `docs/09-decisions/0016-pyodide-in-process-and-fidelity.md` |
| T-26 | harden the Gemini adapter against a null `usageMetadata` | pending | next session | `packages/models/src/gemini.ts` | the models fix closed this shape in the OpenAI adapter; Gemini documents no null, so this waits on evidence rather than a speculative fix | - |
| T-29 | settle `agent.on(type, handler)` against the shipped `agent.on(event)` | pending | next session | `packages/core/src/agent/` | a caller following the design gets a `TypeError`; add the overload or correct the design | - |
| T-48 | re-adjudicate the parity expectations after the endings and planning changes land | pending | next session | `packages/core/test/parity.test.ts`, `scripts/parity/scenarios/*.json` | after `T-49` and `T-50` land; the max-steps ending is what the corpus pins today, and `D-02` unblocks a planning scenario that S1.5 declined; a moved `differsOn` set is a finding, not churn | - |
| T-49 | implement `D-01`'s ending contract | pending | lead | `packages/core/src/agent/`, `packages/core/src/session/`, `packages/core/test/` | decision `0027` is accepted; start with the loop's terminal paths and the two error classes, then `T-48` | - |
| T-50 | implement `D-02`'s planning lane | pending | lead | `packages/core/src/agent/`, `packages/core/src/memory/`, `packages/core/test/` | decision `0028` is accepted; the three templates are re-authored, and the summary-mode branch belongs in `memory.toMessages` | - |
| T-51 | wire the conversation projection into the snapshot and `ChatSurface` | pending | lead | `packages/core/src/session/`, `packages/core/test/`, `packages/react/`, `packages/react-ui/`, `examples/vite-app/` | decision `0031` is accepted; recompute at step boundaries only, never on a delta | - |
| T-39 | implement the OmniRoute phase 0 (README, runbook, example, fixture) | pending | lead | `docs/**`, `examples/**`, `packages/models/**` | D-08 option A; the fixture is hand-shaped from the research shard, never a recording; the example prints SKIPPED without `OMNIROUTE_BASE_URL` | - |
| T-52 | decide where user-facing guides live | blocked | owner | `docs/**`, `AGENTS.md`, `_templates/**` | raised by D-08: the site publishes the internal pack, so a guide lands in README or a runbook; a new kind needs a template and a router row | - |
| T-53 | warn when `--api-base` is passed without `--model-type OpenAIModel` | pending | next session | `packages/cli/**` | raised by D-08: the flag is silently ignored on the default model type | - |
| T-54 | open the `models-gateway` package on a gateway feature demand | blocked | owner | `packages/models-gateway/**`, `AGENTS.md` | D-08 parked it: needs a record (`0019` leaves routing unscheduled) and a settled metadata channel (instance state is shared mutable state) | `docs/research/2026-10-21-omniroute-gateway-support.md` |
<!-- rotate:end -->

## Blocked

Three live rows wait on the owner: T-14 on registry credentials and the scope
claim, T-52 on where user guides live, and T-54 on a gateway feature demand.
T-16, T-18 and T-28 left the live table on 2026-10-25 when their decisions were
recorded; T-49, T-50, T-51 and T-39 are the implementation rows. A blocked row
stays in the live table above; only `done` rows rotate to
`docs/tasks/archive-2026.md`.
