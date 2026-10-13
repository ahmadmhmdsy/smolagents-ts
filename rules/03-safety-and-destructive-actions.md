# rules/03 — Safety and destructive actions

**Purpose:** never be the reason something irreplaceable is lost.

## Contract

- **Mutability:** approval-only.
- **Applies to:** any action that cannot be cleanly undone.
- **Never deleted when adapting.** Every project has destructive actions.

## Rules

**R-03.1 — Destructive means irreversible.** MUST treat these as destructive:
deleting or moving files, dropping or resetting a database, rewriting git
history, force-pushing, bulk renaming, replacing configuration, removing a
dependency, killing a process, modifying shared or production systems, sending
messages on someone's behalf, creating paid resources, and overwriting a file
whose previous content is not recoverable. *Why:* the list is longer than
instinct suggests.

**R-03.2 — Confirm before irreversible action.** MUST state the exact impact,
the affected paths or records, and the recovery plan, then obtain confirmation
unless the user explicitly requested that specific action. *Why:* consent to a
goal is not consent to a method.

**R-03.3 — Verify the resolved target path.** Before any delete or move, MUST
resolve and print the absolute target and confirm it is the intended one. MUST
NOT run a destructive command against a path computed and not inspected.
*Why:* a wildcard and a variable name are the two classic ways to delete the
wrong thing.

**R-03.4 — Prefer reversible.** MUST choose the reversible implementation when
one exists at comparable cost: copy before overwrite, branch before rewrite,
checkpoint before migration. *Why:* reversibility converts a catastrophe into
an inconvenience.

**R-03.5 — Create a checkpoint first.** SHOULD create a backup, tag, branch,
or snapshot before any large or risky change. *Why:* the checkpoint is what
makes R-03.4 real.

**R-03.6 — Never kill what you did not start.** MUST NOT stop or kill a process
unless this session started it, or the user identified it as belonging to this
project. *Why:* long-running jobs often look like orphans and are not.

**R-03.7 — No force flags by default.** MUST NOT use force, hard, recursive, or
skip-validation flags unless the specific flag is required and its consequence
is stated. *Why:* force flags convert recoverable errors into permanent loss.

**R-03.8 — Timeouts on anything that can hang.** MUST set a timeout for
commands that can block indefinitely. *Why:* a hung command holds every
downstream decision hostage.

**R-03.9 — Targeted, never broad.** MUST prefer a command scoped to the exact
target over a repository-wide or machine-wide sweep. *Why:* broad commands fail
broadly.

**R-03.10 — Uncertainty makes it destructive.** If it is unclear whether an
action is destructive, MUST treat it as destructive and confirm. *Why:* the
cost of asking is seconds; the cost of guessing is unbounded.

**R-03.11 — Report deletions.** MUST list what was removed, and where it went,
in the final report. *Why:* deletions are invisible in a diff of the remaining
files.

## Adapting

Add project-specific hazards where they belong: the shared resource and the
directory that must never be edited in `docs/08-coordination.md`, the command that has taken the system down
before. Every mature project has at least one rule that exists because of a
specific incident — write that one down here.
