# Session close

Run this before ending any session that changed something. A session that
produced work but no state update has cost the next session more than it saved.

## 1. State

- [ ] Entry prepended to docs/03-handoff.md, using handoff-entry.md.
- [ ] It states what was verified **and how**, and what is unverified.

## 2. Tasks

- [ ] Every task row touched this session has the correct status and owner.
- [ ] Every done row has an Evidence cell that cites an artifact.
- [ ] Every blocked row names its gate.
- [ ] Out-of-scope findings from this session are recorded as new rows.

## 3. Memory

- [ ] Every hard-won lesson from this session is appended to its topic's shard
  under `docs/memory/`, with the date, the condition, and the source, and the
  topic's row in `docs/05-memory.md` is updated.
- [ ] Every decision made at a gate is recorded in docs/09-decisions/ or as a
  lesson.

## 4. Environment

- [ ] docs/02-environment.md is updated if anything about the machine, tool,
  versions, credentials, or services changed.

## 5. Documentation

- [ ] Any behavior change is reflected in the docs that describe it.
- [ ] Any new *kind* of document has a row in the document map (AGENTS.md, "Where truth lives").
- [ ] No stale links introduced; fix any found.

## 6. Hygiene

- [ ] Owned background jobs and processes are stopped or intentionally left
  running and reported.
- [ ] No half-applied migration, no temporary file that matters, no orphaned
  state.
- [ ] The working tree is in a state a human can understand: either committed,
  or explicitly described as uncommitted.

## 7. Report

- [ ] What changed, and where.
- [ ] What was verified, with the command and result.
- [ ] What was not verified, and why.
- [ ] Known limitations.
- [ ] The single next recommended step.

## 8. Integrity

- [ ] Validation run: the project's fast check, plus the context validator if
  documents changed.

      python scripts/validate_context.py .
