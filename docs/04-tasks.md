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
| T-14 | publish 0.1.0 to the registry | pending | owner | `.changeset/**`, `packages/**` | the public repository exists and every manifest names it; the owner supplies registry credentials, then `docs/10-runbooks/publish-0.1.0.md` runs, and its first run records its own date there | the runbook exists and is unexecuted; no credential has been used |
| T-16 | decide our planning cadence: upstream plans before the first step, this loop skips that plan | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the cadence; the investigation separates the missing first plan from the divergent prompt content, and the addendum prices three options and recommends matching the cadence only | `docs/research/2026-10-14-t16-planning-cadence.md` |
| T-18 | decide a budget-exhausted run's ending: upstream reports the last model output as the final answer, this loop raises `AgentMaxStepsError` | pending | owner | `packages/core/src/agent/multi-step-agent.ts` | the owner picks the ending; the investigation prices both, including the call that falls outside the budget, and the addendum prices three options and recommends keeping the throw and deleting the state nothing produces | `docs/research/2026-10-14-t18-max-steps-ending.md` |
| T-19 | grow the parity corpus a tool scenario | pending | next session | `scripts/parity/scenarios/*.json`, `scripts/parity/record.py`, `packages/core/test/parity.test.ts` | the owner deferred it; both readers must first learn to wire tools, because each refuses a non-empty tool list | - |
| T-21 | decide which upstream the parity recordings track | pending | owner | `scripts/parity/recordings/*.json`, `scripts/parity/record.py` | the design record pins 1.27.0.dev0 and the recordings pin 1.14.0; they differ on this session's two investigations | - |
| T-24 | give the Pyodide executor a worker-backed interrupt path | pending | next session | `packages/exec-pyodide/**` | decision 0016 defers it: a hard wall-clock timeout needs a worker entry and cross-origin isolation headers, which changes the deployment story | `docs/09-decisions/0016-pyodide-in-process-and-fidelity.md` |
| T-25 | confirm the supply-chain posture decision 0017 records | pending | owner | `pnpm-workspace.yaml`, `pnpm-lock.yaml` | the implementing agent kept the release-age quarantine and the three exact-version exclusions the install required, and declined three native builds; the owner confirms or reverses it, and a reversal is a new record rather than an edit | `docs/09-decisions/0017-release-age-quarantine.md` |
| T-26 | harden the Gemini adapter against a null `usageMetadata` | pending | next session | `packages/models/src/gemini.ts` | the models fix on 2026-10-14 closed this exact shape in the OpenAI adapter, where OpenAI documents sending `"usage": null` on every chunk but the last; Gemini documents no such null, so this waits on evidence that a provider sends one rather than being fixed speculatively | - |
| T-28 | let the session snapshot feed `ChatSurface` | pending | next session | `packages/core/src/session/` | the design's chat surface takes caller-supplied messages while the snapshot returns steps; decide whether the snapshot grows `messages` or the surface derives its rows | - |
| T-29 | settle `agent.on(type, handler)` against the shipped `agent.on(event)` | pending | next session | `packages/core/src/agent/` | a caller following the design gets a `TypeError`; add the overload or correct the design | - |
| T-30 | emit `code.delta` or stop declaring it | pending | next session | `packages/core/src/agent/` | the event is declared and consumed but never emitted, so a streaming handler never fires | - |
<!-- rotate:end -->

## Blocked

None. A blocked row stays in the live table above with `status: blocked` and a
`gate` that names what unblocks it.
