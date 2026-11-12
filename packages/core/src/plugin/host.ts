import { PluginError } from "../errors.js";
import type { Logger } from "../logger.js";
import type { PluginEntry } from "../session/run-record.js";
import { digestOf } from "../utils/digest.js";
import type {
  Plugin,
  PluginApi,
  PluginHandle,
  PluginHookName,
  PluginHooks,
  PluginRunInfo,
} from "./plugin.js";

interface Registration {
  readonly plugin: string;
  readonly listener: (...args: never[]) => unknown;
}

/** How a plugin is installed. */
export interface PluginUseOptions {
  /**
   * A plugin the library installs on every agent: it is part of the library's own version, so the
   * run record does not name it and a resume never counts it as drift. Not for user plugins.
   *
   * @internal
   */
  readonly builtin?: boolean;
}

interface Installed {
  readonly entry: PluginEntry;
  readonly builtin: boolean;
  readonly undos: (() => void)[];
  teardown: (() => void) | undefined;
}

/**
 * Holds the plugins an agent uses and dispatches their hooks (decision 0039). The agent decides
 * when registration is allowed; the host only keeps the list, in registration order, and runs it.
 *
 * @experimental
 */
export class PluginHost {
  private readonly installed = new Map<string, Installed>();
  private readonly listeners = new Map<PluginHookName, Registration[]>();
  private revision = 0;

  /**
   * @param logger where emit hooks report a failure they swallowed.
   * @param guard throws when the owner forbids a change right now (a run is active).
   */
  constructor(
    private readonly logger: Logger,
    private readonly guard: () => void = () => undefined,
  ) {}

  /** Bumped on every change, so a cached view of the hooks knows it is stale. */
  get version(): number {
    return this.revision;
  }

  use<TConfig>(plugin: Plugin<TConfig>, options: PluginUseOptions = {}): PluginHandle {
    this.guard();
    const name = plugin.name;
    if (this.installed.has(name)) {
      throw new PluginError("Plugin " + JSON.stringify(name) + " is already in use.", {
        pluginName: name,
      });
    }
    const installed: Installed = {
      entry: { name, version: plugin.version, configDigest: digestOf(plugin.config ?? null) },
      builtin: options.builtin === true,
      undos: [],
      teardown: undefined,
    };
    const api: PluginApi = {
      name,
      on: (hook, listener) => {
        const undo = this.register(name, hook, listener as Registration["listener"]);
        installed.undos.push(undo);
        return undo;
      },
    };
    this.installed.set(name, installed);
    try {
      const teardown = plugin.setup(api, plugin.config);
      installed.teardown = typeof teardown === "function" ? teardown : undefined;
    } catch (error) {
      this.remove(name);
      throw error;
    }
    this.revision += 1;
    let disposed = false;
    return {
      name,
      dispose: () => {
        if (disposed) return;
        this.guard();
        disposed = true;
        this.remove(name);
      },
    };
  }

  /** The active plugins as the run record names them, in registration order; built-ins excluded. */
  entries(): readonly PluginEntry[] {
    return [...this.installed.values()]
      .filter((installed) => !installed.builtin)
      .map((installed) => installed.entry);
  }

  has(hook: PluginHookName): boolean {
    return (this.listeners.get(hook)?.length ?? 0) > 0;
  }

  /**
   * Run a waterfall hook: each listener sees the previous one's value and returns a replacement,
   * or `undefined` to keep it. A listener's failure is the caller's failure.
   */
  async waterfall<K extends "model:request" | "tool:before" | "tool:after">(
    hook: K,
    value: Parameters<PluginHooks[K]>[0],
    info: Parameters<PluginHooks[K]>[1],
  ): Promise<Parameters<PluginHooks[K]>[0]> {
    let current = value;
    for (const registration of this.snapshot(hook)) {
      const listener = registration.listener as unknown as (
        value: unknown,
        info: unknown,
      ) => unknown;
      const next = await listener(current, info);
      if (next !== undefined) current = next as typeof current;
    }
    return current;
  }

  /**
   * Run an emit hook. Listeners are not awaited and cannot fail the run: a throw or a rejected
   * promise is logged and the next listener still runs.
   */
  emit<K extends "model:response" | "step:end">(
    hook: K,
    ...args: Parameters<PluginHooks[K]>
  ): void {
    for (const registration of this.snapshot(hook)) {
      const report = (error: unknown) =>
        this.logger.warn("plugin: " + hook + " listener failed", {
          plugin: registration.plugin,
          error: error instanceof Error ? error.message : String(error),
        });
      try {
        const listener = registration.listener as unknown as (...values: unknown[]) => unknown;
        const result = listener(...args);
        if (result instanceof Promise) result.catch(report);
      } catch (error) {
        report(error);
      }
    }
  }

  /** Run `answer:check` in order; the first rejection's reason is returned, and the rest skipped. */
  async check(answer: unknown, info: PluginRunInfo): Promise<string | undefined> {
    for (const registration of this.snapshot("answer:check")) {
      const listener = registration.listener as unknown as PluginHooks["answer:check"];
      const verdict = await listener(answer, info);
      if (verdict !== undefined && verdict !== null && typeof verdict.reject === "string") {
        return verdict.reject;
      }
    }
    return undefined;
  }

  private snapshot(hook: PluginHookName): readonly Registration[] {
    return [...(this.listeners.get(hook) ?? [])];
  }

  private register(
    plugin: string,
    hook: PluginHookName,
    listener: Registration["listener"],
  ): () => void {
    this.guard();
    if (typeof listener !== "function") {
      throw new PluginError(
        "Plugin " +
          JSON.stringify(plugin) +
          " registered a non-function listener for " +
          hook +
          ".",
        { pluginName: plugin },
      );
    }
    const registration: Registration = { plugin, listener };
    const list = this.listeners.get(hook) ?? [];
    list.push(registration);
    this.listeners.set(hook, list);
    this.revision += 1;
    let undone = false;
    return () => {
      if (undone) return;
      this.guard();
      undone = true;
      const current = this.listeners.get(hook);
      if (current === undefined) return;
      const index = current.indexOf(registration);
      if (index !== -1) current.splice(index, 1);
      if (current.length === 0) this.listeners.delete(hook);
      this.revision += 1;
    };
  }

  private remove(name: string): void {
    const installed = this.installed.get(name);
    if (installed === undefined) return;
    for (const undo of installed.undos.splice(0).reverse()) undo();
    this.installed.delete(name);
    this.revision += 1;
    const teardown = installed.teardown;
    installed.teardown = undefined;
    if (teardown !== undefined) {
      try {
        teardown();
      } catch (error) {
        this.logger.warn("plugin: teardown failed", {
          plugin: name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
