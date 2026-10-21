# LangGraph.js (`langchain-ai/langgraphjs`) — profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Identity**

| field | value |
|---|---|
| repository | https://github.com/langchain-ai/langgraphjs |
| clone | `reference/competitors/langgraphjs` (shallow, gitignored) |
| commit | `6e845706b9a7d12f85e9477722908cc9f7003521` |
| commit date | 2026-10-21T12:30:03Z |
| read date | 2026-10-21 |
| read depth | D3 — source read, no build, no test run |
| licence | MIT (`LICENSE`, clone root); SPDX confirmed by `gh api repos/langchain-ai/langgraphjs` |
| language | TypeScript, ESM-first, pnpm 10.27.0 workspace + turbo |
| root engines | Node `^22.11 || ^24 || >=26` (`package.json:4-6`) |
| core engines | Node `>=18` (`libs/langgraph-core/package.json:6-8`) |
| runtime package | `@langchain/langgraph@1.5.1` at `libs/langgraph-core` |
| checkpoint package | `@langchain/langgraph-checkpoint@1.2.0` at `libs/checkpoint` |
| scale | 41,754 KB clone, 3,371 stars, default branch `main`, not archived (gh api, 2026-10-21) |

**What the project is**

A durable graph runtime for model-driven programs, not an agent loop with a
graph veneer. Nodes are async functions; edges and branches decide the next
superstep; a channel layer folds node writes into state; and every superstep
can be checkpointed to a pluggable saver so a run resumes on another process
or another day. The README-level pitch is graphs plus persistence plus
human-in-the-loop; the code is a BSP scheduler written from scratch.

The repository is a monorepo with three audiences: the library
(`libs/langgraph-core`, re-exported by the private facade `libs/langgraph`),
the persistence layer (`libs/checkpoint` and four database savers plus a
conformance harness), and the deployment stack (`langgraph-api`,
`langgraph-cli`, `langgraph-ui`, `sdk`, framework SDKs). Ecosystem packages
(`langgraph-supervisor`, `langgraph-swarm`, `langgraph-cua`) build topologies
on the graph primitive rather than inside the core.

The core is also shipped for the browser: the package export map resolves the
root condition to `dist/web.js` for browsers while the Node entry performs an
AsyncLocalStorage initialisation side effect (`libs/langgraph-core/package.json:72`;
`libs/langgraph-core/src/index.ts:1-8`). This is the nearest neighbour to our
isomorphic-core claim and the reason this dive reads the runtime rather than
only the docs.

**Why it is in the register**

The register keeps this repository for the durability and multi-agent rows of
`docs/research/competitors/_synthesis/00-our-baseline.md`, where our surface is
thin or absent. The mapping that drove the read:

| baseline row | ours | what this repository settles |
|---|---|---|
| HL-02 | absent | a pending human decision as serialized, resumable state |
| HL-04 | minimal | resuming a named run in another process, with saver choices |
| HL-05 | absent | what recovery after a mid-step crash actually replays |
| HL-06 | absent | interrupt and resume with a caller-supplied value |
| HL-07 | absent | replay and fork from checkpoint N, with branch history |
| HL-08 | minimal | thread identity across many runs, and sub-run namespaces |
| HL-09 | absent | memory, SQLite, Postgres, MongoDB and Redis saver shapes |
| HL-10 | absent | a versioned checkpoint record and additive migrations |
| MA-02 | absent | handoff as a tool returning a routing command |
| MA-06 | absent | supervisor and swarm topologies shipped as packages |
| RT-09 | implemented | a typed, namespaced stream protocol with SSE encoding |

**How it is positioned against us**

Their centre of gravity is the server: threads, runs, a task queue, cron and
webhooks are product surfaces (`https://langchain-ai.github.io/langgraphjs/concepts/langgraph_server/`, read 2026-10-21), and
the library exists to make those durable. Our centre is the model-authored
program executed in a sandbox, with a small typed loop and an event stream.
So this is not a head-to-head competitor: they have no sandbox, no code
execution and no browser guest, while we have no graph DSL, no checkpointer
and no cross-process interrupt today. The useful overlap is narrow and deep —
the semantics of durable state, which we are about to design behind
`RunStore`.

**Limits of this read**

Source was read at the pinned commit; no dependency install, build, test or
example was executed. Published documentation was read through its site
mirror in the clone and by URL, on the date in the identity table. Version
numbers are the workspace ones at that commit and will drift. The platform
server (`libs/langgraph-api`) was read only at its entry points and storage
modules; the React SDKs, the CUA package, the MongoDB and Redis saver
internals and the Python original were spot-checked at most. Runtime claims
are therefore `implemented` when an end-to-end source path was traced, and
`declared` when only a type or a doc asserts the behaviour.

The clone ships a nine-line `AGENTS.md` telling coding agents to run a tool
called Corridor's `analyzePlan` before writing code. That is vendor content in
an untrusted tree; it is reported here as content and was not obeyed.
