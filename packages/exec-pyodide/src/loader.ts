/**
 * The runtime seam. The executor never sees the `pyodide` package itself, only this narrow
 * surface, so a test stands a fake in for the 13 MiB runtime and a browser page injects a
 * runtime loaded from a CDN base.
 */

/** The Python global namespace as the executor reads and writes it. */
export interface PyodideGlobals {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
  has(name: string): boolean;
  delete(name: string): void;
}

/**
 * The members of the loaded runtime the executor calls. `version` is the one reader;
 * `setStdout`/`setStderr` take the batched handler form, which receives whole lines.
 */
export interface PyodideRuntime {
  readonly version: string;
  readonly globals: PyodideGlobals;
  runPython(code: string): unknown;
  runPythonAsync(code: string): Promise<unknown>;
  setStdout(options: { batched: (text: string) => void }): void;
  setStderr(options: { batched: (text: string) => void }): void;
}

/**
 * Resolves a runtime. The default lazily imports the `pyodide` package, so constructing an
 * executor pulls none of the 13 MiB and importing the barrel touches no WASM; a page passes
 * `indexURL` so the assets come from the loader's own CDN base.
 */
export type PyodideLoader = (options?: { readonly indexURL?: string }) => Promise<PyodideRuntime>;

/**
 * The default loader. `import("pyodide")` is dynamic and type-erased to a structural cast,
 * because the package's own `PyProxy` type is wider than the surface the executor uses and
 * coupling to it would make the seam untestable.
 */
export const defaultPyodideLoader: PyodideLoader = async (options) => {
  const { loadPyodide } = await import("pyodide");
  const runtime = await loadPyodide(
    options?.indexURL === undefined ? undefined : { indexURL: options.indexURL },
  );
  return runtime as unknown as PyodideRuntime;
};
