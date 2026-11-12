# 10 — Runbook: the live provider smoke

**Contract**
- **Role:** the procedure that proves one adapter still works against the real
  provider, outside the fixture suite.
- **Mutability:** rewrite in place when the script's checks or its environment
  variable change.
- **Read when:** after an adapter change, before a release, or when a provider
  moves and the fixtures cannot say whether the wire format still holds.
- **Update when:** a check is added or removed, the key's variable name changes, or a local
  runtime preset's default address changes.

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

    # expect, in order: four "ok" lines and a final "live-smoke OK (<model>)"
    # expect, without the key: "live-smoke SKIPPED: GOOGLE_API_KEY is not set" and exit 0
    echo $LASTEXITCODE

Last recorded run: 2026-11-13, `gemini-3.5-flash-lite`, the four checks ok and
exit 0: the streamed check reported usage, the `CodeAgent` run reached the
executor once and answered `4`, and the `ToolCallingAgent` run called its tool
once and was priced from the shipped table.

## Rollback

Nothing is written outside the process: the script makes a handful of provider calls,
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
| the tool check fails with an HTTP 400 | the provider rejected the tool schema, or a replayed call lost its `thoughtSignature` | check `toWireTools` and the signature round trip in the Gemini adapter |
| the tool check says the run was not priced | no row in `DEFAULT_PRICE_TABLE` matches the adapter's provider and model | add or correct the row in `packages/core/src/monitoring/pricing.ts` |

## Local runtimes

The four presets (`ollamaModel`, `lmStudioModel`, `llamaCppModel`, `vllmModel`)
are tested against the OpenAI fixture only. This check calls a runtime that is
already running on this host. The script starts no server, and it needs no key.

1. Start the runtime yourself and load a model, for example `ollama serve`
   and then `ollama pull qwen3:8b`. Each preset's default address:

   | `LOCAL_RUNTIME` | preset | default address |
   |---|---|---|
   | `ollama` | `ollamaModel` | `http://localhost:11434/v1` |
   | `lm-studio` | `lmStudioModel` | `http://localhost:1234/v1` |
   | `llama-cpp` | `llamaCppModel` | `http://localhost:8080/v1` |
   | `vllm` | `vllmModel` | `http://localhost:8000/v1` |

2. Build, then run the check. `LOCAL_MODEL` names a model the server serves;
   llama.cpp answers with whatever model it loaded, so it may be left out there.
   `LOCAL_BASE_URL` overrides the address, and `LOCAL_API_KEY` is sent only
   when set:

       pnpm build
       LOCAL_RUNTIME=ollama LOCAL_MODEL=qwen3:8b pnpm local:smoke

**Verification:**

- With a server, expect two "ok" lines and then `local-smoke OK (<runtime>, <model>)`.
- With no server at the address, expect `local-smoke SKIPPED: no <runtime> server answered` and exit 0.
- When something else answers at the address, the script reports FAILED with
  that server's HTTP error and exits 1. On 2026-11-09 this happened on the
  owner's machine, where an unrelated HTTPS server held port 8000; set
  `LOCAL_BASE_URL` to the runtime's real address.

**Why a check can fail:**

- A preset reports tool calls only where the runtime parses them without extra
  flags: Ollama and LM Studio do. llama.cpp needs `--jinja`, and vLLM needs
  `--enable-auto-tool-choice` with a `--tool-call-parser`. Claim them through
  `capabilities` once the server runs with those flags.
- Images and audio are off in every preset, because they depend on the model
  loaded and not on the runtime.

No live run against a local runtime has been recorded yet.

## Notes

- The four checks are: a non-streamed completion, a streamed completion with
  usage, one live `CodeAgent` run through the QuickJS executor that must
  reach the executor at least once, and one live `ToolCallingAgent` run that
  must call its tool, finish a second turn after the call, and be priced.
- A failure here does not fail the gate. The gate never runs this script, because
  the gate must stay credential-free.
