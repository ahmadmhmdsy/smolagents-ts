# rules/08 — Verification and evidence

**Purpose:** a claim without evidence is a guess wearing a confident voice.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every statement that something works.
- **Never deleted when adapting.**

## Rules

**R-08.1 — Discover the real checks.** MUST determine the available checks from
the manifest, the command table, and the CI configuration. MUST NOT run a
command because it is conventional for the stack. *Why:* inventing a check
produces a false failure or a false pass.

**R-08.2 — Run the most relevant check.** MUST run the check that actually
exercises the changed behavior. When several exist, SHOULD run the fast one
after every change and the full one before declaring done. *Why:* an unrelated
green suite proves nothing about this change.

**R-08.3 — Never claim a check passed unless it ran.** MUST NOT report PASS,
done, or working for anything not verified in this session. *Why:* it is the
single most damaging failure mode an agent has.

**R-08.4 — Evidence is an artifact.** Evidence MUST be something another person
can reproduce from the repository: a command and its output, a result file, a
CI run, a log path. Memory and reasoning are not evidence. *Why:* reproducible
evidence is the only kind that survives the session.

**R-08.5 — Report SKIPPED with a reason.** When a check cannot run, MUST report
SKIPPED and state why — missing tool, missing credential, unavailable service,
out of scope. *Why:* a silent skip is indistinguishable from a pass.

**R-08.6 — Read failures completely.** MUST read the full error and its context
before acting. *Why:* the cause is frequently not on the first line or in the
last error.

**R-08.7 — Do not retry a deterministic failure unchanged.** MUST diagnose
before retrying. SHOULD limit retries of any failure. *Why:* repeated identical
attempts waste time and hide the cause.

**R-08.8 — Distinguish tested from plausible.** MUST use different words for
"verified by running" and "expected to work". *Why:* conflation is how a guess
becomes a reported fact.

**R-08.9 — Distinguish self-reported from independently verified.** MUST mark
results produced by the artifact under test as self-reported. Independent
verification is a separate check. *Why:* some systems report success while
failing.

**R-08.10 — Green tests that do not cover the change are not evidence.**
SHOULD add or extend a check when the changed behavior has none, or state
explicitly that it is unverified. *Why:* uncovered behavior is unverified
behavior.

**R-08.11 — Verify after the last change.** MUST re-run the relevant check
after any modification to the verified artifact. *Why:* a fix invalidates the
verification that preceded it.

**R-08.12 — State the command and the result.** MUST report the exact command
run and its exact outcome, not a summary of your impression of it. *Why:* it is
what lets the reader judge the claim.

**R-08.13 — Do not hide warnings or errors.** MUST report anything that affects
correctness or indicates undefined behavior, even when it does not fail the
build. *Why:* suppressed warnings become production incidents.

**R-08.14 — Known limitations are part of the result.** MUST state what the
change does not handle. *Why:* an unstated limitation is a defect the reader
did not agree to accept.

**R-08.15 — Evidence must resolve.** A `done` **task** row's evidence MUST
be an existing path relative to the repository root. A path that does not exist,
or an empty evidence cell, makes the row not-`done`. This narrows R-08.4 for
`done` rows: the recorded evidence is the path, not the command. *Why:* a status
whose evidence cannot be found is an unverified claim wearing a `done`.

## Adapting

Write the actual fast and full check commands into `docs/02-environment.md`. Record in
docs/07-sources-of-truth.md which artifact is authoritative for each kind of
result, and how a number must be produced so two sessions cannot report two
different values for the same thing.
