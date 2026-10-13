export interface SseEvent {
  event?: string;
  data: string;
}

/**
 * Server-sent events over a byte stream, following the event-stream rules the providers
 * this project targets actually emit: lines end at LF, an event ends at a blank line, a
 * line starting with ":" is a comment, and "data:" lines join with LF.
 *
 * Decoding is incremental, so a multi-byte character split across two chunks survives, and
 * nothing is buffered beyond the current line.
 */
export async function* parseSse(stream: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const data: string[] = [];
  let buffer = "";
  let eventName: string | undefined;

  /** Ends the event in progress, if there is one. */
  const take = (): SseEvent | undefined => {
    if (data.length === 0) {
      eventName = undefined;
      return undefined;
    }
    const value = data.join("\n");
    data.length = 0;
    const name = eventName;
    eventName = undefined;
    return name === undefined ? { data: value } : { event: name, data: value };
  };

  /** Feeds one line; returns an event when that line ended one. */
  const consume = (raw: string): SseEvent | undefined => {
    const line = raw.endsWith("\r") ? raw.slice(0, -1) : raw;
    if (line === "") return take();
    if (line.startsWith(":")) return undefined;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let rest = colon === -1 ? "" : line.slice(colon + 1);
    if (rest.startsWith(" ")) rest = rest.slice(1);
    if (field === "data") data.push(rest);
    else if (field === "event") eventName = rest;
    return undefined;
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      for (;;) {
        const index = buffer.indexOf("\n");
        if (index === -1) break;
        const raw = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);
        const event = consume(raw);
        if (event !== undefined) yield event;
      }
    }
    buffer += decoder.decode();
    if (buffer !== "") {
      const event = consume(buffer);
      if (event !== undefined) yield event;
    }
    // A stream that ends without a blank line still has an event waiting.
    const last = take();
    if (last !== undefined) yield last;
  } finally {
    reader.releaseLock();
  }
}
