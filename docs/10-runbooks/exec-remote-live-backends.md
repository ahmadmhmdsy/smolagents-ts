# 10 — Runbook: the remote executor backends against live infrastructure

**Contract**
- **Role:** the procedure that runs one remote-executor backend against the real thing —
  a host interpreter, a Docker daemon, or the E2B service — outside the recorded suite.
- **Mutability:** rewrite in place when a backend's startup, its credential, or its image
  changes.
- **Read when:** after a change to a backend, its transport or its sandbox lifecycle, and
  before a release that claims a live path works.
- **Update when:** a path is executed and the result differs from what this file records,
  or a step fails in a way it did not anticipate.

**Why this file exists:** every test in the package drives a sandbox the test owns, so
nothing in the gate needs a daemon, a credential or a network. The three paths below are
the only ones that leave the process, and each is the only evidence that its backend still
talks to the thing it names.

---

Last recorded run: the process path, 2026-10-14 — five checks ok, 334 ms, exit 0. The
Docker and E2B paths were attempted the same day and failed for the reasons the failure
table gives, because this host has no daemon and no credential. Treat both as unexecuted
until a run here says otherwise.

## Preconditions

- Node.js 22.12 or newer, and pnpm 12.3.4, both on `PATH`.
- Dependencies installed: `pnpm install --frozen-lockfile`.
- The packages built, because the check imports `dist` and a consumer imports the same
  entries:

      pnpm build

- The E2B path additionally needs Node 22.19.0 or newer. That is the floor the vendor
  client declares, above this package's own, and the subpath refuses a lower runtime by
  name before it imports the client.
- No other process is rebuilding the package while the check reads its built entries.

## The check

One script covers all three backends. Each run sends a three-line step — a multiplication,
a print, and a final answer — and then asserts the five things that make the run mean
something: the sentinel frame became the answer, the answer crossed as a value, the run
buffer captured the guest's own line, the live sink saw the same line, and no error was
reported. It exits 0 only when all five hold.

    node scripts/exec-remote-smoke.mjs process
    node scripts/exec-remote-smoke.mjs docker
    node scripts/exec-remote-smoke.mjs e2b

The argument defaults to `process`, which is the only path that needs nothing beyond an
interpreter on the host.

## Path 1 — the process backend (verified)

Prepare nothing but the interpreter. The check spawns `python` on Windows and `python3`
elsewhere, unbuffered, and feeds it one JSON line per step.

    node scripts/exec-remote-smoke.mjs process

A run leaves no process behind: the executor disposes the sandbox, which ends the child.

## Path 2 — the Docker backend

Confirm the daemon before anything else, because every failure past this point is
downstream of it:

    docker version --format '{{.Server.Version}}'

The backend builds its own image from a Dockerfile it carries in the source — a Jupyter
kernel gateway listening on 8888 — tagged from that text, so editing the Dockerfile
rebuilds and an unchanged one reuses the layer cache. It then creates a container that
publishes 8888/tcp to 127.0.0.1 on an ephemeral host port, mints a random token unless one
is supplied, and polls until the kernel answers. The tool round trip on this backend runs
over the kernel's own stdin channel.

    node scripts/exec-remote-smoke.mjs docker

The first run builds the image and takes minutes; later runs start in seconds.

## Path 3 — the E2B backend

The vendor client is a development dependency here and an optional peer for a consumer.
The backend reads a credential from its own option, or lets the client read
`E2B_API_KEY` from the environment; this check never touches the variable itself, and the
SDK is the only thing that does.

    # the value is never committed; .gitignore covers .env and .env.*
    $env:E2B_API_KEY = '<key>'
    node scripts/exec-remote-smoke.mjs e2b

This backend refuses the tool round trip by name, so the run exercises the step path only.
That refusal is deliberate: the client offers no channel a guest can block on, and
claiming one would be a lie the agent loop acts on.

## Verification

Expect five `ok` lines, one summary line naming the backend, its duration and a tool-call
count of 0, and exit code 0:

    node scripts/exec-remote-smoke.mjs process
    echo $LASTEXITCODE

Any `FAIL` line sets exit code 1, and when the executor reported an error the script
prints its code and message on the line after the summary. A failed start surfaces as
`AGENT_EXECUTION`, because that is the code every host-side failure maps to; the message
carries the backend's own words and, where the backend attached one, the cause beneath it.

## Rollback

1. Stop the script. The executor disposes the sandbox in a `finally`, so the child, the
   container and the E2B sandbox are torn down on every path, including a failed one.
2. If a process survived an interrupted run, end it by its command line:

       Get-CimInstance Win32_Process -Filter "Name = 'python.exe'" |
         Where-Object { $_.CommandLine -like '*PYTHONUNBUFFERED*' } |
         ForEach-Object { Stop-Process -Id $_.ProcessId }

3. If a container survived, remove it by the image the backend built:

       foreach ($image in docker images -q --filter 'reference=smolagents*') {
         docker ps -a --filter "ancestor=$image"
       }
       docker rm -f <id>

4. If an E2B sandbox survived a hard kill, end it from the vendor's own listing; it bills
   for the time it stays alive.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `error AGENT_EXECUTION: The Docker sandbox could not start.` | no daemon is running, or the socket is unreachable | start Docker and re-run `docker version`; the cause line under the summary names the transport error |
| `error AGENT_EXECUTION: The E2B sandbox could not be created.` | no credential, or the optional client is not installed | export `E2B_API_KEY` and confirm the peer resolved with `pnpm install` |
| `UnsupportedNodeVersionError` naming the E2B floor | the runtime is below 22.19.0 | switch to Node 22.19.0 or newer |
| `MissingPeerDependencyError` naming `dockerode` or the E2B client | the optional peer was never installed | `pnpm install`; the error names the package and the subpath that wanted it |
| five `FAIL` lines with no error line | the step ran but produced no answer | read the printed logs; the guest's own output is the run buffer |
| the process path fails to spawn | no interpreter on `PATH` under either name | install Python 3 and confirm `python --version` |
| exit 2 with a usage line and no check output | the backend argument is not one of the three | pass `process`, `docker` or `e2b`; the script prints its usage and exits 2 |

## What this does not prove

- The tool round trip. The check registers no tools, so the channel a guest would block on
  is established but never used. The package's own suite drives it with a real interpreter
  for the process backend and a fake kernel for Docker.
- The agent loop. This drives the executor, not a model, so nothing here checks how a
  result reaches a prompt.
- Network reach inside a guest. A backend reports what it mediates, not what the guest can
  reach; the process backend's child inherits this host's network, and no assertion here
  would notice.
