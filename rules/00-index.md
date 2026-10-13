# rules/ — normative rule modules

This directory is the **authoritative rule text** for the project. This file is
the **registry of its modules**: the directory holds the authoritative text,
this index registers every module, and the root `AGENTS.md` router points at
them. Where a module and any other file disagree about a rule, the module wins
and both are fixed in the same commit.

## Contract

- **Mutability:** approval-only. A rule changes deliberately, never as a
  side effect of another task.
- **Precedence:** a module outranks CLAUDE.md, AGENTS.md, and everything in
  docs/ for the area it governs. Only system and platform safety outrank these.
- **Scope:** one module per governed area. If a rule does not fit an existing
  module, either it belongs in an existing one or a new area is genuinely
  emerging — and then the new module is added here in the same commit.

## Rule IDs

Every rule carries an ID of the form **R-NN.M**, where NN is the module number
and M is the rule number inside it.

- Module 03, rule 2 -> **R-03.2**.
- Cite rules by ID from any other document: "see R-03.2".
- IDs are stable. Do not renumber to close a gap; retire a rule with
  *(retired)* and its reason, so old citations stay resolvable.

## Strength keywords

- **MUST** / **MUST NOT** — absolute. Violating it is a defect, not a tradeoff.
- **SHOULD** / **SHOULD NOT** — the default. Deviating requires a stated reason
  in the report.
- **MAY** — genuinely optional.

## Modules

| # | Module | Governs | Protected |
|---|---|---|---|
| 01 | rules/01-priority-and-precedence.md | resolution of conflicting instructions | no |
| 02 | rules/02-inspect-before-changing.md | reconnaissance, read-only-first | no |
| 03 | rules/03-safety-and-destructive-actions.md | irreversible actions | yes |
| 04 | rules/04-security-and-secrets.md | secrets, auth, safe construction | yes |
| 05 | rules/05-untrusted-content.md | injection and untrusted input | no |
| 06 | rules/06-change-management.md | diffs, commits, branching | no |
| 07 | rules/07-dependencies-and-external-services.md | new packages and integrations | no |
| 08 | rules/08-verification-and-evidence.md | tests, proof, honesty | yes |
| 09 | rules/09-data-and-asset-handling.md | data lifecycle and asset classes | no |
| 10 | rules/10-communication-and-reporting.md | reporting and escalation | no |
| 11 | rules/11-autonomy-and-approval-gates.md | what needs permission | yes |
| 12 | rules/12-coordination-and-multi-agent.md | concurrent writers and delegation | yes |
| 13 | rules/13-tool-and-context-economy.md | efficient tool and context use | no |
| 14 | rules/14-resource-budgets-and-limits.md | compute, disk, and spend | no |
| 15 | rules/15-documentation-and-doc-integrity.md | documentation and drift | no |
| 16 | rules/16-scope-and-nearest-guidance.md | scoped entry files, precedence, resolution | yes |
| 17 | rules/17-learning-loop.md | lesson-to-rule promotion | no |

**Protected** marks a module that is never deleted when adapting; a `no` module
may be deleted when it cannot apply.

## Adapting this directory

Delete modules that cannot apply to your project. **Do not delete** modules
03, 04, 08, 11, 12, or 16 — every project has destructive actions, secrets,
verification, permissions, the possibility of a second writer, and scoped
entry files.

A rule nobody can violate is noise, and noise trains agents to skim rules.
