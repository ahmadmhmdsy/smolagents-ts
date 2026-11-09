# 0037 — provider fallback and local runtimes are scheduled, ahead of retrieval

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before building provider fallback, a local runtime preset, or scheduling retrieval.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-11-09T21:30:00+03:00
- **Decided by:** owner, 2026-11-09: "Provider fallback and local runtimes then Retrieval"
- **Supersedes:** none; it answers the open follow-up of [0019](0019-post-0.1.0-roadmap-is-s7-s11.md)

## Context

[0019](0019-post-0.1.0-roadmap-is-s7-s11.md) left provider routing with fallback, and local model runtimes, as later candidates. It set two conditions: a user asks, and a seam can host them without special-casing the loop. [0026](0026-retrieval-is-in.md) put retrieval on the roadmap without a date, and [0034](0034-multimodal-input-is-in-and-scheduled.md) placed multimodal input ahead of it.

On 2026-11-09 the owner asked for both later candidates, ahead of retrieval. The existing `Model` interface can host both. A fallback is a `Model` that wraps other `Model`s. A local runtime such as Ollama, LM Studio, llama.cpp's server or vLLM speaks the OpenAI-compatible wire, which `OpenAICompatibleModel` already sends. The loop learns nothing in either case.

## Decision

After multimodal input, the order is: provider fallback, then local runtimes, then retrieval (T-55). Each phase lands on `main` with a `minor` changeset and ships in the next version the owner cuts.

1. **Provider fallback** is a `FallbackModel` in `@smolagents-ts/models`. It implements `Model` over an ordered list of `Model`s. It moves to the next one only on a failure a retry could fix: a network error, a timeout, or HTTP 408, 409, 429 or 5xx. It never moves on another 4xx, which the next provider would answer the same way, and never on an abort. It does not move after a stream has emitted its first delta, because a second provider cannot continue another provider's partial answer. Its capabilities are the intersection of its members'. It is a policy over named models, not a router: no cost table, no health probe, no load balancing.
2. **Local runtimes** are presets over `OpenAICompatibleModel`: one factory per runtime with its default base URL, no required key, and honest capabilities. They are not new adapters, and they start no process: the caller runs the server.
3. **Retrieval** follows [0026](0026-retrieval-is-in.md) and T-55's gate unchanged.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| A router package with cost and latency policies | A routing product is the platform drift [0018](0018-post-0.1.0-scope-boundary.md) refuses, and it needs per-provider pricing data the library would have to keep current. |
| Fallback inside the agent loop | It would make the loop know about providers, the special case 0019 forbids. |
| A native adapter per local runtime | All four speak the OpenAI-compatible wire. Four adapters would copy one adapter and its fixtures four times. |
| A loader that starts the local runtime | Process management is the caller's concern. The library would grow a daemon, which 0026 refuses for retrieval on the same grounds. |

## Consequences

**Positive**

- A caller survives a provider outage with one wrapper, and runs against a local model with one line, and the loop does not change.
- Both pieces live in `models`, so neither adds a package.

**Negative / accepted costs**

- `models` is in the fixed group, so the next version moves all six packages. That version is already a minor for multimodal input.
- A fallback adds latency and cost when the first provider fails. The docs say so, and the wrapper reports each move through an `onFallback` callback rather than silently.
- Local presets are tested against fixtures. A live check needs the runtime on the host, and the runbook says how to run it.

## Reversibility

Easy before the next publish: both are additive exports. After it, removal is a deprecation.

## Follow-up

- [ ] `FallbackModel` with tests for each move rule and for the stream rule. Owner: lead.
- [ ] Local runtime presets with tests, and a live-check section in `docs/10-runbooks/live-provider-smoke.md`. Owner: lead.
- [ ] T-55's plan, then the retrieval build. Owner: lead.
