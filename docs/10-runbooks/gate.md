# 10 — Runbook: the quality gate

**Contract**
- **Role:** the procedure that proves a change is good enough to commit.
- **Mutability:** rewrite in place when a stage changes.
- **Read when:** before committing, and before reporting a green result.
- **Update when:** a stage is added, removed, renamed or reordered.

**Why this file exists:** the gate is eleven stages chained by `&&`, so it stops at
the first failure and says nothing about the ten after it. Knowing the order
turns a red result into a location.

---

## Preconditions

- Node.js 22.12 or newer, and pnpm 12.3.4, both on `PATH`.
- Dependencies installed from the lockfile: `pnpm install --frozen-lockfile`.
- A clean working tree, or a conscious decision to gate dirty state.
- Nothing else: the gate needs no credential and no network beyond the install.

## Steps

    # from the repository root
    pnpm gate

The chain is `scripts.gate` in `package.json`, and it is the same one CI runs:

1. `pnpm typecheck` — all thirteen workspace projects (eleven packages, the
   Vite example app and the docs site), TypeScript with `strict`.
2. `pnpm version:check` — every package's exported `VERSION` literal equals its
   `package.json` version.
3. `pnpm lint` — ESLint, including the restricted-import boundary rules.
4. `pnpm depcruise` — dependency-cruiser architecture rules.
5. `pnpm test` — Vitest across every `packages/*` project.
6. `pnpm build` — tsup, one config per package.
7. `pnpm publint` — package-shape check on each package.
8. `pnpm attw` — Are The Types Wrong, with `--profile esm-only`.
9. `pnpm ci:check` — proves the workflow still runs these stages.
10. `pnpm pack:smoke` — packs, installs into a throwaway consumer, imports every
    published entry point.
11. `pnpm site:build` — builds the Vite example app and the static docs site.

## Verify

The exit code is the result. Nothing else is.

    # PowerShell
    pnpm gate; $LASTEXITCODE

    # POSIX shell
    pnpm gate; echo $?

To keep a log for the report:

    pnpm gate *>&1 | Tee-Object -FilePath .superpowers/gate-output.txt

A healthy tree returns exit code 0, with every test file and test passing, eleven
packages built, and publint clean on eleven packages. Measured on 2026-10-21 at
commit `48cf29d`: exit 0 with 127 test files and 855 tests.

## Rollback

The gate changes no source file. It writes `dist/` inside each package and a
temporary consumer directory under the system temp folder. To undo a build:

    git clean -fd packages/cli/dist packages/core/dist packages/exec-pyodide/dist packages/exec-quickjs/dist packages/exec-remote/dist packages/mcp/dist packages/models/dist packages/react/dist packages/react-ui/dist packages/smolagents-ts/dist packages/tools/dist

Do not reach for `git clean -fdx`: `-x` also removes the ignored vendored
trees, which are expensive to re-clone.

## Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `ci:check` reports a stage mismatch | the workflow file and `scripts.gate` disagree | edit the workflow, because `package.json` is canonical |
| `pack:smoke` fails while `build` passed | a published entry point does not resolve from a consumer | read the smoke log; it names the tarball and the import that failed |
| `attw` fails for one package only | the export map in that package's `package.json` | fix the export map, then re-run the gate |
| `test` discovers fewer files than expected | a package directory with no `vitest.config.ts` | add the config; the project list is `packages/*` |

## Last executed

2026-10-21, on this machine, at commit `48cf29d` on a tree that carried the two
then-uncommitted document edits, exit code 0 — a ten-stage chain, before
`version:check` was added. The full result is recorded in
`docs/reports/2026-10-21-full-project-review.md`. The four review-fix merges that
followed (`e2c18fa`, `c5c4f5a`, `3c8d776`, `b323ae6`) and the release-version work
have not been gated as one tree yet, so the first green run of the eleven-stage
chain is still to be recorded here.
