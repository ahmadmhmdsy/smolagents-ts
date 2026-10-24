# Competitor and neighbour research — index

**Contract**
- **Role:** the register of neighbours this port is measured against.
- **Mutability:** rewrite-in-place; the status board tracks live progress.
- **Read when:** before any capability, roadmap or pricing decision.
- **Update when:** a dive lands, a repo is added, or a status changes.

**Status:** research record. Not a design, not a decision, not a commitment.
**Owner:** owner
**Started:** 2026-10-21
**Filed:** 2026-10-21 — twenty-one repositories, 13,105 lines of research, 533 gap rows. One addendum dive followed on 2026-10-24: `deepseek-harness`, filed after the synthesis and before this register's next rewrite.
**Related:** [the capability baseline](_synthesis/00-our-baseline.md), [the method](_method.md), [the gap matrix](_synthesis/10-gap-matrix.md), [the ranked backlog](_synthesis/20-ranked-backlog.md), the earlier landscape survey `docs/research/2026-10-16-agent-framework-landscape.md`, decision 0018 and decision 0019.
**Licence position:** no competitor code is copied into this repository. Clones live under `reference/competitors/`, which is gitignored. Files under this tree describe behaviour and cite `path:line` pointers; they quote at most a few lines where the wording itself is the evidence.

## What this tree is for

The 2026-10-16 landscape survey compared vendor documentation against our shipped surface. It produced eighteen capability gaps in one pass. That was enough to write a roadmap and not enough to design anything: it did not say how a neighbour implements a capability, what state it keeps, what API shape it settled on after breaking changes, or what it deliberately refuses to do.

This tree closes that. One repository at a time: clone it at a pinned commit, read the implementation, and record — per capability — how it works, what it is built on, why it exists, and what it would cost us to match. The unit of progress is one repository folder, and a folder is either filed or not.

## How to read it

1. [`_method.md`](_method.md) — depth levels, evidence standard, per-repository file contract, clone layout, licence and safety rules.
2. [`_synthesis/00-our-baseline.md`](_synthesis/00-our-baseline.md) — what we ship today, capability by capability, with a stable row id. Every gap file cites these ids.
3. [`_synthesis/08-landscape-taxonomy.md`](_synthesis/08-landscape-taxonomy.md) — six archetypes, three structural bets, and where this port sits.
4. One folder per repository, four or five files in the same order: profile, architecture (D3 only), features, gaps and lessons, sources.
5. [`_synthesis/10-gap-matrix.md`](_synthesis/10-gap-matrix.md) — the cross-repository table: which baseline row each dive filed against, and how often.
6. [`_synthesis/20-ranked-backlog.md`](_synthesis/20-ranked-backlog.md) — the ordered answer to "what first", with seam, effort and risk.
7. The lane briefs: [`15-durability`](_synthesis/15-durability-design-brief.md), [`16-models-and-output`](_synthesis/16-models-and-output-brief.md), [`17-multi-agent`](_synthesis/17-multi-agent-brief.md), [`18-security-and-guardrails`](_synthesis/18-security-and-guardrails-brief.md), [`19-tools-and-execution`](_synthesis/19-tools-and-execution-brief.md).
8. [`_synthesis/30-findings-about-us.md`](_synthesis/30-findings-about-us.md) — the corrections this study makes to our own rows, and the claims about our difference it did not support.

## Depth levels

| level | what it means | what it produces |
|---|---|---|
| **D3 — deep** | cloned at a pinned commit; the loop, the state model and the seam code read at source; every claim cites `path:line` | five files, feature inventory, gap analysis with effort |
| **D2 — profile** | cloned shallow or documentation read; top-level architecture and the capability set recorded, source spot-checked | profile, features table, short gap note, sources |
| **D1 — register** | not cloned; identity, licence, relevance and the reason for the depth choice recorded | one register row plus a paragraph |

A D3 dive is deliberately expensive. It is spent where a capability on our roadmap (S7 to S11 and the seams they extend) has a mature implementation worth reverse-engineering, or where a neighbour's central claim overlaps ours (code-as-action, isomorphic core, sandboxed execution).

## The register

Every candidate found in the 2026-10-21 sweep, with the depth it got and why. A row is a promise about this tree, not a judgement about the project.

### Tier 1 — deep dives (D3), all filed

| slug | repository | licence | focus | status |
|---|---|---|---|---|
| `huggingface-smolagents` | `huggingface/smolagents` | Apache-2.0 | the upstream this port follows: managed agents, streaming, CLI, tools, telemetry | filed, 778 lines |
| `langgraphjs` | `langchain-ai/langgraphjs` | MIT | durable graph execution, checkpointers, interrupts | filed, 791 lines |
| `mastra` | `mastra-ai/mastra` | Apache-2.0 except an `ee/` folder; the API reports NOASSERTION | workflows, memory, evals, MCP server, studio | filed, 701 lines |
| `openai-agents-js` | `openai/openai-agents-js` | MIT | handoffs, guardrails, sessions, tracing, tool loop | filed, 659 lines |
| `pydantic-ai` | `pydantic/pydantic-ai` | MIT | structured output, dependency injection, evals, durable execution | filed, 805 lines |
| `vercel-eve` | `vercel/eve` | Apache-2.0 | durable, filesystem-first backend agents; resumable turns | filed, 741 lines |
| `vercel-ai-sdk` | `vercel/ai` | Apache-2.0 in the tree; the API reports NOASSERTION | model abstraction, tool calling, UI stream protocol, structured output | filed, 575 lines |
| `adk-js` | `google/adk-js` | Apache-2.0 | multi-agent transfer, sessions and state, callbacks, A2A | filed, 728 lines |
| `openhands` | `OpenHands/software-agent-sdk` | MIT | the runtime behind the OpenHands product: event tree, condensation, skills, delegation | filed, 700 lines |
| `beeai-framework` | `i-am-bee/beeai-framework` | Apache-2.0 | TypeScript and Python agents, workflows, observability | filed, 627 lines |
| `cloudflare-agents` | `cloudflare/agents` | MIT | durable agents on Durable Objects, scheduling, resumable streams | filed, 829 lines |
| `claude-agent-sdk` | `anthropics/claude-agent-sdk-typescript` | none open; wrapper is Anthropic commercial terms | subagents, hooks, permission modes, skills, session resume | filed at D2, 465 lines |
| `voltagent` | `VoltAgent/voltagent` | MIT | supervisor and subagents, memory, workflows, observability | filed, 647 lines |
| `mcp-typescript-sdk` | `modelcontextprotocol/typescript-sdk` | transition notice: Apache-2.0 code, CC-BY-4.0 docs | the reference MCP client and server: resources, prompts, sampling, auth | filed, 620 lines |

The `openhands` row changed subject mid-study: `OpenHands/OpenHands` is now a React client that states it does not execute actions or provide isolation. The runtime was read in `OpenHands/software-agent-sdk`, and the client clone supplied the product-contract rows. Both commits and both licences are in that folder's `04-sources.md`.

### Tier 2 — profiles (D2), all filed

| slug | repository | licence | why it is profiled | status |
|---|---|---|---|---|
| `langchainjs` | `langchain-ai/langchainjs` | MIT | the breadth reference: tools, retrievers, vector stores, agent middleware | filed, 488 lines |
| `agno` | `agno-agi/agno` | Apache-2.0 | agent OS: memory, knowledge, teams, workflows, evals; Python only, the TypeScript product is a separate UI repo | filed, 466 lines |
| `crewai` | `crewAIInc/crewAI` | MIT | crews and flows: role-based delegation and event-driven orchestration | filed, 455 lines |
| `autogen` | `microsoft/autogen` | MIT for code, CC-BY-4.0 for content; archived | the event-driven runtime and group chat, kept as historical evidence | filed, 500 lines |
| `inngest-agent-kit` | `inngest/agent-kit` | Apache-2.0 | durable agent workflows on a step-function substrate | filed, 495 lines |
| `e2b` | `e2b-dev/E2B` | Apache-2.0 | the sandbox service our `exec-remote` E2B backend speaks to | filed, 600 lines |
| `agent-framework` | `microsoft/agent-framework` | MIT | a newer entrant with workflows, one pause primitive and telemetry | filed, 435 lines |
| `strands` | `strands-agents/harness-sdk` | Apache-2.0 | the closest in-process SDK peer, with lifecycle controls matching our runtime rows | filed at D2, 483 lines |

### Tier 3 — registered, not dived (D1)

The long tail is covered in one file rather than one folder each: [`_synthesis/05-long-tail-coverage.md`](_synthesis/05-long-tail-coverage.md) records ten more frameworks and packages at D1, with a verdict per row.

| slug | repository | why only registered |
|---|---|---|
| `openai-agents-python` | `openai/openai-agents-python` | the Python sibling of a D3 dive; consult it only when the JS port lags |
| `adk-python` | `google/adk-python` | the Python original of a D3 dive |
| `swarm` | `openai/swarm` | the minimal handoff reference the OpenAI SDK replaced |
| `livekit-agents` | `livekit/agents` | voice and realtime, which decision 0018 keeps out |
| `langfuse` | `langfuse/langfuse` | an observability product, not a framework; relevant to S9 exporters only |
| `openllmetry` | `traceloop/openllmetry` | the OpenTelemetry GenAI convention in practice; relevant to a future exporter |
| `_long-tail` | eleven more, see the file | semantic-kernel, haystack, dspy, LlamaIndex, humanlayer, browser-use, stagehand, temporal, restate and two smolagents ports, each with a verdict |

### Addendum — post-synthesis dives

| slug | repository | licence | why it was added | status |
|---|---|---|---|---|
| `deepseek-harness` | `deepseek-ai/deepseek-harness` | MIT | the harness this project is developed inside: agent teams, durable sessions, a typed subagent seam, approvals and the plugin composition model; added on the owner's request and filed after the synthesis | filed, five files, read at `687f282e86` |

The addendum is read for the same reason as a tier-1 dive: it is the mature
implementation of a capability on the roadmap (multi-agent delegation, Phase 2). Its
files cite the baseline rows and mark genuinely new proposals as `*new*` rather than
inventing row ids, because the baseline is frozen to the synthesis revision.

## How a dive is judged

A dive is filed only when all five of these hold.

1. The clone's commit is recorded and the licence file is read, not assumed.
2. Every capability claim in `02-features-inventory.md` cites a file and line in the clone, or a documentation URL with the date read.
3. The gap file cites baseline row ids and buckets each gap as defined in the baseline.
4. `03-gap-and-lessons.md` names at least one pattern worth copying with a `path:line` pointer, and at least one thing the neighbour does that we should not copy.
5. The validator runs clean: no unresolved `docs/` path, no secret, no duplicate sentence across files, a Contract block in every file.

## Reading order when acting on this

The synthesis files are written last and are the entry point for a decision: the matrix says who has what, the backlog says what to build first and why. A single dive is read when designing that one capability, not before.

## What this tree is not

It is not a feature-count contest. A capability a neighbour ships because it is a platform is recorded and bucketed as a non-goal, not queued. The port's differentiator — a model-authored program, executed in a real sandbox, in a core that runs in a browser tab — is the constraint every recommendation is measured against.
