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
| T-14 | publish 0.1.0 to the registry | blocked | owner | `.changeset/**`, `packages/**` | the pre-release set lands with the gate green on the release revision; the owner claims the npm scope and supplies a 2FA-bypass token; then the runbook | `0030` |
| T-19 | grow the parity corpus a tool-calling scenario family | pending | next session | `scripts/parity/**`, `packages/core/test/parity.test.ts` | `0032`: `agent` axis, `calls` turns, one shared `echo` stub, success and unknown-tool scenarios; five recordings untouched | - |
| T-24 | give the Pyodide executor its pre-registered worker | blocked | owner | `packages/exec-pyodide/**` | `0033`: no headers; a browser runner, a caller without remote executors, or a recorded hang | `docs/09-decisions/0033-the-pyodide-interrupt-stays-deferred.md` |
| T-26 | harden the Gemini adapter against a null `usageMetadata` | pending | next session | `packages/models/src/gemini.ts` | waits on evidence; the OpenAI fix closed this shape | - |
| T-29 | settle `agent.on(type, handler)` against the shipped `agent.on(event)` | pending | next session | `packages/core/src/agent/` | a caller following the design gets a `TypeError`; add the overload or correct the design | - |
| T-52 | decide where user-facing guides live | blocked | owner | `docs/**`, `AGENTS.md`, `_templates/**` | D-08: a guide lands in README or a runbook; a new kind needs a template and a router row | - |
| T-54 | open the `models-gateway` package on a gateway feature demand | blocked | owner | `packages/models-gateway/**`, `AGENTS.md` | D-08 parked it: needs a record (`0019`) and a settled metadata channel (instance state is shared mutable state) | `docs/research/2026-10-21-omniroute-gateway-support.md` |
| T-55 | write and run the retrieval plan | pending | lead | `packages/retrieval/**`, `docs/plans/**` | after 0.1.0; deterministic embedding, message-first retriever with `asTool()`, refuse-list-tested packaging | - |
| T-56 | write and run the multimodal input plan (0.2.0's headline) | pending | lead | `packages/core/**`, `packages/models/**`, `packages/react-ui/**` | after 0.1.0; `0034`: input parts, adapter v2 + the v1 shim test, honest capabilities, attachments without executor changes, `MediaRef`s in snapshots | - |
| T-57 | run the D-12 residual-risk batch (fork first) | pending | next session | `packages/core/test/`, `docs/**`, `docs/.baseline.json` | fork-at-`intent` test; claim-board fence and child-store docs; the v2 shim test and Anthropic split fixture ride `T-56`; #4's sentence in README until `T-52`; live Docker/E2B when an account exists; D-03's guard; re-baseline | - |
<!-- rotate:end -->

## Blocked

Four rows wait on the owner: T-14 (credentials), T-24 (worker trigger), T-52
(guide home), T-54 (gateway demand).
T-16, T-18 and T-28 left the live table on 2026-10-25 when their decisions were
recorded; T-49, T-50, T-51, T-39 and T-48 are done, so the pre-release sequence is complete and only T-14's gate stands between this tree and 0.1.0. A blocked row
stays in the live table above; only `done` rows rotate to
`docs/tasks/archive-2026.md`.
