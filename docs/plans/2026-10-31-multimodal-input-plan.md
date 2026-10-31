# Plan — multimodal input for 0.2.0

- **Status:** in_progress
- **Owner:** lead
- **Created:** 2026-10-31T23:55:00+03:00
- **Authorized by:** the owner in chat, 2026-10-31: "Multimodal plan now". That covers writing this plan. The owner then chose the branch: "Yes, use the branch". That covers the build and commits on this branch. It does not cover a push or a merge to `main`.

Status values are defined in docs/00-schema.md, the vocabulary authority.

## Goal

A caller can hand an agent an image or an audio clip as bytes, at the task boundary and from a tool, and every step of the run sees it on any adapter that declares the capability, while a plain string task produces exactly the request it produces today.

## Why now

[`0034`](../09-decisions/0034-multimodal-input-is-in-and-scheduled.md) schedules this as 0.2.0's headline and says this plan is the build gate: no code lands before it. The owner chose to write it now, ahead of the publish, so the design is settled when the build starts.

## Non-goals

- Generation of any kind, realtime voice and transcription.
- URLs as input. Bytes only.
- Ingestion: PDFs, extraction, chunking, resizing, transcoding.
- A CLI flag for media. Nothing in `0034` asks for one.
- Multimodal `ChatCompletion.content`. It stays a string.
- Media through `CodeExecutor`. `exec-pyodide`, `exec-quickjs` and `exec-remote` keep exchanging strings.
- A multimodal parity claim. That waits for its own scenario family.
- A persistent `MediaStore`. One in-memory implementation ships; persistence is the caller's.
- A local token estimate for media.

## Approach

**Branch.** Build on `release/0.2-multimodal`, not `main`. `main` holds the 0.1.0 that `T-14` has not published yet, and `ChatMessage.content` is a public type, so landing this there would ship 0.2.0's surface as 0.1.0. The branch merges after `T-14` runs. If the owner decides 0.1.0 will never publish, it merges anyway and 0.2.0 is the first release.

**One representation in memory, one resolution point.** `toMessages()` is synchronous and `MediaStore` may not be, as `RunStore` may not. So memory and snapshots hold only `MediaRef`s, and the transcript carries each part by reference. The loop resolves references to bytes in one awaited step immediately before `generate` or `generateStream`. Nothing upstream of that step ever holds bytes, which is what keeps them out of snapshots, checkpoints, events and traces by construction rather than by redaction.

**Strings stay strings.** A message with no media keeps `content: string` all the way to the adapter. No text gets wrapped in a part on a path that has no media, so existing requests stay byte-identical and the parity traces need no re-recording.

**Tool media arrives as a user turn.** The tool message stays text, because OpenAI's `tool` role cannot carry an image. The attachment follows it as a `user` message with parts, on every adapter. Anthropic's tool result content blocks would be neater, but one path is what the fixtures can pin for all three.

**Refuse early.** Capability, allowlist and caps are checked at the boundary, before the first model call and before a tool result enters the transcript, with typed errors. A run never spends tokens to learn that its model cannot see.

**Allowlist.** `image/png`, `image/jpeg`, `image/webp`, `image/gif`, `audio/wav`, `audio/mpeg`. That is the set all the declaring adapters should accept, to be confirmed against current provider docs in Phase 2.

## Phases

### Phase 1 — The core contract

- **Deliverable:** `ContentPart`, `MediaRef`, the allowlist, the per-part and per-run caps, typed errors, the `audio` capability flag, `MODEL_ADAPTER_VERSION = 2`, the shim, and a text-only reading of `content` for every string-assuming consumer.
- **Files likely affected:** `packages/core/src/types.ts`, `model.ts`, `errors.ts`, `index.ts`, `agent/multi-step-agent.ts:2412`, `testing/mock-model.ts`, `packages/core/test/model-adapter.test.ts`, `packages/models/src/custom.ts`.
- **Exit criterion:** the full gate passes with no behaviour change: no adapter sends a part yet, and a version-1 adapter still receives strings.
- **Verification:** `pnpm gate`; a shim test with a version-1 adapter fed text parts, and fed media (refused before the call); `estimatedTokens` counts text parts only, tested.

### Phase 2 — The adapters

- **Deliverable:** part mapping in the OpenAI-compatible, Anthropic and Gemini adapters, base64 that works in a browser, and honest flags: `images` true on all three, `audio` true on OpenAI-compatible and Gemini, false on Anthropic. A `capabilities` override for a route that cannot do what its protocol can.
- **Files likely affected:** `packages/models/src/openai-compatible.ts`, `anthropic.ts`, `gemini.ts`, `packages/models/test/`, new fixtures.
- **Exit criterion:** each adapter's request for an image and, where declared, a clip matches a fixture; a string-only request is byte-identical to the existing fixtures.
- **Verification:** `pnpm vitest run --project models`; `adapter-conformance.test.ts` extended; the streamed Anthropic cache split fixture that `T-57` hands to this task; one live image call per adapter whose key exists, recorded as run or not run.

### Phase 3 — The task boundary

- **Deliverable:** `run` and `stream` accept a string or parts, the capability and cap checks run first, and media reaches the model call and the planning messages.
- **Files likely affected:** `packages/core/src/agent/multi-step-agent.ts:290,805,851,904,1470,1486`, `memory/steps.ts:148,183`, `memory/memory.ts:121,158,219`, `session/agent-session.ts`.
- **Exit criterion:** a scripted image task reaches every step's request and the plan's; an adapter without the capability fails before any model call; a string task's trace is unchanged.
- **Verification:** `pnpm vitest run --project core`, parity included with no re-recording.

### Phase 4 — References and the store

- **Deliverable:** `MediaStore`, shaped like `RunStore`, with one in-memory implementation; `TaskStep` keeps its text and gains `attachments?: readonly MediaRef[]`; the one awaited resolution step; a typed error when a resumed run's bytes are gone.
- **Files likely affected:** `packages/core/src/session/` (new `media-store.ts`), `memory/steps.ts`, `agent/multi-step-agent.ts`, `session/file-run-store.ts`, `agent/background-child.ts`.
- **Exit criterion:** a checkpoint round trip holds references and no bytes; resume with the store works; resume without it fails by name, not with a provider error.
- **Verification:** a test that serialises a snapshot, every event and every trace span of an image run and asserts a sentinel byte pattern appears in none; a snapshot taken by 0.1.0 still loads.

### Phase 5 — Tool attachments

- **Deliverable:** a tool may return `attachments: readonly MediaRef[]` beside its text; the code-level tool prints a text handle; the loop stores the bytes and adds the `user` turn; caps and capability apply per attachment, and a refusal reaches the model as an observation, not a crash.
- **Files likely affected:** `packages/core/src/tool/tool.ts:168`, `agent/multi-step-agent.ts`, `memory/steps.ts`.
- **Exit criterion:** a tool's image reaches the next model call on the code and tool-calling agents, with no file changed under `packages/exec-*`.
- **Verification:** core tests; an Anthropic fixture with a `tool_result` followed by the user turn, since that adapter folds both into one provider turn; `git diff --stat` on `packages/exec-*` is empty.

### Phase 6 — The UI

- **Deliverable:** `chat-surface.tsx:54` and `react-ui` read parts: text as text, an image with its alt text, audio as a labelled control. `toChatMessages` keeps being lossy on purpose.
- **Files likely affected:** `packages/react/src/chat-surface.tsx`, `packages/react-ui/src/`, `packages/core/src/memory/memory.ts:219`.
- **Exit criterion:** a message with parts renders; an image with no alt text gets a visible fallback, never an empty `alt`.
- **Verification:** `pnpm vitest run --project react` and the `react-ui` project.

### Phase 7 — Docs, example, release shape

- **Deliverable:** the capability table in README and the models docs; a security note on prompt injection through images, on bytes being the caller's to own, and on guardrails that cannot read pixels; docs that open with the capability check; `examples/vision` with alt text, skipped without credentials; the 0.2.0 changeset.
- **Files likely affected:** `README.md`, `docs/`, `examples/vision/**`, `.changeset/`, scoped `AGENTS.md` files.
- **Exit criterion:** the example runs or skips cleanly; the merged branch is ready for a 0.2.0 release once `T-14` is done.
- **Verification:** `pnpm gate`, `python scripts/validate_context.py`, `python scripts/selftest.py`, `python scripts/rotate.py --check`.

## Risks

| Risk | Impact | Mitigation | Trigger that means it happened |
|---|---|---|---|
| Widening `content` breaks a consumer that reads it as a string | type errors for callers on upgrade | a minor bump in 0.x, a migration note, an exported text-reading helper | a package in this repo needs more than the helper to compile |
| Bytes leak into a snapshot, event or trace | oversized logs, private media in telemetry | references everywhere; the sentinel test in Phase 4 | the sentinel appears in any serialised output |
| A string path changes shape | silent parity loss | strings stay strings; existing fixtures unmodified | any existing fixture or trace needs editing |
| `images: true` is a claim about a protocol, not the route | a gateway or Hugging Face route rejects the image at the provider | the `capabilities` override; the docs say so | a live route fails with a provider error |
| Base64 inflates a request past a provider limit a raw byte cap passed | a provider error after the cap check | caps set against encoded size, checked at build | a part under the cap is rejected for size |
| Image tokens are invisible to `estimatedTokens` | condensation triggers late on image-heavy runs | documented; provider-reported usage stays the budget's source | a run overflows context with no condensation |
| Resending every image on every step | cost grows with the step count | documented as the behaviour of a transcript; no pruning in this slice | the example's token use surprises in a live run |
| The long branch drifts from `main` | a painful merge | merge `main` in at each phase | a merge conflict in `multi-step-agent.ts` |

## Rollback

Every phase is one or more revertible commits on the branch; until it merges, abandoning it costs nothing and `main` is untouched.

**The merge to `main` is the one step that is not cleanly rollbackable** once 0.2.0 publishes, because `MODEL_ADAPTER_VERSION = 2` and the wider `content` are then public. Checkpoint: the gate and the Phase 7 exit criterion, reviewed by the owner before the merge.

## Open questions

- [x] Does the build wait for `T-14`, or start now on the branch? Answered 2026-10-31: start on the branch, merge after `T-14`.
- [x] Does the owner approve this plan and the build? Answered 2026-10-31: "Yes, use the branch".
- [x] The `run` input shape: a bare `readonly ContentPart[]`, or `{ text, parts }`? Answered: the bare array, matching `ChatMessage.content`.
- [x] Default caps. Answered: 5 MiB a part, 20 MiB a run, both caller-overridable; Phase 2 confirms them against current provider limits.
- [ ] Should a live image call be a release requirement? Does not block phase 1. Recommended: yes for one provider; `GOOGLE_API_KEY` exists on this host.

## Tasks

| Task ID | Phase | Status |
|---|---|---|
| T-56 | 1 to 7 | in_progress |

One row covers the plan, as `0034` asks that both slices ship together. Commits cite `T-56`. The row's `T-57` handover, the version-2 shim test and the Anthropic split fixture, sit in Phases 1 and 2.

## Notes

- `0034` item 6 reads backward for the case that matters. It says the shim normalises version-1 string content into a text part, but the shim wraps an adapter that is sent messages, so the working direction is the reverse: text parts flatten to the string a version-1 adapter expects, and media is refused before the call. The shim also reports `images` and `audio` as false whatever the old adapter declared, because version 1 never defined what that flag promised. Phase 1 records this in a decision that supersedes that one sentence; the decision's intent, that 0.1.0 adapters keep working, is unchanged.
- `HuggingFaceModel` extends `OpenAICompatibleModel`, so it inherits `images` and `audio` true unless Phase 2 overrides them. `0034` does not name it. Default: inherit, with the override and the docs covering a route that refuses.
- `docs/01-project.md`'s non-goal line already points at `0034`, so that follow-up is done.
- No adapter sets `images` to true today, so nothing relies on the flag's old meaning.
- `react-ui` sits outside the fixed group, so its change needs its own changeset entry. `0035` keeps the group at six.
- Provider limits, read 2026-10-31. Gemini lists png, jpeg, webp, heic and heif, not gif, so its adapter refuses `image/gif`; it caps inline data at 20 MB a request. OpenAI lists png, jpeg, webp and non-animated gif, with 512 MB a request and no per-image size. Anthropic lists jpeg, png, gif and webp, with 10 MB base64-encoded an image on its own API and 5 MB on Bedrock, so the 5 MiB default clears the first and sits slightly over the second. No default changed; Phase 7 documents the Bedrock gap.
- Two shapes stay unconfirmed by a provider page. OpenAI's vision page now shows only the Responses form, so the chat completions `image_url` part rests on its established shape, and its audio examples show only `wav`, so `mp3` is unconfirmed.
- Live image calls, 2026-11-01. Gemini: run through the built adapter with `gemini-2.5-flash` and a generated red PNG; it answered "Red". OpenAI-compatible and Anthropic: not run, no key on this host.
- That Gemini reply reported 271 input, 1 output and 364 total tokens. The gap is what the provider counts outside those two fields, presumably thinking, and it predates this work. It is not a media defect, and `usage` does not explain it.
