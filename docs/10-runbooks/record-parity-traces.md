# 10 — Runbook: re-recording the parity traces

- **Last verified:** 2026-10-14 by the S1.5 session
- **Estimated duration:** about two minutes
- **Risk:** low — it rewrites committed data files, and only those
- **Reversible:** yes — `git checkout -- scripts/parity/recordings`

**Contract**
- **Role:** the procedure that regenerates the upstream traces the TypeScript parity suite compares against, and the rule for what a recording is allowed to claim.
- **Mutability:** rewrite in place when the recorder, the corpus or the pinned upstream release changes.
- **Read when:** the parity suite fails, a scenario is added or edited, or the pinned upstream release changes.
- **Update when:** a step here stops matching what the recorder does.

**Why this file exists:** the Python half of the harness does not run in CI, so the committed recordings are the only evidence that our loop still matches upstream. Recording again is cheap; re-deriving what a recording means is not.

---

## Why the Python leg is not in CI

`.github/workflows/ci.yml` runs the Node gate and a runtime matrix, and `.github/workflows/context.yml` runs the context pack's own checks. Neither runs the recorder, on purpose:

- The upstream release is installed into an interpreter rather than declared in this repository's lockfile, so a CI job would exercise whichever release the resolver chose. A green run would then say nothing about the release the recordings pin.
- The comparison is a claim about a dependency's observed behaviour, not a property of this source tree, and the gate decides whether a commit is good.
- Reproducing it needs a Python toolchain and an installed third-party release. The committed recordings need neither, which is why `pnpm gate` replays them offline.

## Preconditions

- [ ] Python 3.13 on `PATH` — the recordings were made on 3.13.7 — with upstream `smolagents` installed at the pinned release.
- [ ] A clean working tree, so the diff afterwards is only the recordings.
- [ ] Run from the repository root.
- [ ] Network access for the install only; the recording itself is offline.

## Steps

1. Confirm the interpreter and the installed release:

        python --version
        python -c "import importlib.metadata as m; print(m.version('smolagents'))"

2. If that is not the pinned release, install it:

        python -m pip install "smolagents==1.14.0"

   Do not record against a different release: the recorder stamps the version it saw into every file, and the suite fails on a recording that does not carry the pinned one.

3. Confirm the tree is clean:

        git status --porcelain

4. Record every scenario:

        python scripts/parity/record.py

   It writes one JSON file per scenario under `scripts/parity/recordings/` and prints the version it ran against.

5. Read the diff before committing it:

        git diff --stat -- scripts/parity/recordings

   A trace that changed while `meta.upstreamVersion` did not is a finding, not churn.

6. Replay the new recordings through our side:

        pnpm vitest run --project core parity

7. Run the whole gate before committing:

        pnpm gate

## Verification

    python -c "import glob,json; print(sorted({json.load(open(p))['meta']['upstreamVersion'] for p in glob.glob('scripts/parity/recordings/*.json')}))"
    # expect: ['1.14.0']

    pnpm vitest run --project core parity
    # expect: Test Files 1 passed (1) and Tests 6 passed (6), exit code 0

Measured on 2026-10-14 at commit `2ad7d8f`: five recordings, six tests, exit code 0. Recording twice in a row left every trace identical and moved only `meta.recordedAt`, which is why a diff confined to that field is not a behavioural change.

## Rollback

The recorder writes only under `scripts/parity/recordings/`, so the committed state restores exactly:

    git checkout -- scripts/parity/recordings

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `ModuleNotFoundError: No module named 'smolagents'` | the interpreter on `PATH` has no upstream installed | install the pinned release, or run the recorder with the interpreter that has it |
| the recorder exits saying a scenario declares tools | neither reader wires tools from the corpus, so both runs would ignore them | support tools in both readers first, or drop the list from that scenario |
| the suite fails with a missing-recording error | a scenario has no recording | record it and commit the new file |
| the suite fails on `meta.upstreamVersion` | the recording was made against another release | record again with the pinned release |
| the suite fails on a `differsOn` set | the two sides converged, or diverged further | decide which side is right, then update the scenario's expectation and the plan's measured results |

## Adding a scenario

1. Add one JSON file under `scripts/parity/scenarios/` with `id`, `task`, `tools`, `planningInterval`, `maxSteps`, `turns` and `expect`. Each turn carries the Python script and the TypeScript script for that turn, and `tools` stays empty.
2. Record it (step 4) and replay it (step 6). The suite discovers scenarios from the directory, so nothing else needs registering.
3. State the expectation honestly: equal, or divergent with the exact `differsOn` fields, a `why`, and the values our side must still produce.

## Notes

- The comparison is structural on purpose: step kinds, the code-execution call, each step's error presence, the final-answer value, and the roles of the messages each side sent its model. Prompt text, code source and observation text are never compared, so a prose change does not invalidate a recording.
- Our side's scripted executor returns the scenario's observation instead of computing it, so the differential claim covers upstream's real execution and our loop's structure, not our executor's semantics.
- Two divergences ship as pinned facts rather than as hidden failures: the planning position and the max-steps terminal shape, both recorded in `docs/plans/2026-10-14-s1.5-parity-harness-plan.md`.

## Last executed

2026-10-14, on this machine, exit code 0, against upstream 1.14.0 on Python 3.13.7.
