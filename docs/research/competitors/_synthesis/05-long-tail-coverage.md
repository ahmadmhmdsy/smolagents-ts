# Long-tail coverage — neighbours we did not dive

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read.
- **Read when:** asking what was considered and left out of the research tree.
- **Update when:** a newer sweep supersedes it; never edit.

## What this file is

The register names fourteen deep dives (`docs/research/competitors/README.md:47-60`) and
seven profiles (`docs/research/competitors/README.md:66-72`). This file records the rest
at D1, the depth defined in `docs/research/competitors/_method.md`: identity, licence,
language, what it is, how it controls a run, the one capability that would matter to us,
and a verdict — with the reading surface and its limits stated below.

A verdict is not a quality judgement: `ignore` means no action, `watch` means track
without spending a dive, `promote` means it deserves a D2 profile. Nothing here is
cloned; each entry was read on 2026-10-21 from README, licence file and metadata through
the GitHub API, because the environment's web-fetch tool failed with a
provider-registration error, so linked documentation sites were located and not opened
and no claim rests on a docs page.

## Python frameworks with real adoption

### microsoft/semantic-kernel

- **licence and language:** MIT
  ([licence API](https://api.github.com/repos/microsoft/semantic-kernel), 2026-10-21);
  C# first, with Python and Java SDKs in the same repository
  ([repo](https://github.com/microsoft/semantic-kernel), 2026-10-21).
- **what it is:** a model-agnostic SDK for agents and multi-agent systems, with plugins,
  memory, planners, vector stores and a process framework. Its README now opens by
  saying it is superseded by Microsoft Agent Framework 1.0, with a migration guide
  ([README](https://github.com/microsoft/semantic-kernel), 2026-10-21).
- **loop or control model:** an agent runtime over a kernel of plugins and functions,
  plus a process framework for structured workflows and group-chat style multi-agent
  orchestration ([README](https://github.com/microsoft/semantic-kernel), 2026-10-21).
- **the capability that matters to us:** one tool boundary over native functions, prompt
  templates, OpenAPI specs and MCP servers
  ([README](https://github.com/microsoft/semantic-kernel), 2026-10-21).
- **D1 verdict:** ignore — the project is in handover, and `microsoft/agent-framework`
  already holds a D2 row in the register (`docs/research/competitors/README.md:72`);
  profiling Semantic Kernel now would spend a dive on a migration path.

### deepset-ai/haystack

- **licence and language:** Apache-2.0
  ([licence API](https://api.github.com/repos/deepset-ai/haystack), 2026-10-21); Python
  only ([repo](https://github.com/deepset-ai/haystack), 2026-10-21).
- **what it is:** an orchestration framework for production RAG and agent applications,
  built from modular pipelines with explicit control over retrieval, routing, memory and
  generation ([README](https://github.com/deepset-ai/haystack), 2026-10-21).
- **loop or control model:** a component graph, not an agent loop: typed components are
  wired into a directed pipeline, and routing is expressed as edges rather than as a
  model-decided step ([README](https://github.com/deepset-ai/haystack), 2026-10-21).
- **the capability that matters to us:** declared inputs and outputs at every step, so a
  pipeline can be inspectable before it runs
  ([README](https://github.com/deepset-ai/haystack), 2026-10-21).
- **D1 verdict:** watch — a clean answer to "what runs next", but Haystack is
  Python-only and retrieval-shaped, while our loop is model-driven and graph edges would
  be a second control model to explain.

### stanfordnlp/dspy

- **licence and language:** MIT
  ([licence API](https://api.github.com/repos/stanfordnlp/dspy), 2026-10-21); Python
  only ([repo](https://github.com/stanfordnlp/dspy), 2026-10-21).
- **what it is:** programming rather than prompting: compositional Python modules whose
  prompts and weights are tuned by algorithms instead of hand-written
  ([README](https://github.com/stanfordnlp/dspy), 2026-10-21).
- **loop or control model:** no fixed loop; a program is a graph of declarative
  signatures and modules, and an optimizer compiles it into better prompts or weights
  for a target metric ([README](https://github.com/stanfordnlp/dspy), 2026-10-21).
- **the capability that matters to us:** the compile step — a program becomes a value
  that can be optimised against a metric and then evaluated, instead of a prompt edited
  by hand ([README](https://github.com/stanfordnlp/dspy), 2026-10-21).
- **D1 verdict:** watch — the idea matters to how we evaluate and tune prompts, but DSPy
  is Python-only and is not a runtime we could host; it is a reference for an eval seam,
  not a competitor loop.

## The TypeScript side

### run-llama/llamaindex — TypeScript package

- **licence and language:** MIT
  ([licence API](https://api.github.com/repos/run-llama/LlamaIndexTS), 2026-10-21);
  TypeScript with a server-side focus; the Python `run-llama/llama_index` is the active
  product ([repo](https://github.com/run-llama/LlamaIndexTS), 2026-10-21).
- **what it is:** a data framework for LLM applications in JavaScript runtimes —
  document ingestion, indexes, retrievers and agents around an index
  ([README](https://github.com/run-llama/LlamaIndexTS), 2026-10-21).
- **state:** deprecated. The README opens with "This project is deprecated and no longer
  maintained"; the last push is 2026-03-11, against 2026-10-21 for the Python repository
  ([README](https://github.com/run-llama/LlamaIndexTS), 2026-10-21;
  [repo](https://github.com/run-llama/llama_index), 2026-10-21).
- **loop or control model:** retrieval-first: an index and a query pipeline with agents
  layered on top, not an agent loop that treats retrieval as a tool
  ([README](https://github.com/run-llama/LlamaIndexTS), 2026-10-21).
- **the capability that matters to us:** document ingestion and index abstraction, the
  part of a retrieval product that a TS port would otherwise have to rebuild
  ([README](https://github.com/run-llama/LlamaIndexTS), 2026-10-21).
- **D1 verdict:** ignore — the TypeScript side is abandoned and the live Python project
  is outside a TypeScript port's vocabulary; recorded so the npm package is not mistaken
  for a supported option.

## An agent SDK close to our shape

### strands-agents — Python and TypeScript

- **licence and language:** Apache-2.0
  ([licence API](https://api.github.com/repos/strands-agents/harness-sdk), 2026-10-21);
  one repository for the Python and TypeScript SDKs, `@strands-agents/sdk` in TypeScript
  and `strands-agents` in Python
  ([README](https://github.com/strands-agents/harness-sdk), 2026-10-21). The older
  `strands-agents/sdk-python` URL resolves to this repository
  ([repo](https://github.com/strands-agents/harness-sdk), 2026-10-21).
- **what it is:** an SDK for building and running agents in-process, pitched explicitly
  at people who would otherwise write their own loop, with no hosted control plane
  ([README](https://github.com/strands-agents/harness-sdk), 2026-10-21).
- **loop or control model:** a model-driven loop with lifecycle controls — turn limits,
  token budgets, cancellation and stop reasons — plus tools, structured output, MCP,
  multi-agent patterns, memory, sessions, streaming, guardrails, tracing and evals
  ([README](https://github.com/strands-agents/harness-sdk), 2026-10-21).
- **the capability that matters to us:** lifecycle controls as first-class state — a
  stop reason and a budget belong to the run, not to the caller's bookkeeping
  ([README](https://github.com/strands-agents/harness-sdk), 2026-10-21); this is the
  same seam as RT-04, RT-06 and RT-13 in the baseline.
- **D1 verdict:** promote to a D2 profile. It is the closest architectural peer after
  langchainjs — in-process, model-driven, no hosted plane — it now ships a TypeScript
  SDK, and its lifecycle vocabulary is directly comparable to our run result. The README
  already lists the capability set, so the profile is cheap.

## Design writing, not software

### humanlayer — the deprecated repo and 12-factor-agents

- **licence and state:** the repository carries an Apache-2.0 LICENSE
  ([LICENSE](https://github.com/humanlayer/humanlayer), 2026-10-21), though the GitHub
  API reports "Other" ([repo](https://github.com/humanlayer/humanlayer), 2026-10-21).
  The code repository is deprecated by its own README ("the code here is pretty much all
  deprecated") and points at a rebuild
  ([README](https://github.com/humanlayer/humanlayer), 2026-10-21); the 12-factor
  writing is separately licensed, code Apache-2.0 and content CC BY-SA 4.0
  ([README](https://github.com/humanlayer/12-factor-agents), 2026-10-21).
- **what it is:** a human-in-the-loop product whose durable contribution is an argument:
  an agent is a loop you own, with tools, state, control flow and human contact as
  explicit parts ([README](https://github.com/humanlayer/12-factor-agents), 2026-10-21).
- **loop or control model:** factor 8 is "own your control flow" and factor 10 is "small
  focused agents": keep the loop in your code and treat tools, humans and state as
  structured calls rather than framework features
  ([factor 8](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-08-own-your-control-flow.md),
  2026-10-21).
- **the capability that matters to us:** "contact humans with tools" — approval and
  clarification as a tool call, with the pending request serialised like any other step
  ([factor 7](https://github.com/humanlayer/12-factor-agents/blob/main/content/factor-07-contact-humans-with-tools.md),
  2026-10-21); this is the shape HL-01 and HL-02 need.
- **D1 verdict:** ignore the repository and watch the writing: a design input for
  approvals and interrupts, not a codebase to profile.

## Browser agents

### browser-use/browser-use

- **licence and language:** MIT
  ([licence API](https://api.github.com/repos/browser-use/browser-use), 2026-10-21);
  Python for the library, with TypeScript also described in the README, and a hosted
  cloud and CLI beside it ([README](https://github.com/browser-use/browser-use),
  2026-10-21).
- **what it is:** a browser agent library: an `Agent` takes a task and an LLM and drives
  a local or cloud browser to complete it
  ([README](https://github.com/browser-use/browser-use), 2026-10-21).
- **loop or control model:** the model chooses browser actions in a loop until its own
  finish signal, and the library owns the browser session, the action vocabulary and the
  observation format ([README](https://github.com/browser-use/browser-use), 2026-10-21).
- **the capability that matters to us:** the action and observation surface that makes a
  browser usable as a tool rather than as an API client
  ([README](https://github.com/browser-use/browser-use), 2026-10-21).
- **D1 verdict:** ignore — a domain agent rather than a substrate, and its cloud is a
  deployment product that decision 0018 keeps out. If `packages/tools` ever gains a
  browser tool, this is the reference to read.

### browserbase/stagehand

- **licence and language:** MIT
  ([licence API](https://api.github.com/repos/browserbase/stagehand), 2026-10-21);
  TypeScript ([repo](https://github.com/browserbase/stagehand), 2026-10-21).
- **what it is:** an SDK for browser agents that exposes three primitives rather than a
  whole agent: `act` performs an action, `observe` returns selectors, and `extract`
  returns schema-validated data ([README](https://github.com/browserbase/stagehand),
  2026-10-21).
- **loop or control model:** no loop of its own; the caller's loop drives the
  primitives, which self-heal on a redesign and keep credentials out of the model by
  returning selectors rather than values
  ([README](https://github.com/browserbase/stagehand), 2026-10-21).
- **the capability that matters to us:** AI-native browser primitives with a schema at
  the boundary, the shape a browser tool would need
  ([README](https://github.com/browserbase/stagehand), 2026-10-21).
- **D1 verdict:** ignore for now — nothing here belongs in the loop or the tool registry
  of an isomorphic core; recorded so a future browser tool has a known reference.

## Durable execution as a substrate

### temporalio — the service and the TypeScript SDK

- **licence and language:** MIT for the server and the SDK
  ([service](https://github.com/temporalio/temporal),
  [SDK](https://github.com/temporalio/sdk-typescript), 2026-10-21); the server is Go and
  the SDK TypeScript ([repo](https://github.com/temporalio/temporal), 2026-10-21).
- **what it is:** a durable execution engine: workflows are deterministic code replayed
  over an event history, activities are the side-effecting steps, and the service owns
  timers, retries and recovery ([README](https://github.com/temporalio/sdk-typescript),
  2026-10-21).
- **loop or control model:** workflows and activities, with deterministic replay as the
  contract: the workflow's state is the event history, so a crashed worker resumes by
  replaying and skipping completed activities
  ([README](https://github.com/temporalio/sdk-typescript), 2026-10-21).
- **the capability that matters to us:** durable run state with resumable steps — the
  problem behind HL-09 and the deferred half of RT-13 — solved by replay rather than by
  serialising a snapshot ([README](https://github.com/temporalio/sdk-typescript),
  2026-10-21).
- **D1 verdict:** watch as a substrate reference — replay is the strongest alternative
  to our snapshot thinking, but a server-governed runtime contradicts an in-process,
  isomorphic core.

### restatedev — Restate and its TypeScript SDK

- **licence and language:** the server is Business Source License 1.1, source-available
  and not OSI ([LICENSE](https://github.com/restatedev/restate), 2026-10-21); the
  TypeScript SDK is MIT ([repo](https://github.com/restatedev/sdk-typescript),
  2026-10-21); the server is Rust and the SDK TypeScript
  ([repo](https://github.com/restatedev/restate), 2026-10-21).
- **what it is:** durable execution for ordinary async/await code: handlers are durably
  executed, stateful RPC endpoints that run in long-lived processes or as functions
  ([README](https://github.com/restatedev/sdk-typescript), 2026-10-21).
- **loop or control model:** a handler is a service method whose effects are journaled,
  so retries replay the handler but skip completed effects, with durable timers and
  state in the same context ([README](https://github.com/restatedev/sdk-typescript),
  2026-10-21).
- **the capability that matters to us:** the journalled-handler model applied to plain
  TypeScript, the closest durable-execution design to our code
  ([README](https://github.com/restatedev/sdk-typescript), 2026-10-21).
- **D1 verdict:** watch with a licence caveat: the BUSL server can be read for design
  and never vendored, so no adoption path exists for a library that must stay portable.

## smolagents ports in TypeScript

The upstream is Hugging Face's `smolagents` (Apache-2.0, Python), which this port
follows at D3 (`docs/research/competitors/README.md:50`). Two unofficial TypeScript
ports are discoverable on npm and GitHub as of 2026-10-21, both small, one stale.

- **`yusuf-eren/smolagents.js`** — TypeScript, 5 stars, last push 2025-08-10, no licence
  file on GitHub while the npm package `smolagents.js` declares MIT at 0.1.5, last
  modified 2025-08-01 ([repo](https://github.com/yusuf-eren/smolagents.js), 2026-10-21;
  [npm](https://registry.npmjs.org/smolagents.js), 2026-10-21). Its README calls it an
  unofficial port with tool calling, streaming, code execution, Zod tool schemas and
  OpenAI-first models ([README](https://github.com/yusuf-eren/smolagents.js),
  2026-10-21).
- **`ahmadmhmdsy/smolagents-ts`** — Apache-2.0, TypeScript, 0 stars, pushed 2026-10-21,
  described as an independent, unofficial TypeScript port of HuggingFace smolagents
  ([repo](https://github.com/ahmadmhmdsy/smolagents-ts), 2026-10-21).
- **D1 verdict:** ignore both as competitors, but their existence is worth a register
  line: they confirm the upstream has pull outside Python. Both are single-package ports
  with one loop, one model path and Node-style execution, and neither ships sandboxes
  beyond in-process code, a capability bag read before the run, typed run events, or an
  isomorphic core; `smolagents.js` is also stale and licence-inconsistent between GitHub
  and npm, and `smolagents-ts` has no adoption. Rust and Go ports show the same pattern
  ([repo](https://github.com/akshayballal95/smolagents-rs), 2026-10-21), which is a
  demand signal rather than a threat.

## How this list was chosen and what it excludes

Two passes on 2026-10-21. First, the register was read against the wider landscape and
every category with no row was named: large Python frameworks, the TypeScript side, an
agent SDK shaped like ours, design writing, browser agents, durable-execution
substrates, and ports of our upstream. Second, each candidate was checked through the
GitHub API and the two ports found by npm and GitHub search.

- **Rows already registered at D1** — `openai-agents-python`, `adk-python`, `swarm`,
  `livekit-agents`, `langfuse` and `openllmetry` have register rows with reasons
  (`docs/research/competitors/README.md:78-83`); repeating them here would fork the
  register.
- **Python siblings of dives** — consulted only when a JS port lags, by the register's
  own rule.
- **Hosted products, clouds, voice and realtime, plus tools and eval products:** Browser
  Use Cloud, Azure hosting, Restate Cloud and LangSmith are deployment products, voice
  packages are already registered, and eval and MCP-server packages are components a
  framework profile already covers; decision 0018 keeps the hosted half out.
- **Anything that needed a clone** — no source was read beyond README, licence and
  manifest metadata; a claim that would need source reading is left out.
- **Legal review** — licences come from the GitHub licence API and, where it disagreed,
  from the licence file; the BUSL entry is marked rather than judged.

## What to fold into the register

- **Promote:** `strands-agents/harness-sdk` as a D2 profile row, for the reason given in
  its block.
- **Watch:** `stanfordnlp/dspy`, `deepset-ai/haystack`, `temporalio`, `restatedev`,
  `ahmadmhmdsy/smolagents-ts`.
- **Ignore, with the reasons above:** `microsoft/semantic-kernel` (superseded by a row
  already present), `run-llama/LlamaIndexTS` (deprecated), `humanlayer/humanlayer` (code
  deprecated; the writing is a design input), `browser-use/browser-use` and
  `browserbase/stagehand` (domain agents), `yusuf-eren/smolagents.js` (stale).
- The register itself is unchanged by this file; the Lead folds these verdicts in.
