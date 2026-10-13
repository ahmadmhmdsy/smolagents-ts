# S3 — the tool system Implementation Plan

## Contract

- **Role:** the implementation plan for milestone S3 of
  `docs/design/2026-10-12-smolagents-ts-v1-design.md`.
- **Mutability:** append-only once execution starts. A step that turned out wrong is
  corrected by a note under the task that owns it, never by rewriting the step.
- **Read when:** executing S3, or reviewing what S3 was supposed to deliver.
- **Update when:** a task's measured result differs from its prediction, or a task is
  added or dropped.

**Goal:** make `@smolagents-ts/tools` a real package — a named tool collection and the
first three default tools — so a caller can assemble a tool set once and hand it to any
agent.

**Architecture:** `tool()` and `ToolRegistry` already live in `@smolagents-ts/core`
(S1 T11); this milestone adds the ecosystem around them. `ToolCollection` is a named
group that converts to the core's registry at the agent boundary, and each default tool
is a factory function that returns a core `Tool`, so nothing here is a second interface.
A tool reaches the network through the `ToolContext.fetch` the loop already passes, which
keeps the package isomorphic and lets a test inject a double.

**Tech Stack:** TypeScript 6 (strict, `noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`, `verbatimModuleSyntax`), Zod 4, Vitest, tsup, pnpm
workspaces.

**Spec:** design record sections 8 (tool system) and 13 (`default_tools.py` → port
subset).

**Depends on:** S1 (the `Tool` interface, `tool()`, `ToolRegistry`, `ToolContext`).
Independent of S2.

**Dependency order:** Task 1 adds the core dependency the rest of the package needs;
Tasks 2–5 are independent of each other and only depend on Task 1; Task 6 exports what
1–5 built; Task 7 records the result.

## Spec coverage

| spec item | where it lands |
|---|---|
| schema-first `tool()` | already shipped in `packages/core/src/tool/tool.ts`; reused, not re-exported |
| `ToolCollection` ports upstream's container | Task 1 (`fromTools`; `fromHub` deferred with the Hub) |
| default tools, port subset | Tasks 3–5: `user_input`, `web_search`, `visit_webpage` |
| `final_answer` stays an executor primitive | deliberately absent; see "does not do" |
| the package stays isomorphic | every default tool takes its `fetch` from `ToolContext` |

## File structure

| path | responsibility |
|---|---|
| `packages/tools/package.json` | gains the `@smolagents-ts/core` workspace dependency |
| `packages/tools/src/collection.ts` | `ToolCollection`: a named group of tools, to registry |
| `packages/tools/src/html.ts` | `htmlToText`: the text of a page, for `visit_webpage` |
| `packages/tools/src/defaults/user-input.ts` | `userInputTool`: asks the caller's `ask` function |
| `packages/tools/src/defaults/duckduckgo-search.ts` | `duckDuckGoSearchTool`: the Instant Answer API |
| `packages/tools/src/defaults/visit-webpage.ts` | `visitWebpageTool`: fetch a page, return its text |
| `packages/tools/src/index.ts` | the public barrel |
| `packages/tools/test/*.test.ts` | one suite per unit, plus the pinned public surface |
| `packages/tools/test/fixtures/` | the page and the search answer the suites read |

Test counts in this plan are predictions. Record the measured numbers in Task 7 instead
of the predicted ones whenever they differ.

## Task 1 — `ToolCollection` and the core dependency

**Files**

- modify `packages/tools/package.json`
- create `packages/tools/src/collection.ts`
- create `packages/tools/test/collection.test.ts`

**Steps**

- [ ] 1.1 Add the dependency, because `packages/tools/src` imports the core and
  `no-undeclared-deps-from-src` fails a package that does not declare it:

  ```json
  "dependencies": { "@smolagents-ts/core": "workspace:*", "zod": "^4.0.0" }
  ```

- [ ] 1.2 Write `packages/tools/src/collection.ts`:

  ```ts
  import { ToolDefinitionError, ToolRegistry, type Tool, type ToolSpec } from "@smolagents-ts/core";

  export interface ToolCollectionOptions {
    /** The group's label, for a caller that keeps several. Defaults to "tools". */
    name?: string;
    tools?: readonly Tool[];
  }

  /**
   * A named group of tools. The agent still runs on the core's ToolRegistry; this is the
   * grouping a caller assembles once and hands to several agents, and it converts at that
   * boundary rather than replacing the registry.
   */
  export class ToolCollection {
    readonly name: string;
    private readonly byName = new Map<string, Tool>();

    constructor(options: ToolCollectionOptions = {}) {
      this.name = options.name ?? "tools";
      for (const entry of options.tools ?? []) this.add(entry);
    }

    /** Insertion order is the order the model sees, so a prompt is stable across runs. */
    add(entry: Tool): void {
      if (this.byName.has(entry.name)) {
        throw new ToolDefinitionError("Duplicate tool name: " + entry.name);
      }
      this.byName.set(entry.name, entry);
    }

    get(name: string): Tool | undefined {
      return this.byName.get(name);
    }

    has(name: string): boolean {
      return this.byName.has(name);
    }

    get size(): number {
      return this.byName.size;
    }

    list(): Tool[] {
      return [...this.byName.values()];
    }

    toSpecs(): ToolSpec[] {
      return this.list().map((entry) => entry.toSpec());
    }

    toRegistry(): ToolRegistry {
      return new ToolRegistry(this.list());
    }

    [Symbol.iterator](): IterableIterator<Tool> {
      return this.byName.values();
    }

    static fromTools(tools: readonly Tool[], name?: string): ToolCollection {
      return new ToolCollection(name === undefined ? { tools } : { name, tools });
    }
  }
  ```

- [ ] 1.3 Write `packages/tools/test/collection.test.ts` with six tests: it keeps
  insertion order and reports its size; a duplicate name throws
  `ToolDefinitionError`; `fromTools` names the group and exposes its tools; `toRegistry`
  hands the same tools to the core; it is iterable; `toSpecs` renders the advertisement.
  Build the tools with `tool()` from `@smolagents-ts/core` and `z.object(...)`.

- [ ] 1.4 Run `pnpm vitest run --project tools`. Expected: **2 files, 7 tests**, exit 0.
- [ ] 1.5 Run `pnpm --filter @smolagents-ts/tools run typecheck` and `pnpm depcruise`.
  Expected: both exit 0.
- [ ] 1.6 Commit: `feat(tools): add the tool collection`.

## Task 2 — `htmlToText`

**Files**

- create `packages/tools/src/html.ts`
- create `packages/tools/test/html.test.ts`

**Steps**

- [ ] 2.1 Write `packages/tools/src/html.ts`. It drops `script`, `style`, `noscript`
  and comments, turns `h1`–`h6` into `#` lines, `li` into `- ` lines, `a` into
  `[text](href)`, block tags into blank-line-separated paragraphs, decodes the five
  common entities plus numeric ones, and collapses runs of whitespace. Export
  `htmlToText(html: string): string`.

  ```ts
  const DROPPED = /<(script|style|noscript|template)[\s\S]*?<\/\1>/gi;
  const COMMENT = /<!--[\s\S]*?-->/g;
  ```

- [ ] 2.2 Write `packages/tools/test/html.test.ts` with six tests: headings, links,
  list items, entity decoding (`&amp;`, `&#233;`), dropped script and style, and
  collapsed whitespace.

- [ ] 2.3 Run `pnpm vitest run --project tools`. Expected: **3 files, 13 tests**, exit 0.
- [ ] 2.4 Commit: `feat(tools): render a page as text`.

## Task 3 — `userInputTool`

**Files**

- create `packages/tools/src/defaults/user-input.ts`
- create `packages/tools/test/user-input.test.ts`

**Steps**

- [ ] 3.1 Write the factory. The package is isomorphic, so the question reaches the user
  through an injected function rather than through `readline`:

  ```ts
  import { tool, type Tool } from "@smolagents-ts/core";
  import { z } from "zod";

  export interface UserInputToolOptions {
    /** How the question reaches the user. Injected, because this package has no host. */
    ask: (question: string) => string | Promise<string>;
    name?: string;
    description?: string;
  }

  export function userInputTool(options: UserInputToolOptions): Tool {
    return tool({
      name: options.name ?? "user_input",
      description: options.description ?? "Asks the user for input.",
      inputSchema: z.object({
        question: z.string().describe("The question to ask the user."),
      }),
      execute: async ({ question }) => String(await options.ask(question)),
    });
  }
  ```

- [ ] 3.2 Write `packages/tools/test/user-input.test.ts` with four tests: the injected
  function receives the question; the answer is returned as a string; the default name and
  description reach `toSpec()`; a custom name is honoured.

- [ ] 3.3 Run `pnpm vitest run --project tools`. Expected: **4 files, 17 tests**, exit 0.
- [ ] 3.4 Commit: `feat(tools): add the user input tool`.

## Task 4 — `duckDuckGoSearchTool`

**Files**

- create `packages/tools/src/defaults/duckduckgo-search.ts`
- create `packages/tools/test/fixtures/duckduckgo-instant-answer.json`
- create `packages/tools/test/duckduckgo-search.test.ts`

**Steps**

- [ ] 4.1 Write the factory. It reads the documented Instant Answer endpoint as JSON and
  renders an abstract followed by related topics. The fetch is the `ToolContext`'s unless
  the caller injected one:

  ```ts
  import { tool, type Tool, type ToolContext } from "@smolagents-ts/core";
  import { z } from "zod";

  const DEFAULT_BASE_URL = "https://api.duckduckgo.com/";

  export interface DuckDuckGoSearchToolOptions {
    /** Overrides the context's fetch; a test injects one. */
    fetch?: typeof globalThis.fetch;
    maxResults?: number;
    baseUrl?: string;
    name?: string;
    description?: string;
  }

  interface InstantAnswer {
    AbstractText?: string;
    AbstractURL?: string;
    Answer?: string;
    RelatedTopics?: Array<{ Text?: string; FirstURL?: string; Topics?: Array<{ Text?: string; FirstURL?: string }> }>;
  }
  ```

  `execute` builds `baseUrl + "?q=" + encodeURIComponent(query) + "&format=json&no_html=1&no_redirect=1"`,
  throws `Error("DuckDuckGo search failed with status " + response.status)` on a non-OK
  answer, flattens one level of `RelatedTopics[].Topics`, and joins the lines it found. An
  answer with nothing in it returns `"No results found."`.

- [ ] 4.2 Write the fixture as the documented response shape, with an abstract, a URL, an
  `Answer` field and three related topics including one nested group. State in the test's
  doc comment that it is hand-shaped from the endpoint's documentation, not a capture.

- [ ] 4.3 Write `packages/tools/test/duckduckgo-search.test.ts` with five tests: the URL
  and the abstract; related topics limited by `maxResults`; the empty answer; a non-OK
  status throws; the spec carries the query schema.

- [ ] 4.4 Run `pnpm vitest run --project tools`. Expected: **5 files, 22 tests**, exit 0.
- [ ] 4.5 Commit: `feat(tools): add the DuckDuckGo search tool`.

## Task 5 — `visitWebpageTool`

**Files**

- create `packages/tools/src/defaults/visit-webpage.ts`
- create `packages/tools/test/fixtures/webpage.html`
- create `packages/tools/test/visit-webpage.test.ts`

**Steps**

- [ ] 5.1 Write the factory over `htmlToText`:

  ```ts
  export interface VisitWebpageToolOptions {
    fetch?: typeof globalThis.fetch;
    /** The most characters returned. Defaults to 20000. */
    maxChars?: number;
    name?: string;
    description?: string;
  }
  ```

  A truncated page ends with `"\n\n[truncated]"`, so a caller can tell a short page from a
  cut one.

- [ ] 5.2 Write the fixture: a small page with a title, a heading, two paragraphs, a list
  and a script, hand-shaped from ordinary HTML.

- [ ] 5.3 Write `packages/tools/test/visit-webpage.test.ts` with five tests: the page's
  text comes back; `maxChars` truncates and marks the cut; a non-OK status throws; the
  context's fetch is used when none was injected; the spec carries the url schema.

- [ ] 5.4 Run `pnpm vitest run --project tools`. Expected: **6 files, 27 tests**, exit 0.
- [ ] 5.5 Commit: `feat(tools): add the visit webpage tool`.

## Task 6 — the barrel and the pinned surface

**Files**

- modify `packages/tools/src/index.ts`
- create `packages/tools/test/public-surface.test.ts`

**Steps**

- [ ] 6.1 Export `VERSION`, `ToolCollection` and its options type, `htmlToText`, and the
  three tool factories with their options types. `tool()` stays in the core: it is the
  interface, and re-exporting it here would give one name two homes.

- [ ] 6.2 Write `packages/tools/test/public-surface.test.ts` pinning
  `Object.keys(barrel).sort()` to
  `["ToolCollection", "VERSION", "duckDuckGoSearchTool", "htmlToText", "userInputTool", "visitWebpageTool"]`,
  with the same comment the models package uses about an export being a deliberate act.

- [ ] 6.3 Run `pnpm vitest run --project tools`. Expected: **7 files, 28 tests**, exit 0.
- [ ] 6.4 Run `pnpm --filter @smolagents-ts/tools run typecheck` and
  `pnpm --filter @smolagents-ts/tools run build`. Expected: both exit 0.
- [ ] 6.5 Commit: `feat(tools): export the tool ecosystem`.

## Task 7 — records, the changeset and the gate

**Files**

- modify `packages/tools/AGENTS.md`
- modify `docs/01-project.md`
- modify `docs/04-tasks.md`
- modify `docs/05-memory.md` and `docs/memory/general.md`
- create `.changeset/s3-tools.md`
- modify `docs/03-handoff.md`

**Steps**

- [ ] 7.1 Update `packages/tools/AGENTS.md`: the description stops calling the package a
  placeholder, the entry-point table gains a row per file, and the smallest-validation line
  carries the count measured in Task 6.
- [ ] 7.2 Move `docs/01-project.md`'s S3 line to done, naming what shipped.
- [ ] 7.3 Set `docs/04-tasks.md` T-8 to done with its evidence, and rotate the row to
  `docs/tasks/archive-2026.md` verbatim.
- [ ] 7.4 Add the lessons to `docs/memory/general.md` and their row to the registry in
  `docs/05-memory.md`. Candidates: a container that only converts to the registry the loop
  already has is worth it for naming and grouping, not for a second traversal path; a tool
  that needs the host must take the host as a parameter, because the package has no host; an
  endpoint's documented JSON shape is not its HTML shape, so a port of a scraper is a
  different tool wearing the same name.
- [ ] 7.5 Write `.changeset/s3-tools.md` in the form the earlier changesets established,
  with a minor bump for `@smolagents-ts/tools`.
- [ ] 7.6 Check the handoff region size and rotate the oldest entry to
  `docs/handoff/archive-2026.md` before adding the new one, so the 8192-byte cap holds.
- [ ] 7.7 Run `pnpm gate`. Expected exit 0, with `ci:check` OK and the pack smoke test
  reporting five packages installed and imported from tarballs.
- [ ] 7.8 Run `python scripts/validate_context.py --root . --baseline docs/.baseline.json
  --json` and confirm no new findings, then `python scripts/rotate.py --check`.
- [ ] 7.9 Commit: `docs: record S3`.

**Verification.** `pnpm gate` exits 0; the validator reports no new findings with zero
errors and zero warnings; `rotate.py --check` exits 0; the tools project passes with the
count measured in Task 6.

## Definition of done

- `ToolCollection`, `htmlToText`, `userInputTool`, `duckDuckGoSearchTool` and
  `visitWebpageTool` exist and are exported from the barrel.
- Every default tool is a core `Tool`, carries a Zod input schema, and reaches the
  network through `ToolContext.fetch` unless a caller injected one.
- `pnpm vitest run --project tools` passes with the count measured in Task 6, and
  `pnpm --filter @smolagents-ts/tools run typecheck` exits 0.
- `pnpm gate` exits 0 on the final tree; `pnpm depcruise` reports no undeclared
  dependency and no new violation.
- The validator reports no new findings and `rotate.py --check` exits 0.
- `packages/tools/AGENTS.md`, `docs/01-project.md`, `docs/04-tasks.md`,
  `docs/05-memory.md`, `docs/memory/general.md` and `docs/03-handoff.md` describe the
  shipped state, and a changeset exists for the release.

## What this plan deliberately does not do

- **It does not re-export `tool()`.** The interface ships in the core; a second home for
  one name is a drift risk, and the core is where the loop reads it.
- **It does not port `PythonInterpreterTool`.** The port's interpreter is JavaScript, and
  it arrives with `exec-quickjs` in S4, behind the executor seam.
- **It does not port `FinalAnswerTool`.** The design record keeps `final_answer` an
  executor-level primitive, so a user tool with that name would give the loop two ways to
  finish.
- **It does not port `SpeechToTextTool`.** The design defers audio, and the seam's message
  content is text in v1.
- **It does not reach the Hub.** `fromHub` and `fromSpace` need the Hub client the design
  defers to v1.5; `fromTools` is the v1 entry point.
- **It does not add a retry, a cache or a rate limit** to any default tool. Those are
  caller policy, and this package has no scheduler.
- **It does not scrape HTML for search.** The port reads the endpoint's documented JSON,
  which is a different result set from upstream's library; the tool name is kept and the
  divergence is recorded here rather than discovered later.

## Risks carried forward

| risk | what it would look like | where it is recorded |
|---|---|---|
| a default tool's network shape changes | a search or page fetch returns nothing and no test notices | each fixture is hand-shaped and states its provenance |
| the Instant Answer API is not a web-results API | a caller expects ranked links and gets an abstract | the tool's description and this plan say which endpoint it reads |
| `htmlToText` is not a Markdown converter | a caller expects upstream's `markdownify` output | the function's name and doc comment promise text, not Markdown |
| a default tool widens what generated code can do | a CodeAgent can now fetch arbitrary URLs | the schema, the description and the AGENTS.md hazard all name the network |
