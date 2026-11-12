import type { Monitor } from "../../monitoring/monitor.js";
import { definePlugin, type Plugin } from "../plugin.js";

/** The name the built-in monitor plugin installs under; a user plugin may not take it. */
export const MONITOR_PLUGIN_NAME = "smolagents:monitor";

/**
 * The per-run token and timing accounting, as a plugin on `model:response` alone (decision 0039,
 * the T-76 proof). Every agent installs it as a built-in, so it records each live completion into
 * whichever `Monitor` the current run owns. A replayed completion fires no `model:response`, so a
 * resumed run counts only the calls it made; a turn whose provider reported no usage is skipped,
 * as the inline wiring this replaces skipped it.
 *
 * @param target the monitor to record into, read on every completion because a run replaces it.
 * @experimental
 */
export function monitorPlugin(target: () => Monitor): Plugin {
  return definePlugin({
    name: MONITOR_PLUGIN_NAME,
    version: "1.0.0",
    setup: (api) => {
      api.on("model:response", (_completion, info) => {
        if (info.usage !== undefined) target().record(info.modelId, info.usage, info.durationMs);
      });
    },
  });
}
