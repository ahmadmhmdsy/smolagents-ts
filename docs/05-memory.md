# 05 — Memory (lessons)

**Contract**
- **Role:** the topic registry for durable lessons.
- **Mutability:** the registry is updated in place; the shards it points at are
  append-only.
- **Read when:** before touching anything non-obvious.
- **Update when:** a hard-won gotcha, a surprising failure, or a reversed assumption.

**Why this file exists:** the same mistake is rediscovered, at full cost, every
time it is not written down. This is the cheapest place to put it.

---

## Topics

This registry lists topics, never individual lessons.

| topic | shard | entries | date range | last updated |
|---|---|---|---|---|
| general | `docs/memory/general.md` | 42 | 2026-10-13 to 2026-10-14 | 2026-10-14 |
