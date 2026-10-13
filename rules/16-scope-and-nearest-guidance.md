# rules/16 — Scope and nearest guidance

**Purpose:** decide which entry file governs a path, and keep every scoped
entry file thin enough to stay honest.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every `AGENTS.md` below the repository root, and every path
  resolved against one.
- **Never deleted when adapting.** Every project with components has scoped
  entry files.

## Rules

**R-16.1 — Precedence chain.** The resolution order is owned by R-01.1; MUST
apply it. This module adds only the scoped levels R-01.1 does not carry:
`rules/components/<id>` sits directly below the root `rules/`, and the nearest
`AGENTS.md` outranks the root `AGENTS.md`, which outranks `docs/`. The levels
shared with R-01.1 are deliberately not restated here, so one hierarchy cannot
drift into two. *Why:* a scoped file must never outrank the rule that governs it.

**R-16.2 — Resolution algorithm.** For any path P, MUST apply this set, stated
once:

    for any path P the applicable set is SOUL.md + root AGENTS.md + root rules/
    + rules/components/<owner(P)> + the nearest AGENTS.md walking up from P's
    directory.

*Why:* one stated set makes every agent resolve the same path the same way.

**R-16.3 — Scoped entry contract.** A scoped `AGENTS.md` MUST contain only what
the component is, its entry points, its smallest validation command, its
boundaries, its hazards, and pointers to root rules. MUST NOT restate root
policy. *Why:* a file that carries no restated rule cannot drift from the rule.

**R-16.4 — Six kilobyte cap.** A scoped `AGENTS.md` MUST stay at or under 6 KB.
*Why:* the cap is what forces detail into the module or doc that owns it.

**R-16.5 — A scoped file wins only for its subtree.** A scoped `AGENTS.md`
wins for its subtree, and only over root `AGENTS.md` and `docs/`. *Why:*
subtree authority is real but bounded.

**R-16.6 — A scoped file never relaxes a root rule.** MUST NOT weaken, except,
or contradict any rule in root `rules/` from a scoped `AGENTS.md`. *Why:*
relaxation is how a rule silently disappears on one subtree.

**R-16.7 — An exception changes rules/, never the scoped file.** A component
that needs an exception MUST change `rules/`; MUST NOT encode the exception in
its own `AGENTS.md`. *Why:* one rule text keeps every subtree answerable to it.

## Adapting

Build the component table in the root `AGENTS.md` and point each row at its
scoped entry file. A component without one simply inherits root `AGENTS.md`
and `rules/`.
