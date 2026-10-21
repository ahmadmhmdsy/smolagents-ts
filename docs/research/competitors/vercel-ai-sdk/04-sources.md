# vercel/ai — sources

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Repository and revision

| field | value |
|---|---|
| repository | https://github.com/vercel/ai |
| clone path | `reference/competitors/vercel-ai-sdk/` |
| commit | `e741656ed17aad861d3a0bc3f571e5301fe1eb9d` |
| commit subject | `fix(docs): correct fx image input support (#23777)` |
| commit date | 2026-10-21 |
| date read | 2026-10-21 |
| clone depth | one commit; history is not available |
| licence file | `LICENSE`, 552 bytes, an Apache-2.0 notice rather than the full template |
| licence classification | GitHub reports `NOASSERTION`; the clone's `AGENTS.md:11` states Apache-2.0 |

## Documentation URLs

| url | date read | note |
|---|---|---|
| https://ai-sdk.dev/docs | not read | the project's documentation home; this dive read source instead of prose |
| https://github.com/vercel/ai | 2026-10-21 | repository page, licence metadata fetched through the GitHub API |

## Files read

Specification package, read in full except where noted: `packages/provider/src/language-model/v4/language-model-v4.ts`, and the sibling files `language-model-v4-stream-part.ts`, `language-model-v4-call-options.ts`, `language-model-v4-generate-result.ts`, `language-model-v4-stream-result.ts`, `language-model-v4-prompt.ts`, `language-model-v4-tool-call.ts`, `language-model-v4-tool-result.ts`, `language-model-v4-function-tool.ts`, `language-model-v4-finish-reason.ts`, `language-model-v4-usage.ts` and `language-model-v4-tool-approval-request.ts` in that same directory; `packages/provider/src/language-model-middleware/v4/language-model-v4-middleware.ts`; both package manifests.

Core package: `packages/ai/src/generate-text/stream-text.ts` (in parts), `packages/ai/src/generate-text/generate-text.ts`, `packages/ai/src/generate-text/stream-language-model-call.ts`, `packages/ai/src/generate-text/output.ts`, `packages/ai/src/generate-text/parse-tool-call.ts`, `packages/ai/src/generate-text/execute-tools-from-stream.ts`, `packages/ai/src/generate-text/execute-tool-call.ts`, `packages/ai/src/generate-text/tool-approval-configuration.ts`, `packages/ai/src/generate-text/resolve-tool-approval.ts`, `packages/ai/src/generate-text/tool-approval-signature.ts`, `packages/ai/src/generate-text/tool-call.ts`, `packages/ai/src/generate-text/stop-condition.ts`, `packages/ai/src/generate-text/prepare-step.ts`; `generate-object/generate-object.ts`, `packages/ai/src/generate-object/output-strategy.ts`, `packages/ai/src/generate-object/parse-and-validate-object-result.ts`, `packages/ai/src/generate-object/inject-json-instruction.ts`, `packages/ai/src/generate-object/repair-text.ts`; `middleware/wrap-language-model.ts`; `model/as-language-model-v4.ts`, `model/resolve-model.ts`; `registry/provider-registry.ts`; `ui-message-stream/ui-message-chunks.ts`, `packages/ai/src/ui-message-stream/to-ui-message-stream.ts`, `packages/ai/src/ui-message-stream/create-ui-message-stream.ts`, `packages/ai/src/ui-message-stream/create-ui-message-stream-response.ts`, `packages/ai/src/ui-message-stream/pipe-ui-message-stream-to-response.ts`, `packages/ai/src/ui-message-stream/create-sse-stream-with-keep-alive.ts`, `packages/ai/src/ui-message-stream/read-ui-message-stream.ts`, `packages/ai/src/ui-message-stream/handle-ui-message-stream-finish.ts`; `ui/ui-messages.ts`, `ui/chat.ts`, `ui/http-chat-transport.ts`, `ui/process-ui-message-stream.ts` (case labels); `util/prepare-retries.ts`, `util/retry-with-exponential-backoff.ts`, `prompt/request-options.ts`.

Other packages and files: `packages/gateway/src/gateway-provider.ts` (head); workspace manifests for `ai`, `provider`, `gateway`; root `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.github/workflows/ci.yml`; `AGENTS.md` at the repository root; design notes under `architecture/`.

## Commands run

- `gh api repos/vercel/ai --jq '.license.spdx_id'` returned `NOASSERTION`.
- `gh api -H 'Accept: application/vnd.github.raw' repos/vercel/ai/contents/LICENSE` returned the 552-byte notice.
- `git clone --depth 1 https://github.com/vercel/ai reference/competitors/vercel-ai-sdk`.
- `git -C reference/competitors/vercel-ai-sdk rev-parse HEAD` and `git log -1 --format='%H %ad %s'`.
- `git -C reference/competitors/vercel-ai-sdk rev-list --count HEAD` returned 1, confirming the shallow clone.
- Directory and file counts with `Get-ChildItem` over `packages`, `content`, `examples`, `.github/workflows`.
- `python scripts/validate_context.py --root .` for the pack check reported at hand-off.

## What was not verified

- No documentation page was read, so no claim depends on documented intent.
- No vendor adapter source was read; provider behaviour is described only through the specification.
- Nothing was installed, built, tested or executed from the clone.
- The hosted gateway's routing, authentication and billing behaviour was observed only as request construction and metadata.
- Examples and `content/**` pages were counted but not read.
- The Apache-2.0 full text is not present in the clone; only its notice was read.

## How to refresh

1. Confirm the current commit differs: `git -C reference/competitors/vercel-ai-sdk fetch --depth 1 origin main` then `git rev-parse HEAD`.
2. Re-run the licence check before reading further: `gh api repos/vercel/ai --jq '.license.spdx_id'`.
3. Prefer the same paths as the evidence column in `docs/research/competitors/vercel-ai-sdk/02-features-inventory.md`; a moved file is itself a finding to record.
4. Write a new file set with the new commit in `docs/research/competitors/vercel-ai-sdk/00-profile.md`; never edit these five, because they are frozen at the read commit.

