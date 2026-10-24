# Phase 5 — observation and cost: completion report

**Date:** 2026-10-25 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 5 execution plan](../plans/2026-10-25-phase-5-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 5 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 5 landed, how the exporter and cost seams are shaped, or
  which open items were left for a later phase.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

The measurements below were taken on the tree the close commit records; for live status read the
newest handoff entry instead.

**Status:** complete. Items 5.1 and 5.2 are landed, tested, documented and committed; the parent
plan's Phase 5 exit criterion runs as one file,
`packages/core/test/phase-5-exit.test.ts`. Nothing is pushed; `main` remains ahead of
`origin/main`.

## Outcome

Observation is now an option, not an import side effect. `TraceBuilder` is the live fold behind
the existing `buildTrace`, so a run feeds it one enriched event at a time and the whole-array
function replays through the same code. `AgentOptions.exporter` is the only switch: absent, no
builder is allocated and nothing is sent; installed, `stream`'s `finally` hands the finished
tree to the exporter once, after the terminal event. `monitoring/otel.ts` maps a tree to
OTLP/HTTP JSON with the GenAI attribute names, and `createOtlpHttpExporter` posts it through an
injected `fetch`, which keeps core isomorphic. Task text, code, tool arguments and output are
dropped unless the caller asks for payloads, because attributes are labels and prompts are
unbounded. An exporter that throws or rejects is a warning: the run's result stands.

Cost is a number with a date and a basis. `TokenUsage` keeps the provider's cache split rather
than folding it away, and the three HTTP adapters fill it from the count each wire publishes;
Anthropic's input total adds its cache counts because its wire reports fresh input separately.
`monitoring/pricing.ts` ships three sourced, dated list-price rows, finds a model by provider
and longest prefix, and does the arithmetic in integer micro-dollars. The loop prices each model
turn as its usage arrives, counts it against the budget, and folds a crossing into the same
`run.limitReached` path the token limits use, so the cap lands before the next model call.
`RunResult` reports `cost` and `costBasis`; a model outside the table reports no cost and
`"unknown"`, never a zero. The `Monitor` keeps the split it receives.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the 5.2 commit (`56d2fb8`) | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| core suite | 59 files, 655 tests pass |
| models suite | 13 files, 74 tests pass |
| whole repository | 166 files, 1295 tests pass |
| `packages/core/test/phase-5-exit.test.ts` | 3 passed (below) |
| public surface | core 119 pinned names, models pin list unchanged; every new runtime export has a pin |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 5.1 | `2f94cd9` | `TraceBuilder` live fold, `buildTrace` replays through it; `monitoring/otel.ts` maps a tree to OTLP/HTTP JSON and offers `createOtlpHttpExporter` over an injected fetch; `AgentOptions.exporter` wires it, payload attributes opt-in, exporter failures warn; root span records provider, spans record duration |
| 5.2 | `56d2fb8` | cache split in `TokenUsage` and the three adapters; dated sourced price table, longest-prefix lookup, integer micro-dollar `deriveCost`, six-decimal string; `RunLimits.maxCostUsd` with `limitCostUsd` checked between steps; `RunResult.cost`/`costBasis`; `MonitorStat` split |

## Exit criterion

The parent plan's criterion is: "A run emits a span tree only when the caller asked; a run with a
spent budget stops before the next step; an unknown price fails open, never as zero."

One file proves all three clauses:

1. The same scripted run with no exporter posts nothing, while the run with
   `createOtlpHttpExporter` posts exactly one payload whose spans are `run`, `step.0`,
   `tool.noop`, `step.1` in depth-first order, whose root and step ids are well-formed and
   parented, and whose resource carries `service.name`.
2. A run under `limits.maxCostUsd: 0.001` whose first priced turn costs $0.014988 emits
   `run.limitReached` with `reason: "limitCostUsd"` while the scripted model recorded exactly
   one call, so the stop sits before the next step.
3. A run on a model the table does not know completes with no `cost` and
   `costBasis: "unknown"`: the unknown price fails open and never reads as zero.

The file passes on first run because the two items' suites already pin each half; it is the
integration proof, not a red-first feature.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 5.1 opt-in OTel exporter, never wired at import, with model, provider, tool, step and timing attributes (`OB-02`, `OB-03`) | `TraceBuilder`, `SpanExporter`, `toOtlpExport`, `createOtlpHttpExporter`, `AgentOptions.exporter` |
| 5.2 usage split, a dated price table, a decimal cost with its basis, and a budget checked between steps (`OB-06`) | cache split in `TokenUsage` and adapters, `monitoring/pricing.ts`, `RunResult.cost`/`costBasis`, `maxCostUsd`/`limitCostUsd` |

Differences from the plan's text, each recorded in the plan's `## Changes`:

- `RunBudget.maxCostMicroUsd` is always resolved (the ceiling when the caller asks for none)
  rather than optional, so the record cannot be read without its cap.
- Six runtime names are pinned, not five: `formatMicroUsd` is exported so a caller can render
  the integer a budget counts without re-deriving the string.
- The 5.2 suite has seven cases, and `costBasis` is optional on the interface only so a result
  built by hand still type-checks; `makeRunResult` always sets it.
- The shipped rows are three of the providers' current published list prices read on
  2026-10-25 (`claude-sonnet-4-5`, `gpt-6.1-sol`, `gemini-3.5-flash-lite`); the table is an
  example that rots, which is why an unknown model is `undefined` and a caller may pass its own.

## Open

- `T-46` closes with this report. Phase 5 is code-complete and unreleased; publishing still
  waits on `T-14`.
- No live collector was touched: the exporter is exercised through an injected fetch and an
  in-memory fake, and no test asserts a real OTLP endpoint's acceptance.
- The streamed Anthropic cache split is mapped from `message_start` but has no fixture of its
  own; a streamed turn's split is the one adapter path a recorded fixture does not pin.
- A cap crossed by a turn is checked after that turn's usage arrives, so the turn that crosses
  it is paid for and recorded; the cap prevents the next call, not the one that overshot.
- A resumed run without a caller's budget handle starts its cost counter at zero, because a step
  records tokens and not a price; a hard cost cap across a resume needs the handle.
