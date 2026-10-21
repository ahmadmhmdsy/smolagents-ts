# claude-agent-sdk — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

This profile covers the published surface of Anthropic's TypeScript Agent SDK. The
agent runtime itself is not open source, so the evidence is the wrapper repository,
the package's published type declarations, and the vendor documentation. Nothing was
executed, installed, or run, and no repository was cloned.

## Identity

| field | value |
|---|---|
| repository | https://github.com/anthropics/claude-agent-sdk-typescript |
| register row | Tier 1, wave 3, planned depth D3, slug `claude-agent-sdk` (`docs/research/competitors/README.md:58`); filed at D2 because the source is not readable |
| licence | no SPDX identifier; `gh api` returns a null licence; root `LICENSE.md` is a copyright line pointing to Anthropic's Commercial Terms; npm declares `SEE LICENSE IN README.md` |
| read commit | `9c59e061a0e49a4a99012218de66915bd407c96d`, committed 2026-10-21T03:16:59Z, subject `chore: Update CHANGELOG.md` |
| clone | none; no git checkout was made, because the wrapper holds no agent source, and its files were read through the GitHub API |
| package | `@anthropic-ai/claude-agent-sdk` 0.3.306, published 2026-10-21, 328 versions on the registry, 4.78 MB unpacked across 21 files |
| type surface | `sdk.d.ts` 10,267 lines; `sdk-tools.d.ts` 4,222; `bridge.d.ts` 396; `core.d.ts` 22; subpath entries `./core`, `./bridge`, `./browser`, `./extract`, `./sdk-tools` |
| wrapper contents | README, LICENSE.md, CHANGELOG.md (95,936 bytes), CLAUDE.md, `.claude/`, `.github/`, `examples/session-stores/`, `scripts/`; no agent source |
| build provenance | package metadata resolves from a private staging path under `claude-cli-internal`, so the shipped bundle is built outside this repository |
| runtime | Node 18 or later; a call spawns the bundled Claude Code CLI and drives it over stdio |
| repository size | 353 KB, which is a distribution shell rather than the product |
| documentation | https://code.claude.com/docs/en/agent-sdk/; fifteen pages were fetched as markdown on 2026-10-21 |
| local artifacts | fetched declarations and documentation are cached under `reference/competitors/claude-agent-sdk/`; that folder is gitignored and is not a clone |

## What it is

The package is a host harness, not a framework. A single exported function,
`query()`, takes a prompt and an options object and returns an async generator of
typed messages (`sdk.d.ts:3303-3306`, `:2898`). Behind that signature the SDK starts
one Claude Code subprocess per session, exchanges JSON control requests with it, and
relays its output. The loop, the fifty-four built-in tools, compaction, skills,
subagents and permission enforcement all live inside that binary; the repository here
holds the client half of the conversation.

That makes the published declarations the real API contract. They are also unusually
explicit: option fields document failure modes, migration rules and race handling in
prose, which is why this profile can cite a type line for a behavioural claim.

The product has three published faces. The npm package is the embedded lane, where a
Node process owns the subprocess. Managed Agents is the hosted lane named in the overview
comparison table (`overview.md:13-20`, read 2026-10-21), where Anthropic runs the
same harness and the caller reaches it over an API. The CLI is the third lane and shares the binary. Only the first is readable
here, and only through its types.

The wrapper repository carries distribution chores plus one substantive artifact: a
set of external session-store adapters (Postgres, Redis, S3) with a shared conformance
suite. That suite is the most directly reusable idea in the repository, because the
adapter contract it checks is small and the mirroring semantics are documented.

## Why it is in the register

The register row lists subagents, hooks, permission modes, skills and session resume
as the focus, and marks the licence as needing verification. The licence question is
now settled: use is governed by commercial terms, GitHub detects nothing, and the
README repeats the restriction even for products a caller builds on top. A deep dive
that reads the loop is therefore impossible, which is exactly the case the method
anticipates for an unlicensed repository.

What remains valuable is the boundary. This is the most mature approval and
interception surface among the neighbours in the register, and it is built on a
closed runtime. Comparing our open seams against it separates properties we can copy
from properties that only exist because one vendor owns both ends of the wire.

## How it is positioned against us

| their capability | nearest baseline row | relationship |
|---|---|---|
| subagent definitions invoked through an Agent tool | MA-01, MA-04 | same idea as managed agents; theirs adds background, observer and depth caps |
| canUseTool plus hook-based interception | HL-01 | ours is one gate; theirs is an ordered policy ladder with four decision sources |
| approval request parked in a live process | HL-02 | theirs suspends a subprocess; we have no serialized pending approval at all |
| resume and fork over a transcript | HL-03, HL-04, HL-08 | theirs resumes a conversation, not a run; ours snapshots a run between steps |
| SessionStore adapter | HL-04, HL-09 | same shape as our RunStore seam, but for transcript mirroring |
| per-model cost totals and a budget stop | OB-06 | they ship cost accounting; our row is absent |
| typed message union with per-turn result | RT-09 | ours is an event stream for rendering; theirs is a wire protocol with delivery numbering |
| bundled CLI with tools and permissions | RT-01, EX-05 | theirs is a workspace agent with shell and filesystem; decision 0018 keeps that out for us |

## The limits of this read

- No source: the loop, the compaction algorithm and the permission engine are opaque.
  Claims about their internals are marked `declared` or `inferred` and never
  `implemented`.
- No execution: nothing was installed and no query was run, so latency, failure
  behaviour and exact wire frames are unverified.
- Documentation drift: 328 releases and a 95 KB changelog mean a docs page can describe
  a newer binary than the types do; the two were read on the same day and disagreed
  nowhere material to this profile.
- The wrapper's session-store examples were read as published adapter code, not run
  against a database.
- Distribution and pricing claims (tokens, containers, terms) are vendor statements,
  recorded as such.
