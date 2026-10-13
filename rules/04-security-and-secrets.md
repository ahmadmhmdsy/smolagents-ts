# rules/04 — Security and secrets

**Purpose:** security is a requirement, not a later enhancement.

## Contract

- **Mutability:** approval-only.
- **Applies to:** all code, configuration, and commands.
- **Never deleted when adapting.**

## Rules

**R-04.1 — Never expose a secret.** MUST NOT print, log, echo, commit, or
transmit tokens, passwords, keys, cookies, connection strings, or private keys.
MUST reference a secret through an environment variable or a secret store.
*Why:* a leaked secret is leaked permanently and is often exploited silently.

**R-04.2 — Never commit real environment files.** MUST keep real .env files out
of version control and MUST provide a .env.example documenting every required
variable with a placeholder value. *Why:* it makes onboarding possible without
making leakage possible.

**R-04.3 — Never invent credentials.** When a credential is required and
absent, MUST stop and ask. MUST NOT fabricate, guess, or hardcode a placeholder
that could reach production. *Why:* invented credentials fail late and
confusingly.

**R-04.4 — Flag secrets, do not silently fix history.** If a real secret is
found in the working tree or in history, MUST report it immediately with its
location. MUST NOT attempt to rewrite history or rotate the credential without
authorization. *Why:* both actions are consequential and belong to the owner.

**R-04.5 — Never weaken a control to make progress.** MUST NOT disable
authentication or authorization, skip a TLS check, widen a permission, or
expose an internal service to unblock development. *Why:* temporary access
holes become permanent ones.

**R-04.6 — Never trust input.** MUST validate and normalize all external input
at the boundary: size, type, range, encoding, and authorization. *Why:* every
external input is an attacker-controlled value until proven otherwise.

**R-04.7 — Construct commands safely.** MUST use argument-array process APIs
rather than concatenating strings into a shell command. MUST NOT use eval or
equivalent dynamic execution without a specific, stated requirement. *Why:*
string-built commands are injection by construction.

**R-04.8 — Use parameterized queries.** MUST NOT interpolate values into
queries. *Why:* it is the same defect as R-04.7 with a different interpreter.

**R-04.9 — Least privilege.** MUST request the narrowest permission, scope,
role, and network access that accomplishes the task. *Why:* over-permission
converts one compromised component into a compromised system.

**R-04.10 — Encode output.** MUST encode output for its destination context
whenever data crosses into HTML, SQL, shell, or a template. *Why:* untrusted
data becomes code at every boundary it crosses unescaped.

**R-04.11 — Bound resources and set timeouts.** MUST apply timeouts, size
limits, and rate limits to network and user-driven operations. *Why:* an
unbounded operation is a denial-of-service vector against yourself.

**R-04.12 — Do not read outside the project.** MUST NOT read files outside the
repository without explicit approval, and MUST NOT access another user's data.
*Why:* capability is not authorization.

**R-04.13 — External actions need authorization.** MUST NOT send external
communications, make purchases, change firewall, cloud, or identity settings,
or deploy to production without explicit confirmation. *Why:* these are
consequential outside the repository boundary.

**R-04.14 — Review new dependencies.** MUST consider the security posture and
maintenance status of anything added. *Why:* a dependency is code you ship and
do not review.

## Adapting

Add the project's secret store, the environments that exist, and the specific
compliance obligations that apply. If the project handles personal data, name
the fields that are sensitive and where they may not be written.
