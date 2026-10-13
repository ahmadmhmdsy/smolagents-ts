/**
 * @smolagents-ts/exec-quickjs — the QuickJS-WASM code executor.
 *
 * The seam's own types stay in the core: re-exporting them here would give one interface a
 * second home.
 */
export { VERSION } from "./version.js";
export { QuickJSExecutor } from "./executor.js";
export type { QuickJSExecutorOptions } from "./executor.js";
export { buildGuestSource } from "./guest-source.js";
export type { BuildGuestSourceOptions } from "./guest-source.js";
