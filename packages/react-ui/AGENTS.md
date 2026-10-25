# react-ui — scoped entry

## What this component is

`@smolagents-ts/react-ui` is the styled layer over the headless primitives and
patterns. It holds four wrappers — `StyledRunInspector`, `StyledChatSurface`,
`StyledToolCall` and `StyledCodeBlock` — and one plain stylesheet. Each wrapper
renders a single element carrying a class this package owns, composes the
caller's `className` with it and forwards the rest, so a consumer composes the
styled layer with the headless one rather than replacing it. The stylesheet is
text a consumer copies and then owns: nothing in the package imports it, so
nothing applies itself.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/react-ui/src/index.ts` | `VERSION` and the four wrappers with their prop types |
| wrappers | `packages/react-ui/src/styled-run.tsx`, `styled-step.tsx`, `styled-chat.tsx` | one file per part of the tree it wraps |
| stylesheet | `packages/react-ui/src/styles.css` | plain text, copied to `dist/styles.css` at build time; the package declares no `.css` subpath |
| version marker | `packages/react-ui/src/version.ts` | |

## Smallest validation command

    pnpm vitest run --project react-ui

Expected result: exit code 0, with the file and test counts the package's
documents record. Run `pnpm --filter @smolagents-ts/react-ui run typecheck`
beside it: the runner erases types, and this package is the one whose workspace
dependencies both resolve through their source.

## Boundaries

This package owns the wrappers and the stylesheet, and it composes the headless
barrel rather than reaching past it. It owns no run state, no agent logic and no
accessibility behaviour: the roles, live regions and `aria-busy` state belong to
the primitives inside, and the stylesheet names no class this package does not
own. The headless package never imports it.

## Hazards

- The stylesheet applies nothing on its own. A page that renders a styled
  wrapper without copying the sheet shows an unstyled tree, which is the shape
  of a copy-in layer rather than a defect.
- The token block declares five tokens, each reading an input name such as
  `--smol-color-surface`. A token that referred to itself is invalid rather
  than falling back, so the two names stay distinct.
- Each wrapper adds an element, because neither the primitives nor the patterns
  accept a class name. A selector that assumed the wrapped component was the
  outermost node reaches the wrong one.
- The package ships no theme, so a dark mode is a consumer's copy of the sheet.
- `StyledChatSurface` inherits the headless default: called without `messages`
  it renders the snapshot's conversation, which needs a run host above it.
- The vitest project runs under jsdom, whose global `URL` differs from Node's,
  so a test reading a sibling file resolves a path rather than handing a file
  URL to `node:fs`.
- A green suite proves the wrappers and the shape of the sheet; it proves
  nothing about how the sheet looks in a browser, which the copy-in probe
  measures.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/react-ui.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
