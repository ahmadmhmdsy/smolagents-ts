# 0006 — the distribution shape

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before changing what is published, or before wondering why the
  internal packages appear beside the facade.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14T02:38:02+03:00
- **Decided by:** maintainer
- **Supersedes:** none

## Context

The design record's section 5.2 describes one installable package, `smolagents-ts`,
assembled from the internal ones, ESM-only, with React and the heavy backends as optional
peers, `dependencies: { zod }`, and per-adapter subpaths under `./models/<provider>`. The
S6 spike measured what the toolchain can do with that shape. tsup 8.5.1 bundles an
umbrella's runtime but keeps `@smolagents-ts/*` external in the declaration files under
`dts: true`, `dts: { resolve: true }` and `dts: { resolve: [...] }` alike, so a published
umbrella would ship declarations naming packages a consumer does not have. `pnpm pack`
rewrites the workspace protocol to the version being packed, and it ignores a
`publishConfig.dependencies` override, so a tarball's manifest is whatever its manifest
says.

## Decision

The five internal packages are published alongside the facade. `smolagents-ts` is the
documented entry point and holds no implementation: its five entries re-export
`@smolagents-ts/core`, `./models`, `./tools`, `./exec/quickjs` and `./react`, so one
install brings the stack and every declaration resolves to a package that is on the
registry. All six carry one version, held together by a changeset `fixed` group, because
the facade's ranges name the other five. The per-adapter `./models/<provider>` subpaths
are dropped: the models package ships one barrel with `sideEffects: false`, which a
bundler tree-shakes. Nothing in this repository publishes; the first publish is T-14's and
waits on the owner.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Publish the umbrella with a bundled runtime and bundled declarations | tsup cannot inline the workspace declarations with any `dts` setting, and a hand-written `.d.ts` would be a second copy of every signature, free to drift. |
| Publish the umbrella and leave the internal packages private | Its declarations name packages that are not on the registry, so a consumer's type checker fails on the first import. |
| Keep the per-adapter `./models/<provider>` subpaths | The models barrel is already tree-shakeable, and the subpaths would multiply the exports map and the surface test for no measured benefit. |
| Wait for a toolchain that inlines declarations | The design's section 14 puts the public publish in v1; deferring it leaves the project uninstallable. |
| Hand-pin the facade's dependency ranges instead of using the workspace protocol | `pnpm pack` rewrites the workspace protocol to the version being packed, which is exactly what the fixed group guarantees; hand-pinned ranges can drift from the version that ships. |

## Consequences

**Positive**

- Every declaration a consumer resolves names a package that is published.
- One changeset moves all six, so the facade cannot point at a version that never shipped.
- The facade adds no runtime of its own.

**Negative / accepted costs**

- Six names appear on the registry where the design names one; the README documents only the facade.
- A release moves all six even when one of them changed.
- The fixed group lives in `.changeset/config.json`, which every release depends on.

## Reversibility

Moderate. Publishing the facade with bundled declarations instead is a change inside
`packages/smolagents-ts` plus one changeset, and nothing released depends on the current
shape while 0.1.0 is the only version. Un-publishing the five internal packages is not
possible: a reversal would leave them on the registry at 0.1.0 with no successor, which is
why this record exists.

## Follow-up

- [x] Decide whether the internal packages are documented as first-class or stay implementation — answered by `docs/09-decisions/0014-internal-packages-stay-implementation.md`: they stay implementation, and each gains a short README that signposts the facade. The comparison behind it is `docs/research/2026-10-14-implementation-vs-first-class.md`.
- [ ] Publish 0.1.0 once a repository URL and registry credentials exist — owner: owner (T-14).
