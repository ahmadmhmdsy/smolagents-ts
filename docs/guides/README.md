# Guides

**Contract**
- **Role:** how to use the library for one task, written for someone building on
  it rather than working on it.
- **Mutability:** rewrite in place, so a guide always describes the current code.
- **Read when:** before building on a seam you have not used before.
- **Update when:** a public behaviour a guide describes changes, or one of its
  tested examples has to change.

**Why this folder exists:** a runbook is a procedure for working on this
repository, and a package README is a reference for one package. Neither holds
an answer that spans packages, such as which seam a piece of behaviour belongs
in. The owner settled this home for guides on 2026-11-13 (T-52).

**The rule for every guide:** each code block a guide shows is copied from a
test that runs in `pnpm gate`, and the guide names that test. A guide whose
example is not tested is a claim, not a guide.

---

## Index

| Guide | Use when | Tested by |
|---|---|---|
| _template.md | (form) | — |
| where-behaviour-belongs.md | you are about to add behaviour to an agent and are choosing between a Model wrapper, a plugin hook, a tool, an executor, a store, middleware or an event listener | `packages/core/test/guide-where-behaviour-belongs.test.ts` |
