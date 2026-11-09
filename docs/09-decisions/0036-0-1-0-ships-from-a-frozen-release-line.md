# 0036 — 0.1.0 ships from a frozen release line, and main moves on before the publish

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before a publish, or before deciding which branch a fix belongs on.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-11-09T21:30:00+03:00
- **Decided by:** owner, 2026-11-09: "imagine that we release it and proceed with the steps (later i will release it)"
- **Supersedes:** gate item 4 of [0030](0030-the-0-1-0-gate.md), the `main == origin/main` clause only; the rest of 0030 stands

## Context

[0030](0030-the-0-1-0-gate.md) publishes 0.1.0 from `main`, with `main == origin/main` and CI green on the same revision. [0034](0034-multimodal-input-is-in-and-scheduled.md) schedules multimodal input as 0.2.0, after 0.1.0, and its build sits on `release/0.2-multimodal` waiting for the publish. The publish waits on the npm scope claim and a 2FA-bypass token, which only the owner can supply.

On 2026-11-09 the owner asked for the post-release work to proceed now, with the publish later. Held to 0030 as written, that means either nothing merges to `main` until the owner publishes, or 0.1.0 is published from a `main` that already carries 0.2.0's code.

One defect also had to reach the 0.1.0 line: a `ToolCallingAgent` without an `outputSchema` never offered `final_answer`, so a real provider could not end such a run. It was fixed on the multimodal branch, but it predates T-56.

## Decision

0.1.0 is published from the branch `release/0.1.0`, cut from `main` at `90e9b72` and carrying only fixes that belong to 0.1.0. `main` stops being the 0.1.0 candidate: the multimodal phase and the later phases merge into it now. Gate item 4 becomes: `pnpm gate` green on the release revision, `release/0.1.0 == origin/release/0.1.0`, and CI green on that revision. CI runs on pushes to `release/**` so that clause can be checked. After the publish, `release/0.1.0` merges back into `main` with its tags, and every later version is cut from `main` as the runbook already describes.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Hold `main` until the owner publishes | The owner asked for the work to proceed, and the publish date depends on external credentials. |
| Publish 0.1.0 from a `main` that carries the multimodal phase | The first release would contain 0.2.0's surface and adapter contract version 2, which is the defect [0024](0024-publication-waits-for-corrections.md) refuses. |
| Tag a commit on `main` and publish from the tag | A tag cannot take a fix. The `final_answer` defect already needed one, and a branch can take the next. |

## Consequences

**Positive**

- The post-release phases land on `main` now, in the owner's order ([0037](0037-provider-fallback-and-local-runtimes-before-retrieval.md)).
- 0.1.0 stays exactly the six-phase program plus 0.1.0 fixes, and the publish procedure is unchanged apart from the branch name.

**Negative / accepted costs**

- Two lines exist until the publish. A fix that belongs to 0.1.0 lands on `release/0.1.0` first and is merged forward into `main`; it is never cherry-picked backward again, so the history keeps one direction.
- The release branch folds fixes into the 0.1.0 changelogs, following [0035](0035-the-fixed-group-stays-and-hardening-ships-in-0-1-0.md). `main` keeps its changesets for the next version.

## Reversibility

Easy until the publish: a new record can return the gate to `main`, which would mean reverting the post-release merges or publishing them as 0.1.0. After the publish, the line has done its job and is kept only for its tags.

## Follow-up

- [x] `release/0.1.0` carries the `final_answer` fix, folded into core's 0.1.0 changelog. Owner: lead.
- [x] CI runs on `release/**`. Owner: lead.
- [x] `docs/10-runbooks/publish-0.1.0.md` names the release branch, and `docs/10-runbooks/release-guide.md` explains the whole sequence. Owner: lead.
- [ ] After the publish, merge `release/0.1.0` into `main` with `--no-ff` and push the tags. Owner: whoever runs `T-14`.
