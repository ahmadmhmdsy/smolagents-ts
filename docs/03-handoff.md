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
## 2026-10-25T21:40:00+03:00 — D-11 reopened: multimodal input is in, input-only, ahead of retrieval

**State.** Eleven of twelve decided; no code changed. The owner asked for models that see and hear, so `0018`'s park is lifted for input only; `0034` fixes the scope and `T-56` is the phase row.

**Did.** The owner approved the proposed shape: two input modalities, no output modalities, bytes never URLs, references never base64, both tool slices in one phase. [`0034`](09-decisions/0034-multimodal-input-is-in-and-scheduled.md) records it: an input message may carry text, image or audio parts while every model output stays a string; the adapter contract moves to version 2 with the existing shim keeping version-1 adapters working; capabilities gain an honest audio flag; a tool may attach media by reference so the executors keep exchanging strings; snapshots carry references behind a `MediaStore` seam shaped like `RunStore`. The phase runs after 0.1.0 as 0.2.0's headline, before retrieval; D-10's "first" claim and the order section are corrected, and `01-project.md` points at the new record.

**Verified.** Nothing was built; the rotation and validator pass, and the pre-release set is untouched.

**Unverified / open.** Token accounting for image turns is provider-reported with no local estimate; audio is absent on Anthropic; prompt injection inside an image is invisible to the guardrails; this is the largest surface since Phase 6 — core types, three adapters, the projection, `react-ui` and tool results.

**Next.** D-12: the residual-risk chores, to close the register.

**Blockers.** `T-14` on credentials; `T-24`, `T-52`, `T-54` on the owner.

**Artifacts.** [`0034`](09-decisions/0034-multimodal-input-is-in-and-scheduled.md), [the plan](plans/2026-10-25-open-decisions-plan.md), [`04-tasks.md`](04-tasks.md).

## 2026-10-25T21:10:00+03:00 — D-10 decided: retrieval is the first post-release capability

**State.** Ten of twelve decided; no code changed. D-10 schedules retrieval as its own phase after the release, with its plan written then.

**Did.** The owner chose A. `0026` already fixed the shape — a caller-supplied embedding, a store interface with one in-memory reference, and a retriever that inserts an ordinary transcript turn — so the row was scheduling, not design. The plan is written after 0.1.0 against a named consumer (a docs Q&A example), with three conditions pre-registered in `T-55`: a deterministic embedding so the gate needs no network, the retriever as a message appended before `run()` plus an `asTool()` adapter over the same implementation, and packaging tested against the refuse list (expected to be a new `packages/retrieval` and a facade entry, not pre-committed here).

**Verified.** Nothing was built; the rotation and the context validator pass, and the tree was green on `d55f008` before this commit.

**Unverified / open.** The chunking boundary, the embedding-adapter packaging, the store's dimension fingerprint, trace visibility for a message-only retriever, persistence and the no-cache cost are the plan's to settle; its tests will prove the seam, not retrieval quality, because this repository has no corpus.

**Next.** D-11: multimodal stays parked.

**Blockers.** `T-14` on credentials; `T-24`, `T-52` and `T-54` on the owner.

**Artifacts.** [the plan](plans/2026-10-25-open-decisions-plan.md), [`04-tasks.md`](04-tasks.md), [`0026`](09-decisions/0026-retrieval-is-in.md).

## 2026-10-25T20:52:00+03:00 — D-09 decided: keep the Python executor in-process, and correct the record

**State.** Nine of twelve decided; no code changed. No worker ships in 0.1.0; the parked row is pre-registered and the README now names the limit.

**Did.** The owner weighed my recommendation of a terminate-based worker against the portfolio and the gate, and chose to keep in-process and document it. The audit had found decision 0016's cost premise wrong: COOP/COEP belong to the shared-interrupt-buffer variant only, and the injectable-loader escape hatch is Node-only because `PyodideRuntime` has synchronous members. Decision [`0033`](09-decisions/0033-the-pyodide-interrupt-stays-deferred.md) corrects both, pre-registers the terminate shape (separate class, `cpuTimeLimitMs` reported, state lost on interrupt, `dispose()` reclaims 13.40 MiB, browser half a runbook claim) and sets the trigger to evidence the repository can see: a browser test runner, a user who cannot use the remote executors, or a recorded hang. [The package README](../packages/exec-pyodide/README.md) gained the limitation paragraph in the same commit; `T-24` is now the parked worker row.

**Verified.** The measurements were re-read, not re-taken: a 200 ms timer never fired during a 3.9 s guest run, a worker woken through a shared buffer took 519 ms, cold start is 1.94–2.35 s on Node and 2,912 ms in the measured browser, and the runtime is 13.40 MiB.

**Unverified / open.** No browser test runner exists, so any future worker claim is a runbook claim; the capability bag keeps reporting no CPU budget, which is correct today.

**Next.** D-10: when retrieval gets built (`0026`).

**Blockers.** `T-14` on credentials; `T-24`, `T-52` and `T-54` on the owner.

**Artifacts.** [`0033`](09-decisions/0033-the-pyodide-interrupt-stays-deferred.md), [the README](../packages/exec-pyodide/README.md), [the plan](plans/2026-10-25-open-decisions-plan.md).

## 2026-10-25T20:31:00+03:00 — D-08 decided: document the gateway, do not open the package

**State.** Eight of twelve decided; no code changed. The pre-release set stays D-01, D-02 and D-06; D-08 phase 0 is additive and gates nothing, and phase 1 is parked.

**Did.** The owner chose A. The gateway already works at the wire level — 5/5 wire checks and 4/4 stream irregularities absorbed with no source change — so the work is discoverability: a README subsection plus a runbook (recipe, exact CLI form, CORS, localhost-only, pinned model id, `GET /v1/models`, `AbortSignal` timeout, retry is the caller's), a `examples/gateway/` that prints SKIPPED without `OMNIROUTE_BASE_URL`, and a hand-shaped four-frame SSE fixture named by wire shape so LiteLLM and Portkey reuse it. Phase 1 needs its own record: `0019` leaves routing unscheduled, and last-response metadata is unsafe as instance state under concurrent sessions.

**Verified.** The research is offline evidence against a stand-in built from OmniRoute `3.8.53`'s own frames; no live gateway was contacted, so the docs say wire-compatible by construction, never "tested with OmniRoute".

**Unverified / open.** The example and fixture do not exist yet; `--api-base` is silently ignored without `--model-type OpenAIModel` (`T-53`); the site has no user-guide tree (`T-52`, owner).

**Next.** D-09: the Pyodide interrupt (`T-24`).

**Blockers.** None for the decision; `T-14` waits on credentials, `T-52` and `T-54` on the owner.

**Artifacts.** [`04-tasks.md`](04-tasks.md), [the plan](plans/2026-10-25-open-decisions-plan.md), [the research](../docs/research/2026-10-21-omniroute-gateway-support.md).
<!-- rotate:end -->
