# 02 — Environment

**Contract**
- **Role:** verified facts about the machine and toolchain.
- **Mutability:** verified facts. Record what is, never what you intend.
- **Read when:** before running anything.
- **Update when:** any machine, toolchain, version, credential location, or
  service change.

**Rule:** every fact here MUST state how it was verified and when. A guessed
version is worse than a missing one, because it is trusted.

---

## How to verify

Run these from the repository root. Each fact below names the command that
re-derives it.

    # operating system, architecture, cpu, memory, disk
    (Get-CimInstance Win32_OperatingSystem).Caption
    (Get-CimInstance Win32_OperatingSystem).Version
    $env:PROCESSOR_ARCHITECTURE
    (Get-CimInstance Win32_Processor).NumberOfLogicalProcessors
    (Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory
    Get-PSDrive E
    nvidia-smi --query-gpu=name --format=csv,noheader

    # toolchain
    node --version
    pnpm --version
    pnpm exec tsc --version
    pnpm exec tsup --version
    pnpm exec vitest --version
    pnpm exec eslint --version
    pnpm exec depcruise --version
    pnpm exec publint --version
    pnpm exec attw --version
    pnpm exec prettier --version
    git --version
    python --version

    # dependencies, from the lockfile
    pnpm install --frozen-lockfile

    # the docs site's runtime dependency
    pnpm --filter docs-site why marked

## Machine

Every row was re-derived at the same instant, 2026-10-13T18:47:31+03:00.

| Fact | Value | Verified by | Last verified |
|---|---|---|---|
| Operating system | Microsoft Windows 11 Pro, version 10.0.26200 | `(Get-CimInstance Win32_OperatingSystem).Caption` and `.Version` | 2026-10-13T18:47:31+03:00 |
| Architecture | x64 (AMD64) | `$env:PROCESSOR_ARCHITECTURE` | 2026-10-13T18:47:31+03:00 |
| CPU / cores | Intel Core i7-10850H at 2.70 GHz, 12 logical processors | `(Get-CimInstance Win32_Processor).NumberOfLogicalProcessors` | 2026-10-13T18:47:31+03:00 |
| Memory | 47.6 GB physical | `(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory` | 2026-10-13T18:47:31+03:00 |
| Disk (free / total) | 19.4 GB free of 195.3 GB on `E:` | `Get-PSDrive E` | 2026-10-13T18:47:31+03:00 |
| GPU / accelerator | NVIDIA Quadro RTX 3000, idle for this project; no gate stage touches it | `nvidia-smi --query-gpu=name --format=csv,noheader` | 2026-10-13T18:47:31+03:00 |

## Toolchain

| Tool | Version | Verified by | Notes |
|---|---|---|---|
| Node.js runtime | v24.18.0 | `node --version` | `engines` requires 22.12 or newer; CI runs 22, 24 and 26. The E2B subpath of `@smolagents-ts/exec-remote` enforces a higher floor of 22.19.0 at construction and refuses with a typed error below it, so a consumer on 22.12 satisfies the manifest and is still refused by that backend |
| pnpm package manager | 12.3.4 | `pnpm --version` | lockfile kind: `pnpm-lock.yaml`; the `packageManager` field in `package.json` is canonical and `scripts/check-ci.mjs` fails when the workflow disagrees; a release-age quarantine is on by default and is a behaviour rather than a surfaced setting, so `pnpm config get minimumReleaseAge` answers `undefined` on a machine where it is plainly active (decision 0017). Measured on this machine on 2026-10-14: `pnpm config get minimumReleaseAge` printed `undefined` while the exact-version exclusions pnpm had written into `pnpm-workspace.yaml` were in force |
| TypeScript | 6.0.3 | `pnpm exec tsc --version` | `strict` plus `noUncheckedIndexedAccess` |
| Build tool | tsup 8.5.1 | `pnpm exec tsup --version` | one `tsup.config.ts` per package |
| Test runner | Vitest 5.0.3 | `pnpm exec vitest --version` | projects resolved from `packages/*`, `examples/*` and `apps/*` |
| Markdown renderer | marked 18.1.1 | `pnpm --filter docs-site why marked` | the `docs-site` app's only dependency; MIT, no transitive dependencies, declared `^18.0.0` |
| Linter | ESLint 10.12.0 | `pnpm exec eslint --version` | configuration in `eslint.config.js` |
| Architecture check | dependency-cruiser 18.5.0 | `pnpm exec depcruise --version` | rule set in `.dependency-cruiser.cjs` |
| Package shape check | publint 0.3.25 and attw 0.18.5 | `pnpm exec publint --version`; `pnpm exec attw --version` | both run inside the gate, after the build |
| Formatter | Prettier 3.9.10 | `pnpm exec prettier --version` | installed; no gate stage calls it |
| Git | 2.47.1.windows.1 | `git --version` | the adoption branch is `context-pack-adoption` |
| Python | 3.13.7 | `python --version` | the context-pack scripts under `scripts/` use it, and so does the remote-executor package's process suite, which spawns a real interpreter — `python` on Windows, `python3` elsewhere; the gate therefore needs an interpreter on `PATH`, and the GitHub runner images supply one |

## Services and ports

| Service | Where | Port | Started by |
|---|---|---|---|
| none | everything the build, the tests and the gate do runs in-process, apart from the loopback listener below | — | — |
| loopback Jupyter stand-in | the `exec-remote` suite binds `127.0.0.1` on an ephemeral port and speaks the kernel-gateway subset to it over the loopback interface | ephemeral, chosen by the operating system | `packages/exec-remote/test/ws-server.ts` |

No daemon and no external service is opened by a build, a test run or the gate.
The only socket any test opens is the `exec-remote` suite's own loopback
listener, and that traffic never leaves this host.

## Credentials

Never record values here. Record only the **name**, the **location**, and the
**scope** required.

| Variable | Required for | Where it lives | Committed? |
|---|---|---|---|
| `GOOGLE_API_KEY` | the live provider smoke and any live Gemini run — never the gate, the tests or the build | the gitignored `.env` at the repository root, loaded with `node --env-file=.env` | no |
| none | the gate, the tests and the build all run offline | not applicable | no |

The gate needs no credential. A live call needs `GOOGLE_API_KEY`, which lives
only in the gitignored `.env` and is read from the environment by
`scripts/live-smoke.mjs`, which never prints it. Every further provider variable
is recorded here by name and location before its first live call, and never by
value.

## Network and access

The gate is offline: `pnpm install --frozen-lockfile` needs the npm registry
once, and CI needs GitHub, but nothing in the build or the test run reaches an
external network. The `exec-remote` suite opens its own loopback listener and
connects to it over `127.0.0.1`; that traffic never leaves this host. Two gitignored trees at the repository root, `smolagents/` and
`reference/`, are read-only local clones kept for upstream comparison; neither
is committed and neither is part of the project's own surface.

## Capabilities and limits

- **Can:** run the full gate offline on Windows, including the pack-and-install
  smoke test that writes tarballs into a temporary consumer.
- **Cannot:** run the Bun or Deno legs of the runtime matrix locally, because
  neither runtime is installed on this machine.
- **Workarounds in use:** Node stands in for every runtime while iterating, so
  the Bun and Deno legs are verified only by CI; a green local gate is not by
  itself evidence for that matrix.

## Rebuild recipe

The exact sequence to rebuild this environment from nothing.

    # 1. install Node 22.12+ and enable the package manager
    corepack enable

    # 2. clone, then install exactly what the lockfile pins
    git clone <remote> smolagents_ts
    cd smolagents_ts
    pnpm install --frozen-lockfile

    # 3. no environment variables are needed; skip to verification

    # 4. verify
    pnpm gate
    python scripts/validate_context.py --root .

## Known environmental hazards

- `pnpm gate` is not read-only: it writes `dist/` in each package and a
  throwaway consumer directory under the system temp folder.
- Vitest discovers its projects from `packages/*`, `examples/*` and `apps/*`, so a
  new package or app directory with no `vitest.config.ts` is silently tested by
  nobody.
- A checkout with `core.autocrlf=true` stores CRLF on disk while the pack's byte
  caps count LF-normalized bytes, so the validator here and CI agree only if
  files are committed with LF endings.
- The vendored `reference/` tree contains a directory whose name ends in
  `agents.md`, which makes a naive recursive reader raise instead of read; the
  local pack patch keeps the validator out of that tree.
- Recursive directory listings over this repository are slow enough to time out
  a two-minute shell command, because the ignored trees are large; scope a walk
  to the directory you need.

## Verification log

Append-only.

| Date | What was verified | How | Result |
|---|---|---|---|
| 2026-10-13 | the machine and toolchain facts above | the commands in How to verify | the values recorded above |
| 2026-10-13 | the full gate at commit e4e4b5a | `pnpm gate` from the repository root | exit 0; 31 test files and 277 tests passed; 85 modules and 173 dependencies cruised; publint clean on five packages |
| 2026-10-13 | per-package test counts | `pnpm vitest run --project <id>` for each of the five packages | core 27 files / 273 tests, the other four 1 test each |
| 2026-10-13 | the full gate after S2a | `pnpm gate` from the repository root | exit 0; 38 test files and 319 tests passed; 94 modules and 200 dependencies cruised; `pack-smoke OK` on five tarballs |
| 2026-10-14 | the docs site app and its dependency | `pnpm --filter docs-site why marked` | marked 18.1.1, the only dependency of `docs-site` |
| 2026-10-14 | the full gate at commit a41578f | `pnpm gate` from the repository root | exit 0; 86 test files and 634 tests passed; 205 modules and 517 dependencies cruised; publint clean on eight packages; the site built 60 pages |
| 2026-10-14 | the MCP package's own suite | `pnpm vitest run --project mcp` | 9 files and 106 tests passed |
| 2026-10-14 | the full gate with `exec-pyodide` | `pnpm gate` from the repository root | exit 0; 95 test files and 689 tests passed; 227 modules and 566 dependencies cruised; publint clean on nine packages; the site built 65 pages |
| 2026-10-14 | the Pyodide package's own suite | `pnpm vitest run --project exec-pyodide` | 9 files and 55 tests passed |
| 2026-10-14 | the remote-executor package's own suite | `pnpm vitest run --project exec-remote` | 11 files and 57 tests passed |
| 2026-10-14 | the live process path, outside the suite | `node scripts/exec-remote-smoke.mjs process` | five checks ok, 334 ms, exit 0; the Docker and E2B paths were attempted and failed for want of a daemon and a credential |
| 2026-10-14 | the Pyodide browser cold start and bundle | the scratch Vite page in `docs/10-runbooks/exec-pyodide-browser-probe.md` | 2,912 ms from headless Chrome against the jsDelivr v314.0.7 base; the page's own bundle is 29,375 B with the runtime external |
| 2026-10-14 | the react package's own suite after L4 | `pnpm vitest run --project react` | 10 files and 46 tests passed |
| 2026-10-14 | the styled package's own suite | `pnpm vitest run --project react-ui` | 4 files and 19 tests passed |
| 2026-10-14 | the full gate with L4 and L5 | `pnpm gate` from the repository root | exit 0; 112 test files and 793 tests passed; 278 modules and 708 dependencies cruised; publint clean on eleven packages; `pack-smoke OK` on eleven packages; the site built 69 pages |
| 2026-10-14 | the styled package's suite after the probe test | `pnpm vitest run --project react-ui` | 5 files and 22 tests passed |
| 2026-10-14 | the full gate at the L4/L5 close | `pnpm gate` from the repository root | exit 0; 113 test files and 796 tests passed; 279 modules and 712 dependencies cruised; publint clean on eleven packages; `pack-smoke OK` on eleven packages; the site built 70 pages |
| 2026-10-14 | the full gate after the capability fix and the example's resolver guard | `pnpm gate` from the repository root | exit 0; 114 test files and 800 tests passed; 279 modules and 712 dependencies cruised; publint clean on eleven packages; `pack-smoke OK` on eleven packages; the site built 70 pages |
| 2026-10-14 | the CI typecheck stage's own condition, with no build output | all twelve `packages/*/dist` and `apps/*/dist` directories moved away, then `pnpm typecheck` | exit 0. This is the check that catches a resolver config pointing at `dist/`: the local gate runs after a build and cannot see the defect, and the `CI` workflow runs this stage before its build, which is how it was found |
| 2026-10-14 | the four new runnable examples | `pnpm vitest run --project example-multi-step --project example-tool-calling --project example-events --project example-live-provider` | 4 files and 5 tests passed |
| 2026-10-14 | the pack smoke's end-to-end run, not just its imports | `node scripts/pack-smoke.mjs` | `pack-smoke OK: 11 packages installed and imported; the cli bin ran; pack-smoke run OK: Hello, world!` |
| 2026-10-14 | the workspace's project set against a frozen lockfile | `pnpm install --frozen-lockfile` after four example projects were added | exit 0, `Lockfile is up to date` |
| 2026-10-14 | the published browser demo still serves | `Invoke-WebRequest -Method Head` on the Pages example URL | HTTP 200, 431 bytes, `<div id="root">`, one JS and one CSS asset |
| 2026-10-14 | the full gate after the pre-publish pass | `pnpm gate` from the repository root | exit 0; 119 test files and 809 tests passed; 281 modules and 718 dependencies cruised; eleven packages packed and installed, the run printing `pack-smoke run OK: Hello, world!`; site built at 70 pages |
| 2026-10-14 | the root test command after the projects glob was narrowed to config files | `pnpm vitest run --project core --project react` | exit 0; 41 test files and 347 tests passed |
