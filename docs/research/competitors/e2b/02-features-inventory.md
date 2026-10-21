# e2b — features inventory

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

Strength words are used exactly: `implemented` means a source path was traced end to
end;
`declared` means a type, flag, README or JSDoc claims it and no path was traced;
`inferred`
means reasoning from structure, stated in the row. Rows are grouped by the baseline
family they
can serve, so the gap file can cite a row and a baseline id together. A D2 read records
the
capability set and spot-checks the source; it does not prove server-side behaviour.

## Sandbox lifecycle

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| SL-01 | Create a sandbox from a template | implemented | `packages/js-sdk/src/sandbox/index.ts:281-365`, `:310-323`; `packages/js-sdk/src/sandbox/sandboxApi.ts:700-729`, `:1828` | One management-API call carries template name or id, a timeout, env vars, a metadata map, network configuration and volume mounts; the response returns sandbox id, domain, envd version and access tokens | Later calls need reachability and credentials without another round trip |
| SL-02 | Connect to an existing sandbox, resuming a paused one | implemented | `packages/js-sdk/src/sandbox/index.ts:387-441`, `:484`; `packages/js-sdk/src/sandbox/sandboxApi.ts:2004` | Static and instance methods both POST to the connect endpoint; a paused sandbox is resumed as a side effect of the call | A serverless caller can hold only an id, and reconnection replaces a live handle |
| SL-03 | List sandboxes, paginated and filtered by metadata | implemented | `packages/js-sdk/src/sandbox/index.ts:264`; `packages/js-sdk/src/sandbox/sandboxApi.ts:849-853`, `:2081-2100`; `packages/js-sdk/src/paginator.ts` | `Sandbox.list` returns a paginator over the list endpoint; metadata filters are ANDed and travel as query parameters | Cleanup and dashboards must find sandboxes their process did not create |
| SL-04 | Kill a sandbox | implemented | `packages/js-sdk/src/sandbox/index.ts:645-654`; `packages/js-sdk/src/sandbox/sandboxApi.ts:1400` | Kill returns true when the sandbox was removed and false when it was already absent | Billing stops only when the caller says so |
| SL-05 | Extend or shorten the sandbox lifetime | implemented | `packages/js-sdk/src/sandbox/index.ts:602-616`; `packages/js-sdk/src/sandbox/sandboxApi.ts:1599` | A timeout call sets a new number of seconds; the documented ceiling is one hour on Hobby and twenty-four on Pro | A default lifetime kills long agent runs unless the host refreshes it |
| SL-06 | Health, info and metrics | implemented | `packages/js-sdk/src/sandbox/index.ts:569-591`, `:883`, `:894`; `packages/js-sdk/src/sandbox/sandboxApi.ts:1443`, `:1530` | The health probe goes through the envd proxy and maps a 502 to false; info returns template, metadata and start and end dates; metrics returns CPU, memory and disk samples over a time range | A caller must distinguish not-running from unreachable from slow |
| SL-07 | Typed errors for a dead or unreachable sandbox | implemented | `packages/js-sdk/src/errors.ts:23-37`, `:44`, `:67`, `:120` | Proxy 502 messages are classified into not-running, port-not-open and unknown, each carrying a remedy; `TimeoutError` names the layer that expired | The dominant failure of a hosted sandbox is that it no longer exists |
| SL-08 | Retry policy with replay safety | implemented | `packages/js-sdk/src/retry.ts:9`, `:14-50` | 429, 502 and 503 are retried with exponential backoff, jitter and `Retry-After`; POSTs are retried only for an explicit allowlist of idempotent operations | A hosted control plane fails transiently more often than it fails durably |
| SL-09 | Debug mode with a placeholder sandbox | implemented | `packages/js-sdk/src/sandbox/index.ts:325-333`, `:606-609`, `:648-651` | With debug set, create returns an instance with a fake id and no API call; timeout and kill become no-ops | Examples and tests can be written without an account |

## Code execution

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| EX-01 | Stateful `runCode` in a Jupyter context | implemented | `packages/code-interpreter-js/src/sandbox.ts:186-281`; `packages/code-interpreter-js/src/consts.ts:2` | The subclass posts JSON to the sandbox's Jupyter port with code, context id, language and env vars, then reads the response body as a line stream | Variables must survive between calls, as in a notebook |
| EX-02 | Language selection per call | declared | `packages/code-interpreter-js/src/sandbox.ts:41-42`, `:186-197` | A language string is forwarded with the execute request; the type lists Python, JavaScript, TypeScript, R, Java and Bash, and any string passes | One sidecar can serve several notebook kernels |
| EX-03 | Named contexts: create, list, remove, restart | implemented | `packages/code-interpreter-js/src/sandbox.ts:290`, `:331`, `:367`, `:406` | Each context is a resource on the Jupyter sidecar; a call names a context or the default one, and context and language are mutually exclusive | Isolate executions and dispose their state |
| EX-04 | Streaming output callbacks | implemented | `packages/code-interpreter-js/src/sandbox.ts:48-83`; `packages/code-interpreter-js/src/messaging.ts:327-379` | Every JSON line is dispatched by type to stdout, stderr, result or error callbacks, each awaited | A UI can render while execution continues |
| EX-05 | Rich result payloads | implemented | `packages/code-interpreter-js/src/messaging.ts:152-265` | A result carries text, HTML, Markdown, SVG, PNG, JPEG, PDF, LaTeX, JSON, JavaScript, data and chart fields, with `formats()` listing what is present and a main-result flag | The notebook display protocol, including charts and images |
| EX-06 | Execution error with traceback | implemented | `packages/code-interpreter-js/src/messaging.ts:284-313`, `:369-373` | An error line builds a typed error with name, value and traceback; the execution also exposes the main result text | Hosts show the failure the kernel saw |
| EX-07 | Aggregated logs and cell counter | implemented | `packages/code-interpreter-js/src/messaging.ts:270-279`, `:375-377` | stdout and stderr accumulate as arrays and the cell execution number is recorded | Downstream rendering mirrors notebook semantics |
| EX-08 | Two execution timeouts | implemented | `packages/code-interpreter-js/src/sandbox.ts:76-82`, `:199-208`, `:248-256`; `packages/code-interpreter-js/src/consts.ts:1` | A request timeout aborts until headers arrive; a body timeout aborts the stream after sixty seconds by default | A hung kernel must not hang the caller |
| EX-09 | Diagnose a sandbox death during a request | implemented | `packages/code-interpreter-js/src/sandbox.ts:443-454` | A failed request re-checks health; if the sandbox is gone the error names timeout and `setTimeout` as the remedy | The most common failure deserves an actionable message |

## Filesystem

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| FS-01 | Read a file as text, bytes, blob or stream | implemented | `packages/js-sdk/src/sandbox/filesystem/index.ts:404-463` | Four overloads select a format; the stream variant holds a pooled connection until it is consumed or cancelled | Large files must not be buffered whole |
| FS-02 | Write and batch-write files | implemented | `packages/js-sdk/src/sandbox/filesystem/index.ts:594-603`, `:813`; `packages/js-sdk/src/envd/versions.ts:6` | A write posts path and content with an optional user; batched writes share one request; octet-stream uploads are gated on an envd version | Artifacts must get into the sandbox cheaply |
| FS-03 | List, make directory, rename, remove, exists, stat | implemented | `packages/js-sdk/src/sandbox/filesystem/index.ts:828`, `:873`, `:907`, `:944`, `:969`, `:1002`; `spec/envd/filesystem/filesystem.proto:8-12` | Each call maps to one envd filesystem RPC; stat returns size, mode, dates and type | Workspace management is the shell's other half |
| FS-04 | Watch a directory | implemented | `packages/js-sdk/src/sandbox/filesystem/index.ts:1039`; `packages/js-sdk/src/sandbox/filesystem/watchHandle.ts:79`; `spec/envd/filesystem/filesystem.proto:14` | `watchDir` subscribes to a server stream of create, write, remove, rename and chmod events; recursive watch needs envd 0.1.4 or newer | Sync tools and hot reload need change events, not polling |
| FS-05 | Signed upload and download URLs | declared | `packages/js-sdk/src/sandbox/index.ts:782`, `:834`; `packages/js-sdk/src/sandbox/signature.ts` | URL builders can attach a signature with an expiration and a user, so a client transfers bytes without envd in the path | Large artifacts bypass the control plane |
| FS-06 | Git helper | declared, deprecated | `packages/js-sdk/src/sandbox/index.ts:92-97`; `packages/js-sdk/src/sandbox/git/index.ts` | The class is still exported and documented as removable in the next major version, with commands suggested instead | Historical convenience, now surface debt |

## Commands and processes

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| CM-01 | Run a shell command and collect its result | implemented | `packages/js-sdk/src/sandbox/commands/index.ts:410-421`, `:423-465` | The start RPC launches `/bin/bash -l -c <cmd>` as a process and the handle aggregates stdout, stderr and the exit code | Agents need an ordinary shell |
| CM-02 | Background command handle | implemented | `packages/js-sdk/src/sandbox/commands/index.ts:393-396`; `packages/js-sdk/src/sandbox/commands/commandHandle.ts:86-239` | With `background: true` the call returns a handle exposing pid, wait, kill, disconnect and typed exit errors | Servers and dev processes outlive one request |
| CM-03 | Interactive stdin: send, ordered stream, close | implemented | `packages/js-sdk/src/sandbox/commands/index.ts:202`, `:261`, `:282-287`, `:428-434`; `spec/envd/process/process.proto:14-15`, `:20`; `packages/js-sdk/src/envd/versions.ts:3`, `:5` | A command started with `stdin: true` keeps input open; `sendStdin` writes, `streamInput` preserves order and `closeStdin` signals EOF; envd before 0.3.0 keeps stdin always on and refuses an explicit `stdin: false`, and `closeStdin` needs envd 0.5.2 | REPLs and interactive programs need a write channel, not only output |
| CM-04 | PTY sessions | declared | `packages/js-sdk/src/sandbox/index.ts:88-91`; `packages/js-sdk/src/sandbox/pty.ts` | A separate module exposes pseudo-terminal sessions; only the field and module were located, not traced | Interactive shells and terminal emulation |
| CM-05 | List and attach to running processes | implemented | `packages/js-sdk/src/sandbox/commands/index.ts:170`, `:338`; `spec/envd/process/process.proto:7-8` | List returns process info; connect reattaches a stream to an existing pid | One caller can restart without losing a process |
| CM-06 | Keepalive pings on long streams | implemented | `packages/js-sdk/src/sandbox/commands/index.ts:457`; `packages/js-sdk/src/envd/streamingTransport.ts` | The start request carries a keepalive interval header and the transport pings the proxy for the life of the stream | A proxy idles out long builds otherwise |

## Persistence

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| PS-01 | Pause with a memory or filesystem mode | implemented | `packages/js-sdk/src/sandbox/index.ts:656-685`; `packages/js-sdk/src/sandbox/sandboxApi.ts:616-633`, `:1677` | Pause defaults to preserving memory and filesystem; filesystem-only drops memory so a resume cold-boots, losing processes and connections | Idle sandboxes cost money; a model turn may need the same machine later |
| PS-02 | Snapshots: create, list, delete, boot from one | implemented | `packages/js-sdk/src/sandbox/index.ts:687-744`; `packages/js-sdk/src/sandbox/sandboxApi.ts:1744`, `:1787`, `:1799` | Creating a snapshot pauses the sandbox briefly and returns an id usable as a template; snapshots persist past sandbox deletion and a filesystem-only mode is gated by team and node support | Save a configured workspace and start others from it |
| PS-03 | Fork up to twenty copies from one snapshot | implemented | `packages/js-sdk/src/sandbox/index.ts:443-545`; `packages/js-sdk/src/sandbox/sandboxApi.ts:662-673`, `:1942` | Fork captures one snapshot and boots N sandboxes from it; every fork reports success or its own error | Parallel rollouts and branches of the same starting state |
| PS-04 | Persistent volumes mounted at paths | declared | `packages/js-sdk/src/sandbox/sandboxApi.ts:777-784`, `:1910`; `packages/js-sdk/src/volume/index.ts:200-267` | Create accepts a map of path to volume; the Volume resource lists, describes and destroys volumes; mount semantics live server-side and were not traced | Data must outlive every sandbox that used it |
| PS-05 | Metadata as durable tags | implemented | `packages/js-sdk/src/sandbox/sandboxApi.ts:709-713`, `:987`; `packages/js-sdk/src/sandbox/index.ts:883` | A string map travels at create, comes back from info and filters a list | Attribution without a side database |

## Network policy

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| NW-01 | Allow and deny egress | implemented | `packages/js-sdk/src/sandbox/sandboxApi.ts:257-320`; `packages/js-sdk/src/sandbox/network.ts` | Create accepts allow and deny selectors as address lists or functions; `ALL_TRAFFIC` is a named constant; the proxy enforces them server-side | Least-privilege egress for untrusted code |
| NW-02 | Per-domain rules with transforms | implemented | `packages/js-sdk/src/sandbox/sandboxApi.ts:46-110`, `:320` | A rule map keys a host, CIDR or IP to rules whose transform injects headers; values may be IAM placeholders the proxy resolves per request | Inject identity at the edge rather than in the guest |
| NW-03 | SOCKS5 egress proxy | implemented | `packages/js-sdk/src/sandbox/sandboxApi.ts:176-345` | Create accepts a proxy address, credentials and TLS settings; TCP is tunnelled while QUIC and HTTP/3 are documented as not tunnelled | Bring-your-own egress audit and policy |
| NW-04 | Update the policy of a live sandbox | implemented | `packages/js-sdk/src/sandbox/index.ts:627-636`; `packages/js-sdk/src/sandbox/sandboxApi.ts:1640` | An update replaces the whole egress configuration atomically; omitted fields are cleared | Revoke or widen access mid-run |
| NW-05 | Restricted public traffic and HTTPS ports | implemented | `packages/js-sdk/src/sandbox/index.ts:110-115`, `:547-567`; `packages/js-sdk/src/sandbox/sandboxApi.ts:348-375` | A traffic token header gates access to a sandbox service; selected ports map to the proxy over TLS | Expose a sandbox service without publishing it |

## Access, secrets and identity

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| AC-01 | Client object with per-instance configuration | implemented | `packages/js-sdk/src/client.ts:40-92`; `packages/js-sdk/src/index.ts:167-170` | `new E2B({apiKey, domain})` builds subclasses with bound options; top-level exports read the environment instead | A host process may hold several tenants or keys |
| AC-02 | Secrets resource | declared | `packages/js-sdk/src/secret.ts`; `packages/js-sdk/src/index.ts:107` | A secret resource is exported next to sandbox, volume and template; the module was located but not traced | Templates consume credentials the caller must not embed |
| AC-03 | Workload identity tokens for egress | declared | `packages/js-sdk/src/sandbox/iam.ts`; `packages/js-sdk/src/sandbox/sandboxApi.ts:66` | Tokens are named in an IAM option and injected into rule transforms as placeholders | Cloud identity without shipping static keys |

## Templates

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| TM-01 | Build a template from a Dockerfile | implemented | `packages/js-sdk/src/template/index.ts:135-272`; `packages/js-sdk/src/template/dockerfileParser.ts`; `packages/dockerfile-utils-js` | Build, build-in-background, status polling, existence checks, alias checks and tags exist; a Dockerfile parser with an exported syntax error ships beside them | A sandbox's image is its contract with the code that runs in it |
| TM-02 | Template DSL and start and ready commands | declared | `packages/js-sdk/src/template/index.ts:98-113`; `packages/js-sdk/src/template/readycmd.ts`; `packages/js-sdk/src/template/types.ts` | A typed template object serialises to a Dockerfile; start and ready commands describe boot and liveness | Reproducible images across SDKs |

## Client, transport and SDK family

| id | capability | strength | evidence | how it works | why it exists |
|---|---|---|---|---|---|
| RT-01 | Generated clients over shared specs | implemented | `spec/README.md:3-12`; `packages/js-sdk/src/api/schema.gen.ts` | The API, envd and volume specs are byte-identical copies from other repositories, pinned by refs and regenerated by a make target | One definition of the wire contract for every SDK |
| RT-02 | Runtime portability for the JavaScript SDK | declared | `packages/js-sdk/package.json` test scripts for Bun, Deno and Cloudflare; `packages/js-sdk/src/api/http2.ts`, `packages/js-sdk/src/undici.ts` | Per-runtime transports and four test targets are configured; the selection path was located, not traced | Serverless and edge hosts are a primary deployment shape |
| RT-03 | MCP gateway started inside a sandbox | implemented | `packages/js-sdk/src/sandbox/index.ts:78`, `:343-361`, `:752` | A create option starts an MCP gateway process in the guest, mints a token and returns the gateway URL; failure kills the sandbox | Expose sandbox tools to MCP clients from one call |
| RT-04 | Desktop and computer-use SDKs | declared | `packages/desktop-js/package.json:2`; `packages/desktop-js/README.md:38-46`, `:129-133` | A separate package and subclass launch applications and stream a window; the README is the evidence, the implementation was not read | Computer-use agents need screens and input |
| RT-05 | Python SDK parity | declared | `packages/python-sdk/pyproject.toml:1-24`; `CLAUDE.md` parity note read as content | The Python distribution mirrors the JavaScript surface and its dependencies include the same ConnectRPC and HTTP/2 stack; parity is a project rule, not a traced mechanism | Polyglot teams and Python-first data work |

## Notable implementation notes

Two transports, two failure domains. Lifecycle, template, volume and secret calls go to
the
management API over HTTP/2 with retries; filesystem and process calls go to the sandbox
proxy on
port 49983 over ConnectRPC; code execution goes to the Jupyter sidecar on 49999. The SDK
chooses a
transport per runtime (`packages/js-sdk/src/api/http2.ts`,
`packages/js-sdk/src/envd/http2.ts`,
`packages/js-sdk/src/undici.ts`), which is why the client has more than one timeout and
more than
one error path.

Capability gating by envd version, not by feature flag. Constants in
`packages/js-sdk/src/envd/versions.ts:1-9` name the minimum daemon version for recursive
watch,
stdin, default users, close-stdin, octet-stream upload and file metadata; call sites
compare the
version and refuse with a message that says to rebuild the template
(`packages/js-sdk/src/sandbox/commands/index.ts:428-434`). Templates are long-lived, so
an old
guest meeting a new SDK is a normal case rather than an edge case.

Generated surface. Eleven of the 52 files under `packages/js-sdk/src` are generated
clients or
schemas, and `spec/README.md` says the specs are re-fetched before codegen and a CI
check fails
when the tracked copies drift from their pins. For a reader this means line numbers in
generated
files describe the wire contract, not a design decision, and a spec change moves them.

Timeout layering. A create timeout is the sandbox's lifetime; connect and request
timeouts bound
one call; the body timeout bounds the streaming phase of a code execution; a command has
its own
start timeout; a stream can have an idle timeout. Only the body and stream timeouts
cover the phase
in which most wall-clock time is spent, which is why the death of a sandbox during a
stream is
diagnosed separately (EX-09).

Retry policy is method-shaped. `packages/js-sdk/src/retry.ts:32-50` excludes POSTs that
mint a
resource — sandbox, fork, snapshot, volume, secret — because a replay could duplicate
it, and
allows only operations whose replay is a no-op or a tolerated 404 or 409. This is an
idempotence
analysis written next to the retry loop, not a generic retry library.

Access tokens guard the data planes. Create returns an envd access token and a traffic
access
token (`packages/js-sdk/src/sandbox/sandboxApi.ts:675-681`), and the code interpreter
sends both on
every execution request (`packages/code-interpreter-js/src/sandbox.ts:210-221`).
Restricted public
traffic is a create option rather than a separate gateway.

The platform is bigger than the seam. Templates, snapshots, fork, volumes, secrets, IAM
tokens, an
MCP gateway, a CLI and two desktop SDKs sit around the sandbox; none of them is needed
to run code
in one. For our backend the relevant columns are the lifecycle rows, the code-execution
rows and
the stdin half of the command section, and the rest is recorded here so a later decision
can see
what was declined.

What this inventory leaves out: the self-hosted runtime repository, cloud billing, teams
and
quotas, the internal build system behind templates, the sync and async duplication
inside the
Python SDK, and desktop automation internals. They exist in the clone's orbit, not in
its source
here, and a D2 read does not price them.

