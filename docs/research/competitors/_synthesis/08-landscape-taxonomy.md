# The landscape in six archetypes — a reading map for the study

**Contract**
- **Role:** the map of this study, for a reader entering the tree after the register.
- **Mutability:** frozen at the dives it describes; the tree may grow past it.
- **Read when:** choosing a neighbour to read, or asking where this port sits.
- **Update when:** a new dive adds an archetype or changes a verdict; never edit.

The twenty-one filed dives sort by where a run's control flow lives, not by
language or licence. Two projects can share every feature and still be different
archetypes, because one makes the model decide the next step and the other makes
an edge decide it. Depth varies: a D2 folder has no `01-architecture.md`, and its
`03-gap-and-lessons.md` is a short note rather than a full table. Row ids below
come from `docs/research/competitors/_synthesis/00-our-baseline.md`.

## 1. Six archetypes

### 1.1 The loop-first SDK

Control lives in one program: the model chooses an action, the library executes
it, the result joins the messages, and a while loop asks again. The library owns
the budget, the cancellation signal and the result object, and nothing above it
needs to exist.

This is our archetype. smolagents specialises one abstract loop into a code agent
and a tool-calling agent (`docs/research/competitors/huggingface-smolagents/00-profile.md:28-34`);
strands adds lifecycle state to the same shape and ships a TypeScript SDK
(`docs/research/competitors/_synthesis/05-long-tail-coverage.md:118-128`);
openai-agents-js walks a comparable run in fifteen numbered moves
(`docs/research/competitors/openai-agents-js/01-architecture.md:54-70`);
langchainjs supplies interfaces and one ReAct agent rather than a runtime
(`docs/research/competitors/langchainjs/00-profile.md:22-27`); voltagent borrows
the loop from the Vercel AI SDK and hangs its own features off that call
(`docs/research/competitors/voltagent/00-profile.md:44-49`).

Easy: tools, streaming, structured output, one result, approval at a call site.
Hard: a run identity that outlives the process, a pause longer than a callback,
parallel branches, and any control flow the model did not author. The archetype
stresses our runtime rows directly — RT-01, RT-02, RT-06, RT-07, RT-09, RT-13,
plus GR-01 and TL-01 (`docs/research/competitors/_synthesis/00-our-baseline.md:19-31`).

### 1.2 The graph or state-machine engine

Control is data. Nodes declare input and output, edges or predicates decide what
runs next, and the engine commits state at each superstep. LangGraph is the pure
form: a compiled graph over a Pregel loop whose checkpoint saver is a first-class
interface (`docs/research/competitors/langgraphjs/01-architecture.md:36-50`).
ADK reaches the same place from the agent side — every agent is a node, and the
composite agents are deprecated in favour of `Workflow` because the graph adds
routing, retries, human input and resumability (`docs/research/competitors/adk-js/01-architecture.md:35-56`).
Agent Framework states it outright: the workflow engine is the centre of gravity
(`docs/research/competitors/agent-framework/00-profile.md:28-34`). Mastra rewrites
the agent loop itself as a workflow (`docs/research/competitors/mastra/01-architecture.md:47-57`),
and CrewAI adds an event-driven flow layer beside crews
(`docs/research/competitors/crewai/02-features-inventory.md:87-97`).

Easy: branching, retries, replay, human interrupts, subgraphs, an auditable run.
Hard: improvising; declaring state schemas; keeping one explanation for users who
wanted a loop; expressing control the model should own. The archetype stresses
RT-03, MA-02, MA-05, MA-06, HL-03, HL-04, HL-07 and GR-03
(`docs/research/competitors/_synthesis/00-our-baseline.md:21-67`).

### 1.3 The workflow-durability platform

Control is rented. A host world executes steps, records them, retries them and
resumes them; the library supplies step definitions and ids. eve hands the turn to
a step and lets the deployment world decide what survives
(`docs/research/competitors/vercel-eve/01-architecture.md:94-107`, `:168-172`).
Cloudflare turns one Durable Object alarm into a scheduler and a task journal
(`docs/research/competitors/cloudflare-agents/01-architecture.md:72-97`).
Inngest's agent kit never calls a model inside a plain function: it asks for step
tools with deterministic ids so the platform can replay around them
(`docs/research/competitors/inngest-agent-kit/02-features-inventory.md:29-41`).
agno and voltagent ship both halves — the SDK plus an operations product
(`docs/research/competitors/agno/00-profile.md:28-33`).

Easy: crash recovery, queues, schedules, resumable streams, approvals that outlive
a process. Hard: use without the host, local parity, portability, and debugging
that crosses a world boundary. The archetype stresses HL-02 through HL-06, MA-04,
RT-07 and OB-01 (`docs/research/competitors/_synthesis/00-our-baseline.md:41-55`).

### 1.4 The kernel or actor runtime

Control is addressed. An agent is an identity, the runtime routes messages or
events, and state belongs to each participant rather than to a call stack.
AutoGen is the clearest case: two verbs, one for request-reply and one for topic
fan-out (`docs/research/competitors/autogen/00-profile.md:34-40`). OpenHands
derives conversations from an append-only event tree and leases a conversation to
one owner (`docs/research/competitors/openhands/01-architecture.md:127-148`).
pydantic-ai keeps the loop but adds a first-party harness of coding capabilities
and a journal for in-flight calls (`docs/research/competitors/pydantic-ai/01-architecture.md:21`,
`:138-145`).

Easy: decoupled participants, background agents, tracing that follows a message,
per-agent state. Hard: ordering and determinism, shared state, operating the
runtime, and saving all the wiring — AutoGen's own save omits subscription state
(`docs/research/competitors/autogen/03-gap-and-lessons.md:109-110`). It stresses
MA-05, MA-06, RT-08, TL-08, OB-02 and MC-04
(`docs/research/competitors/_synthesis/00-our-baseline.md:42-108`).

### 1.5 The protocol layer

Control is negotiated. There is no run to own: capabilities, versions, transports
and message schemas are the product, and a run is somebody else's business.
The MCP TypeScript SDK is the reference implementation, and its whole shape is
the protocol split between two wire eras, with strict capability and schema
checks on every call (`docs/research/competitors/mcp-typescript-sdk/00-profile.md:40-46`).
A2A is the sibling boundary: ADK mounts an agent card, JSON-RPC and REST handlers
(`docs/research/competitors/adk-js/01-architecture.md:162-170`), and beeai's server
adapters speak it beside MCP (`docs/research/competitors/beeai-framework/00-profile.md:30-33`).

Easy: interoperability, capability negotiation, auth layers, generated schemas.
Hard: no durability or run semantics at all, version churn, strictness at every
layer, and conformance as the real work. It stresses MC-01 through MC-07, TL-06,
TL-07 and DS-01 (`docs/research/competitors/_synthesis/00-our-baseline.md:128-134`).

### 1.6 The product shell

Control is owned by the product. The SDK is a handle — a subprocess, a service
call, an HTTP session — and the runtime ships in the product. claude-agent-sdk
spawns a bundled CLI per session and drives it over stdio
(`docs/research/competitors/claude-agent-sdk/00-profile.md:27-37`). OpenHands is
explicitly a code-agent product with a server that owns conversations and a Canvas
client for rendering (`docs/research/competitors/openhands/00-profile.md:38-44`).
agno's AgentOS and control plane, voltagent's console and CrewAI's hosted platform
are the same move in smaller pieces.

Easy: turnkey tools, permissions, sessions, billing, a UI. Hard: embedding,
portability, offline use, testing, and any control the vendor did not expose — a
pending approval parks inside a live process
(`docs/research/competitors/claude-agent-sdk/00-profile.md:77`). It stresses
HL-02, CL-01 through CL-05, UI-01 through UI-06 and OB-06
(`docs/research/competitors/_synthesis/00-our-baseline.md:51-157`).

## 2. The three structural bets

### 2.1 Durability belongs in the runtime

Platforms bet everything on it: eve, Cloudflare and Inngest treat the step as the
unit a host can replay, and their design records are about claims, journals and
versions (`docs/research/competitors/cloudflare-agents/02-features-inventory.md:74-77`). LangGraph and Mastra bet partially: mode flags in one, pause-shaped
snapshots in the other, with write amplification measured in its own tests
(`docs/research/competitors/mastra/01-architecture.md:165-177`). The loop-first
SDKs mostly abstain — claude-agent-sdk resumes a transcript, openai-agents-js
snapshots a turn. The bet is working where a host exists: nobody questions crash
recovery on a Durable Object. It is not working portably: LangGraph's honest
guarantee is state, not effects, and its default mode is the weak one
(`docs/research/competitors/langgraphjs/03-gap-and-lessons.md:160-180`).

### 2.2 Orchestration is a graph

LangGraph, ADK, Agent Framework, Mastra and CrewAI's flows all express control
flow as data, and the reason is compositional: once the run is a graph, retries,
replay, interrupts and subgraphs reuse one mechanism. The evidence is ADK
deprecating its composite agents for the graph, and Agent Framework ordering
agents as executors on a workflow engine (`docs/research/competitors/adk-js/01-architecture.md:48-51`;
`docs/research/competitors/agent-framework/00-profile.md:32-34`). The bet is not fully working: each
project teaches a second vocabulary, state schemas are a tax, and an agent-authored
program sits awkwardly inside a declared graph. The counter-bet — handoffs and
lifecycle state in a loop — keeps winning where the model is meant to decide.

### 2.3 Agents are products

claude-agent-sdk wraps a product, OpenHands is a product, agno and voltagent sell
consoles, CrewAI sells a platform, Inngest sells a cloud. The bet is that adoption
and revenue accrue to the operated whole, not to the library. It is working for
distribution and operations; it is failing for embedders, which is why pydantic-ai
ships a library plus an optional harness (`docs/research/competitors/pydantic-ai/01-architecture.md:21`)
and why every product shell has an SDK handle. The two bets are not exclusive — the same project often sells both — but a
library that stays a library never becomes the product, and our decision 0018
keeps hosting out on purpose.

## 3. The gaps between archetypes

**Nothing here is WASM-first in the browser.** Our default executor is QuickJS-WASM
and the second is Pyodide in process (EX-01, EX-02), and the gate smoke-runs Node,
Bun and Deno (DS-02). No neighbour does the equivalent: LangGraph ships a browser
build but only to keep Node side effects out, with no in-browser executor
(`docs/research/competitors/langgraphjs/01-architecture.md:52-56`); Cloudflare's
edge runtime is an isolate, not a tab (`docs/research/competitors/cloudflare-agents/01-architecture.md:72-75`);
eve needs a workflow world; e2b is a hosted sandbox service
(`docs/research/competitors/e2b/00-profile.md:25-30`). Is that a market or a
niche? Today a niche: the buyers are demos, offline tools and privacy-sensitive
pages, and nobody budgets for it as a product line. It is also the only position
in this tree that no incumbent can copy without rewriting its runtime, which is
why it is worth keeping even without a market.

**Typed event contracts shared with the UI are half-solved.** We have a typed
event stream and React layers over it (RT-09, UI-01, UI-02), but no wire protocol
(UI-06 is a recorded non-goal). vercel-ai-sdk owns the space from the other end:
a UI message stream protocol with framework bindings and a chunk vocabulary
(`docs/research/competitors/vercel-ai-sdk/02-features-inventory.md:78-84`), and
eve and Cloudflare own resumable byte streams with cursors. None publishes a
typed run-event contract that a client can resume from, with approvals as
messages. That looks like a market with an incumbent on one side and a niche on
the other: either compete on the wire format, or stay a rendering library.

**Verified distribution is not a gap anyone can sell.** We ship eleven packages
with one facade and a gate that checks versions and packed imports (DS-01 through
DS-04); we do not ship a published artifact yet (DS-05). The strongest neighbours
treat verification as table stakes — LangGraph ships a conformance harness for
third-party savers (`docs/research/competitors/langgraphjs/01-architecture.md:20`),
the MCP SDK validates every result locally, Agent Framework keeps a parity
decision log. This is hygiene, not differentiation, and pricing it as a market
would be dishonest.

**What none of them does at all:** a run record portable across languages (ADK's
shared schema is the closest attempt, and it is a database contract, not a run
format; `docs/research/competitors/adk-js/01-architecture.md:127-129`), an approval identity that survives a process and can be resolved by a
different service, or replay that is verifiable across code versions. Those are
integration gaps between archetypes, and they are exactly where our durability lane
lands.

## 4. Where this port sits

We are a loop-first SDK with a kernel inside. The loop is model-authored code
(RT-01), the executor is in core and defaults to a WASM sandbox (EX-01, EX-02),
the run emits typed events and a React layer renders them (RT-09, UI-01), and the
checkpoint lands between steps (HL-03). That triple — code as action, sandbox in
the same package, typed events out — is not shared by any filed neighbour.
smolagents is the upstream shape, strands is the closest lifecycle peer,
langchainjs is the closest interface library, and the durability platforms are the
closest answer to a question we have only started to ask. We are not an archetype
3 or 4 because there is no host and no addressed runtime, and not an archetype 6
because there is no product.

Two moves would change the archetype rather than improve it. First, make the
executor an addressed, leased kernel: a service contract with capability
negotiation, a run lease and a transport, so a remote or background agent becomes
a participant rather than an adapter behind EX-03. That moves us into the actor
runtime and reopens decision 0018 on workspaces and deployment. Second, publish the
run as a wire contract: events plus resume and approve verbs over a transport-neutral
record, so another process or a browser can drive a run. That is the
workflow-durability platform without owning a host, and it needs HL-04, HL-10 and a
decision on UI-06. Improving the current archetype — more adapters, better docs,
another rendering layer — changes none of this.

## 5. How to read the rest of the tree

1. `docs/research/competitors/README.md` — the register: what was chosen, at what
   depth, and the focus line for each row. Its statuses can lag the folders; a
   filed five-file folder is a D3 regardless of the board.
2. This file — place the neighbour in an archetype before reading it, so a
   feature you find is read as a consequence of its control model.
3. `docs/research/competitors/_method.md` — evidence rules, buckets, effort sizes
   and what a filed dive must contain.
4. `docs/research/competitors/_synthesis/00-our-baseline.md` — the row ids and
   statuses every gap file cites. Read it before any `03`.
5. One dive, in order: `00-profile.md`, then `01-architecture.md` if present,
   then `02-features-inventory.md`, then `03-gap-and-lessons.md`, then
   `04-sources.md`. A D2 folder has no `01`; that absence is the depth
   difference, not a filing mistake.
6. Lane briefs: `docs/research/competitors/_synthesis/15-durability-design-brief.md`
   for resume and checkpoint questions, and `16-models-and-output-brief.md` for
   the model seam and typed output.
7. `docs/research/competitors/_synthesis/30-findings-about-us.md` before trusting
   a baseline row, and `05-long-tail-coverage.md` for what was registered but not
   dived.
8. `10-gap-matrix.md` and `20-ranked-backlog.md` are still to be written as of
   this date; until they land, the `03` gap tables are the interim matrix, and
   the two lane briefs are the interim design record.

Every pointer in this file was already recorded in a filed dive or the baseline;
the map adds no new evidence and should not be cited as if it did.
