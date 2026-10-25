# 0031 — the snapshot carries the conversation, and `ChatSurface` defaults to it

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is recorded in a new file that supersedes this one; this file is not edited.
- **Read when:** wiring the React layer to a live run, or asking what `AgentSessionSnapshot.messages` is and why it is not the model transcript.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** the owner, answering `D-06` in the open-decisions plan
- **Supersedes:** none; it finishes the seam design 5.3 and 10.3 already describe, and it discharges the `D-06` conditional in `0030`

## Context

`T-28` asked a binary question: does the session snapshot grow a `messages` projection, or does the React package derive its rows from `steps`? Reading the code before framing the options changed the question.

`AgentMemory.toChatMessages()` already exists (`packages/core/src/memory/memory.ts:167`). Its doc comment calls it "the derived chat view used by the React shell (design spec 5.3, layer L1)" and says it is "deliberately lossy: it is a conversation, not a run". It is public through the core barrel, it is covered in `memory.test.ts`, and nothing in the tree consumes it: not the session, not `ChatSurface`, not the example. Design 10.3 calls `<ChatSurface>` "messages, composer, and an optional collapsed step summary ... thin compositions of L3 -- no new machinery". The projection was designed, built and tested, and then not wired.

The symptoms the row named are real. `AgentSessionSnapshot` carries every part of a run except the conversation; the React example nests `StyledChatSurface` inside `StyledRunInspector` and hands it a fixed `TRANSCRIPT`, while the comment claims it "reads the same run's snapshot"; and `RunResult.messages` exists only at the end of a run, so it cannot feed a live surface.

The timing was checked before the implementation shape was chosen. The loop adds a step to memory before it emits the completion event the session translates: `runPlanningStep` calls `memory.addStep` and only then emits `planning.completed`, and the action step is added before its completion events. A session that recomputes the projection on step-boundary events therefore sees exactly the committed step, not the step before it. Publishing runs for every event, deltas included, so recomputing on deltas would make a long run quadratic in transcript size.

## Decision

**The snapshot carries the conversation, and `ChatSurface` reads it by default.** The choice was option A with the lossy projection (A1), and it ships in 0.1.0.

**Semantics.** `AgentSessionSnapshot.messages` is the derived conversation: the task as a user turn, each action's assistant output, inter-agent messages, and the final answer. It is not `AgentMemory.toMessages` -- observations, planning wrappers and the system prompt stay out of it. A caller who wants the model transcript already has the memory projection and `RunResult.messages`; the run view stays `RunInspector`'s job. The conversation is lossy by design, so a surface must not claim to show the run.

**Core.** `MultiStepAgent` gains one public read-only accessor for the projection, delegating to the memory renderer, beside the existing public `steps` accessor. The renderer itself stays in `AgentMemory`: it is the single implementation, which is what makes drift impossible rather than merely unlikely. No export name is added, so the pinned runtime surface is unchanged; the accessor is a class member on an already-exported class.

**Session.** `AgentSessionSnapshot.messages` is additive and read-only, recomputed at step boundaries only -- step and observation completion, planning completion, message events, and the terminal transitions -- never on a delta. It reflects committed steps: the step in flight is in `steps` and `planning`, not in `messages`.

**React.** `ChatSurfaceProps.messages` becomes optional and defaults to the snapshot's projection; a caller that passes messages explicitly still wins, so the change is source-compatible and `StyledChatSurface` needs no code change.

**Continuity.** The projection mirrors memory, so it spans turns only when the session names a checkpoint; without one the message list resets with the run. The property's documentation, the example and the React documentation say so, because that is the difference between a run viewer and a chat.

**Pre-release.** This is part of the 0.1.0 scope rather than a later addition. `0030` already covers the case in its scope sentence, so `0030` needs no edit. The alternative -- shipping an example whose chat surface claims to read the run and renders a constant -- is the one place the demo would teach a pattern the package does not support.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Derive the rows in the React package from `steps` | Writes the role-and-part mapping a second time; the second copy drifts from the projection without any test able to notice, and no non-React consumer can reuse it. |
| A separate client hook builds the projection | The same duplication as deriving in React, plus one more tested surface to keep honest. |
| Put the model transcript (`toMessages`) on the snapshot | Turns the chat into a run view: observation turns and plan wrappers in a conversation, which is noise for a reader and a second inspector beside `RunInspector`. It also contradicts 5.3's "deliberately lossy". |
| Keep the constant and document it as a demo | Leaves the shipped example teaching a pattern the package does not support, which is the defect the row exists to remove. |

## Consequences

**Positive**

- One conversation projection, consumed by the snapshot and every surface; React holds no mapping of its own.
- The example renders the run it hosts, and its comment becomes true.
- Non-React consumers -- a terminal chat, a custom UI -- get the conversation without reimplementing it.
- The projection stays in core, so a later change to it (summary-mode planning, condensation, multimodal content) reaches every consumer at once.

**Negative / accepted costs**

- One additive snapshot field and one public accessor on the agent; both become part of the 1.x surface.
- The conversation is lossy: a consumer that wants observations must use `toMessages` or the run view.
- Without a checkpoint the transcript is per run; that is memory's behaviour, now visible in the UI.
- The projection is recomputed once per step -- O(transcript) per boundary, not per token -- and that cost is accepted.

## Reversibility

The field and the accessor are additive; a later record can define a second projection or an opt-in selector without breaking this one. Removing the field would be a breaking change, so it stays for the 1.x line. The React prop change is source-compatible in both directions: passing messages explicitly keeps working whether or not the default exists.

## Follow-up

- [ ] Core: the accessor, the snapshot field, boundary-only recomputation, and tests -- the live projection equals the memory renderer; a delta does not move `messages`; the in-flight step is absent; a checkpointed session shows earlier turns -- owner: lead, pre-release.
- [ ] React: `messages` optional and defaulting to the snapshot, a default-case test and an override test, and a `StyledChatSurface` default test -- owner: lead, pre-release.
- [ ] Example: delete the constant, correct the comment, and check the demo renders its own run -- owner: lead, pre-release.
- [ ] Docs: the snapshot documentation and the React scoped entry say the list is a conversation and needs a checkpoint for continuity -- owner: lead, pre-release.
- [ ] `T-14`: the gate names this item explicitly; `T-48` still runs after `D-01` and `D-02` land -- owner: lead, pre-release.
