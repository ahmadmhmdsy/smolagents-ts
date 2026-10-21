# adk-js — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/google/adk-js |
| register row | Tier 1, depth D3, slug `adk-js`, wave 2; the register's focus line names multi-agent transfer, sessions and state, callbacks and A2A |
| licence | Apache-2.0. `LICENSE:2-3` opens with the Apache title and `package.json:6` declares the SPDX id; GitHub reports `Apache-2.0`, and the clone carries a `LICENSE_SUMMARY.md` naming the same |
| read commit | `df491a96e70c33061aa7aa715ced4f884efa89bb`, committed 2026-10-20 13:17:36 -0700, subject `ci: speed up Windows validation workflow (#1111)` |
| clone | `reference/competitors/adk-js`, shallow (`--depth 1`), clean worktree at the read |
| packages | npm workspaces `core` (`@google/adk`), `dev` (`@google/adk-devtools`) and `integrations`, wired at `package.json:38`; all four manifest entries read 2.3.0 in `.release-please-manifest.json` |
| language and stack | TypeScript; ESM sources with a bundled CJS output; declaration emit through `tsc` plus esbuild via `build.js`; Vitest; Node 20.19 or newer (`README.md:55`) |
| size signal | 317 TypeScript files and about 59,700 lines under `core/src`; 32 files and about 8,000 lines under `dev/src`; 195 files and about 17,600 lines under `tests/` |
| documentation source | a docs tree and samples ship in the clone, published at https://adk.dev (`README.md:16`); the code was the primary evidence and documentation only the rationale |

## What it is

The Agent Development Kit for TypeScript is Google's Node-and-browser agent framework, the
sibling of `google/adk-python` and openly derived from it: several modules say so in their own
headers, from the transfer tool (`core/src/agents/processors/agent_transfer_llm_request_processor.ts:31`)
to the task-completion tool (`core/src/tools/finish_task_tool.ts:46`). It is a framework for
product teams, not a research harness: an agent owns instructions, tools and sub-agents; a
runner drives one invocation; services persist sessions, memory and artifacts.

Three design commitments shape the code. First, parity with the Python original is treated as
a compatibility contract, not an aspiration: the transfer parameter is spelled `agent_name`
and the workflow reply schema `response_schema` because a transcript written by one runtime
must be readable by the other (`core/src/workflow/utils/hitl_utils.ts:38-44`), and the
database schema is a shared cross-language contract with a version marker
(`core/src/sessions/db/schema.ts:43`). Second, the event log is the unit of truth: a run
produces `Event` objects that carry state and artifact deltas, a transfer target, an
escalation flag, pending confirmations and auth requests
(`core/src/events/event_actions.ts:26-61`), and every resumption question is answered by
scanning that log. Third, extension happens at one ordered hook surface: a plugin manager
runs hooks around user messages, runs, agents, nodes, models, tools and context compaction
(`core/src/plugins/base_plugin.ts`, `core/src/plugins/plugin_manager.ts:36`), and where both are
wired a plugin verdict pre-empts the agent's own callback (`core/src/agents/llm_agent.ts:2024-2036`).

Around that core sit a workflow graph with human-in-the-loop interrupts
(`core/src/workflow/workflow.ts:137`), an A2A server and client
(`core/src/a2a/agent_to_a2a.ts:179`), a session-scoped eval runner with thresholds
(`core/src/cli/cli_eval.ts:660`), OpenTelemetry setup (`core/src/telemetry/setup.ts:66`)
and a dev package that ships a CLI with `web`, `api_server`, `create`, `run`, `eval`
and `deploy` verbs (`dev/src/cli/cli.ts:274-744`).

## Why it is in the register

The register row was written for wave 2 before any of this was read; the assignment widened it
to plugins, artifacts, evaluation and the event model. Each focus maps onto live rows of ours:

- Transfer and sub-agents: `MA-02` is absent here and `MA-06` is absent; adk-js ships transfer
  as a tool whose target list is a decoded enum, and ships composite agents that its own code
  now deprecates in favour of a workflow graph (`core/src/agents/parallel_agent.ts:42-50`).
- Sessions and state: our `HL-08`, `HL-09` and `HL-10` are thin or absent, and this repository
  has a database session service whose on-disk schema is versioned and shared with adk-python.
- Callbacks and plugins: we have middleware (`RT-08`) and one guardrail seam (`GR-01`); adk-js
  has one global plugin surface that also covers tools, models, nodes and run boundaries.
- Artifacts: we have no artifact capability at all in the baseline, while adk-js versions
  artifacts per session and records artifact deltas on events.
- Evaluation: `OB-04` is implemented here as a single expectation shape, and `OB-05` is absent;
  adk-js runs JSON eval sets with mock tool output and two named metrics against thresholds.
- A2A: a deliberate non-goal for us under decision 0018, recorded because the security posture
  behind its agent-card resolution applies to our remote executors as well.

## How it is positioned against us

The two projects solve the same problem from opposite defaults. adk-js assumes a
function-calling model with tools and treats code execution as one tool among many; this port
assumes a model-authored program and treats the sandbox as the action space. That difference
propagates into their loops, their event payloads and their evaluation model.

| family | adk-js | this port at the baseline |
|---|---|---|
| action space | tool-call turns; code execution a tool (`core/src/code_executors/built_in_code_executor.ts`) | model-authored program in a WASM sandbox, the default (`RT-01`, `EX-01`) |
| multi-agent | transfer tool, `AgentTool`, composite agents (deprecated), workflow graph | managed agents as tools; no control transfer (`MA-01`, `MA-02`) |
| durability | an event log plus resumability config; workflow interrupts | a checkpoint between steps; one in-memory run store (`HL-03`, `HL-04`) |
| state | session state scoped `app:`, `user:`, `temp:`, with delta write ordering | per-run state and a UI snapshot (`RT-14`) |
| extension | one plugin surface plus per-agent callbacks plus request processors | middleware plus one guardrail seam (`RT-08`, `GR-01`) |
| evaluation | eval sets, mock tool output, named metrics, pass thresholds | one expectation-shaped scorer (`OB-04`) |
| protocol | A2A server and client, cross-language tests against a Go peer | out of scope by decision 0018 |
| distribution | three workspaces, Node and browser entry points | eleven packages behind one facade (`DS-01`) |

Distance is concentrated in state modelling rather than in feature count: the parts we lack
most (a resumable pending call, a shared schema for stored state, scoped conversation identity)
are all consequences of their event-log-as-truth decision, and can be reached from our seams
without importing the whole shape.

## Limits of this read

- Shallow clone: no history, no tags, no blame. Every claim below is pinned to the commit above.
- Reading concentrated on `core/src` (agents, events, plugins, sessions, artifacts, tools, A2A,
  workflow, eval CLI, telemetry) and on `dev/src` entry points. The 1,798-line dev API server was
  read at its route table and imports, not inside every handler; samples were listed, not read.
- The `integrations` workspace carries only a version export at this commit
  (`integrations/src/index.ts:7`), so it was recorded and not assessed.
- Nothing was installed, built, tested or executed. Runtime behaviour beyond the traced call
  path is inferred from source and said to be inferred.
- The published documentation site was not fetched; the clone's docs tree was used only for
  design rationale, and only `clone:/docs/adk-ts-improvements.md` was read in full.
- Line counts came from PowerShell over the worktree at the read commit and are approximate;
  they signal weight, not a maintained metric.
