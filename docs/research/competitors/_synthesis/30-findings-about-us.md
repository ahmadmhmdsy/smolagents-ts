# What the competitor study says about us

**Contract**
- **Role:** the corrections this study makes to our own capability baseline and to the project records that describe it.
- **Mutability:** rewritten whenever a dive contradicts a recorded fact; corrections are never silently dropped.
- **Read when:** before trusting a baseline row, a roadmap status, or a claim about what makes this port different.
- **Update when:** a dive lands, a correction is accepted, or a stale record is closed.

**Measured:** 2026-10-21, against `main` at `59b295f`, using the dives filed under this tree.
**Rule:** a correction is listed only when the neighbour's source or our own source was read. A suspicion stays in the dive, not here.

This file is deliberately uncomfortable. The baseline was written from our code, and fourteen repositories were then read against it. Where they disagree with us, the disagreement wins.

## 1. Rows that need a different shape

| id | recorded as | what the dives show | action |
|---|---|---|---|
| RT-05 | implemented, but T-30 says the event is never emitted | per-chunk emission is pinned by our own test; three dives flagged the contradiction | close T-30; keep the row |
| GR-05 | a boolean `structuredOutput` capability | provider support is a mode, not a flag; profiles declare which modes a family allows | replace the boolean with an enum plus per-model facts |
| GR-06 | absent, framed as error handling | neighbours treat repair as a message appended to history with a retry budget | reframe as a bounded repair loop |
| HL-09 | stores for run state | the split that matters is engine versus storage, not store count | reframe before designing HL-05 |
| HL-10 | absent, priced L | one version integer plus read-side branches is enough | price S; drop the migration framework |
| MA-02 | control transfer mixed with delegation | a child as a callable tool is delegation; transfer needs a persisted action | sharpen the row so the two mechanisms stay distinct |
| MD-05 | one router row | seven retry layers sit behind that row; the useful one is output repair | split the row before scheduling it |
| MD-08 | non-goal | decision 0019 reopens local runtimes, so the row is routable | move out of bucket B |

Each of these is a wording defect with a design consequence. A boolean where the field has three modes will produce an API that cannot express the providers we support.

## 2. Capabilities that have no row at all

The baseline is a list of what we chose to track. Six dives found capabilities that matter and were not tracked, so no gap row could key to them.

| candidate | capability | who ships it | bucket | effort |
|---|---|---|---|---|
| HL-11 | condensation as an event, projected at read time | openhands, eve, openai-agents-js | C | M |
| HL-12 | an audit record for each approval decision | eve, openai-agents-js, claude | C | S |
| GR-07 | guardrails at the tool boundary, on arguments and results | pydantic-ai, openai-agents-js | C | M |
| MD-09 | a provider spec version with upgrade adapters | vercel-ai-sdk | C | L |
| MD-10 | retrieval interfaces: embeddings, vector store, retriever | langchainjs, agno | C | L |
| TL-09 | a skill or procedure catalog invoked on demand | openhands, eve, claude, agno | C | M |
| MC-08 | agent-to-agent interop | adk-js | C | L |
| EX-10 | moving tools and variables into a remote guest | upstream smolagents | C | M |
| DS-09 | a conformance suite for a published seam | langgraphjs, claude, mcp-typescript-sdk | C | S |
| RT-11 | injecting a steering message into a running turn | eve, claude | C | M |

Two of these are cheap and unblock more than they cost: the approval audit record and the conformance suite. Both are S, and both make a seam that already exists testable by someone else.

## 3. Records that contradict the tree

| record | says | evidence | action |
|---|---|---|---|
| T-30 | `code.delta` is declared but never emitted | `packages/core/src/agent/multi-step-agent.ts:632`, `:682` emit per chunk; `packages/core/test/core-loop-fixes.test.ts:338` pins it | close T-30 as done |
| plan rows for S7–S11 | complete | the capability surface matches | no action |

T-30 is the only task row this study found to be stale, and it is stale in the direction that costs us: an open task that describes a bug we do not have.

## 4. Claims about our difference that did not survive

Three claims were used in planning. Only the third survives in the form it was made.

| claim | verdict | why |
|---|---|---|
| code-as-action with a sandbox is our differentiator | too strong | pydantic-ai ships Code Mode with a sandbox and host-tool bridging; openhands and upstream smolagents also write and run code |
| a typed event stream for rendering is ours alone | too strong | at least eight neighbours expose a typed stream; several are resumable |
| an isomorphic core that runs in a browser with no key is ours alone | holds | the combination of an in-browser WASM executor, a zero-key demo and one core across four runtimes was not found elsewhere |

The defensible claim is narrower and better: code-as-action is the core loop rather than a capability, the executor backends are pluggable, and the whole thing runs where no competitor runs. The dives found nobody shipping a QuickJS-WASM default executor as a library.

## 5. Where the study found us ahead

Balance matters in a file like this, so these are the places where a dive looked for a capability and found ours better, not merely different.

- The step and event model is typed and stable enough to render; neighbours stream text and let a UI infer structure.
- The default executor is small, has no native binary and runs in a browser tab; every code-first neighbour needs a process or a remote service.
- Managed agents ship as tool composition with a prompt section; some neighbours gate the same idea behind a server.
- The gate is eleven stages with pack, publint and attw; no neighbour matched that verification depth in the packages read.

## 6. What this study cannot settle

- Nothing in this tree was executed. Every behavioural claim is a read of source, a documentation statement or an inference, and each dive marks which.
- No benchmarks were run, so no claim here about speed or token cost is measured.
- Two dives stopped at documentation: claude-agent-sdk has no open licence, and mastra reads as `NOASSERTION` on the API.
- The D2 profiles read the package surface and the docs, not every module.
- A capability being absent from a dive means the dive did not see it, not that the neighbour lacks it.

## 7. Consequences for the next baseline revision

When the baseline is next rewritten, it should gain the ten rows in section 2, reshape the eight rows in section 1, and carry a link to this file so a future reader knows which rows were audited. The audit itself is a one-off, and it does not need repeating until a neighbour does something structural.
