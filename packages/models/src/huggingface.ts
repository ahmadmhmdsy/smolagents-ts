import type { ChatCompletionChunk, ChatMessage, GenerateOptions } from "@smolagents-ts/core";
import { OpenAICompatibleModel, type OpenAICompatibleOptions } from "./openai-compatible.js";

/** The router takes the OpenAI adapter's options; only the defaults differ. */
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
    // Without this the router reports no tokens at all on a streamed run.
    return stream ? { ...body, stream_options: { include_usage: true } } : body;
  }
}
