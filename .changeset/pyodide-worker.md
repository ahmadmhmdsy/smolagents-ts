---
"@smolagents-ts/exec-pyodide": minor
---

Add `PyodideWorkerExecutor` (decision 0041): the same Pyodide executor, run in a worker the host
terminates at a step's deadline or on an abort, so even a synchronous `while True: pass` ends with
the usual timeout or cancellation error. It reports `capabilities.cpuTimeLimitMs` (default 30,000)
because termination enforces it. A stop loses the guest's globals and the next step starts a fresh
worker; tool calls are message round trips to the host, where the tools run. The worker script
ships as `dist/pyodide-worker.js`; on Node it is a `worker_threads` worker, in a browser a module
`Worker`, and `workerUrl` or `createWorker` replaces it. `PyodideExecutor` is unchanged and stays
the default.
