/**
 * @smolagents-ts/exec-pyodide — the Pyodide-backed Python implementation of the core
 * CodeExecutor seam (decision 0016).
 *
 * The package is isomorphic: nothing under src/ imports a Node builtin, so the same barrel
 * loads on Node and in a browser, and the runtime is fetched lazily on the first execute().
 * The seam's own types are not re-exported here; they belong to @smolagents-ts/core.
 */

export { DEFAULT_AUTHORIZED_IMPORTS } from "./imports.js";
export { PyodideExecutor, type PyodideExecutorOptions } from "./executor.js";
export type { PyodideGlobals, PyodideLoader, PyodideRuntime } from "./loader.js";
export { VERSION } from "./version.js";
