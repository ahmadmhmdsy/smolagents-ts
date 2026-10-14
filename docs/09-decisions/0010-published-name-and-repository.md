# 0010 — the published name and the repository

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before publishing a package, or before changing a manifest's
  repository fields.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the owner
- **Supersedes:** none

## Context

The distribution shape (decision 0006) left two facts unowned: where the source
lives, and whether the unscoped name is free. A registry lookup on 2026-10-14
answered the second — the name returned not-found — and the owner created a
public repository at https://github.com/ahmadmhmdsy/smolagents-ts for the first.
Until both were known, no manifest could carry a repository URL without
inventing one.

## Decision

The six packages publish under the unscoped name `smolagents-ts` and its five
scoped siblings, from the public repository above, and every manifest names it.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **A scope such as `@ahmadmhmdsy/smolagents-ts`** | The unscoped name is free, and an unscoped name is what a caller types. |
| **A different name** | The design record and every document already say `smolagents-ts`; renaming would touch the facade, the README and six manifests to avoid a collision that does not exist. |
| **Stay unpublished** | Publishing is T-14's deliverable and the reason the packaging gates exist. |

## Consequences

**Positive**

- npm can show the source, the README and the issue tracker, and provenance has a
  repository to point at.

**Negative / accepted costs**

- The name is first-come: anyone may claim it before the first publish, and the
  lookup is a fact about 2026-10-14 rather than a reservation.
- The repository is public, so the history and every later commit are public too.

## Reversibility

Hard for the name: a published package name cannot be renamed without a new
package and a deprecation. Easy for the URL: the fields are three lines per
manifest.

## Follow-up

- [ ] **T-14** — publish 0.1.0 once the owner supplies registry credentials.
