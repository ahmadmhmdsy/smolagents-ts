/**
 * A request/response peer with a per-request timeout and an abort hook, over an injected
 * transport. It carries the Jupyter handshake and, on a persistent channel, the tool frames:
 * an inbound request of a registered type runs a handler and its reply goes back with the
 * inbound id as `parentId`.
 *
 * No Node builtin is imported: the peer is transport-agnostic, and the WebSocket and the
 * HTTP client are the caller's.
 */

export interface RpcMessage {
  readonly id: string;
  readonly type: string;
  readonly parentId?: string;
  readonly content: Record<string, unknown>;
}

export interface RpcReply {
  readonly type: string;
  readonly content: Record<string, unknown>;
}

export interface RpcTransport {
  send(message: RpcMessage): void;
}

export type RpcRequestHandler = (message: RpcMessage) => RpcReply | Promise<RpcReply>;

export interface RpcRequestOptions {
  /** Reject with `RpcTimeoutError` after this long. 0 means no timer. */
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
  /** A request may draw several replies; this decides which one completes it. */
  readonly done?: (message: RpcMessage) => boolean;
}

export interface RpcExchange {
  readonly messages: readonly RpcMessage[];
}

export class RpcTimeoutError extends Error {
  readonly requestType: string;
  readonly timeoutMs: number;

  constructor(requestType: string, timeoutMs: number) {
    super('The "' + requestType + '" request got no answer within ' + String(timeoutMs) + " ms.");
    this.name = "RpcTimeoutError";
    this.requestType = requestType;
    this.timeoutMs = timeoutMs;
  }
}

export class RpcAbortedError extends Error {
  constructor(requestType: string) {
    super('The "' + requestType + '" request was aborted.');
    this.name = "RpcAbortedError";
  }
}

export class RpcDisposedError extends Error {
  constructor(message = "This RPC peer has been disposed.") {
    super(message);
    this.name = "RpcDisposedError";
  }
}

interface PendingExchange {
  readonly type: string;
  readonly messages: RpcMessage[];
  readonly resolve: (exchange: RpcExchange) => void;
  readonly reject: (error: unknown) => void;
  readonly done: ((message: RpcMessage) => boolean) | undefined;
  readonly signal: AbortSignal | undefined;
  timer: ReturnType<typeof setTimeout> | undefined;
  onAbort: (() => void) | undefined;
}

/** The reply type for an inbound request: `input_request` answers as `input_reply`. */
export function replyTypeFor(requestType: string): string {
  return requestType.endsWith("_request")
    ? requestType.slice(0, -"_request".length) + "_reply"
    : requestType + "_reply";
}

export class RpcPeer {
  private readonly pending = new Map<string, PendingExchange>();
  private readonly handlers = new Map<string, RpcRequestHandler>();
  private readonly observers = new Set<(message: RpcMessage) => void>();
  private sequence = 0;
  private disposed = false;

  constructor(private readonly transport: RpcTransport) {}

  get pendingCount(): number {
    return this.pending.size;
  }

  nextId(): string {
    this.sequence += 1;
    return "smolagents-" + this.sequence.toString(36) + "-" + Math.random().toString(36).slice(2, 10);
  }

  send(message: RpcMessage): void {
    if (this.disposed) throw new RpcDisposedError();
    this.transport.send(message);
  }

  /** Observe every inbound message. Returns the unsubscribe function. */
  onMessage(observer: (message: RpcMessage) => void): () => void {
    this.observers.add(observer);
    return () => {
      this.observers.delete(observer);
    };
  }

  /** Answer an inbound request of this type. Returns the unsubscribe function. */
  onRequest(type: string, handler: RpcRequestHandler): () => void {
    this.handlers.set(type, handler);
    return () => {
      if (this.handlers.get(type) === handler) this.handlers.delete(type);
    };
  }

  request(type: string, content: Record<string, unknown>, options: RpcRequestOptions = {}): Promise<RpcExchange> {
    if (this.disposed) return Promise.reject(new RpcDisposedError());
    const id = this.nextId();
    const promise = new Promise<RpcExchange>((resolve, reject) => {
      const pending: PendingExchange = {
        type,
        messages: [],
        resolve,
        reject,
        done: options.done,
        signal: options.signal,
        timer: undefined,
        onAbort: undefined,
      };
      this.pending.set(id, pending);
      const timeoutMs = options.timeoutMs ?? 0;
      if (timeoutMs > 0) {
        pending.timer = setTimeout(() => this.fail(id, new RpcTimeoutError(type, timeoutMs)), timeoutMs);
      }
      const signal = options.signal;
      if (signal !== undefined) {
        if (signal.aborted) {
          this.fail(id, new RpcAbortedError(type));
          return;
        }
        pending.onAbort = () => this.fail(id, new RpcAbortedError(type));
        signal.addEventListener("abort", pending.onAbort, { once: true });
      }
    });
    try {
      this.send({ id, type, content });
    } catch (error) {
      // A transport that throws must reject the returned promise rather than raise here and
      // leave the pending entry and its timer alive.
      this.fail(id, error);
    }
    return promise;
  }

  /** Route one inbound message: to an observer, a registered handler, or a pending exchange. */
  handle(message: RpcMessage): void {
    if (this.disposed) return;
    for (const observer of this.observers) observer(message);
    // An inbound request wins over the pending-exchange match: a Jupyter input_request carries
    // the execute_request as its parent, so it would otherwise be swallowed as a reply.
    if (this.handlers.has(message.type)) {
      void this.dispatch(message);
      return;
    }
    if (message.parentId !== undefined) {
      const pending = this.pending.get(message.parentId);
      if (pending !== undefined) {
        pending.messages.push(message);
        const done = pending.done;
        if (done === undefined || done(message)) {
          this.pending.delete(message.parentId);
          this.cleanup(pending);
          pending.resolve({ messages: pending.messages });
        }
        return;
      }
    }
    void this.dispatch(message);
  }

  dispose(): void {
    this.disposed = true;
    for (const [id, pending] of [...this.pending]) {
      this.pending.delete(id);
      this.cleanup(pending);
      pending.reject(new RpcDisposedError());
    }
    this.handlers.clear();
    this.observers.clear();
  }

  private async dispatch(message: RpcMessage): Promise<void> {
    const handler = this.handlers.get(message.type);
    if (handler === undefined) return;
    let reply: RpcReply;
    try {
      reply = await handler(message);
    } catch (error) {
      reply = {
        type: replyTypeFor(message.type),
        content: { error: error instanceof Error ? error.message : String(error) },
      };
    }
    if (this.disposed) return;
    this.send({ id: this.nextId(), type: reply.type, parentId: message.id, content: reply.content });
  }

  private fail(id: string, error: unknown): void {
    const pending = this.pending.get(id);
    if (pending === undefined) return;
    this.pending.delete(id);
    this.cleanup(pending);
    pending.reject(error);
  }

  private cleanup(pending: PendingExchange): void {
    if (pending.timer !== undefined) clearTimeout(pending.timer);
    if (pending.onAbort !== undefined && pending.signal !== undefined) {
      pending.signal.removeEventListener("abort", pending.onAbort);
    }
  }
}
