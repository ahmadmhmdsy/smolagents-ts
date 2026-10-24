# OmniRoute HTTP API surface — client-relevant report

## Contract

- **Role:** the gateway's client-relevant HTTP surface, read from OmniRoute
  `v3.8.53`, for the T-39 decision.
- **Mutability:** frozen once filed; pinned to that version.
- **Read when:** writing or reviewing a client that talks to OmniRoute's `/v1`.
- **Update when:** a later OmniRoute version moves a route, a frame shape or an
  error code.

**What OmniRoute is.** A self-hosted Next.js App Router gateway that exposes an
OpenAI-compatible `/v1` surface and translates each request to ~375 upstream
providers ("providers" are also called connections/accounts). Client-facing
routes live in `src/app/api/v1/**`; `/v1/:path*` is rewritten to
`/api/v1/:path*` (`next.config.mjs:687-724`), and bare aliases
`/chat/completions`, `/responses`, `/models`, `/codex/*` map to the same
handlers (`next.config.mjs:690-715`). Translation, execution, streaming and
sanitization live in `open-sse/`. Client routes are classified as
`CLIENT_API` and share one auth policy (`src/server/authz/classify.ts:95-109`,
`src/server/authz/policies/clientApi.ts:25-79`); `/api/**` outside `/api/v1`
is `MANAGEMENT` (`classify.ts:111-127`).
All paths below are relative to the read-only clone
(`%TEMP%\omniroute-research`), version 3.8.53.

## Endpoint table

| Route | Method | Wire format | Handler / evidence |
|---|---|---|---|
| `/v1/chat/completions` | POST | OpenAI Chat Completions (SSE when `stream:true`) | `src/app/api/v1/chat/completions/route.ts`; compat doc `%TEMP%/omniroute-research/docs/reference/OPENAI_COMPATIBILITY.md:26` |
| `/v1/completions` | POST | Legacy text completion (`prompt` normalized to `messages`, response translated back) | `src/app/api/v1/completions/route.ts:83-109` |
| `/v1/responses` | POST (+WS descriptor) | OpenAI Responses, SSE | `src/app/api/v1/responses/route.ts`; compat doc `:27` |
| `/v1/messages` | POST | Anthropic Messages (auto-detected, streamed as Anthropic SSE incl. `event: ping`) | `src/app/api/v1/messages/route.ts:52-97` |
| `/v1/messages/count_tokens` | POST | Claude token counting | route directory exists; handler **not read** |
| `/v1/embeddings` | POST / GET | OpenAI Embeddings; GET lists embedding models | `src/app/api/v1/embeddings/route.ts:30-36,56-70` |
| `/v1/models` | GET, HEAD, OPTIONS | OpenAI model list (`HEAD` = headers only) | `src/app/api/v1/models/route.ts` |
| `/v1/models/{model}` | GET | Single-model retrieval, catch-all for slash-containing ids | `src/app/api/v1/models/[...model]/route.ts` |
| `/v1/models/query` | POST | Filtered model shortlist (`{object:"list",data:[...]}`) | `src/app/api/v1/models/query/route.ts` |
| `/v1/images/{generations,edits,upscale}`, `/v1/audio/{speech,transcriptions,translations}`, `/v1/videos`, `/v1/music` | POST | OpenAI-shaped media endpoints | route tree; compat doc `:29-32` |
| `/v1/rerank`, `/v1/classify`, `/v1/segment`, `/v1/moderations`, `/v1/search`, `/v1/web/{fetch,map}` | POST | Non-OpenAI extras | route tree; `%TEMP%/omniroute-research/docs/reference/OPENAI_COMPATIBILITY.md:35-37` |
| `/v1/files`, `/v1/batches` | GET/POST | OpenAI Files/Batches | route tree |
| `/v1/session-leases` | POST | Leased account sessions | `%TEMP%/omniroute-research/docs/reference/API_REFERENCE.md:223-232` |
| `/v1/ws`, `/v1/responses` (WS) | GET upgrade | WebSocket (port 20128) | `%TEMP%/omniroute-research/docs/reference/API_REFERENCE.md:813-882`; `src/server/authz/policies/clientApi.ts:9-18` |

`/v1/realtime` is **not implemented** (`OPENAI_COMPATIBILITY.md:138`).
**Auth:** `Authorization: Bearer <key>` primary; `x-api-key` and
`x-goog-api-key` also accepted as candidates, plus path token
`/vscode/<key>/...` (`src/server/authz/policies/clientApi.ts:28-36`,
`src/sse/services/clientApiKeyResolver.ts:42-67`). With
`REQUIRE_API_KEY=false` (documented default) no key is required, and an invalid
key degrades to anonymous (`clientApi.ts:49-51,71-77`).

## 1. Extra response-body fields beyond the OpenAI schema

**Routing/provider/cost/quota are headers, not body fields.** No success body
from `/v1/chat/completions` or `/v1/responses` was found to carry a
`provider`/`route`/`cost` field; the sanitizer explicitly *removes*
provider-specific extras (`open-sse/handlers/responseSanitizer.ts:28-37`, which
names `x_groq`, `usage_breakdown`, `service_tier`). Routing metadata is
attached as `X-OmniRoute-*` headers
(`src/shared/constants/headers.ts:1-22`,
`src/domain/omnirouteResponseMeta.ts:119-210`,
`open-sse/handlers/chatCore/nonStreamingResponseHeaders.ts`).

Body-level deltas that *do* exist:

- `usage.tokens_per_second` — decimal (3 dp), added after usage filtering
  (`open-sse/utils/generationThroughput.ts:39-44`, applied at
  `open-sse/utils/stream.ts:2843,3197`).
- `usage` allowlist is exactly: `provider_credits`, `cost_in_usd_ticks`,
  `prompt_tokens`, `completion_tokens`, `total_tokens`, `cached_tokens`,
  `prompt_tokens_details`, `completion_tokens_details`,
  `cache_read_input_tokens`, `cache_creation_input_tokens`, `estimated`
  (`open-sse/handlers/responseSanitizer/usageFields.ts:7-23`). Everything else
  in a provider's `usage` is stripped there. Responses API keeps
  `input_tokens/output_tokens/total_tokens`, `*_details`, `estimated`,
  `server_side_tool_usage*` (`usageFields.ts:25-37`).
- `usage.estimated = true` marks heuristic (cookie/web provider) metering
  (`usageFields.ts:20-22`).
- `usage.prompt_tokens` is **not** inflated by the 2000-token safety buffer;
  the buffer only appears in `context_budget_*` fields, which are stripped
  before the client sees them (`open-sse/utils/usageTracking.ts:183-229`).
- `choices[].message.reasoning_content` (and streaming `delta.reasoning_content`)
  is emitted when the upstream produced reasoning
  (`responseSanitizer.ts:385`); suppress with `x-omniroute-strip-reasoning`
  (`open-sse/handlers/chatCore/headers.ts:58-65`).
- Responses API keeps `incomplete_details`, `server_side_tool_usage_details`,
  `cost_in_usd_ticks` (`responseSanitizer.ts:39-47`).
- Error bodies add `error.reason`, `error.retry_after`, `error.reset_at`,
  optional `upstream_details`, and on terminal combo failure body-level
  `diagnostics` + `recovery_hint` (`open-sse/utils/error.ts:25-37,599-649`).

Response headers worth consuming: `X-OmniRoute-Cache: HIT|MISS`,
`X-OmniRoute-Provider`, `-Model`, `-Response-Cost`, `-Tokens-In`,
`-Tokens-Out`, `-Latency-Ms`, `-Cache-Hit`, `-Fallback-Attempts` (only >0),
`-Decision` (`strategy=<name>; provider=<alias>; latency_ms=<n>`),
`-Compression`, `-Cost-Saved`, `-Tokens-Per-Second`, `-Request-Id`,
`-Version` (`headers.ts:1-22`; `omnirouteResponseMeta.ts:98-210`).
An optional SSE comment trailer `: x-omniroute-<header>=<value>` exists but is
**off by default** (needs `OMNIROUTE_SSE_COMMENTS=on`,
`open-sse/utils/sseHeartbeat.ts:98-105`, `stream.ts:1256-1280`) — treat it as
absent.

## 2. What breaks a strict OpenAI client

1. **Synthetic keepalive chunks before any upstream byte.** Valid
   `chat.completion.chunk` shape but `id:"chatcmpl-keepalive"`, `created:0`,
   `model:"keepalive"`, empty `delta`
   (`open-sse/utils/earlyStreamKeepalive.ts:45-50`). Clients that treat `id`/
   `created` as stable or require a non-empty delta will break.
2. **Error delivered as a data chunk with no `choices`.** Mid-stream failure
   emits `data: {"error":{"message":...,"type":"stream_error"}}` and then
   `data: [DONE]` (`earlyStreamKeepalive.ts:77-81`,
   `open-sse/handlers/chatCore/streamErrorResult.ts:68-92`,
   `open-sse/utils/error.ts:675-683`). A parser that casts every frame to a
   chunk type throws. Also note the HTTP status is preserved and
   `Content-Type: text/event-stream` is set even for this error stream.
3. **Trailing usage-only chunk with `choices: []`.**
   `buildUsageOnlyChunk` emits `{id, object:"chat.completion.chunk", created,
   model, choices: [], usage}` immediately before `[DONE]`
   (`open-sse/utils/usageOnlyChunk.ts:1-15`, `stream.ts:2839-2852`).
   `stream_options.include_usage` is honored
   (`OPENAI_COMPATIBILITY.md:52`), but usage can also ride the finish chunk
   (`stream.ts:3174-3182` comment).
4. **Synthesized finish chunk.** If the upstream never sent `finish_reason`,
   one is synthesized before the terminator (`stream.ts:2822-2838`), so a
   client may see an extra chunk.
5. `data: [DONE]` is emitted for OpenAI-format streams
   (`stream.ts:862,2853-2858`); it is *not* the terminator for
   Anthropic/Gemini-shaped streams. `/v1/messages` streams use
   `event: ping` frames (`src/app/api/v1/messages/route.ts:88-97`); Chat
   Completions and Responses frames carry no `event:` field.
6. **Request-side strictness:** the chat route requires
   `Content-Type: application/json` and otherwise returns `415`
   `unsupported_media_type` (`src/app/api/v1/chat/completions/route.ts:111-127`);
   `/v1/responses` requires a JSON **object** body (400 otherwise,
   `responses/route.ts:136-146`); the prompt-injection guard can return
   `400` with `error.code:"SECURITY_001"` (`chat/completions/route.ts:286-293`).
7. **Estimated/absent usage.** `usage` may be estimated for cookie/web
   providers (`open-sse/utils/usageTracking.ts:1072`; `estimated` flag kept at
   `usageFields.ts:20-22`) and may be absent on error streams. Do not assume
   `usage` is always present or exactly upstream-reported.
8. **Normalization:** response `id`, `object` and usage fields are rewritten to
   strict OpenAI shape (`responseSanitizer.ts:28-36`) and finish reasons are
   normalized (`responseSanitizer.ts:5-6`), so ids/values are not
   byte-identical to the upstream response.

CORS is an allowlist (no wildcard default); `CORS_ALLOW_ALL=true` opts in
(`src/server/cors/origins.ts:1-25`) — a browser client must be on the allowlist.

## 3. tool_calls reliability and capability caveats

- Assistant `tool_calls` are paired with following `role:"tool"` messages;
  `tools`/`tool_choice` are translated "when possible"; `parallel_tool_calls`
  is only a *preference* and does not create capability
  (`%TEMP%/omniroute-research/docs/reference/OPENAI_COMPATIBILITY.md:48-50`). Tool calls may be emitted
  as one or more calls per assistant turn, and non-OpenAI provider
  representations are mapped back to `tool_calls`
  (`OPENAI_COMPATIBILITY.md:57-61`).
- Streaming tool calls arrive as `delta.tool_calls` fragments in OpenAI shape
  (same handler path, `open-sse/utils/stream.ts`); text-only providers are
  parsed into `tool_calls` (e.g. `open-sse/translator/deepseekWebTools.ts:898`),
  so arguments can be *reconstructed* rather than passed through verbatim.
- Tool-argument strings are sanitized: zero-width characters are stripped and
  JSON arguments rebuilt from the string
  (`responseSanitizer.ts:81-90`), so treat argument bytes as
  semantically-equal, not identical.
- Capability caveats: multimodal content, `response_format`, and reasoning
  effort are all provider-dependent and may be clamped/rejected upstream
  (`OPENAI_COMPATIBILITY.md:53-55,78-85`); a `/v1/models` entry can advertise
  `capabilities`/`input_modalities`/`output_modalities` that a given
  connection does not actually satisfy
  (`src/app/api/v1/models/catalog.ts:911-967`).
- **Not verified:** per-provider tool-call fidelity across all 375 providers,
  and whether every translator path preserves tool-call ordering under
  fallback.

## 4. Errors, 429 and rate-limit signals a client should branch on

Envelope (both JSON and the mid-stream data frame):
`{"error":{"message":string,"type"?:string,"code"?:string,"reason"?:string,
"retry_after"?:number,"reset_at"?:string},"upstream_details"?:unknown}`
(`open-sse/utils/error.ts:25-37`; built/sanitized at `:395-427`;
`Content-Type: application/json` and a `Retry-After` header are set when
`retry_after` is known, `:657-667`).

Status → `type`/`code` mapping (`open-sse/config/errorConfig.ts:24-38`):

| HTTP | `error.type` | `error.code` |
|---|---|---|
| 400 | `invalid_request_error` | `bad_request` |
| 401 | `authentication_error` | `invalid_api_key` |
| 402 | `billing_error` | `payment_required` |
| 403 | `permission_error` | `permission_denied` |
| 404 | `invalid_request_error` | `model_not_found` |
| 406 | `invalid_request_error` | `model_not_supported` |
| 410 | `invalid_request_error` | `model_shutdown` |
| 429 | `rate_limit_error` | `rate_limit_exceeded` |
| 499 | `invalid_request_error` | `client_disconnected` |
| 500 | `server_error` | `internal_server_error` |
| 502 | `server_error` | `bad_gateway` |
| 503 | `server_error` | `service_unavailable` |
| 504 | `server_error` | `gateway_timeout` |

Additional branchable codes seen in code:

- `401` auth rejections carry an HTTP-layer code `AUTH_002`
  (`src/server/authz/policies/clientApi.ts:53,78`) with messages
  "Authentication required" / "Invalid API key".
- `415` `unsupported_media_type`; `400` `SECURITY_001`
  (`chat/completions/route.ts:122,286`).
- Admission shedding: `413` `PAYLOAD_TOO_LARGE` / `body_exceeds_budget` /
  `chat_history_too_large`, and `503` `chat_admission_busy` /
  `resource_pressure`, the 503s carrying `Retry-After`
  (`src/shared/middleware/chatAdmissionResponses.ts:27-48,51-64,66-78,80-105`).
- Leased sessions: `429` with `error.type:"lease_error"`,
  `error.code:"LEASE_CAPACITY_UNAVAILABLE"` and `Retry-After`
  (`%TEMP%/omniroute-research/docs/reference/API_REFERENCE.md:223-232`).
- Terminal combo failure adds `diagnostics`, `recovery_hint` and headers
  `x-omniroute-combo-pool-size`, `-attempted`, `-excluded`,
  `-terminal-reason`, `x-omniroute-recovery-action`, `-next-step`,
  `-retry-after-seconds` (`error.ts:599-649`).

Rate-limit handling: OmniRoute does not appear to synthesize its own
`x-ratelimit-*` counters; upstream response headers are forwarded best-effort
under a 768-byte budget with `retry-after` and `*ratelimit*` headers given
forwarding priority, and drops are counted in
`X-OmniRoute-Dropped-Upstream-Headers`
(`open-sse/handlers/chatCore/responseHeaders.ts:50-75,134-160`). Retry logic:
`retry-after` then `x-omniroute-retry-after-seconds`, clamped to 0–3600 s
(`open-sse/utils/earlyStreamKeepalive.ts:112-126`); internal backoff is
1000 ms base / 120 s cap (`open-sse/config/errorConfig.ts:59-63`).
Client guidance documented upstream: branch on `status` plus
`error.code`/`error.type`, never on message text
(`OPENAI_COMPATIBILITY.md:71-76`).

**Not verified:** whether a client-visible 429 is ever generated by OmniRoute's
own per-key/per-connection quota enforcement end-to-end (only the classifier,
lease and admission paths were read), and whether `Retry-After` is present on
every upstream-originated 429.

## Open questions

1. `/v1/messages/count_tokens` request/response shape (route exists; handler not read).
2. Exact text-completion response fields from `/v1/completions`
   (`open-sse/.../textCompletionTransform.ts` not read).
3. Per-key scopes (`oma_live_…` management vs client keys) and their effect on
   which `/v1` endpoints a key may call (`src/shared/utils/apiKeyPolicy.ts`
   read only in outline).
4. MCP/A2A endpoints and `/v1/providers/*`, `/v1/relay/*`, `/v1/auto-combo`
   behavior were not inspected.
