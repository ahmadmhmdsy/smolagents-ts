# Round 3 — naming, and the four remaining decisions (D7, D6, D8, D10)

**Date:** 2026-10-12
**Status:** research + analysis for the design conversation.
**Confirmed so far:** Q1 = **B** (native schema-first) · Q2 = **C** (pluggable CodeExecutor) ·
first-user = **3a build + option-4 framing + 3b as a later executor**.
**Companion:** [`upstream-recon.md`](./upstream-recon.md) · [`decision-analysis.md`](./decision-analysis.md) · [`round-2-runtime-and-distribution.md`](./round-2-runtime-and-distribution.md)

---

## Part A — D11: the name

### A.1 The constraints (not negotiable)

1. **Apache-2.0 upstream** → keep `LICENSE`, add a `NOTICE` recording the derivation, keep file headers, state changes.
2. **"smolagents" and the Hugging Face logo/marks are Hugging Face's.** An unofficial port must say it is
   unofficial and must not imply endorsement. The safest wording is a first-line disclaimer in the README
   and a `NOTICE`: "Unofficial TypeScript implementation of the smolagents approach. Not affiliated with or
   endorsed by Hugging Face."
3. **`smolagents.js` on npm is already taken** by another unofficial port (yusuf-eren/smolagents.js).
4. The name leaks into every `package.json`, every import statement, every doc page, and every example — so
   it is expensive to change after the first publish.

### A.2 Availability, measured (npm registry, checked 2026-10-12)

| name | status | note |
|---|---|---|
| **`smolagents-ts`** | **FREE** | the obvious derivation-explicit choice |
| `smolagents-js` | FREE | same idea; `-js` reads as "JavaScript" (no types) |
| `smolagents` | **FREE** | available, but **do not use** — implies an official HF npm package |
| `smolagent` | FREE | singular; ambiguous |
| `smolagents.ts` | FREE | legal as an npm name, unwise |
| `codeact` | TAKEN | the paradigm's own name is gone |
| `codeact-js`, `codeact-ts` | FREE | paradigm + language suffix |
| `actcode`, `thinkact`, `thinkcode`, `codefirst`, `codevar`, `runact`, `smolact`, `codact` | FREE | invented / descriptive |
| `codeagent`, `codeagents`, `codeagents.js`, `codeagents-ts` | TAKEN / FREE | `codeagents-ts` free |
| `smol-ts`, `smolcode`, `smolrun` | FREE | echoes HF's "smol" family |
| `tinyagents`, `nanoagents`, `leanagents`, `pocketagents` | FREE | generic `-agents` names |
| `microagents`, `picoagents`, `codelet`, `agentcode`, `coact`, `coreact`, `codeloop`, `agentloom` | TAKEN | — |

### A.3 Four naming strategies

| strategy | examples | pros | cons |
|---|---|---|---|
| **1. Derivation-explicit** | `smolagents-ts` | instant discoverability; rides search traffic for `smolagents`; honest; zero marketing cost; obviously matches the project | reads as "a port"; caps the brand; needs a trademark disclaimer; option-4 "contender" framing fights it |
| **2. Paradigm-explicit** | `codeact-js`, `codeact-ts`, `actcode` | names the actual technique (the CodeAct paper); descriptive and defensible; survives the HF question entirely | `codeact` bare is taken; the term is academic — hard to own, and SEO competes with the paper |
| **3. Smol-family** | `smol-ts`, `smolcode`, `smolrun` | echoes the aesthetic; no third-party mark | `smol-` is Hugging Face's informal branding; `smol-ts` is opaque to a newcomer |
| **4. Distinctive brand** | `thinkcode`, `codefirst`, `codecrate`, `agentts` | ownable, brandable, no mark risk, fits option-4 framing | no discoverability from `smolagents`; needs the tagline to do all the work; another generic word in a crowded space |

### A.4 Recommendation

**Two-layer naming, which dissolves the trade-off:**

- **npm packages:** `smolagents-ts` (free) as the umbrella / meta package, with subpaths or scoped siblings later.
- **Docs and repo tagline:** "**smolagents-ts — agents that think in code, natively in TypeScript**", with the unofficial/not-affiliated disclaimer on line one and `smolagents` + `CodeAct` in the keywords.
- **If you want option-4 positioning to lead** (a contender, not a port), pick a distinctive brand for the *project* and keep `smolagents-ts` as the compatibility package name. My shortlist from the free set: **`thinkcode`**, **`codefirst`**, **`smolcode`**, **`agentts`**, **`codecrate`**.

**Do not take the bare `smolagents` name** even though it is free. It is the one choice that turns a
licence/attribution question into a trademark one.

---

## Part B — D7: confirm isomorphic runtime targets

### B.1 Options

| | scope | what the core may use | ships to |
|---|---|---|---|
| **A** | Node only | anything, including `node:fs`, `child_process` | servers, CLIs |
| **B** | **isomorphic** (Node + browser) | ECMA-429 subset: `fetch`, `AbortSignal`, `crypto`, `structuredClone`, iterators, `URL`, `Intl` | servers **and** the browser |
| **C** | B, plus edge as a gating target | B's subset, and additionally no `eval`/`new Function`, WASM as a static import | servers, browser, Cloudflare Workers, Deno Deploy |

### B.2 Why this is a product decision, not a plumbing detail

With **A**, a Next.js developer cannot run an agent in the browser at all — the React components must POST to
a server route, and "native front-end library" becomes "React components over a backend". With **B**, the same
component tree runs the agent in a route handler *or* in the browser (using QuickJS-WASM), with no API change.
That is exactly the difference between the goal you stated and a chat wrapper.

Choosing **C** costs almost nothing *if B is already enforced*, because the edge constraints are a strict
subset: no `eval`, no `node:*`, WASM imported statically rather than built at runtime.

### B.3 Example — the `exports` map and the enforced rule

```jsonc
{
  "name": "smolagents-ts",
  "type": "module",
  "exports": {
    ".": {
      "types":   "./dist/index.d.ts",
      "browser": "./dist/browser.js",
      "node":    "./dist/node.js",
      "default": "./dist/index.js"
    },
    "./exec/quickjs": "./dist/exec/quickjs.js",
    "./react":        "./dist/react/index.js",
    "./node":         "./dist/node/index.js"
  }
}
```

```ts
// tests/architecture/no-node-builtins.test.ts — the constraint is a test, not a convention
import { cruise } from "dependency-cruiser";

test("core never imports node builtins", async () => {
  const report = await cruise(["packages/core/src"], {
    ruleSet: { forbidden: [{ name: "no-node", from: {}, to: { path: "^node:" } }] },
  });
  expect(report.violations).toEqual([]);
});
```

### B.4 Recommendation
**Confirm B, with C's constraints adopted opportunistically** — i.e. write the core as if Workers mattered,
but never let a Workers limitation change the public API. Rationale and evidence are in
[`round-2-runtime-and-distribution.md`](./round-2-runtime-and-distribution.md) Part A.

---

## Part C — D6: the React surface

### C.1 The framing question that comes first

smolagents is not a chat library. A run is a sequence of **typed steps** — `TaskStep`, `SystemPromptStep`,
`PlanningStep`, `ActionStep` (with generated code, tool calls, logs, observations), `FinalAnswerStep` — and
upstream's `gradio_ui.py` (389 lines) exists to render exactly that. Eve's `useEveAgent` is a *chat* hook.

So the React layer has two possible subjects, and they are different products:

- **(i) a chat surface** — messages in, messages out;
- **(ii) a run inspector** — steps, code, tool calls, logs, timings, tokens, final answer.

The right answer is **(ii) as the foundation, (i) as a thin convenience on top**, because (ii) is what is
unique to CodeAgent and (i) is already solved by a dozen chat libraries.

### C.2 Options

| | what ships | you get | you write |
|---|---|---|---|
| **R1** | hooks only | state, actions, events; zero markup opinions | all UI |
| **R2** | hooks + **headless** components | composable parts with ARIA, no styling | all styling |
| **R3** | R2 + styled components ("copy-in", shadcn style) | a finished-looking chat/run UI | overrides only |
| **R4** | R2/R3 + devtools | a step timeline, time-travel, token/time metrics | nothing extra |

Comparison:

| dimension | R1 | R2 | R3 | R4 |
|---|---|---|---|---|
| bundle cost | lowest | +small | +medium (icons, tokens) | +large |
| design lock-in | none | none | medium (you own a copy) | none |
| accessibility | you | **handled** | handled | handled |
| time to "it looks good" | long | long | **short** | short |
| maintenance | lowest | medium | **highest** | high |
| fits option-4 wedge | partly | **yes** | yes | yes |

### C.3 Example — R1 vs R2

```tsx
// R1 — hooks only. You own everything.
function FibonacciDemo({ agent }: { agent: CodeAgent }) {
  const { steps, status, run, cancel } = useAgentRun(agent);
  return (
    <div>
      <button onClick={() => run("What is the 20th Fibonacci number?")} disabled={status === "running"}>
        Run
      </button>
      {status === "running" && <button onClick={cancel}>Cancel</button>}
      {steps.map((s) => <pre key={s.id}>{JSON.stringify(s, null, 2)}</pre>)}
    </div>
  );
}
```

```tsx
// R2 — headless. Composable parts, ARIA and streaming handled, styling is yours.
<AgentRun agent={agent} task="What is the 20th Fibonacci number?">
  <AgentRun.Status />
  <AgentRun.Steps>
    {({ step }) =>
      step.kind === "action" ? (
        <AgentStep.Action step={step} className="my-step">
          <AgentStep.Code />
          <AgentStep.ToolCalls />
          <AgentStep.Logs />
          <AgentStep.Observation />
        </AgentStep.Action>
      ) : (
        <AgentStep.Planning step={step} />
      )
    }
  </AgentRun.Steps>
  <AgentRun.FinalAnswer />
</AgentRun>
```

### C.4 Recommendation
**R2 — hooks + headless components, with the component contract derived from the upstream step model**, and
the door left open for an R3 styled layer as a separate package (`react-ui`). Headless components must own
the hard parts: streaming live-regions (`aria-live` for appended output), `aria-busy` during a run,
keyboard-navigable step list, and correct announcement of tool-call completion.

---

## Part D — D8: async style

### D.1 Options

| | shape | cancellation | React fit | upstream parity |
|---|---|---|---|---|
| **S1** | callbacks / EventEmitter | throw / off() | needs a bridge effect | **high** (`step_callbacks`, `CallbackRegistry`) |
| **S2** | `AsyncIterable<AgentEvent>` | `break` or `AbortSignal` | direct (`useEffect` + `for await`) | new |
| **S3** | S2 as the source of truth + a thin `agent.on()` adapter | both | direct | high |
| **S4** | RxJS Observable | unsubscribe | needs a bridge | low |

### D.2 Why AsyncIterable wins

- **Lazy and ordered by construction.** Events are pulled; you cannot get an out-of-order callback.
- **Cancellation is syntax, not API.** `break` out of the loop, or pass an `AbortSignal`.
- **No listener leaks.** The loop ends, the subscription ends.
- **The same primitive in Node and the browser**, and it converts to anything (`ReadableStream`,
  `Observable`, a callback adapter) in a few lines — the reverse is not true.
- **The final value falls out naturally**: the last event carries the `RunResult`.

### D.3 Adopt Eve's ruling: deltas are advisory, completed events are authoritative

A stream can be coalesced, retried, or replayed (Eve documents exactly this). So consumers must converge on
the `*.completed` events, and `*.delta` events are a progressive-enhancement nicety. This single rule prevents
a whole class of React rendering bugs and is worth stating in the docs as a contract.

### D.4 Example

```ts
const controller = new AbortController();

for await (const ev of agent.stream("Compare the weather in Paris and Oslo", { signal: controller.signal })) {
  switch (ev.type) {
    case "step.started":        console.log("step", ev.index); break;
    case "planning.completed":  plan = ev.text; break;
    case "code.delta":          process.stdout.write(ev.text); break;  // advisory
    case "code.completed":      code = ev.text; break;                 // authoritative
    case "action.requested":    console.log(ev.tool, ev.args); break;
    case "action.result":       console.log(ev.output); break;
    case "message.delta":       process.stdout.write(ev.text); break;  // advisory
    case "message.completed":   committed = ev.text; break;            // authoritative
    case "run.completed":       return ev.result;                      // RunResult
  }
}
```

Both entry points, one engine:

```ts
const result  = await agent.run(task);                        // drains the stream, resolves to RunResult
for await (const e of agent.stream(task)) { /* ... */ }        // incremental
const stop    = agent.on("action.result", (e) => {});          // optional callback adapter (S3)
```

### D.5 Recommendation
**S3** — `AsyncIterable<AgentEvent>` as the single source of truth, plus a thin `agent.on(event, cb)` adapter
for upstream familiarity and for users who will not restructure their code. Reject RxJS as a dependency
(users can wrap the iterable themselves).

### D.6 Event vocabulary (maps 1:1 onto upstream's memory steps)

| upstream concept | events |
|---|---|
| run start | `run.started` |
| `PlanningStep` | `planning.started`, `planning.delta`, `planning.completed` |
| `ActionStep` model output | `step.started`, `code.delta`, `code.completed` |
| tool invocation | `action.requested`, `action.result`, `action.failed` |
| executor output | `logs.appended`, `observation.completed` |
| `FinalAnswerStep` / `RunResult` | `run.completed` (carries `result`) |
| errors / limits | `run.failed`, `run.maxStepsReached`, `run.cancelled` |

---

## Part E — D10: v1 scope

### E.1 Options

| | contents | ships | verdict |
|---|---|---|---|
| **V-minimal** | core + models + tools, `ToolCallingAgent` only | fastest | no differentiator; fails the wedge |
| **V-balanced** | core + models + tools + `exec-quickjs` + `CodeAgent` + `react` | the wedge, end to end | **recommended** |
| **V-full** | everything: `mcp`, `exec-remote`, `cli`, Hub, Pyodide, vision | 12-18 months | delays all value |

### E.2 Module-by-module v1 allocation

| upstream module | lines | v1 | target / note |
|---|---|---|---|
| `agents.py` | 1625 | **yes** | `core` — `MultiStepAgent`, `CodeAgent`, `ToolCallingAgent`, `RunResult` |
| `memory.py` | 260 | **yes** | `core` — step classes, callback registry |
| `monitoring.py` | 229 | **yes** | `core` — `Monitor`, `TokenUsage`, `Timing`, logger |
| `prompts/*.yaml` | 4 files | **yes** | `core` — ported to the JS dialect first |
| `utils.py` | 487 | **yes** (subset) | `core` — JSON/code parsing, truncation, retry, rate limit |
| `agent_types.py` | 221 | **yes** (subset) | `core` — text + image; audio deferred |
| `tools.py` | 1206 | **yes** | `core`/`tools` — schema-first `tool()`, `ToolCollection` |
| `default_tools.py` | 586 | **yes** (subset) | `tools` — web search, visit webpage, wikipedia, final answer |
| `models.py` | 1880 | **yes** (subset) | `models` — OpenAI-compatible + Anthropic + Gemini + HF Inference |
| `local_python_executor.py` | 1556 | **no** | replaced by `exec-quickjs` (JS executor) |
| `gradio_ui.py` | 389 | **no** | replaced by `react` |
| `_function_type_hints_utils.py` | 363 | **no** | replaced by Zod |
| `tool_validation.py` | 228 | **no** | replaced by types + Zod, plus a few runtime checks |
| `serialization.py` | 435 | later | v1.5 — only needed for tool/agent round-trips |
| `mcp_client.py` | 142 | later | v1.5 — `mcp` package |
| `remote_executors.py` | 902 | later | v1.5 — `exec-remote` (E2B / Docker / Modal / Blaxel) |
| `cli.py` | 255 | later | v1.5 — `cli` |
| Hub integration | — | later | v1.5 — `@huggingface/hub` |
| `vision_web_browser.py` | 204 | v2 | Playwright example |
| Pyodide executor | — | v1.5 | `exec-pyodide` — the 3b path |

Rough v1 size: about 6,000 lines of TypeScript plus about 5,000 lines of tests, across five packages.

### E.3 v1 acceptance criteria

```ts
// Runs in Node AND in a browser bundle, from the installed package, with the run streamed into React.
import { CodeAgent, OpenAICompatibleModel, tool } from "smolagents-ts";

const getWeather = tool({ /* z.object schema */ });

const agent = new CodeAgent({
  model: new OpenAICompatibleModel({ baseUrl, apiKey, modelId }),
  tools: [getWeather],
});

const result = await agent.run("Is it warmer in Paris or Oslo right now?");
console.log(result.output, result.steps, result.tokenUsage);
```

Plus: `npm pack` install smoke test in CI, `publint` and `attw` clean, and a `react` example that compiles
without any `node:*` polyfill.

### E.4 Sub-project sequence

```text
S0  Foundations     pnpm monorepo, TS config, vitest, changesets, publint/attw CI, LICENSE + NOTICE
S1  Core runtime    MultiStepAgent loop, memory steps, RunResult, monitoring, prompt assembly, event stream
S2  Model layer     Model interface + OpenAI-compatible, Anthropic, Gemini, HF Inference adapters
S3  Tool system     tool()/Zod schemas, ToolCollection, the default tools
S4  Code execution  CodeExecutor contract, exec-quickjs, final_answer bridging, async tool-call bridging
S5  React layer     useAgentRun / useAgentStream, headless step components
S6  Distribution    publish, CLI, MCP, remote executors, exec-pyodide, examples, docs site
```

### E.5 Recommendation
**V-balanced**, with S0 + S1 as the first spec. Everything deferred is deferred honestly: the modules left out
of v1 are named in E.2 rather than quietly forgotten.
