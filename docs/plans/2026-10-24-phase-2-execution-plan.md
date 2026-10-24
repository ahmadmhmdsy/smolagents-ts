# Phase 2 — delegation that survives its parent: execution plan

**Date:** 2026-10-24 · **Status:** in_progress · **Owner:** lead · **Parent:**
[apply the competitor findings](2026-10-22-apply-the-competitor-findings-plan.md), rows 2.1–2.8.

**Contract**
- **Role:** the working plan for Phase 2 — item order, the design each item lands, and the
  acceptance tests registered before any code is written.
- **Mutability:** history plus a live checklist. Append to `## Changes` when an item lands or a
  criterion proves wrong; never rewrite a landed entry.
- **Read when:** executing or reviewing Phase 2.
- **Update when:** an item lands, a test proves a design wrong, or the phase closes.

## Why this phase

Phase 1 made one run durable. Phase 2 makes a **second agent** part of that durability: a child
returns a value a caller can validate rather than prose, a parent can message it and wait on an
edge without polling, every event says which agent produced it, and the second slice adds a
transfer, a background child with its own row, a supervisor sample and a claim board. The
parent plan's own summary of the slice order applies: the first slice rides the loop that
exists; the second slice adds durable rows.

## Invariants

1. One loop, one writer per record. A child is a `MultiStepAgent` run with its own `runId` and
   record; nothing in this phase adds a scheduler to the loop.
2. The delegation surface is **opt-in**: `managedAgents`, `transfers`, `send`/`wait` and the
   board are additions no existing run can reach by accident.
3. No new store backend. The Phase 1 `RunStore` seam grows one subscription method (2.7) and
   every new durable fact is a field on the run record.
4. Records stay JSON-safe and version 2; additive optional fields need no migration.
5. Acceptance tests are registered here first and must fail before the implementation.

## Pre-registered acceptance tests

| item | test file | cases that must fail first |
|---|---|---|
| 2.1 | `packages/core/test/child-report.test.ts` (44th core file) | a schema-valid child yields `report.value` and no `failure`; a mismatch yields `failure.kind === "schema"` with no `value` and a diagnostic of at most 300 characters that does not contain the task text; a child that exhausts steps yields `stopReason === "max_steps"` and a failure; a successful run yields `stopReason === "success"`; `managedAgent`'s model-facing text keeps the report template and names the failure |
| 2.3 | `packages/core/test/agent-path.test.ts` (45th core file) | every event of a root run carries `agentPath: []`; a managed child's events carry `["researcher"]`; a two-level child carries `["researcher","writer"]`; the record carries the path of its run; a caller-supplied path is extended, not replaced |
| 2.6 | `packages/core/test/run-messages.test.ts` (46th core file) | a send appends a record entry with the sender and returns an `accepted` receipt; the target's next step sees the text and marks it delivered at that step; a message delivered once is not delivered again on resume; a parked run accepts the message and delivers it on the resumed step; a completed or unknown run is refused with a typed error; the record round-trips through `FileRunStore` |
| 2.7 | `packages/core/test/wait-for-run.test.ts` (47th core file) | a wait resolves on the first edge after the call; a wait on a terminal record returns `noProgress` immediately and does not claim; a wait that times out reports `timedOut`; the listener unsubscribes and a wait never commits (generation unchanged); the store contract's fourteenth mode certifies `watch` on memory and file stores |
| 2.2 | `packages/core/test/transfer.test.ts` (48th core file) | a declared transfer target yields a tool named `transfer_to_<name>`; calling it ends the run with `result.transfer.target` and the record's `transfer`; `run.transferred` is the terminal event; constructing a transfer for an undeclared agent throws `ToolDefinitionError`; a run without a transfer is unchanged |
| 2.4 | `packages/core/test/background-child.test.ts` (49th core file) | starting a child records a row in `provisioning` and then `completed`, while the child's record names `parentRunId`; a second start over the cap is refused typed; `listChildren` reads rows without resuming; cold resume adopts a child record behind a `provisioning` row and fails a provisioning row with no record; a child's typed report is stored on its row |
| 2.5 | `examples/supervisor/test/example.test.ts` | the sample's supervisor delegates to two managed agents with schemas, one failing, and the final answer reports both outcomes; the sample typechecks and its own vitest project runs |
| 2.8 | `packages/core/test/claim-board.test.ts` (50th core file) | create, claim, update, complete and tombstone each bump the revision; a stale revision is refused typed; a claim waits on an unfinished blocker; a deleted task cannot be claimed and keeps its row; the type and the runtime row carry no payload field; write scopes are recorded as advisory |

The parent plan's exit criterion becomes `packages/core/test/phase-2-exit.test.ts` (51st core
file) at close: a parent starts a child, ends, and a later call re-attaches to the typed result;
a send reaches a running child at its next step and a parked child resumes for it; a wait
returns `noProgress` when nothing can move; a transfer survives a restart; a nested child's
events filter by path; the board refuses a stale revision.

## Item designs

### 2.1 A typed child report

New `packages/core/src/agent/child-report.ts`:

```ts
type ChildStopReason = "success" | "failure" | "max_steps" | "waiting";
interface ChildFailure {
  kind: "schema" | "agent" | "unknown";
  name: string;            // typed error name, e.g. "AgentMaxStepsError"
  message: string;         // bounded provider diagnostic, no task text, <= 300 chars
  issues?: readonly string[]; // schema paths only, never values
}
interface ChildReport<T = unknown> {
  stopReason: ChildStopReason;
  value?: T;               // present only when the schema accepted the answer
  failure?: ChildFailure;  // present only when it did not
}
runManagedAgent<T>(entry, task, options?): Promise<ChildReport<T>>
```

`ManagedAgent` gains `outputSchema?: z.ZodType<T>` and the `managedAgent` tool validates the
child's answer with it. `managedAgent()` keeps returning a `Tool` whose text is the Phase 1
report template; the typed report is reachable through `runManagedAgent`, which the tool uses.
The diagnostic is assembled from the typed error's name, code and a truncated message, never
from the task or the model's inputs; a schema failure lists issue paths only.

### 2.3 An agent path on every event

`AgentEvent` gains an optional `agentPath?: readonly string[]`; `emit` writes the running
context's path onto every event, so the runtime form always has it. `RunOptions.agentPath`
seeds it; `RunRecord.agentPath` stores it; a managed child runs with
`[...parentPath, entry.name]`. A root run's events carry `[]`. No new export; the pinned
surface changes only in types already exported.

### 2.6 A send, as an ordinary record entry

`RunRecord.messages?: RunMessage[]`, `RunMessage = { id, from, text, sentAt, deliveredAt?,
deliveredStep? }`. New `packages/core/src/session/messages.ts`:

```ts
sendRunMessage(store, runId, { from, text }): Promise<{ accepted: true; runId: string; messageId: string }>
```

A send loads the record, refuses `unknown` and terminal records typed
(`RunMessageRefusedError`), appends the entry, commits at the recorded generation and returns
the receipt: acceptance, not processing. The loop calls `deliverMessages(context)` at every
step boundary: a durable run loads its record, takes undelivered entries, appends a
`MessageStep` (`kind: "message"`, sender and text) to memory, stamps `deliveredAt` and
`deliveredStep`, and commits before the model turn. The prompt builder renders a message step
as a user-role turn prefixed with its sender. A parked run accepts a send and delivers it on
the resumed step; an inactive (crashed) run accepts it and delivers it on repair.

### 2.7 A wait as an edge

`RunStore.watch(runId, listener): () => void` becomes the store contract's fourteenth mode:
a commit or claim notifies listeners registered before it; unsubscribe stops delivery; the
file store watches through an optional `RunFileSystem.watchFile` that the CLI binds to
`fs.watchFile`. New `packages/core/src/session/wait.ts`:

```ts
waitForRun(store, runId, options?: { timeoutMs?: number; signal?: AbortSignal }):
  Promise<{ settled: boolean; timedOut: boolean; noProgress: boolean; aborted: boolean;
            record?: RunRecord }>
```

The baseline is the record as read at call time; the wait resolves on the first notification
whose record differs, times out without claiming, and returns `noProgress` at once when the
run is unknown or already terminal. A wait never writes.

### 2.2 A transfer action

`TransferTarget = { name, description, agent }`; `AgentOptions.transfers?: readonly
TransferTarget[]` builds one `transfer_to_<name>` tool per declared target, all named from the
declaration so an undeclared target cannot exist. The tool returns a `TransferSignal
{ target, reason? }`; the loop sees the signal after the step and ends the run with
`run.transferred` (a new terminal event), `RunResult.state === "success"` and
`RunResult.transfer`; the record stores `transfer`. The target's own run is the caller's to
start (2.5 shows the supervisor shape).

### 2.4 A bounded background child

New `packages/core/src/agent/background-child.ts`:

```ts
interface ChildRow { runId; parentRunId; agentName; task; phase: "provisioning" | "active" |
  "completed" | "failed"; report?: ChildReport; startedAt; updatedAt }
startBackgroundChild({ store, parentRunId, agent, agentName?, task, maxConcurrent? }):
  Promise<{ runId: string; done: Promise<RunResult> }>
listChildren(store, parentRunId): Promise<readonly ChildRow[]>   // reads, never resumes
resumeBackgroundChild(store, parentRunId, runId, agent): Promise<{ report: ChildReport }>
```

The row lives on the parent record; the child record carries `parentRunId`. The cap counts rows
in `provisioning`/`active` and refuses the next start typed (`ChildLimitError`). Cold resume
reconciles a `provisioning` row against the child's record: a record means the child was
admitted, so the phase is adopted from its status; no record means admission failed, so the row
becomes `failed`. The parent's row stores the child's `ChildReport` at completion, which is
what a later re-attach reads.

### 2.5 One supervisor shape

New `examples/supervisor/` project (package.json, vitest.config.ts, src/index.ts, README,
test/example.test.ts): a supervisor with two schema'd managed agents, one returning a value and
one failing its schema; the sample's final answer states both, the typed report is what it
routes on, and the example project runs under `pnpm test`.

### 2.8 A claim board, not a data blackboard

New `packages/core/src/session/claim-board.ts`: rows on the parent record under `board`,
each `{ id, title, owner?, status: "open" | "claimed" | "blocked" | "done" | "deleted",
blockers, writeScopes, revision, updatedAt }`. Mutations load the record, check the row's
revision equals the caller's expectation, then commit at the record's generation. A stale
revision is `TaskStaleRevisionError`; a claim whose blocker is unfinished is
`TaskBlockedError`; a deleted row stays as a tombstone and refuses every mutation. There is
no payload field in the type; write scopes are recorded, advisory and never enforced.

## Public surface

Every new runtime name is added to `packages/core/test/public-surface.test.ts` in the same
commit, with the grouped count in `packages/core/AGENTS.md` updated. Expected additions:
2.1 `ChildReport`, `ChildFailure`, `ChildStopReason`, `runManagedAgent`; 2.6 `RunMessage`,
`sendRunMessage`, `RunMessageRefusedError`; 2.7 `waitForRun` and the wait result type,
`RunStore.watch`; 2.2 `TransferTarget`, `TransferSignal`; 2.4 `ChildRow`,
`startBackgroundChild`, `listChildren`, `resumeBackgroundChild`, `ChildLimitError`; 2.8 the
board types and functions. 2.3 and 2.5 add no export.

## Verification per item

1. Run the item's new test file; it must fail for the stated reason.
2. Implement to green.
3. Update `docs/00-schema.md` only if a pack record field changed (none expected); update the
   execution plan's `## Changes`, the scoped `packages/core/AGENTS.md` counts, a handoff entry,
   and `docs/04-tasks.md` if a row moves.
4. `pnpm gate` exit 0; validator 0/0; rotate clean; one commit per item. Do not push.

## Close plan

Run the parent plan's exit criterion as `phase-2-exit.test.ts`; write the phase report under
`docs/reports/` with the evidence; check the parent plan's Phase 2 rows against the code; close
the phase task; handoff entry; final gate and commit. The goal is complete only then.

## Changes

*(newest first; an entry is written when an item lands or a criterion proves wrong)*

- **2026-10-24 — 2.7 as built.** `RunStore.watch(runId, listener)` is the contract's fourteenth
  mode: a commit or claim that lands after registration calls the listener with the record,
  the returned function unsubscribes, and watching never writes. `MemoryRunStore` notifies
  synchronously; `FileRunStore` notifies its own writes and reaches another process's through an
  optional `RunFileSystem.watchFile`, which the CLI binds to `fs.watchFile` (a poll, so the
  store's rename-into-place publish survives it). `session/wait.ts` exports `waitForRun`, whose
  baseline is the record read at call time: it resolves on the first differing notification,
  reports `timedOut` or `aborted` without claiming, and answers `noProgress` at once for an
  unknown or already terminal run. Core 47 files/553 tests, CLI 11/77, `pnpm gate` exit 0.


- **2026-10-24 — 2.6 as built.** `session/messages.ts` exports `RunMessage`,
  `SendRunMessageInput`, `SendRunMessageReceipt`, `sendRunMessage` and `RunMessageRefusedError`
  (the error lives in `errors.ts` under the new `AGENT_RUN_MESSAGE_REFUSED` code).
  `RunRecord.messages` keeps the entries. A send loads the record, refuses an unknown or ended
  one, appends the entry and commits at the generation it read, taking no claim; the receipt says
  `accepted`, not processed. `commitRun` joins messages other writers appended before every
  commit, so an effect's own commit cannot drop a send. At every step boundary the loop delivers
  undelivered entries as an ordinary `MessageStep`, stamps `deliveredAt` and `deliveredStep` in the
  same commit, and renders the step as a user turn prefixed with its sender. Core 46 files/542
  tests, `pnpm gate` exit 0.


- **2026-10-24 — 2.3 as built.** `AgentEvent` is now the event payload intersected with
  `{ agentPath?: readonly string[] }`; `emit` writes the running context's path onto every event,
  so the runtime form always carries it (the root's is empty). `RunOptions.agentPath` seeds a run,
  `RunRecord.agentPath` keeps it, and both executor seams forward it to every tool call's
  `ToolContext`, so a managed child runs with the parent's path plus its own name. A caller's path
  is extended, never replaced. Two exact event-shape assertions in the budget and max-steps tests
  moved to `toMatchObject` because the contract grew a field. Core 45 files/532 tests,
  `pnpm gate` exit 0.


- **2026-10-24 — 2.1 as built.** New `child-report.ts` exports `ChildReport<T>`, `ChildFailure`,
  `ChildStopReason`, `RunManagedAgentOptions` and `runManagedAgent`. `ManagedAgent` gains an optional
  `outputSchema`; a managed run reports `{stopReason, value?, failure?}` with the value validated
  against that schema, schema issues as paths and codes only, and a failure diagnostic bounded to
  300 characters with the task text and key-shaped tokens replaced. `stopReason` is `success`,
  `failure`, `max_steps` or `waiting`; a parked child is `waiting`; an exhausted one is
  `max_steps`. The model-facing `managedAgent` tool keeps the Phase 1 report template, rendering
  the value on success and the failure channel otherwise, so the manager loses no text. Public
  surface: `runManagedAgent` only (the types are pinned through the barrel's exported names).
  Core 44 files/527 tests, `pnpm gate` exit 0.

