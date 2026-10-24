# 0024 — 0.1.0 waits for the correction pass

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** planning the first publication, or asking whether a release can
  go out before the corrections land.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-24
- **Decided by:** owner, on the recommendation to publish once the package is finished or near it
- **Supersedes:** none

## Context

Publishing is the one irreversible action this project takes: npm refuses to
unpublish after seventy-two hours, and the fixed version group means a partial
release cannot be repaired package by package
(`docs/10-runbooks/publish-0.1.0.md:6-10`). Nothing is published today, and
`T-14` is blocked on registry credentials besides.

Phase 0 of the findings plan changes two public surfaces: it removes
`ModelCapabilities.structuredOutput`, a field declared and never read, and it
adds an egress policy axis. The same phase introduces the record vocabulary of
`0023` and renames a public option. If 0.1.0 publishes first, the first version
a caller installs carries both known-wrong declarations and a name the project
has already decided to change.

## Decision

0.1.0 waits until Phase 0, the correction pass, has landed, and publication
happens when the package is finished or near finished rather than as a preview of
work in progress. A publication before that requires a new record that names the
user need forcing it and accepts the follow-on break.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Publish 0.1.0 now, fold Phase 0 into 0.2.0** | The same work plus a changeset, a changelog note and a deprecation window; release one would ship a field and a claim that lie. |
| **Publish with documented known-wrong declarations** | The documentation would have to explain a field the code does not consult, which is precisely the defect the phase exists to remove. |
| **Publish a prerelease under a dist-tag** | The runbook refuses that path, and a prerelease still consumes the version number and the registry's immutability rules. |

## Consequences

**Positive**

- The first published surface is the corrected one, so there is no deprecation
  debt before the first install exists.
- The release runbook's first real run happens against a tree where the
  corrections are proven by tests, which makes the run itself less speculative.

**Negative / accepted costs**

- Nothing is installable until the corrections land; a user waiting on npm waits
  longer.
- The decision depends on `T-14`'s credentials, so publication could still move
  later; this record only fixes the ordering, not the date.

## Reversibility

The ordering is reversible until the publish command runs: a new record can
authorise an earlier release. After publication, the immutability of a version
makes every later reversal a new version, not an edit.

## Follow-up

- [ ] **`T-14`** stays blocked on the credentials and gains this record as its
  ordering gate.
- [ ] **The runbook** records the ordering rule in its "Use when" section when it
  is next edited.
- [ ] **The phase plans** treat a public-surface change after publication as a
  breaking change with a deprecation window.
