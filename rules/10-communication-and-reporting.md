# rules/10 — Communication and reporting

**Purpose:** a report is a fact sheet, not a narrative of effort.

## Contract

- **Mutability:** approval-only.
- **Applies to:** every message to the user, and every handoff to another agent.

## Rules

**R-10.1 — Use the fixed vocabulary.** MUST use only these status words:
pending, in_progress, blocked, done; PASS, FAIL, SKIPPED, BLOCKED,
NEEDS_USER_DECISION. *Why:* a shared vocabulary is what makes reports
comparable across sessions.

**R-10.2 — Report in the fixed shape.** A completion report MUST state: what
changed and where, what was verified and by which command, what was not
verified, known limitations, and the single next step. *Why:* the reader needs
to know what to trust, and the omission is always the same five things.

**R-10.3 — No vague assurances.** MUST NOT use "should work", "probably fine",
"everything passes", "I believe", or similar. If it is unverified, MUST say
unverified. *Why:* vague language transfers risk to the reader silently.

**R-10.4 — No hype, no decoration.** MUST NOT use emoji, exclamation, or
promotional framing in a technical report. *Why:* it costs attention and signals
lower reliability.

**R-10.5 — Cite, do not dump.** MUST reference paths as path:line and commands
verbatim, and MUST summarize output rather than pasting it. *Why:* raw output
consumes the reader's attention without adding a conclusion.

**R-10.6 — Bad news first and immediately.** MUST surface blockers, failures,
and security or data implications as soon as they are known, not at the end.
*Why:* a late blocker invalidates work done in between.

**R-10.7 — Ask one focused question.** When a decision is needed, MUST use the
QUESTION / CONTEXT / OPTIONS / RECOMMENDATION format and MUST ask one question
at a time. *Why:* a batch of questions is answered partially and worse.

**R-10.8 — Never report a result you did not obtain.** MUST NOT reconstruct a
plausible result from expectation. *Why:* fabricated results are worse than
missing ones, because they are acted upon.

**R-10.9 — Separate fact from inference.** MUST mark conclusions that go beyond
the evidence as inference, with the reasoning. *Why:* the reader must be able
to audit the leap.

**R-10.10 — State the verification label explicitly.** Every claim about
working behavior MUST carry PASS, FAIL, SKIPPED, or BLOCKED, with the command
that produced it. *Why:* the label is the compression of the evidence.

**R-10.11 — Report repository state precisely.** MUST distinguish committed
from uncommitted, local from pushed, and applied from proposed. *Why:* "done"
means nothing without knowing where the change physically is.

**R-10.12 — Scale length to the task.** SHOULD answer a small question briefly
and a large one thoroughly. MUST NOT pad. *Why:* length is a cost charged to
the reader.

**R-10.13 — A report to another agent is a claim.** When handing work to
another agent, MUST state the deliverable, the evidence, the scope touched, and
the unknowns. *Why:* the receiving agent cannot verify what was not stated.

## Adapting

If the project has a fixed report template or a ticket format, record it here
or in _templates/ and use it. If the project is autonomous and unattended, add
the specific signal that means "stop and wait for a human".
