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

## Falling back to another provider

`FallbackModel` wraps an ordered list of models and is itself a `Model`, so the
agent loop does not know it is there.

    const model = new FallbackModel({
      models: [primary, backup],
      onFallback: ({ from, to, error }) => log.warn(from.id + " failed, trying " + to.id, error),
    });

Every call starts with the first model. It moves to the next only on a failure
a retry could fix: a network error, a timeout, or HTTP 408, 409, 429 or 5xx.
Another 4xx, such as a bad key or a malformed request, is thrown as it is,
because the next provider would answer the same way. An abort is never moved.
A stream that has already yielded a chunk is never moved either, because a
second provider cannot continue another's partial answer.

Its capabilities are the intersection of its members'. When every model fails
with a movable error, it throws an `AggregateError` holding each failure. Pass
`isRetryable` to replace the move rule; the default is exported as
`isRetryableModelError`.

A move adds latency and spends a second provider's tokens, so `onFallback`
reports each one. It is a policy over models you name, not a router: there is
no cost table, health probe or load balancing.

## Local runtimes

Ollama, LM Studio, llama.cpp's `llama-server` and vLLM all speak the
OpenAI-compatible wire, so each has a preset over `OpenAICompatibleModel`
rather than an adapter of its own:

    const model = ollamaModel({ model: "qwen3:8b" });

| preset | default address | tool calls |
|---|---|---|
| `ollamaModel` | `http://localhost:11434/v1` | yes |
| `lmStudioModel` | `http://localhost:1234/v1` | yes |
| `llamaCppModel` | `http://localhost:8080/v1` | claim it when the server runs with `--jinja` |
| `vllmModel` | `http://localhost:8000/v1` | claim it when the server runs with `--enable-auto-tool-choice` |

No key is needed; pass `apiKey` if you started the server with one. Images and
audio are off, because they depend on the model you loaded; claim them through
`capabilities`. A preset starts no process: run the server yourself.

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
