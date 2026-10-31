---
"@smolagents-ts/core": minor
"@smolagents-ts/models": minor
"@smolagents-ts/react": minor
"@smolagents-ts/react-ui": minor
---

Multimodal input. `agent.run` takes a parts array of text, images and audio; a tool hands
media to the model with `withAttachments`; and `ChatSurface` renders a message's image and
audio parts, with a visible fallback for missing alt text. Memory holds media by reference
behind a `MediaStore`, so bytes stay out of events, checkpoints and traces. `content` on
`ChatMessage` widens to a string or parts: read it with `messageText`.
`MODEL_ADAPTER_VERSION` is now 2, and version 1 adapters keep working through a shim that
refuses media.
