# smolagents-ts — v1 Design Specification

**Date:** 2026-10-12
**Status:** approved in principle; awaiting user review of this written spec
**Scope of this document:** the v1 product design (sub-projects S0–S6), with S0 + S1 specified in enough detail to plan and build.
**Companion documents:**
- [`upstream-recon.md`](../research/upstream-recon.md) — module-by-module translation map of upstream smolagents
- [`decision-analysis.md`](../research/decision-analysis.md) — Q1–Q4 analysis, decision log D1–D13
- [`round-2-runtime-and-distribution.md`](../research/round-2-runtime-and-distribution.md) — runtime/sandbox evidence, audience and distribution options
- [`round-3-open-decisions.md`](../research/round-3-open-decisions.md) — naming, D7/D6/D8/D10 analysis, v1 module allocation

---

## 1. Summary

**smolagents-ts is a TypeScript-native agent library in which the agent's action *is* a program.**

It is a faithful, idiomatic port of Hugging Face's `smolagents` for the JavaScript ecosystem. The
distinguishing idea, inherited from upstream, is the **CodeAgent**: instead of emitting a JSON tool call,
the model emits a block of **executable code** that composes tools, control flow, and intermediate values —
then returns a final answer. Code is executed in a sandboxed guest runtime behind a pluggable
`CodeExecutor` interface.

What is new in this port:

1. **Schema-first tool declaration.** TypeScript types are erased at runtime, so a tool's contract must exist
   as a value. `zod` (with Standard Schema compatibility) is the declaration format — no decorators, no
   reflection, no compiler plugin required.
2. **A first-class browser story.** The core is isomorphic — the **ECMA-262** language plus the **ECMA-429**
   *Minimum common web API* subset — so the same agent runs in Node,
   in a browser tab, in Bun, in Deno, and — without gating the API — on edge runtimes.
3. **A React layer that renders *runs*, not just chats.** Upstream's `gradio_ui.py` renders typed steps
   (planning, action code, tool calls, logs, observations, final answer). That is the primary subject, with
   a chat surface as a derivative view.
4. **Extensibility as a contract.** Agent middleware, overridable headless components, and pluggable
   executor/model/tool interfaces — so the library is extended without forking.

**One-line pitch:** *agents that think in code, natively in TypeScript.*

---

## 2. Goals and non-goals

### 2.1 Goals

| # | Goal | Success signal |
|---|---|---|
| G1 | A front-end developer can install one package and run a CodeAgent in Node or the browser | `npm i smolagents-ts` then a 12-line example runs in both |
| G2 | The agent's action language is code, sandboxed by construction | CodeAgent executes generated JS in QuickJS by default |
| G3 | Upstream vocabulary and prompt semantics are preserved | Same class/step/error names; prompts faithfully re-authored in the JS dialect, with a rule-by-rule fidelity checklist |
| G4 | The core is framework-agnostic and isomorphic | `dependency-cruiser` proves no `node:*` import in `core` |
| G5 | Both a run inspector and a chat surface can be built from shipped primitives | L3 headless primitives compose into either |
| G6 | Behaviour is verifiable against upstream | Upstream test suites ported; golden transcripts with `MockModel` |
| G7 | The project can be extended without forking | Middleware, component overrides, plugin interfaces |

### 2.2 Non-goals (v1)

- Not a UI kit with a finished visual design. L4 patterns and L5 styled components come later.
- Not a Python execution environment. `exec-pyodide` is v1.5 (the 3b audience path).
- Not a server framework, deployment platform, or hosting product.
- Not a Hub client or model-hosting service.
- Not a rewrite of upstream's semantics "improved" by our own judgement; where upstream is opinionated, we
  port the opinion and document it.

---

## 3. Provenance, licence, and naming

| item | value |
|---|---|
| Upstream | Hugging Face `smolagents` v1.27.0.dev0, commit `96f33faaf028479119ec8d34507b47694cf14e34` (2026-10-06) |
| Upstream licence | Apache-2.0 |
| This project's licence | Apache-2.0 (derivative work) |
| Package name | **`smolagents-ts`** (verified free on npm 2026-10-12) |
| Bare `smolagents` on npm | **explicitly rejected** — available, but would imply an official Hugging Face package |

### 3.1 Required artefacts

1. `LICENSE` — Apache-2.0, verbatim, retained from upstream.
2. `NOTICE` — records the derivation:

   ```text
   smolagents-ts
   Copyright 2026 <project authors>

   This product is an unofficial, independent TypeScript implementation derived from
   smolagents (https://github.com/huggingface/smolagents),
   Copyright Hugging Face, licensed under the Apache License, Version 2.0.
   Modifications: the library was reimplemented in TypeScript; the Python AST interpreter
   was replaced with a pluggable CodeExecutor abstraction; decorator-based tool definition
   was replaced with schema-first declaration.
   ```

3. `README.md` line one — an explicit disclaimer:

   ```text
   smolagents-ts is an unofficial TypeScript implementation of the smolagents approach,
   independently developed. It is not affiliated with, sponsored by, or endorsed by
   Hugging Face. "smolagents" and the Hugging Face marks belong to Hugging Face.
   ```

4. File headers on ported source, and a `docs/attribution.md` listing which upstream files each module
   derives from.

### 3.2 Vocabulary preserved from upstream

`MultiStepAgent` · `CodeAgent` · `ToolCallingAgent` · `AgentMemory` · `TaskStep` · `SystemPromptStep` ·
`PlanningStep` · `ActionStep` · `FinalAnswerStep` · `RunResult` · `final_answer` · `AgentMaxStepsError` ·
`AgentParsingError` · `AgentExecutionError` · `Tool` · `ToolCollection` · `Monitor` · `populate_template`.

Rationale: vocabulary is the migration path. A Python `smolagents` user should recognise every name.

---

## 4. Decision record

| # | decision | outcome |
|---|---|---|
| D1 | Code action language + sandbox | **C** — pluggable `CodeExecutor`; QuickJS the default, Pyodide opt-in |
| D2 | Fidelity posture | **B** — native, schema-first; upstream vocabulary and prompt semantics preserved |
| D3 | Model layer | own thin `Model` interface + provider adapters. **Universal provider coverage is a requirement**; an AI-gateway/proxy adapter (OmniRoute, LiteLLM, Portkey) is a later optional package |
| D4 | Tool definition | Zod-first, Standard Schema compatible |
| D5 | Package layout | **BC-1** — monorepo internally, publish later; changesets from commit #1; time-boxed private phase |
| D6 | React surface | layered L0–L5; **both** chat surface and run inspector are long-term goals; v1 ships L0–L3 |
| D7 | Runtime targets | **isomorphic core** — ECMA-262 language + ECMA-429 API subset; Node 22/24 (26 in CI) + browsers + Bun + Deno; Workers supported, never gating |
| D8 | Async style | **S3** — `AsyncIterable<AgentEvent>` is the source of truth, plus a thin `agent.on()` adapter. Deltas advisory; `*.completed` authoritative |
| D9 | Testing | port upstream suites + golden `MockModel` transcripts + published-shape checks in v1; Python↔TS differential harness in S1.5 |
| D10 | v1 scope | **V-balanced** — core + models + tools + exec-quickjs + react |
| D11 | Name + notices | `smolagents-ts` + unofficial disclaimer + `NOTICE` |
| D12 | Distribution shape | one umbrella package `smolagents-ts` with subpath exports; real package boundaries inside the monorepo |
| D13 | First sub-project | **S0 Foundations + S1 Core runtime** |
| D14 | Guest state across steps | **persists within one agent run** — one executor instance per run, disposed at run end, so a variable defined in one code block is visible in the next, exactly as upstream's rule 10 promises the model |

---

## 5. Architecture

### 5.1 Repository layout

```text
smolagents_ts/
├─ pnpm-workspace.yaml
├─ package.json                  (private root, no publish)
├─ tsconfig.base.json
├─ eslint.config.js              (boundary rules)
├─ .dependency-cruiser.cjs       (architecture rules)
├─ .changeset/                   (from commit #1)
├─ LICENSE  NOTICE  README.md
├─ packages/
│  ├─ core/          agent loop, memory steps, events, session, monitoring, prompts, errors
│  │                 CONSTRAINT: no node:*, no React, no DOM
│  ├─ models/        Model interface + adapters
│  ├─ tools/         tool() + default tools + ToolCollection
│  ├─ exec-quickjs/  the default CodeExecutor (QuickJS-WASM)
│  └─ react/         L2 hooks + L3 headless primitives
├─ examples/
│  ├─ node-script/   server/CLI usage
│  ├─ vite-app/      browser usage, no server
│  └─ next-app/      SSR + route handler usage
├─ docs/
│  ├─ research/      (existing) evidence + analysis
│  ├─ design/        (this document)
│  ├─ plans/         implementation plans
│  └─ attribution.md
├─ smolagents/          upstream clone — REFERENCE ONLY, never built
└─ reference/vercel-eve/  prior-art clone — REFERENCE ONLY, never built
```

Packages deferred to v1.5+: `exec-pyodide`, `exec-remote`, `mcp`, `cli`, `react-ui`, `models-gateway`.

Features deferred past v1: **managed agents** — upstream's `managed_agents`, which hands a subtask to another
agent exposed to the model as a callable tool, plus the system-prompt section that documents them. They land in
S2; the prompt template then gains one pre-rendered `{{managedAgents}}` variable beside `{{toolDescriptions}}`,
using the same caller-pre-renders-the-block scheme. S1 has no managed agents and does not pretend to.

### 5.2 Distribution shape (D12)

One installable package, `smolagents-ts`, assembled from the internal packages. Users never need to know
the monorepo exists.

```jsonc
{
  "name": "smolagents-ts",
  "version": "0.1.0",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".":                    { "types": "./dist/index.d.ts",        "default": "./dist/index.js" },
    "./models":             { "types": "./dist/models/index.d.ts", "default": "./dist/models/index.js" },
    "./models/anthropic":   { "types": "./dist/models/anthropic.d.ts", "default": "./dist/models/anthropic.js" },
    "./models/openai":      { "types": "./dist/models/openai.d.ts",    "default": "./dist/models/openai.js" },
    "./models/gemini":      { "types": "./dist/models/gemini.d.ts",    "default": "./dist/models/gemini.js" },
    "./models/huggingface": { "types": "./dist/models/huggingface.d.ts", "default": "./dist/models/huggingface.js" },
    "./tools":              { "types": "./dist/tools/index.d.ts",  "default": "./dist/tools/index.js" },
    "./exec/quickjs":       { "types": "./dist/exec/quickjs.d.ts", "default": "./dist/exec/quickjs.js" },
    "./react":              { "types": "./dist/react/index.d.ts",  "default": "./dist/react/index.js" },
    "./package.json":       "./package.json"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "peerDependenciesMeta": {
    "react": { "optional": true },
    "react-dom": { "optional": true }
  },
  "dependencies": { "zod": "^4.0.0" },
  "engines": { "node": ">=22" }
}
```

Rules:
- **ESM-only.** No CJS build. `"type": "module"`, `exports` only (no legacy `main`/`module`).
- **Optional peers.** React is an optional peer; a Node user never installs it.
- **Heavy backends stay behind subpaths** and are optional peers (`dockerode` for remote executors, etc.).
- **No `eval` / `new Function` in the published `core` bundle**, with the single exception of the executor
  package, where the guest source is compiled by QuickJS itself rather than by the host.
- Backwards compatibility is enforced by `publint` and `@arethetypeswrong/cli` in CI.

### 5.3 The layer model (D6)

| layer | lives in | ships | responsibility | must not know about |
|---|---|---|---|---|
| **L0** Agent runtime | `core` | v1 | loop, steps, tools, executors, events, prompts, errors | UI, React, DOM, server |
| **L1** `AgentSession` | `core` | v1 | framework-agnostic observable snapshot of a run | React, DOM |
| **L2** React hooks | `react` | v1 | `useAgentSession`, `useAgentRun` via `useSyncExternalStore` | agent internals |
| **L3** Headless primitives | `react` | v1 | `<AgentRun>`, `<AgentStep>`, `<ToolCall>`, `<CodeBlock>`, `<FinalAnswer>` — unstyled, ARIA-correct | styling, design tokens |
| **L4** Patterns | `react` (later) | later | `<RunInspector>` and `<ChatSurface>` — thin compositions of L3 | styling |
| **L5** Styled UI | `react-ui` (later) | later | copy-in styled components | — |

**The invariant that makes L4 nearly free:** L1 exposes **one** snapshot from which both surfaces are
rendered. A chat surface reads `snapshot.messages`; a run inspector reads `snapshot.steps`. Neither is
privileged, and adding one never changes the other.

```ts
interface AgentSessionSnapshot<TOut = unknown> {
  status: "idle" | "running" | "done" | "error" | "cancelled";
  steps: AgentStep[];          // the run inspector renders this
  messages: ChatMessage[];     // the chat surface renders this (the conversation projection; 0031)
  finalAnswer?: TOut;
  usage: TokenUsage;
  error?: AgentErrorInfo;
}
```

`getSnapshot()` / `subscribe()` is exactly the `useSyncExternalStore` contract, so L2 stays tiny and is
correct under concurrent rendering and SSR.

### 5.4 Runtime targets and constraints (D7)

| target | tier |
|---|---|
| Node 22 (Maintenance LTS, minimum; EOL 2027-04-30) and Node 24 (reference/CI primary; Maintenance from 2026-10-20) | **tier 1** |
| Node 26 (Current since 2026-05-05) | **tier 1, CI only** |
| Evergreen browsers (Chrome, Firefox, Safari, Edge) | **tier 1** |
| Bun | **tier 1** |
| Deno | **tier 1** |
| Next.js (server + client components) | **tier 1** |
| Cloudflare Workers, Deno Deploy, Vercel Edge | **supported, never gating** |

**The core's allowed API surface** — ECMA-429 *Minimum common web API*, 1st edition, December 2025, published
by **Ecma International TC55**. The ECMA-262 builtins (`JSON`, `Math`, `Promise`, async iteration) are implied
by its conformance clause:

```text
fetch · Request · Response · Headers · AbortController · AbortSignal · URL · URLSearchParams
TextEncoder · TextDecoder · crypto · crypto.subtle · structuredClone · JSON · Math
Promise · async iteration · Symbol.asyncIterator · ReadableStream · setTimeout/clearTimeout
queueMicrotask · console
```

`Intl` is **not** in ECMA-429. It is ECMA-402, an optional add-on whose locale data and formatting differ
across Node, browsers, Bun, Deno and Workers, so it is **best-effort only**: feature-detect it and never assert
exact `Intl` output in a test. Async iteration **of a `ReadableStream`** is likewise outside the minimum common
API (Chrome 124 / Firefox 119 / Safari 17.4); read streams through `getReader()` instead of `for await`.
**Forbidden in `core`** (enforced, not merely agreed):

```text
* imports of node:* · Buffer · process · __dirname · require · module.exports
* eval / new Function / Function constructor
* fs / path / os / child_process / worker_threads
* DOM globals (window, document, localStorage)
* React
```

Enforcement is three-layered, because a convention does not survive a deadline:

1. `eslint` `no-restricted-imports` + `no-restricted-globals` in `core`.
2. `dependency-cruiser` architecture rules run in CI (`forbidden` + `not-to-unresolvable`).
3. A CI matrix that actually runs the `core` test suite under Node 22, Node 24, Bun, Deno, a browser
   (Vitest browser mode), and one Cloudflare Workers smoke test.

### 5.5 Extension points

Design principle: **the library is extended by composition, never by forking.**

**(a) Agent middleware** — wraps every step of the loop.

```ts
/** A generator middleware: wrap `yield* next()` to run code before and after the wrapped step. */
type AgentMiddleware = (
  ctx: MiddlewareContext,
  next: () => AsyncGenerator<void, void, void>,
) => AsyncGenerator<void, void, void>;

interface MiddlewareContext {
  readonly task: string;
  readonly step: AgentStep;
  readonly event: AgentEvent;
  readonly signal: AbortSignal;
  readonly logger: Logger;
  memory: AgentMemory;              // readable; mutation is discouraged
  state: Map<string, unknown>;      // per-run scratch space, keyed by middleware
}

agent.use(otelMiddleware());
agent.use(costCapMiddleware({ maxUsd: 2 }));
agent.use(approvalMiddleware({ requireFor: ["file_write", "shell"] }));
```

Middleware is the sanctioned place for: telemetry, retries, redaction, cost/step budgets, human-in-the-loop
approval gates, caching, and eval recording. Onion semantics (`yield* next()` around the step), like Koa.
Ordering is declaration order; a middleware may short-circuit by not calling `next()`.
Middleware wraps action execution; wrapping the model phase is an S1.5 extension.

**(b) Component overrides** — L3 primitives take an overrides map, so the default is usable and the
appearance is replaceable.

```tsx
<AgentRun agent={agent} task="..." components={{ action: MyActionStep, code: MyCodeBlock }}>
  <AgentRun.Steps />
</AgentRun>
```

**(c) Plugin interfaces** — three seams, declared in `core`, implemented in leaf packages:

| seam | interface | v1 implementation | later |
|---|---|---|---|
| code execution | `CodeExecutor` | `exec-quickjs` | `exec-pyodide`, `exec-remote` (Docker/E2B/Modal/Blaxel) |
| model provider | `Model` | OpenAI-compatible, Anthropic, Gemini, HF Inference | `models-gateway` (OmniRoute/LiteLLM/Portkey), Vercel AI SDK bridge |
| tool source | `ToolSource` | static array, `ToolCollection` | `mcp` (MCP servers) |

---

## 6. Core runtime (S1)

### 6.1 Public API

```ts
import { CodeAgent, tool } from "smolagents-ts";
import { OpenAICompatibleModel } from "smolagents-ts/models/openai";

const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather for a city.",
  inputSchema: z.object({
    city: z.string().describe("City name"),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  }),
  async execute({ city, units }, ctx) {
    const res = await ctx.fetch("https://api.example.com/weather?q=" + encodeURIComponent(city));
    return (await res.json()) as { temp: number; condition: string };
  },
});

const agent = new CodeAgent({
  model: new OpenAICompatibleModel({ baseUrl, apiKey, modelId: "gpt-4.1" }),
  tools: [getWeather],
  maxSteps: 10,
});

const result = await agent.run("Is it warmer in Paris or Oslo right now?");

for await (const event of agent.stream("Is it warmer in Paris or Oslo right now?")) {
  console.log(event.type);
}
```

### 6.2 The agent loop

Ported from upstream `MultiStepAgent._run_stream`, translated to the event model.

```text
run(task):
  memory.reset()
  memory.addStep(TaskStep(task))
  memory.addStep(SystemPromptStep(renderSystemPrompt(tools)))
  emit run.started
  for stepIndex in 0 .. maxSteps-1:
    if signal.aborted: emit run.cancelled; return
    if planningInterval > 0 and (stepIndex == 0 or stepIndex % planningInterval == 0):
      emit planning.started
      if stepIndex == 0:                                      # first plan: one user template
        messages = [initialPlanTemplate(task, tools, managedAgents)]
      else:                                                   # update plan: prelude, history, postlude
        messages = [updatePrelude(task)]
                 + memory.toMessages(summaryMode=true)
                 + [updatePostlude(tools, managedAgents, remainingSteps)]
      plan = await model.generateForPlanning(messages,        # streamed, stop at <end_plan>
        { stopSequences: ["<end_plan>"] })
      emit planning.completed
      memory.addStep(PlanningStep(wrapPlan(plan)))
    emit step.started
    modelOutput = await model.generate(memory, { stream: true })   # emits *.delta, then *.completed
    parsed = parseCodeBlocks(modelOutput)                          # re-expressed from upstream's regex
    if parsed has final_answer:
      memory.addStep(FinalAnswerStep(answer))
      emit run.completed; return RunResult
    actionStep = ActionStep(modelOutput, codeAction=parsed.code)
    memory.addStep(actionStep)
    try:
      executorResult = await executor.execute(parsed.code, {
        tools, finalAnswer, signal, timeoutMs,
        onToolCall:  e => emit action.requested / action.result / action.failed,
        onLog:       e => emit logs.appended,
      })
    catch err:
      emit action.failed
      actionStep.error = err
      memory.addStep(ObservationStep("Error: " + err.message))
      continue
    actionStep.observations = executorResult.logs
    emit observation.completed
    if executorResult.isFinalAnswer:
      memory.addStep(FinalAnswerStep(executorResult.value))
      emit run.completed; return RunResult
  emit run.maxStepsReached
  throw AgentMaxStepsError
```

Error policy (D8):
- `stream()` emits `run.failed` (or `run.maxStepsReached`), then the iterator **completes normally** — consumers
  never lose events already delivered.
- `run()` drains the same stream and **throws** the typed error.
- `break`-ing out of `stream()` triggers cooperative cancellation of the loop.

### 6.3 The event contract

```ts
type AgentEvent =
  | { type: "run.started";           runId: string; task: string; modelId: string }
  | { type: "planning.started";      stepIndex: number }
  | { type: "planning.delta";        stepIndex: number; text: string }        // advisory
  | { type: "planning.completed";    stepIndex: number; text: string }        // authoritative
  | { type: "step.started";          stepIndex: number }
  | { type: "code.delta";            stepIndex: number; text: string }        // advisory
  | { type: "code.completed";        stepIndex: number; code: string }        // authoritative
  | { type: "action.requested";      callId: string; name: string; args: unknown }
  | { type: "action.result";         callId: string; name: string; output: unknown; durationMs: number }
  | { type: "action.failed";         callId: string; name: string; error: AgentErrorInfo }
  | { type: "toolcalls.requested";   stepIndex: number; calls: ToolCall[] }   // ToolCallingAgent path
  | { type: "logs.appended";         stepIndex: number; text: string }
  | { type: "observation.completed"; stepIndex: number; text: string; isFinalAnswer: boolean }
  | { type: "message.delta";         text: string }                           // advisory (chat surfaces)
  | { type: "message.completed";     text: string }                           // authoritative
  | { type: "usage.updated";         usage: TokenUsage }
  | { type: "run.completed";         result: RunResult }
  | { type: "run.failed";            error: AgentErrorInfo }
  | { type: "run.maxStepsReached";   steps: number }
  | { type: "run.cancelled" };
```

**The advisory/authoritative rule (adopted from Vercel Eve).** `*.delta` events are progressive-enhancement
only: a stream may be coalesced, retried, or replayed, so a consumer must converge on the `*.completed`
events. This is stated in the docs as a hard contract, and `AgentSession` implements it — deltas never
mutate the authoritative snapshot.

**Why `AsyncIterable` (D8).** Pull-based ordering is guaranteed by construction; cancellation is syntax
(`break`) or an `AbortSignal`; there are no listener leaks; it is the same primitive in Node and the browser;
and it converts to `ReadableStream`, `Observable`, or callbacks in a few lines while the reverse does not.
Upstream's callback style remains available as an adapter:

```ts
const stop = agent.on("action.result", (e) => console.log(e.name));
stop();   // unsubscribe
```

### 6.4 Memory and steps

Direct ports of upstream `memory.py`, with `pydantic` models replaced by plain classes.

```ts
abstract class AgentStep {
  abstract readonly kind: "task" | "system_prompt" | "planning" | "action" | "final_answer";
  readonly id: string;                 // stable, generated
  readonly createdAt: number;
  timing?: Timing;
  tokenUsage?: TokenUsage;
}

class TaskStep        extends AgentStep { kind = "task";          task: string }
class SystemPromptStep extends AgentStep { kind = "system_prompt"; systemPrompt: string }
class PlanningStep    extends AgentStep { kind = "planning";      plan: string; hasError?: boolean }
class ActionStep      extends AgentStep {
  kind = "action";
  modelOutput: string | null;
  codeAction?: string;
  toolCalls: ToolCall[];
  observations: string | null;
  error?: AgentErrorInfo;
  isFinalAnswer?: boolean;
}
class FinalAnswerStep extends AgentStep { kind = "final_answer"; output: unknown }
```

```ts
class AgentMemory {
  steps: AgentStep[] = [];
  addStep(step: AgentStep): void;
  reset(): void;
  get systemPrompt(): string | undefined;
  get task(): string | undefined;
  /** The transcript handed to the model — upstream's to_messages() semantics. */
  toMessages(opts: { summaryMode?: boolean; maxTokens?: number }): ChatMessage[];
  /** Derived chat view for L1/L4. */
  toChatMessages(): ChatMessage[];
}
```

### 6.5 RunResult

```ts
interface RunResult<TOut = unknown> {
  readonly output: TOut;
  readonly steps: AgentStep[];
  readonly messages: ChatMessage[];
  readonly tokenUsage: TokenUsage;
  readonly timing: { start: number; end: number; durationMs: number };
  // success | waiting; a step or budget ceiling throws instead of returning (decision 0027)
  readonly state: "success" | "waiting";
  readonly runId: string;
}
```

### 6.6 Error model

```ts
class AgentError            extends Error { readonly code: string; readonly info: AgentErrorInfo }
class AgentParsingError     extends AgentError {}   // model output could not be parsed
class AgentExecutionError   extends AgentError {}   // the generated code threw
class AgentGenerationError  extends AgentError {}   // the model call failed
class AgentMaxStepsError    extends AgentError {}   // the step budget was exhausted
class AgentBudgetExceededError extends AgentError { readonly reason: string }  // a budget ceiling ended the run
class AgentToolCallError    extends AgentError {}   // a tool call failed
class AgentTimeoutError     extends AgentError {}   // the run or a tool exceeded its deadline
class AgentCancelledError   extends AgentError {}   // AbortSignal fired

interface AgentErrorInfo {
  readonly name: string;
  readonly message: string;
  readonly code: string;
  readonly stepIndex?: number;
  readonly cause?: string;  // v1: the stringified message, so `info` survives events, workers and the wire
  readonly reason?: string;  // the budget stop reason, on AGENT_BUDGET_EXCEEDED only
  // (the design's serialisability rule above); the original error stays on the Error's own `cause`
}
```

Rule: every error crossing a public boundary is an `AgentError` with a machine-readable `code`. Errors are
serialisable (`info`) because they travel in events, across workers, and over the wire.

### 6.7 AgentSession (L1)

The framework-agnostic store that makes both UI surfaces possible.

```ts
class AgentSession<TOut = unknown> {
  constructor(agent: MultiStepAgent<TOut>, opts?: SessionOptions);

  /** Stable object identity between notifications — required by useSyncExternalStore. */
  getSnapshot(): AgentSessionSnapshot<TOut>;

  /** Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void;

  /**
   * Server-render snapshot: MUST return the initial snapshot, never live state. React's
   * useSyncExternalStore takes this as its third argument, and without it any hook rendered on the
   * server throws (Next.js server components are tier 1, so this is required, not optional).
   */
  getServerSnapshot(): AgentSessionSnapshot<TOut>;

  run(task: string, opts?: RunOptions): Promise<RunResult<TOut>>;
  cancel(): void;
  reset(): void;

  /** Raw event tap, for consumers that need everything (logging, devtools). */
  onEvent(listener: (event: AgentEvent) => void): () => void;
}
```

`getSnapshot()` returns a **frozen, referentially stable** object that changes identity only when the
snapshot genuinely changes. `subscribe` calls listeners synchronously after mutation. This is deliberately
the `useSyncExternalStore` contract so that React (and Vue/Svelte/vanilla) bindings stay trivial.

### 6.8 Prompt templates

Upstream ships **three** YAML prompt files: `code_agent.yaml`, `structured_code_agent.yaml` and
`toolcalling_agent.yaml`. Each holds the same four top-level sections — `system_prompt`, `planning`,
`managed_agent` and `final_answer`. `final_answer` is a section, not a file. `code_agent.yaml` is used by
`CodeAgent`; `structured_code_agent.yaml` when structured outputs are enabled internally.

These are **faithfully re-authored in the JavaScript dialect**, not transliterated line by line: the contract, the
step protocol and the intent of every upstream rule are preserved while the dialect changes (Python code blocks
become JavaScript, `print()` guidance becomes `console.log()`, and the `final_answer` contract stays identical).
Upstream's `code_agent.yaml` system prompt is 173 lines with six worked examples and eleven numbered
rules. The JavaScript prompt ports **all six examples** and **all eleven rules**. Three rules are adapted rather
than translated, and each adaptation is stated in the prompt itself: rule 3 forbids positional arguments and an
extra wrapping object, because JavaScript has no keyword arguments and a tool therefore takes exactly one object
literal; rule 9 says there is no module system at all, because the guest has no `import`; and rule 10 keeps the
promise that state persists across steps, which decision D14 fixes. There is no managed-agents section, because
managed agents are deferred (section 5.1). S1 Task 8 carries the rule-by-rule checklist and a test asserting that
all six examples and all eleven rules are present.

Prompts ship as TypeScript string constants (not YAML) so that bundlers tree-shake them and no YAML parser
becomes a runtime dependency.

A `populateTemplate(template, variables)` function **replaces a subset of** upstream's `populate_template`.
Upstream's version is real Jinja2 (`jinja2.Template(..., undefined=StrictUndefined)`), so upstream's files use
loops, conditionals and method calls — `{% for tool in tools.values() %}`, `{{ tool.to_code_prompt() }}`,
`{{ agent.name }}`. `populateTemplate` does flat identifier substitution only: no loops, no conditionals, no filters,
no dotted paths. Everything the templates need beyond substitution is pushed into the caller — the tool list and
the managed-agent list are pre-rendered into plain strings before rendering.

Two upstream behaviours are deliberately preserved: there is no `strict` option (strictness is unconditional
over the identifiers it does own), and a placeholder whose name is not a valid identifier is passed through
untouched rather than raising, which is the only sane behaviour for JavaScript source embedded in a template.

Upstream renders each tool into the prompt through `Tool.to_code_prompt()`, which emits a callable
`def name(arg: type) -> ret:` signature plus docstring. Our `ToolRegistry.renderDescriptions()` is the analogue,
not a port: it emits a bullet list with typed arguments derived from the same JSON Schema the model receives,
so the prompt and the wire format cannot drift.

---

## 7. Model layer (D3)

**Requirement: universal provider coverage.** Any provider reachable over HTTP must be usable, without waiting
for a first-party adapter.

```ts
interface Model {
  readonly id: string;
  readonly provider: string;
  generate(messages: ChatMessage[], opts: GenerateOptions): Promise<ChatCompletion>;
  generateStream(messages: ChatMessage[], opts: GenerateOptions): AsyncIterable<ChatCompletionChunk>;
  readonly supports: {
    readonly streaming: boolean;
    readonly toolCalls: boolean;
    readonly images: boolean;
    readonly structuredOutput: boolean;
  };
}

interface GenerateOptions {
  readonly systemPrompt?: string;
  readonly tools?: ToolSpec[];        // JSON Schema, derived from Zod
  readonly stopSequences?: string[];
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly signal?: AbortSignal;
}
```

### 7.1 Coverage strategy

| tier | adapter | covers |
|---|---|---|
| 1 | `OpenAICompatibleModel` | OpenAI, Azure OpenAI, Together, Groq, Fireworks, DeepSeek, OpenRouter, Ollama, LM Studio, vLLM, llama.cpp server, and every `/v1/chat/completions` endpoint |
| 1 | `AnthropicModel` | Claude |
| 1 | `GeminiModel` | Google Gemini |
| 1 | `HuggingFaceModel` | HF Inference Providers / TGI / TEI endpoints |
| 2 | `CustomModel` | user-supplied `generate` — the escape hatch, always available |
| 3 (later) | `models-gateway` | an OpenAI-compatible adapter for AI gateways/proxies: **OmniRoute, LiteLLM, Portkey**, and anything else speaking the OpenAI wire format |

Tier 1 is deliberately small and the ecosystem is covered through wire-format compatibility rather than
adapter sprawl. The `CustomModel` escape hatch means no provider is ever truly unsupported, and the separate
`models-gateway` package later adds gateway-specific features (routing policies, fallback, budget headers)
without contaminating `core`.

---

## 8. Tool system (D4)

```ts
interface ToolDefinition<TIn extends z.ZodType, TOut = unknown> {
  name?: string;                       // default: the schema's title, else required
  description: string;
  inputSchema: TIn;
  outputSchema?: z.ZodType<TOut>;
  execute: (input: z.infer<TIn>, ctx: ToolContext) => Promise<TOut> | TOut;
  /** QuickJS sandbox policy for this tool. */
  sandbox?: { allowNetwork?: boolean; allowClock?: boolean };
}

interface ToolContext {
  readonly signal: AbortSignal;
  readonly fetch: typeof globalThis.fetch;
  readonly logger: Logger;
  readonly callId: string;
  readonly stepIndex: number;
}

function tool<TIn extends z.ZodType, TOut>(def: ToolDefinition<TIn, TOut>): Tool<TIn, TOut>;
```

Why Zod-first rather than a compiler plugin for upstream's `@tool` decorator: decorators and runtime type
reflection do not exist in TypeScript, and a compiler plugin would make the library unusable with plain
`tsc`, Bun, esbuild, and every bundler that does not run the plugin. A schema is a **value**, it survives
compilation, and it is the same object used for (a) the model-facing JSON Schema, (b) argument validation,
and (c) TypeScript inference via `z.infer`.

`ToolCollection` ports upstream's container (including `fromTools`/`fromHub` later). `final_answer` is
implemented as an executor-level primitive, not a user tool, matching upstream.

---

## 9. Code execution (D1)

### 9.1 The contract

```ts
type ExecutorLanguage = "javascript" | "python";

interface ExecutorCapabilities {
  readonly language: ExecutorLanguage;
  readonly isolation: "wasm" | "process" | "vm" | "remote";
  readonly asyncToolCalls: boolean;
  readonly timers: boolean;
  readonly network: "none" | "host-mediated" | "direct";
  readonly memoryLimitBytes?: number;
  readonly cpuTimeLimitMs?: number;
}

interface CodeExecutor {
  readonly language: ExecutorLanguage;
  readonly capabilities: ExecutorCapabilities;
  execute(code: string, opts: ExecuteOptions): Promise<CodeResult>;
  dispose?(): Promise<void>;
}

interface ExecuteOptions {
  readonly tools: ToolRegistry;
  readonly finalAnswer: { name: string; submit(value: unknown): void };
  readonly signal: AbortSignal;
  readonly timeoutMs: number;
  readonly onToolCall?: (e: ToolCallEvent) => void;
  readonly onLog?: (line: string) => void;
  readonly context?: Record<string, unknown>;
}

interface CodeResult {
  readonly logs: string;
  readonly isFinalAnswer: boolean;
  readonly value?: unknown;
  readonly error?: AgentErrorInfo;
  readonly durationMs: number;
  readonly toolCallCount: number;
}
```

### 9.2 Default executor: QuickJS-WASM

| property | value |
|---|---|
| package | `quickjs-emscripten` |
| isolation | WASM linear memory; no ambient authority; no host globals unless injected |
| language | modern JavaScript on an ES2025-spec engine (QuickJS semantics; no `Intl`/ECMA-402, no tail calls, no `Atomics.waitAsync`) |
| async tool calls | **supported by design** — see 9.3 |
| network | host-mediated only (`ctx.fetch` is injected if the tool policy allows) |
| timers | injected, clamped |
| memory / cpu limits | enforced by QuickJS (interrupt handler for CPU; `setMemoryLimit` for RAM) |

### 9.3 Async tool calls inside the guest — the highest-risk item

Guest code must be able to write the natural thing:

```javascript
const paris = await get_weather({ city: "Paris" });
const oslo  = await get_weather({ city: "Oslo" });
final_answer(paris.temp > oslo.temp ? "Paris" : "Oslo");
```

QuickJS supports async/await and Promises natively. A host function that must return asynchronously cannot
block the guest, so the design is:

1. The host injects `__callTool(name, argsJson)` as a guest global that returns a **QuickJS Promise**.
2. Calling it from the guest **kicks off** the host-side async tool execution and returns a pending promise.
3. The host drives `runtime.executePendingJobs(maxJobsToExecute?)` in a loop, awaiting host-side tool settlements between
   drains, until the guest's top-level promise settles or the deadline/`AbortSignal` fires.
4. Results cross the boundary as JSON strings (`JSON.stringify` in, `JSON.parse` out) — no host object leaks
   into the guest.

The concrete host surface is `context.newFunction(...)`, `context.newPromise(nativePromise)`,
`context.evalCodeAsync(...)` and — only on the asyncify build — `context.newAsyncifiedFunction(...)`. There is
**no** `newAsyncFunction`. The pending-job drain is `runtime.executePendingJobs(maxJobsToExecute?)`.

Asyncify is a trade, not a default: it roughly doubles engine size (1,205,388 B vs 649,548 B), costs about 40 %
throughput, permits exactly **one** suspension in flight, forbids nested asyncified functions and `import`, and
gives each instance its own WASM module. The sync build plus host-driven `executePendingJobs` is the default;
asyncify is the escalation.

Guest-to-host marshalling is explicit rather than magic. `context.dump()` is best-effort and silently falls back
to `toString()` for values it cannot represent, so structured values cross as JSON, with
`encodeBinaryJSON`/`decodeBinaryJSON` available when fidelity matters.

**Cloudflare Workers need a different loader.** Workers forbid `WebAssembly.compile`,
`WebAssembly.compileStreaming`, `WebAssembly.instantiate(buffer)` and `WebAssembly.instantiateStreaming`, as
well as `eval` and `new Function`. The only supported path is to import the `.wasm` file as a module and build
the variant with `newVariant({ wasmModule, wasmSourceMapData })`. Plan against the Workers budgets: 64 MiB
compressed bundle, 128 MB per isolate **including the WASM heap**, 10 ms CPU on the free plan and 5 minutes on
paid. Two caveats: `setMemoryLimit` has an open regression (issue #255) and must not be treated as a hard cap,
and CPU interruption is cooperative while guest JavaScript is running.

Zod-to-JSON-Schema marshalling has three sharp edges worth naming: `z.toJSONSchema()` emits `$schema` by
default, it emits `additionalProperties: false` in output mode but **not** in `{ io: "input" }` mode (strict
provider schemas need it added explicitly), and it **throws** on unrepresentable types such as `z.bigint()`.

**Fallback ladder** if that proves unstable, in order of preference:
- **(a)** the asyncify QuickJS build (`@jitl/quickjs-wasmfile-release-asyncify`) — real guest suspension,
  at roughly +1 MB wasm and a 10–40% execution cost;
- **(b)** a synchronous-only v1 executor that rejects tools declared `async` with a clear, documented
  `AgentToolCallError`, plus a documented workaround;
- **(c)** a pause/resume task loop with memoised replay of host calls.

**This is spiked before S4 is planned in detail** — see the plan's early spike task. The `CodeExecutor`
contract in 9.1 does not change under any of these options, because `capabilities.asyncToolCalls` already
declares the difference.

### 9.4 Later executors

| package | language | isolation | audience |
|---|---|---|---|
| `exec-pyodide` | Python | WASM | Python `smolagents` users migrating (the 3b path) |
| `exec-remote` | Python/JS | process or remote sandbox | Docker, E2B, Modal, Blaxel |
| `exec-node-vm` | JavaScript | `vm` module (Node only, **not a security boundary**) | explicitly opt-in, documented as unsafe |

`vm2` is **rejected** and must never be offered: it is unmaintained with critical sandbox escapes
(GHSA-99p7-6v5w-7xg8 / CVE-2026-22709 are exactly this class of failure).

---

## 10. React layer (D6)

### 10.1 L2 — hooks

```ts
function useAgentSession<S>(session: AgentSession<S>): AgentSessionSnapshot<S>;
function useAgentRun<T>(agent: MultiStepAgent<T>, opts?: { autoStart?: boolean }): {
  readonly snapshot: AgentSessionSnapshot<T>;
  run(task: string, opts?: RunOptions): Promise<RunResult<T>>;
  cancel(): void;
  reset(): void;
};
function useAgentEvent(agent: MultiStepAgent, type: AgentEvent["type"], handler: (e: AgentEvent) => void): void;
```

### 10.2 L3 — headless primitives

Composable, unstyled, ARIA-correct, and overridable.

```tsx
<AgentRun agent={agent} task="..." components={{ action: MyActionStep }}>
  <AgentRun.Status />
  <AgentRun.Steps>
    {({ step }) =>
      step.kind === "action"   ? <AgentStep.Action step={step}>
                                   <AgentStep.Code />
                                   <AgentStep.ToolCalls />
                                   <AgentStep.Logs />
                                   <AgentStep.Observation />
                                 </AgentStep.Action>
    : step.kind === "planning" ? <AgentStep.Planning step={step} />
    : step.kind === "final_answer" ? <AgentStep.FinalAnswer step={step} /> : null
    }
  </AgentRun.Steps>
  <AgentRun.FinalAnswer />
</AgentRun>
```

Accessibility obligations the primitives own:
- appended streaming output announced via `aria-live="polite"`;
- `aria-busy` while a run is in progress;
- the step list is a keyboard-navigable list with correct roles;
- tool-call completion is announced once (via the authoritative `action.result`, never per delta);
- cancellation is reachable by keyboard and reports its result.

### 10.3 L4 — patterns (later)

`<RunInspector>` = an opinionated full step timeline. `<ChatSurface>` = messages, composer, and an
optional collapsed step summary. Both are thin compositions of L3 — no new machinery — and both are
deferred until after v1 so that the primitives prove themselves in examples first.

---

## 11. Testing and validation (D9)

| layer | technique | what it proves |
|---|---|---|
| unit | Vitest, co-located `*.test.ts` | functions behave |
| **loop behaviour** | **golden transcripts**: a `MockModel` replays recorded model outputs; assert the exact `AgentEvent` sequence and final `RunResult` | the ReAct loop, parsing, planning cadence, final-answer detection |
| parity | ported upstream suites (`test_agents`, `test_memory`, `test_monitoring`, `test_utils`, `test_tools`, `test_final_answer`, `test_types`) | behaviour matches upstream |
| architecture | `dependency-cruiser` rules | `core` imports no `node:*`, no React, no DOM |
| shape | `publint` + `@arethetypeswrong/cli` + `npm pack` → install → import smoke test | the published package actually works |
| cross-runtime | CI matrix: Node 22, Node 24, Bun, Deno, browser (Vitest browser mode) | D7 is real, not aspirational |
| edge | one Cloudflare Workers smoke test (non-gating) | Workers support does not regress silently |
| a11y | component-level checks on L3 primitives | `aria-live`/`aria-busy` behaviour holds |

**S1.5 follow-up:** a true differential harness that runs the same recorded transcript through upstream
Python `smolagents` and this port, comparing step sequences. Deferred out of v1 because it requires a Python
environment in CI — honest deferral, not an oversight.

---

## 12. Quality gates (CI)

Every pull request must pass:

1. `pnpm typecheck` — zero TypeScript errors, `strict` + `noUncheckedIndexedAccess`.
2. `pnpm test` on the Node matrix.
3. `pnpm lint` including the `no-restricted-*` boundary rules.
4. `pnpm depcruise` — architecture rules.
5. `pnpm build` then `publint` + `attw --profile esm-only`.
6. `pnpm pack` → install the tarballs into a throwaway consumer in a temp directory → import every published
   entry point → assert output (`scripts/pack-smoke.mjs`).
7. `changeset` present for any user-visible change.
8. Coverage floor on `core` (`80%` lines) — **deferred past S0**: S0 installs no coverage provider and sets no
   thresholds, because a coverage gate over placeholder packages measures nothing.
9. Bundle-size report on the `core` entry (`<10 kB` min+gzip excluding Zod, target) — **deferred past S0**:
   no size tooling is installed yet.

---

## 13. Upstream module mapping

| upstream module | non-blank lines (pinned commit) | disposition |
|---|---|---|
| `agents.py` | 1625 | **port** → `core/agent/*` (MultiStepAgent, CodeAgent, ToolCallingAgent, RunResult) |
| `memory.py` | 260 | **port** → `core/memory/*` |
| `monitoring.py` | 229 | **port** → `core/monitoring/*` |
| `models.py` | 1880 | **split** → `core/model.ts` (interface) + `models/*` (adapters) |
| `tools.py` | 1206 | **port** → `core/tool/*` + `tools/index.ts` |
| `default_tools.py` | 586 | **port subset** → `tools/defaults/*` |
| `utils.py` | 487 | **port subset** → `core/utils/*` |
| `agent_types.py` | 221 | **port subset** → `core/types.ts` (text + image; audio deferred). **v1 deviation:** `ChatMessage.content` is `string`, i.e. text-only, so vision inputs are not supported in v1 |
| `prompts/*.yaml` | 3 files | **re-author faithfully** → `core/prompts/*.ts` (JS dialect) |
| `local_python_executor.py` | 1556 | **replace** → `exec-quickjs` behind `CodeExecutor` |
| `gradio_ui.py` | 389 | **replace** → `react` L2/L3 (+ L4 later) |
| `_function_type_hints_utils.py` | 363 | **drop** → replaced by Zod |
| `tool_validation.py` | 228 | **drop** → replaced by types + Zod + a few runtime guards |
| `serialization.py` | 435 | **defer** → v1.5 `core/serialization` |
| `mcp_client.py` | 142 | **defer** → v1.5 `mcp` package |
| `remote_executors.py` | 902 | **defer** → v1.5 `exec-remote` package |
| `cli.py` | 255 | **defer** → v1.5 `cli` package |
| Hub integration | — | **defer** → v1.5 |
| `vision_web_browser.py` | 204 | **defer** → v2 example |

v1 estimate: ~6,000 lines of TypeScript source and ~5,000 lines of tests across five packages.

---

## 14. Roadmap

| sub-project | contents | depends on |
|---|---|---|
| **S0** Foundations | pnpm monorepo, TS config, vitest, changesets, publint/attw + pack smoke CI, LICENSE/NOTICE, boundary rules | — |
| **S1** Core runtime | loop, memory, steps, events, RunResult, errors, monitoring, prompts, AgentSession, middleware | S0 |
| **S2** Model layer | Model interface + OpenAI-compatible, Anthropic, Gemini, HF adapters | S1 |
| **S3** Tool system | `tool()` ecosystem (the interface lands in S1 T11), ToolCollection, default tools | S1 |
| **S4** Code execution | CodeExecutor implementations (the contract lands in S1 T12), `exec-quickjs`, final_answer bridging, async tool-call bridging | S1, S3 |
| **S5** React layer | L2 hooks, L3 headless primitives, examples | S1, S4 |
| **S6** Distribution | public publish, CLI, MCP, remote executors, `exec-pyodide`, docs site, L4/L5 | S1–S5 |
| **S1.5** Parity harness | Python↔TS differential tests | S1, S2, S4 |

### 14.1 Deliberate vocabulary divergences from upstream

These names intentionally differ from upstream. Anyone diffing the two codebases or porting a test must know
beforehand:

| ours | upstream | why |
|---|---|---|
| base step class `AgentStep` | base step class `MemoryStep` | upstream's name leaks its Python implementation detail |
| `AgentTimeoutError` has no counterpart here (yet) | upstream's omitted sibling is `AgentToolExecutionError` | the error that *is* ported should not be confused with the one that is not |
| `RunResult.state` is `"success"` or `"waiting"`; both ceilings throw typed errors | a result carries `state = "max_steps_error"` | a run that never produced a final answer is an ending, not a value (decision 0027) |
| the three planning prompts are re-authored, not copied | upstream's `initial_plan` and `update_plan_*` text | structure follows upstream, wording is this project's (decision 0028) |

One behavioural divergence is deeper than naming. Upstream detects a final answer by raising
`FinalAnswerException extends BaseException`, which deliberately escapes `except Exception` so agent code cannot
swallow it. JavaScript has no uncatchable throw, so the port must use a different mechanism (a sentinel return
value plus an out-of-band flag), and that difference must be documented rather than papered over.

The first deliverable is **working, testable software**: after S1, a CodeAgent runs end-to-end against a
`MockModel` with a deterministic, asserted event stream — with no model provider, no network, and no
sandbox needed. S2–S4 then make it useful against real providers and real generated code.

---

## 15. Risks

| # | risk | likelihood | impact | mitigation |
|---|---|---|---|---|
| R1 | QuickJS async tool-call bridging is harder than expected | medium | high | spike before S4; documented fallback ladder (section 9.3); the `CodeExecutor` contract is unaffected either way |
| R2 | Prompt porting drifts from upstream behaviour | medium | high | faithful re-authoring with an explicit rule-by-rule fidelity checklist, a golden snapshot of the rendered prompt, golden-transcript tests, and the S1.5 differential harness |
| R3 | Scope creep into a full product | high | medium | V-balanced is fixed; deferred modules are named in section 13, not silently dropped |
| R4 | Bundle size from Zod | medium | low | target `<10 kB` gzip excluding Zod; Zod is a peer-installable dependency; the size gate lands after S0, and until then the target is a design intent, not a measured number |
| R5 | `@tool`-decorator users find `tool({...})` verbose | low | low | provide `tool` + a `defineTool` alias and document a migration table |
| R6 | Upstream moves (`v1.27` → newer) | medium | low | pin the reference commit; record it in `NOTICE`; re-sync deliberately |
| R7 | Trademark confusion | low | medium | explicit disclaimer on README line 1 + `NOTICE` |
| R8 | React layer over-engineering | medium | medium | v1 ships primitives only; patterns deferred until examples prove them |

---

## 16. Glossary

| term | meaning |
|---|---|
| **CodeAgent** | an agent whose model output is executable code rather than a JSON tool call |
| **ToolCallingAgent** | an agent whose model output is ordinary structured tool calls |
| **CodeAct** | the research paradigm where the agent's action space is code |
| **step** | one unit of agent memory: task, system prompt, planning, action, or final answer |
| **executor** | the pluggable component that runs generated code inside a sandbox |
| **session** | the framework-agnostic observable state of one agent run |
| **L0–L5** | the layer model of section 5.3 |
| **advisory delta** | a `*.delta` event whose content is not authoritative; the matching `*.completed` event is |
| **gap-closer** | one of the five BC-1 mechanisms that prevent the private monorepo phase from drifting |
