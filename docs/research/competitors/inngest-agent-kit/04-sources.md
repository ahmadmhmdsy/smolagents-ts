# inngest/agent-kit — sources for this read

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Repository and read point**

| item | value |
|---|---|
| Repository | https://github.com/inngest/agent-kit |
| Read commit | `6c9802fd79471bd77c0072a2978f45720dc1ca99` |
| Commit date and subject | 2026-04-29 18:36:04Z, `Improve support for reasoning models (#287)` |
| Version read | 0.13.2 |
| Licence | `Apache-2.0`; `LICENSE.md` is the Apache License Version 2.0 text, 10,932 bytes |
| Scale at this commit | 708 tracked files; 20 example applications |
| Clone | `reference/competitors/inngest-agent-kit`, shallow, HEAD equal to the read commit |
| Read on | 2026-10-21, D2 shape with source spot-reads at the pinned commit |

**Licence note**

The brief expected Apache-2.0 and the endpoint returned it. The licence file is
the standard text with no modification, and there is no `NOTICE` file, so
nothing needs to be carried beside a copy. Nothing was copied into our tree:
the only artefact is the shallow clone under `reference/competitors/`, which is
untracked. A clone was made because the brief asked what a step boundary
guarantees and what the developer must keep pure, and those answers live in the
call sites rather than in the prose; the profile keeps the D2 shape and cites
lines instead of summarising code.

**Documentation read, 2026-10-21**

The docs are MDX in this repository under `clone:/docs/src/content/docs` and are
published at https://agentkit.inngest.com. Principal pages:

- index, `clone:/docs/src/content/docs/index.mdx`
- `agents.mdx`, `networks.mdx`, `state.mdx`, `routers.mdx`, `tools.mdx`,
  `history.mdx`, `memory.mdx`, `models.mdx`, `deployment.mdx` under
  `clone:/docs/src/content/docs/concepts/`
- `retries.mdx`, `routing.mdx`, `human-in-the-loop.mdx`,
  `multi-steps-tools.mdx`, `mcp.mdx`, `multitenancy.mdx` under
  `clone:/docs/src/content/docs/advanced-patterns/`
- `quick-start.mdx` and `local-development.mdx` under
  `clone:/docs/src/content/docs/getting-started/`
- `overview.mdx`, `events.mdx`, `transport.mdx` and `usage-guide.mdx` under
  `clone:/docs/src/content/docs/streaming/`
- `e2b.mdx`, `daytona.mdx`, `browserbase.mdx`, `smithery.mdx` under
  `clone:/docs/src/content/docs/integrations/`

Platform pages, read because the step semantics are defined by Inngest and not
by this repository:

- https://www.inngest.com/docs/features/inngest-functions/steps-workflows/step-ai-orchestration
- https://www.inngest.com/docs/durable-execution/concepts
- https://www.inngest.com/docs/durable-execution/guides-and-advanced/versioning

**Repository files read at the pinned commit**

- `clone:/packages/agent-kit/src/network.ts`, `agent.ts`, `model.ts`,
  `state.ts`, `history.ts`, `tool.ts`, `types.ts`, `server.ts`,
  `streaming.ts`, `util.ts`, `index.ts`.
- `clone:/packages/agent-kit/package.json`, `CHANGELOG.md`, `README.md`;
  `clone:/packages/use-agent/package.json` and its core adapters.
- `clone:/docs/astro.config.mjs` and `clone:/docs/package.json`.
- `clone:/examples/deep-research/inngest/functions/deep-research.ts` around the
  network call, and `clone:/examples/support-agent-human-in-the-loop/src/index.ts`
  around the event wait.
- Repository metadata through `gh api`: repository, licence, latest commit,
  root contents.

**Commands run**

`gh api` for repository and licence metadata and for the head commit;
`git clone --depth 1` into `reference/competitors/inngest-agent-kit`;
`git rev-parse HEAD`, `git status`, `git ls-files`, and file reads inside the
clone; `fetch` calls for the platform pages above. No package install, no
build, no test run, no server started, no Inngest account, no event sent.

**Not verified**

- The cache and occurrence-counter behaviour of `step.ai.infer` was read from
  the platform documentation, never observed in a run.
- The default retry count was not exercised, so the docs' number is a claim.
- Streaming was not run; the simulated-chunking note comes from the source
  comment at `clone:/packages/agent-kit/src/model.ts:44-46`.
- The live docs site was not fetched page by page; the MDX in the clone is the
  text this read stands on, and the site may already differ.
- The npm registry was not queried, so 0.13.2 is the version in this commit and
  not necessarily the latest published one.
- Seventeen of the twenty examples were not opened at all.

**Refreshing this read**

Pin a new head, clone shallow again beside the old one, and diff
`packages/agent-kit/src` and `clone:/docs/src/content/docs` between the two.
Re-read `CHANGELOG.md` first: it names every release and is shorter than the
diff. Then check whether the platform has taken over the model call entirely, because the
current Inngest AgentKit snippet already passes `step` into the model
constructor, a shape this commit does not have.
