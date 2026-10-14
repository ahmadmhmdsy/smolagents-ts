# 0008 — the handoff's over-cap entry stays as it stands

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before rebuilding the handoff archive from the live region, or
  before changing the per-entry cap.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the owner, on the adoption session's recommendation
- **Supersedes:** none

## Context

`docs/03-handoff.md` keeps its newest entries inline and rotates the rest into
`docs/handoff/archive-2026.md`. Rotation refuses to move an entry that exceeds
the pack's per-entry cap, and the S2 entry is over it. That entry reached the
archive by hand, so the archive holds one entry that the rotation tool could not
have produced. Three ways out were on the table: shorten the archived entry,
raise the cap in `scripts/_packmodel.py`, or leave it as it stands.

## Decision

The entry stays verbatim in the archive and the cap stays where it is. The
archive is hand-curated for this one entry, and that fact is recorded here so no
later session repairs it by accident.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Shorten the archived entry** | The pack's mutability contract says rotation moves entries verbatim and never rewrites them; trimming history to fit a cap breaks the property that makes the archive trustworthy. |
| **Raise the cap in `scripts/_packmodel.py`** | It would be a third local patch to a shipped pack script, on top of the two decision 0003 already accepts, and it would weaken the cap for every future entry to fix one old one. |
| **Delete the entry** | Rotation never deletes, and the entry is the only record of that milestone's handoff. |

## Consequences

**Positive**

- The archive keeps the milestone's own words, and the cap keeps its meaning for
  new entries.

**Negative / accepted costs**

- The archive holds one entry that rotation cannot reproduce, so a future session
  that rebuilds the archive from the live region must move this entry by hand.

## Reversibility

Easy. Raising the cap or trimming the entry later is a two-line change, and
nothing depends on the current shape.

## Follow-up

- [ ] none — the debt is recorded, and the next rotation leaves it alone.
