# Phase 6 — model and output depth: execution plan

**Date:** 2026-10-25 · **Status:** complete · **Owner:** lead · **Parent:**
[apply the competitor findings](2026-10-22-apply-the-competitor-findings-plan.md), rows 6.1, 6.3
and 6.4 (6.2 deferred).

**Contract**
- **Role:** the working plan for Phase 6 — the scope decision, item order, the design each
  item lands, and the acceptance tests registered before any code is written.
- **Mutability:** history plus a live checklist. Append to `## Changes` when an item lands or a
  criterion proves wrong; never rewrite a landed entry.
- **Read when:** executing or reviewing Phase 6.
- **Update when:** an item ships, a pre-registered test turns out to be wrong, or the phase ends.

## Scope decision

The owner opened Phase 6 on 2026-10-25 and answered the two questions the parent plan left to
them. This section records the answers; it is the authority for what this phase executes.

- **6.1 is in**, and the phase opening is the act that puts the adapter-interface change on the
  roadmap. The precondition was "the second breaking change is on the roadmap"; rather than
  invent a break to satisfy it, this phase numbers the contract the adapters already implement and
  ships the shim that keeps a pre-numbering adapter working. Nothing is broken to justify the
  version.
- **6.2 is deferred.** Decision [0018](../09-decisions/0018-post-0.1.0-scope-boundary.md) keeps
  multimodal a non-goal until a caller asks and a seam hosts it, and no caller has asked. The
  capability flag `ModelCapabilities.images` exists and no adapter consumes it; that stays true
  and the row is recorded as deferred, not silently dropped.
- **6.4 is answered by** [0026](../09-decisions/0026-retrieval-is-in.md): retrieval is **in**, as an
  opt-in seam for a later phase. The item's done-when was the written decision, so 6.4 closes with
  the record and no code.

## Why this phase

`packages/model.ts` has been the same shape since Phase 0: an adapter implements `Model`, and the
loop calls it. Nothing numbers that contract, so the next breaking change would have to renumber it
in the same release that needs it. And `GenerateOptions` carries temperature, a token limit and stop
sequences — no home for a cache marker, so every provider quirk either waits for a core release or
becomes a core field the core should not know. Two small seams fix both: a version marker with one
shim, and an opaque options object the adapter types.

## Invariants

1. **The core never learns a provider field.** `GenerateOptions.providerOptions` is opaque to the
   core; only an adapter reads it, through its own typed interface.
2. **Versioning is additive.** An adapter written before the numbering keeps working through
   `upgradeModelAdapter`; the loop accepts an unnumbered `Model` exactly as it did.
3. **The shim is the only place a version is supplied on another model's behalf**, and it copies
   the model's identity and forwards its two calls unchanged.
4. **A cache marker is request data.** It changes a wire body, never the transcript and never an
   event.
5. **The conformance file is the contract.** Every shipped adapter runs the same assertions, and the
   exit test imports the same list, so a sixth adapter cannot land uncovered.
6. **No new package, no new dependency, no default network call.** Adapter tests keep driving an
   injected fetch against a recorded fixture.
7. **Retrieval is decided, not built** ([0026](../09-decisions/0026-retrieval-is-in.md)).

## Item 6.1 — a numbered adapter contract and its shim

### Design

`packages/core/src/model.ts`:

- `MODEL_ADAPTER_VERSION` is `1` (a const, so a literal type follows).
- `interface ModelAdapterV1 extends Model` adds `readonly adapterVersion: typeof MODEL_ADAPTER_VERSION`.
  It is the frozen contract at version 1: the shape every shipped adapter implements, now named.
- `upgradeModelAdapter(model: Model): ModelAdapterV1` returns the model unchanged when it already
  declares the current version, and otherwise returns a wrapper that carries the same `id`,
  `provider` and `capabilities`, adds `adapterVersion`, and forwards `generate` and
  `generateStream`. An internal guard keeps the wrapper idempotent.
- The JSDoc states the upgrade rule: when the loop needs a breaking adapter change, the version
  becomes 2, the shim keeps accepting version 1 and translates its options, and the old interface
  stays exported for one minor.

`packages/models/src`: every adapter implements `ModelAdapterV1` and declares
`readonly adapterVersion = MODEL_ADAPTER_VERSION` — `OpenAICompatibleModel`,
`AnthropicModel`, `GeminiModel` and `CustomModel`; `HuggingFaceModel` inherits the field
from its parent. `packages/models/src/index.ts` gains no runtime name.

### Pre-registered tests

`packages/core/test/model-adapter.test.ts` (new, 60th core file):

1. **upgrades a model written before the numbering** — a bare `Model` (a `MockModel`, which has no
   marker) wrapped by `upgradeModelAdapter` reports `adapterVersion` 1, keeps `id`,
   `provider` and `capabilities`, and its `generate` forwards the transcript and options and
   returns the model's completion.
2. **returns a versioned adapter unchanged** — an object already declaring `adapterVersion: 1` is
   returned by identity.
3. **a shimmed adapter drives a run** — an agent built on the wrapped `MockModel` completes a
   scripted turn, so the loop keeps accepting pre-numbering adapters.

`packages/models/test/adapter-conformance.test.ts` (new, 14th models file): one parameterised case
per shipped adapter — `OpenAICompatibleModel`, `AnthropicModel`, `GeminiModel`,
`HuggingFaceModel` and `CustomModel` — each driving an injected fetch (or, for the custom
model, its function) and asserting: it declares `adapterVersion === MODEL_ADAPTER_VERSION`; it
reports a non-empty `id` and `provider` and a boolean capability bag; `generate` returns text,
calls and usage with a finish reason; `generateStream` yields chunks that end with usage when the
fixture reports one. One extra case runs the same assertions over a bare `Model` through
`upgradeModelAdapter` — the conformance proof for the shim.

Pins: `MODEL_ADAPTER_VERSION` and `upgradeModelAdapter` join the core barrel, so core pins
119 → 121 and the pin loop adds two tests.

## Item 6.3 — a typed home for cache markers and provider options

### Design

`packages/core/src/model.ts`: `GenerateOptions` grows an optional
`providerOptions?: Readonly<Record<string, unknown>>`, documented as opaque: the core carries the
object to the adapter and never reads a field. `packages/core/src/agent/multi-step-agent.ts`:
`AgentOptions.modelOptions?: GenerateOptions` is merged into every model turn, with the loop's
own `signal` and `tools` winning over a caller's copy, so a caller can pin a temperature or a
cache hint for the whole run. `AgentOptions.priceTable`'s doc gains a sentence that prices and
request options are separate.

`packages/models/src/anthropic.ts` exports `AnthropicProviderOptions`: `cache?: { system?:
boolean; tools?: boolean; transcript?: boolean; ttl?: "5m" | "1h" }` and
`extraBody?: Readonly<Record<string, unknown>>`. The payload adds `cache_control: { type:
"ephemeral", ttl? }` to the last system block, the last tool, and the last user content block
respectively — at most three breakpoints, under Anthropic's four. `extraBody` is spread first, so
the adapter's own fields win a collision.

`packages/models/src/openai-compatible.ts` exports `OpenAICompatibleProviderOptions`:
`promptCacheKey` → `prompt_cache_key`, `promptCacheRetention: "in_memory" | "24h"` →
`prompt_cache_retention`, and `extraBody` merged the same way. `HuggingFaceModel` inherits
the mapping. `packages/models/src/gemini.ts` exports `GeminiProviderOptions`:
`cachedContent` → `cachedContent` and `extraBody`. `CustomModel` forwards
`options.providerOptions` untouched, which is the seam's proof: it needs no mapping.

Each adapter's `generate`/`generateStream` widens its parameter to `GenerateOptions & {
providerOptions?: <Provider>ProviderOptions }`; method bivariance keeps it assignable to `Model`,
so the core type does not change shape.

### Pre-registered tests

`packages/core/test/model-options.test.ts` (new, 61st core file):

1. **model options reach every turn** — an agent given `modelOptions` with a temperature and an
   opaque provider object hands both to the model on each of two turns, next to the run's signal.
2. **the loop's own options win** — a caller-supplied `tools` list and `signal` do not replace
   the advertised specs or the run's signal.

`packages/models/test/provider-options.test.ts` (new, 15th models file):

1. **Anthropic cache markers** — `cache: { system: true, tools: true, transcript: true, ttl: "1h" }`
   puts a `cache_control` block on the system array, the last tool and the last user content
   block, each carrying the TTL.
2. **Anthropic extra body** — an extra `metadata` field reaches the body, and an extra `model`
   loses to the adapter's id.
3. **OpenAI cache hints** — `promptCacheKey` and `promptCacheRetention` become
   `prompt_cache_key` and `prompt_cache_retention`, and `extraBody` merges without
   overriding the model id.
4. **Gemini cached content** — `cachedContent` becomes `cachedContent` on the body;
   `extraBody` merges.
5. **custom passthrough** — a `CustomModel` receives the provider object by identity.
6. **no options, no marker** — an Anthropic request with no `providerOptions` carries no
   `cache_control`, so the default payload is unchanged.

Pins: none. `providerOptions` is a field and the provider interfaces are type-only.

## Item 6.4 — retrieval, decided

[0026](../09-decisions/0026-retrieval-is-in.md) carries the decision: retrieval is in, opt-in,
without a core hook. The item's acceptance is the record plus the parent plan's open question being
answered; no test and no code belong to it.

## Deferred: 6.2

Image parts and a per-adapter capability flag wait for a caller under `0018`. The plan records the
deferral in the parent plan so a later session does not re-open the argument from scratch; the
capability's existing `images` flag stays false and unconsumed.

## Files likely affected

- 6.1: `packages/core/src/model.ts`, `packages/core/src/index.ts`,
  `packages/core/test/model-adapter.test.ts` (new), `packages/core/test/public-surface.test.ts`,
  `packages/models/src/{openai-compatible,anthropic,gemini,custom}.ts`,
  `packages/models/test/adapter-conformance.test.ts` (new), `packages/core/AGENTS.md`,
  `packages/models/AGENTS.md`.
- 6.3: `packages/core/src/model.ts`, `packages/core/src/agent/multi-step-agent.ts`,
  `packages/core/test/model-options.test.ts` (new), `packages/models/src/{anthropic,openai-compatible,gemini}.ts`,
  `packages/models/test/provider-options.test.ts` (new), the two scoped `AGENTS.md` files.
- 6.4 and 6.2: `docs/09-decisions/0026-retrieval-is-in.md`, `docs/09-decisions/README.md`,
  `docs/plans/2026-10-22-apply-the-competitor-findings-plan.md`.

6.1 and 6.3 both touch `packages/core/src/model.ts` and `packages/core/AGENTS.md`, so they land
in order, each with its own commit and gate.

## Public-surface accounting

| after | core pins | core test files | core tests | models test files | models tests |
|---|---|---|---|---|---|
| Phase 5 close | 119 | 59 | 655 | 13 | 74 |
| 6.1 | 121 (+2) | 60 (+1) | 660 (+5) | 14 (+1) | 80 (+6) |
| 6.3 | 121 | 61 (+1) | 662 (+2) | 15 (+1) | 86 (+6) |
| exit + close | 121 | 61 | 662 | 16 (+1) | 89 (+3) |

Repository totals after the close: 171 files and 1317 tests (the Phase 5 close measured 166 and
1295). The 6.1 column gained two cases over its estimate because the core case file holds three,
not one, once the shim's identity and forwarding paths are proved separately. No type-only export changes a pin; the models barrel keeps its six names.

## Verification per item

Each item runs the same loop, and the order is part of the criterion:

1. **Red:** write the pre-registered test file first, run `pnpm vitest run --project core` (and
   `--project models` when the file lives there) and record the failure — a missing module or a
   missing name, never a skipped test.
2. **Green:** implement until the new file passes and the rest of the package still does; run the
   full core and models suites.
3. **Docs:** add the item's entry under this plan's `## Changes`, move the scoped `AGENTS.md`
   counts, write one handoff entry, then run `python scripts/rotate.py --apply`.
4. **Validator:** `python scripts/validate_context.py --root . --baseline docs/.baseline.json`
   reports no error and no warning.
5. **Gate:** the full `pnpm gate` run, launched as a background job, ends at exit code 0 in its
   output.
6. **Commit:** one commit, explicit staged paths, message naming the item.

## Close plan

1. Write `packages/models/test/phase-6-exit.test.ts` red, then green: three clauses in one file
   — a pre-numbering adapter through the shim completes a run, a caller's cache hint reaches an
   Anthropic request through `AgentOptions.modelOptions`, and the barrel's adapters are exactly
   the conformance list.
2. Write the Phase 6 report in `docs/reports/`: outcome, the exit criterion with the evidence
   command that proved each clause, what landed and its commit, the parent-plan check, the two
   deferrals and the open items.
3. Parent plan: mark 6.1 and 6.3 done with links to this plan and the report, 6.4 done with
   [0026](../09-decisions/0026-retrieval-is-in.md), 6.2 deferred with its reason; update the task
   table (`T-47` done with its report, `T-40` at Phases 0–6) and the open-questions list.
4. Tasks: remove the `T-47` row from `docs/04-tasks.md`, append it verbatim with `done` to
   `docs/tasks/archive-2026.md`, and update `T-40`'s gate.
5. Mark this plan `Status: complete`, append the close entry, rotate, run the validator and the
   final `pnpm gate`, then one `docs(phase-6): close the phase with its exit criterion and report`
   commit.

## Risks

- **Versioning for its own sake.** Mitigation: no synthetic breaking change; version 1 is the
  contract the adapters already implement, and the shim is proven by a pre-numbering model rather
  than by an invented v2.
- **A conformance suite that drifts from the adapters.** Mitigation: the exit test imports the same
  list, so a new adapter without a conformance entry fails the phase.
- **The opaque options bag becomes the provider dictionary the core was meant to avoid.**
  Mitigation: core never reads a field of it, each adapter types its slice, `extraBody` is the
  escape hatch and a test pins that the adapter's own keys win.
- **A cache marker silently changes a transcript.** Mitigation: markers are payload-only; the
  conformance and provider-option tests assert the request body and no event changes.
- **A widened adapter parameter breaks `Model` assignability.** Mitigation: method bivariance, and
  the red test at the seam runs before the adapters widen; revert the widening if typecheck
  disagrees.
- **The two scoped `AGENTS.md` caps.** Mitigation: update counts in the same commit and trim
  history wording, as Phase 5 did.

## Changes

- **2026-10-25 — Phase 6 closed.** 6.1, 6.3 and the exit criterion are committed and the phase
  report is [`2026-10-25-phase-6-report.md`](../reports/2026-10-25-phase-6-report.md). The
  parent plan's Phase 6 row is done, `T-47` closes with the report, `T-40` closes with the
  program, and 6.2 stays deferred under 0018 while 6.4 stays answered by 0026.
- **2026-10-25 — 6.3 landed.** `GenerateOptions.providerOptions` is an opaque record the core
  carries and never reads; `AgentOptions.modelOptions` pins options for every turn and is merged
  beneath the loop's own signal and advertised tools. The three wire adapters export a typed
  interface (`AnthropicProviderOptions`, `OpenAICompatibleProviderOptions`,
  `GeminiProviderOptions`) and widen their request parameter to accept it. Anthropic writes at most
  three cache breakpoints (system, last tool, last user block, with an optional TTL) and every
  adapter merges `extraBody` beneath its own keys. The two case files failed first on the missing
  field and the missing cache markers; core is 61 files and 662 tests (two cases), models is 15 and
  86 (six cases).
- **2026-10-25 — the exit criterion.** `phase-6-exit.test.ts` is the sixteenth models file and
  proves three clauses: a shimmed pre-numbering model finishes a `CodeAgent` run, a cache hint set
  through `AgentOptions.modelOptions` arrives in the Anthropic request body, and every name in the
  barrel is the conformance list's name. The list moved to `test/adapter-contract.ts` so both
  files read one copy. Models is 16 files and 89 tests.
- **2026-10-25 — 6.1 landed.** `MODEL_ADAPTER_VERSION` is 1, `ModelAdapterV1` names the
  contract the four adapters already implemented, and `upgradeModelAdapter` supplies the marker
  on behalf of a model written before it, forwarding both calls and keeping its identity. Each
  adapter now declares the version, and `adapter-conformance.test.ts` (14th models file) runs the
  same assertions over all five shipped adapters plus a bare model through the shim. The new core
  case file failed first on the missing name; the conformance file failed on the four wire adapters
  and then on the shim. Core is 60 files and 660 tests (three cases and two pins); models is 14 and
  80; pins 119 → 121.
- **2026-10-25 — 6.0 opening.** Plan written and registered: the scope decision (6.1 and 6.3 in,
  6.2 deferred, 6.4 answered by 0026), the two designs, the twelve pre-registered cases and the
  accounting. `T-47` opened.
