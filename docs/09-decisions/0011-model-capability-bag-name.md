# 0011 — the model's capability bag is capabilities

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before renaming a capability bag, or after meeting `supports` in
  the design record.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the owner, on the adoption session's recommendation
- **Supersedes:** none

## Context

The design record's section 7 declares
`readonly supports: { streaming, toolCalls, images, structuredOutput }` on
`Model`. The implementation shipped `capabilities: ModelCapabilities` with
`modelCapabilities()`, and every task after the first used that name. The S1 plan
carried the disagreement to the whole-branch review as plan/spec drift, and it
stayed carried: no decision and no task ever owned it. Upstream has no capability
bag at all — its only related name is `supports_stop_parameter` — so the design's
spelling was a free choice rather than fidelity to anything.

## Decision

The bag is `ModelCapabilities`, reached as `model.capabilities` and built by
`modelCapabilities()`. The design record keeps its original spelling as history;
this record is the live answer.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Rename the code to `supports`** | The design already names the executor seam's bag `ExecutorCapabilities`, so `supports` contradicts the spec's own vocabulary; renaming would touch four adapters, their tests and the public surface to match the weaker of two names the spec uses inconsistently. |
| **Leave the drift unrecorded** | It was carried through four milestones and rediscovered by this session; a reader diffing spec against code pays that cost every time. |
| **Correct the design record in place** | The design tree holds history, not a live answer. |

## Consequences

**Positive**

- One name for both capability bags, and the drift has a home a reader reaches
  from the decisions index.

**Negative / accepted costs**

- A reader who starts from the design record meets `supports` first and must
  follow the pointer here.

## Reversibility

Easy while nothing is published: the rename is mechanical and the gate catches
every site.

## Follow-up

- [ ] none.
