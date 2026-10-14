# 10 — Runbook: the live provider smoke

**Contract**
- **Role:** the procedure that proves one adapter still works against the real
  provider, outside the fixture suite.
- **Mutability:** rewrite in place when the script's checks or its environment
  variable change.
- **Read when:** after an adapter change, before a release, or when a provider
  moves and the fixtures cannot say whether the wire format still holds.
- **Update when:** a check is added or removed, or the key's variable name changes.

**Why this file exists:** every unit test in this repository drives an injected
fetch against a recorded fixture, so nothing in the gate reaches a provider. This
is the one procedure that does, and it is the only one that needs a credential.

---

## Preconditions

- Node.js 22.12 or newer, and pnpm 12.3.4, both on `PATH`.
- Dependencies installed: `pnpm install --frozen-lockfile`.
- A built tree: the script imports the packages' `dist` entries, so run
  `pnpm build` first.
- The key in the environment under the name the script reads. The script never
  prints it, and it exits 0 with a SKIPPED line when the variable is absent, so a
  machine without a credential is not a failure.
- Nothing else is running that would rebuild the packages underneath it.

## Steps

1. Build every package, from the repository root:

       pnpm build

2. Put the key in the environment for this shell only. The value is never echoed.
   Node can read the file itself, which is the shortest path and the one that was
   last verified; the shell forms are for when the script is run another way:

       node --env-file=.env scripts/live-smoke.mjs

       # bash
       set -a; . ./.env; set +a
       # PowerShell
       Get-Content .env | ForEach-Object { if ($_ -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') { $n=$matches[1]; $v=$matches[2].Trim().Trim('"').Trim("'"); Set-Item -Path ("env:" + $n) -Value $v } }

3. Run the smoke. The default model is `gemini-3.5-flash-lite`; `GEMINI_MODEL`
   overrides it:

       pnpm live:smoke
       GEMINI_MODEL=gemini-2.5-flash pnpm live:smoke

## Verification

    # expect, in order: three "ok" lines and a final "live-smoke OK (<model>)"
    # expect, without the key: "live-smoke SKIPPED: GOOGLE_API_KEY is not set" and exit 0
    echo $LASTEXITCODE

Last recorded run: 2026-10-14, `gemini-3.5-flash-lite`, the three checks ok and
exit 0, with the streamed check reporting usage and the agent run reaching the
executor once and answering `4`.

## Rollback

Nothing is written outside the process: the script makes three provider calls,
prints their text, and exits. The only cost is the calls themselves.

1. Stop the script. No state to undo.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `SKIPPED: ... is not set` and exit 0 | the key never reached the process environment | re-run step 2 in the same shell as step 3 |
| a model-not-found error naming the model | the model id does not exist for this account | set `GEMINI_MODEL` to an id the account serves |
| a 401 or 403 | the key is absent, revoked or not enabled for the API | the owner reissues it; the script cannot |
| the streaming check fails on usage | the adapter stopped reading the provider's usage field | check the adapter's streamed payload and its fixture test |
| `Cannot find module .../dist/index.js` | the packages were not built | run step 1 |

## Notes

- The three checks are: a non-streamed completion, a streamed completion with
  usage, and one live `CodeAgent` run through the QuickJS executor that must
  reach the executor at least once.
- A failure here does not fail the gate. The gate never runs this script, because
  the gate must stay credential-free.
