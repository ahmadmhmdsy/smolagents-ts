# 0009 — a local secrets file is not pack surface

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before wondering why the walker skips a file named `.env`, or
  before adding another name to the skip list.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the owner, who keeps a local provider key in the project
  directory
- **Supersedes:** none

## Context

The owner keeps a provider API key in `.env` at the repository root, gitignored
and never committed, so a real model can be exercised end to end. The pack's
secrets check flags a file named `.env` wherever the walk reaches it and fails
the whole validation on its mere presence, which makes the gate red for as long
as the key lives there. The key is a local convenience; the pack's rule exists to
keep secrets out of what the pack ships.

## Decision

The walker treats `.env` and `.env.local` as it treats its own build
scaffolding: not pack surface. Adoption never copies them, the checks never
report on them, and `.gitignore` keeps them out of history.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Move the key outside the project directory** | It contradicts the owner's instruction, and it makes the smoke test depend on shell state that is not recorded anywhere. |
| **Rename the file so it slips past the name check** | Evasion: the check exists for a reason, and a name chosen to dodge it teaches the next session the wrong lesson. |
| **Baseline the finding** | The baseline records pre-existing document warnings, not a deliberate exclusion of a secrets file; baselining an error hides it from the gate forever. |

## Consequences

**Positive**

- The gate can be green while a real key lives locally, and adoption cannot copy
  a secrets file into a target.

**Negative / accepted costs**

- This is the third local patch to a shipped pack script, after the skip list of
  decision 0001 and the pruning walker of decision 0003, so a pack upgrade
  re-applies three edits.
- A committed `.env` in some future tree is no longer caught by the validator;
  `.gitignore` is the only guard left for that name.

## Reversibility

Easy. Delete the two names from the skip list and the check behaves as the pack
ships it.

## Follow-up

- [ ] none — the patch is recorded, and `docs/02-environment.md` names the file
  and the variable.
