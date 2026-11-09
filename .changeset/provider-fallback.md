---
"@smolagents-ts/models": minor
---

`FallbackModel` wraps an ordered list of models and moves to the next one on a failure a retry
could fix: a network error, a timeout, or HTTP 408, 409, 429 or 5xx. It does not move on another
4xx or an abort, and never after a stream has yielded a chunk. Its capabilities are the
intersection of its members', and `onFallback` reports each move. The default rule is exported as
`isRetryableModelError`.
