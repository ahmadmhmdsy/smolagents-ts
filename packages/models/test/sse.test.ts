import { describe, expect, it } from "vitest";
import { parseSse } from "../src/sse.js";
import type { SseEvent } from "../src/sse.js";

function body(...parts: Array<string | Uint8Array>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
      }
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const out: string[] = [];
  for await (const event of parseSse(stream)) out.push(event.data);
  return out;
}

describe("parseSse", () => {
  it("yields one event per data line", async () => {
    const events = await collect(
      body('data: {"a":1}\n\n', 'data: {"a":2}\n\n', "data: [DONE]\n\n"),
    );
    expect(events).toEqual(['{"a":1}', '{"a":2}', "[DONE]"]);
  });

  it("reassembles an event split across chunks", async () => {
    const events = await collect(body('data: {"a', '":1}\n', "\ndata: [DONE]\n\n"));
    expect(events).toEqual(['{"a":1}', "[DONE]"]);
  });

  it("ignores comments and blank keep-alives", async () => {
    const events = await collect(body(": keep-alive\n\n", 'data: {"a":1}\n\n'));
    expect(events).toEqual(['{"a":1}']);
  });

  it("yields a final event with no trailing blank line", async () => {
    const events = await collect(body('data: {"a":1}'));
    expect(events).toEqual(['{"a":1}']);
  });

  it("keeps a multi-byte character split across chunks intact", async () => {
    const bytes = new TextEncoder().encode('data: "héllo"\n\n');
    const cut = bytes.indexOf(0xc3) + 1;
    const events = await collect(body(bytes.slice(0, cut), bytes.slice(cut)));
    expect(events).toEqual(['"héllo"']);
  });

  it("reports the event name when the stream sets one", async () => {
    const stream = body("event: ping\ndata: {}\n\n");
    const events: SseEvent[] = [];
    for await (const event of parseSse(stream)) events.push(event);
    expect(events).toEqual([{ event: "ping", data: "{}" }]);
  });
});
