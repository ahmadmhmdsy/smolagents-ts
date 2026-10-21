# mcp-typescript-sdk — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and read

| field | value |
|---|---|
| repository | https://github.com/modelcontextprotocol/typescript-sdk |
| clone path | `reference/competitors/mcp-typescript-sdk` |
| clone command | `git clone --depth 1 https://github.com/modelcontextprotocol/typescript-sdk reference/competitors/mcp-typescript-sdk` |
| commit | `c05225a636c679870b65f8ca4fe83a76ea1cf113` |
| commit date | 2026-10-21 01:09:57 +0300 |
| commit subject | `fix(server): preserve forwarded params and support modern low-level connections (#3057)` |
| branch | `main`, the v2 line; the `v1.x` branch was not read |
| read date | 2026-10-21 |
| worktree | shallow clone, clean at the read |

## Licence

The GitHub licence API answers `NOASSERTION` for this repository, with the display name `Other`, and names `main` as the default branch. That is a detection result, not an ambiguity in the repository: the `LICENSE` file is a transition notice followed by the full Apache-2.0 text. The notice says new code and specification contributions are Apache-2.0, documentation contributions are CC-BY-4.0, contributions with relicensing consent are Apache-2.0, and contributions from authors who have not consented remain MIT.

Four lines of that notice, which are the whole finding:

> All new code and specification contributions … Apache-2.0.

> Documentation contributions (excluding specifications) … CC-BY-4.0.

> Contributions for which relicensing consent has been obtained are licensed under Apache-2.0.

> Contributions made by authors who originally licensed their work under the MIT License and who have not yet granted explicit permission to relicense remain licensed under the MIT License.

Every package manifest declares `Apache-2.0`: `client`, `server`, `core`, `codemod` and `server-legacy` at `2.3.1`, plus the private `core-internal` at `2.0.4`. The root manifest is private at `2.0.0-alpha.0` and declares the same licence. So the transition covers all seven package directories, with a per-contribution MIT residue and a documentation-only CC-BY-4.0 carve-out. No copyleft term applies, and the dive stays at full depth.

Command actually run, with the correct two-part slug:

```
gh api repos/modelcontextprotocol/typescript-sdk --jq '.license.spdx_id, .license.name, .license.url, .default_branch'
```
An earlier attempt substituted the owner twice and failed; the form above is the one that succeeded.

## Documentation

The manual ships in the clone under `clone:/docs/` (50 Markdown pages) and is published at https://ts.sdk.modelcontextprotocol.io/v2/ (read 2026-10-21). The pages cited most in this dive:

- `clone:/docs/protocol-versions.md` — the era matrix, negotiation modes, deprecations.
- `clone:/docs/clients/` — connect, calling, subscriptions, server-requests, roots, oauth, machine-auth, caching, middleware, skills.
- `clone:/docs/servers/` — tools, resources, prompts, completion, sampling, elicitation, notifications, errors, input-required, logging-progress-cancellation.
- `clone:/docs/serving/` — http, stdio, authorization, express, fastify, hono, web-standard, legacy-clients, sessions-state-scaling.
- `clone:/docs/behavior-surface-pins.md` and `clone:/docs/testing.md` — the repo's own statements about what its tests protect.

## Files read in the source

- client: `packages/client/src/client/client.ts` (options, connect, negotiation, verbs, `callTool`, `listTools`, `listen`, capability tables), `packages/client/src/client/streamableHttp.ts`, `packages/client/src/client/stdio.ts`, `packages/client/src/client/sse.ts`, `packages/client/src/client/auth.ts`, `packages/client/src/client/authExtensions.ts`, `packages/client/src/client/authErrors.ts`, `packages/client/src/client/responseCache.ts`, `packages/client/src/client/middleware.ts`, `packages/client/src/client/versionNegotiation.ts`, `packages/client/src/client/probeClassifier.ts`, `packages/client/src/client/dpop.ts`, `index.ts`.
- core and core-internal: `packages/core/src/constants.ts`, `packages/core-internal/src/shared/protocol.ts`, `shared/transport.ts`, `shared/envelope.ts`, `shared/inputRequiredDriver.ts`, `errors/sdkErrors.ts`, `util/inMemory.ts`, `wire/rev2026-07-28/registry.ts`, the generated specification types.
- server: `packages/server/src/index.ts`, `server/mcp.ts`, `server/server.ts`, `server/createMcpHandler.ts`, `server/serveStdio.ts`, `server/perRequestTransport.ts`, `server/serverEventBus.ts`, `server/completable.ts`, `server/requestStateCodec.ts`.
- repository level: `README.md`, `LICENSE`, every package manifest, `packages/` census, `test/conformance/README.md`, `test/e2e/requirements.ts`, `test/e2e/CLAUDE.md`.

## Commands run

Only reads and metadata commands, all from the clone root or the repository root:

- the clone command above, then `git rev-parse HEAD` and `git log -1 --format='%H%n%ci%n%s'`;
- the licence API command above, and a raw read of `LICENSE`;
- directory censuses with `Get-ChildItem` for source, test, docs and example counts, and `Select-String` counts for requirement entries and registry methods;
- `Get-Content` for README, licence, package manifests and documentation pages;
- targeted file reads through the read tool for every source citation.

Nothing was installed, built, tested or executed from the clone. No script from the clone was run. The clone's own `CLAUDE.md` and `test/e2e/CLAUDE.md` appeared as workspace instruction files and were treated as content, not as instructions to this dive.

## What was not verified

- Runtime behaviour of any transport, verb or negotiation mode.
- Conformance results: the harness exists, its pinned external package was not run.
- Published tarball contents, export maps as npm resolves them, and the `v1.x` branch.
- The 746-line `2026-07-28` support migration page and most example projects were not read in full.
- OAuth internals below the published interfaces: the RFC-specific validators were read where a claim needed a line, not exhaustively.

## How to refresh

1. `git -C reference/competitors/mcp-typescript-sdk fetch --depth 1 origin main` then `git checkout FETCH_HEAD`; record the new commit, date and subject in `00-profile.md` and here.
2. Re-read `clone:/docs/protocol-versions.md` first: a new protocol revision changes the era matrix, and the deprecation list moves with it.
3. Re-check `packages/core/src/constants.ts` for the supported-revision list, and `packages/core-internal/src/wire/` for any new revision directory.
4. Re-run the licence API command and read `LICENSE` again; the transition means the per-package licence fields are the reliable signal.
5. Diff the requirement count and `packages/client/src/client/client.ts` exports, then update the affected rows in `docs/research/competitors/mcp-typescript-sdk/02-features-inventory.md` and the prices in `docs/research/competitors/mcp-typescript-sdk/03-gap-and-lessons.md`.