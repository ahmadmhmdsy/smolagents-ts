# openai-agents-js — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/openai/openai-agents-js |
| register row | Tier 1, depth D3, slug `openai-agents-js`; recorded focus is handoffs, guardrails, sessions, tracing and the tool loop; wave 1 |
| licence | SPDX `MIT` according to the GitHub licence API, and the clone's `LICENSE` file is the MIT text |
| read commit | `304e436185ad5d7e54d240896efa728533147cf3`, committed 2026-10-20 14:56:32 -0700, subject `chore: update versions (#2061)` |
| read date | 2026-10-21 |
| clone | `reference/competitors/openai-agents-js`, shallow (`--depth 1`), worktree clean at the read |
| published version | `0.21.0` in each of the five package manifests |
| language and stack | TypeScript emitted twice, CommonJS and ESM, by `tsc-multi`; pnpm workspace; Vitest; Node 22 or later, Deno and Bun, with Cloudflare Workers marked experimental |
| size signal | `agents-core` has 220 source files and 85,563 lines; `agents-extensions` 53 and 26,603; `agents-openai` 33 and 11,503; `agents-realtime` 26 and 8,404; the `agents` bundle 8 and 41; 246 test files across the packages |
| surrounding material | 124 MDX pages in the docs site, 24 runnable example projects, and 18 maintainer architecture references under `.agents/references/` |
| documentation source | the docs site source ships in the clone and is published at https://openai.github.io/openai-agents-js/ |

## The five packages

| package | role | weight |
|---|---|---|
| `@openai/agents-core` | the runtime: loop, agent, tools, handoffs, guardrails, sessions, state, tracing | 65 per cent of source lines |
| `@openai/agents-openai` | OpenAI models, hosted tools, tracing exporter, server sessions | 9 per cent |
| `@openai/agents-extensions` | adapters to external model and UI stacks | 20 per cent |
| `@openai/agents-realtime` | voice and realtime sessions, transports, audio | 6 per cent |
| `@openai/agents` | convenience bundle: re-exports plus import-time defaults | 41 lines |

The weighting is the story: this is a core runtime with thin provider edges, not a federation of equal packages. Both extensions and realtime declare a workspace dependency on core only.

## What it is

An SDK for multi-agent workflows in TypeScript. Progress is counted in turns: one model request, then resolution of whatever the model asked for — tool calls, a transfer to another agent, or a final answer — then another turn or the end of the run. `Agent` holds configuration; a `Runner` owns the loop, the turn budget, approvals, session writes and tracing.

Two delegation mechanisms ship side by side. A handoff turns control over to another agent through a transfer tool, so the receiving agent continues the same conversation. `agent.asTool()` instead runs a nested agent inside a tool call and hands a value back to the caller. Both keep the run's approval surface: an interruption raised inside either one pauses the outer run.

Around that core sit an OpenAI adapter for the Responses and Chat Completions APIs with retry advice, a tracing subsystem with batch processors and an ingest exporter, server-managed conversation sessions plus a compaction decorator, a sandbox-agent product with filesystem workspaces, and a realtime voice package. The `agents` bundle is deliberately convenient: importing it installs a default model provider and the OpenAI tracing exporter as a side effect, so a quickstart works from one environment variable.

## Why it is in the register

The register row names handoffs, guardrails, sessions, tracing and the tool loop, and each of those benchmarks a live cell of ours:

- handoffs — `MA-02` records the capability as absent here, which makes this the mature implementation to study before a transfer action is designed.
- agents as tools — `MA-01` and `MA-03` sit on a nested-run seam whose child result is a bare string today.
- guardrails — `GR-01` has a single awaited checkpoint; this repository evaluates guardrails concurrently and reports tripwires with typed errors.
- sessions and durability — `HL-02`, `HL-04`, `HL-09` and `HL-10` are our thinnest rows, and this repository maintains a release-tracked serialization schema for paused runs.
- tracing — `OB-01`, `OB-02`, `OB-03` and `OB-07` cover span shape, export, attributes and pluggability.
- tool loop and schemas — `TL-01` and `TL-05` are narrower than the schema, strictness and timeout surface recorded here.

## How it is positioned against us

A platform-shaped SDK from the model vendor: their provider, their tracing backend, and a one-key quickstart. This port is library-shaped: the model authors a program that a sandbox executes, the core is isomorphic, and the seams belong to us. Their maintainer references are written for a runtime that must stay wire-compatible with a hosted API; ours are written for a runtime that has to run in a browser tab.

| family | openai-agents-js | this port at the baseline |
|---|---|---|
| action space | the model emits tool calls and handoffs as JSON function calls | the model authors a program executed in a sandbox |
| orchestration | handoff transfer plus nested agent tools | managed agents only |
| durability | release-tracked `RunState` envelope, resumable across processes | step checkpoint in an in-memory store |
| session memory | `Session` plus capability interfaces and a compaction decorator | one checkpoint object per conversation |
| guardrails | parallel input and output guardrails, typed tripwires | one awaited input and one awaited output check |
| structured output | Zod, Standard Schema or JSON Schema, strict by default | a Zod output schema |
| tracing | processors, exporters, span taxonomy, OpenAI ingest | local span fold, no exporter |
| model seam | two required methods, optional retry advice | five adapters plus a function model |
| hosting | OpenAI APIs first class, with an extensions package for other stacks | provider-agnostic adapters |
| runtime | Node, Deno, Bun, Workers experimental | Node, Bun, Deno and the browser |

The distance that matters for us is not the feature list but the state model. Their answer to a paused, resumable, inspectable run is a versioned document with an ownership model; ours is a step array in memory. The dive files price that difference rather than celebrating it.

## Evidence strength of this read

| strength | what it covers here |
|---|---|
| implemented | turn loop, handoffs, agent tools, guardrails, approvals, sessions, `RunState`, tracing, tool schemas, streaming events — each traced from entry point to the code that acts |
| declared | realtime and sandbox scope, the extensions adapters, CI behaviour at the commit, published artefacts |
| inferred | performance characteristics, why particular compatibility branches exist, how much of the code paths tests actually cover |

Where a claim rests on a type or a doc comment rather than a traced path, the dive file says so. Where a doc comment and the code disagree, the code is recorded.

## Map of this dive

| file | answers |
|---|---|
| `01-architecture.md` | how the repository is laid out, what each abstraction owns, one run end to end, how state and streams work |
| `02-features-inventory.md` | one row per capability with status, evidence and the reason it exists |
| `03-gap-and-lessons.md` | the gap table bucketed against the baseline, patterns to copy, patterns to avoid |
| `04-sources.md` | commit, URLs, files read, commands run, what was not verified, how to refresh |

## Limits of this read

- Static reading only. Nothing was installed, built, tested or executed and no example was run, so runtime behaviour rests on source and types rather than observation.
- Attention concentrated on `agents-core` — loop, handoffs, guardrails, sessions, `RunState`, tracing, tools — with `agents-openai` covering the adapter, tracing exporter and sessions.
- `agents-realtime`, most of `agents-extensions`, the sandbox subsystem and the examples tree were located and sized but not read line by line; remarks touching them are marked inferred or omitted.
- The docs site's human-in-the-loop page was read in full for the public approval story; the other 123 pages were located but not read.
- Line numbers are pinned to the commit above. A later commit invalidates the pointers, not the architecture.
- The licence command in the brief had a doubled path segment; the corrected command and its output are recorded in `04-sources.md`.
