# 0023 — one identity per run: runId, waiting, pending, resume

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** naming a durable-run concept, a CLI flag or an event.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-24
- **Decided by:** owner, answering the plan's record-vocabulary question
- **Supersedes:** none

## Context

The shipped seam names the durable unit twice: a store saves a snapshot under a
caller-chosen string called a checkpoint, and the run option carrying that string
is `AgentOptions.checkpoint` (`packages/core/src/session/run-store.ts:3-14`,
`packages/core/src/agent/multi-step-agent.ts:85-86`). The durability brief
proposes a record with a `runId` and a status enum of
`running | waiting | completed | failed | interrupted`, one `pending` object
for whatever the run is waiting on, and `resume` as the verb.

The neighbours use different words for the same three ideas — interrupt,
suspend, confirmation, inbox — and a framework that mixes them ends with two
names for one concept. The port has a further reason to pick carefully: its loop
already raises `AbortSignal` for cancellation, so "interrupt" is taken by a
shipped mechanism, and "pause" reads as a host instruction that nothing enforces.

## Decision

A run is addressed by a `runId`. Its durable record, the store key and the CLI
argument all use that one identity; the public `checkpoint` option is renamed
`runId` in Phase 1.1. A run that is parked on a pending request has status
`waiting` and carries a `pending` object; `resume` is the verb that settles
it. `interrupted` means the process died mid-step and is never used for a
human pause.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Keep `checkpoint` as the identity** | Then a record has a key and a `runId` field with the same value — two names, one thing, and every log line has to say which it means. |
| **Use "pause" as the state** | It reads as an instruction the host gives; the state is one the record is in, and the reason is the pending object. |
| **Use "interrupt" as the state** | The loop already aborts through `AbortSignal`, so the word is spent; and a human pause is not an interruption. |
| **Use "suspend"** | True to no neighbour in particular and to no mechanism in this tree; it would be a third vocabulary with no evidence behind it. |

## Consequences

**Positive**

- One word per concept across the record, the store seam, the events and the
  CLI, so a reader never has to translate.
- The rename is mechanical and free while nothing is published; after 0.1.0 it
  would need a deprecation.
- `waiting` and `pending` separate the state from its reason, which the
  neighbours' single word does not.

**Negative / accepted costs**

- A public option is renamed, so every existing test and the handoff's examples
  change spelling in the same phase.
- "checkpoint" stays in the docs of the store as a generic idea, which a reader
  may still meet; the code no longer carries two identities.

## Reversibility

Easy before 0.1.0 and merely mechanical after: the option is a string key, so an
alias could be honoured for one minor if a caller ever needs it.

## Follow-up

- [ ] **Phase 1.1** performs the rename with the record change.
- [ ] **Phase 1.6** exposes `--resume <runId>` and `--approve <requestId>`.
- [ ] **The events** use `run.waiting`, `run.resumed` and a stop reason that
  names the pending kind rather than a second vocabulary.
