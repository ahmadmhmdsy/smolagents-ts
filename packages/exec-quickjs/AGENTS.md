# exec-quickjs — scoped entry

## What this component is

`@smolagents-ts/exec-quickjs` is the first real implementation of the
`CodeExecutor` seam: it runs agent-authored JavaScript in a QuickJS-WASM realm
and reports an explicit capability set. One instance serves one agent run — the
realm is created on the first step, reused by every later step so a variable
defined in one step is readable in the next, and released when the run ends.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/exec-quickjs/src/index.ts` | the three names the surface test pins |
| executor | `packages/exec-quickjs/src/executor.ts` | `QuickJSExecutor`; the realm, the bridge and `dispose()` |
| guest program | `packages/exec-quickjs/src/guest-source.ts` | `buildGuestSource`; the prelude, the wrapper and the capture epilogue |
| marshalling | `packages/exec-quickjs/src/marshal.ts` | tool results out as JSON, guest failures into `AgentErrorInfo` |
| version marker | `packages/exec-quickjs/src/version.ts` | the value the smoke test asserts |

## Smallest validation command

    pnpm vitest run --project exec-quickjs

Expected result: six files with twenty-nine tests, exit code 0. Run
`pnpm --filter @smolagents-ts/exec-quickjs run typecheck` beside it: the runner
erases types, so only the compiler checks the QuickJS handle lifetimes this
package is built on.

## Boundaries

This package owns the QuickJS-backed executor and the engine dependency that
comes with it. It owns no agent loop and no policy about which tools the guest
can reach: the sandbox contract belongs to the `CodeExecutor` interface in the
core, and the seam's types are not re-exported here.

## Hazards

- The release build aborts the whole WASM module when a handle outlives its
  runtime, and that abort is a catchable exception a caller cannot act on, so
  `dispose()` reports it through the last logger it saw.
- A host function returns a handle or nothing: a number return value is read as a
  pointer, which aborted the first spike run.
- One realm serves every step, so a second top-level `const` is a redeclaration
  error. The prelude declares with `var`, tool names are bracket assignments, and
  a declaration made inside the async wrapper is copied onto the global object
  before the wrapper returns.
- The engine is synchronous. A host tool call moves only while the executor
  drives `executePendingJobs` and hands the host its macrotasks, so the drain
  loop is the bridge rather than an implementation detail.
- The engine ships a prebuilt platform binary through the package manager, so a
  dependency change can break a platform that CI does not cover.
- A green smoke test proves the package resolves and runs; it proves nothing
  about the sandbox.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/exec-quickjs.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
