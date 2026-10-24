# exec-remote — scoped entry

## What this component is

`@smolagents-ts/exec-remote` is the Python `CodeExecutor` for three remote
backends behind one seam: a local child process, a Docker-hosted Jupyter kernel,
and an E2B sandbox. Each backend is a subpath, so a consumer that wants the
process backend never resolves a container client. The root entry carries the
seam, the host-side executor and the typed refusals, and resolves no vendor
client.

## Entry points

| entry point | path | notes |
|---|---|---|
| public barrel | `packages/exec-remote/src/index.ts` | the seam, the executor, the typed refusals and `VERSION`; the surface test pins all four entries |
| seam | `packages/exec-remote/src/sandbox.ts` | `RemoteSandbox`, the host-owned frame vocabulary and the capability shape |
| process backend | `packages/exec-remote/src/backends/process.ts` | a real child interpreter; this host's filesystem and network |
| Docker and E2B backends | `packages/exec-remote/src/backends/` | the Jupyter protocol over the Engine API, and the vendor sandbox |
| guest program | `packages/exec-remote/src/shim-source.ts` | the Python prelude every backend installs before a step |
| refusals | `packages/exec-remote/src/errors.ts` | the typed errors a missing peer or an uncarryable call produces |

## Smallest validation command

    pnpm vitest run --project exec-remote

Expected result: fourteen files with a hundred and five tests, exit code 0. Run
`pnpm --filter @smolagents-ts/exec-remote run typecheck` beside it: the runner
erases types, and the subpath entry points are only checked by the compiler.

## Boundaries

This package owns the three backends and the protocol they share. It owns no
agent loop, no policy about which tools a guest may reach, and no scheduling
decision: the seam belongs to the core's `CodeExecutor`, and the seam's types
are not re-exported here. The facade depends on it; nothing else does.

## Hazards

- The process backend runs guest code with this host's own privileges. It is a
  convenience for a trusted task, and it is the one backend whose isolation is
  the operating system's rather than a boundary the package draws.
- A backend that has no mid-run channel runs code in one shot, so a guest can
  only reach `final_answer`; the attempt to call anything else is refused by
  name rather than answered with nothing, and a declared tool set is refused
  before the vendor sandbox is created.
- A declared transfer is opt-in: with one the prelude installs exactly the
  tools it names and binds its variables as globals; without one every registry
  tool is installed and no variable is bound.
- The Docker path needs a reachable daemon and a kernel that answers a readiness
  poll; the kernel's own stdin channel is what lets a blocking read finish, and
  a backend that skips it hangs instead of failing.
- The E2B client declares a Node floor above the one this package publishes. The
  backend checks it at construction and refuses with a typed error rather than
  failing somewhere inside the vendor SDK.
- `allowPickle` is false by default because the pickle path runs host-side while
  a result is decoded; a payload that needs it is refused unless a caller asks.
- A green suite proves the seam and the doubles; it proves nothing about a live
  daemon or a hosted sandbox.

## Pointers to root rules

Root rules: `rules/00-index.md`. Component rule:
`rules/components/exec-remote.md`.

<!--
Fill rules:
- Cap: this entry stays at or under 6 KB. Detail that pushes it past the cap
  belongs in rules/components/<id>.md or in docs/, not here.
- Ban: carry no root policy. No rule text, no obligation, no precedence level,
  and no restated project fact -- point at the file that owns each. The
  strength keywords are defined and written in capitals only in
  rules/00-index.md; any of them appearing here reads as a restated root
  obligation and fails validation, so this form contains none of them even in
  lowercase.
- Keep the phrase "smallest validation" in the heading above: a scoped entry
  that does not name one fails validation.
- Add this component's row to the component table in the root AGENTS.md, with
  the id, the path scope, this file's path, and rules/components/<id>.md. A
  scoped entry with no row fails validation.
- One id everywhere: the component-table id, the directory name, and the rule
  file name are the same string.
- The component rule file form and its registry requirement are described in
  rules/components/README.md.
-->
