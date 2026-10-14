# T-13 Task 5 — the remote executors Implementation Plan

## Contract

- **Role:** the implementation plan for Task 5 of
  `docs/plans/2026-10-14-v1.5-modules-plan.md`, the remote
  `CodeExecutor` backends the design defers to v1.5.
- **Mutability:** frozen once execution begins. A step that proves wrong gets a
  dated note under the task that owns it; its own text is not edited.
- **Read when:** executing Task 5, or checking what it promised.
- **Update when:** a measured result differs from its prediction.

**Goal:** a package `@smolagents-ts/exec-remote` offering three `CodeExecutor`
implementations for Python — a local child process, a Docker-hosted Jupyter
kernel and an E2B sandbox — behind one shared execution path. Modal and Blaxel
are out of scope.

**Architecture:** one package over one seam, built as pnpm 12.3.4 workspaces
with TypeScript 6, tsup 8.5.1 (ESM only) and vitest 5, on Node's own
`child_process`, `crypto`, `http` and `net` modules. Four
layers: the `RemoteSandbox` seam (start, run, an output callback, dispose);
one shared sentinel-framing and Jupyter-protocol layer; three subpath-only
backends; and the adapter onto `CodeResult`.

**Spec:** design lines 169, 215, 339, 825, 943 in
`docs/design/2026-10-12-smolagents-ts-v1-design.md`;
`packages/core/src/executor.ts`;
`smolagents/src/smolagents/remote_executors.py`; `docs/attribution.md` and
`docs/09-decisions/0006-distribution-shape.md`.

**Depends on:** T-13's earlier tasks and
`docs/research/2026-10-14-remote-executors-recon.md`. The core seam already
admits `"remote"` and `"process"` (executor.ts:6), so no core source
changes. Order is numeric, 1 through 8.

**Task ownership:** one writer at a time. Tasks 1–7 own
`packages/exec-remote/**` and the vitest entries; task 8 owns the scoped entry,
the component rule, the runbook index and the new runbook, `AGENTS.md`,
`docs/attribution.md`, `docs/04-tasks.md`, `docs/03-handoff.md`,
`docs/02-environment.md`, `docs/05-memory.md` and the root
`package.json`. One session holds `scripts/pack-smoke.mjs`, `.changeset/`
and `packages/exec-pyodide/` meanwhile.

## Decisions fixed before this plan

- Package `packages/exec-remote/`, name `@smolagents-ts/exec-remote`, id
  `exec-remote`, version `0.0.0` outside the `fixed` group, siblings'
  template, Node-only and it says so. Subpaths `/process`, `/docker`,
  `/e2b`. `dockerode` and `@e2b/code-interpreter` are optional peers,
  never regular dependencies, so a default install pulls neither and the process
  backend needs no client.
- Build order is process, then Docker, then E2B. Modal and Blaxel are not built:
  each needs a vendor account and a large client, and both reuse the Jupyter
  protocol Docker covers, so a later addition costs one backend file, its double
  and a runbook row.
- Docker and E2B differ in how a sandbox is created and torn down, not in how
  code runs, so one `RemoteSandbox` seam carries both and the executor and its
  tests are written once.
- Timeout and cancellation are enforceable here, unlike an in-process WASM guest:
  the host owns a connection it can abort or a child it can kill. `timers` is
  `true` for Docker and E2B, `false` for the process backend whose guest
  can monopolise its own CPU; `isolation` is `"remote"` there and
  `"process"` here, and `network` is `"direct"` for the sandboxes,
  `"none"` for process.
- Host tools cross a generated Python shim, like upstream's `send_tools`.
  A sandbox cannot call into the host, so the run is a host-driven
  conversation: the shim prints a request frame, blocks on its stdin, and the
  host answers after running the tool through the injected `ToolRegistry`.
- The final answer crosses on a sentinel channel the host owns, not by parsing a
  remote traceback: one format serves all three backends. `allowPickle`
  defaults to `false` and is an explicit opt-in, because the pickle path runs
  host-side during deserialisation and a compromised guest could otherwise attack
  the host; the README records the divergence from upstream's legacy default.
- Tests drive injected doubles and never a live backend, so the gate stays
  offline: Docker's double is the Engine API seam, E2B's the vendor client behind
  an interface, the process backend a real short-lived child. Each live path is a
  runbook and no test reads a credential.

## Findings measured before this plan (2026-10-14)

Measurements are the reconnaissance's, cited by section in
`docs/research/2026-10-14-remote-executors-recon.md`.

| # | Measurement (section) | Finding |
|---|---|---|
| 1 | `"remote"` is already in `ExecutorIsolation` ("What a remote executor must supply") | No core edit |
| 2 | Four classes over one base at remote_executors.py:42; no timeout or abort ("Upstream's shape") | Port the lifecycle, add the deadline |
| 3 | The token is a host-side `KG_AUTH_TOKEN`; a kernel comes from a 201 POST ("Docker: authentication, protocol and teardown") | The handshake fits `crypto` and `fetch` |
| 4 | Engine API and Jupyter Gateway are the offline seams ("The Docker runtime and doubling it") | The Engine API is the double; the protocol gets a server |
| 5 | dockerode is 165 KB over 27 files; `@e2b/code-interpreter` is 158 KB ("Candidate clients, measured") | Both can be optional peers |
| 6 | Every candidate is Node-only ("Node-only or browser-safe") | The package says Node-only |
| 7 | E2B's engine range starts at 22.19.0; the repo declares 22.12 ("Candidate clients, measured") | Floor stays at the repo's, range documented |
| 8 | The base serialises the answer into a thrown exception ("Upstream's shape") | A host-owned sentinel replaces it |
| 9 | An E2B `run_code` call is one shot; a Jupyter channel stays open ("What each backend does differently") | Round trips are per-backend |
| 10 | No daemon was reachable and no credential was read ("Not measured") | Every live path is a runbook |

## Tasks

### Task 1: the package skeleton

**Deliverable:** the package builds, typechecks and carries its siblings'
metadata; the pack smoke's list is coordinated rather than edited.

**Files:** `packages/exec-remote/{package.json,tsconfig.json,tsconfig.test.json,tsup.config.ts,vitest.config.ts,README.md,src/index.ts,src/version.ts}`,

**Notes:** version `0.0.0` outside the `fixed` group,
`type: module`, `sideEffects: false`, `engines.node >=22.12`,
`publishConfig.access: public`, a `files` list of `dist`,
`LICENSE` and `NOTICE`, and `prepack`/`postpack` calling
`scripts/copy-licence.mjs`. Dependencies: `@smolagents-ts/core`
(workspace) and `zod`; `peerDependenciesMeta` marks `dockerode`
and `@e2b/code-interpreter` optional. The `exports` map names `.`,
`./process`, `./docker`, `./e2b`, with a `node` condition on
the three backend subpaths. tsup emits one ESM `es2022` entry per subpath
with `dts: true` and externalises both peers plus `zod`. The root
`vitest.config.ts` gains three offline project entries.

**Verification:** `pnpm --filter @smolagents-ts/exec-remote run build` exits 0
with `dist/index.js` and `dist/index.d.ts`; `pnpm build` still exits 0.

**Added 2026-10-14, before execution:** task 1 also adds this package's
`.changeset/` entry and its row in `scripts/pack-smoke.mjs`. The concurrent
session that held both files was building `packages/exec-pyodide`, and that
constraint ends when it lands.

### Task 2: the sandbox seam and the process backend

**Deliverable:** one interface every backend satisfies, a host-owned frame
format and a local child-process executor.

**Files:** `packages/exec-remote/src/{sandbox,errors}.ts`,
`packages/exec-remote/src/backends/process.ts`,
`packages/exec-remote/src/backends/process/index.ts`,
`packages/exec-remote/test/{sandbox,process}.test.ts`.

**Notes:** `RemoteSandbox` exposes start, run, an output callback, an optional
`callTool` hook and dispose; a run result carries the frames read, the exit
status and a duration. The process backend spawns a configured interpreter with
`spawn(program, args, { stdio: "pipe" })`, writes the prelude and the step code
to stdin, and reads stdout line by line. Dispose sends a termination then kills
after a grace period, so a hung guest cannot outlive the agent step. It imports
only `node:child_process` outside the core's types.

**Verification:** a test spawns the real interpreter and asserts the answer
line, a captured `print`, the child's absence after dispose, and a
non-zero exit reported as an `AgentErrorInfo`.

### Task 3: the guest shim and the tool round trip

**Deliverable:** generated Python that answers, calls a host tool across the
pipe, and cannot lose its answer to a guest's `except Exception`.

**Files:** `packages/exec-remote/src/{shim-source,serialize}.ts`,
`packages/exec-remote/test/{shim,serialize}.test.ts`.

**Notes:** `buildShimSource(options)` returns one Python string holding the
answer sentinel, the blocking tool-call helper and the host's counterpart for
values sent in. `final_answer(value)` serialises, prints the sentinel frame
and raises a `BaseException` subclass, so a guest handler for `Exception`
cannot swallow it. A tool call prints a request frame, reads one line from stdin
and parses it; without a call channel the stub raises a named
`RuntimeError` instead of hanging. `serialize.ts` implements
upstream's safe vocabulary — tuples, sets, bytes, complex numbers, frozensets,
datetimes, decimals, paths, dataclasses — refusing what it cannot represent,
and raising on a `pickle:` payload unless `allowPickle` is true.

**Verification:** a test runs the shim under the real interpreter against a
scripted stdin, asserting one request and one response per tool call, that a
guest `except Exception` around `final_answer` still ends the run, and
that `pickle:` is refused with the default options.

### Task 4: the shared Jupyter protocol and the Docker backend

**Deliverable:** the kernel-gateway driver, plus a `DockerSandbox` that
builds an image, runs a container with a published port and a generated token,
and speaks that protocol to it.

**Files:** `packages/exec-remote/src/{rpc,jupyter}.ts`,
`packages/exec-remote/src/backends/docker.ts`,
`packages/exec-remote/src/backends/docker/index.ts`,
`packages/exec-remote/test/{rpc,jupyter,docker}.test.ts`.

**Notes:** `rpc.ts` is a request/response peer with a per-request timeout and
an abort hook, for the handshake and for tool frames on a persistent channel. The
kernel's stdin channel is what makes the guest's blocking read work: the driver
answers each `input_request` with an `input_reply` carrying the tool's JSON
result, so the round trip needs no second port. `supportsToolRoundTrip` is
false only where a backend has no such channel.
`jupyter.ts` builds `execute_request` frames with a fresh message id,
creates a kernel with a token-bearing POST that must answer 201, folds stream,
result, error and terminal-status messages into one result, and polls
`/api/kernelspecs`. Its transport is a constructor argument typed as a narrow
`WebSocketLike`, so a test supplies a real loopback server rather than a mock
of the protocol. Docker's client is `dockerode` loaded dynamically behind a
`ContainerRuntime` interface, so a consumer that never imports the subpath
never resolves it. The image comes from an inline Dockerfile kept in this package
rather than a file, so the same text can be hashed for a tag; `images.build`
receives a tar stream carrying it, as upstream's `BytesIO` path does at
remote_executors.py:625. `PortBindings` maps `8888/tcp` to a host address
and port; the token is `randomBytes` rendered URL-safe and passed as
`KG_AUTH_TOKEN`; the kernel id comes from that POST. Teardown stops then
removes the container, matching remote_executors.py:696–704.

**Verification:** one test starts a real HTTP and WebSocket server on a loopback
port answering the readiness probe, creates a kernel and replays a stream plus a
terminal status; a wrong token fails the handshake. The Docker test drives a fake
Engine API on loopback plus that same server, asserting the build request's
Dockerfile bytes, the `KG_AUTH_TOKEN` reaching the create body, the port
bindings, and one stop-and-remove even after a failed start.

### Task 5: the E2B backend

**Deliverable:** an `E2BSandbox` over the vendor SDK, behind an interface a
double satisfies.

**Files:** `packages/exec-remote/src/backends/e2b.ts`,
`packages/exec-remote/src/backends/e2b/index.ts`,
`packages/exec-remote/test/e2b.test.ts`.

**Notes:** the SDK is loaded dynamically and wrapped as an `E2BClient`
interface exposing create, run, kill and a log reader, so the double is the
vendor client and the test never imports it. E2B is the one backend with no
mid-run call channel, so the shim's tool stub is installed in its refusing form
and the backend reports `supportsToolRoundTrip: false`. The vendor's error
field becomes a runner error rather than the answer, which arrives on the
sentinel. The engine range the SDK declares is checked at construction and
reported as a typed error naming this package's floor.

**Verification:** the double records the create arguments, returns a canned
stream plus an answer frame, and asserts teardown calls kill once; a second
case asserts a tool call is refused with the named error rather than hanging.

### Task 6: the executor, the deadline and the result mapping

**Deliverable:** `RemoteExecutor` satisfies `CodeExecutor` for all three
backends and reports an honest capability set.

**Files:** `packages/exec-remote/src/executor.ts`,
`packages/exec-remote/test/executor.test.ts`.

**Notes:** the constructor takes a `RemoteSandbox` factory and options
including `allowPickle`. `execute()` starts the sandbox lazily, sends the
shim and this step's tool definitions, then races the run against `timeoutMs`
and the caller's `signal`. Whichever ends first, the loser is observed so it
cannot surface as an unhandled rejection, and a deadline or abort disposes the
sandbox before returning `AgentTimeoutError` or `AgentCancelledError`.
`dispose()` is idempotent. The sentinel frame becomes `value` with
`isFinalAnswer: true`; any other failure becomes an `AgentErrorInfo` with
code `AGENT_EXECUTION` and the guest's own text. Output lines go to the run buffer and `onLog`, with the QuickJS
executor's 50,000-character head-and-tail truncation. Every backend reports
`asyncToolCalls: false`: the guest blocks on its stdin, so no awaited host
promise exists to settle, and changing that is a core-contract change.

**Verification:** a scripted sandbox double lets one case answer, one hang past
a short timeout and one abort mid-run; the test asserts the error code, that
dispose ran, and that the run after a timeout still starts a fresh sandbox.

### Task 7: the public surface, the subpaths and the isomorphism guard

**Deliverable:** the barrels a consumer imports, pinned by test, plus a test that
the default entry reaches no Node builtin and no vendor client.

**Files:** `packages/exec-remote/src/{index.ts,process.ts,e2b.ts}`,
`packages/exec-remote/src/backends/docker/index.ts`,
`packages/exec-remote/test/{public-surface,architecture}.test.ts`.

**Notes:** the root barrel exports `VERSION` and backend-neutral types only;
each subpath exports its own factory and options type, and no subpath re-exports
a core type, as the sibling keeps the seam in the core. The surface test pins the
sorted export list of all four entries. The architecture test reads every module
outside `src/backends/` and fails on a `node:` specifier or a bare
vendor import, mirroring the QuickJS package's test; a second case asserts the
`exports` map's keys are exactly the four subpaths.

**Verification:** adding an export fails the surface test until the pinned list
changes; a throwaway `import "node:fs"` in `src/index.ts` fails the
architecture case.

### Task 8: the documents, the router, the runbooks and the gate

**Deliverable:** the component is reachable from the router, each live backend has
a human procedure, and the package is inside every gate stage that names
packages.

**Files:** `packages/exec-remote/AGENTS.md`, the new component rule under
`rules/components/`, `AGENTS.md`, `docs/attribution.md`,
`docs/10-runbooks/README.md`, a new runbook under `docs/10-runbooks/`,
`docs/04-tasks.md`, `docs/03-handoff.md`, `docs/02-environment.md`,
`docs/05-memory.md`, and the root `package.json` only if a filter
misses a project.

**Notes:** the scoped entry follows the QuickJS component's, and the rule states
that the process backend is not a sandbox, that `asyncToolCalls` is false for
every backend, and that no test reads a credential. The
`remote_executors.py` attribution row moves from `defer` to the new
package, because the path it planned is now real. The runbook records the three
live paths, names the variable a human supplies for E2B, requires a Docker daemon
for the Docker path, and states that neither is a gate stage. Build, publint, attw
and the pack smoke already reach `packages/*` by glob, so the wiring edit is
the vitest list; the pack smoke's own list is held by the concurrent session, so
this task records the need instead.

**Verification:** the validator ends with `new: []`, zero errors and zero
warnings, `python scripts/rotate.py --check` exits 0, and `pnpm gate`
exits 0 with the suite's file and test counts pasted into the measured results.

## Risks and rollback

| Risk | Mitigation | Rollback |
|---|---|---|
| V15-R3: the gate comes to need a daemon | Docker's tests drive a doubled Engine API, E2B's a doubled client, the process suite a local child | Drop the Docker and E2B tasks; the process backend stands alone |
| A vendor changes its client's shape | Each client sits behind a small interface the double implements | Pin the peer range to the tested minor |
| A synchronous guest ignores the deadline | The transport owns the clock: a timeout closes the channel or kills the child | Narrow the `timers` claim rather than keep it dishonest |
| The pickle path attacks the host | `allowPickle` is false by default and rejected payloads raise | Remove the `pickle:` branch; nothing else depends on it |
| A consumer's Node is below the E2B floor | The subpath checks the SDK's range and names it in a typed error | Raise the floor and re-verify the other two backends |

## Open questions for the owner

1. **The changeset and the pack smoke.** This plan creates no changeset and
   edits no pack-smoke list, because one session holds both meanwhile. The owner
   should confirm that session lands the `exec-remote` entry before release.
2. **The E2B tool-call limit.** An E2B `run_code` call is one shot, so a
   guest tool call cannot round-trip mid-run. Wanting them anyway costs a second
   execution per call plus host-side continuation state, which changes how an
   agent spends a step.
3. **The `asyncToolCalls` value.** Fixed at `false` for all three backends,
   diverging from the reconnaissance's reading; flipping it is a core-contract
   question.
4. **`install_packages`.** Carried as a request on the same round trip, never
   run in the gate; the owner may want it refused outright.

## Measured results

Results are appended here by the session that executes the plan.

### Tasks 1 to 7 — executed 2026-10-14

Built by a delegated session; the delegating session ran the gate and owns Task 8.

| command | result |
|---|---|
| `pnpm --filter @smolagents-ts/exec-remote run typecheck` | exit 0 |
| `pnpm --filter @smolagents-ts/exec-remote run build` | ESM success in 247 ms, DTS success in 2,878 ms, exit 0 |
| `pnpm vitest run --project exec-remote` | 11 files, 56 tests, exit 0 |
| `pnpm lint` | exit 0 |
| `pnpm depcruise` | 262 modules and 649 dependencies cruised, no violations |
| `pnpm pack:smoke` | ten packages installed and imported; the CLI bin ran |

### Where the plan was wrong or silent

1. **Task 1's root-config edit was unnecessary.** The root `vitest.config.ts`
   already globs `packages/*`, so `packages/exec-remote/vitest.config.ts` is
   discovered with no root change. No root edit was made.
2. **Task 4's Docker proof is stronger than the plan described.** The plan named
   a fake Engine API; the package drives an injected recording `ContainerRuntime`
   double *and* a real loopback HTTP and WebSocket Jupyter server built in
   `test/ws-server.ts` with a hand-rolled RFC 6455 codec. The double asserts the
   Dockerfile bytes, the auth token in the create body, the 8888/tcp bindings and
   one stop-and-remove after a failed start; the loopback server exercises the
   real wire path. The non-negotiable — no daemon in the gate — holds.
3. **Files the plan's lists omitted.** `src/rpc.ts`, `src/jupyter.ts`,
   `src/backends/{docker,e2b}.ts` and their subdirectory barrels,
   `src/streams.ts` and `test/ws-server.ts` were needed and added.
4. **The process transport changed shape.** CPython runs a piped program only at
   end of input, so feeding the step program over stdin produced no output. The
   backend now spawns `python -u -c <prelude and step loop>` and feeds each step
   as a JSON line on the same pipe that carries tool replies.
5. **`allowPickle` was missing from the executor.** Task 6 listed it in the
   constructor's options and the first pass hard-coded it false, so the one
   agent-facing seam could never carry a pickled payload. It is now an option
   that defaults to false and passes through; a test pins both halves.
6. **The root barrel needed the seam types.** Task 7 asked for the backend-neutral
   names; the first pass exported only `VERSION`. `RemoteExecutor` and its
   options, the six typed refusals and the ten seam types now ship from the root,
   and the isomorphism test enforces that no `node:` specifier or vendor package
   is reachable from it.
7. **`tsconfig.json` needed `"types": ["node"]`.** The shared base sets an empty
   `types` list and the Docker backend uses `node:crypto`, so the declaration
   build failed with TS2591 until it was added, as `packages/mcp` already does.
8. **`pnpm-workspace.yaml` gained two policy blocks.** pnpm 11.7.0 refuses to
   guess about install scripts and appends placeholders until each is answered:
   `allowBuilds` now denies `cpu-features`, `protobufjs` and `ssh2` (dockerode's
   optional native builds) beside the existing `esbuild` entry. The same version
   quarantines a version published in the last 24 hours, and the three E2B
   packages were published inside that window, so pnpm auto-appended them to
   `minimumReleaseAgeExclude` at exact versions. Both blocks are recorded in
   decision 0017.

### The live boundary

Nothing in the suite starts a container, opens a socket to a hosted service or
reads a credential: the Docker and E2B backends are driven through doubles, and
the process suite spawns a real interpreter on this host. The three live paths
are procedures in `docs/10-runbooks/exec-remote-live-backends.md`, and none of
them is a gate stage.

