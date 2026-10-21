# Models and structured output — cross-dive brief

**Contract**
- **Role:** synthesis for the model and structured-output lane, drawn from the dives already filed; it does not replace them.
- **Mutability:** frozen at the revision of the dives it cites.
- **Read when:** designing the model seam, typed output, or usage accounting.
- **Update when:** a cited dive is superseded or a decision changes a recommendation.

## Scope

This brief covers one lane: how a model is represented, how a typed answer is asked for and parsed, and who reports usage and money.
Row ids and statuses come from `docs/research/competitors/_synthesis/00-our-baseline.md` and are not restated; the dives are cited rather than summarised.
Evidence is a clone path with a line, or a documentation URL with its read date; a claim without either is marked as inference.
Clone paths are repo-relative to the clone named in the table below; each cited path is unique by file, though several dives share a top-level directory such as `packages/` or `src/`.

| dive | what this brief takes from it |
|---|---|
| `docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:16` | the versioned model spec, registry, and the `Output` object |
| `docs/research/competitors/pydantic-ai/02-features-inventory.md:142` | profile objects, the four output modes and their retry loop |
| `docs/research/competitors/mastra/01-architecture.md:34` | the router over AI SDK model versions and the structuring processor |
| `docs/research/competitors/adk-js/02-features-inventory.md:126` | a name-pattern registry with a routed model |
| `docs/research/competitors/openai-agents-js/02-features-inventory.md:136` | the smallest viable model interface |
| `docs/research/competitors/huggingface-smolagents/02-features-inventory.md:109` | adapter classes with a reloadable registry |
| `docs/research/competitors/beeai-framework/02-features-inventory.md:122` | `provider:model` strings with dynamic imports |
| `docs/research/competitors/voltagent/02-features-inventory.md:183` | a provider layer that became deprecation notices |
| `docs/research/competitors/claude-agent-sdk/02-features-inventory.md:114` | money reported by the vendor, with a basis |

## 1. The model seam

| neighbour | what a model is | how a caller names one | declared capability facts | evidence |
|---|---|---|---|---|
| vercel-ai-sdk | a spec object with `specificationVersion`, `provider`, `modelId`, `supportedUrls` and two call methods | a registry string `${provider}${sep}${model}`, or a bare id through a global default | `supportedUrls` only; the output mode is the caller's choice | `packages/provider/src/language-model/v4/language-model-v4.ts:8`, `packages/ai/src/registry/provider-registry.ts:89` |
| pydantic-ai | a model class per family, with a per-family profile | a string id resolved to provider, class and profile | twelve boolean fields among eighteen optional keys on the profile | `pydantic_ai_slim/pydantic_ai/profiles/__init__.py:55`, `:76` |
| mastra | an AI SDK language model, accepted at versions v2, v3 and v4 | a router id such as `openai/gpt-4o`, wrapped by a router model | a generated id table plus per-id facts such as temperature support | `packages/core/src/llm/model/router.ts:111`, `packages/core/src/llm/model/provider-registry.ts:750` |
| adk-js | a class that declares the name patterns it serves | the registry matched against the name, with an LRU cache | the pattern itself | `core/src/models/registry.ts:19` |
| openai-agents-js | an interface with two methods and optional retry advice | a provider maps a string to a model | none; the adapter advises on replay safety | `packages/agents-core/src/model.ts:688`, `:712` |
| huggingface-smolagents | one adapter class per vendor API, sharing a base | a class instance, or a registry entry for reloadable ones | none; conversion rules live in the adapter | `src/smolagents/models.py:1205`, `:282` |

The seam is not the interesting decision; the interesting decision is where the capability facts live.
Vercel keeps them out of the spec and lets the caller pick a mode, pydantic puts them on a profile and derives the mode, and mastra generates a table keyed by router id.
Each choice moves the failure somewhere different, and section 2.2 returns to that.

Important: for us the shape already exists. `ModelCapabilities.structuredOutput` is declared and nothing sets or reads it (`docs/research/competitors/_synthesis/00-our-baseline.md:69`), and `packages/models` keeps five adapters plus a function-defined model (`:88`).
That is the cheapest starting point in the register, because the work is filling a seam rather than creating one.
The adapter count is a packaging question, not a design one: vercel ships about 45 vendor packages, smolagents ships a handful of classes, and beeai imports an adapter from a string. Our five (`:88`) is a sensible floor because each one is a different wire shape, not a different feature.

### What a library our size should carry

- One spec interface per model kind, with a `specificationVersion` field even while only one version exists; the field costs one string and buys a migration path.
- One string id resolution path, `${provider}/${model}`, resolved by a registry that raises a typed error listing what it knows.
- Capability facts as data on the adapter: output modes, image input, streaming, and cache reporting. Three to six booleans, not a taxonomy.
- Upgrade adapters only when a second consumer of the spec exists; a single-version library needs the field, not the proxy layer.
- Provider packages that install independently, so the core never imports a vendor SDK.

### What it should refuse

- Per-family model classes that branch on the provider name inside the loop. Pydantic's profiles work because the loop never asks who the provider is; a class hierarchy invites exactly that question.
- A second registry inside the agent. Vercel's registry is the only place a name becomes a model, and that is why the error message can list alternatives.
- Capability facts guessed at runtime from the model id's substring, as beeai does for runner selection (`typescript/src/agents/react/agent.ts:70`); a name is not a contract.
- Prices and retry policy in the core. Both belong to data and caller policy, not to the model seam.

## 2. Structured output, four sub-problems

Neighbours tend to collapse these into one feature row, and that is where the design debt collects.
Solved separately, each has a small answer that can ship on its own schedule.

### 2.1 Asking the provider

| way to ask | who does it | cost of the choice |
|---|---|---|
| native response format | vercel via a json `responseFormat` (`packages/ai/src/generate-object/generate-object.ts:411`); pydantic `NativeOutput` (`pydantic_ai_slim/pydantic_ai/output.py:180`) | one call, provider-enforced schema, and the only mode where the provider can refuse below the schema |
| a synthetic tool call | pydantic's default (`pydantic_ai_slim/pydantic_ai/output.py:103`) | one call, works almost everywhere, but the answer arrives as tool arguments and consumes a tool-call slot |
| a prompt carrying the schema | pydantic's `PromptedOutput` (`pydantic_ai_slim/pydantic_ai/output.py:237`); beeai's JSON instruction plus tolerant parse (`typescript/src/backend/chat.ts:361`) | one call, no provider support needed, weakest guarantee; needs its own validator and retry |
| a second model call | mastra's structuring processor (`packages/core/src/processors/processors/structured-output.ts:45`) | two calls and a second chance to fail, in exchange for working with any model |

Recommendation: native when declared, tool otherwise, prompt only when the caller opts in, never as an automatic fallback.
A silent fallback to prompting is the failure vercel documents against itself: its prompt-injection helper survives as an exported function with no call site (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:74`).

### 2.2 Declaring what a model supports

Three shapes exist. A profile object with optional booleans and documented defaults (`pydantic_ai_slim/pydantic_ai/profiles/__init__.py:55`, `:63`); a generated table keyed by router id (`packages/core/src/llm/model/provider-types.generated.d.ts:8754`); or nothing, leaving the caller to discover support by failing (vercel).
The profile is the best fit for us, with two refinements the pydantic comment itself records: resolve facts from the adapter rather than the name where the name is insufficient (`pydantic_ai_slim/pydantic_ai/profiles/__init__.py:121`), and warn when a requested setting is ignored rather than dropping it silently (`pydantic_ai_slim/pydantic_ai/models/__init__.py:557`).
Concretely, four facts decide almost every branch: native JSON schema, JSON object mode, tool-call output, and whether usage reports cache reads.

### 2.3 Parsing incrementally

Streaming needs a partial object before the answer is valid, and the neighbours differ on whether that object is validated.
Vercel parses each text delta with a partial-JSON parser and returns a `DeepPartial`, stating in the code that partial results are not validated (`packages/ai/src/generate-text/output.ts:163`).
Pydantic stays tolerant in a different place: `allow_partial='trailing-strings'` parses partial JSON and accepts an incomplete trailing string (`pydantic_ai_slim/pydantic_ai/_output.py:973`).
Mastra emits object chunks from the structuring agent while it streams (`packages/core/src/processors/processors/structured-output.ts:34`).

For us the rule should be: partials are for display only. They are derived from a tolerant parser, never schema-validated, never fed back into the loop, and never stored as a run result.
That keeps the compat surface small: one new event beside the existing typed stream (`docs/research/competitors/_synthesis/00-our-baseline.md:27`), and one parser in core.

### 2.4 Repairing a schema failure

| approach | example | what it fixes | what it risks |
|---|---|---|---|
| one-shot text rewrite | vercel's `repairText` hook (`packages/ai/src/generate-object/parse-and-validate-object-result.ts:77`) | broken JSON syntax | nothing semantic; it cannot add a missing field |
| re-prompt with validator errors | pydantic's `ModelRetry` (`pydantic_ai_slim/pydantic_ai/_output.py:130`, `:385`) | missing or mistyped fields | extra spend and a loop that never terminates without a budget |
| retry with validator output | beeai re-sends the ajv errors (`typescript/src/backend/chat.ts:361`) | schema detail the model can act on | the same, plus prompt growth |

Recommended loop: at most one repair attempt by default, a hard cap of two, the validator's messages echoed verbatim, the budget separate from tool retries, and no repair when the finish reason is a length limit, because that is truncation and not a schema error.
After the cap, fail with a typed error carrying the text, the issues, the usage and the finish reason, so the caller can log one object instead of re-reading the response.
Our `GR-06` is absent while the final-answer validation already exists (`docs/research/competitors/_synthesis/00-our-baseline.md:70`, `:66`); the loop is the small part.

## 3. The `Output` specification

Vercel threads one object through generation, streaming and the result (`packages/ai/src/generate-text/output.ts:23`).

| member | type | what it does |
|---|---|---|
| `name` | string | identifies the mode in output and errors |
| `responseFormat` | promise of the call option | supplies what the provider must be asked for (`:32`) |
| `parseCompleteOutput` | text plus context, returns the value | parses and validates, throwing a typed error with usage and finish reason (`:37`) |
| `parsePartialOutput` | text, returns a partial or undefined | derives a displayable partial from each delta (`:49`) |
| `createElementStreamTransform` | optional stream transform | emits list elements as they complete (`:56`) |

What it buys: one type that the call site, the stream and the result all agree on, so a caller can switch from text to an object without a second call path, and a partial and a complete answer come from the same declarative place.
It also makes mode choice a caller decision rather than a provider branch, which is what keeps the loop free of vendor names.

What it costs: a second parse path beside the existing object generator, which the vercel dive records as the package's main coherence complaint (`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:76`); validation logic inside the spec rather than the loop; and an async `responseFormat` because the schema to JSON Schema conversion may be asynchronous.
The element stream is the least portable part: it pays only when a UI renders lists incrementally, and it can be added later without changing the other four members.

Does it fit behind our final-answer seam? Mostly yes, with one limit.
`GR-02` already validates a Zod schema inside the loop (`docs/research/competitors/_synthesis/00-our-baseline.md:66`), so an `OutputSpec<T>` should become the type of that seam: the complete parser replaces the inline schema check, and the partial parser feeds a new event.
Keep the element stream out of scope, keep prompting out of the spec, and do not move repair into the spec; repair is loop policy and belongs where the tool budget already lives.
One cost is easy to miss: a generic `Output<T>` narrows at the call site, so the run's result type must be inferred from the output object rather than from a second type parameter, or every caller ends up asserting it.

## 4. Usage and cost

| neighbour | tokens | money | basis and cap | evidence |
|---|---|---|---|---|
| vercel-ai-sdk | input split into total, no-cache, cache-read, cache-write; output split into total, text, reasoning | none | no price table, no budget | `packages/provider/src/language-model/v4/language-model-v4-usage.ts:6` |
| pydantic-ai | per request and per run, with lower-bound flags | optional decimal cost | preloaded price snapshot; limits check tokens, cost and request count before a request | `pydantic_ai_slim/pydantic_ai/usage.py:125`, `:156`, `:514` |
| claude-agent-sdk | per model, including subagents and cache writes | cumulative per call, with a basis field | basis distinguishes list prices, managed rates and a guess; cap checked after each response, so it can overshoot by one response | `sdk.d.ts:6031`, `:1486`; `clone:/docs/agent-loop.md:203` |
| mastra | judge calls metered like model calls | not recorded | no cost cap in the dive | `docs/research/competitors/mastra/02-features-inventory.md:71` |

Three facts separate a token count from an accounting layer. Money is derived, never reported by a provider, so it needs a price table with a date and a currency.
An unknown model must produce `undefined`, not zero, which pydantic states explicitly and claude's basis field encodes.
Cache reads change the arithmetic, so a usage type that cannot distinguish them forces every price table to be wrong in one direction.
The numbers themselves come from the provider's response, and the only trustworthy rule is to copy them without normalising: vercel's split exists because a normalised total loses the cache distinction, and no later arithmetic can recover it.

Our `OB-06` is absent with usage already carried in results (`docs/research/competitors/_synthesis/00-our-baseline.md:81`), so the smallest honest version is small:

1. Extend the usage type to the vercel split, `input: {total, noCache, cacheRead, cacheWrite}` and `output: {total, text, reasoning}`, all optional except totals.
2. Add `costUsd?: string` as a decimal string and `costBasis: 'table' | 'unknown'`; absence is unknown, and zero is zero usage.
3. Ship a price table as data: model id prefix, currency, effective date, input, output and cache-read rates; a missing prefix returns unknown rather than throwing.
4. Enforce a budget between steps, not mid-response, and document the overshoot as the vendors do; one response of slack is the honest bound.
5. Do not claim provider accuracy: the table is our estimate, and `costBasis` is how a caller sees that.

## 5. A recommended shape for us

| step | change | price |
|---|---|---|
| S1 | fill `ModelCapabilities` with four facts per adapter and export it; no loop change | S |
| S2 | add `OutputSpec<T>` and two factories, `textOutput()` and `objectOutput(schema)` | M |
| S3 | select the mode in one place from the facts plus caller policy; refuse silent prompt fallback | S |
| S4 | parse partials with one tolerant parser and emit one `output.partial` event | S |
| S5 | add the bounded repair loop with a budget separate from tool retries | M |
| S6 | extend the usage type and `RunResult` with the cache split and cost fields | M |
| S7 | add the price table and `estimateCost`; wire the budget check between steps | S |
| S8 | pin all of it with the tests listed below | M |

### Type changes

- `ModelCapabilities`: `structuredOutput: 'none' | 'prompt' | 'tool' | 'native'`, `streaming: boolean`, `images: boolean`, `cacheUsage: boolean`. Four fields, each with a default that preserves today's behaviour.
- `GenerateOptions.responseFormat?: ResponseFormat`, a small union that mirrors the provider spec's json and text variants.
- `OutputSpec<T>` beside the loop: `name`, `responseFormat`, `parseComplete(text, context)`, `parsePartial(text)`. Factories keep call sites from hand-building it.
- `ModelUsage` and `RunResult.usage` gain the split; `RunResult.costUsd?: string` plus `costBasis`.
- `StructuredOutputError` with `text`, `issues`, `attempts`, `usage`, `finishReason`.

### The parse path

1. At run start, resolve the facts for the selected model; if the caller asked for an object and the facts say `none`, fail before the first request.
2. Choose the request shape: native response format, a single synthetic tool, or a prompted schema only when the caller allowed it.
3. Accumulate text deltas; for each, run the tolerant parser and emit `output.partial` with the partial value and the byte offset.
4. On completion, parse and validate once; success ends the step, failure hands the raw text to the repair loop.

### The repair loop

1. Count the failure against the repair budget, not the tool budget, and stop at the cap.
2. Append the raw answer and one message holding the validator issues, then re-ask with the same schema and mode.
3. Skip repair when the finish reason is a length limit, when the schema is invalid, or when the caller disabled repair.
4. After the cap, raise `StructuredOutputError`; a run never ends with an unparsed answer reported as success.

### Tests that pin it

- A capability matrix: for each adapter, a fake transport asserts the request shape matches the declared fact, so an adapter cannot claim `native` and send a tool call.
- A partial-parse suite over every prefix of a fixture answer, asserting monotonic partials, no throw, and no validation of partials.
- A repair script: bad then good answer, asserting exactly two calls, then the same script with the cap reached and a typed error.
- A truncation case: a length-limited finish reason is not repaired and not retried.
- A cost table test: known model, cache split, unknown prefix, zero usage, and decimal arithmetic without float drift.
- One integration test at the final-answer seam: success, failure, and the refusal path when `structuredOutput` is `none`.

### What this does not cover

- Embeddings (`MD-06`), routing, fallback and rate limits (`MD-05`), and provider-specific options such as prompt caching (`MD-07`); the price table touches the last only by accident.
- Multimodal input (`MD-04`) and image output, which need their own capability facts and their own parse path.
- Scorers and judges (`OB-05`), which reuse the usage split but not the output spec.
- Mid-stream budget enforcement, which no vendor in this lane does and which would require a second accounting path inside the transport.

## Where the dives disagree

- Vercel leaves capability facts out of the spec, pydantic puts them in a profile, mastra generates a table. All three work; the mixture that fails is a caller-chosen mode over undeclared facts, because the failure then depends on which model the user picked.
- Mastra's second model call is defensible for weak models and wrong as a default: it doubles spend and adds a stochastic step to a deterministic task. If we ever add it, it should be an explicit factory, not a fallback.
- Pydantic's name-based profile resolution is the weakest link in its own design, and the file says so where it narrows a flag (`pydantic_ai_slim/pydantic_ai/profiles/__init__.py:121`); we already pass the adapter object, so we get the stronger version for free.
- Vercel reports no money and claude reports money with a basis. The difference is ownership: a gateway can price, a library cannot. We are a library, so we price from data and label the estimate.

## Confidence and gaps

Every row in sections 1 to 4 rests on a filed dive whose evidence column was read at line level, except the mastra router and structuring processor, which this brief added from the clone because the mastra dive had not covered them.
The capability facts of our five adapters were not re-read: the baseline records the shape, not the population, so S1 is sized as unknown work of type S rather than estimated.
The price table is a design sketch, not a source finding: no neighbour in this lane ships one that we could copy, and pydantic's snapshot is the nearest thing to a pattern.

## Open questions

1. Do our five adapters expose cache reads in their responses today? If not, S6 ships a field nothing fills, and the price table's cache rate stays unused until an adapter lands.
2. Is `output.partial` a new event kind or a flag on the existing model-delta event? The answer decides whether renderers need a new switch arm (`RT-09`).
3. Does the repair re-ask reuse the same tool-call transcript, or a compressed one? The transcript shape decides the token cost of a repair and belongs in the same design note as the compaction strategy.
4. Should a done-but-unparsed step still checkpoint? If yes, the repair budget must survive resume; if no, the checkpoint lands only after a successful parse.
5. Does the price table belong beside the adapters or in a separate package? The first keeps a model's facts and its price together; the second keeps a release of prices from forcing a release of the adapters.

Two ordering constraints close the lane: S1 before S2 because a mode cannot be chosen before facts exist, and S4 after S6 because a partial event without usage fields leaves the renderer guessing the cost of a stream.
Everything else can ship in any order, and S1 alone removes the largest single gap this lane contains.
