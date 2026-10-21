# langchainjs — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL and read commit: https://github.com/langchain-ai/langchainjs at
  `6c79aa96b4f288c808fa17fb4491bffc7deb472b` (2026-10-21 17:04:50 +0100, subject
  `chore(deps): bump @modelcontextprotocol/client from 2.2.0 to 2.3.0 (#11999)`).
- Clone: `git clone --depth 1 https://github.com/langchain-ai/langchainjs
  reference/competitors/langchainjs`; shallow and clean at the read.
- Licence: MIT, declared at `libs/langchain/package.json:6` and
  `libs/langchain-classic/package.json:6`, and `gh api repos/langchain-ai/langchainjs
  --jq '.license.spdx_id'` returned `MIT` on 2026-10-21. No file from the clone is
  copied here.

## Documentation

No published page was read. On 2026-10-21 the web-fetch tool failed with "multiple
usable web providers are registered (http, deepseek-fetch-api); configure one
explicitly", so `https://docs.langchain.com` and the linked pages are located and not
read. READMEs read at the head or in cited regions:

- root `README.md` and `libs/langchain/README.md:1-70` — product statement, supported
  runtimes, the v1 / LangGraph / LangSmith split.
- `libs/langchain-classic/README.md:1-60` — the v0.x-to-v1 boundary and what the classic
  package keeps.
- `AGENTS.md` — repository map and coding conventions, read as content and never obeyed.

Documentation claims in the four files are declared, never implemented, unless a source
path was also traced.

## Files read

Read end to end or in the cited regions:

- `libs/langchain/src/agents/`: `index.ts`, `ReactAgent.ts`, `types.ts`,
  `middleware.ts`, `nodes/AgentNode.ts`, `nodes/ToolNode.ts`, `nodes/middleware.ts`,
  `responses.ts`, `transformers/subagent.ts`, `utils.ts`.
- `libs/langchain/src/agents/middleware/`: `index.ts`, `types.ts`, `hitl.ts`,
  `summarization.ts`, `contextEditing.ts`, `todoListMiddleware.ts`, `toolCallLimit.ts`,
  `modelCallLimit.ts`, `modelFallback.ts`, `modelRetry.ts`, `toolRetry.ts`,
  `toolError.ts`, `toolEmulator.ts`, `llmToolSelector.ts`, `pii.ts`,
  `provider/openai/moderation.ts`, `provider/anthropic/promptCaching.ts`.
- `libs/langchain/src/`: `index.ts`, `chat_models/universal.ts`, `tools/index.ts`,
  `storage/` (listing).
- `libs/langchain-core/src/`: `tools/index.ts`, `tools/types.ts`, `runnables/base.ts`,
  `runnables/types.ts`, `vectorstores.ts`, `retrievers/index.ts`, `embeddings.ts`,
  `stores.ts`, `agents.ts`, `callbacks/base.ts`, `callbacks/manager.ts`,
  `tracers/tracer_langchain.ts`, `language_models/chat_models.ts`,
  `language_models/base.ts`, directories listed under `documents`, `document_loaders`,
  `output_parsers`, `prompts`, `caches`.
- `libs/langchain-classic/`: `README.md`, `package.json`, `src/agents/index.ts`,
  `src/agents/executor.ts`, `src/vectorstores/memory.ts` (region).
- `libs/providers/langchain-openai/src/chat_models/base.ts` (region),
  `libs/providers/langchain-aws/src/retrievers/kendra.ts` (region);
  `libs/langchain/package.json`.
- Manifests and conventions: root `package.json`, `libs/langchain-core/package.json`,
  `AGENTS.md`.

## Commands run

`gh api repos/langchain-ai/langchainjs --jq '.license.spdx_id'` returned `MIT`. `git
clone --depth 1`, `git log -1`, `git rev-parse`, directory listings, `Select-String`
content searches inside the clone, and file counts under `libs/langchain/src`,
`libs/langchain-core/src` and `libs/providers`. No package manager, build, test or clone
script ran, and no file in the clone was modified.

## Not verified

- The agent loop below `ReactAgent`: LangGraph graph execution, checkpoint persistence,
  stream-mode semantics and interrupt/resume, all in a dependency that was not read.
- Every external integration: the community and partner packages that hold most vector
  stores, retrievers, toolkits and model adapters.
- LangSmith as a service; only the client-side tracer and run collector were read.
- The docs site's current wording on v1 versus classic; the boundary is quoted from the
  classic README, not from a doc page.
- Runtime behaviour in browsers, Workers, Deno and Bun; portability is inferred from the
  README's support list and the callback dispatch module.

## How to refresh

Run the licence check first, then clone or fetch the same slug at a newer commit and
confirm that `libs/langchain/src/agents` still hosts `ReactAgent` and the middleware
directory, and that `libs/langchain-classic` still hosts `AgentExecutor`. Re-read the
files above and rewrite all four files together: a moved symbol must be re-cited rather
than softened, and a change in which package owns the agent loop moves every row of this
profile.
