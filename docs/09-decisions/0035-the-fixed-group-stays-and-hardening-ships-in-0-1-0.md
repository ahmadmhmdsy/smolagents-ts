# 0035 — the fixed group stays at six, and the review hardening ships in 0.1.0

- **Status:** accepted
- **Date:** 2026-10-31T23:30:00+03:00
- **Decided by:** the lead, on the owner's instruction of 2026-10-31 to proceed and to move the version only if needed
- **Supersedes:** none

## Context

The 2026-10-31 review noted that five public packages (`cli`, `exec-pyodide`, `exec-remote`, `mcp`, `react-ui`) sit outside the changeset `fixed` group, and its plan left that open. All eleven packages read 0.1.0 and none is on the registry. The review's fixes added `.changeset/review-hardening.md`, with a `minor` on `tools`. `tools` is in the fixed group, so `changeset version` would have cut 0.2.0 for six packages, and 0.2.0 is the multimodal phase under [0034](0034-multimodal-input-is-in-and-scheduled.md).

## Decision

The fixed group stays at its six names, and the five packages keep their own version lines. No version moves: nothing is published, so the review hardening is part of 0.1.0. Its changeset is folded into the 0.1.0 changelogs of `exec-remote`, `mcp`, `tools` and `cli`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Add the five to the fixed group | A fixed group applies its highest bump to every member, the cost [0013](0013-cli-version-line.md) refused for the CLI. The five are separate opt-in installs, and the README now says so. |
| Keep the changeset and let it cut 0.2.0 | It spends the version 0034 scheduled, and 0.1.0 would never exist on the registry. |
| Keep the changeset at `patch` | It still moves six packages to 0.1.1 before a first release, with nothing shipped to patch. |

## Consequences

**Positive**

- The runbook's "bump already applied" path holds: no pending changeset, and every manifest reads 0.1.0.
- 0.2.0 stays free for 0034.

**Negative / accepted costs**

- A caller mixing `exec-remote` with `core` reads two version lines once they diverge, and takes the compatibility from the dependency ranges.
- The changelogs carry this under 0.1.0 with no commit hash. The mapping lives in this record and in `git log`.

## Reversibility

Easy until the first publish: adding a name to the group is a one-line change, and a new changeset can move the version. After publishing, a version already on the registry cannot be reused.

## Follow-up

- [ ] A change landing after this record and before the first publish folds into 0.1.0 the same way, or the owner picks a version. Owner: whoever runs `T-14`.
