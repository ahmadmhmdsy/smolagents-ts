# T-12 — the browser React example Implementation Plan

## Contract

- **Role:** the implementation plan for T-12, the runnable example the S5 row
  names.
- **Mutability:** once execution starts the steps below are frozen: a step that
  turned out wrong gets a note under the task that owns it, and the step's own
  text is not rewritten. Measured results are appended at the end.
- **Read when:** executing this example, or reviewing what T-12 was supposed to
  deliver.
- **Update when:** a task's measured result differs from its prediction, or a
  task is added or dropped.

**Goal:** a browser app under `examples/vite-app` that mounts the React layer
over a real `CodeAgent`, runs the model's program in the QuickJS executor,
builds with Vite, and answers the design's G1 claim — one install, and the same
code runs in a browser tab.

**Architecture:** the app consumes the published names (`smolagents-ts`,
`smolagents-ts/exec/quickjs`, `smolagents-ts/react`) through workspace links, so
it exercises the entry points a reader would install rather than the packages'
internals. The test project aliases those names to the packages' sources, exactly
as `examples/node-script/vitest.config.ts` does, because the gate runs the tests
before it builds anything. The model is the core's `MockModel` with a two-turn
script, so the example needs no provider, no key and no network; the executor is
the real `QuickJSExecutor`, one instance per run, released when the run's agent
is replaced. The React layer is used through its own primitives — `AgentRun`
with `Status`, `Cancel` and `FinalAnswer`, and `AgentStep` with `Code`,
`ToolCalls`, `Logs` and `Observation` — so the example is a consumer of the
shipped surface and not a second implementation of it. The stylesheet is the
example's own, which is what the layer's "nothing is styled" boundary requires.

**Tech Stack:** Vite 6.4 with `@vitejs/plugin-react`, React 19, TypeScript 6
through the example's own `tsconfig.json`, vitest 5 with jsdom and
`@testing-library/react`, and the QuickJS-WASM engine the node example already
depends on.

**Spec:** design section 5.1 (the examples tree), the S5 row, decision 0012 (the
web surface), T-12 in `docs/04-tasks.md`.

**Depends on:** S5 and S6, both done. Nothing in `packages/**` changes; the
example is a consumer.

**Task ownership:** one writer. This plan owns `examples/vite-app/**`,
`docs/04-tasks.md`, `docs/01-project.md` and `README.md`; the handoff and the
memory shard are shared with the session's other work.

## Phases

### Phase 1 — the app

- **Deliverable:** the Vite app: its manifest, `tsconfig.json`,
  `vite.config.ts`, `index.html`, the scripted agent, the composed `App`, the
  entry point and the stylesheet.
- **Files likely affected:** `examples/vite-app/**`.
- **Exit criterion:** `pnpm --filter example-vite-app run typecheck` exits 0 and
  `pnpm --filter example-vite-app run build` emits `dist/index.html`.
- **Verification:** those two commands, with their exit codes.

### Phase 2 — the test

- **Deliverable:** `examples/vite-app/test/app.test.tsx`, which mounts the app
  against a scripted agent and asserts the status region, the step list, the code
  text, the tool call, the logs, the observation and the final answer.
- **Files likely affected:** `examples/vite-app/test/**`,
  `examples/vite-app/vitest.config.ts`.
- **Exit criterion:** `pnpm vitest run --project example-vite-app` passes.
- **Verification:** that command and its reported file and test counts.

### Phase 3 — the workspace wiring

- **Deliverable:** the example installed into the workspace and covered by the
  root gate: the lockfile updated, `pnpm lint` clean over the new files, and the
  example's project picked up by the root `vitest.config.ts`.
- **Files likely affected:** `pnpm-lock.yaml`, `vitest.config.ts` (only if the
  glob misses it), `eslint.config.js` (only if a rule fires).
- **Exit criterion:** `pnpm typecheck`, `pnpm lint` and `pnpm test` exit 0 with
  the example's project in the run.
- **Verification:** the three commands.

### Phase 4 — the reader's path

- **Deliverable:** a short `examples/vite-app/README.md` naming the commands and
  the provider swap, and a pointer from the root `README.md`'s examples section.
- **Files likely affected:** `examples/vite-app/README.md`, `README.md`.
- **Exit criterion:** a reader can copy both commands out of the README.
- **Verification:** reading it back against the manifest's scripts.

### Phase 5 — the records

- **Deliverable:** T-12 closed with its evidence, the project document's row
  updated, a handoff entry, and the lesson the build taught.
- **Files likely affected:** `docs/04-tasks.md`, `docs/tasks/archive-2026.md`,
  `docs/01-project.md`, `docs/03-handoff.md`, `docs/memory/general.md`,
  `docs/05-memory.md`.
- **Exit criterion:** the validator reports no new finding and the task row
  carries a non-empty evidence cell.
- **Verification:** `python scripts/validate_context.py --root . --json
  --baseline docs/.baseline.json`.

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| The QuickJS engine does not bundle for a browser | high | The example falls back to the core's `ScriptedExecutor` for the same UI, and the browser gap becomes its own task row carrying the measurement. | `vite build` fails on a `node:` import or a missing `.wasm` asset. |
| The React plugin's major does not match Vite 6 | medium | Pin the plugin's major to the one that declares Vite 6 support and read the resolution back from the lockfile. | `pnpm install` reports an unmet peer, or `vite build` throws from the plugin. |
| The scripted model's turns do not match the loop's calls | medium | Script two turns — a tool call, then the answer — and let the assertion on the step count fail loudly if the loop asks for a third. | The run ends `failed` with `MockModel script exhausted`. |
| A step's declaration does not survive into the next step | medium | Keep the second turn self-contained if the measurement says declarations do not persist. | The second step's program throws `greeting is not defined`. |

## Rollback

Delete `examples/vite-app/` and revert the lockfile and the README pointer. No
package changes, so nothing published or pinned is touched; T-12 returns to
`pending` with this plan as its record.

## Open questions

- [ ] Does the browser build need the WASM? — it does not block phase 1, because
      the fallback in the risks table is named and measured the same way.
- [ ] Should the example offer a live provider? — deferred; a key inside a
      browser bundle is the reader's decision, not the example's default.

## Tasks

Created in docs/04-tasks.md. List the task IDs here once they exist.

| Task ID | Phase | Status |
|---|---|---|
| T-12 | 1–5 | done |

## Notes

Measured results are appended below as each phase lands.

## Measured results

Appended after execution. The phases above are the predictions; this section is
the measurement, and nothing above it was edited.

Executed on 2026-10-14, Node v24.18.0, pnpm 12.3.4.

| command | result |
|---|---|
| `pnpm install` | exit 0; the lockfile gains the `examples/vite-app` importer, and the React plugin resolves to a major that declares Vite 6 |
| `pnpm --filter example-vite-app run typecheck` | exit 0 |
| `pnpm vitest run --project example-vite-app` | exit 0; one file, two tests, about 2.9 s under jsdom |
| `pnpm --filter example-vite-app run build` | exit 0; 179 modules, `index.html` 0.43 kB, the engine as a 503.13 kB `.wasm` asset, the app chunk 363.67 kB (111.49 kB gzip), built in 1.78 s |

The first risk is retired rather than mitigated: the engine bundles for a browser
with no configuration, so the fallback and the task row it would have created are
not needed. The third was measured too, and the two scripted turns are exactly
the two the loop asks for. The fourth is confirmed in the direction the plan
hoped for: the first step's `const greeting` is visible to the second step's
program, because the realm is created once per run and reused.

Both open questions are answered. The browser build does need the WASM, and gets
it as an asset. The example stays offline: it ships no provider, no key and no
network call, so the reader's path needs no credential.

