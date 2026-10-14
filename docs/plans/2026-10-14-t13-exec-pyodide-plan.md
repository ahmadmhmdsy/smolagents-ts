# T-13 Task 4 — the Pyodide executor Implementation Plan

## Contract

- **Role:** the implementation plan for Task 4 of
  `docs/plans/2026-10-14-v1.5-modules-plan.md`, the Pyodide-backed
  `CodeExecutor` the design's fallback ladder names.
- **Mutability:** frozen once execution begins. A wrong step is corrected by a
  dated note under the task that owns it; its text is not edited.
- **Read when:** executing Task 4, or checking what Task 4 promised.
- **Update when:** a measured result differs from its prediction, or a task is
  added or dropped.

**Goal:** a ninth package, `@smolagents-ts/exec-pyodide`, whose
`PyodideExecutor` answers `language: "python"` and satisfies the core
`CodeExecutor` seam on Node and the browser without a worker.

**Architecture:** four layers over the loaded runtime.

1. **Loader** (`src/loader.ts`) — `PyodideLoader` resolves a
   `PyodideRuntime`; the default lazily imports `loadPyodide`, so a test
   passes a fake and a browser page a CDN instance.
2. **Session** (`src/runtime.ts`) — one runtime per executor, created on the
   first `execute()`, kept so guest globals persist, dropped by `dispose()`.
3. **Guest program** (`src/guest-source.ts`, `src/bridge.ts`,
   `src/imports.ts`) — the prelude, the `final_answer` signal, the tool
   callables and the import guard.
4. **Executor** (`src/executor.ts`, `src/streams.ts`) — capabilities,
   `execute()`, capture, truncation and error mapping.

`execute()` installs the prelude and this call's tool callables, then runs
`runPythonAsync`. A guest tool call runs in the host through the sibling's
`ToolRegistry`, with the caller's `signal`.

**Spec:** design lines 119, 339, 824 and 962 in
`docs/design/2026-10-12-smolagents-ts-v1-design.md`; the vendored upstream
clone's `smolagents/src/smolagents/local_python_executor.py` and its `utils.py`;
`docs/attribution.md`'s row for the first; `docs/09-decisions/0013-cli-version-line.md` and
`docs/09-decisions/0006-distribution-shape.md`.

**Depends on:** T-13's earlier tasks and
`docs/research/2026-10-14-pyodide-recon.md`. No existing source changes: a new
package plus the router, the upstream map, the environment document and the pack
smoke's list. Order: 1 → 2 → 3 → 4 → 5 → 6, then 7 → 8 → 9.

**Task ownership:** tasks 1–7 own `packages/exec-pyodide/**` and
`scripts/pack-smoke.mjs`; task 8 owns `packages/exec-pyodide/AGENTS.md`, the
new component rule, `AGENTS.md`, `docs/attribution.md`, `docs/04-tasks.md`,
`docs/03-handoff.md`, `docs/02-environment.md` and the memory documents; task
9 the root `package.json` if a filter misses the package. `src/index.ts` is
the one source file two tasks touch.

## Decisions fixed before this plan

- Package `packages/exec-pyodide/`, name `@smolagents-ts/exec-pyodide`, id
  `exec-pyodide`, version `0.0.0` outside the `fixed` group, siblings'
  template.
- `pyodide` is a regular dependency pinned exactly to `314.0.7`;
  `checkAPIVersion` keeps its default, so loader and assets agree.
- v1 is in-process on Node and the browser: one runtime per executor, globals
  persist across `execute()` calls, `dispose()` drops it. No
  `cpuTimeLimitMs`; `timeoutMs` only at await boundaries, because a
  synchronous Python loop cannot be timer-interrupted on the main thread. The
  worker interrupt path is a named follow-up.
- A deadline or an abort that wins the race leaves the guest running and cannot
  stop it, so that call poisons the session: the next `execute()` builds a fresh
  runtime, the abandoned promise is observed, and the dead run's handlers are
  detached. Running the next step over a guest that is still executing would
  interleave two steps' globals and logs.
- The import allow-list defaults to upstream's base list and accepts additions,
  enforced by replacing the guest's `builtins.__import__`. It is a fidelity
  guard: Pyodide is not a security sandbox.
- `final_answer` is a guest-side `BaseException` subclass, so a guest's
  `except Exception` cannot swallow the answer.
- stdout and stderr go through Pyodide's batched handlers into the `onLog`
  lines and `CodeResult.logs`, truncated as upstream truncates.

## Findings measured before this plan (2026-10-14)

All measurements are the reconnaissance's, cited by section in
`docs/research/2026-10-14-pyodide-recon.md`.

| # | Measurement (section) | Finding |
|---|---|---|
| 1 | 13.40 MiB installed; wasm 9.154 MiB ("The `pyodide` package") | Own package, so V15-R4 leaves core and exec-quickjs untouched. |
| 2 | 1.94–2.35 s cold; first `runPython` sub-millisecond; no `fetch` on Node ("The Node load path, verified") | Reuse hides the cold start; the browser needs the loader's CDN base. |
| 3 | A 200 ms timer did not fire in a 3.9 s run; a worker wake took 519 ms ("The browser load path"; "Timeout, cancellation and disposal") | No `cpuTimeLimitMs`; a wall-clock interrupt needs a worker, so v1 cannot promise one. |
| 4 | A replaced `builtins.__import__` worked; the guest can restore it ("Enforcing an import allow-list") | The guard is fidelity, not a security boundary. |
| 5 | Browser cold start, async tool calls, reclaim and teardown, pnpm ("Not measured") | Task 7 probes the first two; the rest stay open. |

## Tasks

### Task 1: the package skeleton

**Deliverable:** the package exists, builds, typechecks and carries its
siblings' metadata; the pack smoke knows it.

**Files:** `packages/exec-pyodide/{package.json,tsconfig*.json,tsup.config.ts,vitest.config.ts,README.md}`,
`packages/exec-pyodide/src/{index,version}.ts`, `scripts/pack-smoke.mjs`,
`.changeset/v1-5-exec-pyodide-package.md`.

**Notes:** version `0.0.0` outside the `fixed` group (decision 0013);
`type: module`, `sideEffects: false`, `engines.node >=22.12`,
`publishConfig.access: public`, `files` of `dist`/`LICENSE`/`NOTICE`,
`prepack`/`postpack` calling `scripts/copy-licence.mjs`. Dependencies:
`@smolagents-ts/core` (workspace), `pyodide` exactly `314.0.7`, `zod` as
the sibling declares it. tsup: one entry, `esm`, `es2022`, `dts: true`,
`external` of `pyodide` and `zod`. The vitest project `exec-pyodide`
aliases `@smolagents-ts/core` to `../core/src/index.ts`; `src/version.ts`
carries the smoke's marker. The smoke's `PACKAGES` gains `exec-pyodide`, and
its consumer install gets `pyodide` as a `file:` spec, as the react peer does,
keeping packing off the registry.

**Verification:** `pnpm --filter @smolagents-ts/exec-pyodide run build` exits 0
with `dist/index.js` and `dist/index.d.ts`; `pnpm pack:smoke` prints nine
packages.

### Task 2: the loader seam and the runtime session

**Deliverable:** a `PyodideLoader` a fake can stand in for, and one runtime
per executor.

**Files:** `packages/exec-pyodide/src/{loader,runtime}.ts`,
`packages/exec-pyodide/test/runtime.test.ts`.

**Notes:** `PyodideRuntime` names only what the executor calls: `runPython`,
`runPythonAsync`, `globals`, `setStdout`, `setStderr` and a version
reader. The default loader does `import("pyodide")` lazily, so constructing an
executor pulls no 13 MiB. The session creates the runtime on the first
`execute()`, installs the handlers once, and reuses it. `dispose()` clears
the reference, is idempotent, and claims no reclamation.

**Verification:** the fake records one load across three `execute()` calls and
one per second executor; a doubled `dispose()` is quiet.

### Task 3: the guest prelude, `final_answer` and the tool bridge

**Deliverable:** a Python namespace that can answer, call host tools, and cannot
lose its answer to a guest's `except Exception`.

**Files:** `packages/exec-pyodide/src/{guest-source,bridge}.ts`,
`packages/exec-pyodide/test/bridge.test.ts`.

**Notes:** `buildGuestSource` emits the prelude as one Python string. The
signal subclasses `BaseException`; `final_answer(value)` stores the value in a
module global and raises, and the host reads it after catching. Each tool
becomes a host callable taking and returning one JSON string; the bridge
validates with the tool's `inputSchema`, emits the `ToolCallEvent` triple
through `onToolCall`, and turns an unknown tool, bad arguments or a throwing
tool into a Python-visible `RuntimeError` naming the tool.

**Verification:** the bridge test invokes an installed callable directly and
asserts the event order, the JSON and the error; the prelude runs against the
real runtime in task 5.

### Task 4: the import allow-list

**Deliverable:** one guard over the guest's `builtins.__import__`, enforcing
upstream's base list plus a caller's additions with upstream's text.

**Files:** `packages/exec-pyodide/src/imports.ts`,
`packages/exec-pyodide/test/imports.test.ts`.

**Notes:** `DEFAULT_AUTHORIZED_IMPORTS` is upstream's eleven modules
(`collections`, `datetime`, `itertools`, `math`, `queue`, `random`,
`re`, `stat`, `statistics`, `time`, `unicodedata`); the constructor
option `additionalAuthorizedImports` is appended. Matching follows upstream's
tree check, so a trailing `*` authorises every prefix. The replacement raises
`ImportError` with upstream's text, "Import of <name> is not allowed.
Authorized imports are: <list>". The guest can restore the builtin, so the
README and the component rule in task 8 call Pyodide a fidelity adapter, not a
security sandbox.

**Verification:** against the real runtime, an allowed module imports, a
disallowed one is refused with the text, and the restore case is recorded as the
known bypass rather than asserted as a defence.

### Task 5: the executor, the streams and the result

**Deliverable:** `PyodideExecutor` satisfies `CodeExecutor`, answers
`"python"` and reports an honest capability set.

**Files:** `packages/exec-pyodide/src/{executor,streams}.ts`,
`packages/exec-pyodide/test/{streams,executor,executor.integration}.test.ts`.

**Notes:** capabilities: `language: "python"`, `isolation: "wasm"`,
`network: "host-mediated"`, `timers: false`, `asyncToolCalls: false`
until task 7 says otherwise, and no optional limit, because Pyodide exposes
none. `execute()` races the run against a deadline and reads
`signal.aborted` only where the host regains control — before the run and as
each tool call resolves — so a timed-out or cancelled run returns
`AgentTimeoutError` or `AgentCancelledError`; a synchronous guest loop is
uninterruptible in-process. A race the deadline or the abort wins therefore
poisons the session: the runtime is dropped, the abandoned promise is observed so
it cannot surface as an unhandled rejection, and its handlers are detached, so the
next `execute()` pays one cold start instead of running over a guest that is still
executing. Batched `setStdout`/`setStderr` handlers append
to the run's buffer and call `onLog`; `streams.ts` owns the buffer and
upstream's 50,000-character head-and-tail truncation. The answer signal becomes
`value` and `isFinalAnswer: true`; any other failure becomes an
`AgentErrorInfo` with code `AGENT_EXECUTION`.

**Verification:** `pnpm vitest run --project exec-pyodide` exits 0; the
integration file loads the real runtime (about two seconds, no network) and
covers `print` capture, a tool call, `final_answer` under `except
Exception`, a deliberate `raise`, a run past its deadline, and the call after it
(a second load, and no log line from the abandoned run).

### Task 6: the public surface and the isomorphism guard

**Deliverable:** the barrel a consumer imports, pinned by test, and a test that
no source module reaches a Node builtin.

**Files:** `packages/exec-pyodide/src/index.ts`,
`packages/exec-pyodide/test/{public-surface,architecture}.test.ts`.

**Notes:** the barrel exports `VERSION`, `PyodideExecutor`, the
`PyodideExecutorOptions` type, the two loader types and
`DEFAULT_AUTHORIZED_IMPORTS`; the seam's types stay in the core. The surface
test pins the sorted export list. The architecture test reads every module under
`src/` and fails on a `node:` specifier, mirroring
`packages/core/test/architecture.test.ts`. This task finalises the
`src/index.ts` task 1 scaffolded.

**Verification:** the surface test fails on an added export until the pinned list
changes; a throwaway `import "node:fs"` in a source module fails the case.

### Task 7: the measured probes

**Deliverable:** the two unmeasured facts task 5 depends on are measured, or the
claims they support are corrected.

**Files:** `packages/exec-pyodide/test/async-tools.integration.test.ts`, a
scratch Vite page outside the repository, a new runbook under
`docs/10-runbooks/`, and this plan's measured results.

**Notes:** probe A runs, through `runPythonAsync`, a Python call to a host tool
that awaits a real timer; if the await survives, the capability flips to
`true`, otherwise the runbook records the failing shape. Probe B builds the
scratch Vite page with `optimizeDeps.exclude: ["pyodide"]` against the CDN base
and measures the browser cold start and bundle. Probe C confirms the pack
smoke's consumer install reaches no registry for `pyodide`.

**Verification:** the probe output and the resulting capability value are pasted
into the measured results; a contradicting probe changes the claim.

### Task 8: the package's documents and the router

**Deliverable:** the new component is reachable from the router, and the
upstream map stops treating the Python executor as QuickJS's row.

**Files:** `packages/exec-pyodide/AGENTS.md`, a new component rule in the form
`rules/components/<id>.md`, `AGENTS.md` (one row), `docs/attribution.md`,
`docs/04-tasks.md` (the T-13 row), `docs/03-handoff.md` (a new entry),
`docs/02-environment.md`, `docs/01-project.md` (the Key components table and the
S6 row), and `docs/05-memory.md` with `docs/memory/general.md` only if a lesson
lands.

**Measured addition (2026-10-14, before task 8 ran):** the ownership list at the
top of this plan misses `docs/01-project.md`, whose Key components table names
every package; task 8 updates it too.

**Notes:** the scoped entry follows `packages/exec-quickjs/AGENTS.md`; the
component rule follows `rules/components/exec-quickjs.md` and must state that
the guest boundary is fidelity rather than security and that the worker
interrupt path is not in v1. The `local_python_executor.py` attribution row
gains `packages/exec-pyodide` beside `packages/exec-quickjs`, because the Python
semantics the new package ports live at that upstream file. The router gains a
row with id `exec-pyodide`, scope `packages/exec-pyodide/` and the new rule.

**Verification:** `python scripts/validate_context.py --root . --json
--baseline docs/.baseline.json` ends with `new: []`, zero errors and zero
warnings; `python scripts/rotate.py --check` exits 0.

### Task 9: the gate wiring and verification

**Deliverable:** the new package is inside every gate stage that names packages,
and the plan's claims are measured rather than asserted.

**Files:** `scripts/pack-smoke.mjs` (task 1 already lists it), the root
`package.json` only if a filter misses the package, and
`docs/02-environment.md`.

**Notes:** build, publint, attw and the pack smoke reach `packages/*` by glob,
so the expected edits are the smoke's list and its `pyodide` file spec, plus
the environment line. The browser probe is a runbook, not a gate stage.

**Verification:** `pnpm gate` exits 0 on a clean tree, with the suite's file and
test counts; the outputs, the T-13 row, the handoff entry and any corrected
claim are pasted into the measured results beside the validator's final JSON.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| V15-R4: the bundle dwarfs QuickJS | It is a dependency of its own package, so core and exec-quickjs are unaffected and a consumer that never imports it downloads none of it | Delete the package and its changeset |
| The pack smoke reaches the registry for `pyodide` | The consumer install gets the workspace's installed copy as a `file:` spec, as the react peer does | Drop `exec-pyodide` from `PACKAGES` |
| Async host tool calls do not work | `asyncToolCalls` stays `false` until task 7's probe measures them | Keep the flag `false` and record the limitation |
| `dispose()` cannot reclaim the WASM memory | It drops the reference and the proxies, and claims nothing about reclamation | None needed; the behaviour is stated |
| A timed-out run keeps executing in the guest | The session is poisoned and rebuilt, and the abandoned promise and its handlers are dropped | None needed; the cost is one cold start |

## Open questions for the owner

1. **The worker interrupt path.** Named as a follow-up, not built here: a hard
   wall-clock timeout in v1 would need a worker entry and cross-origin isolation
   headers.
2. **The browser cold-start budget.** Only the Node cold start is measured
   today. If the owner wants a documented budget, task 7's probe sets it.
3. **Wheel loading.** This plan calls neither `loadPackage` nor
   `loadPackagesFromImports`, because they need the network and write into the
   consumer's `node_modules`. A caller needing wheels supplies a runtime already
   loaded with them through the injectable loader.
4. **The `asyncToolCalls` value if the probe is positive.** Flipping it changes
   how an agent uses a step, so the owner may want a decision record beside it.

## Measured results

Results are appended here by the session that executes the plan.


### 2026-10-14 — tasks 1–7 measured (executing session)

**Package.** packages/exec-pyodide created and wired into the pack smoke.
pnpm --filter @smolagents-ts/exec-pyodide run build emits dist/index.js 17.98 KB,
dist/index.d.ts 5.02 KB and dist/index.js.map 49.70 KB; the dynamic
import("pyodide") survives into the bundle, so a page that never calls the
default loader downloads none of the runtime.

**Task 4 — the import guard, against the real runtime.** imports.test.ts passes
8 tests. All eleven upstream modules import and work (datetime.datetime.now(),
Counter, statistics.mean). A disallowed module is refused with upstream's exact
sentence, and the refusal covers a submodule (import os.path), a from-import
(from socket import socket) and a relative import. The restore is recorded as
the known bypass, not asserted as a defence.

**Measured correction — the guard's scope.** The plan's literal shape replaces
the guest's builtins.__import__ globally. Measured against the real runtime that
breaks import datetime, import queue and import statistics with
ImportError: Import of _io is not allowed, because an authorized module's own
internal imports are routed through the replacement. The implementation captures
the guest's globals at install time (_TS_GUEST_GLOBALS = globals()) and raises
only when the caller's globals is that dict, while still refusing every
guest-level import above. The fidelity goal is unchanged, and the bypass
(restoring __import__, or calling it with explicit non-guest globals) stays
recorded in imports.test.ts and the src comment.

**Task 5 — the executor, against the real runtime.** executor.integration.test.ts
passes 7 tests: print capture in logs and onLog, a variable that survives across
two execute() calls, an awaited host tool plus final_answer, a failed tool caught
by except Exception while final_answer still escapes it, a deliberate raise mapped
to AGENT_EXECUTION, a refused import, and a run past its deadline whose abandoned
runtime is poisoned — the call after it loads a second runtime and its logs is
exactly "second", so no abandoned line leaks.

**Measured correction — the answer arrives as a rejection.** final_answer raises
_FinalAnswerSignal, a BaseException, so runPythonAsync rejects and the answer
reaches the host as the attempt's error. The executor must read
_final_answer_raised before the error, or every final_answer call reports
AGENT_EXECUTION. A unit test now pins the rejected-signal path.

**Task 6 — surface and isomorphism.** public-surface.test.ts pins the sorted
exports ["DEFAULT_AUTHORIZED_IMPORTS", "PyodideExecutor", "VERSION"];
architecture.test.ts walks the root entry's graph, fails on any node: specifier,
and proves the walker fails on a fixture that names node:child_process.

**Task 7, Probe A — async host tool calls: positive.** A Python guest under
runPythonAsync awaited a host callable whose JavaScript implementation returns a
promise that a real setTimeout(120) settles; the guest received "pinged p" with
elapsed greater than 120 ms. capabilities.asyncToolCalls is therefore true. The
capability object, verbatim:

    { language: "python", isolation: "wasm", asyncToolCalls: true, timers: false, network: "host-mediated" }

timers stays false because it describes what the executor offers the guest (no
host scheduler, no interrupt), not what Pyodide's own asyncio can do: the timeout
test uses asyncio.sleep and it works.

**Task 7, Probe B — the browser bundle and cold start: measured.** The scratch
page lives outside the repository and is reproduced by the new runbook
docs/10-runbooks/exec-pyodide-browser-probe.md. Built with Vite 6.4.4:

- optimizeDeps.exclude: ["pyodide"] with pyodide resolvable: index.html 266 B,
  assets/index 29,156 B, a lazy assets/pyodide chunk 22,977 B, an
  externalized-Node shim 81 B — 52,480 B on disk.
- The CDN deployment, pyodide also marked rollupOptions.external: 29,375 B total
  (index.html 266, assets/index 29,109), 8.5 kB gzipped.
- Headless Chrome 155.0.8059.40 against
  https://cdn.jsdelivr.net/pyodide/v314.0.7/full/: status "ok",
  coldStartMs 2912, logs "hello from the guest". Five CDN resources, 6,289,377 B
  over the wire and 13,531,207 B decoded: pyodide.mjs 7,599 / 17,931;
  pyodide-lock.json 25,008 / 119,077; python_stdlib.zip 2,505,613 / 2,545,637;
  pyodide.asm.wasm 3,438,816 / 9,598,218; pyodide.asm.mjs 262,341 / 1,250,344.

The runtime is in neither build's app bundle. The page's own code costs about
29 kB and the runtime is a CDN cost. Against exec-quickjs's 52,891-byte dist,
V15-R4 is answered: the new package's own code does not dwarf the sibling.

**Task 7, Probe C — the pack smoke reaches no registry for pyodide: confirmed.**
Run with its consumer kept for inspection, the consumer's package-lock.json
contains no pyodide URL at all; its entry is node_modules/pyodide with link true
resolved to the workspace store
E:/python_projects/smolagents_ts/node_modules/.pnpm/pyodide@314.0.7/node_modules/pyodide,
and the installed consumer copy is a junction to that path reporting version
314.0.7. The lockfile's only registry resolutions belong to other packages (zod,
quickjs's wasmfile packages).

**The commands, from the repository root.**

1. pnpm --filter @smolagents-ts/exec-pyodide run typecheck — exit 0, no output.
2. pnpm --filter @smolagents-ts/exec-pyodide run build — exit 0; ESM dist/index.js
   17.98 KB, dist/index.js.map 49.70 KB, DTS dist/index.d.ts 5.02 KB.
3. pnpm vitest run --project exec-pyodide — exit 0; Test Files 9 passed (9),
   Tests 55 passed (55), Duration 13.31s.
4. pnpm lint — exit 0; "$ eslint ." with no findings.
5. pnpm depcruise — exit 0; no dependency violations found (227 modules, 566
   dependencies cruised).
6. pnpm typecheck — exit 0; Scope: 12 of 13 workspace projects.
7. pnpm pack:smoke — exit 0; pack-smoke OK: 9 packages installed and imported;
   the cli bin ran.
8. pnpm gate — exit 0. typecheck 12 of 13; lint clean; depcruise 227 modules /
   566 dependencies; test 95 files passed, 689 tests passed, 60.21s; build 9 of
   13; publint "All good!" for all nine packages including
   @smolagents-ts/exec-pyodide; attw green (node16-from-ESM, bundler) for the
   new package with node10 and node16-cjs ignored by the esm-only profile;
   ci:check OK; pack-smoke OK 9 packages; site:build 65 page(s), 64 document(s).

**Anything undone, or any test disabled:** nothing. No test is skipped, and the
only ignored attw resolutions are the profile's own node10 and node16-cjs
columns, which every sibling shares.

**A third measured correction — the bridge's error attribution.** A rejected
JavaScript promise surfaced in Python as pyodide.ffi.JsException, not as
RuntimeError. The bridge therefore answers with a JSON envelope and the emitted
wrapper raises RuntimeError from the envelope's error, so guest code that catches
the failure sees a RuntimeError naming the tool, as the plan's Task 3 text
promises.
