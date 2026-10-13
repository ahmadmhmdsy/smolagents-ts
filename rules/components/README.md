# rules/components/ — per-component rule files

One rule file per component: `rules/components/<id>.md`. This README explains
the directory; it is not itself a component rule file and takes no row in the
component table.

## Contract

- **Role:** rules that bind one component's subtree and nothing outside it.
- **Mutability:** approval-only, like every module in `rules/`.
- **Naming:** one file per component id, named `<id>.md`.
- **Registry:** every file here has a row in the root `AGENTS.md` component
  table.

## What a component rule file owns

- A rule that applies to that component and to no other path.
- The component's boundary and hazard rules, when they bind rather than inform.
- Nothing a root module already owns. When a root module states it, cite that
  rule by ID instead of copying its text; a second copy drifts silently even
  while the two agree.

A component rule file is the place for a *rule*. Facts and pointers stay in the
component's scoped entry, and the form for that entry is in `_templates/`.

## The id rule

`<id>` is one identity written three ways: the id column of the component
table, the component's path segment, and this file's name without `.md`.
Lowercase and hyphenated: `core`, not `Core` or `core_module`. The three
spellings never diverge, because the tools that resolve a path match on the
string.

## The component-table requirement

Every component rule file has a row in the root `AGENTS.md` component table,
and every row's `component rule` cell names a file that exists. A rule file
with no row is invisible to the reader who resolves it; a row with no file is a
broken pointer. Both are validation errors, so the row and the file land in the
same change.

## Precedence

The level this directory occupies in the resolution order, and the algorithm
that applies it, are owned by `rules/16-scope-and-nearest-guidance.md`. This
file adds no level and restates no chain.
