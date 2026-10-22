# 0021 — the Docker backend reaches its guest over exec, so deny-all can be enforced

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** changing the Docker backend's transport, or asking why it no
  longer publishes a port.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-22
- **Decided by:** owner, asked which way the Docker backend should close its egress gap
- **Supersedes:** 0020 (its Docker clause only; the four capability clauses and the output application stand)

## Context

Decision 0020 gave the executor a `egress` policy axis and made the E2B
backend enforce deny-all. It made the Docker backend refuse instead, because the
backend reaches its kernel over a published HTTP port: the image runs Jupyter
Kernel Gateway and the host connects a WebSocket to `127.0.0.1:<published port>`
(`packages/exec-remote/src/backends/docker.ts:25-36`, `:128-152`). A container
with no network namespace cannot serve that port, so `--network none` and the
control path were mutually exclusive.

The owner chose the transport change over the refusal: Docker is the backend a
team runs beside its own service, and it is the one that should be able to say
"this guest cannot reach the network" and mean it. The same backend already
depends on the kernel's stdin channel for the tool round trip
(`packages/exec-remote/src/docker.ts:23-25`), and `docker exec -i` supplies
that channel directly.

## Decision

The Docker backend runs its guest through one long-lived `docker exec -i`
Python process speaking the existing host-owned frame protocol over stdio. The
container is created with a network mode derived from the egress policy
(`none` for deny-all, the default bridge otherwise) and publishes no port. The
image builds on `python:3.12-bullseye` without Jupyter, readiness is a handshake
frame rather than an HTTP poll, and the `ContainerRuntime` seam gains an exec
session and a network mode while losing `endpoint()`.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| **Keep the refusal 0020 recorded** | Truthful but thin: the one locally isolated backend would be the one that cannot confine, and a team asking for deny-all would be told to change backends. |
| **A sidecar proxy or firewall container** | Adds a second daemon and a network path to configure, and it is the platform shape decision 0018 refuses; it also cannot be exercised in CI. |
| **Keep Jupyter for unmanaged runs and use exec only for deny-all** | Two transports and two failure modes in one backend, with the tool round trip implemented twice; a transport choice that changes with an option is the special-casing the plan's rules forbid. |

## Consequences

**Positive**

- Deny-all becomes enforceable on two of the three remote backends, and the
  third (the process backend) refuses truthfully.
- The image loses the Jupyter wheels, so it builds faster and smaller, and no
  port is published to the host.
- The tool round trip keeps working: the exec stdin is the same blocking channel
  the Jupyter kernel's stdin was.
- The Docker backend stops depending on a second server inside the container,
  which removes a readiness poll, a token and a WebSocket client from the path.

**Negative / accepted costs**

- It is an L-sized transport rewrite, so the enforcement lands in Phase 4.8, not
  in Phase 0; Docker keeps refusing until it does.
- Interrupting a guest becomes a signal to a process inside the container rather
  than an HTTP call, and killing the exec client does not by itself kill the
  guest, so cancellation needs an explicit kill path.
- `jupyter.ts` (362 lines) and the WebSocket and fetch options on
  `DockerSandboxOptions` are deleted, which is a breaking change to the docker
  subpath — free while nothing is published.
- The stdio hijack buffers, so the frame reader must handle partial lines and
  interleaved guest output; a test double now has to model a duplex stream.

## Reversibility

Moderate and contained: the transport is internal to the docker subpath, so a
reversal restores `jupyter.ts` and the port binding without touching the seam
or any other backend. It must be decided before 0.1.0 publishes, because the
deleted options are public on that subpath.

## Follow-up

- [ ] **Phase 0.4** — ship the policy axis and E2B enforcement; Docker refuses
  deny-all until 4.8 lands, exactly as 0020 recorded.
- [ ] **Phase 4.8** — the exec transport: exec session on the runtime seam, a
  network mode on container creation, a handshake instead of the readiness poll,
  `jupyter.ts` deleted, a fake-runtime test asserting no port bindings and
  network mode `none` under deny-all.
- [ ] **Component docs** — update the Docker hazards in
  `packages/exec-remote/AGENTS.md` and `rules/components/exec-remote.md` when
  the transport lands, since both describe the kernel's stdin channel.
