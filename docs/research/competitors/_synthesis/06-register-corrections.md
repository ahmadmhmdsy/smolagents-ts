# Register corrections after the filed dives

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

This file lists what `docs/research/competitors/README.md` must say now that the dives are filed. It is evidence for the register, not a replacement for it: the Lead edits the register, this file records the delta and the reason. Every licence below, except the marked `strands-agents` row, was read from the dive's own licence gate in its `04-sources.md`; every commit comes from its `00-profile.md` or `04-sources.md`; every gap count was taken by counting rows in its `03-gap-and-lessons.md` on 2026-10-21, against dives read on the same day. Anything the tree did not let me check is marked unverified. **Errata, after this check:** `strands` was filed at `79e0f89` with Apache-2.0 confirmed through the API, four files and 483 lines, so its row below can be read as verified rather than pending.

Twenty-one folders are filed, each with `00`, `02`, `03` and `04`; thirteen also carry `01-architecture.md`. Adding the one repository row below makes twenty-two repository rows in the register, thirteen at D3 and nine at D2. "Files" in the status board is the Markdown file count in the folder, five for a D3 dive and four for a D2 dive.

## 1. Row corrections

### Tier 1 — deep dives (`docs/research/competitors/README.md:45-60`)

- `openai-agents-js` (:47): status "in progress" → "filed — D3, `304e436`". Licence MIT and the focus line are already correct.
- `langgraphjs` (:48): "in progress" → "filed — D3, `6e84570`". MIT confirmed.
- `mastra` (:49): "Apache-2.0 (verify)" → "Apache-2.0 for the repository except the `ee/` directories, which carry their own `ee/LICENSE`; GitHub answers `NOASSERTION` because of that carve-out"; "in progress" → "filed — D3, `b2d8623`".
- `huggingface-smolagents` (:50): "in progress" → "filed — D3, `96f33fa`". Apache-2.0 confirmed against `LICENSE`.
- `pydantic-ai` (:51): "in progress" → "filed — D3, `1d79209`". MIT confirmed.
- `vercel-eve` (:52): "planned" → "filed — D3, `c543585`". Apache-2.0 with `NOTICE`, confirmed.
- `vercel-ai-sdk` (:53): "Apache-2.0 (verify)" → "Apache-2.0 declared by the 552-byte `LICENSE` notice and `AGENTS.md:11`; GitHub answers `NOASSERTION`"; "planned" → "filed — D3, `e741656`".
- `adk-js` (:54): "planned" → "filed — D3, `df491a9`". Apache-2.0 confirmed.
- `openhands` (:55): repository `OpenHands/OpenHands` → "two repositories: `OpenHands/software-agent-sdk` for the runtime the focus describes, and `OpenHands/OpenHands` for Agent Canvas, the React client"; licence "MIT for both"; "planned" → "filed — D3, runtime `9cb22f5`, client `b70dd46`".
- `beeai-framework` (:56): "planned" → "filed — D3, `2a1069c`". Apache-2.0 confirmed; the repository's own badge calls it Beta, which is the project's status, not the register's.
- `cloudflare-agents` (:57): "planned" → "filed — D3, `4e89125`". MIT confirmed.
- `claude-agent-sdk` (:58): licence "verify" → "no open licence: no SPDX id, `LICENSE.md` is a copyright line pointing at Anthropic's Commercial Terms, and npm declares `SEE LICENSE IN README.md`"; depth D3 → D2, because the wrapper repository holds no agent source; "planned" → "filed — D2, `9c59e06`".
- `voltagent` (:59): "planned" → "filed — D3, `72a46c7`". MIT confirmed; the licence file is spelled `LICENCE`.
- `mcp-typescript-sdk` (:60): "verify" → "`NOASSERTION`: the repository `LICENSE` is a transition statement, Apache-2.0 for new code and specifications and CC-BY-4.0 for documentation"; "planned" → "filed — D3, `c05225a`".

### Tier 2 — profiles (`docs/research/competitors/README.md:64-72`)

- `autogen` (:69): "MIT (verify)" → "CC-BY-4.0 for documentation (`LICENSE`, 305 lines) and MIT for code (`LICENSE-CODE`); the package manifests point at the MIT file"; focus "group chat, code executors, agent runtime" → "actor runtime, team control plane, termination and speaker selection, event log; archived 2026-10-16, with Microsoft Agent Framework named as successor".
- `agno` (:67): keep "agent OS: memory, knowledge, teams, workflows, evals", but add "Python-only SDK and AgentOS service; the control plane is a hosted UI and the Next.js front end lives in a separate repository, `agno-agi/agent-ui`". The dive found one cookbook demo front end and no TypeScript SDK in this tree.
- `microsoft-agent-framework` (:72): slug → `agent-framework`, to match the folder. Repository and MIT licence are correct.
- `e2b` (:71): licence stays Apache-2.0 but gains "(root `LICENSE`; the JS and Python package manifests declare MIT, a divergence the dive records)". The focus line about our `exec-remote` E2B backend is correct.
- `langchainjs` (:66), `crewai` (:68), `inngest-agent-kit` (:70): licence, focus and repository still match the filed dive; no correction.

Sixteen of the twenty-one licence cells were already right; five change: `mastra`, `vercel-ai-sdk`, `claude-agent-sdk`, `mcp-typescript-sdk` and `autogen`. Every Tier 1 status changes too: five rows say "in progress" and nine say "planned", and all fourteen should read filed. The Tier 2 table has no status column, which is why its rows need no status edit.

### Tier 3 — registered, not dived (`docs/research/competitors/README.md:74-83`)

- All six rows stay: `openai-agents-python`, `adk-python`, `swarm`, `livekit-agents`, `langfuse` and `openllmetry` are D1 by design and have no folder.

### Text outside the tables

- :25 "each with five files in the same order" → "four or five files in the same order: a D2 dive omits the architecture file".
- :34, the D2 row of the depth table: "profile, features table, short gap note, sources" → "profile, features inventory, gap file with buckets, sources". The filed D2 folders carry a full `03-gap-and-lessons.md`, not a note.

## 2. Rows to add

### `strands-agents` — Tier 2, D2

Append to the Tier 2 table (`docs/research/competitors/README.md:64-72`) as the last row, after `microsoft-agent-framework`; the table has grown by filing order, not by alphabet. Proposed row:

| `strands-agents` | `strands-agents/harness-sdk` | Apache-2.0 | in-process model-driven agent SDK in Python and TypeScript; lifecycle controls are run state rather than caller bookkeeping; the closest architectural peer after `langchainjs` |

Mark it filed 2026-10-21 at depth D2. Unverified at the time of writing: no folder was present in this tree, so its commit prefix, its four files and its gap counts are absent from the status board. The licence is the API answer recorded in `docs/research/competitors/_synthesis/05-long-tail-coverage.md:111-117`; confirm it against the new `04-sources.md` before pasting.

### The long-tail pointer

Add one row at the bottom of Tier 3 (`docs/research/competitors/README.md:78-83`), visually distinct because it is not a repository:

| `long-tail` | the D1 remainder of the 2026-10-21 sweep (`docs/research/competitors/_synthesis/05-long-tail-coverage.md`) | one file: identity, licence and an ignore, watch or promote verdict for the neighbours not given a row |

That keeps the register honest about scope without importing fourteen more rows.

## 3. Focus text that no longer matches

- **`openhands` (:55).** The row names `OpenHands/OpenHands` and promises "runtime sandbox, context condensation, microagents", but that repository is now Agent Canvas, a React and TypeScript client with no agent runtime. Keep the focus, retarget it: "two repositories: `OpenHands/software-agent-sdk` (runtime, tools, condensation, skills) and `OpenHands/OpenHands` (Agent Canvas client)". The dive reads both.
- **`claude-agent-sdk` (:58).** The row promises a D3 and a licence to verify; neither is available: the repository ships declarations and a wrapper, and has no open licence. It must say D2 and "no open licence", and either move out of Tier 1 or stay with an explicit exception, which is a Lead decision (see §5).
- **`agno` (:67).** "agent OS: memory, knowledge, teams, workflows, evals" is right, but anything implying a Python and TypeScript pairing is not. The SDK is Python, AgentOS is Python, the Control Plane is a hosted UI, and the only TypeScript here is one cookbook demo. The UI product is a sibling repository, not a second SDK.

## 4. Status board

Copy-paste table. Commits are the first seven characters of the read commit; "files" is the number of Markdown files in the dive folder; A to E are gap rows in `03-gap-and-lessons.md`. No dive uses bucket E except the upstream one, where E counts parity rows.

| slug | depth | commit | licence | files | A | B | C | D | E |
|---|---|---|---|---|---|---|---|---|---|
| `adk-js` | D3 | `df491a9` | Apache-2.0 | 5 | 13 | 5 | 8 | 5 | – |
| `agent-framework` | D2 | `0200599` | MIT | 4 | 7 | 3 | 7 | 7 | – |
| `agno` | D2 | `7a4febf` | Apache-2.0 | 4 | 2 | 4 | 6 | 12 | – |
| `autogen` | D2 | `004749e` | CC-BY-4.0 + MIT | 4 | 8 | 4 | 8 | 4 | – |
| `beeai-framework` | D3 | `2a1069c` | Apache-2.0 | 5 | 9 | 3 | 3 | 3 | – |
| `claude-agent-sdk` | D2 | `9c59e06` | none, commercial terms | 4 | 7 | 6 | 7 | 4 | – |
| `cloudflare-agents` | D3 | `4e89125` | MIT | 5 | 8 | 6 | 6 | 4 | – |
| `crewai` | D2 | `af4efdc` | MIT | 4 | 6 | 0 | 5 | 3 | – |
| `e2b` | D2 | `7433b8c` | Apache-2.0, root | 4 | 3 | 2 | 3 | 4 | – |
| `huggingface-smolagents` | D3 | `96f33fa` | Apache-2.0 | 5 | 1 | 1 | 5 | 4 | 5 |
| `inngest-agent-kit` | D2 | `6c9802f` | Apache-2.0 | 4 | 5 | 3 | 5 | 7 | – |
| `langchainjs` | D2 | `6c79aa9` | MIT | 4 | 10 | 3 | 5 | 5 | – |
| `langgraphjs` | D3 | `6e84570` | MIT | 5 | 13 | 1 | 1 | 8 | – |
| `mastra` | D3 | `b2d8623` | Apache-2.0 plus `ee/` | 5 | 15 | 5 | 8 | 7 | – |
| `mcp-typescript-sdk` | D3 | `c05225a` | Apache-2.0 code, CC-BY-4.0 docs | 5 | 14 | 7 | 8 | 4 | – |
| `openai-agents-js` | D3 | `304e436` | MIT | 5 | 10 | 7 | 16 | 8 | – |
| `openhands` | D3 | `9cb22f5` / `b70dd46` | MIT, both | 5 | 12 | 2 | 10 | 1 | – |
| `pydantic-ai` | D3 | `1d79209` | MIT | 5 | 15 | 4 | 4 | 6 | – |
| `vercel-ai-sdk` | D3 | `e741656` | Apache-2.0, notice | 5 | 9 | 3 | 6 | 7 | – |
| `vercel-eve` | D3 | `c543585` | Apache-2.0 | 5 | 4 | 2 | 11 | 7 | – |
| `voltagent` | D3 | `72a46c7` | MIT | 5 | 15 | 8 | 7 | 5 | – |
| `strands-agents` | D2 | pending | Apache-2.0 | 4, expected | – | – | – | – | – |
| **total** | | | | | **186** | **79** | **139** | **115** | **5** |

Notes. `cloudflare-agents` has six rows in its B table and one of them is labelled "not a gap" under decision 0019; all six are counted, so its B is six and only five are queued non-goals. The 524 total is the sum of the bucket rows, not a count of unique capabilities, because many rows cite the same baseline id. The `strands-agents` row is the only one not measured from a folder.

## 5. What not to change, and what the Lead must decide

Still true, leave alone:

- Tier 3's six rows, the depth-level table (:31-35), the licence-position paragraph (:13), "How a dive is judged" (:85-93) and the reading-order paragraph (:95-98).
- The focus text of `openai-agents-js`, `langgraphjs`, `huggingface-smolagents`, `pydantic-ai`, `vercel-eve`, `vercel-ai-sdk`, `adk-js`, `beeai-framework`, `cloudflare-agents`, `voltagent`, `mcp-typescript-sdk`, `langchainjs`, `crewai` and `inngest-agent-kit`: each matches its filed profile.
- The `e2b` focus line naming our `exec-remote` E2B backend: verified at `packages/exec-remote/src/e2b.ts`.

Decisions for the Lead, not edits:

- Whether `claude-agent-sdk` moves into the Tier 2 table, where depth and licence now fit, or stays in Tier 1 with an explicit "D2, no open licence" exception. Its evidence cannot support a D3.
- Whether to add depth and status columns to the Tier 2 table, or leave both implicit in the folder shape; that table has no place to record "filed".
- Whether to wait for the `strands-agents` folder before pasting its row, or paste it now with commit and counts blank.
- Whether :25 should say "four or five files" or drop the file count.

## How this was checked

Each folder was listed; each `00-profile.md` identity table and `04-sources.md` licence gate was read. No licence here comes from memory or the research register. Gap rows were counted mechanically as the data rows of the bucket tables in every `03-gap-and-lessons.md`, with three shapes normalised: bucket as the first column, bucket in the middle, and dives that split A, B, C and D across sections. The `strands-agents` entry is the only one not measured from a folder and is marked as unverified throughout. The validator was run after this file was written: `python scripts/validate_context.py --root .`, exit 0.
