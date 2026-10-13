# Changelog

## 2.0.0

It also ships an adoption skill, `skills/adopt-context-pack/`: an agent in another project can be pointed at that directory (or have it copied in) and then resolves the pack, plans the install, and drives the judgment half - the marker sweep, the reconciliation with an existing agent system, and the honest report.

Breaking layout change: the pack no longer ships two complete entry files. It ships one written entry, `AGENTS.md`, plus pointer-only adapters for other harnesses. An agent that used to read `CLAUDE.md` as a full operating document must read `AGENTS.md` instead; each adapter states where to go.

### Defects fixed

- D3 - `docs/09-decisions/README.md` listed the decision template as a decision row (`0000`). The template row was removed from the directory.
- D1 - The status vocabulary disagreed: `in progress` in the plan form against `in_progress` in the task table and the rules. `docs/00-schema.md` is now the single authority and every form uses its tokens.
- D2 - Memory entry ordering was never stated. `docs/05-memory.md` is now a topic registry and each topic shard is append-only, oldest first within the shard.
- D4 - Two full entry files used 23,323 B of a 24,576 B budget (95%). The entry surface is now one router plus adapters under 1 KB each.
- D5 - The "must agree verbatim" mitigation was unenforceable; the validator only checked that each file named the other. The duplication is gone, and each adapter is now checked to point at `AGENTS.md`.
- D6 - With no evidence-path verification, R-08.4 and R-15.10 were aspirational. The validator now resolves the evidence path of every `done` row.
- D7 - Growth was bounded by a prose size policy only. `scripts/rotate.py` moves complete entries into archives against byte caps.
- D8 - There was no freshness discipline, so a stale fact could silently win. Verified facts carry `Last verified` and `Verified by`, and the validator marks a fact whose date is past its review window.
- D9 - A lesson never became a rule. Promotion now runs through `rules/17-learning-loop.md`.

### Structural weaknesses addressed

- A - Dual full entry files became one written entry plus pointer-only adapters.
- B - An unverifiable state layer became Markdown as the record, with the validator checking evidence, vocabulary and timestamps.
- C - Unbounded boot cost became byte-capped inline regions, rotation, and a memory index, with the whole boot set capped at 36 KB.
- D - No rotation mechanism became `scripts/rotate.py`, which moves and never deletes.
- E - Scattered vocabulary became `docs/00-schema.md` as the sole authority.
- F - No scope hierarchy became the nearest `AGENTS.md` plus component rules and a stated resolution order.
