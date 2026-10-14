# @smolagents-ts/models

Provider adapters behind the core's `Model` interface: OpenAI-compatible,
Anthropic, Gemini, Hugging Face, and a model defined by plain functions. Every
adapter reports the capabilities it has rather than the ones it lacks.

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
