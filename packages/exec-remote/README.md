# @smolagents-ts/exec-remote

Remote Python backends for the core `CodeExecutor` seam. **Node-only**: every entry point
reaches Node builtins or a Node-only vendor client, so this package is never bundled for a
browser. The root entry carries no Node builtin and no vendor import, so importing
`@smolagents-ts/exec-remote` alone resolves with neither optional peer installed.

## Entries

| entry | backend | peer |
|---|---|---|
| `@smolagents-ts/exec-remote/process` | a real child process running a local interpreter | none |
| `@smolagents-ts/exec-remote/docker` | a Docker-hosted Jupyter Kernel Gateway | `dockerode` |
| `@smolagents-ts/exec-remote/e2b` | an E2B sandbox | `@e2b/code-interpreter` |

`dockerode` and `@e2b/code-interpreter` are **optional peer dependencies**: a default
install pulls neither, and the root entry resolves without them. Importing a subpath whose
peer is absent fails with a typed error naming the peer instead of a module-resolution crash.

## Capabilities per backend

| backend | `isolation` | `network` | `timers` | `asyncToolCalls` |
|---|---|---|---|---|
| process | `"process"` | `"direct"` | `false` | `false` |
| docker | `"remote"` | `"direct"` | `true` | `false` |
| e2b | `"remote"` | `"direct"` | `true` | `false` |

The process backend is not a sandbox: it is a local child with the host's privileges and the
host's network — hence `network: "direct"` rather than `"none"` — and its guest can
monopolise its own CPU, so no host-side timer is enforceable there. Its child environment is
an allow-list (`PATH`, `SYSTEMROOT`, the temp and locale names, …) rather than a copy of
`process.env`, so a step cannot read this host's credentials unless `envPassthrough` names
them; `env` still wins for explicit overrides. Docker and E2B are remote and their host owns a
channel it can abort; the Docker backend also caps each container's memory (512 MiB) and pid
count (256) by default, and builds the gateway's `CMD` for the configured `containerPort`.

## Logs

`logs` is upstream's `truncate_content`: at most 50,000 characters, the head and the tail
with a marker where the middle was dropped. The buffer behind it is bounded at write time
(1 MiB per run, keeping the head and the tail), so a guest that keeps printing cannot grow
this process's memory without limit.

## The `allowPickle` divergence

Upstream's `RemotePythonExecutor` accepts a `pickle:` final-answer payload by default and
unpickles it on the host. This package defaults `allowPickle` to `false` and refuses a
`pickle:` payload with a typed error, because a compromised guest could otherwise make the
host execute attacker-chosen opcodes. With `allowPickle: true` the payload is passed through
as raw bytes; the host never executes pickle opcodes.

## Testing

```
pnpm vitest run --project exec-remote
```

No test reaches an external network, a daemon or a credential. The process suite runs a real short-lived
child interpreter; Docker is driven through an injected `ContainerRuntime` double plus a
loopback HTTP/WebSocket Jupyter server; E2B is driven through a doubled `E2BClient`.
