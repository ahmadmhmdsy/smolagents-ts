# 08 — Coordination

**Contract**
- **Role:** who may write what, and how concurrent work is serialized.
- **Mutability:** approval-only.
- **Read when:** before any work that shares files or resources with another
  writer.
- **Update when:** owners, write scopes, branching, or shared resources change.

Full policy: rules/12-coordination-and-multi-agent.md.

---

## Fleet model

Declared once; exactly one model is active. Changing it is an owner decision
recorded in this file.

- **SHARED TREE (default).** All agents work in one checkout. Claims, TTLs and
  locks are enforceable; simultaneous edits to one file are the risk.
- **BRANCH PER AGENT.** Each agent works in its own worktree. Isolation is free;
  integration is the problem, and claims matter mainly for exclusive resources.

**Limit.** Claims live in files inside one working tree. Across separate clones
or machines they do not synchronise, and the pack says so rather than implying a
guarantee it cannot keep.

## Claims

Six fields; `state` is `active` / `stale` / `released`. TTL default **2 h**,
renewable.

<!-- rotate:begin -->
| task | owner | scope | claimed_at | expires_at | state |
|---|---|---|---|---|---|
| T-13 L4/L5 (tasks 1 to 9), and the exec-remote review follow-up | this session | `packages/react-ui/**`, `packages/react/src/**`, `packages/exec-remote/**`, `examples/vite-app/**`, `scripts/pack-smoke.mjs`, and the doc rows for both layers | 2026-10-14T14:50+03:00 | 2026-10-14T17:30+03:00 | stale |
| task-7 docs truth pass (the 2026-10-21 review) | docs-truth | `docs/**` except `docs/reports/**` and `docs/10-runbooks/publish-0.1.0.md`; `scripts/_packmodel.py`, `scripts/checks.py`; every package and app `AGENTS.md` whose test count was stale; `docs/memory/**` | 2026-10-21T15:42+03:00 | 2026-10-21T17:42+03:00 | released |
<!-- rotate:end -->

1. Read the claims table before touching anything.
2. Overlap means wait, hand off, or pick other work — never race. Waiting is
   bounded; past the budget, report `BLOCKED`.
3. An expired claim is marked `stale`, never deleted. Reclaiming requires
   recording the reclaim and re-reading the contested file before writing.
4. Contended surfaces get small, short-lived changes; always re-read immediately
   before writing.
5. Claims are released on normal completion, not left to expire.

## Contended surfaces

`03-handoff`, `04-tasks`, `05-memory` and `08-coordination` — written by many
writers, so they change in small, short-lived edits.

## Exclusive resources

Builds, test suites, migrations, ports, package-manager state and GPU share one
lifecycle. Never kill a foreign process to free a resource.

| resource | exclusive? | serialization rule |
|---|---|---|
| builds | yes | one writer at a time |
| test suites | yes | one writer at a time |
| migrations | yes | one writer at a time |
| ports | yes | one owner per port |
| package-manager state | yes | one writer at a time |
| GPU | yes | one job at a time; no co-run |

## Owners, scopes and handoff

Every concurrent task names its owner and write scope before editing
(rules/12 `R-12.2`). A scope is a file or a directory prefix; overlapping scopes
are serialized, not raced, and a rejected write is re-read and rebased. When work
passes between writers, update `docs/03-handoff.md`, update the task row's owner
and status, and state what is finished, what is half-done, and what must not be
touched.

## Conflict resolution

1. Stop both writers on the contested artifact.
2. Record both positions with evidence in the topic's shard under `docs/memory/`, and update the topic's row in `docs/05-memory.md`.
3. Escalate to the artifact's owner, or the human owner if none is named.
4. Apply the decision; do not re-litigate it in the file.
