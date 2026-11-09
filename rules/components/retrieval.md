# Component rule: retrieval

**Retrieval reaches the model through the task or a tool, never through the loop.**
The passages arrive either inside the task a caller passes to `run()` or as the
answer of a tool the model calls. The agent loop, its memory and its prompts
carry no retrieval step, so an agent with no retriever behaves exactly as it did
before this package existed.

**Retrieved text is labelled as material.**
Every context block opens with the fixed heading that names the passages as
reference material and not instructions. A passage is data the caller indexed;
the heading is what keeps a prompt that quotes it honest about where it came
from.

**A vector space has one dimension.**
A store fixes its dimension on its first vector and refuses any other, on write
and on query, with an error that names both numbers. An embedder that returns
the wrong number of vectors is refused the same way. A silent truncation or a
zero-padded vector ranks passages by noise.

**The root entry is isomorphic.**
The package depends on the core and zod alone and reaches no Node builtin, so it
loads wherever the core loads. A network embedder takes an injected `fetch` and
never reads the environment; a key is sent only when a caller passes one and is
never written into an error.
