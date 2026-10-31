# @smolagents-ts/exec-remote

## 0.1.0

### Minor Changes

- Harden the remote sandbox backends and the frame protocol: a per-run frame nonce, an unprivileged, capability-free, read-only Docker guest with a CPU cap and a noexec `/tmp`, a base image pinned by digest, and a forced stop that does not wait out a grace period the guest ignores.

- 7c65fe8: Add the remote Python executor backends.

  `@smolagents-ts/exec-remote` satisfies the core `CodeExecutor` seam for
  `language: "python"` over three backends: a local child process behind
  `/process`, a Docker-hosted Jupyter Kernel Gateway behind `/docker`, and an
  E2B sandbox behind `/e2b`. The two vendor clients are optional peers, never
  regular dependencies.
