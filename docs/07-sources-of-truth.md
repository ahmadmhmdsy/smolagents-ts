# 07 — Sources of truth

**Contract**
- **Role:** for each kind of fact, which artifact is authoritative.
- **Mutability:** rewrite in place.
- **Read when:** before reporting any number or status.
- **Update when:** the authoritative artifact for something changes.

**Why this file exists:** most false claims are not lies — they come from two
sources disagreeing and the agent picking the convenient one. Naming the winner
in advance removes the choice.

---

## Register

| Fact / number | Authoritative source | How to read it | Never rely on |
|---|---|---|---|
| Build status | the gate's exit code | run `pnpm gate`; the exit code is the result | a remembered result |
| Test results | the Vitest run itself | `pnpm test`, or `pnpm vitest run --project <id>` | a test count written in a document |
| Deployment state | not applicable — this library is not deployed anywhere | — | a local assumption |
| Current branch / commit | the version-control system | `git rev-parse HEAD` | a document that names a commit |
| Task status | docs/04-tasks.md | read the row | chat history |
| Project state | docs/03-handoff.md (newest entry) | read the newest entry | an older entry |
| Machine facts | docs/02-environment.md | read the row together with its timestamp | intuition |
| CI stage list | `scripts.gate` in `package.json` | read the script; `scripts/check-ci.mjs` enforces agreement with the workflow | the workflow file on its own |
| Published package shape | `pnpm publint` and `pnpm attw --profile esm-only` | run them | the package's own claims |
| Upstream provenance | docs/attribution.md and the design record | read the pinned commit | memory |
| Architecture boundaries | `pnpm depcruise` | run it | the directory names |
| Context-pack integrity | `python scripts/validate_context.py --root .` | run it; zero errors is the threshold | this document |

## Reporting protocol

1. Before stating a number, identify its source in this register.
2. Read the source. Do not recall it.
3. Cite the source in the report.
4. If two sources disagree, the register decides. If the register is silent,
   stop and ask — do not choose.
5. If a source is unavailable, report SKIPPED with the reason. Never substitute
   a plausible value.
6. Between two readings of the same source, the freshest verification timestamp
   wins. A fact that cannot be verified this session renders `UNKNOWN` and never
   inherits an older value.

## Derived values

No reported quantity is computed by a second tool. Test counts come from the
Vitest summary, module and dependency counts from `pnpm depcruise`, and package
counts from the `packages/*` directories that carry a `package.json` — the
workspace glob in `pnpm-workspace.yaml` is the set, not a number remembered from
an older document. There is exactly one producer per number, so two sessions
cannot report two values for it.
