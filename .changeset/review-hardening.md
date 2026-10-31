---
"@smolagents-ts/exec-remote": minor
"@smolagents-ts/mcp": minor
"@smolagents-ts/tools": minor
"@smolagents-ts/cli": patch
---

Harden the paths a model or a third party can steer.

- `@smolagents-ts/mcp`: a stdio server now starts with a short safe environment plus its `env`, not this process's whole environment; pass what a server needs in `env`. The HTTP transport refuses an Authorization header over plain http to a remote host unless `allowInsecureAuthorization` is set, caps responses with `maxResponseBytes`, and takes an optional `timeoutMs`.
- `@smolagents-ts/tools`: `visit_webpage` refuses private and local addresses, on the first URL and on every redirect, unless `allowPrivateNetwork` is set. HTML cleaning drops an unclosed `<script>`.
- `@smolagents-ts/exec-remote`: hardens the remote sandbox backends and the frame protocol between host and guest.
- `@smolagents-ts/cli`: warns on stderr about `--api-key` on the command line and about `--api-base` on the default model type, which sends `HF_TOKEN` to that endpoint.
