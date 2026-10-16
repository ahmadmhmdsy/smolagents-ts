# Research — the agent-framework landscape and this port's feature gaps

**Contract**
- **Role:** the evidence behind the post-0.1.0 roadmap: which capabilities the
  field treats as table stakes, and which this port ships today.
- **Mutability:** frozen once filed. The field moves; this is pinned to the
  revision and the date it was read.
- **Read when:** choosing what v1.1+ builds, or re-checking why a capability is
  in or out of scope.
- **Update when:** a competitor ships something that changes the gap, or the
  owner re-scopes.

- **Owner:** owner
- **Started:** 2026-10-16
- **Related:** the scope decision it feeds, its plan, and the task rows it opens.

## Question

These products are the neighbours a TypeScript team would reach for instead of
this port. Which capabilities do they ship that this port does not, and in what
order should this port close the gaps without abandoning its code-first,
isomorphic shape?

## Method

Read the vendor docs, repository READMEs and published comparison pages listed
under Sources, and compared the union of their advertised capabilities against
this port's shipped surface (`docs/01-project.md`, `docs/04-tasks.md`, the
`packages/` tree). No code was written or run. Capability claims are the
vendors' own framing, not verified by execution.

## What this port ships today

Sandboxed code-as-action (QuickJS-WASM by construction, plus a Pyodide
executor), one `MultiStepAgent` loop with `CodeAgent` / `ToolCallingAgent`
shapes, a typed `AgentEvent` stream built for rendering a run, a tool seam
(`tool()` + `ToolCollection`), a hand-rolled MCP **client**, model adapters over
`fetch` (Google, OpenAI-compatible, Anthropic) plus a local-runtime slot, and an
isomorphic core that runs on Node, Bun, Deno and the browser with no native
binary. It is a faithful port of Hugging Face `smolagents`.

## Results — capabilities they ship that we do not

| # | Capability | Who treats it as table stakes | This port |
|---|---|---|---|
| 1 | Multi-agent (agents-as-tools / handoffs / supervisor) | OpenAI Agents SDK JS, Mastra, LangGraph.js, Google ADK, LangChain.js | none (upstream `managed_agents` not ported) |
| 2 | Guardrails + tripwires | OpenAI Agents SDK (tripwires), LangChain.js | none |
| 3 | Human-in-the-loop / approvals / interrupts | OpenAI Agents SDK, LangGraph.js, Mastra | none |
| 4 | Durable execution / checkpoint / resume | LangGraph.js, Inngest AgentKit, Mastra | none (a run is in-memory) |
| 5 | Cross-run session + persistent memory + store | Mastra, LangGraph.js, OpenAI Agents SDK (`Session`) | none |
| 6 | RAG / vector store / data connectors | Mastra, Vercel AI SDK, LangChain.js | none |
| 7 | Tracing exporters (OTel) + evals | OpenAI Agents SDK, Mastra, LangChain.js | none |
| 8 | Dev UI / Studio | Mastra, LangGraph (Studio), ADK | none (a static example only) |
| 9 | Structured output (schema-bound final answer) | OpenAI Agents SDK, Vercel AI SDK | partial (typed tools, not the final answer) |
| 10 | Streaming transport + generative UI | Vercel AI SDK, Mastra | partial (async event stream, no transport/UI protocol) |
| 11 | Provider router / fallback / local runtimes | Vercel AI SDK, Mastra, LangChain.js | partial (multi-provider, no router/fallback) |
| 12 | Sandbox "workspace" (fs, shell, snapshots) | Cloudflare Agents, Inngest, Claude Agent SDK | none (that is by design; the code seam is the sandbox) |
| 13 | Voice / realtime | OpenAI Agents SDK | none |
| 14 | MCP **server** authoring | Mastra, OpenAI Agents SDK | none (client only) |
| 15 | Multimodal + browser/hosted tools | OpenAI Agents SDK, Mastra | none |
| 16 | A2A (agent-to-agent protocol) | Google ADK | none |
| 17 | Broad default tool set | LangChain.js, Mastra | small (few built-ins) |
| 18 | Deployment / hosting | Inngest, Cloudflare, Mastra | explicit non-goal |

## What we ship that they do not

- **Code-as-action sandboxed by construction.** The model writes a program; it
  runs inside QuickJS-WASM, not in the host process. Most neighbours run tools
  in the host runtime and reach for a container when they need isolation.
- **Isomorphic core, no native binary.** Node, Bun, Deno and the browser from
  one build — the WASM executors are the reason.
- **A typed step/event stream designed for rendering a run**, not only for
  logging.
- **A zero-key browser demo** that runs the whole loop client-side.
- **Upstream fidelity** as an explicit goal, which keeps the semantics legible
  to anyone who knows `smolagents`.

## Reading

The gaps sort into two kinds. **Production gaps** — multi-agent, HITL +
resumable runs, tracing/evals, session memory, guardrails + structured output,
provider routing — are things a team adopting this for real work hits within a
week, and they compose with the existing seams (a managed agent is a tool; a
checkpoint is a serialized step list; an exporter consumes `AgentEvent`). The
**platform gaps** — RAG/vector, dev UI/Studio, streaming transport, multimodal,
voice, A2A, MCP server, workspace sandboxing, deployment — are whole products
in their own right and would each pull the port away from being a library.

Recommended order: (1) multi-agent, (2) durable runs + HITL, (3) tracing +
evals, (4) persistent session/memory + store, (5) guardrails + structured
output, (6) provider router / local runtimes. Everything else stays a
candidate, revisited when a user asks.

## Sources

Vendor and project documentation read on 2026-10-16:

- OpenAI Agents SDK for TypeScript — https://openai.github.io/openai-agents-js/
- Mastra — https://mastra.ai/docs
- Vercel AI SDK — https://ai-sdk.dev/docs
- LangGraph.js / LangChain.js — https://js.langchain.com/docs
- Google Agent Development Kit — https://google.github.io/adk-docs/
- Claude Agent SDK — https://docs.claude.com/en/api/agent-sdk/overview
- Cloudflare Agents — https://developers.cloudflare.com/agents/
- Hugging Face smolagents (the reference this port follows) — https://huggingface.co/docs/smolagents
