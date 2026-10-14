import type { Model } from "@smolagents-ts/core";
import { HuggingFaceModel, OpenAICompatibleModel } from "@smolagents-ts/models";
import { UnsupportedModelTypeError } from "./errors.js";

/** The variable Hugging Face documents for a token. Read only when --api-key is absent. */
export const HF_TOKEN_VARIABLE = "HF_TOKEN";
/** The variable OpenAI documents for a key. Read only when --api-key is absent. */
export const OPENAI_API_KEY_VARIABLE = "OPENAI_API_KEY";

export interface ModelConfig {
  modelType: string;
  modelId: string;
  provider?: string;
  apiBase?: string;
  apiKey?: string;
}

export interface ModelFactoryOptions {
  /** Injected so a test never reads the host's environment. Defaults to an empty map. */
  env?: Readonly<Record<string, string | undefined>>;
}

/**
 * The key the adapter should use. An explicit value wins. Otherwise the provider's
 * documented variable is read. Neither the value nor its absence is ever returned
 * to a renderer, so nothing here can reach the output.
 */
export function resolveApiKey(
  modelType: string,
  explicit: string | undefined,
  env: Readonly<Record<string, string | undefined>>,
): string | undefined {
  if (explicit !== undefined && explicit.length > 0) return explicit;
  if (modelType === "InferenceClientModel") return env[HF_TOKEN_VARIABLE];
  if (modelType === "OpenAIModel") return env[OPENAI_API_KEY_VARIABLE];
  return undefined;
}

/**
 * Build the model the configuration names.
 *
 * InferenceClientModel is this port's HuggingFaceModel, the adapter pointed at the
 * Inference Providers router; OpenAIModel is OpenAICompatibleModel, which speaks to
 * any endpoint that copies OpenAI's chat-completions wire. LiteLLMModel and
 * TransformersModel have no adapter here and are refused by name.
 *
 * Upstream uses --provider to select an Inference Provider, and points OpenAIModel
 * at Fireworks by default with FIREWORKS_API_KEY. This port passes the provider
 * through as the reported label, because HuggingFaceModel has no provider-selection
 * option, and it lets OpenAIModel fall back to its own OpenAI default.
 */
export function loadModel(config: ModelConfig, options: ModelFactoryOptions = {}): Model {
  const env = options.env ?? {};
  const apiKey = resolveApiKey(config.modelType, config.apiKey, env);

  if (config.modelType === "InferenceClientModel") {
    return new HuggingFaceModel({
      model: config.modelId,
      ...(config.provider === undefined ? {} : { provider: config.provider }),
      ...(config.apiBase === undefined ? {} : { baseUrl: config.apiBase }),
      ...(apiKey === undefined ? {} : { apiKey }),
    });
  }

  if (config.modelType === "OpenAIModel") {
    return new OpenAICompatibleModel({
      model: config.modelId,
      ...(config.apiBase === undefined ? {} : { baseUrl: config.apiBase }),
      ...(apiKey === undefined ? {} : { apiKey }),
    });
  }

  throw new UnsupportedModelTypeError(config.modelType);
}
