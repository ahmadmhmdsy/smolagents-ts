# vercel/ai — gaps and lessons

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Buckets and prices

Bucket letters, effort prices and the baseline row ids follow `docs/research/competitors/_synthesis/00-our-baseline.md`; the definitions are not restated here.
Read `Matching means` as the smallest honest description of what closing the row would give us, and `Seam` as the row id a change would land behind.

## Bucket C — absent from our vocabulary

These are the rows worth arguing about, because nothing in our baseline names them.

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| C-1 | version the model interface and admit older providers through an in-core upgrade adapter (`packages/ai/src/model/as-language-model-v4.ts:1`) | `MD-01`, `MD-02` | one interface version plus a compatibility shim, so adapters and core release on different clocks | adapter contract in `packages/models` | L |
| C-2 | a registry over typed `${provider}:${model}` ids with per-model getters and actionable errors (`packages/ai/src/registry/provider-registry.ts:89`) | `MD-01` | model selection by configuration string instead of by constructing a class | `packages/models` factory | M |
| C-3 | middleware around the model call, not around the agent step (`packages/provider/src/language-model-middleware/v4/language-model-v4-middleware.ts:1`) | `RT-08` | a second, inner seam for retries, defaults and instrumentation | model call site in `packages/core` | M |
| C-4 | approval as a portable, signed protocol value rather than a gate function (`packages/ai/src/generate-text/tool-approval-signature.ts:27`) | `HL-01`, `HL-02` | an approval that can be serialized, sent to a human, and returned without forgery | approval seam in `packages/core` | L |
| C-5 | an output specification object carrying the response format and both parsers (`packages/ai/src/generate-text/output.ts:23`) | `GR-02`, `GR-05` | one typed target the loop can ask the provider for and stream partially | final-answer validation in `packages/core` | M |
| C-6 | decide stream retention before execution: replay-buffered or single-consumer (`packages/ai/src/generate-text/stream-text.ts:390`) | `RT-04` | a run that can run in a memory-constrained host without buffering the whole transcript | stream plumbing in `packages/core` | M |

## Bucket A — roadmap follow-on

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| A-1 | ask the provider for JSON through `responseFormat` instead of only validating the text afterwards (`packages/ai/src/generate-object/generate-object.ts:409`) | `GR-05` | the declared `ModelCapabilities.structuredOutput` flag finally being set and used | capability seam in `packages/models` | M |
| A-2 | a repair hook that rewrites malformed output once and revalidates (`packages/ai/src/generate-object/parse-and-validate-object-result.ts:77`) | `GR-06` | a failed schema match becomes a repair attempt rather than a failed run | validation seam in `packages/core` | S |
| A-3 | a provider router with a hosted fallback and published spend reporting (`packages/gateway/src/gateway-provider.ts:76`) | `MD-05` | routing, fallback and rate limiting as a model-layer policy | `packages/models` adapter interface | L |
| A-4 | provider-specific options and ordering that make prompt caching reachable (`packages/ai/src/generate-text/stream-text.ts:555`) | `MD-07` | cache-aware prompts without widening our generic options with vendor fields | `GenerateOptions` in `packages/models` | M |
| A-5 | tools that emit preliminary output parts before their final result (`packages/ai/src/generate-text/execute-tool-call.ts:145`) | `TL-04` | generator tools that stream progress into the run's events | `execute` contract in `packages/core` | M |
| A-6 | a telemetry dispatcher plus a tracing-channel publisher (`packages/ai/src/telemetry/telemetry.ts:1`) | `OB-02`, `OB-07` | span export without core learning about any backend | `TraceSpan` in `packages/core` | M |
| A-7 | per-step tool filtering and a preparation hook that may swap model, tools or instructions (`packages/ai/src/generate-text/prepare-step.ts:34`) | `TL-06` | an agent that changes its toolset or model between steps | step loop in `packages/core` | S |
| A-8 | text arrives as deltas that a client can render without re-reading a transcript (`packages/ai/src/ui-message-stream/ui-message-chunks.ts:235`) | `UI-05` | leaf text rendered token by token rather than snapshot by snapshot | `AgentSession` and primitives in `packages/react` | M |
| A-9 | cost and spend data surfaced next to usage, though theirs comes from the hosted gateway rather than a local price table (`packages/gateway/src/gateway-provider.ts:106`) | `OB-06` | per-step cost attribution from usage and a caller-supplied price table | monitor in `packages/core` | S |

## Bucket D — depth gaps

| id | what they do | our row | matching means | seam | price |
|---|---|---|---|---|---|
| D-1 | retries, a timeout ladder, mid-stream replay and a tee fan-out around one call (`packages/ai/src/generate-text/stream-text.ts:2601`) | `RT-04` | streaming that survives transient failures and feeds several consumers | run event stream in `packages/core` | L |
| D-2 | a typed full-stream vocabulary that the UI protocol is derived from (`packages/ai/src/ui-message-stream/to-ui-message-chunk.ts:1`) | `RT-09` | one event vocabulary with a documented mapping to renderable chunks | `packages/core/src/events.ts` in `packages/core` | M |
| D-3 | per-call throughput, time to first output and inter-chunk statistics (`packages/ai/src/generate-text/stream-language-model-call.ts:609`) | `RT-11` | the monitor reporting latency and speed, not only tokens | monitor in `packages/core` | S |
| D-4 | four approval statuses with reasons, plus a denial that becomes a tool output (`packages/ai/src/generate-text/tool-approval-configuration.ts:27`) | `HL-01` | a gate that can explain itself and can refuse without throwing | approval seam in `packages/core` | S |
| D-5 | timeouts per tool, merged with the run's abort signal (`packages/ai/src/prompt/request-options.ts:89`) | `TL-05` | one slow tool cannot consume the run budget | tool execution in `packages/core` | S |
| D-6 | validation failures that carry the text, usage and finish reason, with a typed error class (`packages/ai/src/generate-object/parse-and-validate-object-result.ts:21`) | `GR-02` | a failed final answer is diagnosable from the run result alone | validation in `packages/core` | S |
| D-7 | a result object exposing steps, response messages, warnings and per-step usage as awaitable views (`packages/ai/src/generate-text/stream-text.ts:3343`) | `RT-13` | a run result that supports a next turn without re-deriving state | `RunResult` in `packages/core` | S |

## Bucket B — non-goals

| id | what they do | our row | what matching would cost us | seam | price |
|---|---|---|---|---|---|
| B-1 | a documented chat transport protocol between server and client, with SSE framing and resumption (`packages/ai/src/ui/http-chat-transport.ts:129`) | `UI-06` | decision 0018 keeps a transport protocol out; we would own a wire format | none | L |
| B-2 | chunks rich enough to drive generative UI and custom data parts (`packages/ai/src/ui-message-stream/ui-message-chunks.ts:177`) | `UI-07` | decision 0018 keeps generative UI out | none | L |
| B-3 | filesystem and shell tooling shipped as packages next to the model layer (`packages/tool-bash/package.json:1`) | `EX-05` | decision 0018 keeps a workspace surface out | none | M |

## What we have that they lack

- A code-as-action loop: the model writes a program that an executor runs, which is `RT-01` and has no counterpart here.
- An executor layer with declared capability bags and enforced network policy, our `EX-04` and `EX-06`.
- A checkpointed run store and a session snapshot that survives a process, our `HL-03`, `HL-04` and `RT-14`.
- A guardrail layer that halts a run with a typed reason, our `GR-01` and `GR-02`.
- A packaged release gate: eleven stages, pack smoke, synchronized version identity and published-artifact checks (`DS-02`, `DS-03`, `DS-04`).
- An evaluation harness for completed runs, our `OB-04`, and a CLI with a verbosity-aware renderer, `CL-01` and `CL-02`.

## Patterns worth copying

1. Version the contract and adapt at the boundary. Their `specificationVersion` plus proxy upgrade is the reason a large adapter fleet did not freeze the core.
2. Make the stream part union the internal currency, then derive a narrower UI vocabulary from it. One internal shape, one wire shape, an explicit mapping between them.
3. Write the middleware order down as a rule and implement it in one function: reverse, reduce, first in transforms first, last wraps the model.
4. Model structured output as an object with a response format and two parsers, complete and partial. That single move makes typed streaming ordinary.
5. Send approval through the stream with an id and an optional signature. A human decision becomes a value the next prompt can include.
6. Type the registry key and put the middleware chain at the registry, not only at the model. Defaults then apply without every call site opting in.

## Patterns to avoid

1. A 3,737-line module for one function (`packages/ai/src/generate-text/stream-text.ts:376`) holding the loop, retries, timeouts, transforms, result views and UI bridging. It is the file every change touches.
2. Two live structured-output paths and a third, orphaned prompt helper (`packages/ai/src/generate-object/inject-json-instruction.ts:8`). Readers cannot tell which is canonical.
3. Alias sprawl: `experimental_` names, `onFinish` versus `onEnd`, `system` versus `instructions`, each kept indefinitely. The public surface doubles and deprecation never ends.
4. Making a hosted service the default target for an unqualified model id (`packages/ai/src/model/resolve-model.ts:271`). Convenient, and it couples library defaults to a vendor account.
5. Eighty-two packages on one release train. The blast radius of a shared dependency or a lockfile change is the whole repository.

## What it should change for us

- Put an explicit specification version on the `packages/models` adapter contract and upgrade old adapters inside the core (C-1). This is the highest-leverage structural idea in the read.
- Add a tool-approval protocol with ids, reasons and an optional signature, and make a pending approval a serializable value (C-4, `HL-02`).
- Introduce an output specification with a response format and a partial parser, then route `GR-02` and `GR-05` through it (C-5, A-1).
- Give the step loop a preparation hook and per-step tool filtering behind the `RT-08` and `TL-02` seams (A-7).
- Move retry and the timeout ladder onto the model call rather than the run, and let a stream replay buffered parts after a retry (D-1).
- Emit model text as deltas from the adapter so the session can forward them without buffering the transcript (A-8).

## Reading the buckets together

Three shapes recur and are worth naming before the rows are used.

First, their advantage is structural rather than feature-shaped: the specification, the registry and the middleware chain are three ways of letting one core serve many vendors, and most of the rows above are consequences of that decision.
Second, their operational depth sits on the model call, not on the agent run. Retries, timeouts, replay, usage and metrics are all properties of one model turn, which is a smaller unit than our step.
Third, their weakest areas are the ones we lead: durability, evaluation, guardrails and a terminal product are either absent or delegated to a caller, and their answer to a long-lived conversation is a client-side chat object rather than a store.

A practical consequence follows. Copying a single row such as the approval protocol without the registry and middleware seams would add surface without reducing coupling; the structural rows (C-1, C-2, C-3) are worth doing first because they make the others cheap.

## Limits on these rows

- The clone is shallow, so no row here relies on changelogs, issue history or release notes.
- No vendor adapter source was read, so rows describing provider behaviour are about the specification, not about what one API actually does.
- Their hosted gateway is a service; the rows mentioning routing and spend describe request construction and reported metadata, not billing behaviour.
- Rows marked with our baseline ids inherit that file's status wording; this dive does not re-adjudicate those rows.
Nothing in this file should be read as a proposal to copy a vendor-specific mechanism; every row is about a seam, not a feature.

## Two further patterns worth copying

1. Keep approval machinery out of the transport. Their denial is a stream part, not an HTTP status, so the same decision works over SSE, a direct stream or a test harness.
2. Give the result object lazy views instead of one big payload: steps, usage, warnings and messages are each promised and each consumes the single stream. A caller takes only what it needs.

## Two further patterns to avoid

1. Repeating the same shape per model type by hand. The symmetry is good; the copy-paste is why `packages/ai/src/registry/provider-registry.ts` is 496 lines and a new model type touches several files.
2. Keeping prompt-level JSON instructions after the provider-format path landed. The dead helper is small, but it lets a future reader implement the wrong strategy with an exported function that looks supported.
