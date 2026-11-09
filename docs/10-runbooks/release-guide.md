# 10 — Runbook: the release guide

- **Last verified:** never executed. Written 2026-11-09 with decision `0036`. Every step is a hypothesis until the first release.
- **Estimated duration:** one hour for 0.1.0, including the account setup. About 30 minutes for each later release.
- **Risk:** high. A published version is immutable, see `publish-0.1.0.md`.
- **Reversible:** no. The only correction is a new version plus `npm deprecate`.

**Contract**

- **Role:** the order of a release: which branch, which credentials, which runbook step, and what happens to `main` afterwards. The publish mechanics live in `publish-0.1.0.md`; this guide does not repeat them.
- **Mutability:** rewrite in place when the branch model, the credentials or the version plan changes.
- **Read when:** you are about to publish, or you are asking which branch a fix belongs on.
- **Update when:** a release ran and something differed, or a decision changes the branch model.

**Why this file exists:** 0.1.0 is published from `release/0.1.0` while `main` already carries the next version's work (decision `0036`). Without one page that states the order, an operator would publish the wrong branch or lose a release fix.

---

## Purpose

Put a version on npm from the right branch, then bring `main` back to a single line.

## Use when

- You hold the npm credentials and want 0.1.0 published. Follow Part A, then Part B.
- 0.1.0 is already published and the next version is due. Follow Part C.
- A defect needs fixing before 0.1.0 is published. Follow "Where a fix goes" below.

Do **not** use this for a prerelease under a dist-tag; `publish-0.1.0.md` refuses that without a decision record.

## The branch model

| Branch | Carries | Version it publishes |
|---|---|---|
| `release/0.1.0` | the six-phase program plus 0.1.0 fixes, folded into the 0.1.0 changelogs (no `.changeset/*.md`) | 0.1.0 |
| `main` | everything after 0.1.0: multimodal input (0034), provider fallback and local runtimes (0037), retrieval (0026), each with a changeset | the next version that `changeset version` computes |

**Where a fix goes before 0.1.0 is out.** A defect that 0.1.0 ships lands on `release/0.1.0` first, folded into the package's 0.1.0 changelog under "Patch Changes". Then merge `release/0.1.0` forward into `main`. Never cherry-pick from `main` back to the release line again: the history keeps one direction.

## Preconditions (once, before the first release)

- [ ] An npm account with 2FA enabled. `npm whoami` answers your user name.
- [ ] The org `@smolagents-ts` exists and belongs to that account: npmjs.com → your avatar → "Add Organization", name `smolagents-ts`, the free plan. Both names answered `E404` (unclaimed) on 2026-10-25.
- [ ] The unscoped name `smolagents-ts` is still free: `npm view smolagents-ts` answers `E404`.
- [ ] A granular access token with read-and-write on all packages, the `@smolagents-ts` scope selected, and "bypass 2FA" ticked. Put it in your **user** `~/.npmrc`, never in this repository:

      npm config set //registry.npmjs.org/:_authToken <token> --location=user

  Without the bypass, the publish stops on `EOTP` after some packages are already up.
- [ ] `gh auth status` succeeds, so the release note can be created. The web UI also works.
- [ ] Node 22 or later, and the pnpm version from `packageManager` in the root `package.json` (`corepack enable` provides it).

## Steps

### Part A — publish 0.1.0 from `release/0.1.0`

1. Switch to the release line and make sure it matches the remote:

       git fetch origin
       git switch release/0.1.0
       git status --porcelain
       git rev-parse HEAD origin/release/0.1.0
       # expect: no output from status, and the same sha twice

   If the branch has never been pushed: `git push -u origin release/0.1.0`.

2. Wait for CI on that sha. CI runs on pushes to `release/**`:

       gh run list --branch release/0.1.0 --limit 1
       # expect: completed, success, on the sha from step 1

3. Run `docs/10-runbooks/publish-0.1.0.md` from its step 1 to its step 9, on this branch, with one change at step 3. `.changeset/config.json` names `main` as the base branch, so a plain `changeset status` on this branch sees the 0.1.0 fixes as changes without a changeset and exits 1. Compare against the branch itself instead:

       pnpm changeset status --verbose --since=HEAD
       # expect: an empty "Packages to be bumped:" list (observed 2026-11-09)

   The bump is already applied, so steps 4 and 6 are skipped.

4. Push the tags that step 9 created, and the branch:

       git push --follow-tags origin release/0.1.0

   This replaces the runbook's step 10, which pushes `main`.

5. Run the runbook's step 11 (the GitHub release note) and its Verification section.

6. Record the run in the runbook: replace "never executed" in `publish-0.1.0.md` and in this file with the date, the step-9 output, and anything that differed. Commit that on `release/0.1.0` and push it.

### Part B — bring `main` back to one line

7. Merge the release line into `main`, keeping the merge visible:

       git switch main
       git pull --ff-only
       git merge --no-ff release/0.1.0 -m "chore(release): merge the 0.1.0 line -- T-14"

   Conflicts can appear only in `packages/*/CHANGELOG.md`. Keep both sides: 0.1.0's entries stay under `## 0.1.0`, and `main` has no newer heading yet.

8. Check that the next version is what you expect before anything moves:

       pnpm changeset status --verbose
       # expect: the six fixed-group packages at the next minor, plus any
       # independent package that has its own changeset

9. Run the gate, then push:

       pnpm install --frozen-lockfile && pnpm gate
       git push origin main

10. Close the line: `T-14` moves to done with the Verification output as evidence. Keep `release/0.1.0` for its tags; do not delete it.

### Part C — every later release, from `main`

11. Follow `publish-0.1.0.md` on `main` with every step: `pnpm release:version` applies the pending changesets, step 6 commits `chore(release): <version>`, and step 10 pushes `main` with its tags. Change the version in the step-11 release note.

12. A patch for an older line (for example 0.1.1 after 0.2.0 is out) uses the same pattern as Part A. Branch `release/0.1.x` from the `smolagents-ts@0.1.0` tag, add a changeset there, publish from it, and merge it forward into `main`.

## Verification

- `npm view smolagents-ts version` and `npm view @smolagents-ts/core version` answer the version you published.
- A fresh directory installs `smolagents-ts` and imports it, as in the runbook's Verification section.
- `git log --oneline -1 origin/main` is the Part B merge (or the Part C release commit), and its CI run is green.
- `git tag -l 'smolagents-ts@*'` lists the tag, and `gh release view smolagents-ts@<version>` shows the note.

## Rollback

Forward only, as in `publish-0.1.0.md`: `npm deprecate <name>@<version> "<reason>"` on every affected name, a fix on the line that published it, and a patch release. A Part B merge that went wrong before the push is undone with `git reset --hard origin/main`. After the push, revert it with `git revert -m 1 <merge sha>`.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| CI never ran on `release/0.1.0` | the branch was pushed before `ci.yml` listed `release/**` | push an empty commit, or open a draft PR from the branch, and wait for the run |
| `changeset status` on `release/0.1.0` exits 1, "no changesets were found" | it compared the branch with `main`, the configured base | run it with `--since=HEAD`, as in step 3 |
| `changeset status --since=HEAD` on `release/0.1.0` lists packages to bump | a changeset file reached the release line | fold its text into the 0.1.0 changelog and delete the file (decision `0035`) |
| step 8 shows 0.1.1 instead of the next minor | `main` has only patch changesets | correct: `main`'s multimodal changeset is a minor. If it is missing, the T-56 merge did not land |
| the tag already exists on the remote | a previous attempt tagged and failed to publish | see the runbook's last failure row; delete only a tag with no registry version behind it |
| everything else | — | the failure table in `publish-0.1.0.md` |
