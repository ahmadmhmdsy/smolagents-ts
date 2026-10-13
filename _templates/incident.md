# Incident — <title>

- **Detected:** <ISO 8601 with offset>
- **Resolved:** <ISO 8601 with offset, or "ongoing">
- **Severity:** low | medium | high
- **Owner:** <owner>

## Impact

What actually stopped working, for whom, and for how long. Facts, not
impressions. If the impact is unknown, say unknown.

## Timeline

Chronological, timestamped, and factual. Include the discovery, the wrong
turns, and the resolution. Wrong turns are valuable and get omitted by default.

| Time | Event |
|---|---|
| | |

## Root cause

The actual cause, as far as the evidence establishes it. Separate what is
proven from what is inferred. "Unknown, and here is what would establish it" is
an acceptable root cause.

## Detection

How it was noticed, and how long that took. If a human noticed it rather than a
system, that is a finding.

## Resolution

What was done to stop the impact, and whether it was a fix or a workaround.
State plainly if the underlying cause remains.

## Prevention

| Action | Type | Owner | Task ID |
|---|---|---|---|
| | detect / prevent / mitigate | | |

## What the rules should say now

If this incident reveals a rule that was missing, wrong, or unread, name the
rule change here and make it in the same session. An incident that produces no
rule change will recur.

## Lesson

Append the durable form of this to the topic's shard, `docs/memory/<topic>.md`, and update that topic's row in `docs/05-memory.md`.
