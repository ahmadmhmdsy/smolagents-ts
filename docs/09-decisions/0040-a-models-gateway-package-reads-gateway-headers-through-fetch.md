# 0040 — a `models-gateway` package reads gateway headers through `fetch` and reports them as an event

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before adding a gateway feature, a model-listing call, or a field that carries a gateway's routing or cost.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-11-13T12:00:00+03:00
- **Decided by:** owner, 2026-11-13: T-54 "Open it now"
- **Supersedes:** none. It schedules the package [0019](0019-post-0.1.0-roadmap-is-s7-s11.md) left unscheduled and opens phase 1 of D-08, which [the open-decisions plan](../plans/2026-10-25-open-decisions-plan.md) parked as `T-54`.

## Context

An AI gateway such as OmniRoute already works through `OpenAICompatibleModel`: [the gateway investigation](../research/2026-10-21-omniroute-gateway-support.md) passed 5/5 wire checks and 4/4 stream irregularities with no code change, and D-08 phase 0 documented that path. What a gateway adds is not on the wire body. Which provider served a request, what it cost, whether the cache hit and how many fallbacks fired arrive only as `X-OmniRoute-*` response headers ([the API surface notes](../research/omniroute-api-surface.md) §1), and the `Model` seam has no header channel. The gateway also lists about 1,475 model ids at `GET /v1/models`, and nothing in this library can list models.

D-08 left one question open: where the metadata goes. Three channels were named. State on the model instance is shared mutable state when two runs share a model. A callback in `GenerateOptions` cannot be reached from a run, because no agent sets `providerOptions` per call (`packages/core/src/model.ts:88` is the only mention in core's source). A core event would teach the core a gateway concept, which [0019](0019-post-0.1.0-roadmap-is-s7-s11.md) and the design's tier rule both refuse.

Two facts make a fourth channel possible without touching `core` or `models`. `OpenAICompatibleOptions` already takes a `fetch` (`packages/models/src/openai-compatible.ts:31`), so a wrapper can see every response's headers before the adapter reads the body. And [`FallbackModel`](../../packages/models/src/fallback.ts) already reports what it did through a constructor callback, `onFallback`, which is an event rather than state.

## Decision

Open `@smolagents-ts/models-gateway` with this v1 scope:

1. **`GatewayModel`**, which implements `Model` by composing an `OpenAICompatibleModel` and handing it a `fetch` that reads the response headers. `core` and `models` do not change.
2. **The metadata channel is an event:** an `onResponse(meta, context)` constructor option, called once per completed request with the parsed headers. The model keeps no last-response state. A caller who must attribute metadata to one run builds one `GatewayModel` per run, which costs an object, not a connection.
3. **`GatewayResponse`** carries the OmniRoute headers this record names, each optional: `provider`, `model`, `costUsd`, `cache` (`"hit"` or `"miss"`), `fallbackAttempts`, `latencyMs`, `decision` (the raw `X-OmniRoute-Decision` string), `requestId`, plus `headers`, every response header whose name starts with a configured prefix (default `x-omniroute-`). A gateway that is not OmniRoute is served by the prefix, without a parser per gateway.
4. **`listGatewayModels(options)`** reads `GET {baseUrl}/models` and returns the ids. It is a function, not a method on the seam.
5. **Capabilities are conservative.** One gateway id can front a model without tools, so `toolCalls` defaults to `false` and the caller sets it after pinning a tool-capable id. `provider` defaults to `"gateway"`, and `id` is the id the caller configured. The run is priced from the price table, or reported unpriced, exactly as any other adapter; the gateway's own USD figure is in the event and never enters `TokenUsage`.
6. **The package is outside the fixed release group**, like `exec-remote`, `exec-pyodide`, `mcp` and `retrieval`, and it is not re-exported from the `smolagents-ts` umbrella. It depends on `@smolagents-ts/core` and `@smolagents-ts/models`, as every package here depends on the core.

v1 does not route, retry, budget, manage combos, read the optional SSE comment trailer, or call any endpoint but `/chat/completions` and `/models`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Last-response state on the model instance | two runs that share one model overwrite each other's value; D-08 named this as the defect to avoid |
| A callback in `GenerateOptions.providerOptions` | no agent sets `providerOptions` per call, so a caller could not reach it from a run without a core change |
| A core event for model metadata | makes a gateway a core concept and changes the seam every adapter implements |
| An `OmniRouteModel` in `@smolagents-ts/models` | an adapter is data, not policy (`rules/components/models.md`), and the investigation priced it as a permanent name for one constructor option |
| Subclassing `OpenAICompatibleModel` | `post()` is private (`openai-compatible.ts:364`); the `fetch` option reaches the headers with no change to `models` |
| A parser per gateway (LiteLLM, Portkey) in v1 | no caller has asked for one; the prefix keeps their headers reachable until one does |

## Consequences

**Positive**

- A gateway's routing and cost reach the caller with no change to `core`, `models` or the seam.
- Concurrent runs cannot read each other's metadata, because nothing is stored.
- The package can be dropped or rewritten without touching the six fixed packages.

**Negative / accepted costs**

- A seventh-plus package to build, pack and gate.
- A caller who shares one `GatewayModel` across runs gets the events but cannot tell which run each one belongs to.
- `toolCalls: false` by default means a `ToolCallingAgent` user must set one option before the first run.
- The parsed fields follow OmniRoute's header names at the version the research read (`3.8.53`); a rename there is a fix here.

## Reversibility

High. The package is additive and outside the fixed group. Withdrawing it removes one package and changes nothing another package exports.

## Follow-up

- [ ] `T-54` builds the package: source, tests over a hand-shaped header fixture, README, `AGENTS.md` row, changeset, and the pack and gate wiring every package has. Owner: lead.
- [ ] The gateway runbook names `GatewayModel` beside the phase-0 recipe. Owner: lead.
