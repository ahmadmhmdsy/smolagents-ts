# 10 — Runbook: publishing 0.1.0

- **Last verified:** never executed. Written 2026-10-14; amended 2026-10-21 by the
  release-identity change (the version bump, the `version:check` gate stage and the
  two version streams); amended 2026-10-25 by decision `0030` (the release gate,
  the token class, the recovery rule, the release-note step and the step-3
  expectation). Every step below is a hypothesis until the first run.
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

**Two version streams live at this root.** `VERSION` (currently 2.0.0) and the
root `CHANGELOG.md` belong to the context pack; `context-pack.json` records
`pack_version`, and `scripts/adopt.py` reads `VERSION` as the pack version.
The library's version is the eleven package manifests' `version`, and its
release notes are `packages/*/CHANGELOG.md`. A release commit changes the
second stream only; the root `VERSION` and `CHANGELOG.md` are never staged here.

## Preconditions

- [ ] The npm account owns the `@smolagents-ts` scope **and** the unscoped name
      `smolagents-ts`; both were verified unclaimed on 2026-10-14 and again on
      2026-10-25 (both answered `E404`), and the choice is recorded in decision
      0010. Claim them before the release: `npm whoami`, then create the org
      `@smolagents-ts` if it does not exist, and confirm the unscoped name is
      claimable.
- [ ] A token **that can publish without an interactive OTP** sits in the
      operator's own `~/.npmrc` as `//registry.npmjs.org/:_authToken=…` (a
      granular token with publish rights and 2FA bypass, or an automation
      token). It is **not** in this repository: a local secrets file is not pack
      surface, and `.env` is never read by this procedure. Without the bypass,
      `changeset publish` stops mid-way on `EOTP` and leaves a partial release.
- [ ] `git status --porcelain` is empty on `main`, `main` equals
      `origin/main`, and the tip's CI run is green. Push first if the release
      commit is still local; a green local gate is not a green CI run.
- [ ] Either at least one pending changeset exists under `.changeset/`, or the
      bump is already applied and reviewed in the tree (the 0.1.0 re-cut: no
      changesets remain, all eleven manifests and markers read 0.1.0).
- [ ] The gate is green on the exact revision being released (`pnpm gate`).
- [ ] Nothing else is building or testing in the same checkout.

## Steps

1. Confirm the exact revision being released:

       git rev-parse --short HEAD && git status --porcelain
       # expect: one short sha, then no output

2. Install exactly what the lockfile pins, then run the whole gate on that tree.
   The gate includes `pnpm version:check`, which fails if a package's exported
   `VERSION` literal disagrees with its manifest:

       pnpm install --frozen-lockfile
       pnpm gate
       # expect: exit 0

3. Read what the release will do before it does it:

       pnpm changeset status --verbose
       # expect: a fixed-group package appears only when a changeset names one of
       # the six (then all six move together); independent packages appear only
       # with their own changeset. When the bump is already applied (the 0.1.0
       # re-cut consumed the five v1-5 module changesets), the command prints an
       # empty "Packages to be bumped:" list — that is the expected state, not a
       # failure. Observed 2026-10-25; the earlier exit-1 expectation described a
       # state that no longer occurs here (decision 0030 corrects it).

4. Apply the bump — skip to step 5 when it is already applied. `commit: false`
   in `.changeset/config.json` means this writes the manifests, the CHANGELOGs
   and the `VERSION` markers, then stops:

       pnpm release:version
       # = changeset version && pnpm version:sync

   `pnpm version:sync` rewrites each `packages/*/src/version.ts` literal from
   its manifest, so the runtime value a consumer reads cannot drift from npm.

5. Review the bump before anything leaves the machine:

       git diff --stat && git diff packages/*/package.json
       node scripts/sync-versions.mjs --check
       # expect: exit 0, and every package the release names carries the same
       # new version. The fixed group shares one version by construction; the
       # CLI stays outside the group (decision 0013) even when, as on this first
       # release, it lands on the same 0.1.0.

6. Commit the release commit. Name the paths; do not use `git add -A`. For the
   0.1.0 re-cut the bump is already in its own reviewed commit, so this step
   applies to later releases:

       git add .changeset packages
       git commit -m "chore(release): 0.1.0"

   The bump touches `.changeset/`, `packages/*/package.json`,
   `packages/*/CHANGELOG.md` and `packages/*/src/version.ts`; that list is the
   whole release commit. Root `VERSION`, root `CHANGELOG.md`, the workflows and
   the scripts belong to ordinary commits, never to this one.

7. Rebuild and re-check the shape, because the bump rewrote every manifest:

       pnpm build && pnpm publint && pnpm attw && pnpm version:check

8. Inspect one tarball's manifest and its packaged version before the registry
   sees it. The workspace ranges must already be resolved versions, and the
   packaged `VERSION` must equal the new version:

       pnpm --filter @smolagents-ts/core pack --pack-destination .superpowers
       tar -xOf .superpowers/smolagents-ts-core-*.tgz package/package.json
       # expect: no "workspace:" anywhere, and a version that is not 0.0.0
       tar -xOf .superpowers/smolagents-ts-core-*.tgz package/dist/index.js | grep 'VERSION = "'
       # expect: the same version as the manifest

9. Publish, and let changesets create the tags:

       pnpm changeset publish

   changesets 3.0.3 reads `packageManager` from the root manifest and runs
   `pnpm publish` when it names pnpm (`getPublishPlan.mjs:349,563-586`), which
   is what rewrites `workspace:*` on the way out. If that line ever disappears,
   publish the rest with `pnpm -r publish` instead.

10. Push the commit and the tags together, then confirm CI on the pushed commit:

        git push --follow-tags origin main
        # the CI run on this sha must be green; Pages deploys the same commit

11. Create the release note from the facade tag, so the first thing a visitor
    reads says what 0.1.0 is:

        gh release create smolagents-ts@0.1.0 --title "0.1.0" --notes-file .superpowers/release-note-0.1.0.md

    The body carries two lines: 0.1.0 is the six-phase program (runtime, models,
    tools, executors, React layer, distribution), and the install line
    `npm install smolagents-ts`. The root `CHANGELOG.md` belongs to the context
    pack, so this release note is the only user-facing record of what the version
    contains (decision `0030`). Without `gh`, create it in the web UI from the
    same tag.

## Verification

The registry answers, and a consumer that has never seen this repository installs
the published entry point and reads the right version:

    npm view smolagents-ts version
    npm view @smolagents-ts/core version
    npm view @smolagents-ts/exec-pyodide version
    # expect: 0.1.0 from each

    mkdir /tmp/smolagents-consumer && cd /tmp/smolagents-consumer
    npm init -y && npm install smolagents-ts
    node -e "import('smolagents-ts').then(m => console.log(m.VERSION, Object.keys(m).length))"
    # expect: 0.1.0 and a non-zero key count, with no resolution error

    node -e "import('smolagents-ts/react').then(m => console.log(typeof m.AgentRun))"
    # expect: function — the facade subpaths resolve from the tarball

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

| Symptom                                                 | Cause                                                                    | Action                                                                                                         |
| ------------------------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `E403` / "you do not have permission"                   | the token lacks publish rights, or the scope is owned by another account | `npm whoami`, then `npm owner ls @smolagents-ts/core`; settle ownership before retrying                        |
| `EOTP` / "one-time password"                           | the token has no 2FA bypass and the registry wants an interactive OTP    | stop; create a granular token with publish rights and 2FA bypass (or an automation token), then re-run step 9   |
| publish stopped part-way                               | one name failed after others landed; the fixed group is now split        | re-run `pnpm changeset publish` (it skips versions already on the registry), then `npm view` every name; never bump mid-recovery |
| "cannot publish over the previously published versions" | the version already exists — often after a partial publish               | `pnpm changeset status`; add a changeset and bump only what did not land                                       |
| a tarball carries `workspace:*`                         | the publish tool was npm rather than pnpm                                | check `packageManager` in the root manifest, then publish the remainder with `pnpm -r publish --access public` |
| the six fixed-group packages are on different versions  | a manifest was hand-edited                                               | return to a clean tree and run `pnpm changeset version && pnpm version:sync` again                             |
| a packaged `VERSION` reports 0.0.0                      | the marker was not synced before the build                               | `pnpm version:sync`, rebuild, re-pack; the gate's `version:check` should have caught it before the build       |
| the gate fails after the bump                           | the new version changed a snapshot or a size assertion                   | fix it and re-run the gate; never publish a red tree                                                           |
| a tag exists with no registry counterpart               | the publish failed after tagging                                         | `git tag -l '*-0.1.0'`, then delete only the tag with no published version behind it                           |

## Notes

- `.changeset/config.json` holds `access: public`, `baseBranch: main` and
  `updateInternalDependencies: patch`; the fixed group is the six names listed
  there, and it is the reason they cannot be released one at a time.
- The five internal packages stay implementation rather than first-class
  (decision 0014): they are on the registry because the facade's declarations
  name them, not because they are the documented entry point.
- The CLI is deliberately outside the fixed group (decision 0013), so a CLI-only
  release does not move the runtime.
- `scripts/sync-versions.mjs` is the only writer of the exported `VERSION`
  constants: `changeset version` rewrites manifests and changelogs but not the
  markers, and no release workflow edits the source. Run it through
  `pnpm release:version` (bump) or `pnpm version:check` (verify).
- The first operator to run this must replace the "never executed" line above
  with the date, the exact output of step 9, and anything that differed from
  these steps. That evidence is a deliverable, not a footnote: it is what makes
  the next release cheaper than this one (decision `0030`).
