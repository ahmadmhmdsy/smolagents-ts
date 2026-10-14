# @smolagents-ts/react-ui

The copy-in styled layer over `@smolagents-ts/react`: one wrapper per pattern
and leaf that adds a `.smol-*` class and forwards props, plus a plain
stylesheet. React is its only peer.

## The stylesheet is yours

`dist/styles.css` is plain CSS text, not a runtime. The package ships it in
the tarball but never imports it, so nothing applies it for you: copy it into a
stylesheet you own and edit it there. No Tailwind, no CSS-in-JS, no build-time
framework.

## Documentation

The repository's `docs/` tree is the documentation. The published site is
https://ahmadmhmdsy.github.io/smolagents-ts/

## Licence

Apache-2.0; see `NOTICE`. Unofficial, and not affiliated with Hugging Face.
