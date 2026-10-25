# Phase 6 — model and output depth: completion report

**Date:** 2026-10-25 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 6 execution plan](../plans/2026-10-25-phase-6-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 6 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 6 landed, how the adapter contract and the provider-options
  seam are shaped, or which items the phase left open.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

The measurements below were taken on the tree the close commit records; for live status read the
newest handoff entry instead.

**Status:** complete. Items 6.1 and 6.3 are landed, tested, documented and committed, 6.4 is
answered by `0026`, and 6.2 is deferred under `0018`. The parent plan's Phase 6 exit criterion runs
as one file, `packages/models/test/phase-6-exit.test.ts`. Nothing is pushed; `main` remains ahead
of `origin/main`.

## Outcome

The adapter contract now has a number. `MODEL_ADAPTER_VERSION` is 1 and `ModelAdapterV1` is the
interface every shipped adapter implements; `upgradeModelAdapter` is the only place the marker is
supplied on another model's behalf, copying its id, provider and capabilities and forwarding both
calls, so a model written before the numbering keeps running through the loop unchanged. The four
adapters declare the version, `HuggingFaceModel` inherits it from the OpenAI adapter, and
`adapter-conformance.test.ts` runs one set of assertions over all five plus a bare model through the
shim: a sixth adapter cannot land outside that list because the exit test imports the same copy.

Provider options have a typed home that the core does not read. `GenerateOptions.providerOptions`
is an opaque record; `AgentOptions.modelOptions` pins options for every turn of a run beneath the
loop's own signal and advertised tools, so a caller cannot replace either. Each wire adapter exports
its own interface: `AnthropicProviderOptions` writes at most three cache breakpoints — system, last
tool, last user block — with an optional `5m` or `1h` lifetime, `OpenAICompatibleProviderOptions`
carries a prompt-cache key and retention, `GeminiProviderOptions` names a `cachedContent`, and all
three accept `extraBody`, merged first so the adapter's own keys win a collision. A request without
options is byte-identical to what it was before the field existed.

Retrieval is decided rather than built: decision `0026` puts it in as an opt-in seam for a later
phase, with no core hook and no package choice. Multimodal stays where `0018` left it — a declared
capability flag with no consumer — because no caller has asked.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the close | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| core suite | 61 files, 662 tests pass |
| models suite | 16 files, 89 tests pass |
| whole repository | 171 files, 1317 tests pass |
| `packages/models/test/phase-6-exit.test.ts` | 3 passed (below) |
| public surface | core 121 pinned names; the models barrel keeps its six names and no pin moved |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 6.1 | `762694d` | `MODEL_ADAPTER_VERSION`, `ModelAdapterV1`, `upgradeModelAdapter`; four adapters declare the version; `adapter-conformance.test.ts` runs one contract over five adapters and the shim; two core pins |
| 6.3 and the exit file | close commit | opaque `providerOptions`, `AgentOptions.modelOptions` merged under the loop's keys; typed `AnthropicProviderOptions`, `OpenAICompatibleProviderOptions`, `GeminiProviderOptions` with `extraBody`; Anthropic cache breakpoints with TTL; `provider-options.test.ts` and `model-options.test.ts`; `phase-6-exit.test.ts` |

## Exit criterion

The parent plan's criterion is: "An adapter written against one interface version keeps working
across the next; provider options have a typed home."

One file proves all three clauses:

1. A model written before the numbering, upgraded through the shim, finishes a `CodeAgent` run and
   reports the contract version; the shim copies identity and forwards the call.
2. A cache hint installed through `AgentOptions.modelOptions` reaches the Anthropic request body:
   the system prompt and the last user block carry `cache_control: { type: "ephemeral" }`, with no
   change to the transcript or the event stream.
3. Every name in the models barrel is a name in the conformance list, so a shipped adapter and a
   covered adapter are the same set.

The file passes on first run because 6.1 and 6.3 already pin each half; it is the integration proof
for the phase, not a red-first feature.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 6.1 a numbered adapter interface, an upgrade shim, a conformance test per adapter (`MD-09`) | `MODEL_ADAPTER_VERSION`, `ModelAdapterV1`, `upgradeModelAdapter`, versioned adapters, `adapter-conformance.test.ts` |
| 6.3 a typed passthrough for cache markers and provider options (`MD-07`) | `GenerateOptions.providerOptions`, `AgentOptions.modelOptions`, three typed provider interfaces with `extraBody`, Anthropic cache markers |
| 6.4 retrieval: in or out, decided in writing (`MD-10`) | [`0026`](../09-decisions/0026-retrieval-is-in.md) |
| 6.2 image parts and a per-adapter capability flag (`MD-04`) | deferred under [`0018`](../09-decisions/0018-post-0.1.0-scope-boundary.md); `ModelCapabilities.images` still has no consumer |

Differences from the plan's text, each recorded in the plan's `## Changes`:

- The phase's core test count is 662, not the estimated 660: the 6.1 case file proves the shim's
  identity and forwarding paths separately, which brought three cases where the estimate assumed
  one.
- The conformance list lives in `test/adapter-contract.ts`, a non-test module, so the exit file and
  the conformance file read one copy instead of two.
- Each typed provider interface carries an index signature, so a field the interface does not name
  is still expressible through `extraBody` and a known key stays type-checked.
- The cache breakpoint count is capped at three in this adapter, under Anthropic's four, because
  the three the seam writes are the three the phase can prove against a fixture.

## Open

- `T-47` and `T-40` close with this report. Publication still waits on `T-14`.
- No second contract version exists, so the upgrade path is proven on a pre-numbering model, not
  on a v1-to-v2 translation; whichever change bumps the number owes that case.
- 6.2 is deferred, not refused: a caller asking for image input reopens it under `0018`.
- Retrieval is decided but unscheduled; its seam needs a later execution plan and an embedding
  choice.
- No live provider was touched: every adapter test drives an injected fetch against a recorded
  fixture, and the provider-option tests assert the request body only.
