# Research — the cost of adding a provider adapter

**Contract**

- **Role:** prices the two in-repo ways to add a provider adapter — a file inside
  `@smolagents-ts/models` and a new package — against the seam that must be
  implemented, and records the test-and-validation pattern. Read before opening
  a provider-integration task; this is the evidence, not a plan.
- **Mutability:** frozen once filed. Pinned to the revision it was read at; a
  later change is a new record, not an edit here.
- **Read when:** someone asks "can we add provider X", or what a gateway adapter
  would cost.
- **Update when:** the `Model` seam, the models package surface, or the release
  checklist (pack smoke, version sync, component table) changes.

- **Owner:** models-layer-researcher (delegated, shared task `task-2`)
- **Started:** 2026-10-21T18:43:43+03:00
- **Revision read:** `59b295f` — the working tree also held other writers' edits
  to `docs/05-memory.md`, `docs/memory/general.md` and `docs/research/competitors/`,
  which this record does not depend on.
- **Verification:** source read only. No build and no test was run for this
  record; the counts quoted from the scoped entry
  (`packages/models/AGENTS.md:28-34`) were not re-measured.

## (a) The `Model` contract, in brief

`packages/core/src/model.ts:80-89` is the whole seam. A provider supplies
`id`, a free-text `provider` label, `capabilities`, and two methods:

| member | shape | evidence |
|---|---|---|
| `id` | the provider's model id; a blank one is refused | `packages/core/src/model.ts:81`; `packages/models/src/openai-compatible.ts:213-217` |
| `provider` | a label for the run; there is no enum or registry | `packages/core/src/model.ts:82`; `packages/models/src/openai-compatible.ts:218` |
| `capabilities` | `{streaming, toolCalls, images, structuredOutput}` via `modelCapabilities()` | `packages/core/src/model.ts:60-65`, `:91-100` |
| `generate` | `Promise<ChatCompletion>` — `content`, `toolCalls`, `usage`, `finishReason` only | `:84`, `:13-18` |
| `generateStream` | `AsyncIterable<ChatCompletionChunk>` — `delta`, `toolCallDelta?`, `finishReason?`, `usage?` on the final chunk | `:85-88`, `:27-36` |

`GenerateOptions` carries `systemPrompt`, `tools`, `stopSequences`,
`temperature`, `maxTokens` and `signal`
(`packages/core/src/model.ts:67-74`); the abort signal reaches `fetch` through
`postJson` (`packages/models/src/transport.ts:42-49`) and both adapter calls
(`packages/models/src/openai-compatible.ts:233`, `:250-252`). `FinishReason` is
four values — `stop`, `tool_calls`, `length`, `other`
(`packages/core/src/model.ts:11`) — and every wire vocabulary is translated
into them. Retry, budget and credential lookup are deliberately *not* members:
an adapter is data, not policy (`rules/components/models.md:3-5`).

The names `ModelCallOptions` and `ModelResult` do not exist anywhere in
`packages/`; the equivalents are `GenerateOptions` and `ChatCompletion`.

---

## (b) What a new package costs

There are two ledgers: the context-pack validator and the release gate. Every
row below is a required file or edit, with the code that would fail without it.

### Context-pack ledger (`python scripts/validate_context.py`)

1. **A scoped entry, `packages/<id>/AGENTS.md`.** It is discovered by name
   anywhere in the tree (`scripts/_packmodel.py:186-195`), so it must be right:
   ≤ 6144 bytes (`scripts/_packmodel.py:108`; enforced `scripts/checks.py:229-232`),
   it must contain a "smallest validation" command (`scripts/checks.py:234-235`),
   and it may not restate root obligations (`scripts/checks.py:236-238`). Its
   form is copied from `_templates/` (`AGENTS.md:63-64`); the models entry
   (`packages/models/AGENTS.md:1-74`) is the nearest worked example, and its
   fill-in rules are at `packages/models/AGENTS.md:65-74`.
2. **A row in the root `AGENTS.md` component table.** The row's `scoped entry`
   cell must name the file, and the file must exist — both directions are errors
   (`scripts/checks.py:221-244`; table at `AGENTS.md:25-49`). The update trigger
   is explicit: "a new component appears → a row in the component table above"
   (`AGENTS.md:119`).
3. **`rules/components/<id>.md`.** One rule file per component id, id spelled the
   same three ways (table cell, path segment, file name) — `rules/components/README.md:26-32`;
   every rule file has a table row and every row names an existing file
   (`rules/components/README.md:34-40`). Rule modules are approval-only
   (`rules/components/README.md:9-10`). Note this file is **not** registered in
   `rules/00-index.md`: that registry lists only `rules/NN-*.md` modules
   (`scripts/_packmodel.py:178-184`, checked `scripts/checks.py:104-122`), so the
   component table is the only registry for it.
4. **Byte budget.** `AGENTS.md` and the other boot files share a 36 864-byte
   budget (`scripts/_packmodel.py:111`, checked `scripts/checks.py:406-415`), so
   the new row is not free even though it is one line.
5. **A decision record, if the package is a scope change.** A new file under
   `docs/09-decisions/` needs a `## Contract` block, which every `docs/` file
   except memory shards and archives must declare (`scripts/checks.py:149-175`),
   the fields in `docs/00-schema.md:29-39`, and a row in
   `docs/09-decisions/README.md`. This is what reopening provider routing would
   take: decision 0019 keeps a provider router / fallback layer out of the
   closed roadmap (`docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md:35-40`),
   and the design anticipated the package as tier 3 — "`models-gateway`
   (OmniRoute/LiteLLM/Portkey)" (`docs/design/2026-10-12-smolagents-ts-v1-design.md:340`,
   `:655-669`) — so the package is the design's home for gateway policy but not
   the current roadmap's.
6. **Every path you cite must resolve.** The validator walks all of `docs/` and
   `rules/` and errors on any `docs/**` or `rules/**` reference to a missing
   file (`scripts/checks.py:125-146`), so the scoped entry's and rule file's
   pointers must be real before the change lands.
7. **`docs/01-project.md` key-components table.** A component is listed there
   ("`@smolagents-ts/models` | the `Model` seam and its provider adapters",
   `docs/01-project.md:109`); a new package gets a row.
8. **Docs site: no page to register.** The site renders the repository's own
   Markdown under `docs/` (and `README.md` as the home page) and copies the
   browser example — nothing else (`apps/docs-site/package.json:6`,
   `apps/docs-site/AGENTS.md` "What this component is"). Package READMEs are not
   published pages. So a new package needs **zero** docs-site edits; any `docs/`
   record you add is rendered automatically and must start with a top-level
   `#` heading, or the site build fails and names the file
   (`apps/docs-site/AGENTS.md` "Hazards"). Likewise `docs/attribution.md` needs
   no new row: it maps upstream *files*, and its one models row already covers
   the whole subtree (`docs/attribution.md:14`); it is frozen and kept verbatim
   (`AGENTS.md:51-69`).

### Release-gate ledger (`pnpm gate`, `package.json:29`)

Copy the thirteen files an existing package already has — `packages/models/`
(`package.json`, `tsconfig.json`, `tsconfig.test.json`, `tsup.config.ts`,
`vitest.config.ts`, `README.md`, `AGENTS.md`, `CHANGELOG.md`, `LICENSE`,
`NOTICE`, `src/index.ts`, `src/version.ts`, `test/`) — and change:

1. **Manifest and export map.** One `"."` export with `types`/`import` order
   (`packages/models/package.json:31-36`); `files` = dist, LICENSE, NOTICE
   (`:37-41`); `prepack`/`postpack` licence copying (`:43-47`); `publishConfig`,
   `engines`, `repository`. Adding a subpath is allowed only where a real
   boundary needs it (`packages/mcp/package.json:31-40`,
   `packages/exec-remote/package.json:31-60`), and per-provider `./models/<provider>`
   subpaths were dropped on purpose (`docs/09-decisions/0006-distribution-shape.md:36-39`).
2. **`tsup.config.ts`** — entry `src/index.ts`, esm + dts, `zod` and
   `@smolagents-ts/core` external (`packages/models/tsup.config.ts:1-13`); entries
   must match the export map (`packages/mcp/tsup.config.ts:7-20`).
3. **`vitest.config.ts`** — a package directory with no config is silently
   outside the suite (`docs/10-runbooks/gate.md:82`); the root picks up
   `packages/*/vitest.config.ts` (`vitest.config.ts:8-12`). It must alias
   `@smolagents-ts/core` to source in test, as the models project does
   (`packages/models/vitest.config.ts:1-16`), because `tsconfig.base.json` maps
   only core (`tsconfig.base.json:30-32`).
4. **`tsconfig.json` + `tsconfig.test.json`** — the test one widens `rootDir` to
   reach shared fixtures (`packages/models/tsconfig.test.json`;
   hazard `packages/models/AGENTS.md:57-59`).
5. **`src/version.ts` with a `VERSION` literal** matching the manifest —
   `pnpm version:check` walks every package except the facade, which is exempt
   by name (`scripts/sync-versions.mjs:24-53`; `package.json:22`).
6. **`scripts/pack-smoke.mjs`** — add the name to `PACKAGES`
   (`scripts/pack-smoke.mjs:19`); the summary and tarball count follow
   (`:250-254`). If the package becomes a facade subpath, its import checks and
   expected subpath list must be extended too (`:172-182`).
7. **publint and attw**, which run per tarball after the build
   (`package.json:23-24`), and the depcruise rule that `src` may import only
   declared dependencies (`.dependency-cruiser.cjs:39-51`).
8. **A changeset.** The `fixed` group is six packages
   (`.changeset/config.json:5-14`) and a new package can stay outside it — `cli`,
   `mcp` and `exec-remote` are published without being in it — but its first
   version and every later surface change need a changeset
   (`package.json:19-22`).
9. **An umbrella subpath only if it becomes a documented install path.** That
   means an entry in `packages/smolagents-ts/package.json:14-21`, a
   `src/<id>/index.ts` re-export, a tsup entry, a row in that package's
   `test/surface.test.ts` map (`:9-16`), a pack-smoke check
   (`scripts/pack-smoke.mjs:172-182`) and a README table row
   (`README.md:29-38`). It is optional: `cli`, `mcp`, `exec-remote` and
   `exec-pyodide` ship without one
   (`docs/09-decisions/0014-internal-packages-stay-implementation.md:30-34`).
10. **The gate itself** — eleven stages ending in `publint`, `attw`, `ci:check`,
    `pack:smoke`, `site:build` (`package.json:29`,
    `docs/10-runbooks/gate.md:29-42`). A package with broken types, an
    unpublished export or a missing tarball fails there, not earlier.

Cost summary: **eight pack files/edits and about ten release edits**, plus a
decision record if the package changes scope. That is why the design keeps tier 3
for later (`docs/design/2026-10-12-smolagents-ts-v1-design.md:666-669`).

---

## (c) Does a subclass inside `packages/models` violate anything?

No rule, guard or test forbids it, and the package already contains one:
`HuggingFaceModel` is a 21-line subclass of `OpenAICompatibleModel` whose
constructor only supplies a different host and `provider` label
(`packages/models/src/huggingface.ts:13-21`). Points checked:

- **dependency-cruiser:** its rules constrain core (no models, no node builtins,
  no unlisted deps) and `src`↔declared-dependency edges
  (`.dependency-cruiser.cjs:3-51`). No rule mentions subclassing, and an
  in-package subclass imports nothing new.
- **Architecture guard tests:** they exist for core, mcp, exec-pyodide and
  exec-remote — `packages/core/test/architecture-guard.test.ts`,
  `packages/mcp/test/architecture.test.ts`,
  `packages/exec-pyodide/test/architecture.test.ts`,
  `packages/exec-remote/test/architecture.test.ts`. There is none under
  `packages/models/`, whose suite is thirteen files
  (`packages/models/AGENTS.md:28-34`).
- **ESLint boundaries:** the restricted-imports and restricted-globals blocks
  are scoped to `packages/core/src/**` (`eslint.config.js:80-98`); the models
  sources are under the general TypeScript config only.
- **The pinned public surface:** adding an exported name *fails*
  `packages/models/test/public-surface.test.ts:9-16` until that list is extended;
  the comment above it says an added name is deliberate and must say why in the
  same commit (`:5-8`). That is an edit, not a violation — and it is
  unavoidable, because the export map has a single `"."` entry
  (`packages/models/package.json:31-36`) and tsup builds only the
  `src/index.ts` graph (`packages/models/tsup.config.ts:5`): a subclass that is
  not exported is not even emitted, so shipping one means a public name, a
  surface-pin edit and a changeset.
- **The documented boundary is about behaviour, not inheritance:** an adapter is
  data, not policy (`rules/components/models.md:3-5`); the package "owns no
  retry or budget policy, no agent loop and no credential store"
  (`packages/models/AGENTS.md:36-40`). A subclass that only changes defaults,
  host, headers or the provider label is inside that boundary — that is the
  Hugging Face precedent. A subclass that adds retry, fallback, routing or
  credential lookup would break it, and it would be a rule change, which is
  approval-only (`rules/components/README.md:9-10`).
- **A structural limit worth knowing before choosing this shape:** `payload()`
  is `protected` but `post()` is private and the endpoint path is a literal
  (`packages/models/src/openai-compatible.ts:233`, `:248-253`, `:272-296`,
  `:298-315`). A subclass can change the request *body* and the host/headers, not
  the path. A gateway needing a different path or handshake must override
  `generate` and `generateStream` outright, at which point a separate file is
  the honest shape.
- Still required for a new adapter either way: a fixture test
  (`rules/components/models.md:11-13`) and a row in the models entry-point table
  (`packages/models/AGENTS.md:13-26`).

Verdict: the only costs of the subclass shape are a barrel export, the
surface-pin edit, a changeset, one fixture + test file, and one `AGENTS.md` row.
It violates nothing; it just has to stay data.

---

## (d) The test pattern, and the exact smallest validation

The pattern is fixed by the component rule: no test reaches a provider; the wire
format is pinned by a recorded fixture (`rules/components/models.md:11-13`,
`packages/models/AGENTS.md:44-49`), and every test injects `fetch`
(`packages/models/src/transport.ts:1-15`, `packages/models/test/openai-compatible.test.ts:27-36`).

- **Request side:** assert URL, headers and body fields against a recorder fake,
  including the bearer header and any gateway headers
  (`packages/models/test/openai-compatible.test.ts:70-82`;
  `packages/models/test/huggingface.test.ts:53-55`).
- **Response side:** one JSON fixture per provider form
  (`packages/models/test/fixtures/`), mapped into the seam's four-field
  completion and the four `FinishReason` values.
- **Streaming:** feed a `ReadableStream` in fixed-size pieces so chunk splits are
  adversarial (`packages/models/test/openai-compatible-stream.test.ts:13-32`),
  and assert deltas, finish reason and usage on the chunks the wire puts them on
  (`:48-71`; fixture `packages/models/test/fixtures/openai-chat-completion.sse.txt`).
- **Errors:** non-2xx → `HttpError` with status/body/url
  (`packages/models/test/openai-compatible.test.ts:161-170`); an error object
  inside a 200 stream → `streamError` with no key leaked
  (`packages/models/test/openai-compatible-stream.test.ts:215-229`).
- **Agent level:** one scripted `fetch` drives a real `ToolCallingAgent` through
  a tool call and back, proving the transcript invariant
  (`packages/models/test/agent-e2e.test.ts:57-104`;
  `packages/models/test/anthropic-e2e.test.ts:54-116`). "e2e" here means adapter
  plus loop, with no network.
- **No env-gated provider test exists** to copy. The live check is a runbook plus
  a skip-safe example that prints SKIPPED and exits 0 without a key
  (`examples/live-provider/index.mjs:16-30`,
  `docs/10-runbooks/live-provider-smoke.md:12-14`, `:84-85`).

**Smallest validation command**, exactly as the scoped entry states it:

```powershell
pnpm vitest run --project models
```

Expected result, in the entry's words: thirteen test files and seventy-one
tests pass (`packages/models/AGENTS.md:28-34`) — a written claim, not re-run for
this record. The type pass beside it is
`pnpm --filter @smolagents-ts/models run typecheck` (`packages/models/package.json:44`).
The full proof is `pnpm gate` (`package.json:29`), which must stay offline and
credential-free (`docs/01-project.md:96-97`).

---

## Answer

For an OpenAI-compatible gateway such as OmniRoute, neither new file nor new
package is needed today: `new OpenAICompatibleModel({ baseUrl, apiKey, headers, provider })`
covers it (`packages/models/src/openai-compatible.ts:19-34`), and the CLI already
exposes the same as `--api-base` → `baseUrl`
(`packages/cli/src/model-factory.ts:56-71`, flag at `packages/cli/src/args.ts:48`).
The subclass exists for the case where the repository must own and fixture-test
the adapter: ~21 lines, one test, one fixture, one export, one changeset, one
entry-table row, and no boundary violated as long as it stays data. The package
is the design's eventual home for gateway policy
(`docs/design/2026-10-12-smolagents-ts-v1-design.md:340`, `:655-669`) but costs
the full registration set above and is explicitly unscheduled
(`docs/09-decisions/0019-post-0.1.0-roadmap-is-s7-s11.md:35-40`).
