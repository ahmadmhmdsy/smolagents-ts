import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";

/** What a step matches on. A tool call matches on the method and the tool's name. */
export interface FixtureExpectation {
  /** The JSON-RPC method, e.g. "tools/list". */
  method: string;
  /** Matches params.name; set it when the same method is called more than once. */
  name?: string;
}

/** The server's reply to one step: exactly one of result or error. */
export type FixtureReply =
  | { readonly result: Record<string, unknown> }
  | { readonly error: { readonly code: number; readonly message: string; readonly data?: unknown } };

export interface FixtureStep {
  readonly expect: FixtureExpectation;
  readonly reply: FixtureReply;
  /** An unsolicited message delivered before the step's reply. */
  readonly notify?: { readonly method: string; readonly params?: Record<string, unknown> };
}

/** The shape of a file under test/fixtures/. */
export interface Fixture {
  /** Steps the fake server must see, in order. */
  readonly steps: readonly FixtureStep[];
}

/**
 * Replays a recorded transcript, and records what the client sent.
 *
 * The reply's id is copied from the request that matched, so a hand-written fixture
 * carries no correlation ids and cannot drift from the id the client actually picks.
 * Any request that matches no step fails the test with the method named.
 */
export class FixtureTransport implements MCPTransport {
  /** Every message the client sent, in order, including notifications. */
  readonly sent: MCPMessage[] = [];
  /** Set by the client; the fixture calls these to deliver messages. */
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  private readonly steps: readonly FixtureStep[];
  private cursor = 0;
  private started = false;
  private closedOnce = false;

  constructor(fixture: Fixture) {
    this.steps = fixture.steps;
  }

  /** True once close() has run, so a test can assert the client closed the transport. */
  get closed(): boolean {
    return this.closedOnce;
  }

  /** The methods sent so far, for the ordering assertion. */
  methods(): string[] {
    return this.sent.map((message) => ("method" in message ? message.method : "(response)"));
  }

  start(): Promise<void> {
    this.started = true;
    return Promise.resolve();
  }

  async send(message: MCPMessage): Promise<void> {
    if (!this.started) throw new Error("FixtureTransport.send before start()");
    if (this.closedOnce) throw new Error("FixtureTransport.send after close()");
    this.sent.push(message);
    if (!("method" in message) || !("id" in message)) return;
    const request = message;
    const step = this.steps[this.cursor];
    if (step === undefined) {
      throw new Error(
        "FixtureTransport: no steps left for " +
          request.method +
          "; the transcript was shorter than the client's conversation",
      );
    }
    if (step.expect.method !== request.method) {
      throw new Error(
        "FixtureTransport: expected " +
          step.expect.method +
          " but the client sent " +
          request.method,
      );
    }
    const name = (request.params as { name?: unknown } | undefined)?.name;
    if (step.expect.name !== undefined && step.expect.name !== name) {
      throw new Error(
        "FixtureTransport: expected the tool " +
          step.expect.name +
          " but the client called " +
          String(name) +
          " on " +
          request.method,
      );
    }
    this.cursor += 1;
    if (step.notify !== undefined) {
      const notification: MCPMessage = {
        jsonrpc: "2.0",
        method: step.notify.method,
        ...(step.notify.params === undefined ? {} : { params: step.notify.params }),
      };
      this.deliver(notification);
    }
    const reply: MCPMessage =
      "error" in step.reply
        ? { jsonrpc: "2.0", id: request.id, error: step.reply.error }
        : { jsonrpc: "2.0", id: request.id, result: step.reply.result };
    this.deliver(reply);
  }

  close(): Promise<void> {
    this.closedOnce = true;
    return Promise.resolve();
  }

  /** Delivers a message to the client as if the peer had sent it. */
  deliver(message: MCPMessage): void {
    this.onmessage?.(message);
  }

  /** Delivers an unsolicited notification, e.g. tools/list_changed. */
  notify(method: string, params?: Record<string, unknown>): void {
    this.deliver({ jsonrpc: "2.0", method, ...(params === undefined ? {} : { params }) });
  }

  /** Fails the transport, as a dead subprocess or a dropped socket would. */
  fail(error: Error): void {
    this.onerror?.(error);
  }

  /** Simulates the peer going away without a close() from this side. */
  peerClosed(): void {
    this.onclose?.();
  }

  /** The number of steps the transcript still holds; zero means it was exhausted. */
  get remaining(): number {
    return this.steps.length - this.cursor;
  }
}

/** Reads a fixture's JSON into the typed shape, with the shape asserted by the tests. */
export function fixtureFrom(value: unknown): Fixture {
  return value as Fixture;
}
