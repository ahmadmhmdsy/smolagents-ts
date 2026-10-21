# docs-site — scoped entry

## What this component is

**docs-site** — a private workspace app that turns the repository's Markdown
into a static site under `apps/docs-site/site/` and copies the built browser
example next to it. It publishes nothing and is consumed only by the site build.

## Entry points

| entry point | path | notes |
|---|---|---|
| builder | `apps/docs-site/src/build.ts` | run as `node dist/build.js`; finds the repo root from its own URL, never the process cwd |
| library | `apps/docs-site/src/index.ts` | the pure link, title and page helpers the builder is assembled from |
| output | `apps/docs-site/site/` | generated on every build; ignored by git |

## Smallest validation command

```powershell
pnpm vitest run --project docs-site
```

Expected result: four test files and twenty-five tests pass, the fixture build included, plus the build of the real `docs/` tree.

## Boundaries

Owns Markdown rendering, link rewriting, the page shell and its stylesheet, and
the copy of the example's build output. Does not own `docs/**`, `README.md`,
`examples/vite-app/**`, the content of any document, or the Pages workflow,
which lives in `.github/workflows/`.

## Hazards

A document with no top-level `# ` heading fails the whole build, and the error
names that file. The build deletes and replaces `apps/docs-site/site/`, so a
hand edit there is lost. Link rewriting reads
`packages/core/package.json`'s `repository.url` to build GitHub blob URLs for
links to files that are not rendered.

## Pointers to root rules

Root policy lives in `rules/`, registered by `rules/00-index.md`; this file
restates none of it. Cite a rule by ID. This component's own rule file is
`rules/components/docs-site.md`.
