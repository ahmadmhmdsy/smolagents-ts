# Phase 4 — protocol and tool breadth: completion report

**Date:** 2026-10-24 · **Repository:** `E:\python_projects\smolagents_ts` (branch
`main`) · **Plan:** [Phase 4 execution plan](../plans/2026-10-24-phase-4-execution-plan.md)
(parent: [apply the competitor findings](../plans/2026-10-22-apply-the-competitor-findings-plan.md))

**Contract**
- **Role:** report — the completion record of Phase 4 and the evidence for its exit criterion.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking what Phase 4 landed, how the MCP, tool-policy, transfer and backend
  surfaces are shaped, or which open items were left for a later phase.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

Every number below is a reading of the tree at the close commit; the newest handoff entry is the live status.

**Status:** complete. Items 4.1–4.8 are landed, tested, documented and committed; the parent
plan's Phase 4 exit criterion runs as two files,
`packages/mcp/test/phase-4-exit.test.ts` and `packages/exec-remote/test/phase-4-exit.test.ts`.
Nothing is pushed; `main` remains ahead of `origin/main`.

## Outcome

The MCP client is now as complete as the reference client for the verbs this port uses. The
handshake keeps each server's declared capabilities per connection and gates every verb on its
own capability with `MCPCapabilityError`; a list that never stops paging stops at `maxListPages`
with `MCPListLimitError`; a non-2xx answer raises `MCPHttpStatusError`, and a 404 carrying a
session id clears it, re-handshakes and retries once. Resources, prompts and completions are
client methods with typed answers, nothing cached. A `tools/call` asks for progress only when
the caller supplied a sink, one token per call; progress, cancellation and the list-changed
notice arrive as typed notifications, and an abort sends `notifications/cancelled` before it
rejects.

Tool availability is data. `ToolPolicy` merges base and per-step: allowed intersects, hidden
unions by name with the first reason kept, forced names outside allowed are dropped with a
reason, and requirements are deduped. One registry view feeds the prompt, the request's tool
specs, the executor's registry and the lookup that runs a call, so a hidden tool is absent from
all four and a scripted call fails with `AGENT_TOOL_POLICY` while its body never runs. A
generator tool streams: its yields reach `action.progress` on both agent flavours and its return
value is the result, with the drain under the tool's deadline. A hosted tool is declared by
kind, advertised with its provider payload, absent from the guest registry, and a call naming it
fails with `AGENT_TOOL_HOSTED`.

The remote executors gained depth and lost a protocol. A declared transfer installs exactly the
tools it names and binds its variables before step 0; E2B refuses a declared tool set with
`UnsupportedOptionError` rather than half-carrying it. The E2B backend now carries metadata,
sets the lifetime, applies a per-execution timeout and a keepalive refresh, passes `contextId`
through every `runCode`, and reads guest metrics. The Docker backend no longer speaks HTTP to a
kernel gateway: it starts one plain `python:3.12-slim` container, opens one duplex `docker
exec` session whose program is the prelude plus the step loop, resolves on the guest's `ready`
frame, and answers tool frames on that same stdin. `jupyter.ts`, `rpc.ts` and the gateway
double are deleted; `deny-all` is enforced as network mode `none` and reported in the
capability instead of refused.

## Verification evidence

| item | result |
|---|---|
| `pnpm gate` at the 4.8 commit (`c9dfa90`) | exit 0 (typecheck, version:check, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke, site:build) |
| core suite | 56 files, 631 tests pass |
| mcp suite | 14 files, 136 tests pass |
| tools suite | 7 files, 32 tests pass |
| exec-remote suite | 13 files, 95 tests pass |
| whole repository | 163 files, 1268 tests pass |
| `packages/mcp/test/phase-4-exit.test.ts` | 2 passed (below) |
| `packages/exec-remote/test/phase-4-exit.test.ts` | 2 passed (below) |
| public surface | core 110 pinned names, mcp 32; every new runtime export has a pin |
| context validator | 0 errors, 0 warnings |
| `python scripts/rotate.py --check` | clean |

## What landed

| item | commit | summary |
|---|---|---|
| 4.1 | `81759f3` | per-connection capabilities and gating, request timeout, typed local errors, bounded list aggregation, 404 session recovery |
| 4.2 | `ac667cd` | `listResources`/`readResource`, `listPrompts`/`getPrompt`, `complete`, each gated on its capability |
| 4.3 | `ff74d57` | progress tokens and sinks, typed notifications, `notifications/cancelled` on abort, list-changed |
| 4.4 | `e083911` | `ToolPolicy` as data: allowed, hidden, forced, requirements; `tool.policy` event; `ToolPolicyDeniedError` |
| 4.5 | `2430016` | generator tools with `action.progress`, hosted tool kind, `ToolHostedError` |
| 4.6 | `5388278` | declared transfer on the executor and shim, `UnsupportedOptionError`, E2B refusal |
| 4.7 | `9835c10` | E2B metadata, lifetime, per-execution timeout, keepalive, contexts, metrics |
| 4.8 | `c9dfa90` | Docker exec transport, `ready` frame, network mode, deny-all enforced; Jupyter path deleted |

## Exit criterion

The parent plan's criterion is: "a policy fixture hides a tool the model must not see; a long MCP
tool call reports progress and can be cancelled; a remote guest calls a host tool by name."

The criterion spans two packages that cannot import each other, so it is pre-registered as two
files:

1. `packages/mcp/test/phase-4-exit.test.ts` — a live `MCPClient` over a fixture transport lists
   `public`, `secret` and `slow`. A `ToolCallingAgent` runs over the adapted tools with
   `toolPolicy.hidden` naming `secret`: the prompt lists `public` and not `secret`, so do the
   request's tool specs, and the step's `tool.policy` event names the hidden tool. Separately
   the adapted `slow` tool is called with a progress sink: the server's progress notification
   reaches the sink once, and the caller's abort ends the pending call.
2. `packages/exec-remote/test/phase-4-exit.test.ts` — a `ProcessSandbox` guest runs
   `final_answer(host_tool(seed + 1))` under a transfer that declares `host_tool` and
   `seed = 20`: the host tool's body runs once, the round trip is counted, and the answer is 42.
   A tool outside the declared transfer is not installed, so calling it fails the step with
   `NameError` rather than reaching the host.

## Parent-plan check

| parent plan row | landed as |
|---|---|
| 4.1 MCP depth: capability gating, request timeout, typed local errors, bounded list aggregation, session lifecycle (`MC-01`) | `MCPCapabilityError`, `MCPListLimitError`, `MCPHttpStatusError`, `maxListPages`, 404 re-handshake |
| 4.2 resources, prompts and completions through the client (`MC-03`) | `listResources`, `readResource`, `listPrompts`, `getPrompt`, `complete` |
| 4.3 progress, cancellation and list-changed notifications surfaced as events (`MC-05`) | `onProgress`, typed listeners, `notifications/cancelled`, list-changed |
| 4.4 per-step tool policy as data: allowed, forced, hidden, requirement rules (`TL-06`) | `ToolPolicy`, `mergeToolPolicy`, `tool.policy`, `ToolPolicyDeniedError` |
| 4.5 generator tools with typed progress events, and a declared kind for provider-hosted tools (`TL-04`, `TL-07`) | `action.progress`, hosted kind, `ToolHostedError` |
| 4.6 declared transfer of tool definitions and variables into a remote guest (`EX-10`) | `SandboxTransfer`, shim binding, `UnsupportedOptionError` |
| 4.7 E2B backend depth: settable lifetime, per-execution timeout, keepalive, metadata, metrics, contexts (`EX-11`, `EX-03`, `EX-06`) | `E2BSandbox` options and `guestMetrics` |
| 4.8 the Docker exec transport: stdio session, network mode, handshake frame, `jupyter.ts` deleted, deny-all enforced (`EX-06`, `EX-04`) | `execSession`, `ready` frame, `networkMode`, gateway files deleted |

Three differences from the plan's text, each recorded in the plan's `## Changes`:

- `unsupported` options are refused through `UnsupportedOptionError`, which is one public name
  the plan registered for 4.6.
- The Docker backend gained `startTimeoutMs` (default 60 000), because a guest that never
  announces readiness would otherwise hang `start` forever.
- The `ready` frame is emitted before the step loop's first read and dropped by the stdio
  backend, so a step's frames are unchanged; the executor never observes it.

## Open

- `T-45` closes with this report. Phase 4 is code-complete and unreleased; publishing still waits
  on `T-14`.
- The Docker exec implementation (hijacked stdio, kill-stops-container) is exercised only through
  the runtime seam's double. No live daemon or E2B sandbox was touched: a green suite proves the
  seam, and the runbook is the path for a live check.
- A policy fixture is a snapshot of the current merge rules; a later phase that adds a policy
  axis must extend `mergeToolPolicy` and its test rather than the exit file.
- Tool policy is enforced for code agents and tool-calling agents at one registry view; a
  consumer that builds its own executor from `agent` tools bypasses the advertised registry and
  keeps the hidden tool reachable by name, which is the documented seam.
