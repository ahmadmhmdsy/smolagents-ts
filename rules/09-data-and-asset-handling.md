# rules/09 — Data and asset handling

**Purpose:** know what is precious, what is regenerable, and what must never
be hand-edited, before touching any of it.

## Contract

- **Mutability:** approval-only.
- **Applies to:** data files, databases, binaries, model weights, build
  artifacts, caches, and any non-source asset.

## Rules

**R-09.1 — Classify before touching.** MUST classify every asset it handles as
one of: **precious** (irreplaceable), **regenerable** (derived from a recorded
recipe), **generated** (produced by the build), **vendored** (external, tracked
as-is), or **temporary**. *Why:* the correct action differs completely between
classes and the wrong one is destructive.

**R-09.2 — Precious assets are protected.** MUST NOT delete, move, overwrite,
or reformat a precious asset without an approved backup and explicit
confirmation. *Why:* there is no second copy by definition.

**R-09.3 — Regenerable means the recipe exists.** SHOULD treat derived data as
safe to delete only when the exact recipe to regenerate it is recorded and
still works. *Why:* "regenerable" is a claim about the recipe, not the file.

**R-09.4 — Never hand-edit generated files.** MUST change the generator, not
its output. If an output file was edited by hand as an emergency, MUST record
that fact in docs/03-handoff.md. *Why:* the next generation silently reverts
the edit.

**R-09.5 — Know the version-control policy per path.** MUST know whether a path
is tracked, ignored, or stored out-of-band, and MUST NOT commit what the policy
excludes. *Why:* committing a large binary or an ignored directory is a
difficult-to-undo history problem.

**R-09.6 — Migrations are reversible where practical.** MUST back up before a
schema or data migration, MUST NOT drop or reset a database without explicit
authorization, and SHOULD provide a documented rollback. *Why:* migrations are
the most common source of irreversible loss in ordinary development.

**R-09.7 — One source of truth per dataset.** MUST NOT create a second,
hand-maintained copy of data that exists elsewhere. *Why:* the copy that is not
written by the pipeline is the copy that goes stale.

**R-09.8 — Scratch is never durable.** MUST NOT store knowledge, decisions, or
anything the next session needs in a scratch, temp, or throwaway location.
*Why:* those paths are cleared.

**R-09.9 — Sensitive data is minimized.** MUST NOT copy personal, confidential,
or regulated data into documentation, logs, memory files, or commit messages.
*Why:* documentation is often less protected than the data store.

**R-09.10 — Deletion is reported with its recovery path.** MUST state what was
removed and how it could be recovered, in the final report. *Why:* deletion is
invisible in the remaining file tree.

**R-09.11 — Large assets follow the declared policy.** MUST use the project's
declared mechanism for large files (for example external storage or LFS) rather
than committing them directly. *Why:* it is the difference between a slow clone
and a broken one.

## Adapting

Record the project's asset classes and their exact paths in
docs/02-environment.md or docs/01-project.md, including which assets are
precious, which are regenerable, and the gitignore or storage policy for each.
This is one of the highest-value sections to fill in, and one of the most
common causes of loss when left blank.
