import {
  MODEL_ADAPTER_VERSION,
  modelCapabilities,
  type ChatCompletion,
  type ChatCompletionChunk,
  type ChatMessage,
  type GenerateOptions,
  type ModelAdapterV2,
  type ModelCapabilities,
} from "@smolagents-ts/core";
import { OpenAICompatibleModel, type OpenAICompatibleOptions } from "@smolagents-ts/models";
import { DEFAULT_GATEWAY_HEADER_PREFIXES, readGatewayHeaders, type GatewayResponse } from "./headers.js";

/** The fetch a gateway model calls; injected so a test or a browser tab supplies its own. */
export type GatewayFetch = (url: string, init: RequestInit) => Promise<Response>;

/** Which call a `GatewayResponse` belongs to. */
export interface GatewayResponseContext {
  /** The id this model was configured with, which is what the run record names. */
  readonly modelId: string;
  /** Whether the call was `generateStream` rather than `generate`. */
  readonly stream: boolean;
  /** The HTTP status the gateway answered with. */
  readonly status: number;
}

export interface GatewayModelOptions {
  /** The id the gateway routes on: a model, a combo, or `auto`. */
  model: string;
  /** Everything before "/chat/completions", for example "http://localhost:20128/v1". */
  baseUrl: string;
  apiKey?: string;
  fetch?: GatewayFetch;
  /** Extra request headers, sent on every call. */
  headers?: Readonly<Record<string, string>>;
  /**
   * What the configured id can do. `toolCalls` defaults to false, because one gateway id can
   * route to a model without tools; set it after pinning an id you know calls tools.
   */
  capabilities?: Partial<ModelCapabilities>;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  /** Reported as the model's provider; defaults to "gateway". */
  provider?: string;
  /** Response headers copied into `GatewayResponse.headers`; defaults to `x-omniroute-`. */
  headerPrefixes?: readonly string[];
  /**
   * Called once per completed request with what the gateway's headers said. The model keeps no
   * copy, so two runs sharing one model never read each other's value; to tie the event to one
   * run, give that run its own `GatewayModel`. An exception thrown here reaches the caller of
   * `generate` or `generateStream`.
   */
  onResponse?: (response: GatewayResponse, context: GatewayResponseContext) => void;
}

/** One call's view of the response it received, filled by that call's own fetch. */
interface CallSlot {
  response?: GatewayResponse;
  status?: number;
}

/**
 * A model reached through an OpenAI-compatible AI gateway such as OmniRoute (decision 0040).
 * The wire is the shipped `OpenAICompatibleModel`'s; this class adds only what a gateway puts
 * in its response headers, read through the adapter's injected `fetch` and reported through
 * `onResponse`. Each call builds its own adapter around its own fetch, so concurrent calls
 * cannot see each other's headers.
 */
export class GatewayModel implements ModelAdapterV2 {
  readonly id: string;
  readonly provider: string;
  readonly capabilities: ModelCapabilities;
  readonly adapterVersion = MODEL_ADAPTER_VERSION;

  private readonly adapterOptions: Omit<OpenAICompatibleOptions, "fetch">;
  private readonly fetchImpl: GatewayFetch;
  private readonly prefixes: readonly string[];
  private readonly onResponse: GatewayModelOptions["onResponse"];

  constructor(options: GatewayModelOptions) {
    if (options.model.trim() === "") throw new Error("GatewayModel needs a model id");
    if (options.baseUrl.trim() === "") throw new Error("GatewayModel needs the gateway's baseUrl");
    this.id = options.model;
    this.provider = options.provider ?? "gateway";
    this.capabilities = modelCapabilities({
      toolCalls: false,
      images: true,
      audio: true,
      ...options.capabilities,
    });
    this.adapterOptions = {
      model: options.model,
      baseUrl: options.baseUrl,
      provider: this.provider,
      capabilities: this.capabilities,
      ...(options.apiKey === undefined ? {} : { apiKey: options.apiKey }),
      ...(options.headers === undefined ? {} : { headers: options.headers }),
      ...(options.systemPrompt === undefined ? {} : { systemPrompt: options.systemPrompt }),
      ...(options.temperature === undefined ? {} : { temperature: options.temperature }),
      ...(options.maxTokens === undefined ? {} : { maxTokens: options.maxTokens }),
    };
    const fetchImpl = options.fetch ?? (globalThis.fetch as GatewayFetch | undefined);
    if (typeof fetchImpl !== "function") {
      throw new Error("No fetch available: pass options.fetch in an environment without one");
    }
    this.fetchImpl = fetchImpl;
    this.prefixes = options.headerPrefixes ?? DEFAULT_GATEWAY_HEADER_PREFIXES;
    this.onResponse = options.onResponse;
  }

  async generate(
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): Promise<ChatCompletion> {
    const slot: CallSlot = {};
    const completion = await this.adapterFor(slot).generate(messages, options);
    this.report(slot, false);
    return completion;
  }

  async *generateStream(
    messages: readonly ChatMessage[],
    options?: GenerateOptions,
  ): AsyncIterable<ChatCompletionChunk> {
    const slot: CallSlot = {};
    yield* this.adapterFor(slot).generateStream(messages, options);
    this.report(slot, true);
  }

  private adapterFor(slot: CallSlot): OpenAICompatibleModel {
    const fetchImpl = this.fetchImpl;
    const prefixes = this.prefixes;
    return new OpenAICompatibleModel({
      ...this.adapterOptions,
      fetch: async (url, init) => {
        const response = await fetchImpl(url, init);
        slot.status = response.status;
        slot.response = readGatewayHeaders(response.headers, prefixes);
        return response;
      },
    });
  }

  private report(slot: CallSlot, stream: boolean): void {
    if (this.onResponse === undefined || slot.response === undefined) return;
    this.onResponse(slot.response, { modelId: this.id, stream, status: slot.status ?? 0 });
  }
}
