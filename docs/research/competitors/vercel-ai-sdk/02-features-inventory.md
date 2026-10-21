# vercel/ai — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## How to read the tables

Status is one of three strengths, used strictly.
`implemented` means source was read and the path was traced from entry point to effect; `declared` means a type, option or manifest claims the capability but no call path was followed; `inferred` means it was reasoned from structure and is said so.
Evidence is a path relative to the clone root plus a line or range; the read commit is fixed in `docs/research/competitors/vercel-ai-sdk/00-profile.md`.
Mechanism says how it is built, existence says why it is there.

## Model abstraction and the provider registry

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-01 | versioned model specification | implemented | `packages/provider/src/language-model/v4/language-model-v4.ts:8` | one interface per model type carrying `specificationVersion`, `provider`, `modelId`, `supportedUrls`, `doGenerate`, `doStream` | the core can call any model through one shape |
| F-02 | in-core version adapters | implemented | `packages/ai/src/model/as-language-model-v4.ts:1`, `packages/ai/src/model/resolve-model.ts:40` | V2 and V3 models are admitted and proxied up to V4, including prompt and stream conversion | providers and core can release independently |
| F-03 | single call-options object | implemented | `packages/provider/src/language-model/v4/language-model-v4-call-options.ts:66` | prompt, sampling, `responseFormat`, tools, `toolChoice`, `reasoning`, `providerOptions`, abort in one type | new options reach every provider without a new signature |
| F-04 | single stream-part vocabulary | implemented | `packages/provider/src/language-model/v4/language-model-v4-stream-part.ts:56` | about twenty part kinds including tool-input deltas, approval requests, raw chunks and errors | one stream type for every provider and every consumer |
| F-05 | unified finish reason and usage | implemented | `packages/provider/src/language-model/v4/language-model-v4-finish-reason.ts:1`, `packages/provider/src/language-model/v4/language-model-v4-usage.ts:1` | finish reason is `{unified, raw}`; usage splits input into total, no-cache, cache-read, cache-write and output into total, text, reasoning | accounting stays comparable across vendors |
| F-06 | typed provider registry | implemented | `packages/ai/src/registry/provider-registry.ts:89`, `:181`, `:306` | separator-joined `${provider}${sep}${model}` ids, one getter per model type, a register function that upgrades providers | one configuration string selects a model |
| F-07 | registry diagnostics and middleware | implemented | `packages/ai/src/registry/provider-registry.ts:295`, `:334` | unknown provider or model raises a typed error listing what is available; the registry applies a middleware chain to resolved models | failures are actionable, defaults stay central |
| F-08 | default and global provider | implemented | `packages/ai/src/model/resolve-model.ts:271`, `packages/ai/package.json:59` | a bare string id resolves through a global override, falling back to the gateway package | zero-configuration use is the default path |
| F-09 | gateway as a provider of providers | implemented | `packages/gateway/src/gateway-provider.ts:76` | the gateway implements `ProviderV4` for every model type and is itself callable as a factory | one credential fronts many upstream vendors |
| F-10 | package per provider | implemented | `pnpm-workspace.yaml:3` | 82 `@ai-sdk/*` packages, about 45 of them vendor adapters | vendor churn stays outside the core package |

The registry and the specification are the two halves of the model story.
The specification fixes what a provider must do; the registry fixes how a caller names one without importing it.
The version adapters sit between them, and are the least obvious piece: a provider package released against V3 keeps working because the core upgrades it at the call boundary rather than asking the vendor to ship a new release.

## Tool calling while streaming

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-11 | function tool specification | implemented | `packages/provider/src/language-model/v4/language-model-v4-function-tool.ts:1` | name, description, `inputSchema` as JSON Schema, input examples, strict flag, provider options | a tool travels as data, not code |
| F-12 | provider-hosted tools | declared | `packages/provider/src/language-model/v4/language-model-v4-call-options.ts:96` | the tools field is a union of function tools and provider tool declarations | server-side tools ride the same call |
| F-13 | streamed tool input | implemented | `packages/provider/src/language-model/v4/language-model-v4-stream-part.ts:56` | start, delta and end parts with a JSON-or-text input encoding | a UI can render arguments before the call completes |
| F-14 | schema parsing of tool calls | implemented | `packages/ai/src/generate-text/parse-tool-call.ts:226` | parse JSON, validate against the tool schema, treat empty input as an empty object | untyped model output becomes a typed call |
| F-15 | repair hook for broken calls | implemented | `packages/ai/src/generate-text/parse-tool-call.ts:59` | caller function receives the call, schema accessor, messages and error, and may return a replacement | a recovering model can be helped without failing the run |
| F-16 | invalid calls preserved | implemented | `packages/ai/src/generate-text/parse-tool-call.ts:112` | an unrepaired call becomes a dynamic, invalid part carrying the original error | a bad call is data a caller can show, not an exception |
| F-17 | buffered execution at turn end | implemented | `packages/ai/src/generate-text/execute-tools-from-stream.ts:114`, `:227` | calls are collected while streaming and executed when the model turn finishes | token flow is never blocked by a tool |
| F-18 | bounded tool concurrency | implemented | `packages/ai/src/generate-text/execute-tools-from-stream.ts:232` | a concurrency-limited map over buffered calls | parallel tools do not stampede |
| F-19 | four-state approval policy | implemented | `packages/ai/src/generate-text/tool-approval-configuration.ts:27` | not-applicable, approved, denied, user-approval, each optionally with a reason, selected by a generic or per-tool function | approval policy is configuration at the tool boundary |
| F-20 | approval as stream traffic | implemented | `packages/ai/src/generate-text/execute-tools-from-stream.ts:148` | approval request and response parts are emitted; a denial also emits a denied-output part | a client can approve mid-stream and the model sees the refusal |
| F-21 | signed approvals | implemented | `packages/ai/src/generate-text/tool-approval-signature.ts:27` | HMAC-SHA256 over a versioned payload of approval id, call id, tool name and canonical input digest | an approval can round-trip through an untrusted client |
| F-22 | preliminary tool output | implemented | `packages/ai/src/generate-text/execute-tool-call.ts:145` | a tool may yield preview parts; each is emitted as a preliminary tool result before the final one | long-running tools can show progress |
| F-23 | tool failure as a value | implemented | `packages/ai/src/generate-text/execute-tool-call.ts:162` | a thrown execute is converted to a `tool-error` part with the original error | one tool cannot kill the step |
| F-24 | per-tool timeout | implemented | `packages/ai/src/prompt/request-options.ts:89` | tool-level milliseconds merged into the abort signal handed to execute | a hung tool is bounded |
| F-25 | tool-choice enforcement | implemented | `packages/ai/src/generate-text/stream-language-model-call.ts:657` | after finish, a required or named tool that never appeared raises a typed violation and an error finish | a required-tool contract is checked, not assumed |
| F-26 | deferred provider tool results | implemented | `packages/ai/src/generate-text/stream-text.ts:3178` | provider-executed calls that support deferred results keep the loop open until their result arrives | server tools that call client tools can pause a run |
| F-27 | per-step tool selection | implemented | `packages/ai/src/generate-text/stream-text.ts:2463`, `packages/ai/src/generate-text/prepare-step.ts:124` | `activeTools` filters the set for one step and `prepareStep` may change it | step-specific tool policies are expressible |
| F-28 | tool ordering for provider caching | declared | `packages/ai/src/generate-text/stream-text.ts:555` | a `toolOrder` option exists and is documented as affecting the sent order | stable prefixes are worth tokens to cache-mode providers |
| F-29 | input examples on tools | declared | `packages/ai/src/middleware/add-tool-input-examples-middleware.ts:1` | a middleware can attach examples to tools before the call | improves argument quality without changing schemas |

The tool pipeline splits what many implementations fuse: the stream produces calls, a separate transform executes them, and approval is a value in between.
That split is what makes approval, denial, signature and preliminary output possible without special cases in the transport.

## Structured output

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-30 | provider JSON response format | implemented | `packages/ai/src/generate-object/generate-object.ts:409` | one `doGenerate` with a json response format carrying schema, name and description | structured output is a provider capability, not a prompt trick |
| F-31 | typed parse failure | implemented | `packages/ai/src/generate-object/parse-and-validate-object-result.ts:21` | parse, then validate against the strategy, then raise an error carrying text, usage and finish reason | failure is diagnosable without re-reading the response |
| F-32 | text repair hook | implemented | `packages/ai/src/generate-object/parse-and-validate-object-result.ts:77` | a caller function may rewrite the text once before a second parse and validation | a near-miss object can be salvaged |
| F-33 | output strategies | implemented | `packages/ai/src/generate-object/output-strategy.ts:403` | object, array, enum and no-schema, each with a partial validator and an optional element stream | one entry point serves four output shapes |
| F-34 | Output specification for text functions | implemented | `packages/ai/src/generate-text/output.ts:23` | text, object, array, choice and json, each exposing `responseFormat`, a complete parser and a partial parser | structured output unified with text generation |
| F-35 | partial object streaming | implemented | `packages/ai/src/generate-text/output.ts:163` | each text delta is fed to a partial JSON parser; partials are not schema-validated | a UI can render an object as it materialises |
| F-36 | element streams | implemented | `packages/ai/src/generate-text/stream-text.ts:3581` | the specification may supply an element-stream transform, consumed through the result object | list-shaped UI updates per completed element |
| F-37 | constrained choice output | implemented | `packages/ai/src/generate-object/output-strategy.ts:347` | the enum strategy prefix-matches an object field called `result` | a choice can stream before it is unambiguous |
| F-38 | prompt-level JSON instruction helper | declared | `packages/ai/src/generate-object/inject-json-instruction.ts:8` | a schema-appending prompt helper, exported and unit-tested, with no production call site | a leftover from the pre-response-format strategy |

Two implementation paths remain, and that is the main coherence complaint in this package: `generateObject` owns one path, the text functions own another, and the older prompt-injection helper is still exported with nothing calling it.

## UI message stream protocol

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-39 | schema-validated chunk protocol | implemented | `packages/ai/src/ui-message-stream/ui-message-chunks.ts:24` | a zod union for validation and a TypeScript union for typing, with loose objects so extra fields survive | the wire format is checkable at the boundary |
| F-40 | full chunk vocabulary | implemented | `packages/ai/src/ui-message-stream/ui-message-chunks.ts:235` | text, reasoning, tool input and output, approval, source, file, custom data, step boundaries, start, finish, abort, metadata | every renderable event has a named chunk |
| F-41 | part-to-chunk mapping with error masking | implemented | `packages/ai/src/ui-message-stream/to-ui-message-chunk.ts:1` | internal parts map to chunks; errors pass through an `onError` string mapper | server details do not leak by default |
| F-42 | server stream factory | implemented | `packages/ai/src/ui-message-stream/create-ui-message-stream.ts:29` | an execute callback receives a writer with write, merge and outcome methods; merged streams are awaited before close | callers inject custom chunks and forward callback streams |
| F-43 | SSE framing with keep-alive | implemented | `packages/ai/src/ui-message-stream/create-sse-stream-with-keep-alive.ts:4` | JSON lines become SSE events, with open and keep-alive comments gated on downstream demand | proxies keep long streams open |
| F-44 | response helpers, web and node | implemented | `packages/ai/src/ui-message-stream/create-ui-message-stream-response.ts:21`, `packages/ai/src/ui-message-stream/pipe-ui-message-stream-to-response.ts:23` | shared headers, optional tee for server-side consumption, byte encoding | the same stream serves two server runtimes |
| F-45 | finish handler as persistence seam | implemented | `packages/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts:15` | reconstructs the assistant message, injects the id, calls step and end callbacks with outcome, abort and continuation flags | a caller persists messages without owning the stream |
| F-46 | one client reducer | implemented | `packages/ai/src/ui/process-ui-message-stream.ts:491` | chunks update message parts, tool states, step boundaries and metadata | chat and reader share one interpretation |
| F-47 | snapshot reader | implemented | `packages/ai/src/ui-message-stream/read-ui-message-stream.ts:55` | structured clones per write, with text stashed to avoid quadratic copying | a renderer can consume whole-message snapshots |
| F-48 | framework-free chat state machine | implemented | `packages/ai/src/ui/chat.ts:366`, `:507`, `:545`, `:586` | send, regenerate, resume and approval methods over messages, status and error | UI logic is testable without React |
| F-49 | pluggable transports | implemented | `packages/ai/src/ui/http-chat-transport.ts:129` | an abstract HTTP transport with request preparation hooks, plus direct and text-stream variants | a host can change the endpoint without touching state |
| F-50 | tool invocation state machine | implemented | `packages/ai/src/ui/ui-messages.ts:288` | six states from input-streaming through approval states to output-available, output-error, output-denied, with raw input retained for resumption | a UI renders one typed state, not a bag of flags |

The protocol is the most reusable idea in the repository: producers emit chunks, one reducer interprets them, and the transport is replaceable.
The keep-alive and resume details are operational evidence that it has been run behind real proxies and reconnecting clients.

## Middleware

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-51 | model middleware contract | implemented | `packages/provider/src/language-model-middleware/v4/language-model-v4-middleware.ts:1` | parameter transform, provider and model identity overrides, URL overrides, generate and stream wrappers | cross-cutting behaviour composes around a model |
| F-52 | deterministic composition order | implemented | `packages/ai/src/middleware/wrap-language-model.ts:44` | the array is reversed then reduced, so the first entry transforms input first and the last wraps the model | order is a contract, not an accident |
| F-53 | shipped middleware set | declared | `packages/ai/src/middleware/default-settings-middleware.ts:1` | default settings, default instructions, JSON and reasoning extraction, simulated streaming, tool input examples, provider wrapping | defaults are middleware instead of call flags |
| F-54 | provider-level wrapping | declared | `packages/ai/src/middleware/wrap-provider.ts:1` | a provider can be wrapped so every model it constructs is decorated | instrumentation applies to a whole vendor |

## Operations

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-55 | retry with a default of two | implemented | `packages/ai/src/util/prepare-retries.ts:44` | validated retry count, exponential backoff, abort-aware | transient provider failures do not surface |
| F-56 | retry-after honouring | implemented | `packages/ai/src/util/retry-with-exponential-backoff.ts:28` | retry-after-ms then retry-after headers are parsed and clamped to a sane window | rate limits are respected instead of hammered |
| F-57 | mid-stream retry | implemented | `packages/ai/src/generate-text/stream-text.ts:2601` | buffered parts are replayed after a retry, with an attempt-boundary part marking the seam | a broken stream does not lose emitted text |
| F-58 | timeout ladder | implemented | `packages/ai/src/prompt/request-options.ts:13` | total, step, first-chunk, inter-chunk and tool timeouts | each failure mode has its own bound |
| F-59 | low-memory stream mode | implemented | `packages/ai/src/generate-text/stream-text.ts:390` | retention is decided before execution: replay-buffered or single-consumer | serverless runs can skip buffering |
| F-60 | per-call performance metrics | implemented | `packages/ai/src/generate-text/stream-language-model-call.ts:609` | time to first output, output and total tokens per second, inter-chunk statistics | operational data comes from the normal path |
| F-61 | telemetry dispatcher and tracing channels | implemented | `packages/ai/src/telemetry/telemetry.ts:1` | call, step and tool events plus a tracing-channel publisher, with an OpenTelemetry package alongside | observability without a hard exporter dependency |
| F-62 | typed error classes | implemented | `clone:/AGENTS.md:172` | `AI_` names, a `vercel.ai.error.*` symbol marker and static `isInstance`, one file per failure mode | callers branch on cause, not on message text |
| F-63 | stop conditions | implemented | `packages/ai/src/generate-text/stop-condition.ts:27` | `isStepCount`, `hasToolCall`, `isLoopFinished` and a caller predicate, OR-ed together | loop length is caller policy |
| F-64 | per-step preparation hook | implemented | `packages/ai/src/generate-text/prepare-step.ts:34` | receives steps, messages, instructions, context and may return model, tools, messages, settings or provider options | agent policies can vary per step |
| F-65 | abort propagation | implemented | `packages/ai/src/generate-text/stream-text.ts:2400` | abort signal is watched, step timers cleared, an abort part emitted | cancellation is observable downstream |

## Adjacent packages

| id | capability | status | evidence | mechanism | why it exists |
|---|---|---|---|---|---|
| F-66 | MCP client package | declared | `packages/mcp/src/index.ts:1` | a separate workspace package for MCP, with dynamic tools and provider-executed calls in the spec | external tool servers integrate without core changes |
| F-67 | sandbox packages and a sandbox-aware tool call | implemented | `packages/ai/src/generate-text/execute-tool-call.ts:133` | a sandbox session is passed into tool execution; sandbox implementations ship as separate packages | tools that need execution context can receive one |
| F-68 | harness adapter packages | inferred | `packages/harness/package.json:1` | a family of packages named after coding agents | the protocol is being applied to agent runtimes, not only models |
| F-69 | devtools, TUI and OpenTelemetry packages | inferred | `packages/devtools/package.json:1` | separate packages exist for a debugger UI, a terminal UI and OTel | the platform is broader than the core library |

## Notable implementation notes

- Every model type is treated symmetrically: the registry, the resolution helper and the version adapters are repeated per type rather than special-cased (`packages/ai/src/registry/provider-registry.ts:89`).
- Stream parts are the internal currency of the loop; the UI protocol is a second, deliberately narrower vocabulary derived from them (`packages/ai/src/ui-message-stream/to-ui-message-chunk.ts:1`).
- The step loop is written as recursion inside a transform, not as a for-loop over awaited calls, which is what allows it to be one stream (`packages/ai/src/generate-text/stream-text.ts:3231`).
- Usage accounting is cache-aware at the spec level, so prompt-cache savings are visible without provider-specific fields (`packages/provider/src/language-model/v4/language-model-v4-usage.ts:1`).
- `experimental_` prefixes mark unstable surface but the deprecated aliases are kept indefinitely; both spellings often exist for one option (`packages/ai/src/generate-text/stream-text.ts:629`).
- Callbacks come in families: on start, on step start, on step end, on finish, per tool, and the UI layer adds step and end callbacks with outcome flags (`packages/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts:150`).
- Error masking is a default, not an opt-in: both the stream mapper and the factory default `onError` to a generic string (`packages/ai/src/ui-message-stream/create-ui-message-stream.ts:31`).
- The provider spec package stays dependency-light on purpose (`packages/provider/package.json:34`), so adapters can import it without dragging in core.
- A provider-neutral core is preserved by three rules visible in imports: core depends only on the spec packages, adapters depend only on the spec and utilities, and the gateway is just another adapter (`packages/ai/package.json:58`).
- Structured output is the least unified area: a provider-format path, an Output-spec path and a dead prompt helper coexist (`packages/ai/src/generate-object/generate-object.ts:409`, `packages/ai/src/generate-text/output.ts:23`, `packages/ai/src/generate-object/inject-json-instruction.ts:8`).

## Capabilities deliberately absent from the inventory

Four things a reader may expect are absent because no source path supports them.

- No durable run store, checkpoint format or resume-across-process mechanism exists in the core; persistence is a callback contract only.
- No guardrail, moderation or prompt-injection filter ships in the core; the nearest policy mechanisms are tool approval and tool choice.
- No dataset, scorer or regression harness ships; evaluation is left to the caller.
- No CLI product ships in this repository; the terminal-facing package is a TUI library, not a runnable agent command.
