import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  StdioTransport,
  createStdioTransport,
  stdioClient,
  type ChildProcessLike,
  type SpawnLike,
} from "../src/transports/stdio.js";
import { MCPClient } from "../src/client.js";
import {
  MCPClosedError,
  MCPConnectionError,
  MCPParameterError,
  MCPTransportError,
} from "../src/errors.js";
import type { MCPMessage } from "../src/json-rpc.js";
import type { MCPTransport } from "../src/transport.js";
import { recordingLogger } from "./helpers.js";

/** A stand-in for node:child_process's ChildProcess, with pipes a test drives. */
class FakeChild implements ChildProcessLike {
  readonly writes: string[] = [];
  readonly stdout = new EventEmitter();
  readonly stderr = new EventEmitter();
  killed = false;
  exitCode: number | null = null;
  stdinEnded = false;
  /** Assigned by a test that wants to answer requests. */
  handler: ((chunk: string) => void) | undefined;
  private readonly errorListeners: ((error: Error) => void)[] = [];
  private readonly exitListeners: ((code: number | null, signal: string | null) => void)[] = [];

  readonly stdin = {
    write: (chunk: string): boolean => {
      this.writes.push(chunk);
      this.handler?.(chunk);
      return true;
    },
    end: (): void => {
      this.stdinEnded = true;
    },
  };

  on(event: "error", listener: (error: Error) => void): this;
  on(event: "exit", listener: (code: number | null, signal: string | null) => void): this;
  on(event: "error" | "exit", listener: ((error: Error) => void) | ((code: number | null, signal: string | null) => void)): this {
    if (event === "error") this.errorListeners.push(listener as (error: Error) => void);
    else this.exitListeners.push(listener as (code: number | null, signal: string | null) => void);
    return this;
  }

  kill(): boolean {
    this.killed = true;
    for (const listener of this.exitListeners) listener(null, "SIGTERM");
    return true;
  }

  emitExit(code: number | null = null, signal: string | null = null): void {
    for (const listener of this.exitListeners) listener(code, signal);
  }

  emitError(error: Error): void {
    for (const listener of this.errorListeners) listener(error);
  }

  emitStdout(text: string): void {
    this.stdout.emit("data", text);
  }

  emitStderr(text: string): void {
    this.stderr.emit("data", text);
  }
}

interface SpawnCall {
  readonly command: string;
  readonly args: readonly string[];
  readonly env?: Record<string, string>;
  readonly cwd?: string;
}

function spawnWith(child: FakeChild): { spawn: SpawnLike; calls: SpawnCall[] } {
  const calls: SpawnCall[] = [];
  return {
    calls,
    spawn: (command, args, options) => {
      calls.push({
        command,
        args,
        ...(options.env === undefined ? {} : { env: options.env }),
        ...(options.cwd === undefined ? {} : { cwd: options.cwd }),
      });
      return child;
    },
  };
}

/** A tiny MCP server run by a real node process, to prove the framing over a pipe. */
const SERVER_SOURCE = `
let buffer = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  for (;;) {
    const index = buffer.indexOf("\\n");
    if (index === -1) break;
    const line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    if (line.trim() === "") continue;
    const request = JSON.parse(line);
    process.stderr.write("saw " + request.method + "\\n");
    if (!("id" in request)) continue;
    const result =
      request.method === "initialize"
        ? { protocolVersion: "2025-11-25", capabilities: { tools: {} }, serverInfo: { name: "inline", version: "1" } }
        : request.method === "tools/list"
          ? { tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object", properties: { text: { type: "string" } } } }] }
          : { content: [{ type: "text", text: "piped" }] };
    process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id: request.id, result }) + "\\n");
  }
});
`;

describe("the stdio transport", () => {
  it("spawns the command with its args, env and cwd", async () => {
    const child = new FakeChild();
    const { spawn, calls } = spawnWith(child);
    const transport = createStdioTransport(
      { command: "npx", args: ["-y", "server"], env: { TOKEN: "x" }, cwd: "/tmp" },
      { spawn },
    );
    await transport.start();

    expect(calls).toEqual([
      { command: "npx", args: ["-y", "server"], env: { TOKEN: "x" }, cwd: "/tmp" },
    ]);
    await transport.close();
  });

  it("frames one message per line and reassembles split lines", async () => {
    const child = new FakeChild();
    const received: MCPMessage[] = [];
    const transport = new StdioTransport({ command: "x" }, { spawn: spawnWith(child).spawn });
    transport.onmessage = (message) => received.push(message);
    await transport.start();
    await transport.send({ jsonrpc: "2.0", id: 1, method: "tools/list" });

    expect(child.writes).toHaveLength(1);
    expect(child.writes[0]).toBe('{"jsonrpc":"2.0","id":1,"method":"tools/list"}\n');

    child.emitStdout('{"jsonrpc":"2.0","id":1,');
    expect(received).toHaveLength(0);
    child.emitStdout('"result":{"tools":[]}}\n');
    expect(received).toEqual([{ jsonrpc: "2.0", id: 1, result: { tools: [] } }]);
    await transport.close();
  });

  it("forwards stderr line by line to the logger", async () => {
    const child = new FakeChild();
    const logger = recordingLogger();
    const transport = new StdioTransport({ command: "x" }, { spawn: spawnWith(child).spawn, logger });
    await transport.start();
    child.emitStderr("listening on stdio\n");
    expect(logger.messages).toContain("info: mcp[stderr]: listening on stdio");
    await transport.close();
  });

  it("reports a malformed line as a transport error without dropping the transport", async () => {
    const child = new FakeChild();
    const errors: Error[] = [];
    const transport = new StdioTransport({ command: "x" }, { spawn: spawnWith(child).spawn });
    transport.onerror = (error) => errors.push(error);
    await transport.start();
    child.emitStdout("not json\n");
    expect(errors[0]).toBeInstanceOf(MCPTransportError);
    expect(errors[0]?.message).toMatch(/not JSON/);
    await transport.close();
  });

  it("reports the child's exit as a close, once", async () => {
    const child = new FakeChild();
    let closes = 0;
    const transport = new StdioTransport({ command: "x" }, { spawn: spawnWith(child).spawn });
    transport.onclose = () => {
      closes += 1;
    };
    await transport.start();
    child.emitExit(0, null);
    expect(closes).toBe(1);
    await transport.close();
    expect(closes).toBe(1);
  });

  it("kills the child on close and refuses a send afterwards", async () => {
    const child = new FakeChild();
    const transport = new StdioTransport({ command: "x" }, { spawn: spawnWith(child).spawn });
    await transport.start();
    await transport.close();
    expect(child.killed).toBe(true);
    expect(child.stdinEnded).toBe(true);
    await expect(transport.send({ jsonrpc: "2.0", id: 1, method: "tools/list" })).rejects.toThrow(
      MCPClosedError,
    );
    // A second close is quiet.
    await transport.close();
  });

  it("routes an EPIPE on the child's stdin to onerror instead of crashing the process", async () => {
    const child = new FakeChild();
    // A real pipe is an EventEmitter, and an 'error' it emits with no listener is thrown.
    const pipe = Object.assign(new EventEmitter(), child.stdin);
    const piped = Object.assign(Object.create(child) as FakeChild, { stdin: pipe });
    const errors: Error[] = [];
    const transport = new StdioTransport({ command: "srv" }, { spawn: spawnWith(piped).spawn });
    transport.onerror = (error) => errors.push(error);
    await transport.start();

    expect(() => pipe.emit("error", new Error("write EPIPE"))).not.toThrow();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(MCPTransportError);
    expect(errors[0]?.message).toMatch(/srv.*EPIPE/);
    await transport.close();
  });

  it("rejects a spawn that throws, naming the command", async () => {
    const transport = new StdioTransport(
      { command: "no-such-binary" },
      {
        spawn: () => {
          throw new Error("ENOENT");
        },
      },
    );
    await expect(transport.start()).rejects.toThrow(MCPTransportError);
    await expect(transport.start()).rejects.toThrow(/no-such-binary.*ENOENT/s);
  });
});

describe("the stdio transport as a client's seam", () => {
  it("replays a server's answers through a fake child", async () => {
    const child = new FakeChild();
    const transport = new StdioTransport({ command: "fake" }, { spawn: spawnWith(child).spawn });
    const responses: Record<string, unknown> = {
      initialize: {
        protocolVersion: "2025-11-25",
        capabilities: { tools: {} },
        serverInfo: { name: "fake", version: "1" },
      },
      "tools/list": {
        tools: [{ name: "echo", description: "Echo.", inputSchema: { type: "object" } }],
      },
      "tools/call": { content: [{ type: "text", text: "fake answer" }] },
    };
    child.handler = (chunk) => {
      const request = JSON.parse(chunk) as { id?: number; method: string };
      if (request.id === undefined) return;
      child.emitStdout(
        JSON.stringify({ jsonrpc: "2.0", id: request.id, result: responses[request.method] ?? {} }) +
          "\n",
      );
    };

    const client = await MCPClient.create([{ command: "fake" }], {
      transportFactory: () => transport as MCPTransport,
    });
    const tools = await client.getTools();
    expect(tools.map((entry) => entry.name)).toEqual(["echo"]);
    client.disconnect();
  });

  it("drives a real node subprocess through stdioClient over a pipe", async () => {
    const client = await stdioClient({
      command: process.execPath,
      args: ["--input-type=module", "-e", SERVER_SOURCE],
    });
    try {
      const tools = await client.getTools();
      expect(tools.map((entry) => entry.name)).toEqual(["echo"]);
      const result = await tools[0]!.execute(
        { text: "anything" },
        {
          signal: new AbortController().signal,
          fetch: globalThis.fetch,
          callId: "call-1",
          stepIndex: 0,
          logger: recordingLogger(),
        },
      );
      expect(result).toBe("piped");
    } finally {
      client.disconnect();
    }
  }, 30_000);

  it("routes a message that arrives after disconnect to onerror, not out of the reader", async () => {
    const child = new FakeChild();
    const transport = new StdioTransport({ command: "fake" }, { spawn: spawnWith(child).spawn });
    child.handler = (chunk) => {
      const request = JSON.parse(chunk) as { id?: number };
      if (request.id === undefined) return;
      child.emitStdout(
        JSON.stringify({
          jsonrpc: "2.0",
          id: request.id,
          result: {
            protocolVersion: "2025-11-25",
            capabilities: {},
            serverInfo: { name: "fake", version: "1" },
          },
        }) + "\n",
      );
    };
    const client = await MCPClient.create([{ command: "fake" }], {
      transportFactory: () => transport,
    });

    // Keep the client's own handler in the chain, and record what reaches it.
    const errors: Error[] = [];
    const chained = transport.onerror;
    transport.onerror = (error) => {
      errors.push(error);
      chained?.(error);
    };
    client.disconnect();

    // The child is still alive for a moment, so a line can arrive after disconnect().
    let escaped: unknown;
    try {
      child.emitStdout('{"jsonrpc":"2.0","id":99,"result":{}}\n');
    } catch (error) {
      escaped = error;
    }
    expect(escaped).toBeUndefined();
    expect(errors).toHaveLength(1);
    expect(errors[0]).toBeInstanceOf(MCPConnectionError);
    expect(errors[0]?.message).toMatch(/after disconnect/);
  });

  it("refuses a URL parameter with a pointer at MCPClient.create", async () => {
    await expect(stdioClient({ url: "http://x/mcp" } as never)).rejects.toThrow(MCPParameterError);
    await expect(stdioClient({ url: "http://x/mcp" } as never)).rejects.toThrow(/MCPClient\.create/);
  });
});
