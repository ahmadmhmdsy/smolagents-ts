import {
  EMPTY_TOKEN_USAGE,
  modelCapabilities,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type FinishReason,
  type GenerateOptions,
  type Model,
  type ModelCapabilities,
  type TokenUsage,
  type ToolCallDelta,
  type ToolCallRequest,
  type ToolSpec,
} from "@smolagents-ts/core";
import { parseSse } from "./sse.js";
import { joinUrl, postJson, resolveFetch, type FetchLike } from "./transport.js";

export interface OpenAICompatibleOptions {
  /** The provider's model id, for example "gpt-4o-mini". */
  model: string;
  /** Everything before "/chat/completions". Defaults to the OpenAI endpoint. */
  baseUrl?: string;
  apiKey?: string;
  fetch?: FetchLike;
  headers?: Readonly<Record<string, string>>;
  capabilities?: Partial<ModelCapabilities>;
  /** Prepended to every request unless the transcript already opens with a system turn. */
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Reported as the model's provider; defaults to "openai-compatible". */
  provider?: string;
}

interface WireToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface WireMessage {
  role: string;
  content: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: WireToolCall[];
}

interface WireToolCallDelta {
  index?: number;
  id?: string;
  function?: { name?: string; arguments?: string };
}

interface WireChoice {
  message?: { content?: string | null; tool_calls?: WireToolCall[] };
  delta?: { content?: string | null; tool_calls?: WireToolCallDelta[] };
  finish_reason?: string | null;
}

interface WireUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface WireResponse {
  choices?: WireChoice[];
  /** A null is the field present with no report; include_usage sends one per chunk. */
  usage?: WireUsage | null;
}

const DEFAULT_BASE_URL = "https://api.openai.com/v1";

function toWireTools(tools: readonly ToolSpec[]): unknown[] {
  return tools.map((spec) => ({
    type: "function",
    function: { name: spec.name, description: spec.description, parameters: spec.inputSchema },
  }));
}

/** The transcript as the wire format wants it: tool calls on the assistant turn, and a
 * tool_call_id on every tool result. */
function toWireMessages(messages: readonly ChatMessage[], systemPrompt?: string): WireMessage[] {
  const wire: WireMessage[] = [];
  const opensWithSystem = messages[0]?.role === "system";
  if (systemPrompt !== undefined && !opensWithSystem) {
    wire.push({ role: "system", content: systemPrompt });
  }
  for (const message of messages) {
    if (message.role === "assistant" && message.toolCalls !== undefined && message.toolCalls.length > 0) {
      wire.push({
        role: "assistant",
        content: message.content === "" ? null : message.content,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: call.arguments },
        })),
      });
      continue;
    }
    if (message.role === "tool") {
      wire.push({
        role: "tool",
        content: message.content,
        ...(message.toolCallId === undefined ? {} : { tool_call_id: message.toolCallId }),
        ...(message.name === undefined ? {} : { name: message.name }),
      });
      continue;
    }
    wire.push({ role: message.role, content: message.content });
  }
  return wire;
}

function fromWireToolCalls(calls: WireToolCall[] | undefined): ToolCallRequest[] {
  if (calls === undefined) return [];
  return calls.map((call, index) => ({
    id: call.id === "" ? "call-" + String(index) : call.id,
    name: call.function?.name ?? "",
    arguments: call.function?.arguments ?? "",
  }));
}

function fromWireUsage(usage: WireUsage | null | undefined): TokenUsage {
  if (usage === undefined || usage === null) return EMPTY_TOKEN_USAGE;
  const inputTokens = usage.prompt_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.total_tokens ?? inputTokens + outputTokens,
  };
}

function toFinishReason(raw: string | null | undefined): FinishReason {
  switch (raw) {
    case "tool_calls":
    case "function_call":
      return "tool_calls";
    case "length":
      return "length";
    case "stop":
      return "stop";
    default:
      return "other";
  }
}

function toToolCallDelta(call: WireToolCallDelta, fallbackIndex: number): ToolCallDelta {
  return {
    index: call.index ?? fallbackIndex,
    ...(call.id === undefined ? {} : { id: call.id }),
    ...(call.function?.name === undefined ? {} : { name: call.function.name }),
    ...(call.function?.arguments === undefined ? {} : { argumentsDelta: call.function.arguments }),
  };
}

/** One wire chunk may announce several calls, and the seam carries one delta per chunk. */
function* chunksFor(parsed: WireResponse): Generator<ChatCompletionChunk> {
  const choice = parsed.choices?.[0];
  const delta = choice?.delta;
  const deltas = delta?.tool_calls ?? [];
  const content = delta?.content ?? "";
  const reason = choice?.finish_reason;
  const first = deltas[0];

  const chunk: ChatCompletionChunk = { delta: content };
  if (first !== undefined) chunk.toolCallDelta = toToolCallDelta(first, 0);
  if (reason !== undefined && reason !== null) chunk.finishReason = toFinishReason(reason);
  // A null is the field present with no report, not a usage of zero.
  if (parsed.usage !== undefined && parsed.usage !== null) {
    chunk.usage = fromWireUsage(parsed.usage);
  }

  if (
    content !== "" ||
    chunk.toolCallDelta !== undefined ||
    chunk.finishReason !== undefined ||
    chunk.usage !== undefined
  ) {
    yield chunk;
  }
  for (let index = 1; index < deltas.length; index += 1) {
    const extra = deltas[index];
    if (extra !== undefined) yield { delta: "", toolCallDelta: toToolCallDelta(extra, index) };
  }
}

/**
 * Any provider that speaks the OpenAI chat-completions wire format: OpenAI itself,
 * Ollama, vLLM, llama.cpp, Groq, Together, OpenRouter, DeepSeek. One adapter covers them
 * because they agree on the request and response shape, not because they agree on the
 * host.
 */
export class OpenAICompatibleModel implements Model {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;

  private readonly baseUrl: string;
  private readonly apiKey: string | undefined;
  private readonly headers: Readonly<Record<string, string>> | undefined;
  private readonly systemPrompt: string | undefined;
  private readonly temperature: number | undefined;
  private readonly maxTokens: number | undefined;
  private readonly fetchImpl: FetchLike;

  constructor(options: OpenAICompatibleOptions) {
    if (options.model.trim() === "") {
      throw new Error("OpenAICompatibleModel needs a model id");
    }
    this.id = options.model;
    this.provider = options.provider ?? "openai-compatible";
    this.capabilities = modelCapabilities({ toolCalls: true, ...options.capabilities });
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey;
    this.headers = options.headers;
    this.systemPrompt = options.systemPrompt;
    this.temperature = options.temperature;
    this.maxTokens = options.maxTokens;
    this.fetchImpl = resolveFetch(options.fetch);
  }

  async generate(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): Promise<ChatCompletion> {
    const response = await this.post("/chat/completions", this.payload(messages, options, false), options.signal);
    const body = (await response.json()) as WireResponse;
    const choice = body.choices?.[0];
    return {
      content: choice?.message?.content ?? "",
      toolCalls: fromWireToolCalls(choice?.message?.tool_calls),
      usage: fromWireUsage(body.usage),
      finishReason: toFinishReason(choice?.finish_reason),
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncGenerator<ChatCompletionChunk> {
    const response = await this.post(
      "/chat/completions",
      this.payload(messages, options, true),
      options.signal,
      "text/event-stream",
    );
    if (response.body === null) {
      throw new Error("The provider returned no body to stream");
    }
    for await (const event of parseSse(response.body)) {
      if (event.data === "[DONE]") return;
      let parsed: WireResponse;
      try {
        parsed = JSON.parse(event.data) as WireResponse;
      } catch {
        continue; // a keep-alive that is not JSON
      }
      for (const chunk of chunksFor(parsed)) yield chunk;
    }
  }

  /** The request body. A subclass may extend it. */
  protected payload(
    messages: readonly ChatMessage[],
    options: GenerateOptions,
    stream: boolean,
  ): Record<string, unknown> {
    const systemPrompt = options.systemPrompt ?? this.systemPrompt;
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;
    const tools = options.tools;
    const stopSequences = options.stopSequences;
    return {
      model: this.id,
      messages: toWireMessages(messages, systemPrompt),
      stream,
      // A provider reports no tokens on a streamed response unless the request asks
      // for them; the final chunk then carries `usage` with an empty `choices`, which
      // chunksFor already yields. Without this a streamed run cannot be priced.
      ...(stream ? { stream_options: { include_usage: true } } : {}),
      ...(tools === undefined || tools.length === 0 ? {} : { tools: toWireTools(tools) }),
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxTokens === undefined ? {} : { max_tokens: maxTokens }),
      ...(stopSequences === undefined || stopSequences.length === 0 ? {} : { stop: stopSequences }),
    };
  }

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
}
