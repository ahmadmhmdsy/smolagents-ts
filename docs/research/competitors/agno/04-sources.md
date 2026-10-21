# agno-agi/agno — sources for this read

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

**Repository and read point**

| item | value |
|---|---|
| Repository | https://github.com/agno-agi/agno |
| Read commit | `7a4febfa9de7a6c1f5e420fad88e4e8db956aef4` |
| Commit date and subject | 2026-10-21 12:14:43Z, `chore: Release v3.1.8 (#11208)` |
| Version read | `3.1.8` |
| Licence | `Apache-2.0`; `LICENSE` is the Apache License Version 2.0 text, 11,343 bytes |
| Scale at this commit | 1,409 files in `libs/agno/agno`, 7,289 tracked files overall |
| Read on | 2026-10-21, depth D2; no clone, repository metadata via the GitHub API |

**Licence note**

The brief expected MPL-2.0 and asked whether the copyleft is file-level. It is
not: the endpoint reported Apache-2.0 and the licence file is the standard
text. Nothing forbids reading the source, and nothing was copied. No clone was
made because the brief scoped a D2 documentation read.

**Documentation read, 2026-10-21**

All pages are Markdown served by https://docs.agno.com; the index listing them is
https://docs.agno.com/llms.txt. Principal pages:

- https://docs.agno.com/agents/overview
- https://docs.agno.com/teams/overview
- https://docs.agno.com/workflows/overview
- https://docs.agno.com/sessions/overview
- https://docs.agno.com/memory/overview
- https://docs.agno.com/agent-os/overview
- https://docs.agno.com/agent-os/background-execution/durable-queue
- https://docs.agno.com/hitl/approval
- https://docs.agno.com/skills/overview

Also read that day, same host: `database/overview`, `database/session-storage`, `sessions/session-summaries`, `knowledge/overview`, `tools/overview`, `tools/toolkits/overview`, `tools/toolkits/local/workspace`, `filesystem/overview`, `hitl/overview`, `hitl/user-confirmation`, `background-execution/overview`, `compression/overview`, `agent-os/control-plane`, `agent-os/public-surface`, `features/api`, `features/runtime`, `features/sdk`, `features/control-plane`, `features/observability`, `features/security-and-auth`, `features/interfaces`, `tracing/overview`, `scheduler/overview`, `deploy/introduction`, `cli/overview`, `run-cancellation/overview`, `use-cases/agents-as-api`, `evals/overview`, `input-output/output-model`, `models/overview`, `dependencies/overview`, `hooks/overview`, `context-providers/overview`, `context-providers/providers/workspace`, `workflows/hitl/overview`, `examples/agents/checkpointing/crash-recovery`, `examples/agents/checkpointing/checkpoint-endpoints` and `agent-os/multi-framework/step-replay` (pages were fetched as Markdown with curl and with Node's `fetch`).

**Repository files read through the API**

`README.md`, `libs/agno/pyproject.toml`, `libs/agnoctl/README.md` and its
`pyproject.toml`, `libs/agno_infra/README.md`; the root, `libs`, `libs/agno` and
`cookbook` listings plus the `agno`, `os`, `sandbox`, `skills` and `learn`
sub-listings; the recursive tree filtered for TypeScript; `agno-agi/agent-ui`
metadata and README. No source module body was read.

**Commands run**

- `gh api repos/agno-agi/agno --jq '.license.spdx_id'` and the licence endpoint,
  returning `Apache-2.0` at `LICENSE`.
- `gh api repos/agno-agi/agno/commits/main` for the commit, date and subject.
- `gh api repos/agno-agi/agno/contents/...` and `git/trees/main?recursive=1` for
  listings, raw files and counts.
- `gh api repos/agno-agi/docs` and `repos/agno-agi/agent-ui` for the siblings.
- `curl` and Node's `fetch` against docs.agno.com for the Markdown pages.

Nothing was installed, imported, built, tested or served.

**What was not verified**

- Runtime behaviour: no AgentOS process ran, so latency, provisioning and stream
  reconnection come from prose.
- Database adapters, migrations, sandbox providers and the hosted Control Plane,
  none of which was exercised.
- The TypeScript client repository, read at its metadata and README only.
- Any comparison of cost, quality or reliability.

**How to refresh this read**

1. Re-query the repository endpoint and record a new commit, date and subject.
2. Re-fetch the documentation index and diff the page list; a removed page means
   a claim to drop.
3. Re-read the cited pages and replace any statement whose source changed.
4. Check the licence field and `LICENSE` bytes, then file a new record and leave
   this one frozen.