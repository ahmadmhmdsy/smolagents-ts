# docs-site

A private workspace app that renders this repository's Markdown into a static
site and serves the built browser example beside it. It publishes nothing to
npm; the package is `private` and exists only so this repository can build its
own documentation.

## What it produces

`pnpm --filter docs-site run build` compiles `src/` with tsup and then runs
`node dist/build.js`. The build writes `apps/docs-site/site/`:

- `index.html` — the repository's `README.md` body, plus a document index in the sidebar.
- one `<path>.html` per `docs/**/*.md`, mirroring the source path.
- `assets/site.css` — the one hand-written stylesheet, with GFM tables, code blocks and a `prefers-color-scheme` dark theme.
- `example/` — a recursive copy of `examples/vite-app/dist` when that directory exists.
- `.nojekyll` — so Pages serves the tree verbatim.

A page title is the file's own first `# ` heading, and a link is rewritten for
the page it lands on, so the site restates no fact and writes no new prose. A
document with no `# ` heading fails the build and is named in the error.

## Why `marked`

The dependency is justified under `R-07.2`, `R-07.6` and `R-07.7`:

- `R-07.2` — one small, single-purpose dependency; `marked` has no transitive dependencies.
- `R-07.6` — maintained and MIT-licensed, declared as `^18.0.0` and resolved to `18.1.1`.
- `R-07.7` — the alternative was hand-writing a Markdown parser, which is more code than this app should own.

## Tests

`pnpm vitest run --project docs-site` covers the link rewriter, title and group
derivation, a fixture tree built into a temporary directory, and the real
`docs/` tree.
