import type { ChatCompletion, GenerateOptions } from "../model.js";
import type { ChatMessage } from "../types.js";

/**
 * The plugin contract (decision 0039). A plugin is a name, a version, an optional config and a
 * `setup` that registers hook listeners. The host names every active plugin on the run record, so
 * a resume or fork under a different set is refused unless the caller opts into drift.
 *
 * @experimental No hook name is frozen until the T-76 proof plugins pass on these hooks alone.
 */

/** Where a hook fires: the run and the step it belongs to. */
export interface PluginRunInfo {
  readonly runId: string;
  readonly stepIndex: number;
}

/** A tool hook's view of the call: the tool's name and the call id the record keys it by. */
export interface PluginToolInfo extends PluginRunInfo {
  readonly name: string;
  readonly callId: string;
}

/** A step that has finished and is about to be committed. */
export interface PluginStepInfo extends PluginRunInfo {
  readonly stepId: string;
}

/**
 * The request a model turn is about to send. A `model:request` listener may return a changed copy
 * of the messages or the options; it may not swap the model (rule 4), so a result with a `model`
 * key is refused.
 */
export interface PluginModelRequest {
  readonly messages: readonly ChatMessage[];
  readonly options: GenerateOptions;
}

/** What an `answer:check` listener returns to refuse a final answer; the reason reaches the model. */
export interface PluginAnswerRejection {
  readonly reject: string;
}

type Awaitable<T> = T | Promise<T>;

/**
 * Every hook and the shape of its listener. Waterfall hooks return a replacement or `undefined`
 * for unchanged; emit hooks return nothing and their failures are logged, never thrown; the serial
 * `answer:check` stops at the first rejection.
 *
 * @experimental
 */
export interface PluginHooks {
  /** Waterfall, before the request is digested and sent. Runs on replay too, so keep it pure. */
  "model:request": (
    request: PluginModelRequest,
    info: PluginRunInfo,
  ) => Awaitable<PluginModelRequest | undefined>;
  /** Emit, after a live completion. A replayed completion does not fire it. */
  "model:response": (completion: ChatCompletion, info: PluginRunInfo) => void | Promise<void>;
  /**
   * Waterfall over the call's arguments, before the approval gate. A rewrite is validated against
   * the tool's input schema again, and the result is frozen: nothing changes it after approval.
   * Hosted tools never reach it; the provider runs them.
   */
  "tool:before": (args: unknown, info: PluginToolInfo) => Awaitable<unknown>;
  /** Waterfall over the tool's output, before the run journals and delivers it. */
  "tool:after": (output: unknown, info: PluginToolInfo) => Awaitable<unknown>;
  /** Serial, after the output schema passes. The first rejection becomes a correction step. */
  "answer:check": (
    answer: unknown,
    info: PluginRunInfo,
  ) => Awaitable<PluginAnswerRejection | undefined | void>;
  /** Emit, when a step finishes and before its boundary is committed. */
  "step:end": (info: PluginStepInfo) => void | Promise<void>;
}

/** @experimental */
export type PluginHookName = keyof PluginHooks;

/** What `setup` registers through. Every registration returns its own undo. */
export interface PluginApi {
  readonly name: string;
  on<K extends PluginHookName>(hook: K, listener: PluginHooks[K]): () => void;
}

/** @experimental */
export interface Plugin<TConfig = unknown> {
  readonly name: string;
  readonly version: string;
  /** Digested into the run record, so a changed config is drift too. Must be JSON-shaped. */
  readonly config?: TConfig;
  /** Register listeners. May return a teardown that `dispose()` runs after the undos. */
  setup(api: PluginApi, config: TConfig | undefined): void | (() => void);
}

/** What `use()` returns: `dispose()` removes every registration the plugin made. */
export interface PluginHandle {
  readonly name: string;
  dispose(): void;
}

/**
 * Declare a plugin. An identity function that checks the name and the version early, so a
 * mistake fails where the plugin is written rather than where it is used.
 *
 * @experimental
 */
export function definePlugin<TConfig = unknown>(plugin: Plugin<TConfig>): Plugin<TConfig> {
  if (typeof plugin.name !== "string" || plugin.name.trim() === "") {
    throw new TypeError("A plugin needs a non-empty name.");
  }
  if (typeof plugin.version !== "string" || plugin.version.trim() === "") {
    throw new TypeError("Plugin " + JSON.stringify(plugin.name) + " needs a non-empty version.");
  }
  if (typeof plugin.setup !== "function") {
    throw new TypeError("Plugin " + JSON.stringify(plugin.name) + " needs a setup function.");
  }
  return plugin;
}
