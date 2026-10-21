# e2b — competitor profile

**Contract**
- **Role:** competitor evidence for this repository only.
- **Mutability:** frozen once filed at the read commit.
- **Read when:** designing the capability this file records.
- **Update when:** a newer read supersedes it; never edit.

## Identity

| field | value |
|---|---|
| repository | https://github.com/e2b-dev/E2B |
| register row | Tier 2, depth D2, slug `e2b`; the register names it as the sandbox service our `exec-remote` E2B backend speaks to (`docs/research/competitors/README.md:71`) |
| licence | GitHub reports SPDX `Apache-2.0` and the root `LICENSE` is the Apache 2.0 text. The package manifests disagree: `packages/js-sdk/package.json:6`, `packages/code-interpreter-js/package.json:7`, `packages/desktop-js/package.json:5` and `packages/python-sdk/pyproject.toml:6` declare MIT, so repository licence and package metadata are not reconciled upstream |
| read commit | `7433b8c61641f9a1b2511a3a165141ab61018b9d`, committed 2026-10-20 17:49:10 +0000, subject `[skip ci] Release new versions` |
| clone | `reference/competitors/e2b`, shallow (`--depth 1`), worktree clean at the read |
| language and stack | TypeScript with Node `>=22.19.0` (`packages/js-sdk/package.json:102-103`); Python with `>=3.11` (`packages/python-sdk/pyproject.toml:8`). pnpm 10.34.5 workspace built with tsdown and tested with Vitest; Python through uv, pytest, ruff and ty |
| packages | nine directories: `js-sdk` (`e2b` 2.58.0), `python-sdk` (`e2b` 2.58.0), `code-interpreter-js` (2.9.0), `code-interpreter-python`, `desktop-js` (`@e2b/desktop` 2.5.0), `desktop-python`, `dockerfile-utils-js`, `dockerfile-utils-python`, `cli` |
| size signal | 52 source files under `packages/js-sdk/src` (11 of them generated from OpenAPI or protobuf) and 132 test files under `packages/js-sdk/tests` |
| documentation source | https://e2b.dev/docs is the published documentation site; the clone carries per-package READMEs and JSDoc, not the documentation tree |

## What it is

E2B is hosted sandbox infrastructure: a service that boots a hardware-isolated Linux
microVM from a template and hands the caller a shell, a filesystem and a code
interpreter inside it. It is not an agent framework and ships no model loop, no tools
and no prompt. It ships the machine an agent's code runs on, plus the SDKs that drive
that machine.

Four planes are visible in the clone. A management API (`spec/openapi.yml`) creates,
connects, lists, pauses, snapshots, forks and kills sandboxes. An in-guest daemon called
envd listens on port 49983 and exposes a ConnectRPC surface for processes and files
(`spec/envd/process/process.proto:5`, `spec/envd/filesystem/filesystem.proto:7`). A
Jupyter kernel on port 49999 serves stateful code execution for the Code Interpreter
SDK, which speaks HTTP and JSON to it directly rather than through envd. A volume
content service keeps data after a sandbox is gone, and volumes can be mounted into a
sandbox at named paths.

The repository is a monorepo of published packages generated over shared specs. The
specs are not authored here: `spec/README.md:3-12` records that the API and envd files
are synced with Copybara from the runtime and belt repositories, pinned by
`spec/runtime-ref` and `spec/belt-ref`, and that `make codegen` regenerates the clients.
Self-hosting is out of this repository entirely; the root README sends the reader to
`e2b-dev/runtime` and Terraform (`README.md:104-112`).

The product shape follows from that split: the cloud owns lifecycle, isolation and the
network edge, while the SDKs own convenience over two local transports. A caller that
only wants to run code touches the Jupyter plane; one that wants a shell touches envd;
one that wants sandboxes and templates touches the management API.

## Why it is in the register

Our `exec-remote` package has an E2B backend
(`packages/exec-remote/src/backends/e2b.ts`) that imports `@e2b/code-interpreter` as an
optional peer. Everything that backend can do is bounded by what the vendor SDK exposes
to it, and everything the vendor offers that the adapter ignores is a decision we have
made by omission. This profile is the evidence for those decisions.

It also matters for the execution family of the baseline. The rows EX-03 (remote
executors), EX-04 (capability bag), EX-05 (filesystem and shell workspace), EX-06
(network policy), EX-07 (state across steps) and EX-08 (snapshot and restore) all
describe a remote sandbox, and this is the one vendor in the tree whose whole product is
that sandbox. A D2 read is enough to price the distance without reverse-engineering a
platform we already decline to become.

Two questions the read answers: which lifecycle operations the SDK already offers that
our adapter never calls, and which of those a caller could reach through our seam
without a new dependency.

## How it is positioned against us

E2B is a platform: a hosted runtime, a control plane, a daemon, a kernel sidecar and a
family of client packages. This port is a library: one session, one program, executed by a guest
the caller chooses, with vendor SDKs kept behind optional peers. The overlap is the
execution seam and nothing else.

| family | e2b | this port at the baseline |
|---|---|---|
| shape | hosted sandbox service plus SDK packages for JavaScript, Python, desktop and the CLI | library-shaped runtime with pluggable executors |
| guest | microVM from a template, envd daemon plus Jupyter kernel | QuickJS, Pyodide, host process, Docker kernel or E2B behind one seam |
| workspace | files, directories, watchers, commands, PTYs and a git helper as first-class calls | absent; decision 0018 keeps a filesystem and shell workspace out (EX-05) |
| durability | pause with memory or filesystem only, snapshots, fork up to twenty, mounted volumes | checkpoint between steps only; no snapshot or restore (EX-08) |
| network | allow and deny egress, per-domain rules, SOCKS5 proxy, HTTPS port mapping | a declared capability value; no enforced policy behind the remote backend (EX-06) |
| lifetime | sandbox timeout extendable to one hour or twenty-four, plus per-execution body timeouts | one executor per run, disposed at the end, timeout fixed at construction |
| deployment | cloud or a self-hosted runtime with Terraform | embedded in the caller's process |

The useful comparison is not feature count. E2B's capability sits behind a seam we
already own, so a subset can be adopted per backend without adopting the platform. The
distance is a second transport and a handful of options, not an architecture.

## Limits of this read

- One shallow clone at a fixed commit: no history, no tags, no blame, and no view of
  earlier API shapes except where the source marks a deprecation.
- The read concentrated on `packages/js-sdk/src`, `packages/code-interpreter-js/src`,
  `spec/envd`, `spec/README.md` and the READMEs. The Python SDK, both desktop SDKs, the
  CLI, `templates/` and `skills/` were inspected only as manifests or read at the head;
  their internals are not evidence here.
- Nothing in the clone was installed, built, tested or executed. Behavioural claims are
  source-read, and behaviour that happens server-side inside E2B's cloud is marked
  declared or inferred rather than observed.
- The published documentation site was not fetched: the environment's web fetch failed
  with a provider-configuration error on 2026-10-21, so documentation claims here come
  from the clone's README or JSDoc and are declared evidence.
- No sandbox was created and no API key was used. The management API is described from
  the OpenAPI file and the generated schema, not from responses.

## What the rest of the folder records

`02-features-inventory.md` lists the capability set with per-row pointers, grouped by
the baseline families it can serve. `03-gap-and-lessons.md` buckets the distance from
that baseline and prices it, and names the patterns worth copying and one worth
refusing. `04-sources.md` records the commit, the licence check, the files read, the
commands run and what was not verified.

