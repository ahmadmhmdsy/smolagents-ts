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
}

interface WireResponse {
  candidates?: WireCandidate[];
  usageMetadata?: WireUsageMetadata;
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

function fromWireUsage(usage: WireUsageMetadata | undefined): TokenUsage {
  if (usage === undefined) return EMPTY_TOKEN_USAGE;
  const inputTokens = usage.promptTokenCount ?? 0;
  const outputTokens = usage.candidatesTokenCount ?? 0;
  return {
    inputTokens,
    outputTokens,
    totalTokens: usage.totalTokenCount ?? inputTokens + outputTokens,
  };
}

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
  if (reason !== undefined) {
    chunk.finishReason = calls.length > 0 ? "tool_calls" : toFinishReason(reason);
  }
  if (parsed.usageMetadata !== undefined) chunk.usage = fromWireUsage(parsed.usageMetadata);

  if (
    text !== "" ||
    chunk.toolCallDelta !== undefined ||
    chunk.finishReason !== undefined ||
    chunk.usage !== undefined
  ) {
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
    for await (const event of parseSse(response.body)) {
      if (event.data === "") continue;
      let parsed: WireResponse;
      try {
        parsed = JSON.parse(event.data) as WireResponse;
      } catch {
        continue; // a keep-alive that is not JSON
      }
      for (const chunk of chunksFor(parsed)) yield chunk;
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
