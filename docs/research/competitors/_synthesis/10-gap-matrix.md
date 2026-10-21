# The gap matrix — what twenty-two neighbours have that we do not

**Contract**
- **Role:** the single home for the cross-repo gap evidence: which of our baseline rows the dives filed against, how often, and in which direction.
- **Mutability:** regenerated whenever a dive lands; the row ids come from the baseline and do not change here.
- **Read when:** choosing what to build next, checking whether a gap is one neighbour's quirk or a field convention.
- **Update when:** a dive is added, a baseline row is added, or a row's shape changes in `30-findings-about-us.md`.

**Measured:** 2026-10-21, across twenty-two filed dives; 565 bucketed gap rows, 512 of them keyed to a row id.
**Scope:** the D3 dives and D2 profiles filed under this tree. The long-tail sweep (`05-long-tail-coverage.md`) is not counted, because it files no gap rows.

## 1. Coverage

| repo | depth | commit | licence | lines | A | C | D | B |
|---|---|---|---|---|---|---|---|---|
| `adk-js` | D3 | `df491a9` | Apache-2.0 | 728 | 13 | 8 | 5 | 5 |
| `beeai-framework` | D3 | `2a1069c` | Apache-2.0 | 627 | 10 | 4 | 4 | 4 |
| `cloudflare-agents` | D3 | `4e89125` | MIT | 829 | 8 | 6 | 4 | 6 |
| `huggingface-smolagents` | D3 | `96f33fa` | Apache-2.0 | 778 | 1 | 5 | 4 | 1 |
| `langgraphjs` | D3 | `6e84570` | MIT | 791 | 13 | 1 | 8 | 1 |
| `mastra` | D3 | `b2d8623` | NOASSERTION | 701 | 15 | 8 | 7 | 5 |
| `mcp-typescript-sdk` | D3 | `c05225a` | NOASSERTION | 620 | 14 | 8 | 4 | 7 |
| `openai-agents-js` | D3 | `304e436` | MIT | 659 | 10 | 16 | 8 | 7 |
| `openhands` | D3 | `9cb22f5` | MIT | 700 | 12 | 10 | 1 | 2 |
| `pydantic-ai` | D3 | `1d79209` | MIT | 805 | 15 | 4 | 6 | 4 |
| `vercel-ai-sdk` | D3 | `e741656` | Apache-2.0 | 575 | 9 | 6 | 7 | 3 |
| `vercel-eve` | D3 | `c543585` | Apache-2.0 | 741 | 4 | 11 | 7 | 2 |
| `voltagent` | D3 | `72a46c7` | MIT | 647 | 15 | 7 | 10 | 8 |
| `agent-framework` | D2 | `0200599` | MIT | 435 | 7 | 7 | 7 | 3 |
| `agno` | D2 | `7a4febf` | Apache-2.0 | 466 | 2 | 6 | 12 | 4 |
| `autogen` | D2 | `004749e` | MIT | 500 | 8 | 8 | 4 | 4 |
| `claude-agent-sdk` | D2 | `9c59e06` | none open | 465 | 7 | 7 | 4 | 6 |
| `crewai` | D2 | `af4efdc` | MIT | 455 | 6 | 5 | 3 | 0 |
| `e2b` | D2 | `7433b8c` | Apache-2.0 | 600 | 3 | 3 | 4 | 2 |
| `inngest-agent-kit` | D2 | `6c9802f` | Apache-2.0 | 495 | 5 | 5 | 7 | 3 |
| `langchainjs` | D2 | `6c79aa9` | MIT | 488 | 10 | 5 | 5 | 3 |
| `strands` | D2 | `79e0f89` | Apache-2.0 | 483 | 14 | 6 | 7 | 5 |

Thirteen repositories were read deeply, with the loop and the persistence model traced line by line. Nine were profiled at the package-and-docs level. Two licences need care: `mastra` answers `NOASSERTION` on the API while its tree is Apache-2.0 except an `ee/` folder nobody read, and `claude-agent-sdk` has no open licence at all, so its dive is documentation and published types only.

## 2. Reading the table

Each row is a baseline id. `rows` counts how many dives filed a gap row against it, which is a rough proxy for how much of the field treats that capability as table stakes. The four bucket columns count the direction:

- **C** — unconsidered: the neighbour has something we never wrote down. The most valuable column.
- **A** — a follow-on to a seam we already ship; the design exists, the depth does not.
- **D** — depth: we ship it, they ship it deeper or wider.
- **B** — a non-goal under decision 0018 or 0019; recorded so it is a decision, not an omission.

Totals: C 146, A 201, D 128, B 85, plus five upstream-parity rows in the `huggingface-smolagents` dive. Seventy-five of our ninety-seven baseline ids were contested by at least one neighbour; twenty-two were not, and they are listed in section five.

## 3. The heat table

| id | capability | ours | rows | C | A | D | B | the dives that bite hardest |
|---|---|---|---|---|---|---|---|---|
| `HL-04` | resume a named run across processes | minimal | 18 | 4 | 10 | 4 | 0 | `adk-js`, `agent-framework`, `agno` |
| `EX-05` | a filesystem or shell workspace for the agent | absent | 15 | 0 | 0 | 0 | 15 | `adk-js`, `agno`, `autogen` |
| `OB-02` | export spans to OpenTelemetry or a vendor | absent | 15 | 1 | 10 | 2 | 1 | `adk-js`, `agent-framework`, `agno` |
| `MC-01` | client with Streamable HTTP and stdio transports | implemented | 14 | 4 | 4 | 5 | 1 | `langchainjs`, `mastra`, `mcp-typescript-sdk` |
| `RT-09` | typed event stream for rendering a run as it happens | implemented | 14 | 3 | 3 | 8 | 0 | `adk-js`, `agent-framework`, `agno` |
| `HL-02` | a pending approval as serialized state a UI or queue can carry | absent | 12 | 0 | 11 | 1 | 0 | `adk-js`, `agno`, `cloudflare-agents` |
| `HL-06` | interrupt and resume with a human-supplied value | absent | 12 | 0 | 11 | 0 | 0 | `adk-js`, `agno`, `autogen` |
| `HL-10` | checkpoint schema versioning or migration | absent | 12 | 1 | 7 | 4 | 0 | `adk-js`, `agno`, `autogen` |
| `HL-01` | approval gate before a tool call runs | implemented | 11 | 2 | 5 | 4 | 0 | `agent-framework`, `beeai-framework`, `claude-agent-sdk` |
| `MA-04` | parallel or background subagents | absent | 11 | 1 | 9 | 1 | 0 | `autogen`, `claude-agent-sdk`, `cloudflare-agents` |
| `HL-08` | a conversation identity across runs | minimal | 10 | 4 | 2 | 3 | 1 | `beeai-framework`, `claude-agent-sdk`, `cloudflare-agents` |
| `TL-06` | dynamic tool selection or filtering per step | minimal | 10 | 3 | 4 | 2 | 1 | `agno`, `autogen`, `claude-agent-sdk` |
| `UI-06` | a chat transport protocol between server and client | absent | 10 | 0 | 0 | 0 | 10 | `agent-framework`, `cloudflare-agents`, `inngest-agent-kit` |
| `GR-05` | provider-side structured output (JSON mode, response format) | seam-only | 9 | 0 | 9 | 0 | 0 | `beeai-framework`, `claude-agent-sdk`, `langchainjs` |
| `HL-03` | checkpoint a run's memory after each step | implemented | 9 | 3 | 2 | 4 | 0 | `agno`, `cloudflare-agents`, `inngest-agent-kit` |
| `HL-05` | crash recovery inside a step (idempotent replay) | absent | 9 | 1 | 6 | 2 | 0 | `agno`, `cloudflare-agents`, `inngest-agent-kit` |
| `HL-07` | replay or time-travel from step N | absent | 9 | 1 | 6 | 2 | 0 | `agno`, `cloudflare-agents`, `crewai` |
| `HL-09` | durable store implementations (file, SQLite, Redis) | absent | 9 | 0 | 8 | 1 | 0 | `adk-js`, `agno`, `cloudflare-agents` |
| `MA-03` | structured child report (a typed result rather than a string) | minimal | 8 | 0 | 4 | 3 | 1 | `adk-js`, `cloudflare-agents`, `crewai` |
| `MA-05` | shared state or blackboard between agents | absent | 8 | 4 | 4 | 0 | 0 | `adk-js`, `agno`, `cloudflare-agents` |
| `MA-06` | a supervisor or network topology shipped as code | absent | 8 | 2 | 6 | 0 | 0 | `agno`, `autogen`, `crewai` |
| `MA-01` | managed agents: a child agent exposed to the model as a calla… | implemented | 7 | 5 | 1 | 1 | 0 | `beeai-framework`, `crewai`, `mastra` |
| `MC-03` | resources, prompts and completions | absent | 7 | 0 | 6 | 0 | 1 | `mastra`, `mcp-typescript-sdk`, `pydantic-ai` |
| `OB-04` | score a completed run against a fixture's expectations | implemented | 7 | 0 | 3 | 3 | 1 | `adk-js`, `agent-framework`, `beeai-framework` |
| `OB-06` | cost accounting from token usage and a price table | absent | 7 | 0 | 6 | 1 | 0 | `agno`, `claude-agent-sdk`, `mastra` |
| `RT-06` | step budget with a typed `AgentMaxStepsError` | implemented | 7 | 3 | 2 | 1 | 0 | `huggingface-smolagents`, `inngest-agent-kit`, `langchainjs` |
| `RT-14` | `AgentSession` snapshot for a UI, and its checkpoint across t… | implemented | 7 | 0 | 2 | 5 | 0 | `agno`, `autogen`, `beeai-framework` |
| `GR-01` | input and output tripwires that halt the run with a typed rea… | implemented | 6 | 4 | 0 | 2 | 0 | `crewai`, `openai-agents-js`, `openhands` |
| `GR-06` | schema-failure repair loop: re-prompt the model instead of fa… | absent | 6 | 0 | 6 | 0 | 0 | `adk-js`, `langchainjs`, `mastra` |
| `MC-05` | notifications | minimal | 6 | 1 | 4 | 1 | 0 | `mcp-typescript-sdk` |
| `MC-07` | MCP server authoring | absent | 6 | 0 | 0 | 0 | 6 | `agno`, `claude-agent-sdk`, `cloudflare-agents` |
| `TL-02` | registry and collection | implemented | 6 | 3 | 0 | 3 | 0 | `autogen`, `crewai`, `openai-agents-js` |
| `TL-05` | per-tool timeout, retry or budget | absent | 6 | 0 | 4 | 2 | 0 | `beeai-framework`, `inngest-agent-kit`, `langchainjs` |
| `EX-03` | remote executors: host process, Docker kernel, E2B sandbox | implemented | 5 | 2 | 0 | 3 | 0 | `e2b`, `huggingface-smolagents`, `openhands` |
| `MA-02` | handoffs: transferring control to another agent instead of ca… | absent | 5 | 0 | 5 | 0 | 0 | `adk-js`, `autogen`, `beeai-framework` |
| `MC-06` | OAuth or any authentication flow | absent | 5 | 1 | 2 | 0 | 2 | `mastra`, `mcp-typescript-sdk`, `pydantic-ai` |
| `MD-05` | provider router, fallback, retry, rate limiting | absent | 5 | 0 | 2 | 1 | 2 | `adk-js`, `claude-agent-sdk`, `pydantic-ai` |
| `OB-05` | datasets, scorers, LLM-as-judge, regression baselines | absent | 5 | 0 | 4 | 1 | 0 | `adk-js`, `agno`, `crewai` |
| `RT-02` | tool-calling action, one JSON call per step | implemented | 5 | 3 | 0 | 2 | 0 | `huggingface-smolagents`, `openai-agents-js`, `openhands` |
| `RT-07` | cancellation through `AbortSignal`, with `run.cancelled` | implemented | 5 | 1 | 0 | 4 | 0 | `agno`, `inngest-agent-kit`, `langgraphjs` |
| `RT-08` | middleware chain around each step | implemented | 5 | 1 | 1 | 3 | 0 | `cloudflare-agents`, `huggingface-smolagents`, `inngest-agent-kit` |
| `TL-01` | `tool()` with a Zod schema, JSON Schema for the model, runtim… | implemented | 5 | 2 | 0 | 3 | 0 | `huggingface-smolagents`, `langchainjs`, `openai-agents-js` |
| `GR-02` | a schema-validated final answer | implemented | 4 | 1 | 2 | 1 | 0 | `crewai`, `inngest-agent-kit`, `mastra` |
| `MD-04` | image or multimodal input | absent | 4 | 0 | 0 | 0 | 4 | `huggingface-smolagents`, `mastra`, `openai-agents-js` |
| `RT-03` | planning interval: a planning step every N action steps | implemented | 4 | 1 | 0 | 2 | 0 | `crewai`, `huggingface-smolagents`, `langchainjs` |
| `TL-04` | generator tools that yield intermediate output | absent | 4 | 0 | 4 | 0 | 0 | `autogen`, `strands`, `vercel-ai-sdk` |
| `CL-01` | upstream-shaped arguments and interactive setup | implemented | 3 | 0 | 0 | 0 | 2 | `agno`, `huggingface-smolagents`, `vercel-eve` |
| `DS-05` | a published artifact on the registry | absent | 3 | 0 | 0 | 0 | 3 | `claude-agent-sdk`, `cloudflare-agents`, `inngest-agent-kit` |
| `EX-08` | snapshot or restore of a live guest | absent | 3 | 1 | 2 | 0 | 0 | `agno`, `e2b`, `openhands` |
| `GR-03` | guardrails evaluated in parallel, or during streaming | absent | 3 | 0 | 3 | 0 | 0 | `mastra`, `openai-agents-js`, `voltagent` |
| `GR-04` | built-in safety, moderation or PII checks | absent | 3 | 0 | 3 | 0 | 0 | `langchainjs`, `mastra`, `voltagent` |
| `MC-04` | sampling, elicitation and roots | absent | 3 | 2 | 0 | 0 | 1 | `mcp-typescript-sdk` |
| `OB-03` | span attributes for model and tool calls, timing and usage | minimal | 3 | 0 | 0 | 3 | 0 | `adk-js`, `autogen`, `openai-agents-js` |
| `OB-07` | a pluggable event exporter or hook for a caller's own telemet… | minimal | 3 | 0 | 3 | 0 | 0 | `adk-js`, `openai-agents-js`, `voltagent` |
| `RT-04` | model streaming folded into the run's events and usage | implemented | 3 | 1 | 0 | 2 | 0 | `cloudflare-agents`, `langchainjs` |
| `TL-07` | provider-hosted tools | absent | 3 | 1 | 1 | 0 | 1 | `openai-agents-js`, `openhands`, `pydantic-ai` |
| `CL-03` | resume or approve from the terminal | absent | 2 | 0 | 2 | 0 | 0 | `adk-js`, `langgraphjs` |
| `EX-01` | QuickJS-WASM executor, the default | mature | 2 | 1 | 0 | 0 | 1 | `beeai-framework`, `cloudflare-agents` |
| `EX-06` | enforced network policy for guest code | minimal | 2 | 0 | 0 | 2 | 0 | `e2b`, `vercel-eve` |
| `EX-09` | browser automation inside the sandbox | absent | 2 | 1 | 1 | 0 | 0 | `e2b`, `huggingface-smolagents` |
| `MA-07` | nesting: a manager that is itself managed | minimal | 2 | 0 | 1 | 1 | 0 | `langgraphjs`, `voltagent` |
| `MC-02` | a server's tools adapted to our tools | implemented | 2 | 0 | 2 | 0 | 0 | `mcp-typescript-sdk` |
| `MD-01` | five adapters plus a function-defined model | implemented | 2 | 0 | 1 | 1 | 0 | `agent-framework`, `strands` |
| `MD-06` | embeddings | absent | 2 | 0 | 1 | 0 | 1 | `langchainjs`, `mastra` |
| `MD-07` | prompt caching and provider-specific options | absent | 2 | 0 | 1 | 1 | 0 | `pydantic-ai`, `vercel-ai-sdk` |
| `OB-01` | fold an event stream into one span tree | implemented | 2 | 0 | 0 | 2 | 0 | `openai-agents-js`, `voltagent` |
| `RT-05` | incremental `code.delta` event while the code block streams | implemented | 2 | 2 | 0 | 0 | 0 | `openai-agents-js` |
| `RT-11` | token and timing monitor | implemented | 2 | 1 | 0 | 1 | 0 | `huggingface-smolagents`, `vercel-eve` |
| `RT-13` | `RunResult` carrying output, steps, messages and usage | implemented | 2 | 0 | 1 | 1 | 0 | `strands` |
| `CL-05` | a REPL or multi-turn session | minimal | 1 | 0 | 0 | 1 | 0 | `adk-js` |
| `EX-07` | guest state that persists across steps of one run | implemented | 1 | 0 | 0 | 1 | 0 | `vercel-eve` |
| `RT-01` | code-as-action loop: the model writes a program, a sandbox ru… | implemented | 1 | 0 | 0 | 1 | 0 | `beeai-framework` |
| `RT-10` | typed error taxonomy with a stable `AgentErrorInfo` | implemented | 1 | 0 | 0 | 1 | 0 | `langchainjs` |
| `UI-05` | character-by-character streaming render | minimal | 1 | 0 | 1 | 0 | 0 | `vercel-ai-sdk` |
| `UI-07` | generative UI | absent | 1 | 0 | 0 | 0 | 1 | `vercel-ai-sdk` |

## 4. What each dive contributes in one line

- `huggingface-smolagents` — the upstream this port follows: the AST interpreter it calls *not* a sandbox, the step-callback registry, managed agents built as plain tool composition.
- `langgraphjs` — checkpoints and pending writes split into two records, so a resume re-applies finished writes instead of re-running them; interrupts persisted as control state.
- `mastra` — the loop as a workflow, snapshots only for pending or paused runs, claim-based resume that rejects a duplicate owner, scorers gating both the loop and CI.
- `openai-agents-js` — a versioned run snapshot with 23 readable schema versions, guardrails as a scheduling problem, handoffs with a first-transfer-only rule.
- `pydantic-ai` — output modes resolved from a model profile, typed dependency injection into every tool and hook, a journal that separates the durable engine from storage.
- `vercel-ai-sdk` — a versioned provider spec with upgrade adapters, approval as signed protocol traffic, one internal stream union feeding a narrower UI chunk protocol.
- `vercel-eve` — a turn as one durable step, deferred work parked behind a hook inbox, ownership as an explicit token and lease, approval split into request and response policies.
- `adk-js` — transfer as an enum-validated tool whose action is persisted, approvals pinned to the exact call and failing closed, the event log as the resume state machine.
- `openhands` — condensation as a forgetting event projected at read time, an event tree with a movable head, skills behind a catalog, delegation in three separate shapes.
- `beeai-framework` — per-step tool policy as inspectable requirement rules, a whole-object graph serializer with default-deny deserialization, a validator retry loop.
- `cloudflare-agents` — one durable alarm driving a job queue, resumable streams via a cursor log and a handshake, pause as a normal tool result settled by claim-before-effect.
- `mcp-typescript-sdk` — two protocol eras served at once, the full client verb set with result typing, a requirements manifest that ties tests to spec clauses.
- `claude-agent-sdk` — the closed-product contrast: a process-parked approval with no deadline, a deny-first policy ladder, transcripts as the only durability.
- `voltagent` — delegation that returns prose even on failure, memory adapters with optional tables, a real OpenTelemetry provider behind an interface.
- `agent-framework` — one pause primitive above tool approval, durability split into three small interfaces, parity held by a written decision log rather than shared code.
- `agno` — a tool-batch checkpoint marked non-terminal, approvals as database rows resolved by the host, a platform shipped inside the library wheel.
- `autogen` — termination as a composable predicate over the message delta, speaker selection as a manager call, a queue-fed run rather than a function.
- `crewai` — delegation typed at neither end, validation only at the producing task, prompt restatement as the real handoff protocol.
- `inngest-agent-kit` — step semantics handed to a durable host, ids generated inside steps, tool handlers deliberately left outside the step boundary.
- `langchainjs` — middleware that owns state and tools, structured output resolved per model, the retrieval interfaces a library of this kind is expected to carry.
- `e2b` — the sandbox product behind our remote backend: filesystem and command surface, lifecycle and metrics, metadata for finding an orphaned guest.
- `strands` — the closest in-process SDK peer: a request-owned budget with typed limit stop reasons and a continuation handle, generator tools with typed progress, and five overlapping extension layers as the cautionary example.

## 5. Ids no dive contested

These are not proof of uniqueness. They are rows where no dive filed evidence either way, which usually means the capability is invisible from the outside or too small to document.

- `RT-12` — injectable logger
- `MD-02` — streaming per adapter
- `MD-03` — tool calls, including streamed deltas
- `MD-08` — local runtimes
- `TL-03` — default tools
- `TL-08` — tool credentials and auth wiring
- `EX-02` — Pyodide executor, in process
- `EX-04` — a declared capability bag per executor
- `UI-01` — L2 hooks over `AgentSession`
- `UI-02` — L3 headless primitives
- `UI-03` — L4 patterns: run inspector and chat surface
- `UI-04` — L5 styled copy-in layer
- `UI-08` — Markdown rendering of model output
- `CL-02` — a verbosity-aware renderer for the event stream
- `CL-04` — MCP server configuration
- `DS-01` — eleven ESM packages, one facade, subpath entries
- `DS-02` — eleven-stage gate, CI on three Node versions, runtime smoke on Node, Bun and Deno
- `DS-03` — pack smoke that installs the tarballs and imports them
- `DS-04` — version identity generated from the manifests and checked
- `DS-06` — documentation site built from this tree
- `DS-07` — runnable examples
- `DS-08` — a benchmark or performance harness

## 6. How to use this file

Read the C column first: it is the part of the field we had not described to ourselves. Then read the lane briefs, which turn the raw rows into designs: `15-durability-design-brief.md`, `16-models-and-output-brief.md`, `17-multi-agent-brief.md`, `18-security-and-guardrails-brief.md`, `19-tools-and-execution-brief.md`. The ordered answer to "what first" is in `20-ranked-backlog.md`, and the corrections to our own rows are in `30-findings-about-us.md`.

A row count is evidence of attention, not of value. Three dives filing a C row for the same thing means the field converged; one dive filing it may mean one company's opinion. The briefs are where that distinction is argued.
