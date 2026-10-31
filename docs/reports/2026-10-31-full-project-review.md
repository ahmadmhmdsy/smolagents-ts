# Full project review

**Date:** 2026-10-31 · **Repository:** `E:\python_projects\smolagents_ts` (branch `main`, head
`4ba765c`, with uncommitted work in the tree) · **Plan:**
[review fixes](../plans/2026-10-31-review-fixes-plan.md)

**Contract**
- **Role:** report — the findings of a whole-project review and the evidence behind each.
- **Mutability:** history — corrected only by appending a new section; measured numbers are
  never rewritten.
- **Read when:** checking why a `T-58` to `T-66` row exists, or what the review did not cover.
- **Update when:** a claim here stops describing the code, which is a new report rather than an
  edit to this one.

## Verdict

Code and test discipline are strong. The project was not ready for 0.1.0 at review time: `main`
was red on GitHub, the Docker backend could not work against a real daemon, and the remote
executor's guest boundary had gaps. None of the findings needs a redesign.

## Checks run

| Check | Result |
|---|---|
| `pnpm gate`, all 11 stages, one at a time | exit 0 on the working tree, uncommitted fixes included |
| Tests | 1346 passed in 175 files; no `.skip` or `.todo` in a test file |
| GitHub CI on `main` | failing on `377aa76`, `0e8747e`, `4ba765c`; last green `b1e12c0` |
| `python scripts/validate_context.py --root .` | 0 errors, 16 warnings |
| `python scripts/selftest.py` | 33 OK |
| `python scripts/rotate.py --check` | exit 0 |
| `pnpm audit --prod` | clean |
| `pnpm audit` | 12 dev findings: 1 low (esbuild via tsup), 7 moderate (undici; vite 6.4.4 in an example; minimatch and glob via e2b), 4 high (undici below 8.12.2 via `packages/react`'s jsdom) |

Not run: a live Docker daemon, E2B, a real provider, a browser. Unless a finding says otherwise,
it comes from reading the source.

## Fix before release

1. **CI is red.** `ERR_PNPM_PACKAGE_MANAGER_NO_IMPORTER` on all six jobs: `T-39` added
   `examples/gateway` without its lockfile importer. The fix is the uncommitted `pnpm-lock.yaml`.
   Pages was skipped on `4ba765c`, so the demo is probably stale. The "full gate green" in the
   `T-39` and `T-48` handoff entries was local only.
2. **`docker.ts:515-517` calls `.on` on the Promise `buildImage()` returns.** Proved by script:
   the value is a Promise and `.on` is undefined. `DockerodeLike` at `:478` encodes the wrong
   shape, the stream is never consumed, and build errors go unchecked.
3. **`docker.ts:540-556` runs `Tty: false` with no `modem.demuxStream`.** Proved by script: a
   framed line does not start with the frame prefix, so no frame would ever parse. The per-chunk
   `new TextDecoder()` at `:554` also corrupts a multibyte character split across chunks.
4. **`executor.ts:264` passes `call.args as never`.** A guest's arguments reach the tool
   unvalidated. QuickJS (`executor.ts:301,319`) and Pyodide (`bridge.ts:99,117`) both run
   `inputSchema.safeParse` and pass `parsed.data`; `core/src/tool/tool.ts:166-169` does not
   validate, so the executor is the only place it can happen.
5. **`executor.ts:250` resolves against the full registry.** `transfer.tools` narrows only the
   prelude at `:226`, so a guest can emit a tool frame for a tool it was never given.
6. **`shim-source.ts:7` uses a fixed `FRAME_PREFIX`.** Guest code can print a forged frame, and
   `parseFrameLine` (`:86-90`) throws on invalid JSON after the prefix, so a stray print ends
   the step.

Also: the remote `ToolContext` at `executor.ts:264-270` omits `agentPath` and `onProgress`.

## Fix soon — security

- `visit-webpage.ts` has no SSRF guard: loopback, `169.254.169.254`, private ranges and
  redirects to any of them are all reachable.
- `docker.ts:522-531` sets no `CapDrop`, no-new-privileges, `ReadonlyRootfs`, `User` or CPU limit;
  the base image at `:27` is an unpinned `python:3.12-slim`.
- MCP `http.ts`: no timeout, unbounded `readEventStream` and `response.text()`, a bearer token
  accepted over plain http, custom headers able to override session headers.
- MCP `stdio.ts:93` inherits all of `process.env` when `env` is undefined, buffers without a
  bound, and ignores stdin backpressure.

## Fix soon — code

- `process.ts:245`: `SIGKILL` reaches the child only, not its descendants.
- `html.ts`: `DROPPED` needs a closing tag, so an unclosed `<script>` leaks into the text.
- `args.ts:64,105`: `--api-key` is visible in `argv`; `T-53`'s `--api-base` is silently ignored
  on the default model type.
- `multi-step-agent.ts` is 2311 lines.
- `examples/vite-app/vite.config.ts` is an open forwarder (low; a dev server).

## Fix soon — packaging

Five public packages sit outside the changeset `fixed` group, and README's "one install carries
the whole stack" overstates what the five entries carry.

## Fix soon — CI

No top-level `permissions:` in `ci.yml` or `context.yml`; mutable action tags; no `pnpm audit`;
the gate runs on Ubuntu only; a floating `deno-version: v2.x`; Prettier is not a stage; depcruise
scans `packages/` only; `pages.yml` grants `id-token: write` at workflow level.

## Docs and governance

- The uncommitted `scripts/` change fixes audit claims 2-4 and D1-D3 of
  `reports/audit-independent-2026-10-26.md` and has no handoff entry. The newest entry is 10-25.
- The uncommitted handoff diff edits past entries at lines 50 and 66, which breaches
  append-only. Reverting it would restore two dead links.
- `reports/` is untracked and not ignored.
- Open audit claims: `context-pack.json` lists 5 components against 12 rows and only
  `adopt.py:343,350,351` writes it; no scope covers `scripts/`, `docs/`, `_templates/`,
  `examples/` or `.github/`; the rule status vocabulary is unused.
- `docs/02-environment.md`: last verified 10-13; line 76 names a dead branch; line 86 contradicts
  lines 109-110 on sockets; its credentials table lists only `GOOGLE_API_KEY`.
- `T-54` sits after `T-57` in the task table; README has blank lines at 140-142; README's
  validator command uses `--baseline` while CI does not; `.dsh/` and `.superpowers/` are local
  debris.

## What is good

QuickJS caps, interrupt and no eval fallback; the recorded Pyodide interrupt decision (`0033`);
the process backend's environment allow-list; keys in headers; the Vite key held server-side;
journal idempotency; tarball checks; a README honest about what the suite proves. The `96f33fa`
against `1.14.0` mismatch is explained at `docs/01-project.md:103` and is not a finding.
