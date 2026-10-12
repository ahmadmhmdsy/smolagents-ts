# Decision analysis — smolagents → TypeScript/JavaScript/React

**Date:** 2026-10-12
**Status:** discussion input for the design conversation. Not an approved design.
**Companion:** [`upstream-recon.md`](./upstream-recon.md)

This document explains, in detail, the four questions that decide the shape of the project.
Each question gives: what it actually means, worked examples, a comparison, and a recommendation.
Recommendations are proposals to argue with, not conclusions.

---

## Question 1 — Fidelity posture: how closely should the TS API mirror the Python API?

### What the question really is
Python's smolagents leans on three things that **do not exist at runtime in TypeScript**:

1. **Decorators that inspect the function** — `@tool` reads the signature and docstring.
2. **Runtime type hints** — `city: str` is turned into JSON Schema by reading `__annotations__`.
3. **Docstring parsing** — the Google-style `Args:` block becomes parameter descriptions.

In TypeScript, **types are erased at compile time**. `function f(city: string)` is, at runtime,
`function f(city)` — there is no `string` anywhere. So a faithful port of the tool-declaration
mechanism is *not a translation problem, it is an impossibility* unless you either (a) ship a
compiler plugin, or (b) ask the developer to write schemas explicitly.

### Worked example — the same tool

**Upstream Python:**
```python
from smolagents import tool

@tool
def get_weather(city: str, units: str = "celsius") -> str:
    """Get the current weather.

    Args:
        city: The city to look up.
        units: Either "celsius" or "fahrenheit".
    """
    return requests.get(f"https://wttr.in/${city}?format=3").text
```

**Option A — API-parity TS** (what a 1:1 port has to look like):
```ts
// Requires: experimentalDecorators + emitDecoratorMetadata + reflect-metadata + a docstring parser.
// Still cannot see `string` for a type alias, interface, union or generic.
@tool
function getWeather(city: string, units: string = "celsius"): string {
  return fetchSync("https://wttr.in/" + city + "?format=3");
}
```
Cost: a decorator runtime, `reflect-metadata` in every consumer bundle, a docstring parser, a
TSDoc parser, and a long list of types that simply cannot be inferred (unions, `Date`, branded
types). Plus TS decorators are ecosystem-split (legacy vs TC39 stage 3).

**Option B — native TS** (schema-first; this is what Vercel chose for eve):
```ts
import { tool } from "smolagents-ts";
import { z } from "zod";

export const getWeather = tool({
  name: "get_weather",
  description: "Get the current weather.",
  inputSchema: z.object({
    city: z.string().describe("The city to look up."),
    units: z.enum(["celsius", "fahrenheit"]).default("celsius"),
  }),
  outputSchema: z.string(),
  async execute({ city, units }, ctx) {
    const r = await ctx.fetch("https://wttr.in/" + city + "?format=3");
    return r.text();
  },
});
```
Pros: types flow *inward* (the `execute` argument is inferred from the schema), the JSON Schema is
generated mechanically and is guaranteed to match reality, no compiler plugin, works in every
bundler.

**Option C — hybrid**: ship B as the default *and* an optional compile-time path (a TS transformer
or an SWC/Babel plugin) so `@tool` works. Cost: an extra build-time package, two ways to do everything.

### Comparison

| | A: API-parity | B: native schema-first | C: hybrid |
|---|---|---|---|
| Runtime deps forced on users | reflect-metadata, decorator runtime | zod only | both |
| Type inference into `execute` | weak/partial | full | full (B path) |
| Compiler plugin required | yes (to be faithful) | no | optional |
| Copy-paste from Python docs | close | conceptually close, syntactically new | close |
| Failure mode | schema silently wrong | impossible — schema *is* the source | two code paths diverge |
| Bundle cost | higher | lowest | highest |

### Recommendation
**B, plus deliberately preserved vocabulary.** Keep every concept name a Python user knows:
`MultiStepAgent`, `ToolCallingAgent`, `CodeAgent`, `AgentMemory`, `ActionStep`, `PlanningStep`,
`FinalAnswerStep`, `RunResult`, `final_answer`, `AgentError` / `AgentParsingError` / `AgentMaxStepsError`.
Keep the **prompt templates verbatim** from `prompts/*.yaml`, because model behaviour is what those
prompts encode and that is where fidelity actually pays. Change only the *declaration mechanics*
that TS cannot support. That is "concept-parity, idiomatic surface".

---

## Question 2 — What language does a CodeAgent write, and where does it run? (the crux)

### What the question really is
`CodeAgent` is smolagents' defining feature: the model's action is a **code block**, parsed out of
the reply and executed. Upstream interprets Python ASTs in-process (`local_python_executor.py`,
1556 lines) or ships them to E2B/Docker/Modal/Blaxel. Porting the *interpreter* verbatim means
reimplementing Python inside JavaScript — possible, but a permanent maintenance tax.

### Option A — Agent writes JavaScript, executed in a sandbox

```ts
const agent = new CodeAgent({ model, tools: [getWeather] });
await agent.run("What's the weather in Paris, and is it warmer than Oslo?");
// The model emits:
//   const paris = getWeather({ city: "Paris" });
//   const oslo  = getWeather({ city: "Oslo" });
//   finalAnswer(paris.temp > oslo.temp ? "Paris" : "Oslo");
```

| runtime | engine | browser | node | edge | hard security boundary |
|---|---|---|---|---|---|
| `quickjs-emscripten` | QuickJS to WASM | yes | yes | yes (needs WASM) | yes — separate engine, capabilities injected |
| `isolated-vm` | V8 isolate | no | yes | no | yes — strongest, native build |
| SES / `endo` | frozen JS, same realm | yes | yes | partial | hard, but easy to get wrong |
| Web Worker | same engine | yes | worker_threads | yes | **no** — CPU/memory unbounded, fetch available |
| sandboxed iframe | same engine, separate origin | yes | no | no | weak unless cross-origin isolated |

**Pros:** truly native; tiny and instant (QuickJS is about 1 MB, no cold start); identical code path
in browser and server; capabilities are injected explicitly, so *nothing exists that you did not
grant* — no ambient `fs`, no ambient `fetch`; `authorized_imports` becomes a literal capability allowlist.

**Cons:** prompts and examples must be rewritten from Python to JS; `authorized_imports=['pandas']`
has no analogue (no npm registry inside QuickJS — you must bundle whatever you grant); every upstream
example (RAG, text-to-SQL, deep research) needs re-authoring; existing smolagents fine-tunes and
hundreds of community Python prompts stop being drop-in.

### Option B — Agent writes Python, executed in Pyodide (CPython to WASM)

```ts
const agent = new CodeAgent({ model, tools: [getWeather], executor: pyodideExecutor() });
// The model emits exactly what upstream models emit today:
//   paris = get_weather(city="Paris")
//   oslo  = get_weather(city="Oslo")
//   final_answer("Paris" if paris["temp"] > oslo["temp"] else "Oslo")
```

**Pros:** *exact* prompt parity — prompts, examples, tools and agent behaviour transfer with
near-zero change; strongest model performance for code actions (Python is the best-represented
code-action language in training data); `authorized_imports` maps cleanly onto Pyodide's wheel set
(numpy, pandas, scipy, matplotlib all exist); the project stays recognisably smolagents.

**Cons:** a **multi-megabyte WASM payload** (Pyodide core is 10 MB+, far more with numpy/pandas) to
download and initialise before the first run, with a cold start measured in hundreds of milliseconds
to seconds; heavy for a library whose selling point is "smol"; and **Pyodide is not a security
sandbox** — guest Python can reach JS globals via `import js`, so you still need a Worker and a
curated global set, and even then it is containment, not a security boundary.

### Option C — Pluggable `CodeExecutor`; JS-in-QuickJS by default, Pyodide and remote adapters opt-in

```ts
interface CodeExecutor {
  readonly language: "python" | "javascript";   // the agent must know what syntax to emit
  capabilities(): CapabilityManifest;           // what the prompt may advertise
  execute(code: string, opts: {
    tools: Record<string, Tool>;
    finalAnswer: (v: unknown) => void;
    timeoutMs?: number;
    signal?: AbortSignal;
  }): Promise<CodeResult>;                      // { logs, returnValue, finalAnswerValue? }
}
```
Then `new QuickJSExecutor()` (default, about 1 MB), `new PyodideExecutor()` (fidelity),
`new E2BExecutor()` / `DockerExecutor()` / `ModalExecutor()` mirroring upstream `remote_executors.py`.

**Pros:** no premature fork in the road; the *prompt* is selected by `executor.language`, so a Python
executor gives Python prompts and a JS executor gives JS prompts; users pick the fidelity/weight
trade-off; a strict superset of A and B; the interface is small and independently testable.

**Cons:** one more abstraction to design and document; "which executor?" becomes a new user's first
question (mitigated by a good default and a decision table in the README).

### Option D — No code agent at all: ship only `ToolCallingAgent`
**Pros:** smallest, safest, zero sandbox, works everywhere. **Cons:** discards the library's
identity. Acceptable as a fallback, not as the plan.

### Option E — Always execute remotely (E2B/Modal/Docker), never locally
**Pros:** real isolation, no local sandbox to maintain. **Cons:** needs a network service and
credentials for *hello world*, which kills the "try it in 30 seconds" goal.

### Comparison

| | A: JS sandbox | B: Pyodide | C: pluggable | D: tool-only | E: remote-only |
|---|---|---|---|---|---|
| Prompt parity with upstream | low | **high** | per-executor | n/a | medium |
| Install weight | about 1 MB | 10-25 MB | 1 MB default | 0 | 0 |
| Cold start | ms | 0.3-3 s | ms | 0 | network |
| Browser-native | **yes** | yes (heavy) | yes | yes | no |
| Hard security boundary | yes (QuickJS/isolated-vm) | no (containment) | yes | n/a | yes |
| Upstream examples port | rewrite | near-verbatim | mixed | rewrite | mixed |
| New concept to learn | 1 | 1 | 1 | 0 | 1 + a vendor |

### Recommendation
**C, with JS-in-QuickJS as the default and Pyodide as a first-class opt-in.** The interface costs
about a day of design and removes the only genuinely irreversible decision in the project. Defaulting
to QuickJS keeps the library smol, isomorphic and safe by construction; `PyodideExecutor` preserves
fidelity for people who want upstream-identical behaviour; remote executors cover production. The
only thing this forces us to decide up front is that the default agent writes **JavaScript**, and
therefore that the prompts must be ported in two dialects.

> Counter-argument worth hearing: if the primary audience is teams porting an existing Python
> smolagents project, defaulting to Pyodide is better and QuickJS becomes the opt-in. That is a
> question about *who the first user is* — see Question 4.

---

## Question 3 — Which runtimes must the library work in?

### What the question really is
Which host APIs the core code may use. The deciding facts:

- The **agent loop, models, memory, monitoring, prompt assembly** need only `fetch`, `AbortSignal`,
  `crypto.randomUUID`, async iterators and `structuredClone` — all present in browsers, Node 18+,
  Bun, Deno and most edge runtimes.
- The **CLI, tool loading from disk, `.env`, Docker/process executors** need `node:fs`, `node:path`,
  `node:child_process`.
- **Edge runtimes** (Cloudflare Workers) forbid `eval` / `new Function` unless explicitly enabled and
  restrict dynamic WASM instantiation; `isolated-vm` is impossible there.
- **Browsers** forbid `node:*` entirely and have no filesystem.

### Options

**A — Node only.** Simplest; matches upstream's deployment story (Python library + Gradio server).
Blocks the "any front-end dev" goal outright.

**B — Node + browser (isomorphic core).** Core imports no `node:*`; anything host-specific lives in a
runtime-specific package behind a package.json `exports` condition:
```json
"exports": {
  ".":              { "browser": "./dist/browser/index.js", "node": "./dist/node/index.js", "default": "./dist/index.js" },
  "./exec/quickjs": "./dist/exec/quickjs.js",
  "./react":        "./dist/react/index.js"
}
```
A browser build must never drag in `node:crypto` (use `globalThis.crypto`) or `Buffer`.

**C — Node + browser + edge.** As B, plus: no `eval` in core; make the JS executor's WASM loading
injectable so a Worker or edge host can supply the bytes; keep the agent loop purely `fetch`-based.

### Comparison

| capability | Node-only | isomorphic | + edge |
|---|---|---|---|
| Browser React app using the library directly | no | **yes** | yes |
| `npx smolagents` CLI / tool files on disk | yes | yes (node entry) | yes |
| Cloudflare/Vercel edge function hosting an agent | no | no | yes |
| Cost | lowest | medium (dual builds, CI matrix) | medium-high (edge test matrix) |
| Risk | fails the stated goal | confined to build config | subtle runtime gaps found late |

### Recommendation
**B now, C as a design constraint.** Write the core so it never imports `node:*` and never depends on
`eval` — then C is a matter of adding CI targets, not refactoring. Keep `isolated-vm` an optional
Node-only accelerator behind the same `CodeExecutor` interface, never the default. Enforce the rule
with a test (dependency-cruiser or an ESLint boundary rule) that fails the build if `core/` imports
`node:*` — an architectural constraint enforced by CI, not by discipline.

---

## Question 4 — What does "native" mean as a deliverable?

### What the question really is
Four separable things get conflated in "make it native":

1. **Source language** — TypeScript, emitting `.js` + `.d.ts`.
2. **Consumability** — installable from npm, ESM (and CJS if needed), tree-shakeable, no
   `postinstall`, types that resolve.
3. **Ergonomics** — a JS developer never has to read Python docs to use it.
4. **Distribution and identity** — the npm name, licence obligations, and whether it is published.

### Options

**A — one package** `smolagents-ts`: `npm i smolagents-ts`. Simple, but either bundles every model
provider and executor (heavy) or makes them optional peer deps (awkward discovery).

**B — scoped monorepo** with pnpm workspaces + changesets:
```text
packages/
  core/            the agent loop, memory, prompts, RunResult      (no heavy deps)
  models/          provider adapters + streaming
  tools/           default tools (web search, visit webpage, ...)
  exec-quickjs/    default JS sandbox
  exec-pyodide/    Python fidelity adapter
  exec-remote/     E2B / Docker / Modal / Blaxel
  mcp/             MCP client
  react/           hooks + headless components
  cli/             npx smolagents-ts
```
Installs stay small (a browser user never pulls the Docker client), boundaries are enforced by the
package graph, and each package has one clear purpose. Cost: real monorepo tooling.

**C — local-only.** No publish; a working library plus examples. Fastest to "it works", but not
reusable by "any front-end dev", which is the stated goal.

### Licence and identity — a real constraint, not a footnote
Upstream is **Apache-2.0**: keep `LICENSE`, add a `NOTICE` recording the derivation, keep file
headers, and state changes. The **name "smolagents" and the Hugging Face marks belong to Hugging
Face** — an unofficial port must say so and must not imply endorsement. `smolagents.js` on npm is
already taken by another unofficial port, so we need a distinct name (candidates: `smolagents-ts`,
or a neutral project name that documents compatibility). That is your decision, not mine.

### Comparison

| | A: single package | B: scoped monorepo | C: local only |
|---|---|---|---|
| Install weight for a browser user | high or awkward | low (per scope) | n/a |
| Boundary enforcement | none | package graph | none |
| Overhead to start | lowest | medium | lowest |
| Path to publish | easy | easy (changesets) | manual later |
| Fits "any front-end dev can use it" | partly | **yes** | no |

### Recommendation
**B, but start as C in spirit** — build S0-S4 locally with the monorepo layout from day one, and
treat publishing, CI and provenance as its own later sub-project. Layout now, publication later;
nothing then has to be restructured.

---

## Cross-cutting: what Vercel eve teaches us

**What it is** (verified, June 17 2026): `vercel/eve`, **Apache-2.0**, filesystem-first framework for
**durable** AI agents, `v0.77.0`, built on the Vercel AI SDK (`ai`) + `zod`, deployed with Vercel
Workflow + Vercel Sandbox, also self-hostable. Local reference clone: `reference/vercel-eve/`.

Its authoring model:
```text
my-agent/
└── agent/
    ├── agent.ts            # model + runtime config
    ├── instructions.md     # always-on system prompt
    ├── tools/              # typed functions the model can call
    ├── skills/             # markdown procedures loaded on demand
    ├── channels/           # HTTP, Slack, Discord, ...
    └── schedules/          # cron
```
with `defineTool({ description, inputSchema: z.object({...}), execute })` and `defineAgent({ model, reasoning })`.

### What overlaps with us
Tool-definition ergonomics; streaming UI as a first-class concern (it ships `useEveAgent()` for
React, Vue and Svelte); human-in-the-loop approvals and questions; sessions and resumability; evals;
a package split by concern.

### What does not overlap — and this is the important part
Eve's code extension (`eve/extensions/code`) is a **coding agent**: it contributes `apply_patch`,
`grep`, a read-only worker subagent and a **sandboxed shell** for the agent to work in. The agent's
*action language* is still tool calls; the sandbox is where the agent edits files. **Nobody in the JS
ecosystem has "the agent's action is a program" as the core abstraction** — which is precisely
`CodeAgent`. Eve also assumes a durable workflow runtime and a deployment target: it is a *framework
you build an app on*, not a *library you embed in an existing app*. Those two gaps are our project.

### Adopt (concrete)
1. **`defineTool` ergonomics** — `inputSchema` as Zod, `execute` receiving inferred input. Already our Q1 recommendation.
2. **A typed event stream as the UI contract.** Eve streams NDJSON with events such as `step.started`,
   `actions.requested`, `action.result`, `message.appended`, `message.completed`, `turn.waiting`,
   `turn.completed` — and its documented rule is that incremental deltas are *advisory* while the
   `*.completed` events are *authoritative*. That is a better foundation for React than replaying
   smolagents' callback list, and it is directly portable: design `agent.stream()` returning
   `AsyncIterable<AgentEvent>` and build the hooks on top.
3. **Durability as an optional adapter**, not a core assumption: a `SessionStore` interface
   (`save(sessionId, step)` / `load(sessionId)`) so a checkpointed agent is possible without
   requiring a workflow engine.
4. **HITL as a first-class primitive** — an `approval` policy on a tool plus a `ctx.ask()` question,
   both pausing and resuming. Upstream smolagents has only `UserInputTool`.
5. **A filesystem-first authoring layer as optional sugar** — `smolagents dev` reading
   `agent/instructions.md`, `agent/tools/*.ts`, `agent/skills/*.md`. Great DX, near-zero cost if it
   is a thin layer over the library API.
6. **Evals in the repo from day one**, and **`llms.txt` + `.md` alternates for the docs** so coding
   agents can read our documentation the way eve lets them read `node_modules/eve/docs`.
7. **Package split by concern** — its `eve-code`, `eve-git`, `eve-computer-use`, `eve-catalog`
   packages validate the monorepo plan.

### Reject
Vercel/AI-Gateway coupling; requiring a durable workflow runtime for a hello-world; the "beta, APIs
may change" release posture; and the assumption that the agent is a deployed service rather than a
library embedded in someone else's app.

### Strategic read
Eve **validates** the direction (TypeScript agents are now a first-class target) and **raises the
ergonomics bar** we should match. It also **leaves our niche open**: an embeddable,
framework-agnostic, CodeAgent-first library with React primitives and no hosting assumptions.

---

## Decision log — all decide-or-propose as of round 3

| # | decision | options | recommendation | decision |
|---|---|---|---|---|
| D2 | Fidelity posture | API-parity / native / hybrid | native, upstream vocabulary + prompts preserved | **DECIDED — B: native, schema-first** |
| D1 | Code action language + sandbox | JS sandbox / Pyodide / pluggable / none / remote | pluggable; QuickJS default, Pyodide opt-in | **DECIDED — C: pluggable `CodeExecutor`** |
| D3 | Model layer | own adapters / AI SDK / both | own thin `Model` interface + adapters | **PROPOSED in S0/S1 design** |
| D4 | Tool definition | Zod / Standard Schema / JSON Schema | Zod-first, Standard-Schema-compatible | **DECIDED (implied by D2) — Zod-first** |
| D5 | Package layout | single / scoped monorepo | scoped monorepo | **DECIDED — B+C hybrid (BC-1): monorepo architecture, publish later** |
| D6 | React surface | hooks / +components / +devtools | layered primitives; chat surface and run inspector are both long-term goals | **DECIDED — layered; both surfaces accepted as long-term; v1 = hooks + headless primitives** |
| D7 | Runtime targets | Node / isomorphic / +edge | isomorphic core; ECMA-429 + Node 22/24 + browser + Bun + Deno; Workers supported but never gating | **DECIDED — B: isomorphic core, edge constraints opportunistic** |
| D8 | Async style | callbacks / AsyncIterable / both / RxJS | `AsyncIterable<AgentEvent>` as source of truth + thin `agent.on()` adapter | **DECIDED — S3; deltas advisory, `*.completed` authoritative** |
| D9 | Testing | port pytest / differential parity / both | port the suite + differential harness + published-shape checks (`publint`, `attw`, `npm pack`) | **PROPOSED in S0/S1 design** |
| D10 | v1 scope | minimal / balanced / full | core + models + tools + exec-quickjs + react | **DECIDED — V-balanced** |
| D11 | Name + licence notices | `smolagents-ts` / neutral name | `smolagents-ts` + unofficial-notice | **DECIDED — `smolagents-ts`; bare `smolagents` explicitly rejected** |
| D12 | Distribution shape | one umbrella package + subpaths / many scoped packages | one umbrella `smolagents-ts` with subpath exports, monorepo internally | **PROPOSED in S0/S1 design** |
| D13 | First sub-project | S0+S1 / something else | S0 Foundations + S1 Core runtime | **PROPOSED — awaiting approval of the design** |

Long-form detail: `round-2-runtime-and-distribution.md` (D7 evidence, B+C hybrid, audience) and
`round-3-open-decisions.md` (D11 naming, D7/D6/D8/D10 analysis, v1 module allocation).

---

## The one question that unlocks the rest

Question 2 (the executor) and Question 4 (the first user) are entangled. If the first user is a
**front-end developer** building an app, the default is **QuickJS + JavaScript** and Pyodide is a
fidelity option. If the first user is a **team porting a Python smolagents project**, the default is
**Pyodide + Python** and QuickJS is the lightweight option. The `CodeExecutor` interface makes the
change cheap either way, but the default shapes the README, the examples, and the prompts.
