# 01 — Project specification

**Contract**
- **Role:** spec — what we are building and why.
- **Mutability:** approval-only. Changes require the owner's decision.
- **Read when:** before any feature, architecture, or scope work.
- **Update when:** the owner approves a spec change. Then append a revision
  entry at the bottom; never silently rewrite history.

---

## Purpose

`smolagents-ts` is an unofficial TypeScript agent library in which the agent's
action is a program, for people who build agents in Node, in a browser tab, in
Bun or in Deno.

## Problem

The reference implementation it follows, Hugging Face `smolagents`, is Python
only. A JavaScript team that wants the same idea has to re-derive the loop, the
prompt semantics and the step vocabulary from scratch, and silently loses the
fidelity guarantees that make upstream's behaviour predictable.

Three parts are hard to get right independently:

- TypeScript types are erased at runtime, so a tool's contract needs a runtime
  representation. This project uses `zod` with Standard Schema compatibility
  rather than decorators, reflection or a compiler plugin.
- Most JavaScript agent libraries assume Node, which makes a browser tab a
  rewrite instead of a target.
- A run is not a chat. Upstream's UI renders typed steps, and a chat transcript
  cannot be reconstructed into one after the fact.

## Users and consumers

| Consumer | What they need from this project |
|---|---|
| an application developer in Node or a bundler-based web app | one package whose `CodeAgent` runs a model-generated program against declared tools and returns a typed result |
| a React developer building a run inspector | L2 hooks and L3 headless primitives over `AgentSession`, with no React dependency inside the core |
| someone porting from upstream `smolagents` | the upstream class, step and error vocabulary, and prompts re-authored rule by rule |
| a contributor to this repository | a contract to build against: the design record, the plans, and one command that proves a change |

## Scope — in

- The v1 sub-projects S0 to S6 and S1.5 of the design record: foundations, core
  runtime, model layer, tool system, code execution, React layer, distribution.
- One isomorphic library, published as `@smolagents-ts/core` plus the model,
  tool, executor and React layers.
- Isomorphic execution: the ECMA-262 language plus the ECMA-429 minimum common
  web API subset, so the same code runs on Node, Bun, Deno and a browser.
- Fidelity to upstream vocabulary and prompt semantics, with the few deliberate
  divergences recorded rather than discovered.

## Non-goals — out

- A finished visual design or a UI kit; L4 patterns and L5 styled components are
  later work.
- A Python execution environment; `exec-pyodide` is v1.5 and needs a decision
  first.
- A server framework, a deployment platform or a hosting product.
- A Hub client or a model-hosting service.
- An "improved" rewrite of upstream semantics. Where upstream is opinionated,
  the opinion is ported and documented.

## Success criteria

Pre-registered on 2026-10-12 in the design record, before any of them was
measured.

| # | Criterion | How it is evaluated | Threshold |
|---|---|---|---|
| G1 | one package installs and runs a CodeAgent in Node and in a browser | a twelve-line example, both targets | it runs in both, with no `node:` import inside the core |
| G2 | the action language is code, sandboxed by construction | a CodeAgent run whose generated JavaScript executes in QuickJS | the default executor is QuickJS, not `eval` |
| G3 | upstream vocabulary and prompt semantics survive the port | a name diff against upstream plus the prompt-fidelity checklist test | every ported name is present and the checklist test passes |
| G4 | the core is framework-agnostic and isomorphic | `pnpm depcruise` and `packages/core/test/architecture-guard.test.ts` | zero violations and no `node:` import under `packages/core/src` |
| G5 | a run inspector and a chat surface are both buildable from shipped primitives | composing the L3 primitives in `packages/react` | both render from `AgentSession` alone |
| G6 | behaviour is verifiable against upstream | ported suites plus golden transcripts driven by `MockModel` | the full gate is green at the revision under test |
| G7 | the library extends without forking | middleware, component overrides, and the executor, model and tool seams | every seam has a documented extension point |

These are the goals of v1 as a whole. S1 reaches G4 and G6 for the core runtime
only; the rest follow the milestones below.

## Constraints

- **Technical:** Node `>=22.12` (`engines`) and pnpm 12.3.4, which is the
  `packageManager` field and the single source of truth CI reads. TypeScript 6,
  ESM only. CI runs the gate on Node 22, 24 and 26, and a runtime smoke on Node,
  Bun and Deno.
- **Operational:** the whole gate runs offline. No credential is needed to
  build, test or pack this repository.
- **Legal or policy:** Apache-2.0, a derivative of upstream `smolagents`. The
  project keeps upstream's licence text verbatim, a `NOTICE` recording the
  derivation, a disclaimer on line one of `README.md`, and `docs/attribution.md`
  mapping modules to the upstream files they came from.
- **Time or budget:** none stated.

## Key components

| Package | What it owns |
|---|---|
| `@smolagents-ts/core` | the ReAct loop (`CodeAgent`, `ToolCallingAgent`), memory and steps, the event stream, typed errors, the prompt templates, the tool and executor interfaces, `AgentSession`, middleware, the `Monitor`, and the testing doubles |
| `@smolagents-ts/models` | the `Model` seam and its provider adapters |
| `@smolagents-ts/tools` | the `tool()` ecosystem and default tools |
| `@smolagents-ts/exec-quickjs` | a `CodeExecutor` implemented on QuickJS-WASM |
| `@smolagents-ts/react` | L2 hooks and L3 headless primitives over `AgentSession` |

Data moves one way through a run: the model returns text, the parser extracts a
code block, a `CodeExecutor` runs it against the tool registry, the observation
is folded into memory as a step, the loop repeats until the final answer, and
the `AgentEvent` stream reports each transition to whoever is watching.

## Milestones

Definitions from the design record's roadmap; status from the newest handoff
entry.

| # | Milestone | Definition of reached | Status |
|---|---|---|---|
| S0 | Foundations | pnpm monorepo, TypeScript and Vitest configuration, changesets, publint/attw and pack-smoke CI, licence and notice, boundary rules | done |
| S1 | Core runtime | loop, memory, steps, events, RunResult, errors, monitoring, prompts, AgentSession, middleware | done |
| S2 | Model layer | the `Model` interface plus OpenAI-compatible, Anthropic, Gemini and Hugging Face adapters | done |
| S3 | Tool system | the `tool()` ecosystem, `ToolCollection`, default tools | done |
| S4 | Code execution | `CodeExecutor` implementations, `exec-quickjs`, final-answer bridging, async tool-call bridging | done |
| S5 | React layer | L2 hooks, L3 headless primitives, examples | done |
| S6 | Distribution | public publish, CLI, MCP, remote executors, `exec-pyodide`, docs site, L4/L5 | in_progress |
| S1.5 | Parity harness | Python-to-TypeScript differential tests | pending |

S5's hooks and primitives are done; the runnable example its definition also
names waits on T-13, which picks where it runs. S6's v1 share is done: the six
packages carry the metadata a registry reads, the facade re-exports them, the
packed tarballs install and import, and 0.1.0 is cut. The CLI, MCP, the remote
executors, `exec-pyodide`, the docs site and L4/L5 are T-13's.

## Risks and mitigations

| Risk | Impact | Likelihood | Mitigation |
|---|---|---|---|
| QuickJS async tool-call bridging is harder than expected | high | medium | spike before S4; the fallback ladder in the design record section 9.3; the executor seam keeps the choice reversible |
| Bundle size taken by Zod | low | medium | target under 10 kB min+gzip excluding Zod, with Zod a peer-installable dependency |
| upstream moves while the port is in flight | medium | medium | the port is pinned to one upstream commit, recorded in the design record |

The full risk register, with owners, is the design record's section 15.

## Open questions — user-gated

- [x] Which sub-project follows S1: S2 (model layer) or S4 (code execution)?
      Answered by the owner on 2026-10-13: S2, on the completion report's
      argument that the ToolCallingAgent gaps make it the more useful next step.
- [x] Do the ToolCallingAgent gaps belong inside S2, or in a milestone of their
      own? Inside S2: a provider adapter is what makes those gaps observable
      against real traffic, so the milestone that adds the adapter is the
      milestone that closes them. Tracked as T-2 in `docs/04-tasks.md`.

## Revision log

Append-only. Newest last.

| Date | Revision | Decision | Authorized by |
|---|---|---|---|
| 2026-10-12 | initial | created from the pack template, transcribed from the v1 design record | maintainer |
| 2026-10-13 | 2 | context pack adopted; spec transcribed without new scope | maintainer |
| 2026-10-13 | 3 | owner chose S2 after S1 and placed the ToolCallingAgent gaps inside it; both open questions above closed; no other scope change | owner |
| 2026-10-13 | 4 | S2 split into S2a (model seam, OpenAI-compatible adapter, custom escape hatch) and S2b (the other three adapters); the S2a plan is written and no code has been executed from it | maintainer |
