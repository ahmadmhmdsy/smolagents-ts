# LangGraph.js — sources and reading log

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Provenance

| field | value |
|---|---|
| repository | `langchain-ai/langgraphjs` |
| clone url | `https://github.com/langchain-ai/langgraphjs` |
| clone path | `reference/competitors/langgraphjs` (gitignored) |
| commit | `6e845706b9a7d12f85e9477722908cc9f7003521` |
| commit date | `2026-10-21T12:30:03Z`, clone depth 1, tree clean |
| clone date | 2026-10-21 |
| licence | MIT (`LICENSE:1-3`) |
| repository metadata | GitHub API read 2026-10-21: default branch `main`, not archived, 3,371 stars, pushed `2026-10-21T13:03:01Z` |

No file in the clone was executed, installed, built or tested. Discovery used
`git clone --depth 1`, `gh api`, targeted greps and `Get-ChildItem`; evidence
comes from source, manifests and the documentation bundle.

## Repository sources read

| area | paths | depth |
|---|---|---|
| graph builder | `libs/langgraph-core/src/graph/state.ts`, `graph/annotation.ts` | builder, node and compile paths |
| scheduler | `libs/langgraph-core/src/pregel/loop.ts`, `runner.ts`, `algo.ts` | loop and runner full; `algo.ts` around interrupt and writes |
| run surface | `libs/langgraph-core/src/pregel/index.ts` | defaults, state reads, update, stream, invoke |
| types and constants | `libs/langgraph-core/src/pregel/types.ts`, `constants.ts` | full type file and naming constants |
| channels | `libs/langgraph-core/src/channels/*.ts` | every channel class, delta channel in detail |
| interrupts and streaming | `libs/langgraph-core/src/interrupt.ts`, `pregel/io.ts`, `pregel/stream.ts`, `stream/types.ts` | full read of the small files, chunk and protocol types |
| checkpoint contract | `libs/checkpoint/src/base.ts`, `types.ts`, `memory.ts`, `serde/jsonplus.ts` | record, saver and memory implementation |
| durable savers | `libs/checkpoint-sqlite/src/index.ts`, `libs/checkpoint-postgres/src/migrations.ts`, `src/sql.ts` | schema, writes, upserts; store modules skimmed |
| conformance | `libs/checkpoint-validation/README.md` | read |
| prebuilt and multi-agent | `libs/langgraph-core/src/prebuilt/*.ts`, `libs/langgraph-supervisor/src/*.ts`, `libs/langgraph-swarm/src/*.ts` | parameter and loop paths; small packages full |
| remote and SDK | `libs/langgraph-core/src/pregel/remote.ts`, `libs/sdk/src/client/*` | class surface only |
| manifests | root and every `libs/*/package.json`, `pnpm-workspace.yaml` | names, versions, exports, engines, overrides |
| tests | `libs/langgraph-core/src/tests/durability.sync.test.ts`, `time_travel_extended.test.ts`, `interrupt.test.ts`, `checkpointer.test.ts`, `python_port/` | the cases cited in the inventory |
| documentation | clone `docs/docs/concepts/` pages listed below | read in the mirror and at the published URLs |

## Documentation pages read

Base URL `https://langchain-ai.github.io/langgraphjs/`; all read 2026-10-21.
The clone keeps these pages under `docs/docs/`, so documentation citations in
the inventory use URLs plus this date instead of clone paths: a path starting
with `docs/` would collide with this project's path convention.

- `.../concepts/persistence/` — threads, checkpoints, pending writes, history, store.
- `.../concepts/time-travel/` — replay from a checkpoint and the `xyz-fork` branch.
- `.../concepts/human_in_the_loop/` — the interrupt function, resume values, the re-execution warning, multiple interrupts, pending-task shape.
- `.../concepts/breakpoints/` — static breakpoints and the legacy node interrupt.
- `.../concepts/streaming/`, `.../concepts/functional_api/` — modes, events, entrypoints and tasks.
- `.../concepts/langgraph_server/`, `.../concepts/double_texting/` — server surfaces and concurrent-run policies.
- `.../concepts/sdk/`, `.../concepts/deployment_options/`, `.../versions/` — clients, hosting and the versions index.

## Not read, and why

- `libs/checkpoint-mongodb` and `libs/checkpoint-redis` internals: recorded as declared, never as implemented.
- `libs/langgraph-api` workers, storage adapters and queue implementation: declared from docs and file presence only.
- `libs/langgraph-ui`, the framework SDK packages and Studio: UI surfaces, outside this dive.
- `libs/langgraph-cua`, `libs/create-langgraph` and most prebuilt helpers: peripheral to the state-machine question.
- The Python package, release history, issues and pull requests: separate repository or different question.

## Evidence handling

The clone is untrusted data. Its root `AGENTS.md` contains agent-directed
instructions; it was read as content, recorded in the profile, and not
followed. Quotations are at most five lines. No secret-shaped value was
copied. Paths cited without a leading directory are relative to the clone
root, and every line number refers to the pinned commit only. One wide grep
returned mostly test matches; later discovery used targeted greps and reads at
the matched line, except the small modules read in full.

## Search trail

Terms that paid off: `durability`, `checkpointDuring`, `WRITES_IDX_MAP`,
`interruptCounter`, `checkpoint_ns`, `snapshotFrequency`, `Send`, `TASKS`,
`withStructuredOutput`, `Command.PARENT`, `text/event-stream`,
`getDeltaChannelHistory`.
