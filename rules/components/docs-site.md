# Component rule: docs-site

**The site authors no fact.**
A page title is the linked file's own first `# ` heading, and navigation carries
the site title, the group labels and the example link and nothing else. A source
with no heading fails the build rather than gaining an invented title.

**The build replaces its output.**
`apps/docs-site/site/` is deleted and rewritten on every run. A file placed
there by hand is lost; a durable change belongs in the sources, the stylesheet
or a document under `docs/`.

**The repository root comes from the module.**
A path is resolved by walking up from `import.meta.url` to
`pnpm-workspace.yaml`. The build behaves the same from any working directory,
so no step may depend on where it was invoked.
