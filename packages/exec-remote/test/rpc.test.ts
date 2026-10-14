import { describe, expect, it } from "vitest";
import { RpcAbortedError, RpcDisposedError, RpcPeer, RpcTimeoutError, replyTypeFor } from "../src/rpc.js";

function pair(): [RpcPeer, RpcPeer] {
  const peers: RpcPeer[] = [];
  const first = new RpcPeer({ send: (message) => queueMicrotask(() => peers[1]?.handle(message)) });
  const second = new RpcPeer({ send: (message) => queueMicrotask(() => peers[0]?.handle(message)) });
  peers.push(first, second);
  return [first, second];
}

describe("the request/response peer", () => {
  it("answers an inbound request and resolves the caller", async () => {
    const [caller, responder] = pair();
    responder.onRequest("ping", (message) => ({ type: "pong", content: { echo: message.content["n"] } }));
    const exchange = await caller.request("ping", { n: 1 }, { timeoutMs: 1_000 });
    expect(exchange.messages.map((message) => message.type)).toEqual(["pong"]);
    expect(exchange.messages[0]?.content["echo"]).toBe(1);
  });

  it("collects several replies when a done predicate names the terminal one", async () => {
    const [caller, responder] = pair();
    responder.onRequest("exec", (message) => {
      responder.send({ id: responder.nextId(), type: "stream", parentId: message.id, content: { text: "one" } });
      responder.send({ id: responder.nextId(), type: "stream", parentId: message.id, content: { text: "two" } });
      return { type: "status", content: { state: "idle" } };
    });
    const exchange = await caller.request("exec", {}, {
      timeoutMs: 1_000,
      done: (message) => message.type === "stream" && message.content["text"] === "two",
    });
    expect(exchange.messages.map((message) => message.content["text"])).toEqual(["one", "two"]);
  });

  it("rejects instead of throwing when the transport's send raises", async () => {
    const peer = new RpcPeer({
      send: () => {
        throw new Error("the transport is down");
      },
    });
    await expect(peer.request("ping", {}, { timeoutMs: 1_000 })).rejects.toThrow("the transport is down");
    expect(peer.pendingCount).toBe(0);
  });

  it("times out a request that is never answered", async () => {
    const [caller] = pair();
    await expect(caller.request("silent", {}, { timeoutMs: 20 })).rejects.toThrow(RpcTimeoutError);
  });

  it("aborts a request through its signal", async () => {
    const [caller] = pair();
    const controller = new AbortController();
    const pending = caller.request("silent", {}, { timeoutMs: 1_000, signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toThrow(RpcAbortedError);
  });

  it("rejects every pending request when disposed", async () => {
    const [caller] = pair();
    const pending = caller.request("silent", {}, { timeoutMs: 1_000 });
    caller.dispose();
    await expect(pending).rejects.toThrow(RpcDisposedError);
    expect(caller.pendingCount).toBe(0);
  });

  it("names the reply type for an inbound request", () => {
    expect(replyTypeFor("input_request")).toBe("input_reply");
    expect(replyTypeFor("other")).toBe("other_reply");
  });
});
