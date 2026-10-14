# exec-pyodide — scoped entry

## What this component is

`@smolagents-ts/exec-pyodide` is the Python `CodeExecutor`: it runs
agent-authored Python on WASM CPython in this process, on Node and in a browser
page. One instance serves one agent run — the runtime is loaded on the first step
and reused, so a variable assigned in one step is readable in the next. Decision
0016 owns the posture: there is no worker, no interrupt, and the import
allow-list is fidelity rather than a security boundary.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/exec-pyodide/src/index.ts` | the three names the surface test pins |
| executor | `packages/exec-pyodide/src/executor.ts` | `PyodideExecutor`; capabilities, the deadline race, the poisoning |
| loader and session | `packages/exec-pyodide/src/{loader,runtime}.ts` | the injectable loader, and the one runtime a run reuses |
| guest program | `packages/exec-pyodide/src/{guest-source,bridge,imports}.ts` | the Python prelude, the tool bridge, the import guard |
| streams | `packages/exec-pyodide/src/streams.ts` | the log buffer and upstream's 50,000-character truncation |
| browser probe | `docs/10-runbooks/exec-pyodide-browser-probe.md` | how the cold start and the bundle were measured |

## Smallest validation command

    pnpm vitest run --project exec-pyodide

Expected result: nine files with fifty-five tests, exit code 0. Two of them load
the real runtime — about two seconds, no network — so the suite also proves the
Python seam rather than only the TypeScript around it. Run
`pnpm --filter @smolagents-ts/exec-pyodide run typecheck` beside it: the runner
erases types, and the loader's runtime interface is only checked by the compiler.

## Boundaries

This package owns the Pyodide-backed executor and the runtime dependency that
comes with it. It owns no agent loop and no policy about which tools the guest
can reach: the seam belongs to the core's `CodeExecutor`, and the seam's types
are not re-exported here. The facade depends on it; nothing else does.

## Hazards

- Nothing on the host can interrupt a synchronous guest loop. A deadline or an
  abort is honoured at the next await boundary, and a run that ignores both runs
  to completion; the executor poisons the runtime when a stop wins, so the next
  step pays one cold start rather than sharing a live interpreter.
- The import guard is scoped to the guest's own globals, because a real
  interpreter routes every module's internal imports through the hook and a
  global replacement refuses `_io` on the default list. A guest that restores
  the builtin, or calls it with another globals mapping, steps around the guard.
- `final_answer` records its value and then raises a `BaseException`, so the
  answer reaches the host as the run's rejection; the host reads the recorded
  flag, not the exception, because a guest may still catch the signal.
- A rejected JavaScript promise arrives in Python as `pyodide.ffi.JsException`,
  so the bridge answers with an envelope and the emitted wrapper raises
  `RuntimeError` naming the tool.
- The runtime is 13.40 MiB installed and a cold start is 1.94–2.35 s on Node and
  2,912 ms in the measured browser; the first step of a run pays it.
- A green smoke test proves the package resolves and runs; it proves nothing
  about isolation.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/exec-pyodide.md`.

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
