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
| T-24 | give the Pyodide executor its pre-registered worker | blocked | owner | `packages/exec-pyodide/**` | `0033`: no headers; a browser runner, a caller without remote executors, or a recorded hang | `docs/09-decisions/0033-the-pyodide-interrupt-stays-deferred.md` |
| T-52 | decide where user-facing guides live | blocked | owner | `docs/**`, `AGENTS.md`, `_templates/**` | D-08: a guide lands in README or a runbook; a new kind needs a template and a router row | - |
| T-54 | open the `models-gateway` package on a gateway feature demand | blocked | owner | `packages/models-gateway/**`, `AGENTS.md` | D-08 parked it: needs a record (`0019`) and a settled metadata channel (instance state is shared mutable state) | `docs/research/2026-10-21-omniroute-gateway-support.md` |
| T-55 | write and run the retrieval plan | pending | lead | `packages/retrieval/**`, `docs/plans/**` | after 0.1.0; deterministic embedding, message-first retriever with `asTool()`, refuse-list-tested packaging | - |
| T-56 | write and run the multimodal input plan (0.2.0's headline) | in_progress | lead | `packages/core/**`, `packages/models/**`, `packages/react/**`, `packages/react-ui/**`, `examples/vision/**`, `docs/**` | all seven phases built on `release/0.2-multimodal`; merges after `T-14`, on the owner's review; `0034`: input parts, adapter v2 + the v1 shim test, honest capabilities, attachments without executor changes, `MediaRef`s in snapshots | plan: `docs/plans/2026-10-31-multimodal-input-plan.md` |
| T-70 | run the E2B path live | blocked | owner | `docs/10-runbooks/exec-remote-live-backends.md` | an `E2B_API_KEY` on this host | - |
| T-72 | local runtime presets over `OpenAICompatibleModel` | pending | lead | `packages/models/**`, `docs/10-runbooks/live-provider-smoke.md` | `0038` item 2: Ollama, LM Studio, llama.cpp, vLLM; default base URL, no key, honest capabilities, no process started | - |
<!-- rotate:end -->

## Blocked

Five rows wait on the owner: T-14 (credentials), T-24 (worker trigger), T-52
(guide home), T-54 (gateway demand), T-70 (E2B key).
T-16, T-18 and T-28 left the live table on 2026-10-25 when their decisions were
recorded; T-49, T-50, T-51, T-39 and T-48 are done, so the pre-release sequence is complete and only T-14's gate stands between this tree and 0.1.0. A blocked row
stays in the live table above; only `done` rows rotate to
`docs/tasks/archive-2026.md`.
