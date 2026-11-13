# @smolagents-ts/models-gateway

A smolagents-ts model reached through an OpenAI-compatible AI gateway such as
OmniRoute, with what the gateway says about each request: which provider served
it, what it cost, whether the cache hit and how many fallbacks fired.

```bash
npm install @smolagents-ts/models-gateway @smolagents-ts/core @smolagents-ts/models
```

A gateway already works through `OpenAICompatibleModel` with a `baseUrl`. Use
this package when you also want the gateway's routing and cost, which it sends
only as response headers the model seam never sees.

## Run an agent through a gateway

```ts
import { ToolCallingAgent } from "@smolagents-ts/core";
import { GatewayModel } from "@smolagents-ts/models-gateway";

const model = new GatewayModel({
  model: "openai/gpt-4o-mini",
  baseUrl: "http://localhost:20128/v1",
  apiKey: process.env.OMNIROUTE_API_KEY,
  // One gateway id can route to a model without tools, so tool calls are off until you say so.
  capabilities: { toolCalls: true },
  onResponse: (response, context) => {
    console.log(context.modelId, "served by", response.provider, "for $", response.costUsd);
  },
});

const result = await new ToolCallingAgent({ model }).run("What is 6 times 7?");
```

`onResponse` is called once per completed request, after the body is read or the
stream ends. A request the gateway refuses throws and reports nothing. The model
keeps no copy of the last response, so two runs sharing one model never read
each other's value. To tie the events to one run, give that run its own
`GatewayModel`.

## What a response carries

| field | header |
|---|---|
| `provider` | `X-OmniRoute-Provider` |
| `model` | `X-OmniRoute-Model` |
| `costUsd` | `X-OmniRoute-Response-Cost` |
| `cache` (`"hit"` or `"miss"`) | `X-OmniRoute-Cache` |
| `fallbackAttempts` | `X-OmniRoute-Fallback-Attempts` |
| `latencyMs` | `X-OmniRoute-Latency-Ms` |
| `decision` (unparsed) | `X-OmniRoute-Decision` |
| `requestId` | `X-OmniRoute-Request-Id` |
| `headers` | every header starting with a configured prefix |

A field is present only when the gateway sent it as a valid value. For another
gateway, pass its prefix, for example `headerPrefixes: ["x-litellm-"]`, and read
`headers`.

## List a gateway's models

```ts
import { listGatewayModels } from "@smolagents-ts/models-gateway";

const ids = await listGatewayModels({ baseUrl: "http://localhost:20128/v1" });
```

## Limits

- The run's cost comes from the core's price table, as for any model. The
  gateway's own figure is in `costUsd` and is never added to `TokenUsage`.
- `auto` and combos may route each request to a different upstream, so a run
  through them is not reproducible. Pin a model id when it must be.
- No routing policy, retry, budget or combo management. Retry belongs to the
  caller, or to `FallbackModel` from `@smolagents-ts/models`.
- A browser page needs the gateway to allow its origin; that is gateway
  configuration.

Licensed under Apache-2.0.
