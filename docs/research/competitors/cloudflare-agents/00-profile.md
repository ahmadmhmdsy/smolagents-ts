# cloudflare-agents — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/cloudflare/agents |
| register row | Tier 1 deep dive, wave 3, focus "durable agents on Durable Objects, scheduling, resumable streams" |
| licence | GitHub reports SPDX `MIT`; `LICENSE` at the clone root is the MIT text, with `NOTICE`, `THIRD_PARTY_LICENSES.md` and a `licenses/` directory beside it |
| read commit | `4e891252c28b653eae9ac7e82ab903bf90997d66`, committed 2026-10-21 14:50:41 +0100, subject `fix(examples): use a SQLite-backed Durable Object in dynamic-workers-playground (#2642)` |
| clone | `reference/competitors/cloudflare-agents`, shallow (`--depth 1`), worktree clean at the read |
| version read | `packages/agents/package.json` reports `0.29.0` |
| language and stack | TypeScript on Cloudflare Workers; pnpm workspaces driven by Nx; oxfmt and oxlint; Vitest through `@cloudflare/vitest-pool-workers`; `tsdown` builds; Node 24 or newer for the workspace |
| size signal | GitHub reports 44,867 KB; `packages/agents/src/index.ts` is 10,390 lines, `packages/think/src/think.ts` 19,982 and `packages/ai-chat/src/index.ts` 7,825, all measured at the read commit |
| documentation source | the clone ships the site's Markdown under `clone:/docs/agents/`, published at https://developers.cloudflare.com/agents/ |

## What it is

The Agents SDK is Cloudflare's first-party way to build a stateful agent on Workers, and its
central decision is that the agent *is* a Durable Object. `Agent` extends
`DurableObject` directly (`packages/agents/src/index.ts:1106`) and composes a vendored
`Lifecycle` substrate that owns fetch, the single alarm and hibernating WebSockets
(`packages/agents/src/lifecycle/durable-object-lifecycle.ts:168`). Nothing in the package
invents a durability store: the object's own SQLite database, its alarm and its hibernated
connections are the storage, the clock and the transport.

On that host primitive sit reusable capabilities: durable state, a job queue, a scheduler, a
durable stream log, replayable tasks, WebSockets, session memory, an MCP client and dynamic
sub-agents. The agent-facing class adds typed state sync, callable RPC, schedules, facet
routing and agent-tools on top. Two hosts consume all of it: `@cloudflare/ai-chat` with
`AIChatAgent`, and `@cloudflare/think` with `Think`, sharing a chat layer that lives in the core
package as `agents/chat`.

The repository is broad beyond chat: `@cloudflare/codemode` runs model-written programs against
connectors with a durable pause-for-approval runtime, `voice` ships a full realtime stack,
`browser` and `websearch`/`webfetch` wrap platform services, and an experimental harness tree
hosts CLI agents in containers. The published docs mirror that breadth with 49 pages under
`clone:/docs/agents/`.

The claim worth studying is not "agents with memory". It is that every durable behaviour a
framework normally implements in a library — retries, resumes, schedules, transcripts, partial
streams, child agents — is expressed as a row, a queue entry or a facet on the hosting object,
so the process can be evicted between any two awaits and the object wakes with the same
answers.

## Why it is in the register

Our baseline puts the durability story at HL-03 and HL-04: a checkpoint between steps behind a
`RunStore` seam, with only an in-memory store shipped, no mid-step replay (HL-05) and no
durable store implementation (HL-09). This repository is the most complete public answer to the
question those rows ask, because the platform underneath it supplies exactly the three things a
checkpointer wants and a Node process does not have: transactional local storage, a durable
timer and connection survival across eviction.

It also speaks to rows outside HL. Its `codemode` package is the code-as-action loop of RT-01
with a real sandbox boundary and an approval pause. Its scheduler, stream log and sub-agent
facets are capabilities we either lack or hold as a seam (MA-01, MA-04, HL-02). Reading it shows
what the mature version of each costs in surface area, which is what a priced gap needs.

## How it is positioned against us

| dimension | cloudflare-agents | our baseline |
|---|---|---|
| execution substrate | one Durable Object per agent identity, SQLite inside, one alarm, hibernation | a Node process; no host durability |
| agent loop | no loop library; a host class plus two chat hosts, model calls via the AI SDK | `MultiStepAgent` code-as-action loop (RT-01, RT-02) |
| run durability | journaled task steps replayed from the top on every attempt (HL-05 shape) | checkpoint per step behind `RunStore`; memory store only (HL-03, HL-04, HL-09) |
| resumable streaming | durable chunk log plus an explicit resume handshake and SSE cursor replay | absent; a run's events are in-process (RT-04, RT-09) |
| scheduling | `Scheduler` over the Lifecycle job queue, cron/date/interval, persisted | absent |
| sub-agents | facets: a child DO with its own storage, typed stub, nested URL routing | managed agent called as a tool (MA-01); no parallel or shared state (MA-04, MA-05) |
| human-in-the-loop | the run pauses as a normal tool output, a durable claim resumes it later | approval gate fails one call; nothing suspends (HL-01, HL-02) |
| MCP | client manager with OAuth and persisted servers, plus three server lanes | client only (MC-01, MC-02); server authoring is a non-goal (MC-07) |
| session memory | `Sessions` capability: messages, chunks, compactions, attachments | per-run checkpoint naming one run (HL-08) |
| multi-tenant routing | identity from the DO id, URL routing, parent/child paths | none |
| distribution | published npm packages, wrangler deployment, 56 example directories | eleven packages, unpublished (DS-05) |

## Limits of this read

- No build, test or script from the clone was run, and no dependency was installed. Every
  statement about runtime behaviour comes from source, from the repository's own design records,
  or from reasoning that is labelled `inferred` in the other files.
- `packages/think/src/think.ts` (19,982 lines) and `packages/ai-chat/src/index.ts` (7,825 lines)
  were read in regions, not end to end; the region boundaries are listed in `04-sources.md`.
- The experimental harness tree under `packages/agents/src/harness/` and the container harness
  entries were listed but not read; they are outside this dive's focus and are marked as such.
- `examples/`, `guides/`, `openai-sdk/`, `site/` and the `openai-sdk` examples were sampled,
  not read. They are evidence that a pattern is demoed, never evidence that it works.
- The documentation under `clone:/docs/` is treated as `declared` evidence. The live site was
  not fetched, so a page's current content may differ from this commit.
- Licence scope: `licenses/` and `THIRD_PARTY_LICENSES.md` were listed, not read line by line.
  The vendored lifecycle substrate is described as ISC-attributed by the repository's own
  `design/rfc-durable-object-lifecycle.md`; that attribution was not independently verified.
- No benchmark, no load test and no published-artifact inspection. Size and line counts are
  measurements of this checkout, not of the published tarballs.
