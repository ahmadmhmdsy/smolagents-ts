# S5 — the React layer Implementation Plan

## Contract

- **Role:** the implementation plan for milestone S5 of
  `docs/design/2026-10-12-smolagents-ts-v1-design.md`.
- **Mutability:** append-only from the moment execution begins. A step that proved
  wrong gets a note under the task that owns it; the step text itself is left alone.
- **Read when:** executing S5, or reviewing what S5 was supposed to deliver.
- **Update when:** a task's measured result differs from its prediction, or a task is
  added or dropped.

**Goal:** make `@smolagents-ts/react` the L2 hooks and L3 headless primitives that render a
run — `useAgentSession`, `useAgentRun`, `useAgentEvent`, and the `AgentRun` / `AgentStep`
families — unstyled, ARIA-correct and overridable, over the core's `AgentSession`.

**Architecture:** the core already ships the framework-agnostic store (L1, design spec
5.3): `AgentSession.subscribe` and `AgentSession.getSnapshot` are exactly React's
`useSyncExternalStore` contract, so L2 is three small hooks and no state of its own. L3 is
a set of compound components over the same snapshot: `AgentRun` owns one session for one
run (created with `useAgentRun`, started when `task` changes), and the step primitives
read the current step from a context that `AgentStep.Action` / `.Planning` / `.FinalAnswer`
provide, which is why the design's example can write `<AgentStep.Code />` with no props.
Nothing in the package holds run state, imports a DOM global outside an effect, or imports
the core's internals; the core never imports this package.

**Tech Stack:** React 19.3.0 (peer, optional; the workspace supplies it for tests),
`useSyncExternalStore`, TypeScript 6 with `jsx: react-jsx` from `tsconfig.base.json`,
`@testing-library/react` 16.3.3 with `@testing-library/dom`, jsdom 30.1.2 through Vitest's
`environment: "jsdom"`, tsup, pnpm workspaces.

**Spec:** design record section 10 — 10.1 (the three hooks), 10.2 (the primitives and the
five accessibility obligations they own), 10.3 (L4 patterns stay deferred) — plus section
5.3 for the store's shape and D6 for the layering.

**Depends on:** S1 (`AgentSession`, the event union, `AgentEventType`) and S2 (the agent
classes the hooks take). Independent of S3 and S4: the hooks take an agent and a session,
so a caller may use `ToolCallingAgent` or `CodeAgent` and any executor.

**Dependency order:** Task 1 installs the toolchain every later task runs on; Task 2 is the
hook every later one builds on; Tasks 3 and 4 are independent of each other; Task 5 needs
Task 2; Task 6 is the core planning lane whose view type Task 7's planning primitive needs;
Task 7 needs Task 5's contexts; Task 8 composes Tasks 5 and 7; Task 9 exports and records
what Tasks 2–8 built.

**Task ownership:** `T-11` in `docs/04-tasks.md` owns this plan's execution. The
checkboxes below are the plan's steps, not the task row.

## The toolchain spike (measured 2026-10-14, before this plan)

The React layer had no toolchain: the package was a placeholder with a smoke test, React
was an optional peer with no copy in the workspace, and the project had no DOM environment.
The spike installed `react`/`react-dom` 19.3.0, `@types/react`/`@types/react-dom` 19.3.0,
`@testing-library/react` 16.3.3 with `@testing-library/dom` 10.4.2 and `jsdom` 30.1.2 as
the react package's devDependencies, and measured a throwaway probe (deleted; the findings
are re-asserted as tests in Tasks 2, 5 and 6):

| # | finding |
|---|---|
| F1 | React 19.3.0 renders under Vitest's jsdom project, and `.tsx` compiles without new config: `tsconfig.base.json` already sets `jsx: react-jsx` and includes the DOM lib. |
| F2 | `useSyncExternalStore` over a real `AgentSession` works end to end: the probe read `idle` before the run, then `success`, output `42`, one step and `lastEventType: run.completed` after `send`. |
| F3 | `AgentSession`'s methods are unbound, so the subscribe function passed to `useSyncExternalStore` must be a closure (`(listener) => session.subscribe(listener)`); passing `session.subscribe` itself loses `this`. |
| F4 | `@testing-library/react`'s automatic cleanup needs a global `afterEach`, and this repo imports its test functions instead of enabling globals: without a setup file the previous test's DOM survived into the next one (measured: the string "running" was still in `document.body`). With `afterEach(cleanup)` registered, `document.body.children.length` was 0. |
| F5 | `render` + `getByRole` read the ARIA attributes the primitives own: `aria-live="polite"` and `aria-busy="true"` came back verbatim, so the a11y obligations are assertable without a matcher library. |
| F6 | `CodeAgentOptions.executor` is required, so every fixture in this plan passes a `ScriptedExecutor`; a type-erased caller that omits it fails the run with a misleading error, because the release hook runs after the failure. |

F3 and F4 shape the code: the hook wraps the store's methods, and the project needs
`test/setup.ts`. Task 1 commits the manifest and the configuration the spike measured.

## Spec coverage

| spec item | where it lands |
|---|---|
| 10.1 `useAgentSession` | Task 2: `src/session.ts` over `useSyncExternalStore` |
| 10.1 `useAgentRun` | Task 3: `src/use-agent-run.ts`; the design's `autoStart` is dropped, see Open questions |
| 10.1 `useAgentEvent` | Task 4: `src/use-agent-event.ts`; handler kept fresh by a ref |
| 10.2 `AgentRun`, `.Status`, `.Steps`, `.FinalAnswer` | Task 5: `src/agent-run.tsx`, plus `.Cancel` for the cancellation obligation |
| 10.2 component overrides | Task 5: the `components` map on `AgentRun`, consulted by the step roots |
| 10.2 `AgentStep.*` and the leaf primitives | Task 7: `src/agent-step.tsx`, `src/code-block.tsx`, `src/tool-call.tsx`, `src/final-answer.tsx` |
| 10.2 `aria-live="polite"` on appended output | Task 7: `AgentStep.Logs` |
| 10.2 `aria-busy` while running | Task 5: `AgentRun.Status` |
| 10.2 keyboard-navigable list, correct roles | Task 5: `AgentRun.Steps` renders an ordered list of `<li>` steps |
| 10.2 tool-call completion announced once | Task 7: `ToolCall` reads only the authoritative `action.result`/`action.failed` status the store records |
| 10.2 cancellation reachable by keyboard | Task 5: `AgentRun.Cancel` is a real `<button type="button">` |
| the run inspector's planning lane | Task 6: `AgentSession` gains `planning` views from the `planning.*` events the loop already emits |
| a way to read the snapshot inside `<AgentRun>` | Task 5: `useAgentRunSnapshot`, an addition to the design's surface, see Open questions |
| 10.3 L4 patterns | not in this plan: `<RunInspector>` and `<ChatSurface>` stay deferred to after v1, per the design |
| tests and shape | Tasks 2–8 (jsdom tests), Task 9 (barrel, surface, AGENTS.md, changeset, gate) |

## File structure

| file | responsibility |
|---|---|
| `packages/react/src/session.ts` | `useAgentSession`: subscribe to the L1 store |
| `packages/react/src/use-agent-run.ts` | `useAgentRun`: own one session, expose run/cancel/reset |
| `packages/react/src/use-agent-event.ts` | `useAgentEvent`: one event type, latest handler |
| `packages/react/src/context.ts` | the run and step contexts, their providers and reader hooks |
| `packages/react/src/agent-run.tsx` | `AgentRun` and `.Status` / `.Steps` / `.Cancel` / `.FinalAnswer` |
| `packages/react/src/agent-step.tsx` | `AgentStep` and `.Action` / `.Planning` / `.FinalAnswer` / `.Code` / `.ToolCalls` / `.Logs` / `.Observation` |
| `packages/react/src/code-block.tsx` | `CodeBlock`: the one place a `<pre><code>` is written |
| `packages/react/src/tool-call.tsx` | `ToolCall`: one call's name, status, arguments and result |
| `packages/react/src/final-answer.tsx` | `FinalAnswer`: the run's output, or nothing while there is none |
| `packages/react/src/index.ts` | the public barrel |
| `packages/react/test/setup.ts` | `afterEach(cleanup)` |
| `packages/react/test/*.test.tsx` | one test file per task, plus the composition and surface tests |
| `packages/core/src/session/agent-session.ts` | the planning lane (Task 6) |

## Tasks

### Task 1 — the React toolchain and the test environment

**Files:** `packages/react/package.json`, `packages/react/tsup.config.ts`,
`packages/react/vitest.config.ts`, `packages/react/tsconfig.test.json`,
`packages/react/test/setup.ts`

- [ ] 1.0 Add this plan's row to `docs/04-tasks.md`: `T-11`, status `in_progress`, the
owner as this session, and this plan as its evidence. Expected: the validator still
reports 0 errors with the new row present.
- [ ] 1.1 Replace the manifest: keep the name, version, `private`, exports, `files` and
      scripts; add `@smolagents-ts/core` as a workspace dependency; drop the `zod`
      dependency the placeholder carried and nothing imports; add the spike's devDependencies
      as caret ranges.
      ```json
      {
        "name": "@smolagents-ts/react",
        "version": "0.0.0",
        "private": true,
        "type": "module",
        "sideEffects": false,
        "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
        "files": ["dist"],
        "scripts": { "build": "tsup", "typecheck": "tsc --noEmit -p tsconfig.test.json" },
        "dependencies": { "@smolagents-ts/core": "workspace:*" },
        "peerDependencies": { "react": ">=18", "react-dom": ">=18" },
        "peerDependenciesMeta": { "react": { "optional": true }, "react-dom": { "optional": true } },
        "devDependencies": {
          "@testing-library/dom": "^10.4.2",
          "@testing-library/react": "^16.3.3",
          "@types/react": "^19.3.0",
          "@types/react-dom": "^19.3.0",
          "jsdom": "^30.1.2",
          "react": "^19.3.0",
          "react-dom": "^19.3.0"
        }
      }
      ```
      Expected: `pnpm install` reports "Already up to date" or installs nothing new, and
      `pnpm-lock.yaml` changes only in the specifier ranges for this package.
- [ ] 1.2 Remove `"zod"` from `tsup.config.ts`'s `external` array; the package no longer
      depends on it. Keep `react`, `react-dom` and `react/jsx-runtime` external.
- [ ] 1.3 Write `vitest.config.ts`: the jsdom environment, the cleanup setup file, and the
      core-to-source alias, because the gate runs this project before any `dist/` exists.
      ```ts
      import { fileURLToPath } from "node:url";
      import { defineProject } from "vitest/config";

      export default defineProject({
        test: {
          name: "react",
          fileParallelism: false,
          environment: "jsdom",
          setupFiles: ["./test/setup.ts"],
        },
        resolve: {
          alias: {
            "@smolagents-ts/core": fileURLToPath(new URL("../core/src/index.ts", import.meta.url)),
          },
        },
      });
      ```
- [ ] 1.4 Widen `tsconfig.test.json` so it can typecheck core's sources too, exactly as
      `exec-quickjs` does: `"rootDir": "../.."` beside `"types": ["node"]` and `noEmit`.
- [ ] 1.5 Write `test/setup.ts` (finding F4):
      ```ts
      import { afterEach } from "vitest";
      import { cleanup } from "@testing-library/react";

      // testing-library's automatic cleanup relies on a global afterEach, and this project
      // imports its test functions from "vitest" instead of enabling globals.
      afterEach(() => {
        cleanup();
      });
      ```
- [ ] 1.6 Run `pnpm vitest run --project react`. Expected: 1 file, 1 test
      (`test/smoke.test.ts`), exit code 0.
- [ ] 1.7 Run `pnpm --filter @smolagents-ts/react typecheck` and `pnpm lint`. Expected: both
      exit 0.
- [ ] 1.8 Commit: `chore(react): install the React test toolchain`.

### Task 2 — `useAgentSession`

**Files:** `packages/react/src/session.ts`, `packages/react/test/helpers.ts`,
`packages/react/test/use-agent-session.test.tsx`

- [ ] 2.1 Write the hook. The store's methods are wrapped rather than passed directly,
      because they are not bound to the instance (finding F3).
      ```ts
      import { useSyncExternalStore } from "react";
      import type { AgentSession, AgentSessionSnapshot } from "@smolagents-ts/core";

      /**
       * Subscribe to the session's store. React's contract is subscribe plus getSnapshot, and
       * the session caches its snapshot, so a render reads the same object until the run moves.
       */
      export function useAgentSession<TOut = unknown>(
        session: AgentSession<TOut>,
      ): AgentSessionSnapshot {
        return useSyncExternalStore(
          (listener) => session.subscribe(listener),
          () => session.getSnapshot(),
          () => session.getSnapshot(),
        );
      }
      ```
- [ ] 2.2 Write `test/helpers.ts`: the fenced-code fixture and a one-step agent.
      ```ts
      import { CODE_FENCE, CodeAgent, MockModel, ScriptedExecutor, type CodeResult } from "@smolagents-ts/core";

      /** One model turn that writes a single fenced code block. */
      export function fenced(thought: string, code: string): string {
        return "Thought: " + thought + "\nCode:\n" + CODE_FENCE + "\n" + code + "\n" + CODE_FENCE;
      }

      /** An executor that submits `value` as the final answer on the first step. */
      export function answering(value: unknown): ScriptedExecutor {
        return new ScriptedExecutor({
          handler: (_code, options): CodeResult => {
            options.finalAnswer.submit(value);
            return { logs: "", isFinalAnswer: false, durationMs: 0, toolCallCount: 0 };
          },
        });
      }

      /** A CodeAgent that answers `value` in one step. `executor` is required (finding F6). */
      export function agentThatAnswers(value: unknown): CodeAgent {
        return new CodeAgent({
          model: new MockModel([fenced("answer", "final_answer(" + JSON.stringify(value) + ")")]),
          executor: answering(value),
        });
      }
      ```
- [ ] 2.3 Write the test file with four cases: the idle snapshot before the run; the finished
      snapshot after `await act(async () => { await session.send("Q"); })` (status
      `success`, output, one step); one snapshot object while nothing changes (two renders
      return the identical reference); and two components reading the same session (both go
      from `idle` to `success`).
- [ ] 2.4 Run `pnpm vitest run --project react`. Expected: 2 files, 5 tests, exit 0.
- [ ] 2.5 Commit: `feat(react): subscribe to a session with useAgentSession`.

### Task 3 — `useAgentRun`

**Files:** `packages/react/src/use-agent-run.ts`, `packages/react/test/use-agent-run.test.tsx`

- [ ] 3.1 Write the hook. It owns one session for one agent identity and returns the handle
      the design names.
      ```ts
      import { useCallback, useMemo } from "react";
      import {
        AgentSession,
        type AgentSessionSnapshot,
        type MultiStepAgent,
        type RunResult,
      } from "@smolagents-ts/core";
      import { useAgentSession } from "./session.js";

      export interface AgentRunHandle<TOut = unknown> {
        readonly session: AgentSession<TOut>;
        readonly snapshot: AgentSessionSnapshot;
        run(task: string, options?: { signal?: AbortSignal }): Promise<RunResult<TOut>>;
        cancel(): void;
        reset(): void;
      }

      /**
       * Own one run. The session is memoised on the agent, so re-rendering with the same agent
       * keeps the store (and its history); passing a new agent starts a fresh session.
       */
      export function useAgentRun<TOut = unknown>(agent: MultiStepAgent<TOut>): AgentRunHandle<TOut> {
        const session = useMemo(() => new AgentSession<TOut>(agent), [agent]);
        const snapshot = useAgentSession(session);
        const run = useCallback(
          (task: string, options?: { signal?: AbortSignal }) => session.send(task, options),
          [session],
        );
        const cancel = useCallback(() => session.cancel(), [session]);
        const reset = useCallback(() => session.reset(), [session]);
        return useMemo(
          () => ({ session, snapshot, run, cancel, reset }),
          [session, snapshot, run, cancel, reset],
        );
      }
      ```
- [ ] 3.2 Write the test file: the handle exposes a session and an idle snapshot; `run`
      resolves with the run result and moves the snapshot to `success` with the output;
      `reset` returns the store to `idle`; the session identity survives a re-render with
      the same agent and changes with a new one.
- [ ] 3.3 Run `pnpm vitest run --project react`. Expected: 3 files, 9 tests, exit 0.
- [ ] 3.4 Commit: `feat(react): own a run with useAgentRun`.

### Task 4 — `useAgentEvent`

**Files:** `packages/react/src/use-agent-event.ts`, `packages/react/test/use-agent-event.test.tsx`

- [ ] 4.1 Write the hook. The handler is held in a ref so a new closure per render does not
      re-subscribe, and the subscription follows the agent and the type.
      ```ts
      import { useEffect, useRef } from "react";
      import type { AgentEvent, AgentEventType, MultiStepAgent } from "@smolagents-ts/core";

      /**
       * Call `handler` for every event of `type` the agent emits, for the life of the mount.
       * The handler lives in a ref, so an inline arrow function does not re-subscribe per render.
       */
      export function useAgentEvent(
        agent: MultiStepAgent,
        type: AgentEventType,
        handler: (event: AgentEvent) => void,
      ): void {
        const handlerRef = useRef(handler);
        useEffect(() => {
          handlerRef.current = handler;
        });
        useEffect(
          () => agent.on((event) => {
            if (event.type === type) handlerRef.current(event);
          }),
          [agent, type],
        );
      }
      ```
- [ ] 4.2 Write the test file: only the subscribed type reaches its handler (subscribe to
      `step.started` and `run.completed`, run once, expect both in order); the newest
      handler runs after a re-render; unmounting stops delivery.
- [ ] 4.3 Run `pnpm vitest run --project react`. Expected: 4 files, 12 tests, exit 0.
- [ ] 4.4 Commit: `feat(react): listen to one event type with useAgentEvent`.

### Task 5 — the run context and `AgentRun`

**Files:** `packages/react/src/context.ts`, `packages/react/src/agent-run.tsx`,
`packages/react/test/agent-run.test.tsx`

- [ ] 5.1 Write `src/context.ts`: the run context the primitives read, the step context the
      leaf primitives read, and the override map. A reader outside its provider throws a
      sentence that says where it belongs, rather than rendering nothing.
      ```ts
      import { createContext, useContext, type ComponentType } from "react";
      import type { AgentSessionSnapshot, MultiStepAgent, PlanningView, StepView } from "@smolagents-ts/core";

      export interface AgentRunComponents {
        readonly action?: ComponentType<{ readonly step: StepView }>;
        readonly planning?: ComponentType<{ readonly planning: PlanningView }>;
        readonly finalAnswer?: ComponentType<{ readonly step: StepView }>;
      }

      export interface AgentRunContextValue {
        readonly agent: MultiStepAgent;
        readonly snapshot: AgentSessionSnapshot;
        readonly components: AgentRunComponents;
        readonly cancel: () => void;
      }

      const AgentRunContext = createContext<AgentRunContextValue | null>(null);
      export const AgentRunProvider = AgentRunContext.Provider;

      export function useAgentRunContext(): AgentRunContextValue {
        const value = useContext(AgentRunContext);
        if (value === null) {
          throw new Error("This component must be rendered inside <AgentRun>.");
        }
        return value;
      }

      /** The snapshot of the run this component sits in, for a custom composition. */
      export function useAgentRunSnapshot(): AgentSessionSnapshot {
        return useAgentRunContext().snapshot;
      }

      const StepContext = createContext<StepView | null>(null);
      export const StepProvider = StepContext.Provider;

      export function useStepContext(): StepView {
        const value = useContext(StepContext);
        if (value === null) {
          throw new Error("This component must be rendered inside an <AgentStep.Action> or <AgentStep.FinalAnswer>.");
        }
        return value;
      }
      ```
      Expected: `pnpm --filter @smolagents-ts/react typecheck` exits 0 (Task 6 adds
      `PlanningView` to core; until then this file does not compile, so run this check after
      Task 6).
- [ ] 5.2 Write `src/agent-run.tsx`. The run starts from an effect keyed on the session and
      the task, with a ref so a re-render (or StrictMode's double-invoked effect) does not
      start a second run for the same pair.
      ```tsx
      import { useEffect, useMemo, useRef, type ReactNode } from "react";
      import type { AgentSession, MultiStepAgent, SessionStatus, StepView } from "@smolagents-ts/core";
      import { AgentRunProvider, useAgentRunContext, type AgentRunComponents } from "./context.js";
      import { FinalAnswer } from "./final-answer.js";
      import { useAgentRun } from "./use-agent-run.js";

      export interface AgentRunProps {
        readonly agent: MultiStepAgent;
        readonly task: string;
        readonly components?: AgentRunComponents;
        readonly children?: ReactNode;
      }

      const STATUS_TEXT: Record<SessionStatus, string> = {
        idle: "Idle",
        running: "Running",
        success: "Finished",
        failed: "Failed",
        cancelled: "Cancelled",
        max_steps: "Stopped at the step limit",
      };

      function AgentRunRoot({ agent, task, components, children }: AgentRunProps) {
        const { session, snapshot, run, cancel } = useAgentRun(agent);
        const started = useRef<{ session: AgentSession; task: string } | null>(null);
        useEffect(() => {
          const previous = started.current;
          if (previous !== null && previous.session === session && previous.task === task) return;
          started.current = { session, task };
          void run(task);
        }, [session, run, task]);
        const value = useMemo(
          () => ({ agent, snapshot, components: components ?? {}, cancel }),
          [agent, snapshot, components, cancel],
        );
        return (
          <AgentRunProvider value={value}>
            <div className="agent-run" data-status={snapshot.status} data-running={snapshot.isRunning}>
              {children}
            </div>
          </AgentRunProvider>
        );
      }

      /** The run's status, announced politely and busy while it runs. */
      function AgentRunStatus() {
        const { snapshot } = useAgentRunContext();
        return (
          <p role="status" aria-live="polite" aria-busy={snapshot.isRunning}>
            {snapshot.isRunning
              ? "Running, step " + String(snapshot.steps.length)
              : STATUS_TEXT[snapshot.status]}
          </p>
        );
      }

      export interface AgentRunStepsProps {
        readonly children?: ReactNode | ((step: StepView) => ReactNode);
      }

      /** The step list: an ordered list, one focusable item per step. */
      function AgentRunSteps({ children }: AgentRunStepsProps) {
        const { snapshot } = useAgentRunContext();
        return (
          <ol className="agent-run-steps">
            {snapshot.steps.map((step) => (
              <li key={step.stepIndex} data-step-index={step.stepIndex} data-status={step.status} tabIndex={0}>
                {typeof children === "function" ? children(step) : children}
              </li>
            ))}
          </ol>
        );
      }

      /** Cancellation as a real button, disabled when there is nothing to cancel. */
      function AgentRunCancel() {
        const { snapshot, cancel } = useAgentRunContext();
        return (
          <button type="button" onClick={cancel} disabled={!snapshot.isRunning}>
            Cancel run
          </button>
        );
      }

      function AgentRunFinalAnswer() {
        const { snapshot } = useAgentRunContext();
        return snapshot.status === "success" ? <FinalAnswer value={snapshot.output} /> : null;
      }

      export const AgentRun = Object.assign(AgentRunRoot, {
        Status: AgentRunStatus,
        Steps: AgentRunSteps,
        Cancel: AgentRunCancel,
        FinalAnswer: AgentRunFinalAnswer,
      });
      ```
- [ ] 5.3 Write `test/agent-run.test.tsx` with a gated executor so the running state is
      deterministic: a `ScriptedExecutor` whose handler awaits a promise the test releases.
      Cases: on mount the status region is `role="status"`, `aria-live="polite"` and
      `aria-busy="true"`, and it is still busy until the gate opens; after the gate opens it
      reads "Finished" with `aria-busy="false"`; the step list is a `list` of one
      `listitem` carrying `data-step-index="0"`; the cancel control is a `button` and
      clicking it while the gate is closed settles the run as `cancelled` and disables the
      button. If the shipped loop reports an aborted run as `failed` rather than
      `cancelled`, record that in Measured results instead of changing the expectation to
      match.
- [ ] 5.4 Run `pnpm vitest run --project react`. Expected: 5 files, 16 tests, exit 0.
- [ ] 5.5 Commit: `feat(react): render a run with AgentRun`.

### Task 6 — the planning lane in `AgentSession` (core)

**Files:** `packages/core/src/session/agent-session.ts`,
`packages/core/test/agent-session-planning.test.ts`

- [ ] 6.1 Add `PlanningView` beside `StepView` and a `planning` field to the snapshot:
      ```ts
      export interface PlanningView {
        readonly stepIndex: number;
        readonly status: "streaming" | "complete";
        readonly text: string;
        readonly startedAt: number;
        readonly endedAt?: number;
      }
      ```
      Add `readonly planning: readonly PlanningView[]` to `AgentSessionSnapshot`, a
      `PlanningDraft` mirror and a `planning: PlanningDraft[]` field to `RunDraft`, and
      `planning: []` to `emptyRun()`.
- [ ] 6.2 Handle the three events in the reducer, following the arms already there: 
      `planning.started` pushes a streaming draft for `event.stepIndex`;
      `planning.delta` appends `event.text` to the newest streaming draft;
      `planning.completed` sets that draft's `text` to `event.text` wholesale, marks it
      `complete` and stamps `endedAt` — the completed text is authoritative, exactly as
      `message.completed` replaces a provisional thought. Freeze the array in the snapshot
      builder. Replace the `default:` comment that says the lane is unhandled.
- [ ] 6.3 Write the test: a `CodeAgent` with `planningInterval: 1` and a `MockModel` of
      three turns (a code step that does not answer, the plan text, a code step that
      answers), driven through `new AgentSession(agent).send("Q")`. Assert one planning
      entry, `status: "complete"`, and the plan text; and that a run with planning disabled
      has an empty lane.
- [ ] 6.4 Run `pnpm vitest run --project core`. Expected: 29 files, 290 tests, exit 0.
- [ ] 6.5 Commit: `feat(core): collect the planning lane in the session store`.

### Task 7 — the step primitives

**Files:** `packages/react/src/agent-step.tsx`, `packages/react/src/code-block.tsx`,
`packages/react/src/tool-call.tsx`, `packages/react/src/final-answer.tsx`,
`packages/react/test/agent-step.test.tsx`

- [ ] 7.1 Write `src/code-block.tsx` and `src/final-answer.tsx`: the one `<pre><code>` and
      the one value-to-text renderer, so the step primitives do not each invent one.
      ```tsx
      import type { ReactNode } from "react";

      export interface CodeBlockProps {
        readonly code: string;
        readonly children?: ReactNode;
      }

      export function CodeBlock({ code, children }: CodeBlockProps) {
        return (
          <pre className="agent-code-block">
            <code>{code}</code>
            {children}
          </pre>
        );
      }

      /** A value as text: strings verbatim, everything else as JSON when it can be. */
      export function renderValue(value: unknown): string {
        if (typeof value === "string") return value;
        try {
          return JSON.stringify(value) ?? String(value);
        } catch {
          return String(value);
        }
      }

      export interface FinalAnswerProps {
        readonly value: unknown;
        readonly children?: ReactNode;
      }

      /** The run's answer. Renders nothing until there is one. */
      export function FinalAnswer({ value, children }: FinalAnswerProps) {
        if (value === undefined) return null;
        return (
          <div className="agent-final-answer">
            <span>{renderValue(value)}</span>
            {children}
          </div>
        );
      }
      ```
- [ ] 7.2 Write `src/tool-call.tsx`. The status text is the only live region, and it reads
      the store's authoritative status, which is set from `action.result` / `action.failed`
      — never from a provisional call.
      ```tsx
      import type { ReactNode } from "react";
      import type { ToolCallView } from "@smolagents-ts/core";
      import { renderValue } from "./final-answer.js";

      export interface ToolCallProps {
        readonly call: ToolCallView;
        readonly children?: ReactNode;
      }

      const STATUS_TEXT: Record<ToolCallView["status"], string> = {
        pending: "running",
        ok: "done",
        error: "failed",
      };

      export function ToolCall({ call, children }: ToolCallProps) {
        return (
          <div className="agent-tool-call" data-tool={call.name} data-status={call.status}>
            <span className="agent-tool-call-name">{call.name}</span>
            <span role="status" aria-live="polite">{STATUS_TEXT[call.status]}</span>
            {call.output === undefined ? null : (
              <pre className="agent-tool-call-output">{renderValue(call.output)}</pre>
            )}
            {call.error === undefined ? null : (
              <pre className="agent-tool-call-error">{call.error}</pre>
            )}
            {children}
          </div>
        );
      }
      ```
- [ ] 7.3 Write `src/agent-step.tsx`: `AgentStep` with `.Action`, `.Planning`,
      `.FinalAnswer`, `.Code`, `.ToolCalls`, `.Logs`, `.Observation`. The three step
      wrappers consult the override map first; `Action` and `FinalAnswer` provide the step
      context the leaves read; `.Logs` is the `aria-live="polite"` region for appended
      output; a leaf with nothing to show renders nothing rather than an empty element.
      ```tsx
      import type { ReactNode } from "react";
      import type { PlanningView, StepView } from "@smolagents-ts/core";
      import { StepProvider, useAgentRunContext, useStepContext } from "./context.js";
      import { CodeBlock } from "./code-block.js";
      import { FinalAnswer } from "./final-answer.js";
      import { ToolCall } from "./tool-call.js";

      export interface AgentStepProps {
        readonly step: StepView;
        readonly children?: ReactNode;
      }

      function AgentStepAction({ step, children }: AgentStepProps) {
        const Override = useAgentRunContext().components.action;
        if (Override !== undefined) return <Override step={step} />;
        return (
          <StepProvider value={step}>
            <section className="agent-step-action" data-step-index={step.stepIndex} data-status={step.status}>
              {children}
            </section>
          </StepProvider>
        );
      }

      export interface AgentStepPlanningProps {
        readonly planning: PlanningView;
        readonly children?: ReactNode;
      }

      function AgentStepPlanning({ planning, children }: AgentStepPlanningProps) {
        const Override = useAgentRunContext().components.planning;
        if (Override !== undefined) return <Override planning={planning} />;
        return (
          <section className="agent-step-planning" data-status={planning.status}>
            <pre className="agent-step-planning-text">{planning.text}</pre>
            {children}
          </section>
        );
      }

      function AgentStepFinalAnswer({ step, children }: AgentStepProps) {
        const Override = useAgentRunContext().components.finalAnswer;
        if (Override !== undefined) return <Override step={step} />;
        return (
          <StepProvider value={step}>
            <section className="agent-step-final-answer" data-step-index={step.stepIndex}>
              {step.observation === null ? null : <FinalAnswer value={step.observation} />}
              {children}
            </section>
          </StepProvider>
        );
      }

      function AgentStepCode() {
        const step = useStepContext();
        return step.code === null ? null : <CodeBlock code={step.code} />;
      }

      function AgentStepLogs() {
        const step = useStepContext();
        return step.logs === "" ? null : (
          <pre className="agent-step-logs" aria-live="polite" aria-label="Run output">{step.logs}</pre>
        );
      }

      function AgentStepObservation() {
        const step = useStepContext();
        return step.observation === null || step.observation === "" ? null : (
          <div className="agent-step-observation">{step.observation}</div>
        );
      }

      function AgentStepToolCalls() {
        const step = useStepContext();
        if (step.toolCalls.length === 0) return null;
        return (
          <ul className="agent-step-tool-calls">
            {step.toolCalls.map((call) => (
              <li key={call.id}><ToolCall call={call} /></li>
            ))}
          </ul>
        );
      }

      export const AgentStep = Object.assign(AgentStepAction, {
        Action: AgentStepAction,
        Planning: AgentStepPlanning,
        FinalAnswer: AgentStepFinalAnswer,
        Code: AgentStepCode,
        ToolCalls: AgentStepToolCalls,
        Logs: AgentStepLogs,
        Observation: AgentStepObservation,
      });
      ```
- [ ] 7.4 Write `test/agent-step.test.tsx`: a step with code, logs, a tool call and an
      observation renders each leaf; a leaf with nothing renders nothing (no empty `<pre>`);
      `AgentStep.Logs` carries `aria-live="polite"`; a call whose status is `pending`
      reads "running" and one that the store marked `ok` reads "done"; the leaves throw the
      context sentence when rendered outside a step wrapper; `renderValue` renders a string
      verbatim and an object as JSON.
- [ ] 7.5 Run `pnpm vitest run --project react`. Expected: 6 files, 22 tests, exit 0.
- [ ] 7.6 Commit: `feat(react): render steps with AgentStep`.

### Task 8 — the composition, the overrides and the accessibility obligations

**Files:** `packages/react/test/composition.test.tsx`

- [ ] 8.1 Write the test the design's example describes: a `CodeAgent` over a
      `ScriptedExecutor` that reports a tool call (`onToolCall` with a `requested` and a
      `result` event), returns logs, and answers on the second step, wrapped in
      `<AgentRun>` with `<AgentRun.Status />`, `<AgentRun.Steps>` over
      `<AgentStep.Action>` with `.Code` / `.ToolCalls` / `.Logs` / `.Observation`,
      and `<AgentRun.FinalAnswer />`. Assert: the status region ends at "Finished" with
      `aria-busy="false"`; the step list has one item per step; the code text is present;
      the logs region carries `aria-live="polite"` and its text; the tool call's container
      carries `data-status="ok"` and its name; the observation is rendered; the final answer
      is "42". Assert the whole tree contains no `[object Object]`.
- [ ] 8.2 Add the override case: the same composition with
      `components={{ action: () => <div data-testid="custom-action" /> }}` renders the
      custom component once per step and no `.agent-step-action` element.
- [ ] 8.3 Add the planning-lane case: a `planningInterval: 1` agent, a `PlanningLane`
      component inside `<AgentRun>` that reads `useAgentRunSnapshot()` and maps
      `snapshot.planning` to `<AgentStep.Planning planning={...} />`; assert the plan text
      is rendered and `data-status="complete"`.
- [ ] 8.4 Run `pnpm vitest run --project react`. Expected: 7 files, 25 tests, exit 0.
- [ ] 8.5 Commit: `test(react): compose a run and assert its accessibility contract`.

### Task 9 — the barrel, the scoped entry, and the records

**Files:** `packages/react/src/index.ts`, `packages/react/test/public-surface.test.ts`,
`packages/react/AGENTS.md`, `.changeset/s5-react-layer.md`, `docs/04-tasks.md`,
`docs/tasks/archive-2026.md`, `docs/01-project.md`, `docs/03-handoff.md`,
`docs/05-memory.md`, `docs/memory/general.md`, `docs/09-decisions/0005-react-layer-surface.md`,
`docs/09-decisions/README.md`, this plan

- [ ] 9.1 Write the barrel with named exports only: `VERSION`, `useAgentSession`,
      `useAgentRun`, `useAgentEvent`, `useAgentRunSnapshot`, `AgentRun`, `AgentStep`,
      `CodeBlock`, `FinalAnswer`, `ToolCall` and their prop types. No `export *` from the
      internal modules, so the providers and the step-context readers stay private.
- [ ] 9.2 Write `test/public-surface.test.ts` pinning the sorted runtime key list, exactly
      as core and exec-quickjs do.
- [ ] 9.3 Rewrite `packages/react/AGENTS.md`: the component is the L2 hooks and L3 headless
      primitives over `AgentSession`; the smallest validation is
      `pnpm vitest run --project react` with the measured file and test counts; hazards —
      the peer is optional so the package must not import `react-dom`; the jsdom cleanup
      setup file is required; the vitest alias resolves core to source; `AgentRun` starts a
      run from an effect; the leaves throw outside their provider. Keep the entry's cap and
      the fill rules.
- [ ] 9.4 Add `.changeset/s5-react-layer.md`: `"@smolagents-ts/react": minor`,
      `"@smolagents-ts/core": patch`.
- [ ] 9.5 Record the work: `docs/04-tasks.md` (T-11 → done) with a closed row in
      `docs/tasks/archive-2026.md` carrying the commit range and the measured counts;
      `docs/01-project.md` (S5 → done); a new newest-first entry in `docs/03-handoff.md`
      within the entry cap; the lessons in `docs/memory/general.md` with the registry row in
      `docs/05-memory.md`; and `docs/09-decisions/0005-react-layer-surface.md` (accepted)
      with its index row, recording the three divergences from design section 10: no
      `autoStart`, planning as a lane rather than a step kind, and the added
      `useAgentRunSnapshot`.
- [ ] 9.6 Append a `## Measured results` section to this plan: the prediction-versus-measured
      table, every deviation with its reason, and the spike findings F1–F6 confirmed or
      corrected.
- [ ] 9.7 Run the full gate `pnpm gate` and tee it to `.superpowers/gate-s5.txt`. Expected:
      exit 0, every stage green, the test totals up by this milestone's tests.
- [ ] 9.8 Run `python scripts/validate_context.py --root . --json --baseline docs/.baseline.json`
      and `python scripts/rotate.py --check`. Expected: `new: []`, 0 errors, 0 warnings;
      rotation check exit 0.
- [ ] 9.9 Commit: `docs: record S5`.

## Risks

| risk | mitigation |
|---|---|
| The react project resolves core to source, so a core file that imports a Node builtin would fail here | core is isomorphic by contract and `architecture.test.ts` enforces it |
| A new test file forgets the DOM cleanup | the project-level setup file registers it once |
| React 19's `act` warnings pollute the gate output | tests drive async work through `act` and `waitFor` from the testing library |
| tsup tries to bundle React | `react`, `react-dom` and `react/jsx-runtime` stay external |
| The new core snapshot field breaks a consumer | the field is additive and every existing core test still passes |
| The gate's publish checks trip on the new peer surface | the exports map and `files` are unchanged; the package stays private |
| A prediction in this plan is wrong | measured results are recorded under this section and in the task archive, never silently absorbed |

## Rollback

Each task is one commit and each is independently revertable. The core planning lane is
additive, so reverting it cannot break a caller that ignores `planning`; reverting the
React tasks leaves the package a placeholder again. `git revert` in reverse task order
restores the pre-S5 tree with no data migration and no released artifact to unpublish.

## Open questions

1. **The design's `autoStart` option is not implemented.** Section 10.1 sketches
   `useAgentRun(agent, { autoStart })` with no task argument, so the option has nothing to
   start. `AgentRun` starts its run from an effect keyed on the task, which is where the
   behaviour belongs. Recorded in decision 0005.
2. **Planning is a lane, not a step kind.** Section 10.2 lists `AgentStep.Planning` among
   the step primitives, but the shipped store keeps planning out of `steps`. v1 gives the
   snapshot a `planning` array and the primitive a `planning` prop; interleaving the two
   is a run-inspector concern for after v1.
3. **`useAgentRunSnapshot` is an addition.** The design's surface has no way for a
   consumer inside `<AgentRun>` to read the snapshot, which the planning lane and any
   custom composition need.
4. **`AgentStep.FinalAnswer` renders the step's observation**, not the run's output, which
   `AgentRun.FinalAnswer` owns. If a consumer wants the raw value in both places, the
   override map is the seam.
5. **The package stays private** until S6 decides whether the React layer ships on the same
   version line as core.

## Notes

- The design's L4 patterns (`<RunInspector>`, `<ChatSurface>`) are explicitly out of scope
  here; section 10.3 defers them past v1.
- Every number in the task steps is a prediction. The measured numbers belong in
  `## Measured results` and in `docs/tasks/archive-2026.md`.
- The spike's findings are the plan's evidence for the toolchain; Task 1 commits exactly
  what the spike measured, and Tasks 2, 5 and 7 re-assert F2–F6 as permanent tests.



