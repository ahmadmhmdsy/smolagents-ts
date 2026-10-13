# general — memory shard

Lessons that do not belong to a narrower topic.

## 2026-10-13 — a vendored tree breaks a naive pack walk

- **Status:** validated
- **Lesson:** the pack validator walks every Markdown file under the repository root, so a gitignored third-party clone with its own AGENTS.md files produces scoped-entry errors, its prose trips the secret heuristic, and one directory named agents.md makes the walker raise instead of read; exclude those trees at the walker, because editing the clones is not an option.
- **Evidence:** measured before the patch: 40 errors and 30 warnings in 173 s, with all 40 errors inside the two ignored trees; after excluding them the run is seconds. See `scripts/_packmodel.py` and `docs/09-decisions/0001-pack-walk-excludes-vendored-trees.md`.

## 2026-10-13 — a green smoke test on an empty package

- **Status:** observed
- **Lesson:** four of the five packages are placeholders whose only test asserts that the package exports something, so a green suite of 277 tests says almost nothing about them; read the per-package count before treating a green run as evidence of progress.
- **Evidence:** `pnpm vitest run --project core` reports 27 files and 273 tests, while the models, tools, react and exec-quickjs projects report one test each.

## 2026-10-13 — an unmeasured runtime claim

- **Status:** validated
- **Lesson:** the first lesson above credits the walk exclusion with a fast validation run, and that comparison was never timed; the excluded trees left the findings, not the walk, so the run stayed at 179,240 ms until the walkers learned to prune. A sentence of the form "this is faster now" is a measurement, and writing it without a stopwatch puts a number in the record that no later session has reason to doubt.
- **Evidence:** timed per check before the prune: c12_secrets 54.0 s, c10_rule_ids 52.9 s, c11_duplicate_facts 52.2 s, and the three were slow for one reason. After `iter_surface()` the same input reports identical JSON (`new: [], baselined: 14`) in 433 ms. See `docs/09-decisions/0003-pruning-surface-walker.md`.
## 2026-10-13 — a plan that quotes source code twice

- **Status:** validated
- **Lesson:** the duplicate-facts check reads sentences wherever they sit, so copying an existing comment or a control line into a new document to show a code change makes that sentence a fresh finding in the new document; reword it inside the snippet, because the check protects the fact's single home and a plan that repeats prose pays for the repetition it was written to avoid.
- **Evidence:** the S2a plan quoted three comments already present in `docs/plans/2026-10-12-s1-core-runtime-plan.md`; `python scripts/validate_context.py --root . --baseline docs/.baseline.json --json` reported `new: 4`, and returned to `new: 0` once those comments and one ordering line were reworded. See `docs/plans/2026-10-13-s2a-model-seam-and-openai-compatible-plan.md`.
