# Investigation — adding OmniRoute gateway support

- **Task:** T-39 (opened by this session)
- **Owner:** lead (research session)
- **Started:** 2026-10-21T18:31:00+03:00

## Contract

- **Role:** the evidence behind T-39, which asks what "add OmniRoute support"
  costs and where it belongs. It prices four shapes against the shipped model
  layer, the design record's tier-3 `models-gateway`, and decision 0019.
- **Mutability:** append-only once filed; pinned to the revision it was read at.
- **Read when:** deciding T-39, or before promising gateway/router support.
- **Update when:** a decision moves provider routing into scope, or the `Model`
  seam or the OmniRoute `/v1` surface changes.

**Supporting records.** Two shards were written for this investigation and are
cited below by path: `docs/research/omniroute-api-surface.md` (the gateway's HTTP
surface, read from a shallow clone of OmniRoute `v3.8.53`) and
`docs/research/omniroute-integration-notes.md` (how this project adds a provider,
and what each shape costs in files).

## Question

What does "support OmniRoute" actually require: does the shipped
`OpenAICompatibleModel` already speak the gateway's surface unmodified, and if it
does, what work remains — a documentation task, a new adapter file, or the
`models-gateway` package the design record pre-registered?

## Hypothesis and falsification gate

**PREREGISTERED in this session before either probe ran.**

- **Prediction:** OmniRoute's `/v1` surface is OpenAI Chat-Completions shaped
  (Bearer auth, `/v1` root, `data: [DONE]` terminator), so the shipped
  `OpenAICompatibleModel` serves it with **zero code change** — non-streaming,
  streaming, tool calls, and streamed usage all work — and the four stream
  irregularities the gateway is known for are absorbed rather than surfaced.
- **Falsified if:** any of the five behaviours below mismatches; or a synthetic
  keepalive frame produces phantom content; or a mid-stream error frame reaches
  the caller as a chunk instead of a throw; or an API key appears in an error
  message; or a usage-only frame with `choices: []` is dropped and leaves the
  run unpriceable.
- **Gate:** all five checks match the prediction, and OmniRoute's documented
  base path, port and auth agree with what the adapter sends.

## Setup

- **Environment:** `docs/02-environment.md` owns the toolchain; Windows 11, Node
  `v24.18.0`. Nothing was installed for this investigation.
- **Inputs:** a shallow clone of `https://github.com/diegosouzapw/OmniRoute` at
  `%TEMP%\omniroute-research` (package version `3.8.53`, `package.json:3`; removed
  after the read); this
  repository's built `packages/models/dist/index.js`; the design record
  `docs/design/2026-10-12-smolagents-ts-v1-design.md`; decisions 0006, 0011,
  0014, 0018, 0019.
- **Variants:** (1) the shipped adapter against a local stand-in server that
  replays the frame shapes OmniRoute's source emits; (2) OmniRoute's reference
  docs and its route handlers read directly. Held identical across both: the
  adapter build, the model id `auto`, and the tool schema.
- **Budget:** read-only source reading plus two throwaway Node probes outside the
  repository. No credential, no live OmniRoute instance, no build and no test
  suite was run (the workspace was shared).

## Method

```bash
# 1. clone the gateway (read-only input, ~26k files)
git clone --depth 1 https://github.com/diegosouzapw/OmniRoute %TEMP%\omniroute-research

# 2. probe: the shipped adapter against a stand-in speaking OmniRoute's shapes
node %TEMP%\omniroute-probe.mjs    # generate + generateStream + tools + usage + /v1/models
node %TEMP%\omniroute-probe2.mjs   # the four stream irregularities + error frame + key leak

# 3. read the gateway's docs and handlers for base path, port, auth, CORS, errors
```

Both probes bind `127.0.0.1` on a fixed port and are throwaway files outside the
repository; they are reproducible from the frame shapes cited in
`docs/research/omniroute-api-surface.md` and were not added to the tree.

## Results

### 1. Wire compatibility — the adapter as shipped

`OpenAICompatibleModel` was constructed with only `model`, `baseUrl`, `apiKey`
and `provider`; no source file was changed.

| # | Check | Result | Source artifact |
|---|---|---|---|
| 1 | non-streaming completion + `tool_calls` + usage | `content`, the whole `tool_calls` list, and `{in:5,out:3,total:8}` mapped correctly | probe 1 output; mapping at `packages/models/src/openai-compatible.ts:229-242`, `:120-138` |
| 2 | streaming deltas, `[DONE]`, tool-call fragments | 5 seam chunks: text delta, two tool-call deltas, `finish_reason`, then the trailing usage chunk | probe 1; parser at `packages/models/src/openai-compatible.ts:257-269`, `sse.ts:14-79` |
| 3 | `stream_options.include_usage` | request carried it; the usage chunk that OmniRoute sends with `choices: []` was yielded, not dropped | probe 1 request log; `openai-compatible.ts:287-290`, `:164-192` |
| 4 | unknown SSE traffic (`event: progress`, `: keep-alive`) | ignored; no phantom chunk, no throw | probe 1 |
| 5 | base URL, path, auth header | `http://127.0.0.1:20128/v1` + `/chat/completions`; `authorization: Bearer <key>`; `content-type: application/json` | probe 1 request log; `transport.ts:32-49` |

### 2. The gateway's four stream irregularities

The shapes are documented in `docs/research/omniroute-api-surface.md` §2. All
four were replayed at the adapter:

| Frame OmniRoute emits | Adapter behaviour | Verdict |
|---|---|---|
| synthetic keepalive `chat.completion.chunk` (`chatcmpl-keepalive`, `created:0`, `model:"keepalive"`, empty delta) | dropped: `chunksFor` yields a chunk only when it carries content, a tool delta, a finish reason or usage | PASS |
| mid-stream error as a `data:` frame with top-level `error` and no `choices` | throws `The openai-compatible stream reported an error (stream_error): ...`; the API key did **not** appear in the message | PASS |
| trailing usage-only frame with `choices: []` | yields exactly one usage chunk; the run stays priceable | PASS |
| synthesized `finish_reason` frame | yields one finish chunk | PASS |

### 3. What the gateway adds that this project's seam cannot carry

| OmniRoute provides | Where | Our `Model`/`TokenUsage` |
|---|---|---|
| routing trace (`strategy=…; provider=…; latency_ms=…`), chosen provider/model, fallback attempts, per-request USD cost, cache HIT/MISS | `X-OmniRoute-*` response **headers** only; provider extras are stripped from bodies | no channel: `ChatCompletion` is `{content, toolCalls, usage, finishReason}` (`packages/core/src/model.ts:13-18`) and the adapter never reads response headers |
| `usage.cached_tokens`, `cost_in_usd_ticks`, `tokens_per_second`, `estimated` | usage allowlist in the body | dropped: `fromWireUsage` keeps only prompt/completion/total (`openai-compatible.ts:129-138`); probe 2 confirms 3 numbers in, 3 numbers out |
| `reasoning_content` on message/delta | body | dropped; harmless for the ReAct loop, since the action is the `content` |

## Gate verdict

| Gate | Required | Actual | Verdict |
|---|---|---|---|
| Wire compatibility | 5/5 checks match the prediction | 5/5 matched | **PASS** |
| Stream irregularities | 4/4 absorbed | 4/4 absorbed; error surfaced as a throw with no key leak | **PASS** |
| Documented base path, port, auth | agree with what the adapter sends | `PORT` 20128, `/v1` root, Bearer, `REQUIRE_API_KEY=false` by default | **PASS** |

## Conclusion

**OmniRoute is already supported at the wire level, and that support is
verified — zero lines of code change.** The shipped `OpenAICompatibleModel`
serves the gateway's `/v1` surface for text, tool calls, streaming and priced
streamed usage, and it absorbs all four of the gateway's stream irregularities.
The CLI reaches the same endpoint through `--api-base`
(`packages/cli/src/model-factory.ts:56-71`). Nothing about the port, the auth or
the frame shapes required a new adapter.

So the remaining work is not a wire-format problem. It is three things the
evidence does support, in ascending cost:

1. **Discoverability.** No document, example or test in this repository names a
   gateway, so no reader can find the two-line recipe. `OmniRoute` appears only
   in the design record's forward-looking table
   (`docs/design/2026-10-12-smolagents-ts-v1-design.md:121`, `:664`, `:668`).
2. **Model selection.** OmniRoute exposes ~1475 model ids and combos through
   `GET /v1/models`; this project has no model-listing capability at all, either
   in the seam or in the package's public surface
   (`packages/models/src/index.ts:1-11`). A gateway user must know an id before
   they can start.
3. **Gateway metadata.** The gateway's headline value — which provider served
   the request, what it cost, whether a fallback fired — lives in response
   headers that the `Model` seam deliberately has no room for. Carrying it is a
   new capability, not an adapter.

**The project already pre-registered the home for (2) and (3):** a tier-3
`models-gateway` package "an OpenAI-compatible adapter for AI gateways/proxies:
**OmniRoute, LiteLLM, Portkey**" that "later adds gateway-specific features
(routing policies, fallback, budget headers) without contaminating `core`"
(`docs/design/2026-10-12-smolagents-ts-v1-design.md:664-669`). What the design
record did not settle is *when*: decision 0019 keeps "a provider router /
fallback layer and local model runtimes" out of the closed S7–S11 roadmap and
leaves them "later candidates … revisited only when a user asks"
(`docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md:35-40`).

**This request is that user ask.** It does not, by itself, schedule the
package: the boundary is the owner's to move, by a new decision record rather
than an edit to 0019 (`docs/00-schema.md:22-25`).

## The four shapes, priced

| shape | repository change | public surface | can carry routing/cost metadata | scheduling decision needed |
|---|---|---|---|---|
| **C — userland**: `OpenAICompatibleModel` with `baseUrl`, or a `CustomModel` wrapper | none | none | only inside the caller, by reading headers itself | no |
| **A — adapter file** in `packages/models/src` (the `huggingface.ts` precedent: 21 lines + a 103-line test + one fixture) | ~6 files: adapter, barrel, pinned surface test, test + fixtures, `AGENTS.md`, changeset | one permanent exported name | **no** — the component rule forbids policy ("an adapter is data, not policy", `rules/components/models.md:3-5`) | no, but it contradicts the design's anti-sprawl strategy |
| **B — `models-gateway` package** | ~8 pack artifacts + ~10 gate edits (`docs/research/omniroute-integration-notes.md` (d), `scripts/checks.py:221-244`) | a new package name and export map | **yes**, its own class can hold model discovery and metadata out-of-band | **yes** — new decision record; 0019 leaves it unscheduled |
| **D — extend the `Model` seam** | core change | breaking for every adapter | yes, in the transcript | yes |

**Shape A is not the right answer here, on the project's own reasoning.**
Tier 1 is "deliberately small and the ecosystem is covered through wire-format
compatibility rather than adapter sprawl"
(`docs/design/2026-10-12-smolagents-ts-v1-design.md:666-669`); a named
`OmniRouteModel` buys one constructor option and costs a permanent public name.
`HuggingFaceModel` earns its keep because it is a *different host with a
different default*, and even it is 21 lines. All the real gateway value lives in
shape B, which A is forbidden to touch.

## Recommendation

**Phase 0 — do now, no decision needed.** Treat gateway support as
documentation plus one regression fixture, because the code already exists:

- one docs page (docs-site and root README) with the recipe
  `new OpenAICompatibleModel({ model, baseUrl: "http://localhost:20128/v1", apiKey })`,
  the `--api-base` CLI form, the `REQUIRE_API_KEY` note, and the CORS caveat;
- one example under `examples/` that prints SKIPPED and exits 0 without a
  gateway, following `examples/live-provider/index.mjs:16-30` so the gate stays
  key-free (`docs/01-project.md:96-97`);
- one models test with a hand-shaped fixture carrying the four gateway-readable
  frames (keepalive, error-as-data, `choices: []` usage, synthesized finish),
  which turns the probe above into a regression test for every adapter that
  speaks this wire format. The fixture is hand-shaped from
  `docs/research/omniroute-api-surface.md`, never called a recording
  (`packages/models/AGENTS.md:50-52`).

**Phase 1 — needs one decision record first.** If the owner wants gateway
*features* rather than gateway *reachability*, open the `models-gateway` package
as designed, with the metadata carried out-of-band on the package's own class
(a `listModels()` over `GET /v1/models`, and a last-response decision/cost
struct the caller reads) rather than through `ChatCompletion`. That keeps the
seam and core untouched, which is the design's stated reason for a separate
package. Do **not** take shape D: it would change `core` for one consumer and
break every adapter.

**Do not** build a provider preset table. There is none to extend, and the
design chose wire-format compatibility over one
(`docs/research/omniroute-integration-notes.md` (e)).

## Risks and constraints that survive any phase

| Risk | Why it matters here | Mitigation |
|---|---|---|
| **Routing defeats determinism.** `auto` and combos may route each request to a different provider, while G6 pins behaviour to golden transcripts (`docs/01-project.md:84`). | A recorded fixture proves the *wire*, never the *model*. | Keep gateways in examples and runbooks, never in golden transcripts; pin a model id for reproducible runs. |
| **A static capability bag can lie.** `capabilities` is per adapter (`packages/core/src/model.ts:60-65`), but one gateway id fronts hundreds of providers. | `ToolCallingAgent` interprets zero tool calls as `kind: "empty"` (`packages/core/src/agent/tool-calling-agent.ts:49-53`), so a route to a tool-less model fails as a parse error, not as "this model cannot call tools". | Document pinning a known tool-capable id for `ToolCallingAgent`; Phase 1 sets capabilities conservatively. |
| **Gateway cost is invisible.** | The selling point of the gateway — cache hits, fallback savings, USD cost — arrives only in headers the adapter never reads. | Phase 1 out-of-band struct; never widen `TokenUsage` for it. |
| **Browser CORS is deny-by-default.** | The gateway allows only listed origins unless `CORS_ALLOW_ALL=true` (`src/server/cors/origins.ts:1-25`), and this project targets the browser tab (G1/G4). | The docs page must state the gateway-side setting; it is not fixable from this repository. |
| **Auth is open by default.** | `REQUIRE_API_KEY` defaults to `false`, and an invalid key degrades to anonymous (`%TEMP%/omniroute-research/docs/reference/ENVIRONMENT.md:229`). | Say plainly: localhost-only for development; do not expose the port. |
| **Timeout and retry live on the wrong side of a rule.** R-07.10 requires timeouts and backoff on network calls, while the models package owns neither (`rules/07-dependencies-and-external-services.md:49-51`; `rules/components/models.md:3-5`). | A gateway adds hops and therefore 429s and 5xx. | The seam's `GenerateOptions.signal` is the timeout hook; any retry policy belongs to the caller, or to Phase 1's package, not to the adapter. |
| **Tool arguments are semantically, not byte-, equal.** | Text-only upstreams are parsed reconstructively and zero-width characters stripped (`docs/research/omniroute-api-surface.md` §3). | Nothing to fix; do not write a test that pins argument bytes through a gateway. |

## What the evidence does not support

- **No live OmniRoute instance was contacted.** Every compatibility claim is
  against a stand-in built from the gateway's own source shapes, plus its docs.
  A first real run is the remaining step, and it needs a provider account, not
  code.
- **Per-provider tool fidelity across ~375 providers was not verified**, and the
  fallback path's tool-call ordering is unverified
  (`docs/research/omniroute-api-surface.md` §3).
- **The gate was not run and no test was added.** The probe lives outside the
  repository; it becomes evidence for this decision, not coverage.
- **`/v1/completions`, `/v1/messages/count_tokens`, management routes, MCP and
  A2A were not read** beyond the endpoint table.

## Levers to carry forward

- **Check the wire before writing an adapter (R-07.1).** Three of the four
  shapes existed already; the investigation replaced a class with a paragraph.
- **A gateway's value is its headers, and the `Model` seam has no header
  channel.** Any future gateway work starts from that, not from the body.
- **The four-frame fixture is the reusable artifact.** It is the first test that
  covers `[DONE]`, an error-as-data frame, a `choices: []` usage chunk and a
  synthesized finish reason in one place.
- **`post()` is private and the path is literal** (`openai-compatible.ts:233`,
  `:248`), so an endpoint that is not `/chat/completions` needs an adapter, not
  a subclass — relevant if anyone asks for `/v1/responses`.

## Close-out

- [x] Report finished and filed.
- [x] Task row opened: T-39 in `docs/04-tasks.md`.
- [x] Lesson added to `docs/memory/general.md` and its registry row updated.
- [ ] Task status updated once the owner picks a phase.
- [x] Artifacts retained: the two shards and this record; the probes are
      throwaway and were deleted with the clone.
