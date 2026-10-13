# 03 — Handoff (state)

**Contract**
- **Role:** narrative state — where we are.
- **Mutability:** **append-only, newest first.** Never edit or delete a past
  entry. Correct a past entry by writing a new entry that supersedes it.
- **Read when:** session start, before anything else.
- **Update when:** any milestone, incident, decision, or resume point.

**Why append-only:** the value of this file is that it records what was
believed at the time. Editing history destroys exactly that.

---

## Entry format

Copy _templates/handoff-entry.md. Every entry answers:

- **State** — where the project is right now.
- **Did** — what this session actually changed.
- **Verified** — what was checked, with the command and the result.
- **Unverified / open** — what was not checked and what remains.
- **Next** — the single next step.
- **Blockers** — anything gated, and on what.
- **Artifacts** — paths worth opening, as path:line where possible.

## Rotation

The newest entries stay inline, newest first. Older entries move verbatim to
`docs/handoff/archive-2026.md`; rotation never deletes and never rewrites. A new
entry is prepended inside the markers below.

---

<!-- rotate:begin -->

## 2026-10-14T00:09:45+03:00 — S2 is complete: three adapters ship and the model layer closes

**State.** `@smolagents-ts/models` exports five adapters — `OpenAICompatibleModel`,
`AnthropicModel`, `GeminiModel`, `HuggingFaceModel` and `CustomModel` — so all four
tier-1 providers of S2 exist and `docs/01-project.md` marks S2 done. Every adapter
reaches the network through an injected fetch, and neither the tests nor an import
needs a key.

**Did.** Executed the eight tasks of
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md` in seven commits
(`8424350`..`bda2663`), plus the unused import the gate's lint step found (`99282a2`),
plus this record: the Anthropic Messages adapter with its `system` field,
`tool_use`/`tool_result` blocks and named-event stream; the Gemini
`generateContent` adapter and its `alt=sse` stream; the HuggingFace router as a
subclass of the OpenAI adapter that asks for streamed usage; the barrel with its
pinned surface; and an end-to-end test that drives the Anthropic adapter through a
real `ToolCallingAgent`. T-7 moved to `docs/tasks/archive-2026.md`,
`packages/models/AGENTS.md` now names the adapters and the measured count, and five
lessons went to `docs/memory/general.md`.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2b.txt`: 44 files and 351
tests, lint, depcruise at 105 modules and 243 dependencies with no violations,
build, publint, attw, `ci:check OK`, and `pack-smoke OK: 5 packages installed and
imported from tarballs`. The models project alone is 13 files and 62 tests. The
validator reports `new: 0` with 0 errors and 0 warnings, and `rotate.py --check`
exits 0.

**Unverified / open.** No live provider call was made for any of the three adapters;
every fixture is hand-shaped from published documentation, so each wire format is
faithful to its document rather than to an endpoint exercised today. Gemini's
JSON-array stream form is deliberately unread and its adapter pins `alt=sse`. The
`supports`/`capabilities` drift in the design record is still an owner decision, and
nothing in this milestone touched `packages/core`.

**Next.** S3 (the tool system), or the release work S2 leaves open — package subpaths
and the changeset merge — whichever the owner picks.

**Blockers.** T-5 waits on the owner:
`docs/09-decisions/0003-pruning-surface-walker.md` is proposed, not accepted.

**Artifacts.** `packages/models/src/anthropic.ts`, `packages/models/src/gemini.ts`,
`packages/models/src/huggingface.ts`, `.changeset/s2b-model-adapters.md`,
`docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`.


## 2026-10-13T20:54:22+03:00 — the S2b plan is written; execution is the next step

**State.** `main` is at `964c702` plus this entry. S2a is merged and its branch is gone;
S2b is planned but not executed, so `docs/04-tasks.md` still shows T-7 in progress.

**Did.** Wrote `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`: eight
tasks for the Anthropic, Gemini and HuggingFace adapters, each with its files, steps, a
red/green command and a commit. Also corrected the S2a fixture comment that called a
hand-shaped completion a recording.

**Verified.** The validator reports `new: 0` with no errors and no warnings;
`rotate.py --check` exits 0; the plan carries the `Contract` heading a new `docs/` file
needs.

**Unverified / open.** No adapter from this plan exists yet, and the Anthropic and Gemini
wire facts come from published documentation rather than from a call this project made.

**Next.** Execute the plan task by task, starting with the Anthropic adapter.

**Blockers.** T-5 still waits on the owner.

**Artifacts.** `docs/plans/2026-10-13-s2b-anthropic-gemini-huggingface-plan.md`,
`.superpowers/validate-s2b-plan.json`.

## 2026-10-13T20:40:53+03:00 — main is the S2a state; the branch is gone

**State.** The work sits on `main` at `79a4f9c` and `context-pack-adoption` is deleted, so the
next session starts from the default branch with nothing left to integrate.

**Did.** Fast-forwarded `main` from `e4e4b5a` to `79a4f9c` — twelve commits: the pack
adoption, the S2a plan, and the S2a implementation — then removed the merged branch.

**Verified.** `pnpm test` on `main`: 38 files and 319 tests, exit code 0, on the tree the gate
already passed. Working tree clean. T-7 moved to in_progress.

**Unverified / open.** Unchanged from the entry below: no live provider call, the
`supports`/`capabilities` drift still open, T-5 still with the owner, S2b unplanned.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner; `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `docs/04-tasks.md`, `git log --oneline -1`.

## 2026-10-13T20:09:21+03:00 — S2a landed: the seam is closed and one real adapter ships

**State.** `@smolagents-ts/models` holds a working provider adapter, and the core loop
passes tool schemas while keeping streamed tool calls and usage. A caller can run a
`ToolCallingAgent` against OpenAI or any endpoint that copies its wire format, in Node or in
a browser tab, because the adapter reaches the network through an injected fetch and imports
no Node builtin. Anthropic, Gemini and HuggingFace are unbuilt, so the model layer is partial
by design rather than by omission.

**Did.** Executed the nine tasks of
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md` in eight code commits
(`511f5e4`..`85f194e`) plus this record. Four core defects closed: the advertised schemas now reach the
request, `toMessages()` renders an assistant tool call with its results, the streaming branch
keeps what it accumulated, and `AgentSession` no longer drops a call reported as failed
first. New files: `packages/models/src/transport.ts`, `sse.ts`, `openai-compatible.ts` and
`custom.ts`; `tsconfig.base.json` gained a path mapping to the core source. T-2 and T-6
moved to the archive and T-7 (S2b) opened.

**Verified.** `pnpm gate` exit 0 — `.superpowers/gate-s2a.txt`: 38 files and 319 tests, lint,
depcruise at 94 modules with the new `core-no-models` rule proven by a probe that was then
deleted, build, publint, attw, and `pack-smoke OK: 5 packages installed and imported from
tarballs`. The plan's pre-registered `workspace:*` risk did not materialize: one
`npm install` resolved the sibling tarball. The context validator, run with the baseline
after these records were written, reports no new findings.

**Unverified / open.** No live provider call was made; every fixture is recorded, so the wire
format is faithful to the documented shape rather than to an endpoint exercised today. The
streaming path and `CustomModel` are covered by tests and by no shipped agent, because both
shipped agents return `prefersStreaming = false`. The design record still sketches the
capability field as `supports` where the shipped interface says `capabilities`; that drift
is an owner decision and this plan deliberately left it alone. S2b has no plan yet.

**Next.** Write the S2b plan for the Anthropic, Gemini and HuggingFace adapters (T-7).

**Blockers.** T-5 waits on the owner: `docs/09-decisions/0003-pruning-surface-walker.md` is
proposed, not accepted.

**Artifacts.** `packages/models/src/openai-compatible.ts`,
`packages/models/test/agent-e2e.test.ts`,
`docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`.

<!-- rotate:end -->

Rotated entries: `docs/handoff/archive-2026.md`. Rotation moves; it never deletes.
