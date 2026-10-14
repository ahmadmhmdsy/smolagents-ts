# 10 — Runbooks

**Contract**
- **Role:** repeatable procedures, written so an agent can execute them without
  reconstructing intent.
- **Mutability:** rewrite in place.
- **Read when:** before repeating a procedure that has been done before.
- **Update when:** the procedure changes, or a step failed in a way it did not
  anticipate.

**Why this file exists:** the second execution of a procedure should cost
nothing. Without a runbook, it costs the same as the first, plus the
rediscovery of the same failure.

---

## Index

| Runbook | Use when | Last verified |
|---|---|---|
| _template.md | (form) | — |
| gate.md | before committing, or before reporting a gate result | 2026-10-13 |
| record-parity-traces.md | when a parity scenario is added or edited, or the pinned upstream release changes | 2026-10-14 |
| live-provider-smoke.md | after a model adapter changes, or before a release, to prove one adapter against its real provider | 2026-10-14 |
| mcp-live-check.md | after a change to the MCP client, a transport or the tool adapter, or before a release | 2026-10-14 |

## What belongs here

- Setup and teardown of an environment.
- Deploy, rollback, and release steps.
- Data migration and restore.
- Recovery from a known failure mode.
- Any sequence that has been figured out once and would be expensive to
  re-derive.

## Rules

- Every command is copy-paste exact, including flags and working directory.
- Every runbook has a verification step and a rollback step. A runbook without
  a rollback is a procedure nobody can safely interrupt.
- Record the date the runbook was last actually executed. An unexecuted runbook
  is a hypothesis.
- When a step fails unexpectedly, fix the runbook in the same session.
