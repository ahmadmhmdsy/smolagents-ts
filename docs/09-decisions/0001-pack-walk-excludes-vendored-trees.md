# 0001 — the pack walker excludes vendored third-party trees

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before changing what the pack validator walks, or before
  wondering why this repository patches a shipped script.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-13
- **Decided by:** the owner, on 2026-10-13 (“proceed”); drafted by the adoption session
- **Supersedes:** none

## Context

The context-pack tools walk the repository root: `adopt.py` fills placeholders
everywhere, and `validate_context.py` checks every Markdown file it finds. This
repository keeps three gitignored trees at its root that belong to other
projects: `node_modules/` (the pnpm store), `smolagents/` (a clone of the
upstream Python reference) and `reference/` (vendored reference repositories).
None is committed, built or configured.

Measured on the unpatched pack at commit e4e4b5a, with the pack installed: a
validation run took 173 s and reported 40 errors and 30 warnings. Every one of
the 40 errors came from inside those trees — 32 scoped-entry findings for the
vendored `AGENTS.md` files they happen to contain, and 8 secret-heuristic hits
on upstream documentation. A further 20 duplicate-fact warnings came from the
same trees. The run also crashed: `reference/vercel-eve/apps/docs/app/[lang]/`
contains a **directory** named `agents.md`, and the placeholder walker reads
every match rather than checking that it is a file first.

The pack ships an exclusion mechanism for exactly this class of directory. It
already skips `_dev/`, `.superpowers/` and `skills/` — "none is copied into a
target and none is any adopter's business" — so the mechanism is the pack's own,
applied to this repository's equivalent directories.

## Decision

The three trees are added to `SKIP_TOP` in `scripts/_packmodel.py`, using the
same local-patch pattern the file already documents, so the adoption and
validation walks stop descending into them.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| leave the walk unchanged and record 40 errors in a baseline | the baseline would absorb errors caused by foreign files, so a genuine scoped-entry error in this repository could never be distinguished from the noise again |
| delete or move the ignored trees | they are the upstream reference the port is checked against; deleting them costs the recon value and changes nothing about the pack |
| add ignore rules to the project's own `.gitignore` | the walker does not consult git, so this would hide nothing from it |
| put the trees under one ignored parent directory | moving `node_modules/` is not possible, and the other two are referenced by documentation paths |

## Consequences

**Positive**

- validation is fast and its findings describe this repository only
- the pack's own exclusion mechanism is used as designed, and the deviation is
  one commented block in one file

**Negative / accepted costs**

- the repository now carries a local patch to a shipped pack script, so a pack
  upgrade needs the patch re-applied or replaced by an upstream option

**Correction, 2026-10-13.** The sentence above claiming that "validation is
fast" was written without a stopwatch and is false: the excluded trees left the
findings but not the walk, so the run still took 179,240 ms until the walkers
were made to prune. The fix and the corrected measurement are in
`docs/09-decisions/0003-pruning-surface-walker.md`. The decision itself is
unchanged.

## Reversibility

Easy: delete the three names from the `SKIP_TOP` patch line. The cost of
reversing is a slow validator and 40 findings about other people's files, which
is why the decision needs an owner's confirmation rather than being treated as
routine.

## Follow-up

- [x] the owner confirmed this patch on 2026-10-13 rather than asking for an
      upstream ignore option. Closed as T-4 in `docs/tasks/archive-2026.md`; the
      patch itself stays in `scripts/_packmodel.py` and is re-applied on a pack
      upgrade.
