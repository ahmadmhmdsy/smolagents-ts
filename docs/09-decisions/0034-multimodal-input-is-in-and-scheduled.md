# 0034 — multimodal input is in, input-only, and it is the 0.2.0 phase

**Contract**
- **Role:** the record that lifts multimodal input out of decision 0018's non-goal bucket, fixes its scope, and puts it in the schedule ahead of retrieval.
- **Mutability:** frozen once accepted. A reversal is a separate record; this one stays as written.
- **Read when:** building or pricing the multimodal seam, or asking why image or audio output, realtime voice and PDF ingestion are still out.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** the owner, on the D-11 row of [the open-decisions plan](../plans/2026-10-25-open-decisions-plan.md), approving the lead's proposed scope: input only, 0.2.0's headline, before retrieval, both tool slices in one phase.
- **Supersedes:** none. It lifts one item from [0018](0018-post-0.1.0-scope-boundary.md)'s platform bucket and leaves the rest of that boundary standing.

## Context

0018 kept multimodal with voice, agent-to-agent protocols, MCP server authoring and a dev UI: a non-goal until a user asked and a seam could host it. The owner asked on 2026-10-25 for models that can see and hear through this framework. Both conditions now hold. The seam exists at the model layer and is simply narrower than the providers: `ChatMessage` carries text only (`packages/core/src/types.ts:5-14`), every adapter declares `images: false`, and the capability bag's `images` field is a forward declaration that no caller can act on. The gap matrix records this as `MD-04`, carried by four competitors and ranked 37 in the backlog, with effort M for a first version.

The disposition of the deferred items has changed twice already this year in writing, not by drift: 0026 brought retrieval in as a seam, 0033 kept the Pyodide worker parked with its shape pre-registered. The same treatment applies here — the capability comes in, its packaging and its limits are written down, and the build waits for its own plan.

## Decision

1. **Scope is input only, in two modalities: image and audio.** Image or audio *generation*, realtime voice conversation, and transcription products are not this seam.
2. **Ingestion is refused.** PDFs, text extraction, page rendering, chunking and document pipelines stay out: the seam accepts one image or one audio clip as bytes, and a PDF is the caller's to rasterise.
3. **One content shape.** `ChatMessage.content` becomes `string | readonly ContentPart[]`, with parts `text`, `image` (media type, bytes, optional detail) and `audio` (media type, bytes, format). Only input messages widen: `ChatCompletion.content` and every model output stay `string`, so the loop, its steps, the events and the eval harness learn no new type.
4. **Bytes, never URLs.** The framework never hands a provider an address the caller supplied, so there is no provider-side fetch and no exfiltration path. A media-type allowlist, per-part and per-run byte caps, and typed errors for unsupported or oversized content; a declared media type is checked, not trusted.
5. **Capabilities answer honestly.** `images` becomes true for the OpenAI-compatible, Anthropic and Gemini adapters. A new `audio` flag is true only where the wire exists (the OpenAI-compatible `input_audio` shape and Gemini inline data) and false for Anthropic, whose adapter refuses audio with a typed error rather than forwarding it to a 4xx. The per-adapter table is documentation, because "audio" is not one capability.
6. **The adapter contract moves to version 2.** `MODEL_ADAPTER_VERSION` becomes 2 and `upgradeModelAdapter` normalises version-1 string content into a text part, so an adapter written for 0.1.0 keeps working without a rewrite.
7. **Tool-produced media does not touch the executors.** A tool may return `attachments: readonly MediaRef[]` beside its text; the code-level tool prints a text handle, and the loop attaches the referenced bytes to the transcript. Executors keep exchanging strings, so no runtime marshalling changes and no base64 crosses a guest.
8. **Durable state carries references.** Snapshots and checkpoints hold `MediaRef { id, mediaType, byteLength }`; the bytes live behind a `MediaStore` seam shaped like `RunStore` — interface, one in-memory reference implementation, caller-owned persistence. Events and traces carry references, never content.
9. **Scheduling.** The build is an execution plan of its own, after 0.1.0, as 0.2.0's headline phase and ahead of retrieval. The phase ships both slices — the task boundary and tool attachments — with their tests; neither is a follow-up row.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Keep the park (0018's default)** | The owner asked, and the seam can host it; the deletion of a stated need behind a speculative retrieval phase would invert the queue. |
| **Provider-side URLs as parts** | The cheapest wire, and it hands the provider an address the caller supplied — exactly the ambient capability 0022's refuse list exists to keep out. |
| **An additive `parts?` field beside `content: string`** | It keeps string readers compiling, but creates two sources of truth and a "which one wins" rule in every adapter; widening the one field is the smaller long-term contract. |
| **Fold it into 0.1.0** | 0.1.0 is blocked on credentials, not code; reopening the pre-release set for the largest surface since Phase 6 would slip the release and delay the capability too. |
| **Image output in the same phase** | A different contract — new outputs, new billing, new rendering, a new eval story — that would double the phase and split its exit criterion. |
| **A separate `media` package** | The seam's home is the message type the core and every adapter already share; a package would carry types the core must know, which is the opposite of the isolation this seam needs. |

## Consequences

**Positive**

- The one capability the model layer's coverage promise was missing closes for input, and the adapter mapping stays mechanical because the union matches the wire shapes the providers already use.
- The executor bridge is untouched: code and tool agents never marshal bytes, so `exec-pyodide` and `exec-quickjs` need no change.
- Durable runs stay cheap: a checkpoint carries identifiers, and the caller owns where the bytes live and for how long.
- Compatibility is proven, not promised: version-1 adapters keep working through the shim that already exists and is already tested.

**Negative / accepted costs**

- This is the largest new surface since Phase 6: a core type, three adapters, the loop's transcript assembly, the snapshot projection, `react-ui` rendering and the tool result contract.
- Token accounting for image turns is whatever the provider reports; there is no local estimate, and the docs must say so rather than print a number that cannot be trusted.
- Images inside prompts are attacker-readable text to a model — prompt injection embedded in a screenshot is invisible to the guardrails, which is a documentation matter and a caller-facing risk, not something this seam can filter.
- A caller who switches providers can lose audio unexpectedly, so capability checks have to be part of the documented first step.

## Reversibility

Easy until the phase ships: a new record can unschedule it and no surface moves. After it ships, removal is a package-level change while the version is pre-1.0 plus a deprecation window; the version-2 contract stays, because dropping it would mean dropping every adapter written against it.

## Follow-up

- [ ] The phase's execution plan is the build gate: no code lands before it, and it owns the packaging, the tests and the example.
- [ ] A capability table per adapter in the README and the models docs, plus the security note on prompt injection through images and on caller-owned bytes.
- [ ] `examples/vision` with alt text on its image, following the existing skipped-without-credentials pattern.
- [ ] `docs/01-project.md`'s non-goal line points here for multimodal input while keeping output modalities and voice out.
- [ ] Any parity claim waits for its own scenario family: the `0032` corpus is tool-calling, and upstream's multimodal wrappers are return types, not this input seam.
