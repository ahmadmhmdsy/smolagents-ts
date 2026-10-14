---
"@smolagents-ts/exec-remote": minor
---

Add the remote Python executor backends.

`@smolagents-ts/exec-remote` satisfies the core `CodeExecutor` seam for
`language: "python"` over three backends: a local child process behind
`/process`, a Docker-hosted Jupyter Kernel Gateway behind `/docker`, and an
E2B sandbox behind `/e2b`. The two vendor clients are optional peers, never
regular dependencies.
