# strands-agents/harness-sdk — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/strands-agents/harness-sdk |
| register row | none yet: promoted out of the long-tail sweep (`docs/research/competitors/_synthesis/05-long-tail-coverage.md:129`), whose filing note leaves the row to the Lead (`:296`) |
| licence | Apache-2.0; `gh api repos/strands-agents/harness-sdk --jq '.license.spdx_id'` returned it on 2026-10-21, the file is `LICENSE.APACHE:1` and `NOTICE:1` credits Amazon |
| read commit | `79e0f89b7f927795839daf78ed83e13f9cc83344`, 2026-10-21 12:18:36 -0400, subject `docs(agent-loop): recommend invocation limits for long-running agents (#5295)` |
| clone | `git clone --depth 1 https://github.com/strands-agents/harness-sdk reference/competitors/strands`; one commit, clean tree |
| stack | TypeScript ESM on Node >=22 (`strands-ts/package.json:296-297`); the root npm workspace contains only `strands-ts` (`package.json:8-10`); every provider client is an optional peer (`strands-ts/package.json:315`) |
| packages | `@strands-agents/sdk` is the TypeScript SDK, `@strands-agents/harness` is a composed agent over it, then the CLI and an MCP server; the Python pair is `strands-agents` and `strands-harness` |
| distributions | npm `1.21.0` (registry read 2026-10-21) and PyPI `1.61.1`; 20 TypeScript release tags since 2026-06-01 beside 85 Python tags since 2025-05-16 (GitHub releases API, 2026-10-21) |
| size signal | 277 TypeScript source files and 51,324 lines outside tests and fixtures, against 348 Python files and 60,773 lines under `src`; 3,369 files in the checkout |
| version read | `0.0.1-development` in tree (`strands-ts/package.json:3`), a placeholder stamped at publish; the published line is 1.21.0 |

## What it is

Strands is an in-process agent SDK pitched at the developer who would otherwise write the loop
by hand: "it runs in your process with no hosted control plane, and it covers the jobs a
hand-rolled loop grows into" (`README.md:39`). The repository is named for the harness, but the
product inside it is a full runtime: a model-driven tool loop, a tool contract, typed streaming
events, sessions and snapshots, multi-agent orchestration, model adapters, telemetry and a CLI.

One team writes the Python and TypeScript halves in one monorepo, and the governing ambiguity
is visible in the file names: `strands-ts` and `strands-py` are the SDKs, `harness-ts` and
`harness-py` are a thin "batteries-included agent in one call" composition over them
(`harness-ts/package.json:3`), and the CLI and MCP server sit beside both.

The centre of gravity is the loop in `strands-ts/src/agent/agent.ts` (2,912 lines). Everything
else is arranged around it: the tool executor, the hook bus, the middleware registry and the
session manager are all invoked from that one generator, and the pluggable pieces are
deliberately narrow interfaces rather than subclasses of the agent.

## Why it is in the register

The sweep's verdict was that this is the closest architectural peer after langchainjs: an
in-process, model-driven runtime with lifecycle controls comparable to our run result
(`docs/research/competitors/_synthesis/05-long-tail-coverage.md:125-132`). The point of the
profile is not the feature list, which the README already publishes, but the seam discipline:
where a second SDK with no hosted plane puts the boundary between loop and extension, and how
it prices the same controls we express as a step budget and a cancellation signal.

## One port or two implementations

The repository calls the TypeScript SDK "the TypeScript/JavaScript port of the Strands Agents
framework", mirroring Python concepts and names while staying idiomatic (`strands-ts/AGENTS.md:9`).
That is accurate as a statement of intent and misleading as a statement of engineering. The
two surfaces are hand-written, in two languages, with shared names and no shared code:

- The cross-SDK rules are prose, not generation: identifiers re-cased, single-word literals
  byte-identical, multi-word literals converted through explicit maps (`AGENTS.md`, the
  cross-SDK conventions section).
- The parity target is announced as a team property: one team implements features in all SDKs
  (`team/designs/0009-mono-repository.md:27`) and is "shooting for feature parity" (`:75`).
- Divergences are deliberate and documented per subsystem, so the port is a translation of
  concepts rather than of code. The clearest three: TypeScript is async-only with no sync
  facade while Python keeps thin sync wrappers (`strands-ts/AGENTS.md:210`, `strands-py/AGENTS.md:213`);
  cancellation is an `AbortSignal` in one language and cooperative asyncio in the other
  (`strands-py/AGENTS.md:215`); and structured output goes through a tool on the TypeScript side
  but is a provider method in Python (`strands-ts/AGENTS.md:176`).

The direction of authorship is not fixed, which is the strongest evidence that neither half is
a generated port. The proposal for a translation workflow says so outright: "No true source
language" (`team/designs/0012-strandslator-design.md:36`), translate completed features, prefer
idiomatic over literal (`:40`). The newest subsystem proves the flip in practice: the sandbox
was written in TypeScript and Python mirrors it, "Idiomatic divergences from the TypeScript
oracle" included (`strands-py/src/strands/sandbox/base.py:7-22`).

The cost is stated in the same proposal: N languages times M features is an N * M bill, and the
bottleneck is review rather than translation (`team/designs/0012-strandslator-design.md:11-13`).
Their answer is a portable core with an idiomatic surface: `FunctionTool` exists in both
languages, the `@tool` decorator is Python sugar over it (`:41`). Two years in, the bill shows:
Python began shipping stable releases on 2025-05-16, TypeScript on 2026-06-01, and the current
lines are 1.61.1 against 1.21.0. Feature coverage has converged; maturity has not.

For us the lesson is exact. A Python package would be a second native implementation of the
loop and every seam, not a thin wrapper, unless we first extract a language-neutral core we
could host twice. Their history prices that at a permanent second surface plus a review tax on
every feature, and it is only rational because parity is their product.

## How it is positioned against us

| family | strands | this port at the baseline |
|---|---|---|
| shape | in-process SDK with a hand-written loop, plus a harness, CLI and MCP server | library with one loop, pluggable executors and optional vendor peers |
| loop | model call, tool execution, repeat until no tool use; budgets are opt-in (`strands-ts/src/agent/agent.ts:1705-1715`) | loop bound fixed by a step budget with a typed error (RT-06) |
| lifecycle | run-level turn and token budgets, a 15-value stop reason, cooperative cancel, interrupt and checkpoint (`strands-ts/src/types/messages.ts:710-726`) | step budget, `AbortSignal`, typed errors (RT-06, RT-07, RT-10) |
| extension | hooks, middleware stages, interventions, plugins and lifecycle observers, layered explicitly | one middleware array around each step (RT-08) |
| tools | abstract generator-based `Tool`, concurrent by default, Zod or JSON Schema factory, direct invocation proxy | `tool()` returning a value or promise (TL-01, TL-04) |
| streaming | typed `AgentStreamEvent` union with hookable subclasses, plus model-level events | typed event stream folded into run events (RT-04, RT-09) |
| sessions | snapshot manager with latest plus immutable snapshots and three storage backends | `AgentSession` checkpoint in memory (RT-14, HL-04) |
| multi-agent | Graph, Swarm, A2A and an agent-as-tool bundle | managed agents called as tools (MA-01) |
| models | 5 provider families plus a router and a cache-aware config | 5 adapters, no retry or router (MD-01, MD-05) |
| sandbox | Docker, SSH and a local POSIX shell, shared by tools | a non-goal; executors instead (EX-05) |

## Where the depth sits

| area | depth | evidence |
|---|---|---|
| the loop | 2,912 lines, cycle bookkeeping, checkpoint and interrupt precedence | `strands-ts/src/agent/agent.ts:1705` |
| extension | 17 hook events, 3 middleware stages, 5 intervention actions | `strands-ts/src/hooks/index.ts:14-34`, `strands-ts/src/middleware/stages.ts:76` |
| durability | snapshot versions, strategies, three stores, restore paths | `strands-ts/src/session/session-manager.ts:29-60` |
| tool execution | concurrent race with per-tool order and failure isolation | `strands-ts/src/tools/executors/concurrent.ts:29-33` |
| providers | narrow 6-method base plus router and per-provider error mapping | `strands-ts/src/models/model.ts:312-359` |
| context | conversation manager, offload strategies, agentic compression, memory manager | `strands-ts/src/context-manager/presets.ts:21-31` |
| observability | OpenTelemetry tracer and meter with local trace trees always on | `strands-ts/src/telemetry/tracer.ts:1-13` |

## Limits of this read

- Read the TypeScript tree closely and the Python tree only where a parity or divergence claim
  needed it: the sandbox base, the model provider contract, the AGENTS guides and the design
  records. The Python loop was not traced.
- The website is linked from the README and was not fetched: `web_fetch` failed in this
  environment (two providers registered), so all documentation claims are declared-only.
- Vended tools, sandbox implementations, memory extraction and the CLI internals were listed,
  not read. Package manifests, workspace layout and release metadata were read.
- Nothing was installed, built, run or tested. No source, prompt or licence header was copied.

## Judgement

The transferable idea is the placement of the lifecycle controls: a request owns its budget and
its usage, a run ends with a reason from a small closed vocabulary, and continuation is passing
the context back. The pattern to copy is the deliberate layering of extension points, with
hooks kept outside middleware so a retry cannot corrupt observability. The pattern to avoid is
the accumulation of three overlapping interception systems; their own README concedes the
middleware is intended to supersede hooks eventually (`strands-ts/src/middleware/README.md:17-22`).
