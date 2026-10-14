# Component rule: exec-remote

**The process backend is not a sandbox.**
It runs an interpreter on this host, with this host's filesystem and this host's
reach. The package says so wherever it is described, and no document may call
that backend isolated. The Docker and E2B backends are remote, which states where
the interpreter runs rather than what it can reach. The seam's `network` field
records what this package mediates, so the process backend's `"none"` is not a
claim that its child is without a network, and no reader may take it for one.

**The seam stays the only coupling.**
Only the modules under `src/backends/` may name a Node builtin or a vendor
client, so the root entry stays importable wherever the core is. The package
depends on the `CodeExecutor` interface and never on the agent loop, and it
re-exports no core type.

**An absent peer fails loudly.**
A subpath whose optional client is not installed raises a typed error that names
the peer, the subpath and the alternative. It never falls back to another
backend and never degrades into a silent no-op.

**A round trip is claimed only where one exists.**
`supportsToolRoundTrip` is true for the backends whose guest pauses on its
stdin and awaits the host, and false for the one whose execution is a single
shot. A guest that reaches for a tool where the flag is false receives a typed
refusal naming the tool, and no backend pretends a round trip it cannot finish.
Separately, the executor reports the core's `asyncToolCalls` as false for every
backend, because a guest blocked on its stdin leaves no awaited host promise to
settle.

**Nothing in the suite reads a credential or reaches a network.**
Each backend is driven through an injected double. The live paths are procedures
under `docs/10-runbooks/`, never gate stages, and no test file opens a secret.
