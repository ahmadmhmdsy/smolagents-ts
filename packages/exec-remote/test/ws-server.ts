import { createHash } from "node:crypto";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import type { Socket } from "node:net";

/**
 * A real loopback HTTP + WebSocket server speaking the subset of the Jupyter Kernel Gateway
 * protocol this package's driver uses. It is the offline stand-in for a container's kernel:
 * the readiness probe, the kernel create, and one persistent channel. It implements the
 * WebSocket handshake and the unmasked/masked frame codec itself, so the test needs no vendor
 * package and no daemon.
 */

export const FRAME_PREFIX = "@@SMOLAGENTS_FRAME@@";

export interface LoopbackJupyter {
  readonly url: string;
  readonly host: string;
  readonly port: number;
  readonly kernelId: string;
  readonly token: string;
  readonly requests: string[];
  readonly inputReplies: string[];
  readonly rejectedTokens: number;
  close(): Promise<void>;
}

interface WireEnvelope {
  header?: { msg_id?: unknown; msg_type?: unknown };
  content?: Record<string, unknown>;
}

function encodeFrame(text: string): Buffer {
  const payload = Buffer.from(text, "utf8");
  const length = payload.length;
  let header: Buffer;
  if (length < 126) {
    header = Buffer.from([0x81, length]);
  } else if (length < 65_536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(length), 2);
  }
  return Buffer.concat([header, payload]);
}

function decodeFrames(buffer: Buffer): { messages: string[]; rest: Buffer } {
  const messages: string[] = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const first = buffer[offset] as number;
    const second = buffer[offset + 1] as number;
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let headerLength = 2;
    if (length === 126) {
      if (offset + 4 > buffer.length) break;
      length = buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (length === 127) {
      if (offset + 10 > buffer.length) break;
      length = Number(buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }
    const maskLength = masked ? 4 : 0;
    const total = headerLength + maskLength + length;
    if (offset + total > buffer.length) break;
    let payload = buffer.subarray(offset + headerLength + maskLength, offset + total);
    if (masked) {
      const mask = buffer.subarray(offset + headerLength, offset + headerLength + 4);
      const unmasked = Buffer.alloc(length);
      for (let index = 0; index < length; index += 1) {
        unmasked[index] = (payload[index] as number) ^ (mask[index % 4] as number);
      }
      payload = unmasked;
    }
    if (opcode === 0x1) messages.push(payload.toString("utf8"));
    offset += total;
  }
  return { messages, rest: buffer.subarray(offset) };
}

export async function startJupyterLoopback(options: { token?: string } = {}): Promise<LoopbackJupyter> {
  const token = options.token ?? "test-token";
  const kernelId = "kernel-loopback";
  const requests: string[] = [];
  const inputReplies: string[] = [];
  let rejectedTokens = 0;
  let sequence = 0;
  const sockets = new Set<Socket>();
  const nextId = (): string => {
    sequence += 1;
    return "server-" + String(sequence);
  };

  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get("token") !== token) {
      rejectedTokens += 1;
      response.statusCode = 403;
      response.end();
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/kernelspecs") {
      response.statusCode = 200;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ default: "python3" }));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/kernels") {
      response.statusCode = 201;
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify({ id: kernelId }));
      return;
    }
    response.statusCode = 404;
    response.end();
  });

  server.on("upgrade", (request, socket: Socket) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get("token") !== token) {
      rejectedTokens += 1;
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    const key = request.headers["sec-websocket-key"];
    if (typeof key !== "string") {
      socket.destroy();
      return;
    }
    const accept = createHash("sha1")
      .update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
      .digest("base64");
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: " +
        accept +
        "\r\n\r\n",
    );
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    socket.on("error", () => sockets.delete(socket));

    let buffer: Buffer = Buffer.alloc(0);
    let pendingInput: ((value: string) => void) | undefined;
    const send = (envelope: unknown): void => {
      if (!socket.destroyed) socket.write(encodeFrame(JSON.stringify(envelope)));
    };
    const emit = (parentId: string, type: string, content: Record<string, unknown>): void => {
      send({
        header: { msg_id: nextId(), msg_type: type },
        parent_header: { msg_id: parentId },
        metadata: {},
        content,
        channel: "iopub",
      });
    };

    const handleMessage = async (text: string): Promise<void> => {
      let envelope: WireEnvelope;
      try {
        envelope = JSON.parse(text) as WireEnvelope;
      } catch {
        return;
      }
      const type = envelope.header?.msg_type;
      const id = envelope.header?.msg_id;
      if (typeof type !== "string" || typeof id !== "string") return;
      if (type === "input_reply") {
        const value = envelope.content?.["value"];
        const text2 = typeof value === "string" ? value : String(value ?? "");
        inputReplies.push(text2);
        pendingInput?.(text2);
        pendingInput = undefined;
        return;
      }
      if (type !== "execute_request") return;
      const code = typeof envelope.content?.["code"] === "string" ? (envelope.content["code"] as string) : "";
      requests.push(code);
      if (code.includes("HANG")) return;
      if (code.includes("CALL_TOOL_REVERSED")) {
        // stdin arrives before the iopub tool frame, exercising the cross-channel race.
        emit(id, "input_request", { prompt: "", password: false });
        emit(id, "stream", {
          name: "stdout",
          text:
            FRAME_PREFIX +
            JSON.stringify({ type: "tool_call", callId: "call-1", name: "echo", args: { text: "hi" } }) +
            "\n",
        });
        const value = await new Promise<string>((resolve) => {
          pendingInput = resolve;
        });
        let answer: string;
        try {
          const reply = JSON.parse(value) as { ok?: unknown; value?: unknown };
          answer = reply.ok === true ? String(reply.value) : "failed";
        } catch {
          answer = "failed";
        }
        emit(id, "stream", { name: "stdout", text: FRAME_PREFIX + JSON.stringify({ type: "final_answer", value: answer }) + "\n" });
        emit(id, "status", { execution_state: "idle" });
        return;
      }
      if (code.includes("CALL_TOOL")) {
        emit(
          id,
          "stream",
          {
            name: "stdout",
            text:
              FRAME_PREFIX +
              JSON.stringify({ type: "tool_call", callId: "call-1", name: "echo", args: { text: "hi" } }) +
              "\n",
          },
        );
        emit(id, "input_request", { prompt: "", password: false });
        const value = await new Promise<string>((resolve) => {
          pendingInput = resolve;
        });
        let answer: string;
        try {
          const reply = JSON.parse(value) as { ok?: unknown; value?: unknown };
          answer = reply.ok === true ? String(reply.value) : "failed";
        } catch {
          answer = "failed";
        }
        emit(id, "stream", { name: "stdout", text: FRAME_PREFIX + JSON.stringify({ type: "final_answer", value: answer }) + "\n" });
        emit(id, "status", { execution_state: "idle" });
        return;
      }
      emit(id, "stream", { name: "stdout", text: "hello\n" });
      emit(id, "execute_result", { data: { "text/plain": "42" }, execution_count: 1, metadata: {} });
      emit(id, "status", { execution_state: "idle" });
    };

    socket.on("data", (chunk: Buffer) => {
      buffer = Buffer.concat([buffer, chunk]);
      const decoded = decodeFrames(buffer);
      buffer = decoded.rest;
      for (const message of decoded.messages) void handleMessage(message);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as AddressInfo;
  return {
    url: "http://127.0.0.1:" + String(address.port),
    host: "127.0.0.1",
    port: address.port,
    kernelId,
    token,
    requests,
    inputReplies,
    get rejectedTokens() {
      return rejectedTokens;
    },
    close(): Promise<void> {
      for (const socket of sockets) socket.destroy();
      return new Promise<void>((resolve, reject) => {
        server.close((error) => (error === undefined ? resolve() : reject(error)));
      });
    },
  };
}
