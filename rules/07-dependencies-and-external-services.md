# rules/07 — Dependencies and external services

**Purpose:** every dependency and integration is a permanent liability bought
with a temporary convenience.

## Contract

- **Mutability:** approval-only.
- **Applies to:** adding packages, tools, services, APIs, or network calls.

## Rules

**R-07.1 — Check the project first.** MUST verify the project does not already
provide the capability before adding anything. *Why:* duplicates are the most
common dependency mistake.

**R-07.2 — Justify the addition.** MUST state what the dependency provides that
the project cannot reasonably provide itself, and why the benefit exceeds the
maintenance cost. *Why:* an unjustified dependency cannot be evaluated or later
removed.

**R-07.3 — Use the existing package manager.** MUST use the project's manager
and update its lockfile. MUST NOT mix managers or introduce a second lockfile.
*Why:* two managers produce two irreconcilable dependency graphs.

**R-07.4 — Never delete a lockfile to make installation easier.** *Why:* the
lockfile is the only record of a working resolution.

**R-07.5 — Respect declared runtimes.** MUST use the version the project
declares and MUST NOT upgrade the runtime unless requested or required. *Why:*
silent version drift invalidates every prior verification.

**R-07.6 — Evaluate the dependency.** SHOULD check maintenance activity,
release recency, license compatibility, transitive weight, and whether a
standard-library or in-project solution exists. *Why:* you ship everything it
ships.

**R-07.7 — Prefer standard library.** SHOULD use the standard library when it
is sufficient. *Why:* zero transitive risk.

**R-07.8 — Never invent credentials or endpoints.** When an external service
needs a secret or a URL that is not configured, MUST stop and ask. *Why:*
invented configuration fails at the worst moment.

**R-07.9 — Keep integrations behind an interface.** MUST isolate an external
service behind an adapter so it can be replaced or mocked. *Why:* it is what
makes the integration testable and reversible.

**R-07.10 — Always timeout and handle failure.** MUST apply timeouts, retries
with backoff, and explicit error handling to any network call. *Why:* remote
systems fail as a matter of course.

**R-07.11 — Assume the network is absent.** SHOULD provide a local or in-memory
fallback for development, clearly marked as a development path. *Why:* an agent
that cannot run offline cannot verify anything.

**R-07.12 — Do not send sensitive data outward.** MUST NOT transmit secrets,
personal data, or private source to an external service without explicit
authorization. *Why:* it is irreversible.

**R-07.13 — Do not add a service to avoid a small feature.** MUST NOT introduce
a queue, cache, or database to avoid writing a small amount of local code.
*Why:* operational cost is not measured in lines of code.

**R-07.14 — Document setup.** MUST record required credentials, configuration,
and setup steps when an integration is added. *Why:* otherwise the next agent
cannot run or verify it.

## Adapting

List the services this project already depends on, the credentials each needs,
and which are safe to use in development. Name any service that must never be
called from a test.
