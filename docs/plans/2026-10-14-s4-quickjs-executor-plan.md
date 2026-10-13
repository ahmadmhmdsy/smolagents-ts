# S4 — the QuickJS executor Implementation Plan

## Contract

- **Role:** the implementation plan for milestone S4 of
  `docs/design/2026-10-12-smolagents-ts-v1-design.md`.
- **Mutability:** append-only from the moment execution begins. A step that proved
  wrong gets a note under the task that owns it; the step text itself is left alone.
- **Read when:** executing S4, or reviewing what S4 was supposed to deliver.
- **Update when:** a task's measured result differs from its prediction, or a task is
  added or dropped.

**Goal:** make `@smolagents-ts/exec-quickjs` a real executor — model-authored JavaScript
runs in a QuickJS-WASM realm, awaited tool calls cross the boundary, `final_answer`
ends the run — so `CodeAgent` executes code for real instead of replaying a script.

**Architecture:** the package implements the `CodeExecutor` seam the core already
declares (`packages/core/src/executor.ts`); nothing about the agent loop changes except
one call it was missing. One `QuickJSExecutor` instance serves one agent run: a runtime
and a context are created lazily on the first `execute`, reused for every later step
(decision D-21 — a variable defined in step 1 is visible in step 2), and released by
`dispose()`. Before each `execute` the executor re-installs its shims into the same
context — `console.log`, one global function per registered tool, and `final_answer` —
then evaluates the model's code wrapped in an async IIFE. Tools run in the host: the
guest's tool global returns a promise the host settles, and the host drives the guest's
job queue until that promise settles, which is how an async tool call crosses a
synchronous engine.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), QuickJS-WASM through
`quickjs-emscripten-core` + `@jitl/quickjs-wasmfile-release-sync`, Zod 4 (the tools'
own schemas), Vitest, tsup, pnpm workspaces.

**Spec:** design record section 9, and 9.3 in particular, which requires the bridge
spike below to be run before this plan is written. Decision D-21 owns the executor's
lifetime.

**Depends on:** S1 (the seam, `ToolRegistry`, `ToolContext`, the typed errors) and S2
(`CodeAgent` wiring). Independent of S3: the executor bridges whatever registry it is
handed and names no default tool.

**Dependency order:** Task 1 adds the dependency every later task needs; Task 2 is pure
source generation and Task 3 consumes it; Task 4 needs Task 3; Task 5 is a core change
Task 4 does not depend on; Task 6 exports what 2–4 built; Task 7 records the result.

**Task ownership:** `T-9` in `docs/04-tasks.md` owns this plan's execution. The
checkboxes below are the plan's steps, not the task row.

## The bridge spike (measured 2026-10-14, before this plan)

Design 9.3 asks whether a synchronous QuickJS build can carry an awaited host tool call,
because that answer decides the whole shape of this package. It can. Measured, with the
script retained at `.superpowers/spike-quickjs-bridge.mjs` and its output at
`.superpowers/spike-quickjs.txt` (both untracked; the scenarios are re-asserted as tests
in Task 3, so the finding outlives the script):

| # | finding |
|---|---|
| F1 | `newQuickJSWASMModuleFromVariant(variant)` returns a module in 8–26 ms. No asyncify, no top-level await in the package. |
| F2 | A guest can await a host tool call on the sync build: the host function returns `context.newPromise(hostPromise).handle` and the guest's `await` resolves. Two sequential awaits took 8 drain iterations. |
| F3 | The pending-job drain is the driver. `context.resolvePromise(handle)` alone did **not** settle within 1200 ms; `runtime.executePendingJobs()` in a loop, yielding to the host between iterations, is what moves the promise. |
| F4 | A host promise that rejects surfaces in the guest as an `Error` carrying the host's message. Tool failures are therefore ordinary guest exceptions, and the guest stack is the guest's own. |
| F5 | `runtime.setInterruptHandler(() => boolean)` stops a runaway guest: 2001 callbacks, then `InternalError: interrupted`. This is the timeout, cancellation and CPU-limit mechanism. |
| F6 | Guest state survives between `evalCode` calls in one context (`globalThis.counter = 41`, then `counter + 1` → 42). D-21 is satisfiable. |
| F7 | Cleanup is `context.dispose()` then `runtime.dispose()`. The release build **aborts the WASM module** (`Assertion failed: list_empty(&rt->gc_obj_list)`) when a handle outlives the runtime. The abort is a catchable JavaScript exception and the module stays usable afterwards. |
| F8 | A host function whose callback returns a value the library does not expect (a number from `Array.push`) is read as a handle and throws `TypeError: Cannot use 'in' operator`. A host function that returns nothing must return `undefined` explicitly. |
| F9 | `context.newPromise(host)` needs no manual dispose; its handles are freed with the context. |
| F10 | The system prompt's own examples await a tool at the top level of the code block, which a classic script eval rejects. The model's code must be wrapped in an async IIFE, which also makes the eval result always a promise. |

F7 and F8 are the two that shape the code: every handle this package creates is disposed
on every path, and `dispose()` catches.

## Spec coverage

| spec item | where it lands |
|---|---|
| 9.1 capability set is explicit | Task 3: `capabilities` reports language, isolation, async tool calls, timers, network and the memory cap |
| 9.2 sync build + host-driven job queue | Task 3: `executePendingJobs` drain loop, per F3 |
| 9.2 `__callTool(name, argsJson)` guest global | Task 2 generates it, Task 3 implements it |
| 9.2 results cross as JSON strings | Task 3: `serializeToolResult` |
| 9.2 fallback ladder (asyncify, sync-only, replay) | deliberately unused: the first rung is not needed, per F2. Recorded under "does not do" |
| 9.3 spike before planning | the section above, measured before this plan was written |
| 9.4 `exec-node-vm` / `exec-remote` | later milestones; see "does not do" |
| D-21 one executor per run, state across steps | Task 3 (context reuse) and Task 4 (a test that reads a step-1 variable in step 2) |
| the seam is the only coupling | Task 6: the barrel exports the executor and nothing of the loop |

## Does not do

- **The fallback ladder.** The sync build carries awaited tool calls (F2), so the
  asyncify variant, the sync-only "async tools are rejected" mode and the pause/resume
  replay are all unbuilt. Building them would ship three code paths where one is proven.
- **`exec-node-vm`, `exec-remote`, `exec-pyodide`.** Design 9.4 lists them as later
  work; `vm2` stays rejected.
- **Network from the guest.** The realm has no `fetch`; every network call goes through a
  host tool, which is what makes `network: "host-mediated"` true rather than aspirational.
- **Python.** `language` is `"javascript"`; the seam's other value is a different
  milestone's problem.
- **The design record's `supports` field.** Section 9.1 names the capability bag
  `supports`; the shipped seam calls it `capabilities`. This package implements the
  shipped seam, and the drift stays recorded rather than papered over.

## File structure

| path | responsibility |
|---|---|
| `packages/exec-quickjs/package.json` | gains the `@smolagents-ts/core` workspace dependency |
| `packages/exec-quickjs/src/guest-source.ts` | `buildGuestSource`: the shims, the tool globals, the async wrapper |
| `packages/exec-quickjs/src/marshal.ts` | `serializeToolResult`, `toErrorInfo`: the boundary's data forms |
| `packages/exec-quickjs/src/executor.ts` | `QuickJSExecutor`: lifecycle, the drain loop, the tool bridge, the result |
| `packages/exec-quickjs/src/index.ts` | the public barrel |
| `packages/exec-quickjs/test/executor.test.ts` | the executor's behaviour, including every spike scenario |
| `packages/exec-quickjs/test/code-agent.test.ts` | the executor under a real `CodeAgent` and `MockModel` |
| `packages/exec-quickjs/test/public-surface.test.ts` | the pinned export list |
| `packages/core/src/agent/multi-step-agent.ts` | a `releaseResources` hook the run calls in a `finally` |
| `packages/core/src/agent/code-agent.ts` | the override that disposes the executor |

Test counts in this plan are predictions. Record the measured numbers in Task 7 instead
of the predicted ones whenever they differ.

## Task 1 — the package's scaffolding

**Files**

- modify `packages/exec-quickjs/package.json`
- modify `packages/exec-quickjs/vitest.config.ts`
- modify `packages/exec-quickjs/tsconfig.test.json`

**Steps**

- [ ] 1.1 Add the dependency, because `packages/exec-quickjs/src` will import the seam
  types and `no-undeclared-deps-from-src` fails a package that does not declare it:

  ~~~json
  "dependencies": { "@smolagents-ts/core": "workspace:*", "zod": "^4.0.0", "quickjs-emscripten-core": "^0.32.0", "@jitl/quickjs-wasmfile-release-sync": "^0.32.0" }
  ~~~

- [ ] 1.2 Run `pnpm install`. The declaration alone does not create the workspace link;
  S3 learned this the expensive way, when the build failed with `TS2307: Cannot find
  module '@smolagents-ts/core'` until the install ran.

- [ ] 1.3 Add the core-to-source alias to `packages/exec-quickjs/vitest.config.ts`,
  copying the comment and shape from `packages/tools/vitest.config.ts`: the gate runs
  this project before any build exists, so the workspace link points at a `dist/` that
  is not there yet.

- [ ] 1.4 Add `"rootDir": "../.."` to `packages/exec-quickjs/tsconfig.test.json`, for
  the same reason: the test project includes core sources, which are not under the
  package's own root.

- [ ] 1.5 Run `pnpm vitest run --project exec-quickjs`. Expected: **1 file, 1 test**
  (the existing smoke test), exit 0.
- [ ] 1.6 Run `pnpm --filter @smolagents-ts/exec-quickjs run typecheck` and
  `pnpm depcruise`. Expected: both exit 0.
- [ ] 1.7 Commit: `chore(exec-quickjs): depend on the core and its source alias`.

## Task 2 — the guest program

**Files**

- create `packages/exec-quickjs/src/guest-source.ts`
- create `packages/exec-quickjs/test/guest-source.test.ts`

**Steps**

- [ ] 2.1 Write `packages/exec-quickjs/src/guest-source.ts`:

  ~~~ts
  /** The host functions the executor installs in the guest realm. */
  export const LOG_GLOBAL = "__log";
  export const CALL_TOOL_GLOBAL = "__callTool";
  export const FINAL_ANSWER_GLOBAL = "__finalAnswer";

  export interface BuildGuestSourceOptions {
    /** The code the model wrote, verbatim. */
    code: string;
    /** Every tool name in the registry; each becomes a guest global function. */
    toolNames: readonly string[];
  }

  /**
   * The guest program: the shims the model's code may call, then the code itself inside an
   * async IIFE. The wrapper is not cosmetic. The system prompt's examples await a tool at the
   * top level of the block, which a classic script eval rejects as a syntax error, and the
   * wrapper also makes the eval result a promise in every case, so a synchronous block is
   * observable through the same path as an asynchronous one.
   */
  export function buildGuestSource(options: BuildGuestSourceOptions): string {
    const lines: string[] = [
      // One sink for every console method, so a model that reaches for console.error is
      // still observed rather than silently ignored.
      "globalThis.console = { log: (...a) => { " + LOG_GLOBAL + "(a.map(render).join(' ')); } };",
      "const render = (v) => (typeof v === 'string' ? v : (JSON.stringify(v) ?? String(v)));",
      "const callTool = async (name, args) => JSON.parse(await " + CALL_TOOL_GLOBAL + "(name, JSON.stringify(args === undefined ? null : args)));",
      "globalThis.final_answer = (value) => { " + FINAL_ANSWER_GLOBAL + "(value); };",
    ];
    for (const name of options.toolNames) {
      // Bracket assignment, not a declaration: a tool name is a registry fact, and the
      // registry is what rejects a name that is not a JavaScript identifier.
      lines.push("globalThis[" + JSON.stringify(name) + "] = (args) => callTool(" + JSON.stringify(name) + ", args);");
    }
    lines.push("(async () => {");
    lines.push(options.code);
    lines.push("})()");
    return lines.join("\n");
  }
  ~~~

  A note the implementer will hit: `console` is assigned as a whole object, and
  `render`/`callTool` are `const` declarations after the assignment that uses them.
  Both are fine because the assignment only stores a closure. If a later change hoists a
  call above the declarations, it breaks; the ordering is load-bearing.

- [ ] 2.2 Write `packages/exec-quickjs/test/guest-source.test.ts` with four tests: it
  defines one global function per tool name; it defines `final_answer`, `console.log`
  and the tool-call helper; it wraps the model's code verbatim inside an async IIFE; a
  registry with no tools still produces a runnable program.

- [ ] 2.3 Run `pnpm vitest run --project exec-quickjs`. Expected: **2 files, 5 tests**,
  exit 0.
- [ ] 2.4 Commit: `feat(exec-quickjs): build the guest program`.

## Task 3 — the executor

**Files**

- create `packages/exec-quickjs/src/marshal.ts`
- create `packages/exec-quickjs/src/executor.ts`
- create `packages/exec-quickjs/test/executor.test.ts`

**Steps**

- [ ] 3.1 Write `packages/exec-quickjs/src/marshal.ts`:

  ~~~ts
  import { AgentError, type AgentErrorCode, type AgentErrorInfo } from "@smolagents-ts/core";

  /**
   * A tool result as the guest receives it. The guest parses this with JSON.parse, so a value
   * JSON cannot express (a function, a bigint, a cycle) degrades to its string form rather
   * than failing the call the model already made.
   */
  export function serializeToolResult(value: unknown): string {
    const text = JSON.stringify(value ?? null);
    return text === undefined ? JSON.stringify(String(value)) : text;
  }

  /** The plain-data error an event carries. Guest errors arrive as dumped {name, message}. */
  export function toErrorInfo(
    error: unknown,
    code: AgentErrorCode,
    stepIndex: number,
  ): AgentErrorInfo {
    if (error instanceof AgentError) {
      const info = error.info;
      return { ...info, stepIndex };
    }
    const name = error instanceof Error ? error.name : "Error";
    const message = error instanceof Error ? error.message : String(error);
    return { name, message, code, stepIndex };
  }
  ~~~

- [ ] 3.2 Write `packages/exec-quickjs/src/executor.ts`. The shape, in full, because the
  ordering inside `execute` is the part that is easy to get wrong:

  ~~~ts
  export interface QuickJSExecutorOptions {
    /** Guest heap cap. Defaults to 64 MiB (design 9.1). */
    memoryLimitBytes?: number;
    /** Guest stack cap. Defaults to 1 MiB. */
    maxStackSizeBytes?: number;
    /** The fetch handed to tools through ToolContext. Defaults to the host's global fetch. */
    fetch?: typeof globalThis.fetch;
  }

  export class QuickJSExecutor implements CodeExecutor {
    readonly language = "javascript" as const;
    readonly capabilities: ExecutorCapabilities;
    // ... runtime, context, modulePromise, disposed, logger, run state
    async execute(code: string, options: ExecuteOptions): Promise<CodeResult> { ... }
    async dispose(): Promise<void> { ... }
  }
  ~~~

  `execute` in order:

  1. throw `AgentExecutionError` if disposed, so a second run on a spent instance fails
     with a sentence instead of a WASM abort;
  2. load the module once (`await this.modulePromise`) and create the runtime and context
     once; install the interrupt handler, which reads the *current* run's deadline and
     signal, so a handler installed at creation still answers for every later step;
  3. install the shims for this call: `__log`, `__callTool`, `__finalAnswer`. Each is
     disposed right after `setProp`, because `setProp` copies the reference (F7);
  4. build the source (Task 2) and `evalCode` it;
  5. drain to settlement (below), then dispose the promise handle and return the
     `CodeResult`.

  The drain loop, which is F3's finding made concrete:

  ~~~ts
  while (true) {
    const ran = this.runtime.executePendingJobs();
    if (ran.error !== undefined) { errorHandle = ran.error; break; }
    const state = this.context.getPromiseState(promise);
    if (state.type === "fulfilled") { value = this.context.dump(state.value); state.value.dispose(); break; }
    if (state.type === "rejected") { errorHandle = state.error; break; }
    if (this.deadlinePassed() || this.aborted()) break;   // the handler fires on the next job
    await new Promise((resolve) => setTimeout(resolve, 0));  // hand the host its macrotasks
  }
  ~~~

  The host tool function is the bridge itself:

  ~~~ts
  const callTool = context.newFunction(CALL_TOOL_GLOBAL, (nameHandle, argsHandle) => {
    const name = context.getString(nameHandle);
    const raw = context.getString(argsHandle);
    const host = this.runTool(name, raw, options);   // an async host function
    return context.newPromise(host).handle;
  });
  ~~~

  and `runTool` emits the events and returns a guest string:

  - unknown name → a `failed` event with `AgentToolCallError`, and the host promise
    rejects, which the guest sees as an `Error` (F4);
  - `tool.inputSchema.safeParse(JSON.parse(raw))` → on failure, the same, with the
    validation message;
  - `requested` event, then `await tool.execute(input, ctx)` where `ctx` is a
    `ToolContext` built here: `signal` from the execute options, `fetch` from the
    executor's options, a `callId` from a per-run counter, `stepIndex` and `logger`;
  - success → a `result` event with the output and duration, and
    `context.newString(serializeToolResult(output))`;
  - failure → a `failed` event, and the host promise rejects with
    `Tool "name" failed: message`, so the model reads which tool failed in the
    observation.

  `__log` pushes the line and calls `options.onLog`; `__finalAnswer` dumps the value,
  records the first answer only (a second `final_answer` call is ignored), and calls
  `options.finalAnswer.submit(value)` as well as reporting `isFinalAnswer`.

  Error mapping: a guest error is an `AgentExecutionError` carrying the guest's own
  `name` and `message`; an interrupt that happened after the deadline is an
  `AgentTimeoutError` naming the budget; an interrupt after the signal aborted is an
  `AgentCancelledError`. None of them rejects the `execute` promise — the loop's
  contract is that a broken guest step becomes an observation the model can react to.

  The result carries `logs` (the lines joined with newlines), `isFinalAnswer`,
  `value` only when a final answer arrived, `error` only when one happened, plus
  `durationMs` and `toolCallCount`. Build the optional fields with conditional spreads;
  `exactOptionalPropertyTypes` rejects `value: undefined`.

  `dispose` disposes the context and then the runtime, each inside its own `try`, and
  marks the instance disposed. F7 is why: the release build aborts the module when a
  handle outlives the runtime, and the abort is catchable — a caller cannot act on it, so
  the executor warns through the last logger it saw and stays quiet.

- [ ] 3.3 Write `packages/exec-quickjs/test/executor.test.ts` with thirteen tests:

  1. it reports its capabilities (javascript, wasm, async tool calls, timers,
     host-mediated network, the memory cap);
  2. a synchronous block that calls `final_answer` returns the value, with
     `isFinalAnswer` true, the logs, a duration and zero tool calls;
  3. `console.log` lines stream through `onLog` and join into `logs`; a non-string
     argument is JSON-stringified and multiple arguments are space-joined;
  4. a guest awaits a tool and receives its result (a registry holding a real `tool()`
     built with `z.object`);
  5. tool calls emit `requested` then `result` with one call id, a duration and the
     output, and `toolCallCount` counts them;
  6. a tool that throws becomes a guest-visible `Error` the guest can catch, and a
     `failed` event;
  7. an unknown tool name fails only that call;
  8. arguments that fail the schema fail only that call, with the validation message;
  9. a guest `TypeError` comes back as `error` with the guest's own name and message,
     and the `execute` promise still resolves;
  10. a runaway loop is interrupted by `timeoutMs` and reports a timeout;
  11. an aborted signal stops the guest and reports a cancellation;
  12. state survives between two `execute` calls on one instance (D-21);
  13. a tool result JSON cannot express degrades to a string instead of failing the call.

  Build the `ExecuteOptions` with a helper: a `ToolRegistry`, a final-answer sink that
  records what it was given, `AbortController().signal`, a `timeoutMs`, `stepIndex: 0`
  and `noopLogger`. Every test disposes the executor in a `finally`, so a leaked handle
  fails the suite instead of aborting it.

- [ ] 3.4 Run `pnpm vitest run --project exec-quickjs`. Expected: **3 files, 18 tests**,
  exit 0. The bridge is the project's known high-risk item, so a failure here is a
  finding, not a setback: record what it taught and adjust the plan rather than the
  assertion.
- [ ] 3.5 Run `pnpm --filter @smolagents-ts/exec-quickjs run typecheck` and
  `pnpm depcruise`. Expected: both exit 0. The compiler is the only gate on the
  QuickJS type names (`QuickJSContext`, `QuickJSRuntime`, `QuickJSHandle`), so read
  them off the engine's `index.d.ts` rather than guessing.
- [ ] 3.6 Commit: `feat(exec-quickjs): run agent code in QuickJS`.

## Task 4 — the executor under a real agent

**Files**

- create `packages/exec-quickjs/test/code-agent.test.ts`

**Steps**

- [ ] 4.1 Write `packages/exec-quickjs/test/code-agent.test.ts` with four tests. It
  imports `CodeAgent` and `MockModel` from `@smolagents-ts/core` (the barrel exports
  both), scripts the model with fenced code blocks, and drains `agent.stream(task)`:

  1. a code action calls a tool, logs a line and calls `final_answer`; the run completes
     with that value and the event sequence carries `code.completed`,
     `logs.appended`, `action.result` and `observation.completed`;
  2. the step's `ActionStep` records the tool call with its name, arguments and result;
  3. a guest error in step 1 becomes the step's observation and the run continues to step
     2, which calls `final_answer` — the loop survives a broken guest step;
  4. a variable defined in step 1 is readable in step 2, which is D-21 asserted through
     the agent rather than through the executor.

- [ ] 4.2 Run `pnpm vitest run --project exec-quickjs`. Expected: **4 files, 22 tests**,
  exit 0.
- [ ] 4.3 Commit: `test(exec-quickjs): run the executor under a code agent`.

## Task 5 — the run disposes its executor

The seam declares `dispose?()` and its own doc says the executor releases the guest at
the end of the run, but nothing calls it: `packages/core/src` mentions `dispose` only in
the interface. A QuickJS runtime per run that is never released is a leak the interface
promises away, so the loop gets the call it is missing.

**Files**

- modify `packages/core/src/agent/multi-step-agent.ts`
- modify `packages/core/src/agent/code-agent.ts`
- modify `packages/core/test/code-agent.test.ts`

**Steps**

- [ ] 5.1 In `MultiStepAgent`, add a protected hook and call it from `stream`'s
  `finally`, so every terminal path — completion, failure, cancellation, max steps, and
  a consumer that stops reading — releases what the run holds:

  ~~~ts
  /** Release anything the run held. Called once, after the terminal event. */
  protected async releaseResources(): Promise<void> {}
  ~~~

  and wrap the existing body of `stream` in `try { ... } finally { await this.releaseResources(); }`.
  An async generator's `finally` runs on completion and on early `return()`, which is
  what makes this the right place rather than `run()`.

- [ ] 5.2 In `CodeAgent`, override it:

  ~~~ts
  protected override async releaseResources(): Promise<void> {
    await this.executor.dispose?.();
  }
  ~~~

- [ ] 5.3 Add one test to `packages/core/test/code-agent.test.ts`: a run disposes its
  executor when it completes, and does so when it fails. `ScriptedExecutor` has no
  `dispose`, so the test builds an executor whose `dispose` records the call.
- [ ] 5.4 Run `pnpm vitest run --project core`. Expected: **28 files, 287 tests** (286
  before this plan), exit 0.
- [ ] 5.5 Commit: `feat(core): release the executor when a run ends`.

## Task 6 — the barrel, the surface and the scoped entry

**Files**

- create `packages/exec-quickjs/src/index.ts` (replace the placeholder)
- create `packages/exec-quickjs/test/public-surface.test.ts`
- modify `packages/exec-quickjs/AGENTS.md`

**Steps**

- [ ] 6.1 Rewrite `packages/exec-quickjs/src/index.ts` to export `VERSION`,
  `QuickJSExecutor`, its options type, and the guest-source names a test may want to
  reach (`buildGuestSource`). Export no core type of its own: the seam's types come from
  the core, and re-exporting them would create a second home for one interface.
- [ ] 6.2 Write `packages/exec-quickjs/test/public-surface.test.ts`, one test pinning
  the export list, mirroring `packages/tools/test/public-surface.test.ts`.
- [ ] 6.3 Rewrite `packages/exec-quickjs/AGENTS.md`. The current entry describes a
  placeholder and says "nothing here implements it yet" about the bridge, which stops
  being true in this task. Keep the fill rules the file already carries: entry-point
  table, the literal phrase "smallest validation command" with the measured numbers, the
  boundaries, and the hazards — which now name the abort-on-leak behaviour (F7) and the
  host function's return rule (F8) rather than the absence of an implementation.
- [ ] 6.4 Check `rules/components/exec-quickjs.md`. It states obligations ("the guest
  boundary is the product", "a missing engine fails loudly"), not status, so it should
  need no change; if a sentence in it turns out to describe the placeholder instead of the
  rule, correct that sentence through the rule module's `## Contract` section only.
- [ ] 6.5 Run `pnpm vitest run --project exec-quickjs`. Expected: **5 files, 23 tests**,
  exit 0.
- [ ] 6.6 Run `pnpm typecheck && pnpm lint && pnpm depcruise`. Expected: all exit 0.
  Lint is a real gate here, not a formality: an unused type-only import passes the
  compiler and the runner and fails eslint.
- [ ] 6.7 Commit: `feat(exec-quickjs): export the executor`.

## Task 7 — records and the gate

**Files**

- modify `docs/01-project.md` (the S4 row)
- modify `docs/04-tasks.md` and `docs/tasks/archive-2026.md` (T-9)
- modify `docs/03-handoff.md` (one new entry)
- modify `docs/memory/general.md` and `docs/05-memory.md`
- create `.changeset/s4-exec-quickjs.md`
- modify this plan (measured results under the tasks that predicted them)

**Steps**

- [ ] 7.1 Run the whole gate on the final tree and keep its output:
  `pnpm typecheck && pnpm lint && pnpm depcruise && pnpm test && pnpm build && pnpm publint && pnpm attw && pnpm ci:check && pnpm pack:smoke`,
  teed to `.superpowers/gate-s4.txt`. Expected: exit 0, with the exec-quickjs package
  now appearing in publint's and pack-smoke's package counts.
- [ ] 7.2 Run `python scripts/validate_context.py --root . --json` and
  `python scripts/rotate.py --check`. Expected: `new` empty, zero errors, zero
  warnings, and exit 0 from the rotation check.
- [ ] 7.3 Flip the S4 row in `docs/01-project.md` to `done`, and record the measured
  test counts and any deviation from this plan's predictions in the tasks below.
- [ ] 7.4 Close `T-9` in `docs/04-tasks.md`: move the row verbatim into the
  `## Closed 2026-10-14` section of `docs/tasks/archive-2026.md` with its evidence,
  and leave the live table carrying only open work.
- [ ] 7.5 Add one handoff entry, newest-first, at or under the 2048-byte entry cap: what
  S4 shipped, the spike's verdict, the files, the gate's numbers, and the next milestone
  (S5). The live region holds two entries and 4480 of 8192 bytes, so a third entry fits
  as long as it respects the cap.
- [ ] 7.6 Record the lessons in `docs/memory/general.md` and bump that topic's row in
  `docs/05-memory.md`. Candidates, to be kept only if they survive review: a
  synchronous WASM engine can carry an awaited host call if the host drives its job
  queue; a release build that asserts on a leaked handle turns every handle into a
  resource with one owner; a declared optional method nobody calls is a leak with a
  documented apology.
- [ ] 7.7 Add `.changeset/s4-exec-quickjs.md` — a minor bump for
  `@smolagents-ts/exec-quickjs` and, because Task 5 changes the loop, a patch for
  `@smolagents-ts/core`.
- [ ] 7.8 Commit: `docs: record S4`.

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| The drain loop spins while a host tool never settles | a hung step burns CPU until the run's timeout | the loop yields to the host between iterations, and `timeoutMs` defaults to 30 s through `AgentOptions` | a test that omits `timeoutMs` hangs |
| A handle outlives the runtime | the release build aborts the WASM module for the whole process | every handle is disposed on every path; `dispose` catches, per F7 | `Assertion failed: list_empty` in a test's output |
| `context.dispose()` before `runtime.dispose()` is only one working order | a future refactor reorders them and the abort returns | the order is written once, in `dispose`, with the reason beside it | an abort on every disposal |
| The engine's type names differ from the sketch | Task 3 does not compile | read them off `quickjs-emscripten-core/dist/index.d.ts` | `TS2305` on the engine import |
| Task 5's disposal breaks a caller that runs the same agent twice | a second run throws on a spent executor | the failure is a typed error with a sentence; the seam's own lifetime is one run | a core test that runs twice |
| A tool's schema is not an object | the model's `{...}` argument fails validation | every default tool ships an object schema; the failure is a normal tool error the model sees | a `failed` event whose message is a Zod issue |

## Rollback

Tasks 1–4 and 6 add files to one package; dropping the branch's S4 commits leaves the
repository at the S3 state, and no other package imports `exec-quickjs`. Task 5 is the
one change to a shipped package: it is small, additive (a hook with an empty body and one
override) and independently revertable, and reverting it costs the executor's release,
not its correctness.

## Open questions

- [ ] Does a consumer that abandons `agent.stream()` mid-run leave the guest alive? The
  `finally` in Task 5 covers a `return()`, but a generator dropped without one runs its
  `finally` only when the runtime collects it. It does not block Task 1; record the
  answer in Task 7 rather than assuming one.
- [ ] Should `capabilities.cpuTimeLimitMs` report the executor's own budget, when the
  budget is the caller's per-execute `timeoutMs`? The field is optional and the honest
  answer is that this executor has no separate CPU budget; decide in Task 3 and record it.

## Notes

- The spike's script and log are untracked on purpose: `.superpowers/` is not a
  deliverable, and Task 3's tests are the durable form of the same evidence.
- `@jitl/quickjs-wasmfile-release-sync` is a release build with assertions enabled,
  which is why a leak is a loud abort rather than silent growth. That is a gift during
  development and a hazard in production, and Task 6's hazards section says so.
- The engine pair was already declared in the package before this plan; Task 1 adds only
  the core dependency, and the install is what makes the link real.
