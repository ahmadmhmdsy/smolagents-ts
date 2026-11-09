import type { ModelCapabilities } from "@smolagents-ts/core";
import { OpenAICompatibleModel, type OpenAICompatibleOptions } from "./openai-compatible.js";

/**
 * The options for a local runtime preset: `OpenAICompatibleModel`'s, with the base URL optional
 * and the provider fixed. No key is required; pass `apiKey` when the server was started with one.
 */
export type LocalModelOptions = Omit<OpenAICompatibleOptions, "baseUrl" | "provider"> & {
  /** Everything before "/chat/completions". Defaults to the runtime's own local address. */
  baseUrl?: string;
};

interface Preset {
  provider: string;
  baseUrl: string;
  capabilities: Partial<ModelCapabilities>;
}

/**
 * What each runtime gives without extra server flags (decision 0038). Images and audio are off
 * because they depend on the model loaded, not the runtime; tool calls are off where the server
 * needs a flag to parse them. Claim more through `capabilities` once the server can do it.
 */
const PRESETS = {
  ollama: { provider: "ollama", baseUrl: "http://localhost:11434/v1", capabilities: { toolCalls: true } },
  lmStudio: { provider: "lm-studio", baseUrl: "http://localhost:1234/v1", capabilities: { toolCalls: true } },
  llamaCpp: { provider: "llama-cpp", baseUrl: "http://localhost:8080/v1", capabilities: { toolCalls: false } },
  vllm: { provider: "vllm", baseUrl: "http://localhost:8000/v1", capabilities: { toolCalls: false } },
} as const satisfies Record<string, Preset>;

function preset(which: Preset, options: LocalModelOptions): OpenAICompatibleModel {
  return new OpenAICompatibleModel({
    ...options,
    baseUrl: options.baseUrl ?? which.baseUrl,
    provider: which.provider,
    capabilities: { images: false, audio: false, ...which.capabilities, ...options.capabilities },
  });
}

/**
 * A model served by Ollama, at `http://localhost:11434/v1` unless `baseUrl` says otherwise.
 * Tool calls are on: Ollama parses them for models whose template supports tools. Start the
 * server yourself (`ollama serve`); this function starts nothing.
 */
export function ollamaModel(options: LocalModelOptions): OpenAICompatibleModel {
  return preset(PRESETS.ollama, options);
}

/**
 * A model served by LM Studio's local server, at `http://localhost:1234/v1` unless `baseUrl` says
 * otherwise. Tool calls are on. Start the server from LM Studio or `lms server start`.
 */
export function lmStudioModel(options: LocalModelOptions): OpenAICompatibleModel {
  return preset(PRESETS.lmStudio, options);
}

/**
 * A model served by llama.cpp's `llama-server`, at `http://localhost:8080/v1` unless `baseUrl`
 * says otherwise. The server answers with whatever model it loaded, so `model` defaults to
 * `"default"`. Tool calls are off: claim them when the server runs with `--jinja`.
 */
export function llamaCppModel(
  options: Omit<LocalModelOptions, "model"> & { model?: string } = {},
): OpenAICompatibleModel {
  return preset(PRESETS.llamaCpp, { ...options, model: options.model ?? "default" });
}

/**
 * A model served by vLLM's OpenAI-compatible server, at `http://localhost:8000/v1` unless
 * `baseUrl` says otherwise. `model` is the name the server was started with. Tool calls are off:
 * claim them when the server runs with `--enable-auto-tool-choice` and a `--tool-call-parser`.
 */
export function vllmModel(options: LocalModelOptions): OpenAICompatibleModel {
  return preset(PRESETS.vllm, options);
}
