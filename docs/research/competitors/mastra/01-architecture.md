# mastra — architecture

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository layout

The workspace is a pnpm monorepo with Turborepo orchestration, and the clone states that
in its root `AGENTS.md`. The parts that matter for this dive:

| path | contents |
|---|---|
| `packages/core/src/agent/` | `Agent` class, option types, message list, trip-wire error, tool approval helpers |
| `packages/core/src/loop/` | loop entry, the workflow-backed agentic loop builder, chunk stream, tool-call step, network loop |
| `packages/core/src/workflows/` | step contract, workflow class, in-process engine, evented engine, scheduler, state reader |
| `packages/core/src/processors/` | processor contract, runner, retry budget, stability defaults, built-in processors, memory processors |
| `packages/core/src/memory/` | base memory class, config types, message-history config |
| `packages/core/src/evals/` | scorer contract and builders, run-evals entry point |
| `packages/core/src/datasets/` | datasets, snapshots, experiments and comparison analytics |
| `packages/core/src/storage/` | storage domains (workflows, memory), snapshot helpers, run fencing |
| `packages/core/src/mcp/` | server base types shared by the MCP package |
| `packages/memory/` | the `Memory` implementation, observational-memory processors, memory tools |
| `packages/mcp/` | MCP client, MCP server, shared protocol helpers, conformance harness |
| `packages/evals/` | prebuilt LLM and code scorer catalogue |

The dependency direction is core outward: `packages/core` defines the contracts, and
`packages/memory`, `packages/mcp` and `packages/evals` implement them. Memory is injected
into an agent as processors, so `packages/memory` is a consumer of the processor contract
rather than a branch inside the loop.

## Core abstractions

### Agent and its options

`Agent` takes one large options bag. Agent-level options (model, instructions, memory,
scorers, processors, `maxSteps`, `stopWhen`, `requireToolApproval`, delegation hooks) are
declared at `packages/core/src/agent/agent.types.ts:460` onward, and most of them are
repeatable per call: the same file declares a call-level type with `memory` at `:616`,
`maxSteps` at `:663`, processors at `:690`, scorers at `:715`, `requireToolApproval` at
`:760`, `toolCallConcurrency` at `:782` and delegation at `:816`. Per-call options override
agent-level ones, which is how a caller changes model, memory thread or guardrails for a
single request without rebuilding the agent.

### The loop is a workflow

`packages/core/src/loop/loop.ts:15` exports `loop()`, which produces a `MastraModelOutput`
and hands execution to `workflowLoopStream` at `:144`. The loop builder at
`packages/core/src/loop/loop-builder.ts:85` composes one iteration workflow from steps:
execution, tool-call mapping, a `foreach` over tool calls, the mapping step that folds tool
results back into messages, a background-task check, a signal drain, a task-completion
check and a goal step (`:349` to `:419`). That iteration workflow is wrapped in a `dowhile`
whose predicate decides whether to continue (`:759`). Two consequences follow: an agent
turn inherits workflow durability, and loop control (stop conditions, retries, completion
scoring) is expressed as a workflow predicate rather than a bare `while` in code.

Which engine drives it is a substitution point: `workflowFactory()` at `loop-builder.ts:126`
returns either the ordinary workflow factory or the evented one, so the durable-agent mode
changes the executor, not the loop shape.

### Step, workflow, engine

A step declares input, output, resume and suspend schemas plus an `execute` function that
receives `suspend`, `resumeData`, `suspendData`, `state`, `writer` and an abort signal
(`packages/core/src/workflows/step.ts:150`). `suspend()` returns a branded value that only the
framework can produce, so a step that pauses cannot accidentally return a lookalike.

The engine contract is a single `execute` call that carries `resume`, `restart` and
`timeTravel` inputs (`packages/core/src/workflows/execution-engine.ts:225`). An in-process
engine lives at `packages/core/src/workflows/default.ts`; an evented engine lives under
`packages/core/src/workflows/evented/`. `createWorkflow` switches to the evented engine when
a workflow declares `schedule` and `MASTRA_WORKERS` is set (`packages/core/src/workflows/create.ts:61`),
and warns when it does so. The engine also receives the policy objects: a snapshot
persistence predicate (`execution-engine.ts:38`), a pruning hook (`:60`) and a flag that
excuses resumes without a persisted claim (`:44`).

### Run and snapshot

A run is identified by `runId`, optionally by `resourceId`, and is materialised from a
snapshot when one exists: `createRun` loads it at `packages/core/src/workflows/workflow.ts:3029`
and writes it at `:3054`. The snapshot is one document holding step results keyed by step
id, the active and waiting paths, suspended paths, resume labels, the serialised step graph,
the status and the request context (`packages/core/src/storage/workflow-snapshot.ts:44`).
The same file shows how partial writes merge into an existing document, including reset
markers for `foreach` iterations (`:60` onward).

A process that drives a run takes a lease: `claimWorkflowRunOwnership` calls
`claimRunOwnership` and renews it on a timer (`packages/core/src/workflows/run-ownership.ts:24`,
`:46`), so a boot-time sweep on another replica can tell an orphaned run from a live one.
Stores that cannot fence return a no-op handle (`:35`).

### Memory

`Memory` extends a base class that declares the storage-facing operations and the processor
providers (`packages/core/src/memory/memory.ts:543` onward). Threads are records scoped by a
resource, created at `:568`, and the working-memory operations are abstract at `:694` to
`:754`. The concrete implementation is `packages/memory/src/index.ts:480`, with `recall` at
`:801`, working-memory update at `:1271`, atomic merge at `:1365`, thread clone at `:3434`
and processor providers at `:4144`.

### Processor

A processor implements any subset of the hooks declared in `packages/core/src/processors/index.ts`:
input, input step, LLM request and response, output stream, output step, tool result, output
result, API error, plus state-signal computation, a state lane, an ordering index, a
violation callback and Mastra registration (`:626` to `:862`). The runner invokes them in
order and converts `abort()` into a `TripWire` (`packages/core/src/processors/runner.ts:633`).
A processor may also be a workflow, which is how they compose sequentially and in parallel.

### Scorer

`createScorer` (`packages/core/src/evals/base.ts:1984`) returns an immutable builder of type
`MastraScorer` (`:753`) with four ordered steps: `preprocess`, `analyze`, `generateScore`,
`generateReason` (`:307`). Each step is a function or a prompt object that names a judge
model, and each call returns a new scorer carrying the accumulated step types. Scorers are
attached to agents or workflow steps, or run in a batch through `runEvals`
(`packages/core/src/evals/run/index.ts:231`, implementation at `:317`).

### MCP server

`MCPServer` extends a base type from core and wraps the official server SDK
(`packages/mcp/src/server/server.ts:93` for config, `:555` for server construction). It
converts tools, agents and workflows into MCP tools, serves them over stdio or Streamable
HTTP, and turns a suspended tool call into an `input_required` continuation.

## One run, end to end

1. The caller invokes `stream()` or `generate()` on an agent with an options bag
   (`packages/core/src/agent/agent.types.ts:596`).
2. `loop()` builds a `MastraModelOutput` and starts `workflowLoopStream`
   (`packages/core/src/loop/loop.ts:15`, `:144`).
3. The stream creates a `ReadableStream`, an output writer for chunks, and a timeout-driven
   abort signal (`packages/core/src/loop/workflows/stream.ts:41`, `:76`, `:276`).
4. The loop builder assembles the iteration workflow and commits it
   (`packages/core/src/loop/loop-builder.ts:349` through `:419`).
5. It wraps that iteration in `dowhile` and chooses an engine
   (`packages/core/src/loop/loop-builder.ts:759`, `:126`).
6. The stream either creates a fresh run and starts it, or resumes an existing one through
   `resumeClaimed` or `resume` (`packages/core/src/loop/workflows/stream.ts:415`, `:447`).
7. The engine executes the step graph, merging each step result into the run's context
   document (`packages/core/src/storage/workflow-snapshot.ts:60`).
8. A tool call that needs approval or that suspends inside the tool returns `suspend()` with
   a payload and a resume schema (`packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts:613`,
   `:670`, `:761`); the payload records a pending approval or a suspended tool under a known
   metadata key (`:202`, `:295`).
9. A later `resume` call supplies `resumeData` and optionally a step, label or `foreach` index
   (`packages/core/src/workflows/workflow.ts:4860`). `resumeAsync` exists for
   fire-and-forget resumption (`:4903`), and `restart` re-enters a completed run (`:4939`).
   A reader helper exposes suspended steps and resume labels without the raw snapshot
   (`packages/core/src/workflows/state-reader.ts:106`).
10. Chunks pass through output processors; a processor's `abort()` becomes a `TripWire`, and
    the run ends with a `tripwire` chunk carrying the reason and metadata
    (`packages/core/src/agent/trip-wire.ts:75`).
11. On success or failure the stream deletes the run's snapshots and releases the run
    registration (`packages/core/src/loop/workflows/stream.ts:496`, `:529`, `:557`); a
    suspension keeps the registration alive (`:522`).
12. The caller sees a result whose status distinguishes success, suspension, failure and
    tripwire, and whose suspended list names the paused paths
    (`packages/core/src/workflows/types.ts:1096`, `:1185`).

## State and persistence model

Persistence is opt-in per run. The agent loop persists a snapshot only for pending, paused
or suspended states (`packages/core/src/loop/loop-builder.ts:327`), prunes what it writes
(`:345`), and deletes on terminal (`packages/core/src/loop/workflows/stream.ts:366`). A
snapshot that would overwrite a suspended one is refused by the in-process engine
(`packages/core/src/workflows/default.ts:86`), so a stale completion cannot erase a
resumable pause.

Storage is an interface, not a bundle: `WorkflowsStorage` declares snapshot persistence,
loading, run listing and run deletion (`packages/core/src/storage/domains/workflows/base.ts:132`).
The price of one document per run is visible in the repository's own tests: a suite measures
snapshot write amplification (`packages/core/src/workflows/__tests__/snapshot-write-amplification.test.ts:81`),
and the merge helper exists partly to keep concurrent child writes from clobbering siblings
(`packages/core/src/storage/workflow-snapshot.ts:116`).

Two recovery layers sit above storage: the ownership lease described earlier, and resume
claims that make a repeated resume idempotent. A resume that claims the run re-enters it
through `resumeClaimed` (`packages/core/src/workflows/workflow.ts:4854`), a second resume is
rejected with an explicit error (`:5095`), and an unclaimed resume is allowed only when the
workflow opts in (`packages/core/src/workflows/execution-engine.ts:44`).

## Streaming and transport

The agent stream is a typed chunk stream, not a transport. `MastraModelOutput` wraps the raw
stream and offers higher-level views (`packages/core/src/loop/loop.ts:152`); the loop writes
chunks through an output writer that also handles custom data chunks
(`packages/core/src/loop/workflows/stream.ts:76`). Timeouts are composed into one abort signal
and raced against the run (`:276`). The stream emits `error` and `finish` events and a
`tripwire` chunk when a guardrail halts the run.

HTTP transport is not part of the loop. The MCP server is the place where a wire protocol
meets the framework: `startStdio` delegates to the SDK's `serveStdio`
(`packages/mcp/src/server/server.ts:1206`), and `startHTTP` wraps the SDK's handler with
path, host and origin checks (`:1194`, `:1224`).

## Build and test stack

The repository is a pnpm workspace with Turborepo, strict TypeScript and colocated Vitest
tests, per its root `AGENTS.md`. Core builds and tests run through root scripts
(`pnpm build:core`, `pnpm test:core`), and the MCP package splits client, server and
integration suites (`packages/mcp/AGENTS.md`). Changesets carry release notes, and features
are expected to ship documentation. Nothing in this stack was executed for this dive.

## What the shape buys, and costs

The composition is unusually uniform: workflows, memory, guardrails, evaluation and MCP all
plug into a handful of contracts, and a feature that fits the processor contract avoids
touching the loop. The costs are equally visible: a very large agent class, a workflow class
of roughly 6k lines, two engines with different persistence semantics, and a run state that grows
into one large document that must be pruned and merged carefully.
