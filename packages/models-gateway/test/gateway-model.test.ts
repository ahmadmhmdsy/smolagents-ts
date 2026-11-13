import { FINAL_ANSWER_TOOL_NAME, ToolCallingAgent, collectCompletion } from "@smolagents-ts/core";
import { describe, expect, it } from "vitest";
import {
  GatewayModel,
  readGatewayHeaders,
  type GatewayFetch,
  type GatewayResponse,
  type GatewayResponseContext,
} from "../src/index.js";

/**
 * The response headers OmniRoute attaches to a served request, hand-shaped from
 * `docs/research/omniroute-api-surface.md` §1 as it read gateway `3.8.53`. Not a capture of a
 * live gateway: the repository cannot reach one.
 */
const OMNIROUTE_HEADERS: Readonly<Record<string, string>> = {
  "x-omniroute-provider": "groq",
  "x-omniroute-model": "llama-3.3-70b",
  "x-omniroute-response-cost": "0.000042",
  "x-omniroute-cache": "MISS",
  "x-omniroute-fallback-attempts": "1",
  "x-omniroute-latency-ms": "312",
  "x-omniroute-decision": "strategy=cost; provider=groq; latency_ms=312",
  "x-omniroute-request-id": "req-1",
  "x-ratelimit-remaining": "99",
};

function completionBody(content: string): string {
  return JSON.stringify({
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 },
  });
}

const STREAM_BODY =
  'data: {"choices":[{"index":0,"delta":{"content":"Hello "}}]}\n\n' +
  'data: {"choices":[{"index":0,"delta":{"content":"there."},"finish_reason":"stop"}]}\n\n' +
  "data: [DONE]\n\n";

interface Recorded {
  readonly url: string;
  readonly init: RequestInit;
}

function fakeFetch(
  respond: (call: number) => { body: string; headers?: Record<string, string>; status?: number },
  requests: Recorded[] = [],
): GatewayFetch {
  return (url, init) => {
    requests.push({ url, init });
    const { body, headers = {}, status = 200 } = respond(requests.length);
    return Promise.resolve(new Response(body, { status, headers }));
  };
}

function collector() {
  const events: { response: GatewayResponse; context: GatewayResponseContext }[] = [];
  return {
    events,
    onResponse: (response: GatewayResponse, context: GatewayResponseContext) => {
      events.push({ response, context });
    },
  };
}

describe("readGatewayHeaders", () => {
  it("reads each named OmniRoute header and copies every prefixed one", () => {
    const meta = readGatewayHeaders(new Headers(OMNIROUTE_HEADERS));

    expect(meta).toMatchObject({
      provider: "groq",
      model: "llama-3.3-70b",
      costUsd: 0.000042,
      cache: "miss",
      fallbackAttempts: 1,
      latencyMs: 312,
      decision: "strategy=cost; provider=groq; latency_ms=312",
      requestId: "req-1",
    });
    expect(Object.keys(meta.headers)).toHaveLength(8);
    expect(meta.headers["x-ratelimit-remaining"]).toBeUndefined();
  });

  it("leaves out a header that is absent, empty or not a number, rather than guessing", () => {
    const meta = readGatewayHeaders(
      new Headers({ "x-omniroute-response-cost": "n/a", "x-omniroute-cache": "maybe", "x-omniroute-model": "" }),
    );

    expect(meta.costUsd).toBeUndefined();
    expect(meta.cache).toBeUndefined();
    expect(meta.model).toBeUndefined();
    expect(meta.provider).toBeUndefined();
  });

  it("serves a gateway that is not OmniRoute through the prefix alone", () => {
    const meta = readGatewayHeaders(new Headers({ "x-litellm-response-cost": "0.1" }), ["x-litellm-"]);

    expect(meta.headers).toEqual({ "x-litellm-response-cost": "0.1" });
    expect(meta.costUsd).toBeUndefined();
  });
});

describe("GatewayModel", () => {
  it("reports the gateway's headers once per generate call, after the body is read", async () => {
    const requests: Recorded[] = [];
    const { events, onResponse } = collector();
    const model = new GatewayModel({
      model: "auto",
      baseUrl: "http://localhost:20128/v1/",
      apiKey: "sk-test",
      fetch: fakeFetch(() => ({ body: completionBody("Hi."), headers: OMNIROUTE_HEADERS }), requests),
      onResponse,
    });

    const completion = await model.generate([{ role: "user", content: "Q" }]);

    expect(completion.content).toBe("Hi.");
    expect(requests[0]?.url).toBe("http://localhost:20128/v1/chat/completions");
    expect(new Headers(requests[0]?.init.headers).get("authorization")).toBe("Bearer sk-test");
    expect(events).toHaveLength(1);
    expect(events[0]?.response.provider).toBe("groq");
    expect(events[0]?.context).toEqual({ modelId: "auto", stream: false, status: 200 });
  });

  it("reports a streamed call when the stream ends, not when it starts", async () => {
    const { events, onResponse } = collector();
    const model = new GatewayModel({
      model: "auto",
      baseUrl: "http://localhost:20128/v1",
      fetch: fakeFetch(() => ({
        body: STREAM_BODY,
        headers: { ...OMNIROUTE_HEADERS, "content-type": "text/event-stream" },
      })),
      onResponse,
    });

    const stream = model.generateStream([{ role: "user", content: "Q" }])[Symbol.asyncIterator]();
    const first = await stream.next();
    expect(first.done).toBe(false);
    expect(events).toHaveLength(0);

    const rest = await collectCompletion({ [Symbol.asyncIterator]: () => stream });
    expect(rest.content).toBe("there.");
    expect(events).toHaveLength(1);
    expect(events[0]?.context.stream).toBe(true);
  });

  it("gives each of two concurrent calls its own headers", async () => {
    const { events, onResponse } = collector();
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetchImpl: GatewayFetch = async (_url, init) => {
      const body = JSON.parse(String(init.body)) as { messages: { content: string }[] };
      const which = body.messages.at(-1)?.content ?? "";
      // The first call is held until the second has finished, so a shared slot would be overwritten.
      if (which === "first") await held;
      return new Response(completionBody(which), {
        status: 200,
        headers: { "x-omniroute-request-id": which },
      });
    };
    const model = new GatewayModel({ model: "auto", baseUrl: "http://gw/v1", fetch: fetchImpl, onResponse });

    const first = model.generate([{ role: "user", content: "first" }]);
    const second = await model.generate([{ role: "user", content: "second" }]);
    release();
    const firstDone = await first;

    expect(second.content).toBe("second");
    expect(firstDone.content).toBe("first");
    expect(events.map((event) => event.response.requestId)).toEqual(["second", "first"]);
  });

  it("reports nothing for a request the gateway refused, and the call throws", async () => {
    const { events, onResponse } = collector();
    const model = new GatewayModel({
      model: "auto",
      baseUrl: "http://gw/v1",
      apiKey: "sk-secret",
      fetch: fakeFetch(() => ({ body: '{"error":{"message":"no route"}}', status: 503 })),
      onResponse,
    });

    const failure = await model.generate([{ role: "user", content: "Q" }]).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(Error);
    expect(String((failure as Error).message)).not.toContain("sk-secret");
    expect(events).toHaveLength(0);
  });

  it("claims no tool calls until the caller pins an id that has them", () => {
    const fetchImpl = fakeFetch(() => ({ body: completionBody("") }));
    const unpinned = new GatewayModel({ model: "auto", baseUrl: "http://gw/v1", fetch: fetchImpl });
    const pinned = new GatewayModel({
      model: "openai/gpt-4o-mini",
      baseUrl: "http://gw/v1",
      fetch: fetchImpl,
      capabilities: { toolCalls: true },
      provider: "omniroute",
    });

    expect(unpinned.capabilities.toolCalls).toBe(false);
    expect(unpinned.provider).toBe("gateway");
    expect(pinned.capabilities.toolCalls).toBe(true);
    expect(pinned.provider).toBe("omniroute");
    expect(pinned.id).toBe("openai/gpt-4o-mini");
  });

  it("refuses an empty model id or base URL", () => {
    const fetchImpl = fakeFetch(() => ({ body: "" }));
    expect(() => new GatewayModel({ model: " ", baseUrl: "http://gw/v1", fetch: fetchImpl })).toThrow(/model id/);
    expect(() => new GatewayModel({ model: "auto", baseUrl: "", fetch: fetchImpl })).toThrow(/baseUrl/);
  });

  it("serves a ToolCallingAgent run, reporting each model call", async () => {
    const { events, onResponse } = collector();
    const answer = JSON.stringify({
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: null,
            tool_calls: [
              {
                id: "c-1",
                type: "function",
                function: { name: FINAL_ANSWER_TOOL_NAME, arguments: JSON.stringify({ answer: 42 }) },
              },
            ],
          },
          finish_reason: "tool_calls",
        },
      ],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });
    const model = new GatewayModel({
      model: "openai/gpt-4o-mini",
      baseUrl: "http://gw/v1",
      capabilities: { toolCalls: true },
      fetch: fakeFetch(() => ({ body: answer, headers: OMNIROUTE_HEADERS })),
      onResponse,
    });

    const result = await new ToolCallingAgent({ model }).run("answer");

    expect(result.output).toBe(42);
    expect(events).toHaveLength(1);
    expect(events[0]?.response.costUsd).toBe(0.000042);
  });
});
