# Phase 5 — observation and cost: execution plan

**Date:** 2026-10-25 · **Status:** complete · **Owner:** lead · **Parent:**
[apply the competitor findings](2026-10-22-apply-the-competitor-findings-plan.md), rows 5.1–5.2.

**Contract**
- **Role:** the working plan for Phase 5 — item order, the design each item lands, and the
  acceptance tests registered before any code is written.
- **Mutability:** history plus a live checklist. Append to `## Changes` when an item lands or a
  criterion proves wrong; never rewrite a landed entry.
- **Read when:** executing or reviewing Phase 5.
- **Update when:** an item lands, a registered test contradicts its design, or the phase closes.

## Why this phase

A run already says what it is doing: `AgentEvent` is the record, the `Monitor` counts turns, and
`buildTrace` folds the stream into an OTel-shaped tree. What is missing is the two ends of that
story. The tree never leaves the process, because wiring an exporter into the runtime would make
telemetry a side effect of importing a package. And the usage counters stop at tokens: a caller
cannot see what the run cost, split a cache read from a fresh token, or stop a run that has spent
its allowance. Phase 5 finishes both ends without making either one implicit: an exporter exists
only when a caller installs one, and a price is either a dated table entry or `undefined`, never
a silent zero.

Ids: `OB-02` (opt-in tracing export), `OB-03` (spans carry the attributes worth filtering on),
`OB-06` (usage split, dated price table, decimal cost, budget checked between steps).

## Invariants

1. **Nothing is wired at import.** Importing `@smolagents-ts/core` performs no I/O, registers no
   global exporter and touches no `fetch`. A run exports a span tree only because an
   `AgentOptions.exporter` was passed.
2. **Telemetry never fails a run.** A sync throw, a rejected promise or a non-2xx answer from an
   exporter is caught, logged through the agent's `logger.warn`, and the run still ends with the
   result it produced.
3. **Attributes describe the work, not the payload.** A span carries model, provider, tool, step,
   timing and usage. Task text, generated code, tool arguments, tool output and logs stay out by
   default; `includePayloads: true` is the only way to add them.
4. **Unknown price is unknown.** A model or provider the table does not match yields `undefined`
   cost, never `0`, and a cost cap is not enforced on a run whose price is unknown. Zero usage at
   a known price is `0.000000` with a known basis.
5. **The cost cap stops between steps.** Like the token limits, the check runs after a model turn
   and before the next step, so one response is the documented overshoot. The cap is off unless
   `limits.maxCostUsd` is asked for, and it is clamped by the deployment ceiling.
6. **Additive on every surface.** `TokenUsage` grows optional fields, `AgentOptions` grows options
   with defaults that keep today's behaviour, and an adapter that reports no cache leaves the
   field absent rather than zero. Existing tests and pins change only where a name is added.
7. **Red first, every time.** An item's implementation starts only after its pre-registered test has been watched failing.

## Pre-registered acceptance tests

| item | test file | cases that must fail first |
|---|---|---|
| 5.1 | `packages/core/test/otel-exporter.test.ts` (57th core file) | a two-step run with no `exporter` calls no injected `fetch` and posts nothing; the same run with `createOtlpHttpExporter({ url, fetch, serviceName })` posts exactly one OTLP payload whose resource carries `service.name` and whose scope names the package, with a `run` root span carrying `gen_ai.request.model`, `gen_ai.provider.name`, `gen_ai.usage.input_tokens` and `gen_ai.usage.output_tokens`, a `step.*` child and a `tool.echo` grandchild whose `parentSpanId` wires them in order, the step span carrying its index and duration and the tool span `gen_ai.tool.name`, and every time a unix-nano string; the payload's `traceId` is the run id in 32 lowercase hex and every `spanId` is 16, all distinct; task text, code, tool arguments and tool output are absent from the attributes unless `includePayloads: true`, and then present; an exporter whose `export` throws or rejects leaves the run completed and the terminal result intact and logs one warning per failure; a run that fails its model call exports a root span with status code 2 and the error type, not code 1 |
| 5.2 | `packages/core/test/usage-cost-budget.test.ts` (58th core file), plus one case each in `packages/models/test/anthropic.test.ts`, `openai-compatible.test.ts` and `gemini.test.ts` | `findModelPrice` matches an exact provider and model prefix and returns `undefined` for an unknown model and for an unknown provider, never a zero price; `deriveCost` over 1,000,000 uncached input tokens, 400,000 cached input and 500,000 output at the caller's table returns a decimal `costUsd` equal to the hand arithmetic and a basis naming the table's effective date, currency, rates and token split; zero usage at a known price is `"0.000000"` with `costBasis: "table"`, while an unknown price gives no `cost` and `costBasis: "unknown"`; a run with `limits.maxCostUsd` whose first priced turn crosses it emits `run.limitReached` with `reason: "limitCostUsd"` and the scripted model recorded exactly one call, proving the stop sits before the next step; the same run without a cost limit finishes and its `run.completed` result carries `cost.costUsd` and the basis; a budget handle continued into a second run keeps its spent cost and the ceiling clamps an oversized request; the three adapters map Anthropic `cache_read_input_tokens` and `cache_creation_input_tokens`, OpenAI `prompt_tokens_details.cached_tokens` and Gemini `cachedContentTokenCount` into the split (input total includes the cached count where the provider does), and an adapter that reports no cache leaves `cachedInputTokens` absent |
| exit | `packages/core/test/phase-5-exit.test.ts` (59th core file) | all three clauses in one file: the same run emits no span payload with no exporter and posts a tree with one, a run whose priced spending crosses `maxCostUsd` emits `run.limitReached` with `limitCostUsd` before a second model call, and a run on a model the table does not know completes with no `cost` and `costBasis: "unknown"` |

## Item designs

### 5.1 An opt-in OTel exporter over the trace

`packages/core/src/monitoring/trace.ts` already folds events into `TraceSpan`; the fold moves into
a `TraceBuilder` so a live run can feed it one event at a time instead of replaying an array.
`buildTrace(events, clock)` becomes a thin loop over the builder, so its output and every existing
trace test are unchanged. The builder gains what the export needed: `run.started` carries an
optional `provider`, the root span records it, and a step span records its `durationMs` when it
closes (tool spans already carry theirs). `TraceBuilder` is a pinned runtime name.

`packages/core/src/monitoring/otel.ts` is new and has no side effects:
- `toOtlpExport(trace, options?)` maps one `TraceSpan` tree to an OTLP/HTTP JSON export: resource
  attributes from `serviceName`, one scope named `@smolagents-ts/core` with the package version,
  spans in depth-first order, each with `traceId`, `spanId`, `parentSpanId` when it has a parent,
  `startTimeUnixNano`/`endTimeUnixNano` as decimal strings, flattened attributes and a status
  (`{ code: 1 }` for ok, `{ code: 2, message }` for error). GenAI conventions are added by name:
  `gen_ai.operation.name` (`invoke_agent`, `execute_tool`, and the step/planning spans' names),
  `gen_ai.request.model`, `gen_ai.provider.name`, `gen_ai.usage.input_tokens`,
  `gen_ai.usage.output_tokens` and `gen_ai.tool.name`. Payload keys (`task`, `text`, `code`,
  `args`/`arguments`, `output`, `observation(s)`, `logs`) are dropped unless
  `includePayloads: true`.
- `createOtlpHttpExporter({ url, fetch?, headers?, serviceName?, includePayloads? })` returns a
  `SpanExporter` whose `export(trace, context)` POSTs the JSON to `url` with
  `content-type: application/json` and the given headers, and rejects on a non-2xx answer. `fetch`
  defaults to `globalThis.fetch` and is injected in tests, so core stays isomorphic.
- `SpanExporter` and `SpanExportContext` (`runId`, `modelId`, `provider`, `task`) are the seam.

The loop wiring is one option and one hook: `AgentOptions.exporter?: SpanExporter`; `RunContext`
holds `trace: TraceBuilder | undefined`, created only when the option is set; `emit` offers every
enriched event to it; `stream`'s `finally` exports the finished tree only when a terminal event
was emitted, inside a `try/catch` that logs a warning. Nothing else in the loop changes, and an
agent constructed without the option never allocates a builder.

Three runtime names reach the barrel: `TraceBuilder`, `toOtlpExport`,
`createOtlpHttpExporter`. Core pins 110 → 113.

### 5.2 Usage split, dated price table, decimal cost and a cost cap

`packages/core/src/types.ts`: `TokenUsage` grows optional `cachedInputTokens` (the part of
`inputTokens` the provider billed as a cache read) and `cacheWriteInputTokens` (a cache write),
both absent when unreported. `EMPTY_TOKEN_USAGE` stays fieldless; `addTokenUsage` sums each field
when either side has it, so a run's cumulative usage preserves the split.

`packages/models/src`: each adapter copies the provider's own cache count instead of normalising
it away. OpenAI-compatible reads `prompt_tokens_details.cached_tokens`; Anthropic reads
`cache_read_input_tokens` and `cache_creation_input_tokens` and adds both to `input_tokens`
(Anthropic reports fresh input separately), in the streamed form from the `message_start` usage;
Gemini reads `cachedContentTokenCount` (already inside `promptTokenCount`). HuggingFace and custom
models report no split. One case per adapter, in the existing files.

`packages/core/src/monitoring/pricing.ts` is new:
- `ModelPrice` is a dated, sourced row: `provider`, `modelPrefix`, `currency: "USD"`,
  `effectiveDate` (ISO date), `inputPerMTokUsd`, `cachedInputPerMTokUsd?`,
  `cacheWriteInputPerMTokUsd?`, `outputPerMTokUsd`, and `source` (the URL the numbers were read
  from). Rates are USD per million tokens.
- `PRICE_TABLE_DATE` is the date the shipped table was transcribed, and `DEFAULT_PRICE_TABLE` is
  that table: three published list-price rows for the models the repository's docs use (Anthropic,
  OpenAI and Gemini), each with its source URL and effective date. A comment says the table is an
  estimate, rots, and is why an unknown model is `undefined`. A caller may pass its own
  `priceTable`.
- `findModelPrice({ provider, model, table? })` matches the provider exactly and the model by
  prefix (the longest matching prefix wins) and returns `undefined` otherwise — never a zero row.
- `deriveCost(usage, query)` takes the same query (so the table travels with it) and returns
  `undefined` when the price is unknown, otherwise
  `{ costUsd: string, microUsd: number, basis }` where the arithmetic runs in integer micro-USD
  (rate in micro-USD per million tokens × tokens ÷ 1,000,000, rounded per component), `costUsd` is
  that integer formatted with six decimals, and `basis` names the currency, the table's effective
  date, the matched price's rates and the token split (uncached, cached, cache-write, output). A
  known price with zero usage is `"0.000000"`; an absent `cachedInputPerMTokUsd` prices cached
  tokens at the input rate and says so in the basis, because a missing rate is not a free token.

`packages/core/src/session/budget.ts`: `RunLimits.maxCostUsd?`, ceiling `maxCostUsd: 100`;
`RunBudget` grows `maxCostMicroUsd` (always resolved, the ceiling when the caller asked for none)
and `costMicroUsd`; `LimitStopReason` grows `"limitCostUsd"`; `spendCostBudget(budget, microUsd)`
accumulates and returns `"limitCostUsd"` once the cumulative cost reaches the cap; `exhaustedBudget`
checks it too, so a resumed run does not spend again. `spendBudget` keeps its token-only signature.

`packages/core/src/agent/multi-step-agent.ts`: `AgentOptions.priceTable?:` and
`AgentOptions.exporter?` live beside `limits`; after each model turn the loop prices that turn with
`deriveCost` against this agent's model and table and counts it with `spendCostBudget`, folding
`limitCostUsd` into the same `context.limitReached` check the token reasons use, so the terminal
event is emitted before the next model call. A budget is a record, so a handle continued into a
later run carries the spent cost with it. `run.started` carries its optional `provider` here.

`packages/core/src/agent/run-result.ts`: `RunResult` grows `cost?: RunCost` and
`costBasis?: "table" | "unknown"` (optional only so a hand-built result still type-checks);
`makeRunResult` takes a `cost` input and defaults `costBasis` to `"unknown"`, deriving `"table"`
only from a present `cost`. `buildResult` computes it from the run's cumulative usage and the
agent's table, so the number agrees with the budget the loop counted.

`packages/core/src/monitoring/monitor.ts`: `MonitorStat` gains optional `cachedInputTokens` and
`cacheWriteInputTokens` so the monitor does not lose the split it now receives; both stay absent
until a recorded usage reports one, which keeps the existing stat shape for a reporting-free model.

Six runtime names reach the barrel: `PRICE_TABLE_DATE`, `DEFAULT_PRICE_TABLE`,
`findModelPrice`, `deriveCost`, `formatMicroUsd` and `spendCostBudget`. Core pins 113 → 119.

## Files likely affected

- 5.1: `packages/core/src/monitoring/trace.ts`, `packages/core/src/monitoring/otel.ts` (new),
  `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/events.ts`,
  `packages/core/src/index.ts`, `packages/core/test/otel-exporter.test.ts` (new),
  `packages/core/test/public-surface.test.ts`, `packages/core/test/trace.test.ts` (only if the
  refactor changes a fixture), `packages/core/AGENTS.md`.
- 5.2: `packages/core/src/types.ts`, `packages/core/src/model.ts` (doc comment only),
  `packages/core/src/monitoring/pricing.ts` (new), `packages/core/src/monitoring/monitor.ts`,
  `packages/core/src/session/budget.ts`, `packages/core/src/agent/run-result.ts`,
  `packages/core/src/agent/multi-step-agent.ts`, `packages/core/src/index.ts`,
  `packages/core/test/usage-cost-budget.test.ts` (new), `packages/core/test/budget.test.ts` and
  `packages/core/test/run-result.test.ts` only if a shape assertion widens,
  `packages/models/src/anthropic.ts`, `packages/models/src/openai-compatible.ts`,
  `packages/models/src/gemini.ts`, the three matching `packages/models/test/*` files,
  `packages/core/AGENTS.md`, `packages/models/AGENTS.md`.

The two items share `multi-step-agent.ts` and `index.ts`, so they are strictly ordered: 5.1 lands
and commits before 5.2 begins.

## Public-surface accounting

| after | core pins | core test files | core tests | models tests |
|---|---|---|---|---|
| Phase 4 close | 110 | 56 | 631 | 71 |
| 5.1 | 113 (+3) | 57 (+1) | 639 (+8, the three pins are three tests) | 71 |
| 5.2 | 119 (+6) | 58 (+1) | 652 (+13, seven cases and six pins) | 74 (+3) |
| exit + close | 119 | 59 (+1) | 655 (+3) | 74 |

No type-only export changes a pin. The exit test adds no name.

## Verification per item

Each item runs the same loop, and the order is part of the criterion:

1. **Red:** write the pre-registered test file first, run `pnpm vitest run --project core` (and
   `--project models` for 5.2) and record the failure — a missing module or a missing name, never a
   skipped test.
2. **Green:** implement until the new file passes and the rest of the package still does; run the
   full core and models suites.
3. **Docs:** append the item to this plan's `## Changes`, update the scoped `AGENTS.md` counts
   (core files and tests; models tests), and add one handoff entry, then
   `python scripts/rotate.py --apply`.
4. **Validator:** `python scripts/validate_context.py --root . --baseline docs/.baseline.json`
   reports no error and no warning.
5. **Gate:** `pnpm gate` exits 0, run as a background job and confirmed through its job output.
6. **Commit:** one commit, explicit staged paths, message naming the item.

## Close plan

1. Write `packages/core/test/phase-5-exit.test.ts` red, then green.
2. Write the Phase 5 report in `docs/reports/`: outcome, the three clauses with the evidence
   command that proved each, what landed and its commit, the parent-plan check, and open items
   (notably: the price table rots, and a cost stop overshoots by exactly one response).
3. Parent plan: mark rows 5.1 and 5.2 done with links to this plan and the report; update the task
   table (`T-46` done with its report).
4. Tasks: remove the `T-46` row from `docs/04-tasks.md`, append it verbatim with `done` to
   `docs/tasks/archive-2026.md`, and move `T-40` to "Phases 0–5 are closed; the next phase row
   waits on the owner opening it".
5. Mark this plan `Status: complete`, append the close entry, rotate, run the validator and the
   final `pnpm gate`, then one `docs(phase-5): close the phase with its exit criterion and report`
   commit.

## Risks

- **The price table is a claim, not a measurement.** Mitigation: every row carries the URL it was
  transcribed from and the date; `costBasis` says `table`; an unknown model is `undefined`; the
  report states that the numbers were not verified against a bill.
- **A cost cap can overshoot by one response.** Mitigation: the check runs between steps like the
  token limits, and the report documents the bound instead of pretending it is exact.
- **Exporting prompts is a cardinality and privacy risk.** Mitigation: payload keys are dropped by
  default; `includePayloads` is explicit; the exporter sends nothing unless installed.
- **The builder refactor could change `buildTrace` output.** Mitigation: the existing trace suite
  is the oracle, and 5.1 keeps `buildTrace` as a loop over the builder.
- **Adding fields to `RunResult` can break an exact-object assertion.** Mitigation: run the core
  suite first; widen an assertion only with a comment saying why.

## Changes

- **2026-10-25 — closed.** The three clauses ran as
  `packages/core/test/phase-5-exit.test.ts` (59th core file, three cases); it passed on its
  first run because each half was already pinned by its item, so it is the integration proof
  rather than a red-first feature. Core is 59 files and 655 tests, models 13 and 74, the whole
  repository 166 files and 1295 tests, pins 119. [The report](../reports/2026-10-25-phase-5-report.md)
  records the evidence, the parent-plan check and the open items.
- **2026-10-25 — 5.2 landed.** `TokenUsage` keeps the cache split (absent when unreported) and
  the three HTTP adapters fill it; `monitoring/pricing.ts` is the dated, sourced table, the
  longest-prefix lookup, integer micro-dollar cost and the six-decimal string; the budget grows
  `maxCostMicroUsd`/`costMicroUsd`, `limitCostUsd` and `spendCostBudget`, and the loop prices each
  model turn so the cap stops before the next call. `RunResult` reports `cost` and `costBasis`; an
  unknown price is `undefined` cost and `"unknown"` basis, never a zero. `usage-cost-budget.test.ts`
  (58th core file, seven cases) was watched red first, and the three adapter cases failed on the
  missing fields before the mapping landed. Core is 58 files and 652 tests (seven cases and six
  pins); models is 13 files and 74 tests; pins 113 → 119.
- **2026-10-25 — 5.1 landed.** `TraceBuilder` is the live fold (`buildTrace` replays through
  it), the root span records the provider and every closed span its duration, and
  `monitoring/otel.ts` maps a tree to OTLP/HTTP JSON and posts it through an injected fetch when
  `AgentOptions.exporter` is installed. Payload attributes are dropped unless
  `includePayloads` is set. `packages/core/test/otel-exporter.test.ts` (57th core file, five
  cases) was watched red first; core is 57 files and 639 tests, pins 110 → 113. The pin loop
  counts a test per name, which the accounting table above now shows.
- **2026-10-25 — 5.0 opening.** Plan written and registered: the two items, their seven
  invariants, the three pre-registered test files and the exit criterion. `T-46` opened.
