# 0002 — the pack baseline records pre-existing document warnings

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before editing a baselined document, or before wondering why
  the validator reports fewer findings than CI prints.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-13
- **Decided by:** the adoption session
- **Supersedes:** none

## Context

The pack requires every document under `docs/` to declare a `Contract` block.
Ten documents in this repository predate the pack and have none: the attribution
map, the v1 design record, the two S0/S1 plans, the S0/S1 completion report and
five research notes. Four further warnings report a sentence that appears in two
of those same documents.

Every one of the fourteen is inherited, not introduced. Editing the documents to
silence it would rewrite records of work done before this context system
existed — including a completion report pinned to a commit — and would put ten
user-authored files into a review about a documentation convention they never
agreed to. The pack's migration guidance covers exactly this case, and the
validator ships a baseline mechanism for it.

## Decision

The fourteen inherited findings are recorded in `docs/.baseline.json`, written
by `python scripts/validate_context.py --root . --write-baseline docs/.baseline.json`,
with a review date thirty days out. The documents are left unchanged.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| add a Contract block to each of the ten documents | they are historical records; the block describes change control they were never written under, and the edit is a rewrite of history |
| leave the warnings unbaselined | every run reports them as new, so the next genuine finding arrives in the same list as fourteen known ones |
| disable the contracts check, or raise its severity threshold | removing a check to quieten its output removes it for future adopters too |

## Consequences

**Positive**

- a run against the baseline reports only findings this project introduced
- the baseline is a small, reviewable file that names its own review date, and
  the reason for every entry is here

**Negative / accepted costs**

- the repository carries one file whose purpose is to remember fourteen known
  defects, and that file needs a decision at its review date

## Reversibility

Delete `docs/.baseline.json`; the validator treats a missing baseline as
"every finding is new", so nothing is hidden once the file is gone. Fixing the
ten documents instead is also possible, and needs no change to the pack.

## Follow-up

- [ ] before 2026-11-12, either write the ten Contract blocks or re-run
      `--write-baseline` and record why, with an owner
