# rules/15 — Documentation and document integrity

**Purpose:** documents are the project's memory. Drift is the failure mode.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every file under docs/, rules/, _templates/, and the entry
  files.

## Rules

**R-15.1 — Every document has a home.** A document MUST appear in the document
map (AGENTS.md, "Where truth lives"). *Why:* a document outside the map does not exist for the
next agent.

**R-15.2 — New kind means new row, same commit.** Creating a new *kind* of
document MUST add its row to the map in the same commit. *Why:* a map that
lags is a map that lies.

**R-15.3 — Respect mutability.** MUST NOT rewrite history in an append-only
document, and MUST NOT append stale entries to a rewrite-in-place document.
*Why:* the mutability contract is what makes each file readable.

**R-15.4 — Honoring the update trigger is mandatory.** MUST update a document
when its declared update trigger fires, in the same session. *Why:* a trigger
deferred is a trigger forgotten.

**R-15.5 — No stale links.** A broken or outdated reference MUST be fixed or
deleted in the session that reveals it. *Why:* a stale link actively misleads
and costs trust in the whole map.

**R-15.6 — One fact, one home.** MUST NOT duplicate a fact across documents;
MUST link to the authoritative home instead. *Why:* duplicated facts diverge,
and then neither can be trusted.

**R-15.7 — Do not document what the machine enforces.** MUST NOT restate rules
already enforced by the linter, formatter, type checker, or CI. *Why:* rule
lists that duplicate automation teach agents to skim rule lists.

**R-15.8 — Timestamps are machine-readable.** MUST write dates as ISO 8601 with
an explicit timezone offset. MUST NOT use "recently", "today", or "a while
ago". *Why:* unverifiable dates cannot be reconciled with logs or history.

**R-15.9 — Record verified facts as verified.** MUST state how a fact was
verified and when. MUST mark unverified content as unverified. *Why:* a document
that mixes them cannot be relied on for either.

**R-15.10 — Creation is not completion.** Every artifact kind has a close-out
ritual. An artifact is complete only when its ritual has run: the report
finished, the ledger row added, the lesson recorded, the task status updated.
*Why:* an artifact without a close-out is an orphan. Evidence resolution for a
`done` row is governed by R-08.15.

**R-15.11 — Keep growing documents readable.** For append-only documents that
grow without bound, SHOULD supersede or archive rather than delete, and MUST
keep the newest information at the top. *Why:* a 4000-line log is read by
nobody.

**R-15.12 — Documentation must not claim unsupported behavior.** MUST NOT
document what the code does not do. *Why:* the document becomes the source of
the next agent's confidently wrong action.

**R-15.13 — Keep the entry surface small.** MUST move detail out of the entry
files into a module or doc before they exceed the boot budget. *Why:* every
session pays for the entry files.

**R-15.14 — Run the integrity check.** SHOULD run the context validator before
finishing a documentation change:

    python scripts/validate_context.py .

## Adapting

Adjust the boot budget, the validator path, and the archival policy to the
project. If the project already enforces docs in CI, say so and point at the
check instead of restating it.
