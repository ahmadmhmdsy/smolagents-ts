# Round 2 — runtime targets, distribution posture, and audience

**Date:** 2026-10-12
**Status:** research + analysis for the design conversation. Confirmed by the user: Q1 = **B (native schema-first)**, Q2 = **C (pluggable CodeExecutor)**.
**Companion:** [`upstream-recon.md`](./upstream-recon.md), [`decision-analysis.md`](./decision-analysis.md)

---

## Part A — Question 3: which runtime targets? (evidence-led)

### A.1 What changed in the landscape (verified this session)

| finding | source | consequence for us |
|---|---|---|
| **Vercel Edge Functions are deprecated.** Docs say "Do not use them for new projects"; Next.js 16.3 drops `runtime = 'edge'`; Node.js is the default runtime. | vercel.com/docs/functions/runtimes/edge | "Edge" no longer means "Vercel". The real remaining edge targets are **Cloudflare Workers** and **Deno Deploy**. |
| **Cloudflare Workers disallow `eval` / `new Function` at runtime** ("Code generation from strings disallowed"). Since **2025-06-01** they are allowed **during startup** via `allow_eval_during_startup`, and only there. | workerd PR #4142, opennextjs-cloudflare #1155, Workers compatibility flags | The executor must never depend on `eval` / `new Function`. A WASM engine is fine; a same-realm interpreter is not. |
| **WinterTC "Minimum common web API" is now ECMA-429** (draft, 31 July 2026) — a formal spec of the API subset server runtimes should implement. | min-common-api.proposal.wintertc.org | Gives us a **citable, precise target** for "isomorphic core" instead of guessing which globals exist. |
| **Node.js 24.x is Active LTS**; 22.x is Maintenance LTS. | nodejs/Release | Node 24 is the reference target; Node 22 is the floor. |
| **Eve requires `engines: { node: ">=24" }`, is ESM-only** (`"type": "module"`), and exposes about 90 subpath exports including `./sandbox/docker`, `./sandbox/microsandbox`, `./sandbox/vercel`, `./sandbox/just-bash`. | `reference/vercel-eve/packages/eve/package.json` | Independent confirmation that (a) Node 24 is the modern baseline, (b) **pluggable sandbox providers** is the industry pattern (validates Q2:C), (c) subpath exports scale. |

### A.2 The sandbox options, ranked by current evidence

From the March 2026 JS-sandboxing research (simonw/research), cross-checked against vendor docs:

| engine | isolation | memory limit | cpu/timeout | fs / network | speed | maintenance |
|---|---|---|---|---|---|---|
| **quickjs-emscripten** (WASM) | **strongest** — WASM linear-memory boundary; a memory-corruption bug inside QuickJS still cannot escape | yes, hard | yes, interrupt handler | none by default | **10-50x slower than V8** (pure interpreter) | active (QuickJS 2025-09-13 vendored Feb 2026; quickjs-ng variant) |
| **isolated-vm** (V8 isolate) | strong, same boundary Workers use | yes, soft (2-3x overshoot) | yes, timeout + `cpuTime` | none by default | native V8 JIT | **maintenance mode**; needs a C++ toolchain and `--no-node-snapshot`; Node-only |
| Deno Workers | strong + runtime permissions | no | no (implement externally) | granular per-path / per-domain | native | active, **Deno-only** |
| Node `worker_threads` | **not a security boundary** — full Node API access | no | no | full | native | n/a |
| `node:vm` + Node Permission Model | weak / experimental | no | no | partial | native | flag-gated |
| **vm2** | **do not use** — 20+ escape CVEs, incl. CVE-2026-22709 (CVSS 9.8, Jan 2026) | no | partial | attempted, historically bypassed | native | resurrected, fragile |
| ShadowRealm (TC39) | global isolation, **not** a security boundary; Stage 2.7, not shipped by default | no | no | none guaranteed | native | proposal |
| **mquickjs** (MicroQuickJS, Bellard) | WASM sandbox | yes | yes, bounded by bytecode ops | none | tiny and fast | new; **ES5-era language**, no async/await/generators/dynamic import; needs SWC precompile |
| remote (E2B / Docker / Modal / Blaxel) | strongest (process / VM) | yes | yes | policy-controlled | network RTT | vendor-dependent |

**Two engineering consequences that fall out of this table:**

1. **QuickJS-WASM is the only engine that satisfies browser + Node + Workers + Bun + Deno at once**, and it is also the *strongest* isolation. It is the correct portable default. Its cost is raw compute speed — acceptable because agent actions are glue code plus tool calls, and the heavy lifting belongs in tools (which run on the host, at native speed).
2. **Async tool calls are the real technical risk, not isolation.** smolagents tools are synchronous; JS tools are `async` (`fetch`). A QuickJS guest cannot `await` a host promise unless you either use the **asyncify** build (about 1 MB, +40% overhead) or implement a **pause/resume task loop**. This must be designed explicitly into the `CodeExecutor` contract, and it is the strongest argument for keeping the host-side tool surface synchronous-by-default where possible.

### A.3 Recommendation

> **Isomorphic core. Target ECMA-429 + Node 22/24 + browsers + Bun + Deno. Treat Cloudflare Workers as a first-class *supported* target, but never let it gate a design decision.**

Rationale: Vercel's deprecation of Edge removed the largest "edge" deployment, leaving Workers and Deno Deploy as real but narrower audiences. Designing *for* Workers forces the useful constraints anyway (no `eval`, no `node:*`, WASM as a static import), so compatibility comes almost for free — but we must not contort the API to satisfy a runtime most users will never deploy to.

**Concrete rules for `packages/core`:**
- Allowed: `fetch`, `AbortSignal`, `Response` / `Request`, `Headers`, `TextEncoder` / `TextDecoder`, `crypto.randomUUID` / `crypto.subtle`, `structuredClone`, async iterators, `URL`, `Math`, `Date`, `Intl`, `queueMicrotask`, `setTimeout`.
- Forbidden: every `node:*` import, `Buffer`, `process`, `eval`, `new Function`, dynamic `WebAssembly.instantiate` from runtime-built bytes.
- Isolated behind subpath exports: filesystem, path handling, `.env` loading, the CLI, the Docker/process executors.

**Enforcement (a test, not discipline):**
1. ESLint `no-restricted-imports` for `node:*` and `no-restricted-globals` for `process` / `Buffer` inside `packages/core`.
2. A `dependency-cruiser` rule: `core` may not depend on any runtime-specific package.
3. CI matrix: Node 22 + Node 24, Bun, Deno, a browser build, and one Cloudflare Workers smoke test (`@cloudflare/vitest-pool-workers`).
4. A published-shape job (see Part B) so we never ship an `exports` map that only works in the workspace.

---

## Part B — Question 4: B+C hybrid (scoped monorepo **and** local-first)

### B.1 Three readings of "B+C"

| | what it means | when to pick it |
|---|---|---|
| **BC-1 — private monorepo, publish later** | Full monorepo layout (B's architecture); consumers use `workspace:*` internally; npm publication deferred (C's release posture). | **Recommended default.** |
| **BC-2 — partial publication** | Publish only the packages with external demand (`core`, `react`, `models`) and keep the rest private/workspace-only. | When a real consumer asks, before the whole surface is stable. |
| **BC-3 — private registry / git dependency** | Publish to a private registry, GitHub Packages, or consume via `github:owner/repo`. | When there is exactly one internal consumer. |

### B.2 Pros of B+C

1. **No restructuring later.** The package graph exists from commit #1, so boundaries are discovered while the code is small.
2. **Boundary enforcement is real, not aspirational.** "Does `core` avoid `node:*`?" and "does `react` pull in the Docker client?" are answered by the build graph, not by review.
3. **Fast iteration.** One `pnpm -r build`, no version bumps, no release ceremony while the API is churning weekly.
4. **Small installs stay small by construction.** A browser consumer of `core` + `react` never resolves the remote executors.
5. **Deferred cost.** Semver discipline, changelogs, provenance, 2FA, name-squatting panic — all postponed to a moment of your choosing.
6. **Consumable today anyway.** `pnpm add github:you/smolagents-ts` or `npm pack` gives real users something to try without a registry decision.

### B.3 Cons and gaps (the honest list)

| # | gap | severity | why it bites |
|---|---|---|---|
| G1 | **The stated goal ("any front-end dev can use it") is not met until publication.** No `npm i`. | **high** | This is the whole point of the project. The private phase must therefore be short and explicitly time-boxed. |
| G2 | **`workspace:*` is not resolvable by consumers.** | medium | Publishing rewrites it; **changesets does this automatically** — but only if adopted from the start. |
| G3 | **The "works in workspace, broken when published" class of bugs**: bad `exports` / `types` maps, missing `files` entries, `typesVersions`, dual-package hazard. | **high** | The single biggest real risk in B+C, and it is invisible in a private monorepo. |
| G4 | **No external feedback loop.** API stability is untested until strangers use it. | medium | Mitigate with a public repo plus a beta of one or two packages. |
| G5 | **Docs examples referencing `npm i` are fictional** during the private phase. | low | Write examples against the workspace; add a publish-time docs pass. |
| G6 | **Monorepo tooling overhead**: pnpm workspaces + TS project references + changesets + a build orchestrator. | medium | Real upfront cost; also the thing that makes G3 detectable. |
| G7 | **Name and licence decisions must be made before the first publish, and names are expensive to change.** Upstream is Apache-2.0 → `LICENSE` + `NOTICE` + a change statement; "smolagents" and the Hugging Face marks belong to Hugging Face; `smolagents.js` is already taken on npm. | **high** | Blocks publication entirely; needs your decision, not mine. |
| G8 | **ESM-only vs dual CJS/ESM** must be decided early; retrofitting CJS is painful. | medium | Eve chose ESM-only. For a modern front-end audience, ESM-only is defensible. |

### B.4 The five gap-closers that make B+C safe

1. **Adopt changesets in the first commit** — never retrofit it. (closes G2)
2. **Run `publint` + `@arethetypeswrong/cli` + an `npm pack` → install → import smoke test in CI from day one**, even while private. The only cheap way to catch G3.
3. **Time-box the private phase** and declare the first-publish milestone up front (for example: "publish `core` + `react` when the React layer lands").
4. **Decide the public name, licence notices, and ESM-only-vs-dual before writing the first `package.json`**, because all three leak into every file. (closes G7, G8)
5. **A real consumer fixture**: an example app in the repo that imports only through the *published entry points*, never through relative source paths.

### B.5 Verdict
**Yes — B+C is the right call, in the BC-1 form**, provided the five gap-closers are adopted. It buys the architecture of B at the cost of C, and the only thing genuinely deferred is the moment the goal is publicly met — which we control by time-boxing.

---

## Part C — "Who is the first user?": option 3 vs option 4

These two options are **not on the same axis**, which is why they read as comparable but are not. Option 3 is about *audience and sequencing*; option 4 is about *positioning and competitive strategy*. You can hold both at once — and probably should.

### Option 3 — "Both audiences, eventually; you pick which ships first"

Option 3 contains two different builds wearing one label, because the two audiences want **opposite defaults**:

| | **3a — front-end dev first** | **3b — Python-migration team first** |
|---|---|---|
| First shipped artifact | `core` + `react`, npm-installable | `core` + `exec-pyodide` + CLI, Node |
| Default executor | **QuickJS + JavaScript** (about 1 MB, instant) | **Pyodide + Python** (10-25 MB, 0.3-3 s cold start) |
| Prompts ported first | JS dialect — rewritten | Python dialect — **verbatim from upstream** |
| Primary surface | React hooks + headless components | `agent.run()` on Node, plus CLI |
| Time to a compelling demo | **fast** (no WASM-Python boot) | slower (payload is heavy, though prompt porting is already done) |
| Time to credibility with a committed audience | slower | **fast** — an existing project moves in an afternoon |
| Success metric | "I dropped an agent into my Next.js app in 10 minutes" | "my Python smolagents project now runs on Node" |
| Biggest risk | looks like another small agent library with no wedge | the weight contradicts "smol" and the audience is finite |
| De-prioritised | Pyodide, fidelity to upstream prompt text | React, browser story, front-end ergonomics |

**Key insight:** `CodeExecutor` (Q2:C) makes the *engine* shared — what actually differs between 3a and 3b is **defaults, first prompts, and first docs**. That is cheap to switch and expensive to get wrong, because everything user-visible is tuned to one of them.

**The trap in option 3:** trying to serve both at launch. A README cannot open with two contradictory quick-starts; a single `npm i` default must pick one executor. "Both eventually" is only safe if you explicitly serialise.

### Option 4 — "A new library competing with Eve / Mastra / LangChain.js on its own merits"

**What it means:** the audience is *the market*, not a specific migration or app-building cohort. Success is adoption and recognition among TS agent developers. The competition is `vercel/eve` (backed by Vercel, June 2026), Mastra (about 27k stars), LangChain.js (about 18k stars), the Vercel AI SDK, and the OpenAI Agents SDK for JS.

**What it demands beyond 3a/3b:**
- A **wedge**, stated in one line. Candidates, in order of defensibility:
  1. **CodeAgent-first** — nobody in JS has "the agent's action is a program". Eve's code extension is a *coding agent* (tools plus a sandboxed shell), not this.
  2. **Embeddable and framework-agnostic** — Eve is a framework you build an app *on*; this is a library you drop *into* an existing app.
  3. **Capability-injected sandbox by construction** — nothing exists in the guest that you did not grant. A security property, not a feature.
  4. **Provider-neutral, no gateway lock-in**, fully typed end to end.
- **Evidence**: benchmarks and evals in the repo (Eve publishes a coding-agent benchmark; we would need our own), an examples gallery, a docs site.
- **Release discipline**: semver, changelogs, provenance, a deprecation policy, a support matrix.
- **Community**: issues, discussions, contributions, and a real name and licence story.

**Cost and risk:** the code is the easy part; **distribution is the hard part**. Vercel ships Eve with a company behind it and a captive deployment audience. Mastra and LangChain.js have years of content, integrations and mindshare. Entering "on merits" without a wedge means being marginally worse than several well-resourced alternatives at everything. The failure mode is a technically good library nobody finds.

**Upside:** the wedge above is genuinely unoccupied. "Embeddable, CodeAgent-first, sandbox-by-construction, React-native, no lock-in" is a coherent position no current JS project holds.

### C.1 Head-to-head

| dimension | 3a front-end first | 3b migration first | 4 market contender |
|---|---|---|---|
| Primary audience | app developers | teams with existing Python smolagents code | TS agent developers at large |
| Default executor | QuickJS / JS | Pyodide / Python | whichever the wedge needs (QuickJS / JS) |
| First deliverable | `core` + `react` on npm | `core` + `exec-pyodide` + CLI | `core` + a strong README + benchmarks |
| Wedge required | no — the audience is defined by use | no — the audience is defined by their code | **yes, mandatory** |
| Time to first external user | short | short (a known set) | long |
| Time to credibility | medium | **short** | **long** |
| Ongoing ops/marketing burden | low | low | **high** |
| Ceiling if it works | moderate and specific | moderate and specific | **high** |
| Failure mode | "yet another small agent lib" | "a heavier port with a shrinking audience" | "good code, no adoption" |
| Extra work it forces | React layer, browser CI | Pyodide adapter, prompt-fidelity tests | benchmarks, docs site, release and community ops, comparison pages |
| Needs Pyodide early? | no | **yes** | no |

### C.2 How they combine — and the reading I would argue for

Option 4 is **not a fourth build**; it is a *positioning overlay* on top of 3a. Concretely:

- **The build is 3a** (front-end first, QuickJS default, React tier-1). That is also exactly the wedge option 4 needs, because "embeddable + CodeAgent-first + sandbox-by-construction + React" is the unoccupied position.
- **Option 4 adds** a positioning and evidence layer: a one-sentence wedge, benchmarks, an examples gallery, a comparison page against Eve / Mastra / LangChain.js, and release discipline.
- **Option 3b is the branch that conflicts.** Choosing Pyodide-first pulls against 3a and 4 on weight, prompts and default executor. It is a *later* addition — the `CodeExecutor` interface makes it cheap to add at any time — not a launch default.

**Practical answer: 3a as the build, 4 as the framing, 3b as a supported and documented second executor after launch.** If instead you choose 3b as the *launch* posture, everything inverts: Pyodide first, prompts verbatim, React deferred, and the wedge becomes "fidelity to upstream" — narrower, but more defensible to a specific set of users.
