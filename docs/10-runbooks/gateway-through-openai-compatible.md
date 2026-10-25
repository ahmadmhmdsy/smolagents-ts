# 10 — Runbook: an OpenAI-compatible gateway

**Contract**
- **Role:** the procedure that points the OpenAI-compatible adapter at one
  gateway a reader runs themselves, and proves the path end to end.
- **Mutability:** rewrite in place when the script's checks, its environment
  variables or the gateway's flags change.
- **Read when:** a reader asks how to use a local gateway or proxy, or an
  adapter change needs a form the fixture suite cannot reach.
- **Update when:** a check is added or removed, or the example's variables change.

**Why this file exists:** `OpenAICompatibleModel` already speaks the
chat-completions wire, so a gateway is a base URL and a model id rather than code.
The fixture suite pins the four frames a gateway adds, but only a real gateway
shows the routing, the auth mode and the browser's CORS decision in one place.

---

## Preconditions

- Node.js 22.12 or newer, and pnpm 12.3.4, both on `PATH`.
- Dependencies installed: `pnpm install --frozen-lockfile`.
- A built tree: the example imports the packages' `dist` entries, so run
  `pnpm build` first.
- A gateway serving the OpenAI chat-completions shape on a known base URL, with
  at least one model id visible. The Windows reference in
  [docs/research/2026-10-21-omniroute-gateway-support.md](../research/2026-10-21-omniroute-gateway-support.md)
  serves `http://localhost:20128/v1`; any endpoint that copies the format works
  the same way (LiteLLM, Portkey, a local llama.cpp server, a hosted proxy).
- A key only when the gateway requires one. While the gateway runs with
  `REQUIRE_API_KEY=false` it accepts no key at all, so it **must stay bound to
  localhost**: an open unauthenticated proxy is someone else's free model.
- Nothing else running that would rebuild the packages underneath the example.

## Steps

1. Build every package, from the repository root:

       pnpm build

2. Discover the model ids the gateway serves. Never guess one:

       # bash
       curl -s http://localhost:20128/v1/models
       # PowerShell
       (Invoke-RestMethod http://localhost:20128/v1/models).data | Select-Object -ExpandProperty id

   A discovery call lists whatever the gateway can route to. Pick one id and keep
   it: **the model id is the determinism boundary.** `auto` lets the gateway
   route per request, so a rerun can reach a different upstream and produce a
   different answer for the same prompt. Pin the id in `OMNIROUTE_MODEL` when a
   run must be reproducible.

3. Point the adapter at the gateway for this shell only. The key is never echoed.

       # bash
       export OMNIROUTE_BASE_URL=http://localhost:20128/v1
       export OMNIROUTE_MODEL=<one-id-from-step-2>
       export OMNIROUTE_API_KEY=<key, only if the gateway requires one>

       # PowerShell
       $env:OMNIROUTE_BASE_URL = "http://localhost:20128/v1"
       $env:OMNIROUTE_MODEL     = "<one-id-from-step-2>"
       $env:OMNIROUTE_API_KEY   = "<key, only if required>"

4. Run the example. It makes one plain completion, one streamed completion and
   one `CodeAgent` run in the QuickJS sandbox through the same adapter:

       pnpm --filter example-gateway run start

5. Run the same path through the CLI, which is how a gateway is reached without
   writing code. `--api-key` is only needed when the gateway requires one:

       node packages/cli/dist/main.js --model-type OpenAIModel \
         --api-base http://localhost:20128/v1 --model-id <one-id-from-step-2> \
         "What is 17 times 23?"

## Verification

    # expect, in order: a "gateway:" line naming the base URL and model, a
    # "generate:" line, a "stream:" line, an "agent:" line answering 4
    pnpm --filter example-gateway run start

    # expect, without OMNIROUTE_BASE_URL: "gateway SKIPPED: OMNIROUTE_BASE_URL is not set"
    # and exit code 0, so a machine with no gateway is not a failure
    Remove-Item Env:OMNIROUTE_BASE_URL; pnpm --filter example-gateway run start; echo $LASTEXITCODE

    # expect the key to appear nowhere in either output, even when the gateway
    # quotes it back in an error message

Last recorded run: never executed against a live gateway. The wire shapes are
pinned instead by `packages/models/test/openai-compatible-gateway.test.ts`
against a fixture hand-shaped from the research note, and the example's tests
drive an injected fetch; neither counts as a live execution.

## Rollback

Nothing is written outside the process: the example makes three calls, prints
their text, and exits. The only cost is the calls.

1. Stop the example or the CLI if it is still running.
2. Unset the three variables set in step 3 (`Remove-Item Env:OMNIROUTE_*` under
   PowerShell, `unset` under bash). Nothing else was changed.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `SKIPPED: OMNIROUTE_BASE_URL is not set` and exit 0 | the base URL never reached the process environment | repeat step 3 in the same shell as step 4 |
| `HTTP 404` on `/chat/completions` | the base URL already ends in `/chat/completions` or points at the site root | the value is the prefix the gateway documents, usually `.../v1` |
| `HTTP 401` or `403` | the gateway enforces a key and none (or a stale one) was sent | set `OMNIROUTE_API_KEY`; a gateway with `REQUIRE_API_KEY=false` accepts no key rather than any key |
| a model-not-found error naming the model | the id is not one the gateway routes to | redo step 2 and use an id from that list |
| a browser page reports a CORS error and the call never leaves the tab | the gateway denies cross-origin requests by default | run the gateway behind a same-origin dev-server proxy, or add the page's origin on the gateway; do not disable CORS for a hosted page |
| the stream stops mid-answer with no error | the upstream connection dropped after the 200 | the adapter does not retry a streamed request; the caller decides whether to retry, and retrying re-runs the turn |
| every rerun answers differently for the same prompt | `auto` (or an unpinned default) lets the gateway pick an upstream per request | pin one id per step 2 |
| `Cannot find module .../dist/index.js` | the packages were not built | run step 1 |

## Notes

- What the adapter accepts from a gateway, and what the fixture pins: a
  keep-alive chunk with an empty delta is dropped rather than surfaced as a
  phantom token; `choices: []` may carry the only usage report; the gateway may
  synthesize the finish reason the upstream never sent; an error object inside a
  200 stream is raised as an error rather than ended quietly, and the message
  never carries the key.
- A timeout is the caller's. The adapter forwards `options.signal` on its
  request, so wrap the call (or the injected fetch) in an `AbortSignal`,
  not in adapter configuration.
- A gateway's tool-call frames arrive as `toolCallDelta` chunks, but executing a
  tool is the host's job: the adapter only streams the arguments. A gateway that
  emulates tools upstream of the model is not doing the host's work for it.
- A gateway is never part of the golden transcripts or the parity corpus: both
  pin a provider's own wire, and a router's output depends on which upstream it
  chose. The fixture here is the closest a repository with no gateway can get.
