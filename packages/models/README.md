# @smolagents-ts/models

Provider adapters behind the core's `Model` interface: OpenAI-compatible,
Anthropic, Gemini, Hugging Face, and a model defined by plain functions. Every
adapter reports the capabilities it has rather than the ones it lacks.

## Images and audio

Read `model.capabilities.images` and `model.capabilities.audio` first: a part
the model cannot take is refused with `UnsupportedContentError` before any
request.

| adapter | images | audio | what to know |
|---|---|---|---|
| `OpenAICompatibleModel` | yes | yes | a claim about the wire, not the route: a gateway or a local model can still refuse |
| `AnthropicModel` | yes | no | audio is refused even if you claim it; `detail` is not sent |
| `GeminiModel` | yes | yes | `image/gif` is refused, because the provider does not list it |
| `HuggingFaceModel` | yes | yes | inherited from the OpenAI wire, and the route decides |
| `CustomModel` | no | no | yours to claim through `capabilities` |

`capabilities` overrides these for a route you know better, except that
`AnthropicModel` stays without audio. Images are untrusted input, and the
repository README's Images and audio section covers that, the size limits and
what a run costs.

Adapters written for `MODEL_ADAPTER_VERSION` 1 keep working through a shim that
flattens text parts and refuses media. A consumer that read `content` as a
string uses `messageText`, because `content` can now be a parts array.

## Install the facade, not this package

`@smolagents-ts/models` is public because the `smolagents-ts` facade re-exports
it.
Reach for the facade instead: installing this package alone is not a supported
path.

    npm install smolagents-ts

## Documentation

The repository's `docs/` tree is the documentation. The published site is
https://ahmadmhmdsy.github.io/smolagents-ts/

Its boundary is `rules/components/models.md`.

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
