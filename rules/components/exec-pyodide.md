# Component rule: exec-pyodide

**The guest boundary is fidelity, not security.**
The import allow-list and the tool bridge shape what an agent can reach, and the
package says so wherever it is described. Nothing here is offered as isolation,
and no document may call this executor a sandbox.

**The executor seam stays the only coupling.**
`packages/exec-pyodide/src` depends on the `CodeExecutor` interface from the
core and on the runtime it implements. It never imports the agent loop, no other
package imports it except the facade, an example or a test, and no module under
`src/` imports a Node builtin, so the root entry stays isomorphic.

**A missing runtime fails loudly.**
A host where the runtime cannot load produces a typed executor error. It never
falls back to evaluating guest code in the host realm.

**A deadline the guest cannot honour is paid for, not hidden.**
In process, a stop that wins the race poisons the session and the next step
loads a fresh runtime; `PyodideExecutor` reports no CPU budget, because nothing
in process can enforce one, and never promises a hard wall-clock interrupt.
`PyodideWorkerExecutor` (decision 0041) is the one entry point that may: it
reports `cpuTimeLimitMs` only because terminating its worker enforces it, and a
stop costs the guest's globals and one cold start.

**The worker script names no Node builtin in an import.**
The worker executor and its script reach `worker_threads` through
`process.getBuiltinModule`, so the root entry stays isomorphic. Tools stay on
the host; only names, strings and plain values cross the worker boundary.
