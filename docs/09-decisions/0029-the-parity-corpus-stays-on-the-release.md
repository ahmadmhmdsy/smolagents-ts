# 0029 — the parity corpus stays on the 1.14.0 release, and the design's pin is a separate comparison

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that supersedes this one; this file is not edited.
- **Read when:** reading a parity recording, changing the pinned upstream, or wondering which upstream this port follows.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-25
- **Decided by:** owner, answering `D-04` in the open-decisions plan
- **Supersedes:** none; it settles `T-21` and applies the lesson recorded in `docs/memory/general.md` (2026-10-14, "two pinned upstreams are two different comparisons")

## Context

Two upstream revisions were pinned, and nothing said how they related:

- the design record was written from the source clone at `smolagents` `v1.27.0.dev0`, commit `96f33faaf028479119ec8d34507b47694cf14e34` (2026-10-06) -- the revision `NOTICE` and `docs/attribution.md` also name;
- the parity corpus was recorded against the installed distribution, `1.14.0` on Python 3.13.7, and every recording stamps that version in its metadata.

Both are honest. The parity suite compares structure only -- step kinds, the code-execution call, per-step error presence, the final-answer value, and the roles each side sent its model -- and refuses to replay a recording that names another release. `T-21` asked whether the split is a defect to fix or a fact to state, and the two investigations of the last week showed the two revisions disagree on the planning position and the budget-exhausted ending, so a reader who conflated them would be wrong in a way no test catches.

Re-recording against `1.27.0.dev0` was the obvious alternative and was rejected on three facts: it is a dev build (a git-commit install, not an `==` install), the recorder's imports have not been shown to survive the API movement between 1.14 and 1.27, and it would replace the evidence the six phases were reviewed against with a corpus that no contributor can regenerate from a release. It would also force a re-adjudication of every pinned divergence before the release, answering no open question.

## Decision

1. **Keep the corpus at `1.14.0`.** The recordings stay as observed; no recording changes in this decision.
2. **State the split where a reader meets it.** The design's pin names what the design **read** (a commit, because a reading happens at a revision); the recordings name what the corpus **observed** (a release, because a contributor must be able to install it); neither is a supported upstream range.
3. **Make the claim explicit to a user.** `docs/01-project.md` states, beside the derivation terms, that the design reads upstream `main` at `96f33fa` (`v1.27.0.dev0`, 2026-10-06), that the parity traces were observed on the `1.14.0` release, that the two are separate comparisons, and that no upstream API-compatibility range is claimed.
4. **Rule the re-record.** A re-record is a deliberate comparison with a purpose -- a new upstream release whose parity-relevant shapes changed, or a caller report of a behaviour difference -- never routine maintenance. When it happens, the suite constant, the runbook and the recordings move in one change, and the diff is read as a finding: a trace that changed while the version did not is a behaviour change to adjudicate.
5. **Leave the three declarations in place.** The pin is written in the suite constant, the runbook and each recording's metadata; each protects a different artifact, and the suite already fails when a recording disagrees, so silent drift is impossible.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Re-record the corpus against `1.27.0.dev0` | Replaces release-installable evidence with a dev-build install whose recorder compatibility is unverified, and forces a re-adjudication of every divergence before the release without answering an open question. |
| Keep both corpora, one per revision | Two comparisons to maintain for a question nobody is asking; the second corpus would be a claim without a consumer. |
| Leave the two pins unexplained | The state `T-21` was filed for: a reader cannot tell which comparison is current, and the memory lesson that already names the rule stays unapplied at its one join point. |

## Consequences

**Positive**

- Each artifact names the revision it is about, and the corpus stays reproducible with a one-command release install.
- A user can read what upstream this project follows, and what compatibility it does **not** claim, in one place.
- The re-record path is a recorded procedure with a trigger, so future upstream movement is a task with a purpose instead of silent churn.

**Negative / accepted costs**

- Two revisions remain in the repository; the reader has to hold "read versus observed" to keep them apart.
- The corpus does not exercise the design's own revision; a behaviour difference between 1.14.0 and 1.27.0.dev0 that the structural comparison would catch in the newer revision is not measured today.
- The pin is written three times; a re-record is a change across three places by design, not by accident.

## Reversibility

Easy in one direction, planned in the other. Keeping 1.14.0 changes nothing else; re-recording later is a task that moves three pin sites and re-adjudicates the divergences under this record's rule.

## Follow-up

- [ ] `docs/01-project.md`: the derivation paragraph gains the split and the no-compatibility-range sentence -- owner: lead, now.
- [ ] `docs/10-runbooks/record-parity-traces.md`: the re-record trigger and the three-site change -- owner: lead, now.
- [ ] Re-record only on the recorded trigger; adjudicate the `differsOn` set then -- owner: whoever next moves the pin.
