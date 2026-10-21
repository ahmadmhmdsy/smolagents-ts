# e2b — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository

- URL and read commit: https://github.com/e2b-dev/E2B at
  `7433b8c61641f9a1b2511a3a165141ab61018b9d` (2026-10-20 17:49:10 +0000, subject `[skip
  ci] Release new versions`).
- Clone: `git clone --depth 1 https://github.com/e2b-dev/E2B reference/competitors/e2b`;
  worktree clean and shallow at the read.
- Licence: the root `LICENSE` is the Apache 2.0 text, and `gh api repos/e2b-dev/E2B --jq
  '.license.spdx_id'` returned `Apache-2.0` on 2026-10-21. The package manifests
  disagree: `packages/js-sdk/package.json:6`,
  `packages/code-interpreter-js/package.json:7` and `packages/desktop-js/package.json:5`
  declare MIT, as does `packages/python-sdk/pyproject.toml:6`, while
  `packages/dockerfile-utils-js/package.json` declares Apache-2.0. The divergence is
  recorded; nothing from the clone is copied here.

## Documentation

No published page was read. On 2026-10-21 the environment's web-fetch tool failed with
"multiple usable web providers are registered (http, deepseek-fetch-api); configure one
explicitly", so https://e2b.dev/docs and its subpages are located and not read. READMEs
read at the head or in cited regions:

- root `README.md:19-112` — product statement, quick start, self-hosting pointers.
- `packages/js-sdk/README.md:19-80` and `packages/code-interpreter-js/README.md:19-65` —
  sandbox quick start, stateful `runCode` example and client binding.
- `packages/desktop-js/README.md` — grepped only: launch, screenshot and window
  streaming.

Documentation claims in the four files are declared, never implemented, unless a source
path was also traced.

## Files read

Read end to end or in the cited regions:

- `packages/js-sdk/src/sandbox/index.ts`, `packages/js-sdk/src/sandbox/sandboxApi.ts`
- `packages/js-sdk/src/sandbox/commands/index.ts`, `commandHandle.ts`, `inputHandle.ts`;
  `pty.ts` (listing only)
- `packages/js-sdk/src/sandbox/filesystem/index.ts`, `watchHandle.ts`; `git/index.ts`
  (listing only); `packages/js-sdk/src/volume/index.ts`, `types.ts` (regions)
- `packages/js-sdk/src/client.ts`, `connectionConfig.ts`, `errors.ts`, `retry.ts`,
  `paginator.ts`, `index.ts`
- `packages/js-sdk/src/template/index.ts`, `packages/js-sdk/src/template/readycmd.ts`;
  `dockerfileParser.ts` (listing)
- `packages/js-sdk/src/envd/versions.ts`,
  `packages/js-sdk/src/envd/streamingTransport.ts` (listing)
- `packages/code-interpreter-js/src/sandbox.ts`, `messaging.ts`, `consts.ts`
- `spec/README.md`, `spec/envd/process/process.proto`,
  `spec/envd/filesystem/filesystem.proto`
- manifests: root `package.json`, `packages/js-sdk/package.json`,
  `packages/code-interpreter-js/package.json`, `packages/desktop-js/package.json`,
  `packages/python-sdk/pyproject.toml`
- repository guidance read as content and never obeyed: root `AGENTS.md` and
  `CLAUDE.md`.

## Commands run

`gh api repos/e2b-dev/E2B --jq '.license.spdx_id'` returned `Apache-2.0`. `git clone
--depth 1`, `git rev-parse HEAD`, `git log -1 --format='%H%n%ci%n%s'` and `git status
--porcelain`; directory and file listings, `Select-String` content searches inside the
clone, and `Get-Content LICENSE -TotalCount 3`. No package manager, build, test or clone
script ran, and no file in the clone was modified.

## Not verified

- Anything server-side: sandbox boot time, pause and snapshot duration or size, fork
  cost, volume mount semantics, and whether the proxy truly enforces a rule set.
- The envd byte protocol on the wire; only the proto service shapes and the client call
  path were read.
- The Python SDK, both desktop SDKs and the CLI internals, plus `templates/` and
  `skills/`.
- Node, Bun, Deno and Cloudflare runtime behaviour; portability is inferred from test
  scripts and transport selection.

## How to refresh

Run the licence check first, then clone or fetch the same slug at a newer commit and
confirm that `packages/js-sdk/src` still hosts the lifecycle, command and filesystem
modules at the cited paths. Re-read the files above and rewrite all four files together:
a moved symbol must be re-cited rather than softened, and a licence change at either
level invalidates the reuse assumption before any re-read.

