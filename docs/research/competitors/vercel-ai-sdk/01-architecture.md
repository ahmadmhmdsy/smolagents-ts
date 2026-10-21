# vercel/ai — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

| path | contents |
|---|---|
| `packages/provider/` | the specification package: model interfaces, stream parts, prompt shapes, middleware interfaces, error base classes. One runtime dependency (`packages/provider/package.json:34`) |
| `packages/provider-utils/` | shared implementation used by both core and adapters: message types, tool definition helpers, schema conversion, retry, ID and response handlers |
| `packages/ai/` | the application package `ai`: text, object, embed, image, speech, transcription, reranking, video, middleware, registry, UI streaming. 605 source files (`packages/ai/src`) |
| `packages/gateway/` | a provider of providers, implementing `ProviderV4` for every model type (`packages/gateway/src/gateway-provider.ts:76`) |
| about 45 `packages/<vendor>/` | one package per vendor or API family: `openai`, `anthropic`, `google`, `amazon-bedrock`, `azure`, `mistral`, `groq`, `deepseek`, `xai`, `openai-compatible`, and others |
| `packages/react/`, `vue/`, `svelte/`, `angular/`, `rsc/` | framework bindings over the UI message protocol |
| `packages/mcp/`, `sandbox-*`, `tool-bash/`, `harness*`, `tui/`, `devtools/`, `otel/` | adjacent capability packages: MCP client, sandboxes, harness adapters, terminal UI, observability |
| `architecture/` | six short design notes, including provider abstraction, message layers and loop control |
| `content/` | 546 documentation pages, the source of the published docs site |
| `examples/` | 25 runnable example workspaces, one per integration or feature |
| `contributing/decisions/` | a decision-record procedure plus a single adoption record; the file count is two, so this is not a rich ADR corpus |
| `apps/` | internal apps such as the docs site and devtools |

## The four layers

The published architecture note names the pattern `clone:/architecture/provider-abstraction.md:1`: AI functions call a model specification, and provider implementations satisfy that specification.

| layer | who owns it | what crosses the boundary |
|---|---|---|
| AI functions | `packages/ai/src` | user-facing prompts, tools, callbacks |
| model specification | `packages/provider/src` | call options, stream parts, result shapes |
| provider utilities | `packages/provider-utils/src` | shared parsing, schemas, retry, HTTP helpers |
| adapters | `packages/<vendor>/src` | vendor wire format |

Two consequences are visible in the type system rather than the prose.
The core never imports a vendor package: `ai` depends on gateway, provider and provider-utils only (`packages/ai/package.json:58`).
And every model type repeats the same interface shape, so language, embedding, image, speech, transcription, reranking, decision and video models are siblings rather than special cases (`packages/provider/src`).

## Core abstractions

| abstraction | pointer | shape and role |
|---|---|---|
| `LanguageModelV4` | `packages/provider/src/language-model/v4/language-model-v4.ts:8` | `specificationVersion`, `provider`, `modelId`, `supportedUrls`, `doGenerate`, `doStream` |
| `LanguageModelV4CallOptions` | `packages/provider/src/language-model/v4/language-model-v4-call-options.ts:66` | one options object: prompt, sampling, `responseFormat`, tools, `toolChoice`, `reasoning`, `providerOptions`, abort |
| stream part union | `packages/provider/src/language-model/v4/language-model-v4-stream-part.ts:56` | text, reasoning, tool input deltas, tool call, tool result, approval request, file, source, finish, error |
| `ProviderV4` plus adapters | `packages/ai/src/model/as-language-model-v4.ts:1` | version admission: a V2 or V3 model is proxied up to V4 at the call boundary |
| model resolution | `packages/ai/src/model/resolve-model.ts:35` | a string id, or a model object, resolved to a V4 model; unknown versions raise a typed error |
| provider registry | `packages/ai/src/registry/provider-registry.ts:89` | typed `${provider}${separator}${model}` ids, per-model-type getters, provider-level middleware |
| middleware | `packages/provider/src/language-model-middleware/v4/language-model-v4-middleware.ts:1` | `transformParams`, identity overrides, `wrapGenerate`, `wrapStream` |
| tool definition | `packages/provider/src/language-model/v4/language-model-v4-function-tool.ts:1` | name, description, JSON Schema, input examples, strict flag, provider options |
| Output specification | `packages/ai/src/generate-text/output.ts:23` | `responseFormat` plus complete and partial parsers for text, object, array, choice, json |
| UI chunk protocol | `packages/ai/src/ui-message-stream/ui-message-chunks.ts:24` | schema and type union for about 30 chunk types consumed by clients |
| UI message parts | `packages/ai/src/ui/ui-messages.ts:78` | the rendered conversation model, including a six-state tool invocation |

## One run, end to end

The walk below follows `streamText`, because it carries every mechanism; `generateText` reuses the same prompt preparation, tool preparation, stop conditions and tool execution modules (`packages/ai/src/generate-text/generate-text.ts:26`, `:67`, `:100`).

1. A caller passes a model, prompt, tools and settings; `streamText` forwards into `streamTextInternal`, where `stopWhen` defaults to `isStepCount(1)` (`packages/ai/src/generate-text/stream-text.ts:448`).
2. The model is resolved per step, not once per call, so a step override can swap it (`packages/ai/src/generate-text/stream-text.ts:2458`, `packages/ai/src/generate-text/prepare-step.ts:111`).
3. The prompt is standardised and converted to language-model messages; URL files are downloaded when the model does not support the URL form (`packages/ai/src/generate-text/stream-language-model-call.ts:298`).
4. Tools are prepared into the spec shape, tool choice is normalised, and external tool callers and tool search contribute optional extras (`packages/ai/src/generate-text/stream-text.ts:2467`, `:2495`).
5. A retry wrapper is constructed with `maxRetries` defaulting to 2 (`packages/ai/src/generate-text/stream-text.ts:2522`, `packages/ai/src/util/prepare-retries.ts:44`).
6. The adapter's `doStream` returns a stream of provider-neutral stream parts (`packages/provider/src/language-model/v4/language-model-v4.ts:58`).
7. A transform maps those parts into internal parts: text and reasoning are upserted by part id, tool calls are parsed, provider-executed tool results are folded in, metadata is captured (`packages/ai/src/generate-text/stream-language-model-call.ts:401`, `:704`, `:773`, `:837`).
8. A finish part becomes `model-call-end`, carrying unified finish reason, cache-aware usage and per-call performance statistics (`packages/ai/src/generate-text/stream-language-model-call.ts:606`).
9. Tool choice is enforced after the fact: a required or named tool that never appeared produces `ToolChoiceViolationError` and an error finish reason (`packages/ai/src/generate-text/stream-language-model-call.ts:657`).
10. A tool executor transform sees tool calls first, buffers them, and only executes at `model-call-end` (`packages/ai/src/generate-text/execute-tools-from-stream.ts:114`, `:227`).
11. For each buffered call the executor resolves approval, emits approval parts, and runs the tool with a concurrency limit, forwarding preliminary outputs as they arrive (`packages/ai/src/generate-text/execute-tools-from-stream.ts:232`, `packages/ai/src/generate-text/execute-tool-call.ts:145`).
12. Step content is materialised, usage is added to the running total, and step callbacks fire (`packages/ai/src/generate-text/stream-text.ts:3160`).
13. The loop continues only when every client tool call has a result or a denial, there is work to feed back, and no stop condition is met (`packages/ai/src/generate-text/stream-text.ts:3217`).
14. Continuation recurses into `streamStep` with an incremented index rather than iterating in a plain loop (`packages/ai/src/generate-text/stream-text.ts:3231`).
15. Termination enqueues one `finish` part and closes the stitchable stream (`packages/ai/src/generate-text/stream-text.ts:3247`).
16. User-visible streams are teed from the same source: text, full, partial output, element stream, UI message stream, consumption (`clone:/architecture/stream-text-loop-control.md:1`; `packages/ai/src/generate-text/stream-text.ts:3547`).
17. Result getters such as `steps`, `usage` and `finishReason` consume the stream lazily when replay buffering is enabled (`packages/ai/src/generate-text/stream-text.ts:3297`).
18. `toUIMessageStream` maps internal parts to UI chunks, injects the message id, and wraps the stream with the finish handler before any transport sees it (`packages/ai/src/ui-message-stream/to-ui-message-stream.ts:19`).

## Prompt and message layers

| layer | owner | pointer |
|---|---|---|
| UI messages | `ai` | `packages/ai/src/ui/ui-messages.ts:78` |
| model messages | `provider-utils` | `packages/provider-utils/src/types/model-message.ts:10` |
| language-model messages | `provider` | `packages/provider/src/language-model/v4/language-model-v4-prompt.ts:18` |
| vendor wire messages | adapter | per-package |

The four layers are deliberate (`clone:/architecture/message-layers.md:1`): the user-facing message shape can change without touching the spec, and the spec can change without touching vendors.
Two details make the arrangement work in practice.
Every message and message part can carry `providerOptions`, so vendor-specific fields never widen the common shape (`packages/provider/src/language-model/v4/language-model-v4-prompt.ts:18`).
And tools are rendered into prompt messages as tool calls and tool results, which is why an assistant message can contain both text and a tool call in one part list.

## Tool execution path

Tool calling is the densest seam in the package, and the code separates five concerns that are often fused.

- Streaming versus executing: parts flow immediately; calls are collected and run only when the model turn ends (`packages/ai/src/generate-text/execute-tools-from-stream.ts:114`, `:227`).
- Approval: per-tool or generic policy functions return one of four statuses, and user approval is emitted as stream traffic rather than thrown (`packages/ai/src/generate-text/tool-approval-configuration.ts:27`).
- Denial: an automatic denial emits an approval request, an approval response and a `tool-output-denied` part, so the model sees a refusal in the next prompt (`packages/ai/src/generate-text/execute-tools-from-stream.ts:172`).
- Signature: when a secret is configured, the approval id and input digest are HMAC-signed, which lets a client round-trip an approval without forging one (`packages/ai/src/generate-text/tool-approval-signature.ts:61`).
- Timeout and abort: a tool gets its own timeout and a merged abort signal, separate from the step timeout (`packages/ai/src/prompt/request-options.ts:89`, `packages/ai/src/generate-text/execute-tool-call.ts:120`).
- Error to value: a throwing tool becomes a `tool-error` part, not a failed run (`packages/ai/src/generate-text/execute-tool-call.ts:162`).
- Provider-executed tools: server-side tools can return results into the same stream, and deferred results keep the loop alive until they arrive (`packages/ai/src/generate-text/stream-text.ts:3178`).

## Structured output

Two paths coexist, and they are worth separating because they disagree.

`generateObject` and `streamObject` ask the provider for JSON: one `doGenerate` call with `responseFormat` of type json, carrying the schema, name and description (`packages/ai/src/generate-object/generate-object.ts:409`).
The returned text is parsed, validated against an output strategy, and on failure wrapped in a typed error that carries text, usage and finish reason; a caller-supplied `repairText` may patch the text once (`packages/ai/src/generate-object/parse-and-validate-object-result.ts:77`).
Strategies cover object, array, enum and no-schema, and the enum strategy intentionally validates partial prefixes (`packages/ai/src/generate-object/output-strategy.ts:403`).

The text functions take a different route: `generateText` and `streamText` accept an `Output` specification whose `responseFormat` promise is passed to the model and whose parser turns the final text into typed output (`packages/ai/src/generate-text/output.ts:23`, `packages/ai/src/generate-text/generate-text.ts:1065`).
The same specification supplies a partial parser for `partialOutputStream` and an optional element stream, which is what makes streaming a typed object possible at all (`packages/ai/src/generate-text/output.ts:163`).
A third helper, prompt-level JSON schema injection, is exported and unit-tested but has no production call site (`packages/ai/src/generate-object/inject-json-instruction.ts:8`); it is a leftover of an earlier prompt-based strategy.

## State and persistence

- The core is stateless between calls: a result object holds promises and lazily consumes one stream (`packages/ai/src/generate-text/stream-text.ts:3297`).
- The only per-call state that persists is what the caller keeps: steps, response messages, usage, warnings (`packages/ai/src/generate-text/stream-text.ts:3343`).
- Durability is a callback contract, not a store: the finish handler reconstructs the assistant message and hands it to `onStepEnd` and `onEnd` with an outcome, an abort flag and a continuation flag (`packages/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts:150`).
- The UI side owns a small state machine: a `Chat` instance keeps messages, status, error and the active stream, and exposes send, regenerate, resume and approval methods (`packages/ai/src/ui/chat.ts:366`, `:507`, `:545`, `:586`).
- Sandboxes are passed down into tool execution rather than held by the core (`packages/ai/src/generate-text/execute-tool-call.ts:133`).
- There is no server-side run store, no checkpoint format and no schema migration in this repository.

## Transport and streaming

- The UI stream is a typed chunk protocol: text, reasoning, tool input and output, approval, source, file, custom data, step boundaries, start, finish, abort, metadata (`packages/ai/src/ui-message-stream/ui-message-chunks.ts:235`).
- An SSE layer frames it and can emit keep-alive comments between chunks, gated on downstream demand (`packages/ai/src/ui-message-stream/create-sse-stream-with-keep-alive.ts:4`).
- A response helper adds the standard headers, optionally tees the SSE stream for server-side consumption, and encodes to bytes (`packages/ai/src/ui-message-stream/create-ui-message-stream-response.ts:39`).
- A server factory lets a caller write chunks directly and merge other streams, including streams produced after the execute function returned (`packages/ai/src/ui-message-stream/create-ui-message-stream.ts:144`).
- On the client, one reducer turns chunks into message parts and tool states (`packages/ai/src/ui/process-ui-message-stream.ts:491`); a snapshot reader exposes whole-message updates for renderers (`packages/ai/src/ui-message-stream/read-ui-message-stream.ts:55`).
- Resumption is a client concern: `resumeStream` reconnects, and transports declare whether resume replays or continues (`packages/ai/src/ui/chat.ts:1108`).
- Errors are masked by default: the chunk carries `errorText` from an `onError` mapper, never a raw server exception (`packages/ai/src/ui-message-stream/to-ui-message-stream.ts:29`).

## Errors and telemetry

- Errors are classes with an `AI_` name, a `vercel.ai.error.*` symbol marker and a static `isInstance`, so `instanceof` survives multiple bundle copies (`clone:/AGENTS.md:172`).
- The error directory in `packages/ai/src/error/` holds one file per failure mode, and failure modes are referenced by class in code paths rather than by message text (`packages/ai/src/generate-text/parse-tool-call.ts:10`).
- Callbacks are the observability surface: start, step start, step end, finish, tool execution, plus a telemetry dispatcher parallel to each (`clone:/AGENTS.md:172`; `packages/ai/src/telemetry/telemetry.ts:1`).
- Tracing channels let an integration wrapper nest its own calls inside a tool execution (`packages/ai/src/generate-text/execute-tool-call.ts:55`).
- Per-call throughput, time to first output and inter-chunk statistics are computed in the normal path rather than by a separate profiler (`packages/ai/src/generate-text/stream-language-model-call.ts:609`).

## Build and test stack

- pnpm workspaces over `packages`, `apps`, `examples` and `tools`, with Turborepo orchestrating build, test and type-check tasks (`pnpm-workspace.yaml:1`, `turbo.json:4`).
- Formatting and linting are oxfmt and oxlint through an ultracite wrapper; CI runs the same checks (`package.json:24`).
- Vitest with separate Node and Edge configurations per package; 1,049 test files and 129 type-level test files across the tree.
- Changesets gate releases, and a changeset is required for production changes (`clone:/AGENTS.md:267`).
- CI has 13 workflows; the main one runs a lint-and-format job, a consistency job, a sharded examples build and package tests on Node 22 (`clone:/.github/workflows/ci.yml:33`).
- Examples are first-class workspaces and are compiled in CI, so an API break surfaces there.

## Deliberate absences

- No code-execution action loop and no sandboxed program execution equivalent to our `RT-01`.
- No CLI or terminal product analogous to our `CL-01` and `CL-02`.
- No guardrail layer, dataset runner or scorer comparable with our `GR-01` or `OB-04`.
- No durable run store, no resume across processes and no checkpoint schema, which is where our `HL-03` and `HL-04` lead.
