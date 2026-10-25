# 09 — Decision records

**Contract**
- **Role:** one file per accepted decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a **new** record that
  supersedes the old one; the old record is never rewritten.
- **Read when:** before reversing a design choice, or when wondering "why is
  it like this?"
- **Update when:** a significant, hard-to-reverse decision is made.

**Why this file exists:** without it, every agent re-opens settled questions and
sometimes wins.

---

## What belongs here

A decision belongs here when at least one is true:

- it is expensive or slow to reverse;
- it constrains future options;
- it was contested;
- a reasonable future agent would ask "why not the other way?"

Do **not** record routine implementation choices. They belong in the code.

## Index

| ID | Title | Status | Date |
|---|---|---|---|
| 0026 | retrieval is in, as an opt-in seam for a later phase | accepted | 2026-10-25 |
| 0025 | no blackboard: a report, a message, and a claim board | accepted | 2026-10-24 |
| 0024 | 0.1.0 waits for the correction pass | accepted | 2026-10-24 |
| 0023 | one identity per run: runId, waiting, pending, resume | accepted | 2026-10-24 |
| 0022 | the study's refuse list is the boundary | accepted | 2026-10-24 |
| 0021 | the Docker backend reaches its guest over exec, so deny-all can be enforced | accepted | 2026-10-22 |
| 0020 | a capability is a claim the runtime consults or enforces | accepted | 2026-10-22 |
| 0019 | the closed roadmap is S7–S11, and provider routing with local runtimes stays a later candidate | accepted | 2026-10-21 |
| 0018 | the post-0.1.0 roadmap takes the production gaps, and the platform gaps stay non-goals | accepted; its sixth gap superseded by 0019 | 2026-10-16 |
| 0017 | the release-age quarantine stays on, with three vendor versions excluded by name | accepted | 2026-10-14 |
| 0016 | the Pyodide executor is in-process, and its guard is fidelity, not security | accepted | 2026-10-14 |
| 0015 | the MCP client is hand-rolled behind a transport seam | accepted | 2026-10-14 |
| 0014 | the five internal packages stay implementation, with a signpost | accepted | 2026-10-14 |
| 0013 | the CLI keeps its own version line | accepted | 2026-10-14 |
| 0012 | the web surface: a Vite example and a static site on GitHub Pages | accepted | 2026-10-14 |
| 0011 | the model's capability bag is capabilities | accepted | 2026-10-14 |
| 0010 | the published name and the repository | accepted | 2026-10-14 |
| 0009 | a local secrets file is not pack surface | accepted | 2026-10-14 |
| 0008 | the handoff's over-cap entry stays as it stands | accepted | 2026-10-14 |
| 0007 | the parity harness compares structure and keeps its Python leg out of CI | accepted | 2026-10-14 |
| 0006 | the distribution shape | accepted | 2026-10-14 |
| 0005 | the React layer's public surface | accepted | 2026-10-14 |
| 0004 | the guest program captures a step's declarations by scanning its source | accepted | 2026-10-14 |
| 0003 | the pack's surface walk prunes skipped trees | accepted | 2026-10-14 |
| 0002 | the pack baseline records pre-existing document warnings | accepted | 2026-10-13 |
| 0001 | the pack walker excludes vendored third-party trees | accepted | 2026-10-13 |

`0000-template.md` is a form, not an entry; it never appears in the index above.

## Naming

    NNNN-short-title.md

Four digits, zero-padded, never reused. Supersede by writing a new record whose
**Supersedes** field names the old one, and by marking the old record's status
as superseded with a link forward.

## Workflow

1. Copy docs/09-decisions/0000-template.md to NNNN-short-title.md.
2. Fill every section. A section with no content gets "none" — not deletion.
3. Add a row to the index above.
4. If the decision changes a rule or a spec, update those in the same commit.
