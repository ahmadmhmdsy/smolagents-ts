import { PluginError } from "../errors.js";
import type { Tool } from "../tool/tool.js";
import type { PluginHost } from "./host.js";

/**
 * Deep-freeze a copy of a call's arguments, so nothing after `tool:before` (the approval gate,
 * a listener holding a reference) can change what the tool runs with (decision 0039, rule 2).
 * Binary views are left as they are: a typed array cannot be frozen.
 */
export function sealArgs<T>(value: T): T {
  let copy: T;
  try {
    copy = structuredClone(value);
  } catch {
    copy = value;
  }
  return deepFreeze(copy);
}

function deepFreeze<T>(value: T, seen = new WeakSet<object>()): T {
  if (value === null || typeof value !== "object") return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  if (seen.has(value)) return value;
  seen.add(value);
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key], seen);
  }
  try {
    Object.freeze(value);
  } catch {
    // An exotic object that refuses to freeze keeps its contents frozen at least.
  }
  return value;
}

/**
 * Wrap a tool so its calls run the `tool:before` and `tool:after` hooks (decision 0039, rule 3).
 * The wrapper sits outside the approval gate, so the gate sees the rewritten, frozen arguments
 * and nothing rewrites them after it. A hosted tool is returned as is: its provider runs it.
 *
 * @experimental
 */
export function withToolHooks<T extends Tool>(entry: T, host: PluginHost, runId: () => string): T {
  if (entry.kind === "hosted") return entry;
  return {
    ...entry,
    async execute(input, context) {
      const info = {
        runId: runId(),
        stepIndex: context.stepIndex,
        name: entry.name,
        callId: context.callId,
      };
      let args: unknown = input;
      if (host.has("tool:before")) {
        const rewritten = await host.waterfall("tool:before", input, info);
        if (rewritten !== input) {
          const parsed = entry.inputSchema.safeParse(rewritten);
          if (!parsed.success) {
            throw new PluginError(
              "A tool:before listener rewrote the arguments of " +
                JSON.stringify(entry.name) +
                " into a shape its input schema refuses: " +
                parsed.error.message,
              { stepIndex: context.stepIndex },
            );
          }
          args = parsed.data;
        }
      }
      const output: unknown = await entry.execute(sealArgs(args), context);
      if (!host.has("tool:after")) return output;
      return host.waterfall("tool:after", output, info);
    },
  } as T;
}
