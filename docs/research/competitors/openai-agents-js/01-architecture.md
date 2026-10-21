# openai-agents-js — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

| path | role |
|---|---|
| `packages/agents-core/` | runtime: agent, runner, tools, handoffs, guardrails, sessions, run state, tracing, errors, items |
| `packages/agents-openai/` | OpenAI provider: Responses and Chat Completions models, hosted tools, tracing exporter, conversations and compaction sessions, websocket transport |
| `packages/agents-extensions/` | adapters for external model and UI stacks; the second largest package by source volume |
| `packages/agents-realtime/` | realtime and voice sessions, transports and audio handling |
| `packages/agents/` | convenience bundle that re-exports core and OpenAI and installs defaults at import |
| `examples/` | 24 runnable projects, including agent patterns, sandbox, MCP, memory and realtime demos |
| `integration-tests/` | live-API suites, separate from the unit configuration |
| `.agents/` | maintainer skills and 18 architecture references that name the invariant per subsystem |
| the documentation site | Astro/Starlight sources in the clone, published at https://openai.github.io/openai-agents-js/ |

Dependency direction is a ladder, not a mesh: `agents-core` depends on no sibling, `agents-openai`, `agents-extensions` and `agents-realtime` each declare a workspace dependency on core alone (`packages/agents-extensions/package.json`, `packages/agents-realtime/package.json`), and the bundle depends on core and OpenAI.

## Core abstractions

| concept | where | what it owns |
|---|---|---|
| `run()` and `Runner` | `packages/agents-core/src/run.ts:599`, `:627`, `:723` | entry points; a config type at `:316` and shared per-run options at `:462` |
| `Agent` | `packages/agents-core/src/agent.ts:520` | instructions, tools, handoffs, guardrails, output type, model settings, clone and `asTool()` at `:765` |
| `Model` and `ModelProvider` | `packages/agents-core/src/model.ts:688`, `:722` | two required methods, optional retry advice; request at `:545` and response at `:651` |
| `Tool` | `packages/agents-core/src/tool.ts:1484` | union of function and hosted tools; `tool()` factory at `:2287`, hosted shapes from `:1387` |
| `Handoff` | `packages/agents-core/src/handoff.ts:160` | transfer tool name, description, input schema, filter, enablement, target agent |
| `RunState` | `packages/agents-core/src/runState.ts` | durable snapshot: schema version, current step, items, approvals, pending input, usage, conversation ids |
| `RunContext` | `packages/agents-core/src/runContext.ts` | per-run context, usage, approval records, forked child contexts at `:1496` and `:1506` |
| `Session` | `packages/agents-core/src/memory/session.ts` | history storage plus optional capability interfaces, with guards at `:275` to `:295` |
| `RunResult` and `StreamedRunResult` | `packages/agents-core/src/result.ts:52`, `:303` | new items, raw responses, usage, final output, guardrail results, stream |
| `RunStreamEvent` | `packages/agents-core/src/events.ts:80` | union of raw model events, run-item events and agent-updated events |
| tracing | `packages/agents-core/src/tracing/processor.ts:25`, `:67`; `spans.ts:174`; `provider.ts:34` | processors, exporters, spans and the global provider |
| hooks | `packages/agents-core/src/lifecycle.ts:101`, `:173` | event emitters on agents and on the runner for five lifecycle moments |

## Agent configuration

An `Agent` is a small, declarative object plus two escape hatches. The constructor validates the output type and defaults `toolUseBehavior` and `resetToolChoice` (`packages/agents-core/src/agent.ts:596` to `:618`), and warns when a handoff target's output type cannot be merged into the caller's (`:636`). The fields that matter for this dive:

- `instructions` accepts a string or an async function of context and agent, so instructions can be computed per run.
- `handoffs` accepts agents or `Handoff` objects, and additional handoffs can be attached per run through the runner config.
- `tools` mixes function tools, hosted tools and MCP tool sets; `mcpServers` is configuration for server discovery.
- `inputGuardrails` and `outputGuardrails` are lists; the output list runs only against the run's selected final output.
- `outputType` takes Zod v3 or v4, a Standard Schema or a plain JSON Schema, and drives the model-facing schema; whether a local parse of the final answer happens was not traced.
- `toolUseBehavior` chooses whether a tool result ends the run: run the model again, stop on the first tool, stop at named tools, or delegate to a function.
- `clone()` copies the configuration, which is how adapters and wrappers derive an agent without mutating the original.

## One run, walked

1. The caller invokes `run(agent, input, options)` or a `Runner` instance; the options type fixes the streaming decision at compile time (`packages/agents-core/src/run.ts:491` and `:504`).
2. Configuration defaults resolve lazily: the default model provider is looked up on first use (`run.ts:526`).
3. A `RunState` is created for a fresh input, or rebuilt from a serialized snapshot for a resume.
4. The loop opens with `while (true)` at `run.ts:1655`.
5. A resume or pending-interruption branch is taken before turn preparation (`run.ts:1675`).
6. `prepareTurn` (`packages/agents-core/src/runner/turnPreparation.ts:130`) checks the turn budget at `:155`, increments the turn at `:334`, runs first-turn input guardrails at `:281` and splits blocking from parallel work at `:264`.
7. The model request is assembled (`run.ts:1955`) and any guardrail failure is raised before the call (`:1911`).
8. The model is called with retry handling (`run.ts:2024`) and usage is accumulated (`:2068`).
9. The response becomes items (`run.ts:2084`), and parallel guardrails are awaited before anything commits (`:2129`).
10. The turn is resolved (`run.ts:2134`): tools run, handoffs transfer, or a final output is found; the result is applied (`:2155`).
11. New items are pushed to the stream and, when a session is configured, persisted for the turn.
12. The current step decides the next iteration (`run.ts:2195`): run again at `:1811`, continue with the new agent after a handoff, finalize at `:1520` with output guardrails at `:1540`, or pause on an interruption.
13. A streaming run delivers events through `StreamedRunResult._addItem` (`packages/agents-core/src/result.ts:470`); completion, error and cancellation each settle the same queue (`:501`, `:516`, `:561`).
14. Aborts and turn exhaustion terminate through typed errors rather than silent returns (`run.ts:2181`).
15. Resuming calls `RunState.fromString` (`packages/agents-core/src/runState.ts:3504`), which rehydrates the agent graph, approvals and pending input before the loop continues.

## Turn accounting

A turn is admitted, not merely begun. `RunState._currentTurn` increments when preparation starts, and the runner rolls that increment back if the model request never begins (`packages/agents-core/src/run.ts:545` and `:552`), so a resumed state carries only admitted turns. The public counter documents the same rule and the cases that leave it at zero — a turn-limit throw or a first-turn guardrail trip (`packages/agents-core/src/result.ts:339` to `:356`). The default budget is ten (`packages/agents-core/src/runner/constants.ts:2`), and exhaustion raises `MaxTurnsExceededError` (`errors.ts:38`).

## State and persistence model

`RunState` is one versioned JSON document. The schema version is a literal, `1.23`, with a supported list running back to `1.0` (`packages/agents-core/src/runState.ts:195` and `:196`). Serialization is `toJSON` (`:3218`) and `toString` (`:3489`); tracing API keys are omitted unless the caller opts in. Deserialization rejects unsupported versions with an instruction to reserialize (`:3544`). Older snapshots that lack a newer field are handled by per-version guards that either reconstruct or fail closed, for example the pending-session-write and output-ownership checks.

Approval state is part of the document. `getInterruptions` returns the pending items (`runState.ts:3090`); `approve` and `reject` delegate to the run context (`:3168`, `:3195`), which records per-call decisions, sticky decisions, rejection messages and a fingerprint of the invocation that was approved (`packages/agents-core/src/runContext.ts:1297`, `:1343`, `:405`). A reused call id with a different invocation is rejected, which closes the obvious replay hole.

History lives behind `Session`: `getSessionId`, `getItems`, `addItems`, `popItem` and `clearSession`, plus optional capability interfaces for context-aware sessions, history rewrites, idempotent transactions and compaction (`packages/agents-core/src/memory/session.ts:265` to `:303`). The runner writes through a persistence tracker (`packages/agents-core/src/runner/sessionPersistence.ts:1084`) with explicit save steps (`:1654`) and input preparation (`:1876`).

Three session implementations ship: `MemorySession` (`packages/agents-core/src/memory/memorySession.ts:25`), `OpenAIConversationsSession` (`packages/agents-openai/src/memory/openaiConversationsSession.ts:31`) and `OpenAIResponsesCompactionSession` (`packages/agents-openai/src/memory/openaiResponsesCompactionSession.ts:131`). A file store and a Prisma store exist only under `examples/`, which is the evidence for the durability comparison in `03-gap-and-lessons.md`.

Conversation state has five ownership strategies rather than one: explicit history replay, a `Session`, a server conversation id, a previous response id, or a resumed `RunState`. A filtered handoff cannot be combined with the two server-managed ids (`packages/agents-core/src/run.ts:338`; the filter contract is documented at `handoff.ts:217`).

## Transport and streaming

The model seam is deliberately small: `getResponse` returns a complete response and `getStreamedResponse` returns an async iterable of provider events (`packages/agents-core/src/model.ts:701` and `:707`). The runner wraps each provider event in `RunRawModelStreamEvent` and preserves its source (`packages/agents-core/src/events.ts:18`); the OpenAI adapter narrows that type to a discriminant of `openai-responses` or `openai-chat-completions` (`packages/agents-openai/src/rawModelEvents.ts:9` to `:15`).

Run-item events are derived from item classes rather than emitted ad hoc: a mapping from `RunItem` subclass to event name lives in `packages/agents-core/src/runner/streaming.ts:20` to `:56`. A separate event announces an agent change (`events.ts:68`). The stream result exposes `toStream()`, an async iterator, a `completed` promise, `toTextStream()` and cancellation (`packages/agents-core/src/result.ts:569`, `:577`, `:595`, `:561`); text streaming forwards only `output_text_delta` (`:600`). Agent tools that stream into a parent run get a bounded pending-event buffer so a slow consumer cannot grow memory without limit (`result.ts:470` to `:487`).

Tracing runs beside the loop rather than through it: the runner creates a trace and per-turn spans through `TraceProvider` (`packages/agents-core/src/tracing/provider.ts:199`, `:224`), and processors receive start and end callbacks. Span data is a closed union of types such as agent, task, turn, function, generation, handoff, guardrail and MCP tool listing (`packages/agents-core/src/tracing/spans.ts:142` to `:155`).

## Run items and results

Everything the runner produces is a `RunItem` subclass, and the stream is a projection of those classes: message output, tool call, tool output, handoff call, handoff output, reasoning item, approval item, tool-search call and output, and compaction item (`packages/agents-core/src/runner/streaming.ts:3` to `:15`). A result exposes the generated items, the raw model responses, guardrail results per kind, the final output, the `RunState` and the usage (`packages/agents-core/src/result.ts:52` to `:117`). That single vocabulary is why persistence, streaming and tracing can all read the same objects.

## Lifecycle hooks

Two typed emitters carry the observability seam for application code: `AgentHooks` on an agent and `RunHooks` on the runner, each publishing `agent_start`, `agent_end`, `agent_handoff`, `agent_tool_start` and `agent_tool_end` (`packages/agents-core/src/lifecycle.ts:110` to `:167`). The runner extends `RunHooks` (`run.ts:627`), so `runner.on(...)` observes every run it executes. A handoff emits on both objects (`packages/agents-core/src/runner/toolExecution.ts:2834` and `:2835`), which is how a host can attribute a transition to either side.

## What the runtime does not own

- No HTTP surface, no UI and no deployment story: the packages are a library and the examples bring their own process.
- No provider routing beyond a `ModelProvider` lookup by model name (`packages/agents-core/src/model.ts:722`).
- No database client in core: storage arrives as a `Session` or a serialized snapshot supplied by the application.
- No sandbox: workspace and process execution live in a separate subsystem with provider clients, outside the turn loop.

## Package scripts and gates

The root manifest separates concerns rather than offering one `test` verb: `build` runs `tsc-multi` and then a per-package bundling pass, `test` runs Vitest in the `full` mode, `test:review` runs a narrower mode, and a second configuration drives `integration-tests` against live APIs. Package manifests add `build-check` as a no-emit type check and `dist:check` against built declarations (`packages/agents-core/package.json:10` to `:15`). A released-API contract can be produced from source, from dist or from a packed tarball and then promoted, which is how the repository detects a public-surface change before publication. `test:examples` build-checks every example project, and a local Verdaccio registry script supports installing the packed packages.

CI configuration for these scripts exists in `.github/`; whether it passed at the read commit was not checked, and no workflow was executed here.

## Runtime portability

Portability is a shim layer rather than a build target. Timers, streams, ids and event emitters come from `@openai/agents-core/_shims` (`packages/agents-core/src/tracing/processor.ts:7`; `packages/agents-core/src/result.ts:12`), and a runtime capability flag decides whether a tracing export loop can start at all (`processor.ts:154`), with a manual flush path when it cannot. Node stream compatibility is an adapter over the web stream rather than a second implementation (`result.ts:617`).

The declared environments are Node 22 or later, Deno and Bun, with Cloudflare Workers experimental (`README.md:25` to `:35`). Whether the tracing loop, websockets or sandbox providers behave on each of them is declared, not observed.

## Structural pressures

Two files absorb most of the durability complexity: `run.ts` at 3,868 lines and `runState.ts` at 7,577. The `runner/` split keeps orchestration readable, but these two remain the places where a change is hardest to review.

The compatibility ladder is visible as code, not just as a version list: per-version predicates such as `schemaVersionSupportsV118State` (`runState.ts:225` to `:268`) and a run of version-gated errors that name the current schema in their repair text (`:3544` to `:3937`). That is the price of resuming snapshots written by older releases.

The docs, examples and reference files are maintained in the same repository as the runtime, which is why the contributor guide can require a docs page, a snippet source and a changeset for one behaviour change. The cost is a large surface where prose and code can drift; the benefit is that the reference files are close enough to the loop to be checked against it.

## Error taxonomy

One base class, one leaf per failure the caller can act on: `MaxTurnsExceededError`, `ModelRefusalError`, `ModelBehaviorError`, `ModelTimeoutError`, `InvalidToolInputError`, `InvalidToolOutputError`, `GuardrailExecutionError`, `ToolCallError` and `ToolTimeoutError`, all under `AgentsError` (`packages/agents-core/src/errors.ts:33` to `:193`). Tripwire failures are separate classes raised from the guardrail path, which lets a caller distinguish a policy stop from a bug.

## Build and test stack

Root scripts build with `tsc-multi` and then bundle per package (`package.json` at the clone root); package scripts add a no-emit type check and a dist type check. Tests run through Vitest in named modes — `full`, `review` and a separate integration configuration for live APIs — and the repository also gates a released-API contract in source, dist and packed forms. Examples are build-checked with `test:examples`, and a local Verdaccio registry supports package-level verification. CI configuration exists but no run was observed here.

Three structural choices are worth naming. `run.ts` stays orchestration while `runner/` holds turn preparation, guardrails, tool execution, streaming, session persistence and reconciliation. Item vocabulary comes from Zod protocol schemas in `packages/agents-core/src/types/protocol.ts`, so persistence, adapters and streams agree on one shape. A `_shims` layer isolates timers, streams and ids so the same core runs on Node, Deno, Bun and Workers.

Test volume is concentrated where the invariants are: `agents-core` carries 165 of the 246 test files. The repository's own contributor guide names `ScriptedModel`, `ScriptedRealtimeTransport` and a scripted sandbox session as the preferred doubles, which the presence of `packages/agents-core/src/testing/scriptedModel.ts` confirms.

None of this was executed in this read: the statements above are read from scripts and configuration, not from a build. `integration-tests/` needs credentials that the read did not use.