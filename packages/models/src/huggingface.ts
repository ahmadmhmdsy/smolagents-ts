import { OpenAICompatibleModel, type OpenAICompatibleOptions } from "./openai-compatible.js";

/** The router takes the OpenAI adapter's options; only the defaults differ. */
export type HuggingFaceOptions = OpenAICompatibleOptions;

const DEFAULT_BASE_URL = "https://router.huggingface.co/v1";

/**
 * The Inference Providers router is an OpenAI-compatible endpoint: the mapping, the
 * streaming reader, the usage request and the error type are the shipped adapter's.
 * Only the host and the provider name differ, so this is a subclass and not a copy.
 */
export class HuggingFaceModel extends OpenAICompatibleModel {
  constructor(options: HuggingFaceOptions) {
    super({
      ...options,
      provider: options.provider ?? "huggingface",
      baseUrl: options.baseUrl ?? DEFAULT_BASE_URL,
    });
  }
}
