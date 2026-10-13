# 0004 — the guest program captures a step's declarations by scanning its source

**Contract**
- **Role:** one decision, with its context and consequences.
- **Mutability:** frozen once accepted. A reversal is a new record that
  supersedes this one; this file is never rewritten.
- **Read when:** before changing how agent-authored code reaches the QuickJS
  realm, or before wondering why the guest program scans the source.
- **Update when:** never. A reversal is a new record.

- **Status:** accepted
- **Date:** 2026-10-14
- **Decided by:** the S4 session, inside the approved S4 plan; the owner can supersede it
- **Supersedes:** none

## Context

The prompt tells the model that the state persists between code executions, so a variable
or a function defined in one step is readable in the next (design record D-14; the prompt's
rule 10). The same prompt's examples call tools with `await` at the top level, and the
design record's section 9.3 requires a host tool call to reach the guest as an awaited
promise.

The synchronous QuickJS build has no top-level `await`, so the guest program wraps the
model's code in an async IIFE. That wrapper satisfies the await requirement and breaks the
persistence promise: the code's own lexical declarations live in the wrapper's function
scope, and the scope is gone the moment the wrapper returns. Measured with a probe during
S4 Task 3: a `const` declared in step 1 is invisible to step 2, while a name assigned onto
`globalThis` is visible.

The realm is also reused across steps, deliberately, so that anything which does survive
survives cheaply. A reused realm rejects a second script-level `const` or `let` with the
same name — `SyntaxError: redeclaration` — which constrains the prelude rather than the
model's code, because the prelude is evaluated once per step in the same realm.

## Decision

The guest program is built from three parts, and each one answers one of those facts:

1. A prelude that declares its own shims with `var` and installs the tool names as
   properties of `globalThis`, so a second step's prelude cannot collide with the first.
2. The model's code verbatim, inside `(async () => { ... })()`, so top-level `await`
   works and the engine's job queue can drive a host call.
3. An epilogue inside the same wrapper that scans the source for top-level declaration
   names and copies each one onto `globalThis` before the wrapper returns —
   `if (typeof NAME !== 'undefined') __capture("NAME", NAME)` — which is what makes the
   next step's code read the previous step's variables.

The scanner is a small table of regexes over the source (plain, function, class and
destructuring declarations) with a reserved-word guard. It is a heuristic by construction.

## Alternatives considered

| Alternative | Why it was not chosen |
|---|---|
| evaluate the model's code unwrapped | the synchronous build has no top-level `await`, so the prompt's own examples and the design's awaited host call both fail |
| evaluate the wrapper and read its declarations afterwards | the wrapper's scope is unreachable once it returns; nothing is left to read |
| declare the prelude's shims with `const` | a second step's prelude is a redeclaration error in the same realm |
| capture with a `with` block or a proxy scope | it routes property access, not declarations, and it would put the model's own code behind a scope it cannot see through |
| move to the asyncify build so no wrapper is needed | asyncify is a different engine build with its own cost, the plan's ladder chose the synchronous build for v1, and the choice would not remove the prelude's redeclaration constraint |

## Consequences

**Positive**

- the promise the prompt makes to the model is true, and it is true through the agent loop
  rather than only in an executor-level test
- the mechanism lives in one file with a unit test per declaration form, and the host keeps
  no per-step state

**Negative / accepted costs**

- a declaration form the scanner does not know is not captured, and the failure is silent:
  the next step reads `undefined` rather than reporting an error
- the guest program's source is generated rather than written, so reading the executed code
  means reading `buildGuestSource` first

## Reversibility

Moderate. Reversing means changing `packages/exec-quickjs/src/guest-source.ts` and its
tests; the executor seam, the core and the agent loop are untouched either way. An engine
build with top-level `await` would let the wrapper go, and the capture epilogue with it.

## Follow-up

- [ ] if the asyncify build ever replaces the synchronous one, re-open this record rather
      than editing it: the wrapper's reason disappears with the wrapper.
