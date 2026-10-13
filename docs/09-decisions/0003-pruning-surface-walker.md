# 0003 — the pack's surface walk prunes skipped trees

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before changing how the context-pack tools enumerate files, or
  before wondering why the validator finishes in under a second.
- **Update when:** never. A reversal is a new record.

- **Status:** proposed
- **Date:** 2026-10-13
- **Decided by:** the adoption session, pending the owner's confirmation
- **Supersedes:** none

## Context

Every pack tool that inspects a target calls `rglob` and drops the `SKIP_TOP`
names from the *result*. The answer is right and the cost is paid by the target:
the walk visits every file before anything is filtered, and a `set()` of path
parts runs per visited path. This repository's gitignored
`.superpowers/review/` worktree holds 355,873 entries by itself and the root
holds 376,221, so the validator spent 179,240 ms to inspect 214 files. Timed per
check: `c12_secrets` 54.0 s, `c10_rule_ids` 52.9 s, `c11_duplicate_facts`
52.2 s, `c00_adapt` 9.3 s, `c02_scoped_entries` 7.3 s.

Decision 0001 recorded the opposite — "validation is fast" — on a measurement
that was never taken. The exclusion it made was real and has not changed: 40
findings became 0. The runtime claim was the part that was wrong.

## Decision

One helper, `iter_surface()` in `scripts/_packmodel.py`, walks a tree with
`os.walk` and removes `SKIP_TOP` from `dirnames` before descending, checking
each yielded path against `SKIP_TOP` as well. Three call sites use it: `walk()`
and `c00_adapt()` in `scripts/checks.py`, and `Pack.scoped_agents()`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| leave the walk alone and accept about three minutes per validation | the validator runs at every session start, and a slow check is a check people quietly stop running |
| delete or move `.superpowers/review/` | it is another session's review worktree and not this decision's to remove; every adopter's tree will have some large ignored directory |
| change only `walk()` | it leaves `c00_adapt` and `scoped_agents` paying the same cost for the same reason |
| give each check its own pruning loop | three copies of one rule is the duplication this pack exists to remove |

## Consequences

**Positive**

- validation runs in 433 ms over the same 214 files, on the same input that took
  179,240 ms before
- a single walker owns the "what does the pack own" rule instead of three

**Negative / accepted costs**

- the repository now carries a second local patch to a shipped script, so a pack
  upgrade re-applies both

## Verification

`python scripts/validate_context.py --root . --baseline docs/.baseline.json
--json` was captured before and after the change, in
`.superpowers/validate-before-prune.json` and
`.superpowers/validate-after-prune.json`. The two documents are byte-identical
— `{"new": [], "baselined": 14, "errors": 0, "warnings": 0}` — so the change
reduces cost and alters no finding.

## Reversibility

Easy: restore the three call sites to `rglob` and delete the helper. No pack
semantics change either way.

## Follow-up

- [ ] the owner confirms this second local pack patch, or asks for it to be
      replaced by an upstream option — tracked as T-5 in `docs/04-tasks.md`
