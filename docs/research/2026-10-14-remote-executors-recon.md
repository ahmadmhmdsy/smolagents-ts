# Reconnaissance — the remote executors

- **Task:** T-13's Task 5, the `exec-remote` package family
- **Owner:** this session
- **Measured:** 2026-10-14, in a scratch directory outside the repository
- **Scratch:** `%TEMP%\remote-exec-recon`

## Contract

- **Role:** the evidence behind Task 5, which adds remote `CodeExecutor`
  backends under the design's `remote` isolation, porting upstream's
  `remote_executors.py`.
- **Mutability:** append-only once filed; each measurement is pinned to the
  versions it was read at.
- **Read when:** writing Task 5's plan, or re-checking which backends cost what,
  which are Node-only, and which can be tested without a live service.
- **Update when:** a client's version or engine range changes, the core executor
  contract changes, or upstream's backend list changes.

## Question

Which of upstream's four remote backends can a first TypeScript release ship,
what does each require at run time, and how can each be tested offline?

## What a remote executor must supply

`packages/core/src/executor.ts` is the only shape to satisfy; it already carries
`"remote"` in `ExecutorIsolation` (executor.ts:6), so no core change is needed.

- `language: "python"` for the upstream port; `ExecutorLanguage` also admits
  `"javascript"`, which none of the four runs.
- `capabilities: ExecutorCapabilities` (executor.ts:9–22): `isolation: "remote"`,
  `network: "direct"` (the guest reaches the network, as `pip` needs) and
  `timers: true`. `asyncToolCalls` is the consequential one: upstream's tools
  are defined **inside** the sandbox and run there, so the host never settles an
  awaited promise; the honest value is `false` unless the port adds a bridge.
- `execute(code, options): Promise<CodeResult>` (executor.ts:69). `ExecuteOptions`
  (executor.ts:35–44) hands in the `ToolRegistry`, a `FinalAnswerSink`, an
  `AbortSignal`, `timeoutMs`, `onToolCall` and `onLog`; `CodeResult`
  (executor.ts:46–53) carries `logs`, `isFinalAnswer`, `value`, `error`,
  `durationMs` and `toolCallCount`.
- `dispose?(): Promise<void>` (executor.ts:70) is called once per run; the
  sandbox must stay alive across steps and `dispose` must destroy it
  (executor.ts:55–65; design D14).

No `authorizedImports` field exists, so import policy is a package option; and
because the tools arrive on every `execute` call, upstream's `send_tools` and
`send_variables` become work inside `execute`, not contract members.

## Upstream's shape: `smolagents/src/smolagents/remote_executors.py`

Four classes over one base, exported at line 42: `E2BExecutor`,
`DockerExecutor`, `ModalExecutor`, `BlaxelExecutor`. `RemotePythonExecutor`
`(PythonExecutor)` defines the lifecycle.

| member | line | what it does |
|---|---|---|
| `__init__` | 70 | stores imports, logger, `allow_pickle`; no I/O |
| `run_code_raise_errors` | 82 | **abstract**; raises `NotImplementedError` |
| `send_tools` | 94 | patches `final_answer`, installs each tool's `requirements` (PIL→pillow), then runs `get_tools_definition_code` in the sandbox |
| `send_variables` | 115 | serializes with `SafeSerializer`, runs a `_deserialize` + `locals().update` snippet |
| `__call__` | 133 | delegates straight to `run_code_raise_errors` |
| `install_packages` | 137 | runs the remote magic `!pip install ...` |
| `_patch_final_answer_with_exception` | 143 | rewrites `FinalAnswerTool.forward` to raise a `BaseException` subclass carrying the serialized value (279–283) |
| `_deserialize_final_answer` | 306 | parses the `safe:` / `pickle:` prefix |

`cleanup`, `delete` and `_wait_for_server` are **not** on the base; each backend
defines them. No timeout or abort logic exists anywhere in the file.

### What each backend does differently

| backend | construct | execution | teardown | notes |
|---|---|---|---|---|
| E2B (335) | `Sandbox.create(**kwargs)`, falling back to `Sandbox(**kwargs)` for v1 (367–370) | vendor `sandbox.run_code(code)` (384); reads `logs.stdout`, `execution.error`, image/table results (408–436) | `sandbox.kill()` (438–447) | no `delete` or readiness poll; error name matched against `FinalAnswerException` (390) |
| Docker (551) | builds an image from the inline Dockerfile (595–604), `docker.from_env()` (608), `containers.run(detach=True, ports={8888/tcp: (host, port)})` (639–652) | WebSocket to the Jupyter kernel (689–692) | `container.stop()` + `remove()` (694–704); `delete` calls cleanup (706) | polls container status (654–659), waits on `/api/kernelspecs` (710–723) |
| Modal (726) | `modal.Image.debian_slim().uv_pip_install(...)` (770), `modal.Sandbox.create` (799) | WebSocket over an encrypted tunnel (804–810, 823–826) | `sandbox.terminate()` (828–831); `delete` calls cleanup (833) | up to 60 readiness retries (837–851); token via `modal.Secret` (783–789) |
| Blaxel (859) | `create_sandbox.sync` (953–961) | WebSocket with vendor auth headers (976–980) | `delete_sandbox.sync` (1041–1047), idempotent via a flag (1049–1065) | overrides `install_packages` to POST a process and poll it (982–1039); has `__del__` (1071) |

Docker, Modal and Blaxel share the Jupyter Kernel Gateway protocol:
`_create_kernel_http` (532–548) POSTs to `/api/kernels?token=...` expecting 201
and an `id`; `_websocket_send_execute_request` (450–478) builds the frame;
`_websocket_run_code_raise_errors` (481–525) reads stream / execute_result /
error / status. E2B bypasses all of it.

## Docker: authentication, protocol and teardown

- Token: `secrets.token_urlsafe(16)` (645), handed to the container as the
  `KG_AUTH_TOKEN` environment variable (646–650), then appended to every HTTP and
  WebSocket URL (667–668).
- Readiness: `GET /api/kernelspecs?token=...` must answer 200, ten tries one
  second apart (710–723). Kernel: `POST /api/kernels?token=...` must answer 201,
  and the body's `id` selects the kernel the WebSocket connects to (532–548,
  667–668). Execution: one WebSocket per `run_code` call, token in the URL
  (668, 689–692). Teardown: `stop()` then `remove()` (699–700); `delete`
  (706–708) is just `cleanup`.

## Candidate clients, measured

Run in the scratch directory:

    $ npm view <pkg> version license engines time.modified dist.unpackedSize dist.fileCount type main exports browser
    $ npm view <pkg> dependencies --json

| package | version | licence | engines | deps | unpacked | files | last publish |
|---|---|---|---|---|---|---|---|
| `dockerode` | 5.0.1 | Apache-2.0 | node >=14.17 | 6 | 165,022 B | 27 | 2026-06-24 |
| `@e2b/code-interpreter` | 2.9.0 | MIT | node >=22.19.0 | 1 | 158,626 B | 9 | 2026-10-13 |
| `e2b` | 2.56.0 | MIT | node >=22.19.0 | 11 | 2,746,204 B | 9 | 2026-10-13 |
| `modal` | 0.11.0 | Apache-2.0 | *(none)* | 6 | 5,511,411 B | 6 | 2026-09-29 |
| `@blaxel/core` | 0.3.29 | MIT | node >=18 | 13 | 4,012,072 B | 616 | 2026-10-13 |
| `ws` | 8.22.0 | MIT | node >=10 | 0 | 151,410 B | 19 | 2026-09-26 |

`modal` is the **official** Modal Labs JavaScript SDK (repository
`modal-labs/modal-client`, maintainers at `modal.com`); no `@modal-labs/modal`
package exists. `@e2b/code-interpreter` is a thin wrapper whose sole dependency
is `e2b`. `node:child_process` needs no package: a process executor spawns a
local Python interpreter, and it has no counterpart in this upstream file.

`e2b` and `@e2b/code-interpreter` require **node >=22.19.0**, while the
repository and every existing package declare `node >=22.12`. This machine runs
v24.18.0, so it passes locally, but the plan must either raise the shared floor or
accept a dependency demanding a newer Node than the repo advertises.

## Node-only or browser-safe

| package | `browser` field | node builtins imported | verdict |
|---|---|---|---|
| `dockerode` | absent | `crypto, events, fs, path, util, zlib` | Node-only |
| `@e2b/code-interpreter` | absent | none in its own files | Node-only via `e2b` |
| `e2b` | absent | `node:crypto, node:fs, node:os, node:path, node:stream, node:url` | Node-only |
| `modal` | absent | `node:console, node:crypto, node:fs, node:fs/promises, node:os, node:path, node:stream` | Node-only |
| `@blaxel/core` | `./dist/esm-browser/index.js` | `node:crypto, node:fs, node:http, node:os, node:path, node:tls`, plus `http2` | hybrid; server paths reach Node builtins |

Every backend must therefore live behind its own package or subpath, so a browser
consumer that imports the core never pulls one of these.

## The Docker runtime and doubling it

The live path needs: a Docker daemon socket (dockerode defaults to
`/var/run/docker.sock`, and also accepts a `{host, port}` TCP daemon); an image
built from `python:3.12-bullseye` plus `jupyter_kernel_gateway jupyter_client
ipykernel` (upstream 595–604); a published container port 8888 (639–642); and the
token and kernel id above. Here the Docker CLI is present at v28.3.2 but no
daemon is reachable — no `//./pipe/docker_engine`, no `/var/run/docker.sock`,
and `docker version` fails — so the live path was not exercised.

Two seams let a test avoid the daemon; V15-R3's mitigation needs one of them:

1. **Docker Engine API.** dockerode talks HTTP to the socket or a TCP host, so a
   fake Engine API server can stand in. Not exercised here.
2. **Jupyter Kernel Gateway.** A local HTTP server answering
   `GET /api/kernelspecs` 200 and `POST /api/kernels` 201 `{id}`, plus a
   WebSocket server speaking the `execute_request` subset, lets the real
   transport run with no container. The in-repo precedent is the MCP package's
   injected transport seam (`packages/mcp/src/transport.ts`) and its
   recorded-fixture suite. Not exercised here.

Either way the live path belongs in a runbook, as risk V15-R3 states.

## Which backends a first TS release should ship

Of upstream's four, **ship Docker and E2B; leave Modal and Blaxel.** The plan's
process executor is a fifth, upstream-independent backend that can ship beside
Docker because it needs no third-party client.

- **Docker — ship first.** No credential and no vendor account, the shared
  Jupyter protocol, and the only backend doubleable offline. Cost: the heaviest
  run time (daemon, image build, port) and the most code.
- **E2B — ship second.** The first-party TypeScript SDK is MIT, actively
  released, and its `run_code` result maps closely onto `CodeResult`. Cost: an
  API key and network, so tests need a double and the live path a runbook; its
  engine floor is above the repo's.
- **Modal — leave.** Official SDK, but a 5.5 MB gRPC bundle and a Modal account
  and token; it reuses the Jupyter protocol Docker already covers. Cost: the
  Modal audience.
- **Blaxel — leave.** Third-party, 13 dependencies and 616 files, and upstream's
  support is thin (a bespoke process-POST `install_packages`). Cost: the Blaxel
  audience.

One package, `exec-remote`, with per-backend subpaths and each vendor client an
optional peer (design section 5.2 already names `dockerode` as one), keeps the
browser and default builds free of all of them.

## Risks and unknowns

| # | the plan must decide | evidence |
|---|---|---|
| 1 | the Node engine floor: `e2b` wants >=22.19.0, the repo declares >=22.12 | measured |
| 2 | whether every backend is its own package or a subpath, so no browser bundle pulls one | measured |
| 3 | how a timeout and `AbortSignal` are added when upstream has neither | source |
| 4 | how the final answer crosses: a thrown remote exception plus a deserializer, or a return value | source |
| 5 | whether `allow_pickle` ships at all, given that it is an arbitrary-code path | source |
| 6 | which doubles the tests drive (Engine API vs Jupyter vs vendor RPC) | reasoned, not exercised |
| 7 | how host tools are exposed, if `asyncToolCalls` is to be true | not measured |
| 8 | how much of a 5.5 MB Modal or 4 MB Blaxel client a consumer accepts | measured |

## Not measured

- A live Docker, E2B, Modal or Blaxel execution; no daemon is reachable and no
  credential was read.
- An actual injected double for either seam (Engine API or Jupyter), and whether
  it runs the executor end to end.
- A real browser bundle of any client; the verdict above is from manifest fields
  and shipped imports, not from a build.
- The transitive installed size and platform support of the three Node clients.
