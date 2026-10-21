# beeai-framework — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Primary source**

| field | value |
|---|---|
| repository | https://github.com/i-am-bee/beeai-framework |
| upstream owner | IBM Research, published under LF Projects (copyright headers in every file) |
| commit read | `2a1069c78f57d8f2511b3ff415dc04a736e9d4ca` |
| commit date | 2026-10-21T13:13:53+02:00 |
| clone | `reference/competitors/beeai-framework` (shallow depth 1, gitignored) |
| read depth | D3: source read, no install, no build, no test run |
| licence file | Apache-2.0 (`LICENSE:1-4` in the clone) |
| licence confirmation | `gh api repos/i-am-bee/beeai-framework --jq '.license.spdx_id'` returned `Apache-2.0` on 2026-10-21 |
| repository metadata | 3,438 stars, default branch `main`, `archived` false, last push 2026-10-21T11:13:53Z (gh api, same date) |
| package versions read | TypeScript `beeai-framework@0.1.31`, Python `beeai-framework@0.1.85` |

**Documentation consulted in the clone**

- `clone:/docs/src/content/docs/modules/serialization.mdx` — Python example marked "coming soon", method table.
- `clone:/docs/src/content/docs/modules/observability.mdx` — states OpenTelemetry support is Python-only and documents the external instrumentor.
- `clone:/docs/src/content/docs/modules/evaluation.mdx` — states evaluation support is Python-only and names the DeepEval and Ragas adapters.
- `clone:/docs/src/content/docs/modules/serve.mdx` — protocol servers listed for both languages.
- `clone:/docs/src/content/docs/modules/rag.mdx` — links a Python RAG module that is absent at this commit; recorded as drift.
- `README.md:5` and `README.md:80-118` — pitch line and the Python-only flagship multi-agent example.
- `typescript/README.md:3-5`, `:56-90` — Beta badge, "also available in Python", the TypeScript `AgentWorkflow` example.

**Files read in full or at their main paths**

- `typescript/src/agents/base.ts`
- `typescript/src/context.ts`
- `typescript/src/agents/react/` — agent, runner base, default runner, prompts
- `typescript/src/agents/toolCalling/agent.ts`
- `typescript/src/agents/requirement/` — agent, runner, requirement base, conditional requirement
- `typescript/src/backend/chat.ts` (main paths; API listing for the rest)
- `typescript/src/tools/base.ts`
- `typescript/src/tools/handoff.ts`
- `typescript/src/workflows/` — state machine and agent pipeline
- `typescript/src/emitter/emitter.ts`
- `typescript/src/serializer/serializer.ts` (registry and wire-format paths)
- `typescript/src/internals/serializable.ts`
- `typescript/src/memory/unconstrainedMemory.ts`, `slidingMemory.ts`, `tokenMemory.ts`, `summarizeMemory.ts`, `dakeraMemory.ts`
- `typescript/src/serve/server.ts` and the OpenAI, MCP, A2A and ACP adapters
- `typescript/src/internals/helpers/counter.ts`
- `typescript/examples/serialization/customInternal.ts`
- `typescript/package.json`
- `python/beeai_framework/agents/requirement/requirements/ask_permission.py`
- `python/beeai_framework/tools/filesystem/_file_backend.py`, `tools/code/_shell_backend.py`, `tools/code/python.py`
- `python/beeai_framework/agents/lite/agent.py`

**Files read at their interfaces or listings only**

- provider adapters under `typescript/src/adapters/` (all 17 families listed, bodies sampled)
- database and search tool bodies under `typescript/src/tools/database/` and `typescript/src/tools/search/`
- `typescript/src/parsers/` internals beyond the field list used by the ReAct runner
- the Python tree: full module listing, targeted reads only

**Commands run against the clone**

- `gh api repos/i-am-bee/beeai-framework --jq '.license.spdx_id'` — licence confirmation.
- `gh api repos/i-am-bee/beeai-framework` — stars, branch, archive and push metadata.
- directory listings for `typescript/src`, `typescript/src/tools`, `typescript/src/adapters` and the Python package.
- line-numbered reads and content greps with the harness read and grep tools; no writes outside the slug folders.

**Not verified**

- Any runtime behaviour: parser recovery, abort semantics, cache races, token eviction, requirement cycle detection, OpenAI-server compatibility.
- Whether the interpreter service used by `PythonTool` is versioned with the client.
- Whether the docs drift is tracked upstream.
- Python runtime behaviour beyond the files listed; the Python tree was used for parity questions only.

**Refresh procedure**

1. Re-read the repository at a newer commit and record the new commit and date here; do not edit the claims above.
2. Re-run the licence command and compare; a licence change invalidates the whole folder.
3. Re-check the parity table in `00-profile.md` first, since both halves move independently.
4. Re-check the two docs claims (observability and evaluation Python-only) before reusing them as evidence.
5. File a new slug folder if the read is a different repository; this one is frozen.
