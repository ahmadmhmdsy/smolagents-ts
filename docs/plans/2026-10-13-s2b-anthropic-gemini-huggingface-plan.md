# S2b — the Anthropic, Gemini and HuggingFace adapters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## Contract

- **Role:** the implementation plan for milestone S2b of the design record — three more provider adapters behind the core `Model` seam, written to be executed task by task with one commit per task.
- **Mutability:** history, pinned to revision `79a4f9c` of `main`. The tree it describes is that revision plus the commits it names.
- **Read when:** executing S2b, or auditing what S2b claimed before it landed.
- **Update when:** never in place. A correction to what S2b actually did belongs in a completion report under `docs/reports/`; the next milestone gets its own plan.

## Goal

Ship `AnthropicModel`, `GeminiModel` and `HuggingFaceModel` in `packages/models`. Each one maps the core seam onto a single wire protocol, each is pinned by a fixture, and no test in the suite reaches a live provider.

## Architecture

Three adapters, one seam. `packages/core` owns `Model`, `ChatMessage`, `GenerateOptions`, `ToolSpec`, `ToolCallAccumulator` and `collectCompletion`. It never learns a provider name and never imports `packages/models`; the `core-no-models` dependency-cruiser rule enforces that direction. An adapter translates a transcript into one provider's request shape, translates the reply back into `ChatCompletion` or `ChatCompletionChunk`, and leaves credential lookup, retries and budgets to its caller.

Shared HTTP work lives in `packages/models/src/transport.ts`. Shared event-stream reading lives in `packages/models/src/sse.ts` and is reused unchanged by all three adapters.

Anthropic and Gemini differ from OpenAI in the same three places: the system prompt is not a message, tool calls and tool results are content blocks rather than message fields, and the tool declaration names its schema differently. That is why they are adapters rather than base-URL presets of `OpenAICompatibleModel`. HuggingFace is the opposite case — its router speaks OpenAI's chat-completions format — so `HuggingFaceModel` is a thin subclass that changes the host, the provider name and one request field.

## Tech Stack

TypeScript under `tsconfig.base.json` (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`), a pnpm workspace, vitest, tsup, and the repository gate `pnpm gate`. An import inside a package carries the `.js` extension of the emitted file, because the repository does not enable `allowImportingTsExtensions`.

## Spec

The design record `docs/design/2026-10-12-smolagents-ts-v1-design.md`: §7 and §7.1 (the seam and its tier-1 adapters), §5.2 (the subpaths a consumer imports), §13 (a message's content is text in v1), §14 (S2 is this milestone). Task `T-7` in `docs/04-tasks.md` is the unit of work, and its gate is that this plan exists and its Definition of done holds.

Where the design record and the shipped code disagree, the code wins and this plan records the difference instead of quietly following either. §7 names the capability field `supports`; the shipped seam calls it `capabilities`, and every adapter here implements `capabilities`. §6.2 sketches a `generate(memory, {stream: true})` signature; the shipped seam has `generate` and `generateStream`, and the adapters implement those.

## Depends on

S2a, which landed at `79a4f9c`: the `Model` seam, `transport.ts` (`FetchLike`, `resolveFetch`, `joinUrl`, `HttpError`), `sse.ts` (`parseSse`), `OpenAICompatibleModel` and `CustomModel`. Also `rules/components/models.md` and the scoped entry `packages/models/AGENTS.md`.

## Dependency order

1. Anthropic, non-streaming — the most different mapping, so it sets the pattern.
2. Anthropic, streaming.
3. Gemini, non-streaming.
4. Gemini, streaming.
5. HuggingFace — the thin subclass and the two-line hook it needs.
6. The barrel and the pinned public surface.
7. One end-to-end run of the Anthropic adapter through a real `ToolCallingAgent`.
8. The records, the changeset, and the gate.

## Spec coverage

| spec | what it asks for | task |
|---|---|---|
| §7, §7.1 | `AnthropicModel` over the Messages API | 1, 2, 7 |
| §7, §7.1 | `GeminiModel` over generateContent | 3, 4 |
| §7, §7.1 | `HuggingFaceModel` over the Inference Providers router | 5 |
| §5.2 | a consumer can import each adapter by name | 6 |
| §13 | a text-only transcript is enough for a tool-calling turn | 1, 3, 5 |
| §14 | S2 is complete | 8 |
| `rules/components/models.md` | data not policy, no credential at import time, one fixture per adapter | 1–5 |
| T-7 gate | this plan exists and its Definition of done holds | 8 |

## File structure

| path | responsibility | task |
|---|---|---|
| `packages/models/src/transport.ts` | the injected fetch, URL joining, the HTTP error, and one shared JSON POST | 1 |
| `packages/models/src/openai-compatible.ts` | unchanged behaviour; its payload becomes an extension point | 1, 5 |
| `packages/models/src/anthropic.ts` | the Messages API: blocks, top-level system, named events | 1, 2 |
| `packages/models/src/gemini.ts` | generateContent: contents, parts, usageMetadata | 3, 4 |
| `packages/models/src/huggingface.ts` | the Inference Providers router, as a specialization of the OpenAI mapping | 5 |
| `packages/models/src/index.ts` | the public barrel | 6 |
| `packages/models/test/anthropic.test.ts` | the request and response mapping, non-streaming | 1 |
| `packages/models/test/anthropic-stream.test.ts` | the named event stream | 2 |
| `packages/models/test/gemini.test.ts` | the request and response mapping, non-streaming | 3 |
| `packages/models/test/gemini-stream.test.ts` | the alt=sse stream | 4 |
| `packages/models/test/huggingface.test.ts` | the host, the provider name and the usage request | 5 |
| `packages/models/test/anthropic-e2e.test.ts` | the adapter driven by a real agent loop | 7 |
| `packages/models/test/public-surface.test.ts` | the pinned export list | 6 |
| `packages/models/test/fixtures/` | one request/response pair per adapter, flat, provider-prefixed | 1–5 |
| `packages/models/AGENTS.md` | the component entry: what ships and the real test count | 8 |

Fixture files stay flat in `test/fixtures/` with a provider prefix, matching the two files S2a shipped (`openai-chat-completion.json` and `openai-chat-completion.sse.txt`). A subdirectory per provider would have been tidier and would have forced a move of the S2a files for no gain.

`packages/core/**` is not touched. `transport.ts` and `sse.ts` are reused; a Gemini stream read without `alt=sse` would return a JSON array that `parseSse` cannot read, so this plan pins `alt=sse` and leaves that case to a future task.

---

## Task 1 — the Anthropic adapter maps a tool-calling turn

**Files**

- create `packages/models/src/anthropic.ts`
- create `packages/models/test/anthropic.test.ts`
- create `packages/models/test/fixtures/anthropic-messages.json`
- modify `packages/models/src/transport.ts` — add `postJson`
- modify `packages/models/src/openai-compatible.ts` — use `postJson`, make `payload` protected

**Steps**

- [ ] 1.1 Add the shared POST to `transport.ts`, below `joinUrl`:

```ts
/** POSTs a JSON body and turns a rejected response into an HttpError. */
export async function postJson(
  fetchImpl: FetchLike,
  url: string,
  body: unknown,
  headers: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<Response> {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new HttpError(response.status, text, url);
  }
  return response;
}
```

- [ ] 1.2 Point `OpenAICompatibleModel.post` at it, so the three adapters share one code path. Replace the body of the private method with a call to `postJson`, keeping its signature and the header order it had:

```ts
private async post(
  path: string,
  body: unknown,
  signal?: AbortSignal,
  accept?: string,
): Promise<Response> {
  return postJson(
    this.fetchImpl,
    joinUrl(this.baseUrl, path),
    body,
    {
      ...(accept === undefined ? {} : { accept }),
      ...(this.apiKey === undefined ? {} : { authorization: "Bearer " + this.apiKey }),
      ...this.headers,
    },
    signal,
  );
}
```

- [ ] 1.3 Change `private payload(` to `protected payload(` in the same file and add a sentence to its doc comment saying that a subclass may extend the body. This is the hook Task 5 uses. Change nothing else.
- [ ] 1.4 Run `pnpm vitest run --project models`. Expected: **7 files, 30 tests, exit 0** — the same numbers as before the refactor. This step is red/green only in the sense that a changed number or a failure means the refactor moved behaviour.
- [ ] 1.5 Write the fixture `packages/models/test/fixtures/anthropic-messages.json`. It is the request/response pair Anthropic documents for a tool-calling turn, shaped by hand from the published schema, exactly as the S2a fixture was; it is not a capture of a live call and the test says so.

```json
{
  "id": "msg_01XFDUDYJgAACzvnptvVoYEL",
  "type": "message",
  "role": "assistant",
  "model": "claude-sonnet-4-5",
  "content": [
    { "type": "text", "text": "I'll check." },
    {
      "type": "tool_use",
      "id": "toolu_01A09q90qw90lq917835lq9",
      "name": "get_weather",
      "input": { "city": "Paris" }
    }
  ],
  "stop_reason": "tool_use",
  "stop_sequence": null,
  "usage": { "input_tokens": 42, "output_tokens": 7 }
}
```

- [ ] 1.6 Write the failing test `packages/models/test/anthropic.test.ts`. Reuse the fixture double shape from `openai-compatible.test.ts` verbatim — a `recorder` that returns a `Response` and records `{url, init}` — and assert the four things that make this adapter different:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AnthropicModel } from "../src/anthropic.js";
import { HttpError, type FetchLike } from "../src/transport.js";

/** The reply Anthropic documents for a tool-calling turn, kept as a fixture so the suite needs no key. */
const completion = readFileSync(
  new URL("./fixtures/anthropic-messages.json", import.meta.url),
  "utf8",
);
```

  The cases, each one `it(...)`:

  1. **sends the transcript and parses the documented reply.** Build the model with `{model: "claude-sonnet-4-5", apiKey: "sk-ant-test", baseUrl: "https://example.test", fetch}` and call `generate` with a system turn and a user turn plus `{tools: [weatherTool], temperature: 0}`. Assert `calls[0]?.url === "https://example.test/v1/messages"`, the headers carry `x-api-key: "sk-ant-test"` and `anthropic-version: "2023-06-01"`, and the body has **no** system message — the system text is the top-level `system` string. Assert `tools[0]` is `{name, description, input_schema}`, and that the result is `content: "I'll check."` with `toolCalls: [{id: "toolu_01A09q90qw90lq917835lq9", name: "get_weather", arguments: '{"city":"Paris"}'}]`, `usage: {inputTokens: 42, outputTokens: 7, totalTokens: 49}` and `finishReason: "tool_calls"`.
  2. **renders an assistant tool call and its result as blocks.** Call `generate` with a user turn, an assistant turn carrying `toolCalls`, and a tool turn. Assert the assistant message is `{role: "assistant", content: [{type: "text", ...}, {type: "tool_use", id, name, input: {city: "Paris"}}]}` and that the tool result is a **user** message whose content is `[{type: "tool_result", tool_use_id: "call_1", content: "sunny"}]`.
  3. **merges consecutive tool results into one user turn.** Two tool messages in a row must produce one user message with two `tool_result` blocks, because the wire format rejects a tool result that does not immediately follow its assistant turn.
  4. **defaults max_tokens, the base URL and the version, and omits the key when there is none.** With `new AnthropicModel({model: "m", fetch})`, assert the URL is `https://api.anthropic.com/v1/messages`, `sent.max_tokens === 4096`, the `anthropic-version` header is present and `x-api-key` is absent. Then assert a per-request `maxTokens: 99` wins over the constructor's.
  5. **raises an HttpError** carrying the status, the body and the URL, using the same shape as the OpenAI test.
  6. **reports its identity and refuses a blank model id**: `id` is the model id, `provider` is `"anthropic"`, `capabilities` is `{streaming: true, toolCalls: true, images: false, structuredOutput: false}`, and `new AnthropicModel({model: "  "})` throws `/model id/`.

- [ ] 1.7 Run `pnpm vitest run --project models` and watch it fail: the module does not exist yet.
- [ ] 1.8 Write `packages/models/src/anthropic.ts`:

```ts
import {
  EMPTY_TOKEN_USAGE,
  modelCapabilities,
  type ChatCompletion,
  type ChatMessage,
  type FinishReason,
  type GenerateOptions,
  type Model,
  type ModelCapabilities,
  type TokenUsage,
  type ToolCallRequest,
  type ToolSpec,
} from "@smolagents-ts/core";
import { HttpError, joinUrl, postJson, resolveFetch, type FetchLike } from "./transport.js";

export interface AnthropicOptions {
  /** The provider's model id, for example "claude-sonnet-4-5". */
  model: string;
  apiKey?: string;
  /** Everything before "/v1/messages". Defaults to the Anthropic endpoint. */
  baseUrl?: string;
  fetch?: FetchLike;
  headers?: Readonly<Record<string, string>>;
  capabilities?: Partial<ModelCapabilities>;
  systemPrompt?: string;
  temperature?: number;
  /** The wire requires a limit, so this defaults to 4096 rather than being omitted. */
  maxTokens?: number;
  /** Reported as the model's provider; defaults to "anthropic". */
  provider?: string;
  /** The dated API version header; defaults to "2023-06-01". */
  version?: string;
}

interface WireTextBlock {
  type: "text";
  text: string;
}

interface WireToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: unknown;
}

interface WireToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string;
}

type WireBlock = WireTextBlock | WireToolUseBlock | WireToolResultBlock;

interface WireMessage {
  role: "user" | "assistant";
  content: WireBlock[];
}

interface WireUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface WireResponse {
  content?: WireBlock[];
  stop_reason?: string | null;
  usage?: WireUsage;
}

const DEFAULT_BASE_URL = "https://api.anthropic.com";
const DEFAULT_VERSION = "2023-06-01";
const DEFAULT_MAX_TOKENS = 4096;

/** The wire wants an object here, and a transcript may carry an empty or unparseable string. */
function toInput(raw: string): unknown {
  if (raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function toWireTools(tools: readonly ToolSpec[]): unknown[] {
  return tools.map((spec) => ({
    name: spec.name,
    description: spec.description,
    input_schema: spec.inputSchema,
  }));
}

/** The transcript as blocks, with every tool result folded into the user turn that follows its call. */
function toWireMessages(
  messages: readonly ChatMessage[],
  systemPrompt?: string,
): { system?: string; messages: WireMessage[] } {
  const system: string[] = [];
  if (systemPrompt !== undefined) system.push(systemPrompt);
  const wire: WireMessage[] = [];
  let results: WireToolResultBlock[] = [];
  const flush = (): void => {
    if (results.length > 0) {
      wire.push({ role: "user", content: results });
      results = [];
    }
  };

  for (const message of messages) {
    if (message.role === "system") {
      if (message.content !== "") system.push(message.content);
      continue;
    }
    if (message.role === "tool") {
      results.push({
        type: "tool_result",
        tool_use_id: message.toolCallId ?? "",
        content: message.content,
      });
      continue;
    }
    flush();
    if (message.role === "assistant") {
      const blocks: WireBlock[] = [];
      if (message.content !== "") blocks.push({ type: "text", text: message.content });
      for (const call of message.toolCalls ?? []) {
        blocks.push({ type: "tool_use", id: call.id, name: call.name, input: toInput(call.arguments) });
      }
      if (blocks.length > 0) wire.push({ role: "assistant", content: blocks });
      continue;
    }
    wire.push({ role: "user", content: [{ type: "text", text: message.content }] });
  }
  flush();
  return { ...(system.length === 0 ? {} : { system: system.join("\n\n") }), messages: wire };
}

function fromWireContent(content: WireBlock[] | undefined): {
  content: string;
  toolCalls: ToolCallRequest[];
} {
  let text = "";
  const toolCalls: ToolCallRequest[] = [];
  for (const block of content ?? []) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolCalls.push({ id: block.id, name: block.name, arguments: JSON.stringify(block.input ?? {}) });
    }
  }
  return { content: text, toolCalls };
}

function toFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case "tool_use":
      return "tool_calls";
    case "max_tokens":
      return "length";
    case "end_turn":
    case "stop_sequence":
      return "stop";
    default:
      return "other";
  }
}

function fromWireUsage(usage: WireUsage | undefined): TokenUsage {
  if (usage === undefined) return EMPTY_TOKEN_USAGE;
  const inputTokens = usage.input_tokens ?? 0;
  const outputTokens = usage.output_tokens ?? 0;
  return { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
}

/** Anthropic's Messages API: a top-level system prompt, content blocks, and a required token limit. */
export class AnthropicModel implements Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly headers: Readonly<Record<string, string>> | undefined;
  private readonly systemPrompt: string | undefined;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number;
  private readonly version: string;
  private readonly fetchImpl: FetchLike;

  constructor(options: AnthropicOptions) {
    if (options.model.trim() === "") {
      throw new Error("AnthropicModel needs a model id");
    }
    this.id = options.model;
    this.provider = options.provider ?? "anthropic";
    this.capabilities = modelCapabilities({ toolCalls: true, ...options.capabilities });
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.systemPrompt = options.systemPrompt;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens ?? DEFAULT_MAX_TOKENS;
    this.version = options.version ?? DEFAULT_VERSION;
    this.fetchImpl = resolveFetch(options.fetch);
  }

  async generate(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<ChatCompletion> {
    const response = await this.post(this.payload(messages, options, false), options.signal);
    const body = (await response.json()) as WireResponse;
    const parsed = fromWireContent(body.content);
    return {
      content: parsed.content,
      toolCalls: parsed.toolCalls,
      usage: fromWireUsage(body.usage),
      finishReason: toFinishReason(body.stop_reason),
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncGenerator<never> {
    throw new Error("AnthropicModel cannot stream yet");
    // eslint-disable-next-line no-unreachable
    yield undefined as never;
    void messages;
    void options;
  }

  protected payload(
    messages: readonly ChatMessage[],
    options: GenerateOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const transcript = toWireMessages(messages, options.systemPrompt ?? this.systemPrompt);
    const tools = options.tools;
    const temperature = options.temperature ?? this.temperature;
    const stopSequences = options.stopSequences;
    return {
      model: this.id,
      max_tokens: options.maxTokens ?? this.maxTokens,
      ...transcript,
      stream,
      ...(tools === undefined || tools.length === 0 ? {} : { tools: toWireTools(tools) }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(stopSequences === undefined || stopSequences.length === 0
        ? {}
        : { stop_sequences: stopSequences }),
    };
  }

  private async post(body: unknown, signal?: AbortSignal): Promise<Response> {
    const url = joinUrl(this.baseUrl, "/v1/messages");
    return postJson(
      this.fetchImpl,
      url,
      body,
      {
        "anthropic-version": this.version,
        ...(this.apiKey === undefined ? {} : { "x-api-key": this.apiKey }),
        ...this.headers,
      },
      signal,
    );
  }
}
```

- [ ] 1.9 Run `pnpm vitest run --project models`. Expected: **8 files, 37 tests, exit 0**.
- [ ] 1.10 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0. vitest strips types, so a type-only mistake is invisible to the test run and visible here.
- [ ] 1.11 Commit: `feat(models): add the Anthropic adapter`.

**Verification.** `pnpm vitest run --project models` reports 8 files and 37 tests, exit 0; `pnpm --filter @smolagents-ts/models run typecheck` exits 0. The `generateStream` placeholder exists only so the class satisfies `Model` before Task 2 replaces it.

---

## Task 2 — the Anthropic adapter streams named events

**Files**

- modify `packages/models/src/anthropic.ts`
- create `packages/models/test/anthropic-stream.test.ts`
- create `packages/models/test/fixtures/anthropic-messages.sse.txt`

**Steps**

- [ ] 2.1 Write the fixture as an event stream in the file, exactly as the provider frames it — named events, blank line between them, and the `input_json_delta` that carries half a JSON object:

```text
event: message_start
data: {"type":"message_start","message":{"id":"msg_1","usage":{"input_tokens":42,"output_tokens":1}}}

event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"I'll check"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: content_block_start
data: {"type":"content_block_start","index":1,"content_block":{"type":"tool_use","id":"toolu_01A09q90qw90lq917835lq9","name":"get_weather"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"{\"city\":"}}

event: content_block_delta
data: {"type":"content_block_delta","index":1,"delta":{"type":"input_json_delta","partial_json":"\"Paris\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":1}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":7}}

event: message_stop
data: {"type":"message_stop"}
```

- [ ] 2.2 Write the failing test `packages/models/test/anthropic-stream.test.ts`. Read the fixture, serve it through the same `recorder` with `content-type: text/event-stream`, then:

  1. **turns the stream into chunks**: the text deltas concatenate to `I'll check`, the two `input_json_delta` events produce `argumentsDelta` values that concatenate to `{"city":"Paris"}`, the `content_block_start` for the tool carries the id and the name, and the last chunk with a reason carries `finishReason: "tool_calls"`.
  2. **collects the stream with the core's own accumulator**: `collectCompletion` over `model.generateStream(...)` yields the same `toolCalls` the non-streaming test asserts, which proves the delta shape is one the core can rebuild a call from.
  3. **reports usage that adds up**: the `message_start` input count and the `message_delta` output count reach one final chunk as `{inputTokens: 42, outputTokens: 7, totalTokens: 49}`.
  4. **asks for a stream**: the request body has `stream: true` and the `accept` header is `text/event-stream`.
  5. **stops at message_stop**: a fixture with a trailing event after `message_stop` yields nothing more.
  6. **throws when the response has no body**, matching the OpenAI adapter's message for the same condition.

- [ ] 2.3 Run `pnpm vitest run --project models` and watch `anthropic-stream.test.ts` fail on the placeholder.
- [ ] 2.4 Replace `generateStream` in `anthropic.ts` with the real reader, and add the two imports it needs (`parseSse` from `./sse.js`, and the `ChatCompletionChunk` and `ToolCallDelta` types from the core):

```ts
async *generateStream(
  messages: readonly ChatMessage[],
  options: GenerateOptions = {},
): AsyncGenerator<ChatCompletionChunk> {
  const response = await this.post(this.payload(messages, options, true), options.signal);
  if (response.body === null) {
    throw new Error("The provider returned no body to stream");
  }
  // The input count arrives once at the start; the output count arrives once at the end.
  let inputTokens = 0;
  for await (const event of parseSse(response.body)) {
    let parsed: WireStreamEvent;
    try {
      parsed = JSON.parse(event.data) as WireStreamEvent;
    } catch {
      continue; // a keep-alive that is not JSON
    }
    switch (event.event) {
      case "message_start":
        inputTokens = parsed.message?.usage?.input_tokens ?? 0;
        break;
      case "content_block_start":
        if (parsed.content_block?.type === "tool_use") {
          yield {
            delta: "",
            toolCallDelta: {
              index: parsed.index ?? 0,
              ...(parsed.content_block.id === undefined ? {} : { id: parsed.content_block.id }),
              ...(parsed.content_block.name === undefined ? {} : { name: parsed.content_block.name }),
            },
          };
        }
        break;
      case "content_block_delta": {
        const delta = parsed.delta;
        if (delta?.type === "text_delta" && delta.text !== undefined) {
          yield { delta: delta.text };
        } else if (delta?.type === "input_json_delta" && delta.partial_json !== undefined) {
          yield {
            delta: "",
            toolCallDelta: { index: parsed.index ?? 0, argumentsDelta: delta.partial_json },
          };
        }
        break;
      }
      case "message_delta": {
        const chunk: ChatCompletionChunk = { delta: "" };
        const reason = parsed.delta?.stop_reason;
        if (reason !== undefined && reason !== null) chunk.finishReason = toFinishReason(reason);
        const outputTokens = parsed.usage?.output_tokens;
        if (outputTokens !== undefined) {
          chunk.usage = { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens };
        }
        yield chunk;
        break;
      }
      case "message_stop":
        return;
      default:
        break;
    }
  }
}
```

  with the wire shape this reads:

```ts
interface WireStreamEvent {
  index?: number;
  message?: { usage?: WireUsage };
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string; stop_reason?: string | null };
  usage?: WireUsage;
}
```

- [ ] 2.5 Run `pnpm vitest run --project models`. Expected: **9 files, 43 tests, exit 0**.
- [ ] 2.6 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0.
- [ ] 2.7 Commit: `feat(models): stream the Anthropic adapter`.

**Verification.** `pnpm vitest run --project models` reports 9 files and 43 tests, exit 0, and the streamed call rebuilt by `collectCompletion` equals the call parsed from the non-streaming fixture.

---

## Task 3 — the Gemini adapter maps a tool-calling turn

**Files**

- create `packages/models/src/gemini.ts`
- create `packages/models/test/gemini.test.ts`
- create `packages/models/test/fixtures/gemini-generate-content.json`

**Steps**

- [ ] 3.1 Write the fixture: a candidate whose parts hold a function call, with the usage block Gemini returns.

```json
{
  "candidates": [
    {
      "content": {
        "role": "model",
        "parts": [{ "functionCall": { "name": "get_weather", "args": { "city": "Paris" } } }]
      },
      "finishReason": "STOP"
    }
  ],
  "usageMetadata": { "promptTokenCount": 42, "candidatesTokenCount": 7, "totalTokenCount": 49 },
  "modelVersion": "gemini-2.5-flash"
}
```

- [ ] 3.2 Write the failing test `packages/models/test/gemini.test.ts`, with the same recorder:

  1. **sends the transcript and parses the documented reply.** Assert the URL is `https://example.test/v1beta/models/gemini-2.5-flash:generateContent` when the model is `gemini-2.5-flash` and the base URL is `https://example.test/v1beta`; that the key rides in `x-goog-api-key`; that the system turn became `systemInstruction.parts[0].text` and is **not** in `contents`; that the user turn is `{role: "user", parts: [{text}]}`; and that `tools[0].functionDeclarations[0]` is `{name, description, parameters}`. The result is `content: ""`, `toolCalls: [{id: "call-0", name: "get_weather", arguments: '{"city":"Paris"}'}]`, `usage: {inputTokens: 42, outputTokens: 7, totalTokens: 49}` and `finishReason: "tool_calls"` — the synthesized id matters because the wire makes it optional.
  2. **renders an assistant call and its result as parts.** The assistant turn is `{role: "model", parts: [{functionCall: {name, args, id}}]}` and the tool turn is a **user** content whose part is `{functionResponse: {name: "get_weather", response: {result: "sunny"}, id: "call_0"}}`.
  3. **merges consecutive tool results into one user content** with two `functionResponse` parts.
  4. **maps the stop reasons it knows**: `STOP` with no function call is `stop`, `MAX_TOKENS` is `length`, and an unknown value is `other`.
  5. **sends generationConfig only when it has something to say**: `temperature` and `maxOutputTokens` appear when set and are absent otherwise, and `stopSequences` becomes `stopSequences` inside `generationConfig`.
  6. **raises an HttpError** carrying the status, the body and the URL.
  7. **reports its identity and refuses a blank model id**, with `provider` defaulting to `"gemini"`.

- [ ] 3.3 Run `pnpm vitest run --project models` and watch it fail.
- [ ] 3.4 Write `packages/models/src/gemini.ts`. It follows `anthropic.ts` line for line in structure, with these differences:

```ts
const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

// The URL carries both the model and the method, so it is built rather than joined to a path.
function methodUrl(baseUrl: string, model: string, method: string): string {
  return joinUrl(baseUrl, "/models/" + encodeURIComponent(model) + ":" + method);
}
```

  - `toWireMessages` returns `{systemInstruction?: {parts: [{text}]}, contents: WireContent[]}`. A user turn is `{role: "user", parts: [{text}]}`; an assistant turn is `{role: "model", parts: [...]}` with a text part when there is text and one `functionCall` part per call; a tool turn folds into a user content as `functionResponse` parts, merging consecutive results.
  - `fromWireParts` concatenates `text` parts and turns each `functionCall` into a call, taking `id` when the wire supplies one and otherwise `call-<index>`, with `arguments: JSON.stringify(part.functionCall.args ?? {})`.
  - The finish reason is read from the candidate, but a reply that contains a function call is `tool_calls` whatever `finishReason` says, because the wire has no tool-specific value.
  - Usage maps `promptTokenCount`, `candidatesTokenCount` and `totalTokenCount`, summing the first two when the total is absent.
  - `generate` posts to `methodUrl(this.baseUrl, this.id, "generateContent")` with the key in `x-goog-api-key`.
  - `generateStream` throws "GeminiModel cannot stream yet" until Task 4, exactly as the Anthropic placeholder did.

- [ ] 3.5 Run `pnpm vitest run --project models`. Expected: **10 files, 50 tests, exit 0**.
- [ ] 3.6 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0.
- [ ] 3.7 Commit: `feat(models): add the Gemini adapter`.

**Verification.** `pnpm vitest run --project models` reports 10 files and 50 tests, exit 0. The adapter passes `spec.inputSchema` through as `parameters` unchanged; the risk that the wire rejects the parts of JSON Schema it does not implement is recorded in the risks section and is not worked around here.

## Task 4 — the Gemini adapter streams alt=sse

**Files**

- modify `packages/models/src/gemini.ts`
- create `packages/models/test/gemini-stream.test.ts`
- create `packages/models/test/fixtures/gemini-stream.sse.txt`

**Steps**

- [ ] 4.1 Write the fixture. Gemini's stream is plain `data:` lines with no event names and no terminator, which is the shape `parseSse` already reads:

```text
data: {"candidates":[{"content":{"role":"model","parts":[{"text":"I'll check"}]},"finishReason":"STOP"}]}

data: {"candidates":[{"content":{"role":"model","parts":[{"functionCall":{"name":"get_weather","args":{"city":"Paris"}}}]},"finishReason":"STOP"}],"usageMetadata":{"promptTokenCount":42,"candidatesTokenCount":7,"totalTokenCount":49}}

```

- [ ] 4.2 Write the failing test `packages/models/test/gemini-stream.test.ts` with the same recorder, serving `content-type: text/event-stream`:

  1. **turns the stream into chunks**: the first chunk carries `delta: "I'll check"`, and the second carries a tool-call delta whose id is `call-0`, whose name is `get_weather` and whose `argumentsDelta` is `{"city":"Paris"}`.
  2. **collects the stream with the core's accumulator**: `collectCompletion` over `model.generateStream(...)` returns the same single call the non-streaming test asserts.
  3. **reports usage** from the chunk that carries `usageMetadata`: `{inputTokens: 42, outputTokens: 7, totalTokens: 49}`.
  4. **asks for the SSE form**: the URL ends in `:streamGenerateContent?alt=sse` and the body has `stream: true`.
  5. **yields nothing for a chunk that says nothing** — an empty candidate produces no chunk at all, matching the OpenAI adapter's behaviour.
  6. **throws when the response has no body.**

- [ ] 4.3 Run `pnpm vitest run --project models` and watch it fail on the placeholder.
- [ ] 4.4 Replace the placeholder with the reader and add the shared chunk builder:

```ts
/** One streamed response may carry text and a whole function call at once. */
function* chunksFor(parsed: WireResponse): Generator<ChatCompletionChunk> {
  const candidate = parsed.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  let text = "";
  const calls: { name: string; args: unknown }[] = [];
  for (const part of parts) {
    if (part.text !== undefined) text += part.text;
    if (part.functionCall !== undefined) {
      calls.push({ name: part.functionCall.name ?? "", args: part.functionCall.args });
    }
  }

  const reason = candidate?.finishReason;
  const chunk: ChatCompletionChunk = { delta: text };
  const first = calls[0];
  if (first !== undefined) {
    chunk.toolCallDelta = {
      index: 0,
      id: "call-0",
      name: first.name,
      argumentsDelta: JSON.stringify(first.args ?? {}),
    };
  }
  if (reason !== undefined) chunk.finishReason = calls.length > 0 ? "tool_calls" : toFinishReason(reason);
  if (parsed.usageMetadata !== undefined) chunk.usage = fromWireUsage(parsed.usageMetadata);

  if (text !== "" || chunk.toolCallDelta !== undefined || chunk.finishReason !== undefined || chunk.usage !== undefined) {
    yield chunk;
  }
  for (let index = 1; index < calls.length; index += 1) {
    const extra = calls[index];
    if (extra !== undefined) {
      yield {
        delta: "",
        toolCallDelta: {
          index,
          id: "call-" + String(index),
          name: extra.name,
          argumentsDelta: JSON.stringify(extra.args ?? {}),
        },
      };
    }
  }
}
```

  `generateStream` then reads the stream, skips an empty `data:` line, ignores a payload that is not JSON, and yields every chunk the builder produces.

- [ ] 4.5 Run `pnpm vitest run --project models`. Expected: **11 files, 56 tests, exit 0**.
- [ ] 4.6 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0.
- [ ] 4.7 Commit: `feat(models): stream the Gemini adapter`.

**Verification.** `pnpm vitest run --project models` reports 11 files and 56 tests, exit 0, and the streamed call rebuilt by `collectCompletion` equals the call parsed from the non-streaming fixture.

---

## Task 5 — the HuggingFace adapter is the OpenAI mapping at a different host

**Files**

- create `packages/models/src/huggingface.ts`
- create `packages/models/test/huggingface.test.ts`
- create `packages/models/test/fixtures/huggingface-chat-completion.json`

**Steps**

- [ ] 5.1 Write the fixture: an OpenAI-shaped completion whose `model` is an Inference Providers id, so the test can prove the id is passed through with its routing suffix intact.

```json
{
  "id": "chatcmpl-hf-1",
  "object": "chat.completion",
  "created": 1750000000,
  "model": "openai/gpt-oss-120b:groq",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": null,
        "tool_calls": [
          {
            "id": "call_1",
            "type": "function",
            "function": { "name": "get_weather", "arguments": "{\"city\":\"Paris\"}" }
          }
        ]
      },
      "finish_reason": "tool_calls"
    }
  ],
  "usage": { "prompt_tokens": 42, "completion_tokens": 7, "total_tokens": 49 }
}
```

- [ ] 5.2 Write the failing test `packages/models/test/huggingface.test.ts`:

  1. **defaults to the router and sends the token**: with `{model: "openai/gpt-oss-120b:groq", apiKey: "hf_test", fetch}`, the URL is `https://router.huggingface.co/v1/chat/completions`, the `authorization` header is `Bearer hf_test`, and the parsed reply is the same completion shape the OpenAI adapter produces — content, the one tool call, the usage and `finishReason: "tool_calls"`.
  2. **keeps the routing suffix and reports its own provider**: `model.id` is `openai/gpt-oss-120b:groq` and `model.provider` is `"huggingface"`.
  3. **asks the router for usage while streaming**: the streamed request body has `stream: true` and `stream_options: {include_usage: true}`, because without that field the router reports no tokens on a streamed run.
  4. **does not send `stream_options` on a non-streaming request.**
  5. **raises an HttpError** whose URL is the router's, and **refuses a blank model id**.

- [ ] 5.3 Run `pnpm vitest run --project models` and watch it fail.
- [ ] 5.4 Write `packages/models/src/huggingface.ts`:

```ts
import type { ChatCompletionChunk, ChatMessage, GenerateOptions } from "@smolagents-ts/core";
import { OpenAICompatibleModel, type OpenAICompatibleOptions } from "./openai-compatible.js";

/** The router's options are the OpenAI adapter's options; the defaults differ. */
export type HuggingFaceOptions = OpenAICompatibleOptions;

const DEFAULT_BASE_URL = "https://router.huggingface.co/v1";

/**
 * The Inference Providers router is an OpenAI-compatible endpoint: the mapping, the
 * streaming reader and the error type are the shipped adapter's. Only the host, the
 * provider name and the usage request differ, so this is a subclass and not a copy.
 */
export class HuggingFaceModel extends OpenAICompatibleModel {
  constructor(options: HuggingFaceOptions) {
    super({
      ...options,
      provider: options.provider ?? "huggingface",
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    });
  }

  protected override payload(
    messages: readonly ChatMessage[],
    options: GenerateOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const body = super.payload(messages, options, stream);
    return stream ? { ...body, stream_options: { include_usage: true } } : body;
  }
}
```

  The spread order matters: the defaults are applied after `options`, because `exactOptionalPropertyTypes` makes an explicit `undefined` a type error and a later spread would otherwise erase the default.

- [ ] 5.5 Run `pnpm vitest run --project models`. Expected: **12 files, 61 tests, exit 0**.
- [ ] 5.6 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0.
- [ ] 5.7 Commit: `feat(models): add the HuggingFace adapter`.

**Verification.** `pnpm vitest run --project models` reports 12 files and 61 tests, exit 0. The adapter inherits every OpenAI behaviour, so the OpenAI suite is still the regression net for both.

---

## Task 6 — the barrel exposes the three adapters

**Files**

- modify `packages/models/src/index.ts`
- modify `packages/models/test/public-surface.test.ts`

**Steps**

- [ ] 6.1 Extend the barrel: export `AnthropicModel` and `AnthropicOptions`, `GeminiModel` and `GeminiOptions`, `HuggingFaceModel` and `HuggingFaceOptions`, keeping the existing three exports and their order.
- [ ] 6.2 Extend the pinned list in `public-surface.test.ts` in the same commit. It becomes:

```ts
expect(Object.keys(barrel).sort()).toEqual([
  "AnthropicModel",
  "CustomModel",
  "GeminiModel",
  "HuggingFaceModel",
  "OpenAICompatibleModel",
  "VERSION",
]);
```

  and the comment above it gains one sentence saying that S2b added the three adapters.
- [ ] 6.3 Run `pnpm vitest run --project models`. Expected: **12 files, 61 tests, exit 0** — the same count, because this task changes one test rather than adding any.
- [ ] 6.4 Run `pnpm --filter @smolagents-ts/models run typecheck` and `pnpm --filter @smolagents-ts/models run build`. Both exit 0; the build proves the new modules bundle.
- [ ] 6.5 Commit: `feat(models): export the three adapters`.

**Verification.** `pnpm vitest run --project models` reports 12 files and 61 tests, exit 0, and the build succeeds with the three new modules in it.

---

## Task 7 — a real agent loop drives the Anthropic adapter

**Files**

- create `packages/models/test/anthropic-e2e.test.ts`

**Steps**

- [ ] 7.1 Copy the harness from `packages/models/test/agent-e2e.test.ts` — the fetch double that answers each request with the next scripted body — and swap the adapter for `AnthropicModel`.
- [ ] 7.2 Write two tests:

  1. **the loop answers through a tool call.** Script the first response as the tool-calling fixture and the second as an `end_turn` reply with text content. Run a real `ToolCallingAgent` with one weather tool and assert the agent's final answer is the second response's text, that the tool ran once, and that two requests reached the wire.
  2. **the second request carries the result as a user turn.** Assert the recorded second request's `messages` last element is `{role: "user", content: [{type: "tool_result", tool_use_id: "toolu_01A09q90qw90lq917835lq9", content: <the tool's observation>}]}`, and that the request before it holds the assistant's `tool_use` block.
- [ ] 7.3 Run `pnpm vitest run --project models`. Expected: **13 files, 63 tests, exit 0**. If the counts differ, record the measured numbers rather than the predicted ones.
- [ ] 7.4 Run `pnpm --filter @smolagents-ts/models run typecheck`. Expected exit 0.
- [ ] 7.5 Commit: `test(models): drive the Anthropic adapter through the agent loop`.

**Verification.** `pnpm vitest run --project models` reports 13 files and 63 tests, exit 0, and the second request's transcript shows the tool result folded into a user turn — the one mapping the OpenAI adapter does differently.

---

## Task 8 — records, the changeset and the gate

**Files**

- modify `packages/models/AGENTS.md`
- modify `docs/01-project.md`
- modify `docs/04-tasks.md`
- modify `docs/05-memory.md` and `docs/memory/general.md`
- create `.changeset/s2b-model-adapters.md`
- modify `docs/03-handoff.md`

**Steps**

- [ ] 8.1 Update `packages/models/AGENTS.md`: the description names five exports, the entry-point table gains a row per adapter and per fixture, and the smallest-validation line carries the count measured in Task 7. Keep the entry under its 6 KB cap.
- [ ] 8.2 Move `docs/01-project.md`'s S2 line to done, naming what shipped, and leave the design record untouched — it is history pinned to its revision.
- [ ] 8.3 Set `docs/04-tasks.md` T-7 to done with its evidence: the gate output, the validator result, and this plan's path. Move the row to `docs/tasks/archive-2026.md` verbatim if the Now table is rotating.
- [ ] 8.4 Add the lessons to `docs/memory/general.md` and their rows to the registry in `docs/05-memory.md`. Candidates: a provider that frames its system prompt outside the message list needs a mapping rather than a preset; a wire's stop reason is not the seam's finish reason and must be translated in both directions; an adapter whose provider makes a call id optional has to synthesize one; two adapters can share a wire format while still deserving separate names.
- [ ] 8.5 Write the changeset `.changeset/s2b-model-adapters.md` in the form `.changeset/s1-core-runtime.md` established, with a minor bump for `@smolagents-ts/models`.
- [ ] 8.6 Add the handoff entry. Check the region size first: `docs/03-handoff.md` measured 7371 bytes after the merge entry, so the oldest entry must move verbatim to `docs/handoff/archive-2026.md` before the new one is written, or the 8192-byte cap fails.
- [ ] 8.7 Run the gate: `pnpm gate`. Expected exit 0 with the whole suite green, `ci:check` OK and the pack smoke test reporting five packages installed and imported from tarballs.
- [ ] 8.8 Run `python scripts/validate_context.py --root . --baseline docs/.baseline.json --json` and confirm `new: 0` with no errors, then `python scripts/rotate.py --check`. Both must pass; a new document in `docs/` carries the word `Contract` and this plan does.
- [ ] 8.9 Commit: `docs: record S2b`.

**Verification.** `pnpm gate` exits 0; the validator reports `new: 0` with zero errors and zero warnings; `rotate.py --check` exits 0; `docs/03-handoff.md`'s handoff region is under 8192 bytes.

---

## Definition of done

- `AnthropicModel`, `GeminiModel` and `HuggingFaceModel` exist, implement `Model`, and are exported from the barrel.
- Each adapter pins at least one request/response fixture, and each fixture's provenance is stated as the published shape it was built from, never as a live capture.
- `pnpm vitest run --project models` passes with the count measured in Task 7, and `pnpm --filter @smolagents-ts/models run typecheck` exits 0.
- `pnpm gate` exits 0 on the final tree.
- The context validator reports `new: 0` and `rotate.py --check` exits 0.
- No credential is read at import time; no adapter retries, budgets or stores a key.
- `packages/core` is unchanged, and `pnpm depcruise` still reports no core-to-models edge.
- `packages/models/AGENTS.md`, `docs/01-project.md`, `docs/04-tasks.md`, `docs/05-memory.md`, `docs/memory/general.md` and `docs/03-handoff.md` all describe the shipped state, and a changeset exists for the release.

## What this plan deliberately does not do

- **It does not rename the capability field.** §7 calls it `supports` and the seam calls it `capabilities`; that drift is an owner decision, and every adapter here follows the shipped seam.
- **It does not add vision, images or structured output.** §13 keeps a message's content textual in v1, so all three adapters report `images: false` and `structuredOutput: false`.
- **It does not put policy in an adapter.** No retry, no backoff, no cost limit and no credential lookup inside any adapter.
- **It does not call a provider.** No fixture is a live capture and no test needs a key; recording real traffic would need three vendors' credentials and would make the suite non-deterministic.
- **It does not read Gemini's JSON-array stream.** The adapter pins `alt=sse`; supporting the non-SSE array form is its own task.
- **It does not echo Anthropic thinking blocks.** A text-only transcript cannot represent them, and the seam has nowhere to put them.
- **It does not send HuggingFace's `tool_prompt`.** It is optional, and nothing in this milestone needs it.
- **It does not add package subpaths.** §5.2 sketches `./models/anthropic` and its siblings; the packaging change belongs with the release work, not with the adapters.
- **It does not touch `packages/core`** or the `models-gateway` tier the design record defers.

## Risks carried forward

| risk | what it would look like | where it is recorded |
|---|---|---|
| Gemini accepts only an OpenAPI subset of JSON Schema | a live call rejects a tool whose schema carries `$schema` or `additionalProperties` | Task 3's verification note |
| Anthropic requires `max_tokens` | a request without a limit is rejected | the adapter defaults it to 4096 |
| Gemini's function-call id is optional | two calls in one turn would collide without a synthesized id | the adapter numbers them `call-0`, `call-1` |
| Token accounting differs per provider | totals that do not add up across a run | each adapter's usage mapping, tested |
| HuggingFace deployments vary | a direct TGI or Inference Endpoint URL does not answer OpenAI-shaped | the adapter is documented as the router's format, and `baseUrl` is overridable |
| Gemini's auth form has a legacy variant | a key in a query string instead of a header | the adapter sends `x-goog-api-key` only |
| Every fixture here is hand-shaped | a real provider differs from its own documentation | the fixtures state their provenance |

