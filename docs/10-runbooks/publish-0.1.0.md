# 10 — Runbook: publishing 0.1.0

- **Last verified:** never executed. Written 2026-10-14 by this session; no registry
  credentials exist, so every step below is a hypothesis until the first run.
- **Estimated duration:** 20–30 minutes, plus the registry's propagation delay.
- **Risk:** high — a published version is immutable. npm refuses to unpublish a
  version older than 72 hours, and refuses outright once anything depends on it.
- **Reversible:** no — the only correction is a new patch version plus a
  `deprecate` on the bad one.

**Contract**
- **Role:** the procedure that turns a green `main` into published packages, and the rule for what a release commit contains.
- **Mutability:** rewrite in place when the changeset configuration, the publish tool or the package list changes.
- **Read when:** the owner has supplied registry credentials, or a release is due.
- **Update when:** a step here stops matching what `changeset publish` actually does, or the first real run differs.

**Why this file exists:** the release is the one irreversible action this project takes, and the fixed version group means a partial release cannot be repaired one package at a time. Written before the first publish because the first publish is the worst time to improvise.

---

## Purpose

Put the workspace's publishable packages on the npm registry at 0.1.0, in the one
order the fixed version group allows.

## Use when

Use it when the owner has supplied registry credentials and wants 0.1.0 (or the
next release) on npm. It is also the procedure for every later release: the
version in the title is the first one, not the only one.

Do **not** use it for a prerelease under a dist-tag, and do **not** start it from
a tree whose gate is red or whose `main` is behind `origin`.

## Preconditions

- [ ] The npm account owns the `@smolagents-ts` scope **and** the unscoped name
      `smolagents-ts`; both were verified unclaimed on 2026-10-14 and the choice
      is recorded in decision 0010.
- [ ] A token with publish rights sits in the operator's own `~/.npmrc` as
      `//registry.npmjs.org/:_authToken=…`. It is **not** in this repository: a
      local secrets file is not pack surface, and `.env` is never read by this
      procedure.
- [ ] `git status --porcelain` is empty on `main`, and `main` equals
      `origin/main`.
- [ ] At least one pending changeset exists under `.changeset/`; a package with
      no changeset is not released.
- [ ] Nothing else is building or testing in the same checkout.

## Steps

1. Confirm the exact revision being released:

       git rev-parse --short HEAD && git status --porcelain
       # expect: one short sha, then no output

2. Install exactly what the lockfile pins, then run the whole gate on that tree:

       pnpm install --frozen-lockfile
       pnpm gate
       # expect: exit 0

3. Read what the release will do before it does it:

       pnpm changeset status --verbose
       # expect: the six fixed-group packages move together, and only the
       # independent packages that carry a changeset appear

4. Apply the version bump. `commit: false` in `.changeset/config.json` means
   this writes the manifests and the CHANGELOGs and stops:

       pnpm changeset version

5. Review the bump before anything leaves the machine:

       git diff --stat && git diff packages/*/package.json
       # expect: @smolagents-ts/core, models, tools, exec-quickjs, react and
       # smolagents-ts share one version; packages/cli keeps its own line
       # (decision 0013); every other package changes only if it had a changeset

6. Commit the release commit. Name the paths; do not use `git add -A`:

       git add .changeset packages CHANGELOG.md
       git commit -m "chore(release): 0.1.0"

7. Rebuild and re-check the shape, because the bump rewrote every manifest:

       pnpm build && pnpm publint && pnpm attw

8. Inspect one tarball's manifest before the registry sees it. The workspace
   ranges must already be resolved versions:

       pnpm --filter @smolagents-ts/core pack --pack-destination .superpowers
       tar -xOf .superpowers/smolagents-ts-core-*.tgz package/package.json
       # expect: no "workspace:" anywhere, and a version that is not 0.0.0

9. Publish, and let changesets create the tags:

       pnpm changeset publish

   changesets 3.0.3 reads `packageManager` from the root manifest and runs
   `pnpm publish` when it names pnpm (`getPublishPlan.mjs:569–577`, and the
   spawn at `:349`), which is what rewrites `workspace:*` on the way out. If
   that line ever disappears, publish the rest with `pnpm -r publish` instead.

10. Push the commit and the tags together:

        git push --follow-tags origin main

## Verification

The registry answers, and a consumer that has never seen this repository installs
the published entry point:

    npm view smolagents-ts version
    npm view @smolagents-ts/core version
    npm view @smolagents-ts/exec-pyodide version
    # expect: 0.1.0 from each

    mkdir /tmp/smolagents-consumer && cd /tmp/smolagents-consumer
    npm init -y && npm install smolagents-ts
    node -e "import('smolagents-ts').then(m => console.log(Object.keys(m).length))"
    # expect: a non-zero key count and no resolution error

## Rollback

**A published version cannot be withdrawn.** Inside 72 hours `npm unpublish`
may still work for a name nothing depends on, but the fixed group moves six
packages together and any one of them being depended on blocks the rest. The
honest rollback is forward:

1. Deprecate the bad version on every published name:
   `npm deprecate <name>@0.1.0 "<reason>"`.
2. Fix the defect on `main` and cut a patch release through this same runbook.
3. Do not move or delete the git tag. A tag that disagrees with the registry is
   worse than a bad release, and it is what makes the next release ambiguous.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `E403` / "you do not have permission" | the token lacks publish rights, or the scope is owned by another account | `npm whoami`, then `npm owner ls @smolagents-ts/core`; settle ownership before retrying |
| "cannot publish over the previously published versions" | the version already exists — often after a partial publish | `pnpm changeset status`; add a changeset and bump only what did not land |
| a tarball carries `workspace:*` | the publish tool was npm rather than pnpm | check `packageManager` in the root manifest, then publish the remainder with `pnpm -r publish --access public` |
| the six fixed-group packages are on different versions | a manifest was hand-edited | return to a clean tree and run `pnpm changeset version` again |
| the gate fails after the bump | the new version changed a snapshot or a size assertion | fix it and re-run the gate; never publish a red tree |
| a tag exists with no registry counterpart | the publish failed after tagging | `git tag -l '*-0.1.0'`, then delete only the tag with no published version behind it |

## Notes

- `.changeset/config.json` holds `access: public`, `baseBranch: main` and
  `updateInternalDependencies: patch`; the fixed group is the six names listed
  there, and it is the reason they cannot be released one at a time.
- The five internal packages stay implementation rather than first-class
  (decision 0014): they are on the registry because the facade's declarations
  name them, not because they are the documented entry point.
- The CLI is deliberately outside the fixed group (decision 0013), so a CLI-only
  release does not move the runtime.
- The first operator to run this must replace the "never executed" line above
  with the date, the exact output of step 9, and anything that differed from
  these steps.
