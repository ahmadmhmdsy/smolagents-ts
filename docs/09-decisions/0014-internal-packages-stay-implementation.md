# 0014 — the five internal packages stay implementation, with a signpost

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before documenting an internal package, or before writing a
  per-package README.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** owner, taking Option C of `docs/research/2026-10-14-implementation-vs-first-class.md`
- **Supersedes:** none

## Context

Decision 0006 fixed the distribution shape: one documented package,
`smolagents-ts`, with five internal ones published beside it because its
declarations name them. That left an open follow-up — whether those five are
documented as first-class or stay implementation — and the answer decides what
the docs site may publish and whether a visitor arriving on one of the five from
a search finds anything.

The filed analysis measured the two postures surface by surface. Three facts
decide it: the design record's section 5.2 specifies one installable package;
the five are public for a mechanical reason rather than a requested one; and
their npm pages carry a description and links but no README.

## Decision

The five stay implementation. Each gains a short README that says what it is,
that the facade's declarations are why it is published, and where the
documentation lives. No second install path is documented.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **A — leave them as they are** | The posture is stated in the repository, but a consumer arrives at the npm page and not in the repository. The empty page is the defect worth fixing, and the fix is cheap. |
| **B — document them first-class** | Six documented install paths and six support promises, against a design record that specifies one package. It needs a spec revision rather than a rule edit, and nothing has asked for a subset install. |
| **D — make the executor an optional peer of the facade** | It answers the one real cost, the QuickJS engine the facade pulls, but an absent optional peer behind the facade's `./exec/quickjs` subpath fails at import, which is a worse first run than the bytes. Revisit if the weight is reported. |

## Consequences

**Positive**

- The five npm pages stop being empty without promising anything new.
- The facade remains the single documented install path, so the support surface
  does not grow and the design record stays true.

**Negative / accepted costs**

- Each package now has a second place that describes it, so a rename touches one
  more file.
- A caller who wants the loop and an adapter without the sandbox still has no
  documented way to install that subset.

## Reversibility

Easy. Promoting the five is the same five files grown into real READMEs plus a
spec revision, and deleting them returns the tree to its state before this
record. Nothing published depends on the choice yet.

## Follow-up

- [ ] T-23 — the CLI's npm page has no README either, and unlike the five it is
      a documented entry point, so it needs a real README rather than a signpost.
