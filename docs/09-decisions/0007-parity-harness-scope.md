# 0007 — the parity harness compares structure, and its Python leg stays out of CI

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that supersedes this one; this file is never rewritten.
- **Read when:** before widening what the parity suite compares, or before wondering why upstream does not run in CI.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14T03:07:36+03:00
- **Decided by:** maintainer
- **Supersedes:** none

## Context

S1.5 exists to hold the TypeScript loop against the implementation it is derived from. That raised two questions the plan could not answer from first principles alone: where the Python side runs, and what the two sides are allowed to compare.

The constraints at the time: upstream `smolagents` is installed into an interpreter (1.14.0 on Python 3.13.7) rather than declared in this repository's lockfile; the gate is Node-only and offline (typecheck, lint, depcruise, test, build, publint, attw, ci:check, pack:smoke); `.github/workflows/ci.yml` runs that gate on three Node versions plus a runtime matrix, and `.github/workflows/context.yml` runs the context pack's own checks. Nothing in this tree pins the upstream release.

## Decision

The parity suite compares structure only — the step kinds, the code-execution call, each step's error presence, the final-answer value, and the roles of the messages each side sent its model — and never prompt text, code source or observation text. The Python leg does not run in CI: `scripts/parity/record.py` replays a shared corpus through the installed upstream release and commits one normalized trace per scenario with its metadata, and `pnpm gate` replays the same corpus through our loop against those committed traces. A recording that does not carry the pinned upstream version fails the suite instead of comparing across releases.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| Run the recorder in CI against a pinned Python install | A CI job would exercise the release its resolver chose, not the one the recordings pin, and it would put a second toolchain inside a Node gate. The comparison is a claim about a dependency's observed behaviour, not a property of this tree. |
| Compare the two sides' prompts and generated code as text | Our prompt templates are deliberately our own and upstream's text is stable only within a release. A text comparison would fail on every rewording while proving nothing about the loop, whose contract is its step sequence and events. |
| Snapshot our own traces and assert they are unchanged | A self-snapshot cannot detect divergence from upstream, which is the only thing this harness is for. |
| Record live in the test, skipping when Python is absent | A suite that silently skips rots silently, and a loose script under the repository root cannot resolve `zod`, so the replay has to live inside the vitest projects anyway. |
| Assert equality on every scenario | Two divergences are real and measured: the planning position and the max-steps terminal shape. An equality assertion there is red forever, and pinning a measured difference is the honest form. |

## Consequences

**Positive**

- The gate stays offline, Node-only and credential-free, and it fails loudly on a stale recording or one made against another release.
- A structural comparison survives prompt rewording, so the harness does not decay into a change detector.
- The divergences it does find are pinned facts with task ids instead of hidden failures.

**Negative / accepted costs**

- A recording is only as fresh as its last run; nothing detects upstream drifting between two recordings automatically, so `docs/10-runbooks/record-parity-traces.md` is the only guard.
- Executor semantics are out of scope: our scripted executor returns the corpus's observation rather than computing it, so S4's QuickJS tests own that behaviour.
- A prompt change on our side can alter upstream-relevant behaviour without failing this harness.

## Reversibility

Easy in either direction. Adding a CI job for the recorder needs a workflow change and a pinned install, not a change of shape; widening the comparison is likewise cheap, because both sides already emit normalized traces and each compared field is one entry in the suite.

## Follow-up

- [ ] Decide the planning cadence — upstream plans before the first step, our loop plans after it — owner: owner (T-16).
- [ ] Decide the max-steps terminal shape — owner: owner (T-18).
- [ ] Re-record when the pinned upstream release changes — owner: whoever changes it, following `docs/10-runbooks/record-parity-traces.md`.
