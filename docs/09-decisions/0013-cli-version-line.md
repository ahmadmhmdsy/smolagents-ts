# 0013 — the CLI keeps its own version line

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before cutting a release, or before adding a package to the
  changesets configuration.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** this session, as the shape of the package it delivered; the owner may reverse it at T-14
- **Supersedes:** none

## Context

`.changeset/config.json` holds one fixed group: `@smolagents-ts/core`,
`@smolagents-ts/models`, `@smolagents-ts/tools`,
`@smolagents-ts/exec-quickjs`, `@smolagents-ts/react` and the `smolagents-ts`
facade, all at 0.1.0. The group exists so the facade and the five packages it
re-exports cannot drift: one changeset moves all six together. T-13's first
module added `@smolagents-ts/cli` at 0.0.0 with a `minor` changeset, and it is
not a member.

## Decision

The CLI versions independently. Its changeset takes it to 0.1.0 on its own line
while the six stay at 0.1.0.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Add the CLI to the fixed group** | A fixed group applies its highest bump to every member, so the CLI's `minor` would cut 0.2.0 for the six library packages — and their changelogs would carry an entry for a change none of them made — before anything has been published. The group's meaning is that these six are one surface; the CLI consumes that surface rather than being part of it. |
| **Leave the CLI at 0.0.0 with no changeset** | A package with no pending changeset is not released, and the CLI is a deliverable rather than a placeholder. 0.0.0 is also the version a registry treats as "do not depend on this". |

## Consequences

**Positive**

- A CLI-only change cuts one package; a library change cuts the six.
- The CLI's dependencies are `workspace:*`, so the packed manifest pins the
  library versions the CLI was built against, which is the honest range for a
  tool that was tested with them.

**Negative / accepted costs**

- The library and the CLI can drift: a CLI published before a library release
  pins the older packages until it is republished.
- Two release lines mean the first publish cuts two versions, and a reader
  asking "what is the current version" has two answers.

## Reversibility

Easy, and that is the point of the record. Adding `@smolagents-ts/cli` to the
fixed group and setting its version to the group's own is a two-line change in
`.changeset/config.json` plus the package manifest, and nothing published
depends on the choice yet, because nothing has been published.

## Follow-up

- [ ] T-14 — revisit when the first release is cut: the group's meaning becomes
      concrete once a published revision exists.
