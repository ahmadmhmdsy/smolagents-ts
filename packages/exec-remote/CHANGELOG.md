# @smolagents-ts/exec-remote

## 0.1.0

### Minor Changes

- 7c65fe8: Add the remote Python executor backends.

  `@smolagents-ts/exec-remote` satisfies the core `CodeExecutor` seam for
  `language: "python"` over three backends: a local child process behind
  `/process`, a Docker-hosted Jupyter Kernel Gateway behind `/docker`, and an
  E2B sandbox behind `/e2b`. The two vendor clients are optional peers, never
  regular dependencies.
