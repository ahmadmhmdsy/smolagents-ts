# 0017 — the release-age quarantine stays on, with three vendor versions excluded by name

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before adding a dependency, or before changing the supply-chain
  settings in `pnpm-workspace.yaml`.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the implementing agent, under the owner's standing instruction to
  keep moving. The owner has not been asked; reversal is cheap and the entry in the
  tasks file carries it as unconfirmed.
- **Supersedes:** none

## Context

The remote-executor package names two vendor clients as optional peers, `dockerode` and
`@e2b/code-interpreter`, and the development tree installs both so the live paths can be
built and exercised. On that install, pnpm 12.3.4 held three packages back and wrote
their versions into `minimumReleaseAgeExclude` itself:

    @e2b/code-interpreter@2.9.0, @e2b/dockerfile-utils@0.1.1, e2b@2.56.0

The mechanism is a release-age quarantine: a version published too recently is not
resolved until it ages past a threshold. The threshold is a default behaviour rather
than a surfaced setting, which is why `pnpm config get minimumReleaseAge` answers
`undefined` on a machine where the quarantine is plainly active — the evidence for it
is the exclusion list pnpm wrote, not the config read.

The same install reported `ERR_PNPM_IGNORED_BUILDS` for three packages that run a
native build step: `cpu-features`, `protobufjs` and `ssh2`. None of them is needed
by any code path this repository runs.

## Decision

Keep the quarantine on. Keep the three exclusions, each pinned to an exact version
rather than a range. Record the three declined builds as explicit `allowBuilds` denials
and keep `esbuild` allowed, so the install decides every build script instead of
inheriting whatever a transitive dependency asks for.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **A — set `minimumReleaseAge` to zero** | It buys the same install by removing the protection from every dependency in the tree, including ones added later. Three named exceptions can be reviewed one by one; a global zero cannot. |
| **B — wait a day for the three to age out** | The wait is not reproducible. The next peer bump re-opens it, and a contributor meeting it sees a resolution failure with no explanation of why waiting is the fix. |
| **C — install neither vendor client** | The two subpaths are most of the reason the package exists. Their suites would fall back to doubles, and no live path could be run at all. |
| **D — exclude the whole scope with a wildcard** | A wildcard would exempt every future `@e2b/*` package and every future `e2b` release from the quarantine, which is the same loss as option A for the one scope that is most likely to publish often. |

## Consequences

**Positive**

- The two optional peers install and their live paths stay runnable, at three exact
  versions whose provenance the lockfile records.
- Every build script in the tree is now decided explicitly, so an install cannot quietly
  start compiling a native module.
- The exception list is a reviewable artifact in a tracked file, and its reason is here
  rather than in a session transcript.

**Negative / accepted costs**

- Three packages skip the quarantine during the window it covers. All three are
  development-only here, so nothing a consumer installs inherits the exemption.
- Denying the `ssh2` build means the Docker client's SSH transport cannot work in this
  tree. Nothing uses it, and the denial is what keeps the install free of compiled
  artifacts, but a future need for it re-opens this record.
- The exclusion list is maintained by hand from here on. pnpm appends to it, and a human
  has to notice when it does.

## Reversibility

Easy. Deleting the three exclusion entries restores the default for everything, and
removing the `allowBuilds` block restores the previous inherited behaviour. Neither
change touches source, and both are confined to one tracked file plus the lockfile.
