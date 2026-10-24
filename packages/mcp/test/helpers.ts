import { readFileSync } from "node:fs";
import type { Logger } from "@smolagents-ts/core";
import { MCPClient } from "../src/client.js";
import type { MCPNotificationListener } from "../src/notifications.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import type { Fixture } from "./fixture-transport.js";

/** Reads a recorded transcript from test/fixtures/. */
export function loadFixture(name: string): Fixture {
  const url = new URL("./fixtures/" + name + ".json", import.meta.url);
  return JSON.parse(readFileSync(url, "utf8")) as Fixture;
}

/** A client over one fixture. The base URL is never fetched: the factory wins. */
export async function clientWithTransport(
  transport: MCPTransport,
  options: {
    requestTimeoutMs?: number;
    logger?: Logger;
    structuredOutput?: boolean;
    maxListPages?: number;
    onNotification?: MCPNotificationListener;
  } = {},
): Promise<MCPClient> {
  return MCPClient.create([{ url: "http://fixture.invalid/mcp" }], {
    ...options,
    transportFactory: () => transport,
  });
}

/** A transport that never answers, for the timeout and abort cases. */
export class SilentTransport implements MCPTransport {
  readonly sent: MCPMessage[] = [];
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: MCPMessage) => void;
  sessionId?: string;
  setProtocolVersion?: (version: string) => void;

  start(): Promise<void> {
    return Promise.resolve();
  }

  send(message: MCPMessage): Promise<void> {
    this.sent.push(message);
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.onclose?.();
    return Promise.resolve();
  }
}

/** A logger that records what a test wants to see. */
export function recordingLogger(): Logger & { readonly messages: string[] } {
  const messages: string[] = [];
  const push = (level: string) => (message: string) => {
    messages.push(level + ": " + message);
  };
  return {
    messages,
    debug: push("debug"),
    info: push("info"),
    warn: push("warn"),
    error: push("error"),
  };
}
