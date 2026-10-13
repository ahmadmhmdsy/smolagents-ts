# rules/02 — Inspect before changing

**Purpose:** know the ground before touching it. Most wasted agent work comes
from acting on an assumed state that was never checked.

## Contract

- **Mutability:** approval-only.
- **Applies to:** any task that will modify files, run commands, or spend
  resources.
- **Read first:** AGENTS.md, "Boot set (read in this order)".

## Rules

**R-02.1 — Read-only first.** MUST begin with commands that cannot change
state. MUST NOT install, delete, migrate, reset, upgrade, or launch during
reconnaissance. *Why:* a wrong first action constrains everything after it.

**R-02.2 — Establish the five facts.** MUST determine: repository root, current
branch and working-tree state, package manager and lockfile kind, runtime and
tool versions, and what is already running. *Why:* each of these silently
changes what a correct implementation looks like.

**R-02.3 — Read a file before editing it.** MUST read the current content of
any file you are about to modify, including one you edited earlier in the same
session if something else may have changed it. *Why:* edits anchored to stale
content fail, or worse, succeed against the wrong text.

**R-02.4 — Use recorded facts instead of re-deriving them.** SHOULD read the
environment document and the memory document before probing the machine or
re-discovering a known gotcha. *Why:* re-derivation costs time and produces a
second, weaker copy of a fact that already has a home.

**R-02.5 — Preserve uncommitted work.** MUST identify modifications that are
not yours before editing, and MUST NOT overwrite, revert, or reformat them.
*Why:* the user's uncommitted work is often the only copy.

**R-02.6 — Know the blast radius.** SHOULD identify which files, services,
users, or data could be affected before changing anything. *Why:* scope errors
are invisible until they are expensive.

**R-02.7 — Inspect before installing.** MUST check whether the project already
provides the capability before adding anything. *Why:* a duplicate dependency is
a permanent maintenance cost bought for a temporary convenience.

**R-02.8 — Timebox reconnaissance.** If inspection has not converged within a
reasonable budget, MUST report what is known, what is unknown, and ask. MUST NOT
keep probing silently. *Why:* unbounded searching is indistinguishable from
being stuck.

## Adapting

Name the concrete commands for your project in `docs/02-environment.md` so reconnaissance
is one drill, not an investigation. If your project has a single command that
prints a full health summary, record it here and prefer it.
