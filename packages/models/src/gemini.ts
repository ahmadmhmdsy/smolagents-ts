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
  type ToolCallRequest,
  type ToolSpec,
} from "@smolagents-ts/core";
import { parseSse } from "./sse.js";
import { joinUrl, postJson, resolveFetch, type FetchLike } from "./transport.js";

export interface GeminiOptions {
  /** The provider's model id, for example "gemini-2.5-flash". */
  model: string;
  apiKey?: string;
  /** Everything before "/models/". Defaults to the Gemini endpoint. */
  baseUrl?: string;
  fetch?: FetchLike;
  headers?: Readonly<Record<string, string>>;
  capabilities?: Partial<ModelCapabilities>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Reported as the model's provider; defaults to "gemini". */
  provider?: string;
}

interface WirePart {
  text?: string;
  functionCall?: { name?: string; args?: unknown; id?: string };
  functionResponse?: { name?: string; response?: unknown; id?: string };
}

interface WireContent {
  role?: string;
  parts?: WirePart[];
}

interface WireCandidate {
  content?: WireContent;
  finishReason?: string;
}

interface WireUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  /** The part of promptTokenCount the provider served from its context cache. */
  cachedContentTokenCount?: number;
}

interface WireResponse {
  candidates?: WireCandidate[];
  /** Some proxies send null rather than leaving the key out. */
  usageMetadata?: WireUsageMetadata | null;
}

const DEFAULT_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

/** The URL carries both the model and the method, so it is built rather than joined to a path. */
function methodUrl(baseUrl: string, model: string, method: string): string {
  return joinUrl(baseUrl, "/models/" + encodeURIComponent(model) + ":" + method);
}

/** The wire wants an object here, and a transcript may carry an empty or unparseable string. */
function toArgs(raw: string): unknown {
  if (raw.trim() === "") return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function toWireTools(tools: readonly ToolSpec[]): unknown[] {
  return [
    {
      functionDeclarations: tools.map((spec) => ({
        name: spec.name,
        description: spec.description,
        parameters: spec.inputSchema,
      })),
    },
  ];
}

/** The transcript as contents, with every tool result folded into the user turn after its call. */
function toWireMessages(
  messages: readonly ChatMessage[],
  systemPrompt?: string,
): { systemInstruction?: { parts: { text: string }[] }; contents: WireContent[] } {
  const system: string[] = [];
  if (systemPrompt !== undefined) system.push(systemPrompt);
  const contents: WireContent[] = [];
  let results: WirePart[] = [];
  const flush = (): void => {
    if (results.length > 0) {
      contents.push({ role: "user", parts: results });
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
        functionResponse: {
          name: message.name ?? "",
          response: { result: message.content },
          ...(message.toolCallId === undefined ? {} : { id: message.toolCallId }),
        },
      });
      continue;
    }
    flush();
    if (message.role === "assistant") {
      const parts: WirePart[] = [];
      if (message.content !== "") parts.push({ text: message.content });
      for (const call of message.toolCalls ?? []) {
        parts.push({ functionCall: { name: call.name, args: toArgs(call.arguments), id: call.id } });
      }
      if (parts.length > 0) contents.push({ role: "model", parts });
      continue;
    }
    contents.push({ role: "user", parts: [{ text: message.content }] });
  }
  flush();
  return {
    ...(system.length === 0
      ? {}
      : { systemInstruction: { parts: [{ text: system.join("\n\n") }] } }),
    contents,
  };
}

function fromWireParts(parts: WirePart[] | undefined): {
  content: string;
  toolCalls: ToolCallRequest[];
} {
  let text = "";
  const toolCalls: ToolCallRequest[] = [];
  for (const part of parts ?? []) {
    if (part.text !== undefined) text += part.text;
    if (part.functionCall !== undefined) {
      toolCalls.push({
        // The wire makes the id optional, so a call without one is numbered instead.
        id: part.functionCall.id ?? "call-" + String(toolCalls.length),
        name: part.functionCall.name ?? "",
        arguments: JSON.stringify(part.functionCall.args ?? {}),
      });
    }
  }
  return { content: text, toolCalls };
}

function toFinishReason(raw: string | undefined): FinishReason {
  switch (raw) {
    case "STOP":
      return "stop";
    case "MAX_TOKENS":
      return "length";
    default:
      return "other";
  }
}

function fromWireUsage(usage: WireUsageMetadata | null | undefined): TokenUsage {
  if (usage === undefined || usage === null) return EMPTY_TOKEN_USAGE;
  const inputTokens = usage.promptTokenCount ?? 0;
  const outputTokens = usage.candidatesTokenCount ?? 0;
  const cachedInputTokens = usage.cachedContentTokenCount;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokenCount ?? inputTokens + outputTokens,
    ...(cachedInputTokens === undefined ? {} : { cachedInputTokens }),
  };
}

/**
 * What one stream remembers across events. Gemini sends each function call whole, but
 * a parallel call can arrive in a later event than the first, so the index has to run
 * across the stream; and a call seen early still makes the turn a tool turn when the
 * last event only says STOP.
 */
interface StreamState {
  nextCallIndex: number;
  sawCall: boolean;
}

/** One streamed response may carry text and whole function calls at once. */
function* chunksFor(parsed: WireResponse, state: StreamState): Generator<ChatCompletionChunk> {
  const candidate = parsed.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  let text = "";
  const calls: { name: string; args: unknown; id: string | undefined }[] = [];
  for (const part of parts) {
    if (part.text !== undefined) text += part.text;
    if (part.functionCall !== undefined) {
      calls.push({
        name: part.functionCall.name ?? "",
        args: part.functionCall.args,
        id: part.functionCall.id,
      });
    }
  }
  if (calls.length > 0) state.sawCall = true;

  const reason = candidate?.finishReason;
  const chunk: ChatCompletionChunk = { delta: text };
  if (reason !== undefined) {
    chunk.finishReason = state.sawCall ? "tool_calls" : toFinishReason(reason);
  }
  // A null usage carries no counts; skipping it keeps the total an earlier event reported.
  if (parsed.usageMetadata !== undefined && parsed.usageMetadata !== null) {
    chunk.usage = fromWireUsage(parsed.usageMetadata);
  }

  const deltas = calls.map((call) => {
    const index = state.nextCallIndex;
    state.nextCallIndex += 1;
    return {
      index,
      id: call.id ?? "call-" + String(index),
      name: call.name,
      argumentsDelta: JSON.stringify(call.args ?? {}),
    };
  });
  const first = deltas[0];
  if (first !== undefined) chunk.toolCallDelta = first;

  if (
    text !== "" ||
    chunk.toolCallDelta !== undefined ||
    chunk.finishReason !== undefined ||
    chunk.usage !== undefined
  ) {
    yield chunk;
  }
  for (const extra of deltas.slice(1)) yield { delta: "", toolCallDelta: extra };
}

/** Google's generateContent: contents and parts, a system instruction, and no tool finish reason. */
export class GeminiModel implements Model {
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

  constructor(options: GeminiOptions) {
    if (options.model.trim() === "") {
      throw new Error("GeminiModel needs a model id");
    }
    this.id = options.model;
    this.provider = options.provider ?? "gemini";
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
    const url = methodUrl(this.baseUrl, this.id, "generateContent");
    const response = await this.post(url, this.payload(messages, options), options.signal);
    const body = (await response.json()) as WireResponse;
    const candidate = body.candidates?.[0];
    const parsed = fromWireParts(candidate?.content?.parts);
    return {
      content: parsed.content,
      toolCalls: parsed.toolCalls,
      usage: fromWireUsage(body.usageMetadata),
      // A function call arrives with a STOP, so its presence decides the reason.
      finishReason:
        parsed.toolCalls.length > 0 ? "tool_calls" : toFinishReason(candidate?.finishReason),
    };
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options: GenerateOptions = {},
  ): AsyncGenerator<ChatCompletionChunk> {
    // Without alt=sse the provider answers with a JSON array that is not an event stream.
    const url = methodUrl(this.baseUrl, this.id, "streamGenerateContent") + "?alt=sse";
    const response = await this.post(
      url,
      this.payload(messages, options),
      options.signal,
      "text/event-stream",
    );
    if (response.body === null) {
      throw new Error("The provider returned no body to stream");
    }
    const state: StreamState = { nextCallIndex: 0, sawCall: false };
    for await (const event of parseSse(response.body)) {
      if (event.data === "") continue;
      let parsed: WireResponse;
      try {
        parsed = JSON.parse(event.data) as WireResponse;
      } catch {
        continue; // a keep-alive that is not JSON
      }
      for (const chunk of chunksFor(parsed, state)) yield chunk;
    }
  }

  protected payload(
    messages: readonly ChatMessage[],
    options: GenerateOptions,
  ): Record<string, unknown> {
    const transcript = toWireMessages(messages, options.systemPrompt ?? this.systemPrompt);
    const tools = options.tools;
    const temperature = options.temperature ?? this.temperature;
    const maxTokens = options.maxTokens ?? this.maxTokens;
    const stopSequences = options.stopSequences;
    const config: Record<string, unknown> = {
      ...(temperature === undefined ? {} : { temperature }),
      ...(maxTokens === undefined ? {} : { maxOutputTokens: maxTokens }),
      ...(stopSequences === undefined || stopSequences.length === 0
        ? {}
        : { stopSequences }),
    };
    return {
      ...transcript,
      ...(tools === undefined || tools.length === 0 ? {} : { tools: toWireTools(tools) }),
      ...(Object.keys(config).length === 0 ? {} : { generationConfig: config }),
    };
  }

  private async post(
    url: string,
    body: unknown,
    signal?: AbortSignal,
    accept?: string,
  ): Promise<Response> {
    return postJson(
      this.fetchImpl,
      url,
      body,
      {
        ...(accept === undefined ? {} : { accept }),
        ...(this.apiKey === undefined ? {} : { "x-goog-api-key": this.apiKey }),
        ...this.headers,
      },
      signal,
    );
  }
}
