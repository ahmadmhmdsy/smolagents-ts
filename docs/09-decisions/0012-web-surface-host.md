# 0012 — the web surface: a Vite example and a static site on GitHub Pages

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before moving the React example, or before choosing where the
  docs site is published.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the owner, who sequenced the docs site with the example's host; drafted by this session
- **Supersedes:** none

## Context

T-12 ships the runnable React example the S5 row names, and its gate waited on a
host. The design record's tree names two browser examples, `examples/vite-app`
("browser usage, no server") and `examples/next-app` ("SSR + route handler
usage"), so the choice is which claim the first example makes. The docs site is
the other half of the same question: T-13 owes one, the design deferred it past
v1, and nothing in the repository names a place to publish it. The repository is
public on GitHub, `gh` is authenticated, and the project holds no hosting
account and no deploy token — and inventing one is refused by
`rules/07-dependencies-and-external-services.md`. One decision therefore covers
both halves, which is what the owner asked for when sequencing them together.

## Decision

The React example is `examples/vite-app`: a Vite single-page app with React 19,
no server, and no build-time secret. The docs site is a static build published by
a GitHub Actions workflow to GitHub Pages, and it serves the example's built
output beside the documentation. `examples/next-app` stays a later example.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Make the first example the Next.js app** | The design reserves `next-app` for the SSR and route-handler claim. That claim needs a server, and the first example's job is the opposite one: showing that the core and the React layer run in a browser tab with nothing behind them. |
| **Publish the site to a hosting platform** | Vercel, Netlify and their peers need an account and a deploy token this project does not have; a token cannot be invented, and a static site needs no service at all. |
| **Serve the site from a long-running process** | There is no server to run it on, and the artifact a static site produces is the thing a reader can open from disk. |

## Consequences

**Positive**

- No new credential, no new account and no external service: the deploy uses the
  repository's own token.
- The example is runnable from a URL, which is the strongest form of the claim
  the S5 row makes, and the same build runs on a laptop.
- The site is one artifact; moving it later means changing a workflow file.

**Negative / accepted costs**

- Pages serves one site per repository, so the site's root is a project path and
  every asset reference needs that prefix.
- The site and the example are public the moment they deploy; nothing on them
  can be secret.
- The example carries Vite and its React plugin as dev dependencies, which the
  repository otherwise does not need.

## Reversibility

Easy. The example is a directory and the site is a build output; neither
constrains the packages. Only the workflow file is specific to Pages.

## Follow-up

- [ ] T-12 — build `examples/vite-app` (this session).
- [ ] T-13 — build the docs site and add the Pages workflow, enabling Pages with
      `build_type: workflow` (this session).
