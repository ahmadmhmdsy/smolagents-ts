# 06 — Glossary (domain language)

**Contract**
- **Role:** the canonical meaning of project-specific terms.
- **Mutability:** append-only. Redefining a term requires a new row and a note
  on the old one.
- **Read when:** a domain term is unclear, or before naming anything new.
- **Update when:** a term is coined, imported, or redefined.

**Why this file exists:** agents confidently misuse domain vocabulary, and
every downstream artifact inherits the misuse. One table prevents it.

---

| Term | Meaning here | Not to be confused with | Source |
|---|---|---|---|
| **CodeAgent** | the agent whose action is a program: it runs generated JavaScript in a sandbox and reads the observation back | `ToolCallingAgent`, whose action is a tool call | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **ToolCallingAgent** | the agent whose action is a structured tool call the model emits | `CodeAgent` | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **CodeExecutor** | the pluggable seam that runs agent-authored code outside the host realm or in another language runtime | the agent loop, which decides when code runs | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **AgentStep** | one recorded turn of the loop; every step is a memory entry and an event payload at once | a chat message | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **AgentEvent** | one typed transition in a run, the stream a UI renders from | a log line | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **AgentSession** | the observable store over a run; React subscribes to its snapshot | the agent object itself | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **run record** | one durable document per run: an id, a status, a generation fence, the memory steps and, as later items add them, the pending request and the effects journal | a checkpoint of steps, which is only the memory half | docs/09-decisions/0023-one-identity-per-run.md |
| **runId** | the one address of a run across its record, its store key, its events and the CLI | a checkpoint name, the old spelling of the same idea | docs/09-decisions/0023-one-identity-per-run.md |
| **claim** | the compare-and-set of a run's generation that makes one writer its owner; a losing claim raises `RunClaimedError` | a lock, which the project does not use | docs/09-decisions/0023-one-identity-per-run.md |
| **generation (fence)** | the number a claim bumps and every commit compares, so a writer that read generation 3 cannot write after a claim reached 4 | a timestamp, which cannot order two writers reliably | docs/09-decisions/0023-one-identity-per-run.md |
| **Tool** | a declared capability with a Zod schema, a description and a callable | a plain function the model may call | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **final answer** | the sentinel return plus the out-of-band flag the loop reads as the end of a run | an exception, which is how upstream signals it | docs/design/2026-10-12-smolagents-ts-v1-design.md |
| **gate** | the eleven-stage chain in `scripts.gate`, and the exit code that summarises it | a code review | docs/10-runbooks/gate.md |
| **context pack** | this repository's context system: `SOUL.md`, `AGENTS.md`, `rules/`, `docs/`, `_templates/` | an npm package | context-pack.json |
| **placeholder marker** | the marker the pack ships where a project fact belongs; adoption is finished when none remain outside the forms | a real fact | scripts/checks.py |
| task | a tracked unit of work with an ID, a status, and an owner | a to-do note | docs/04-tasks.md |
| agent | an autonomous or semi-autonomous worker operating in this repository | a process or service | AGENTS.md |
| durable | survives the session because it is written to a file in this repository | cached, in memory | rules/15 |

## Rules

- **Canonical spelling.** One spelling per term; list variants as "also seen
  as". Inconsistent spelling breaks search.
- **Define by use, not by dictionary.** What does it mean *in this project*?
- **Name the near-miss.** The most useful column is what the term is commonly
  confused with.
- **Add the term the first time it is used ambiguously** — that is when the
  cost of not defining it is visible.
