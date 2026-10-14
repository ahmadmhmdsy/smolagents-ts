---
"@smolagents-ts/exec-pyodide": minor
---

Add the Pyodide-backed Python executor.

`@smolagents-ts/exec-pyodide` satisfies the core `CodeExecutor` seam for
`language: "python"`, running agent-authored Python in an in-process
Pyodide-WASM runtime on Node and in the browser, with an injectable loader, a
host tool bridge and upstream's import allow-list.
