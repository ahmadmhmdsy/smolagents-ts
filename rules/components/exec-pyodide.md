# Component rule: exec-pyodide

**The guest boundary is fidelity, not security.**
The import allow-list and the tool bridge shape what an agent can reach, and the
package says so wherever it is described. Nothing here is offered as isolation,
and no document may call this executor a sandbox.

**The executor seam stays the only coupling.**
`packages/exec-pyodide/src` depends on the `CodeExecutor` interface from the
core and on the runtime it implements. It never imports the agent loop, no other
package imports it except the facade, an example or a test, and no module under
`src/` names a Node builtin, so the root entry stays isomorphic.

**A missing runtime fails loudly.**
A host where the runtime cannot load produces a typed executor error. It never
falls back to evaluating guest code in the host realm.

**A deadline the guest cannot honour is paid for, not hidden.**
A stop that wins the race poisons the session and the next step loads a fresh
runtime. The capability set reports no CPU budget, because nothing here can
enforce one, and no entry point may promise a hard wall-clock interrupt.
