import { describe, expect, it } from "vitest";
import { GatewayModelListError, listGatewayModels, type GatewayFetch } from "../src/index.js";

function answering(status: number, body: unknown, seen: string[] = []): GatewayFetch {
  return (url, init) => {
    seen.push(url, new Headers(init.headers).get("authorization") ?? "");
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  };
}

describe("listGatewayModels", () => {
  it("returns the ids of an OpenAI model list in the gateway's order", async () => {
    const seen: string[] = [];
    const ids = await listGatewayModels({
      baseUrl: "http://localhost:20128/v1/",
      apiKey: "sk-test",
      fetch: answering(200, { object: "list", data: [{ id: "auto" }, { id: "groq/llama" }, { id: "" }, { name: "x" }] }, seen),
    });

    expect(ids).toEqual(["auto", "groq/llama"]);
    expect(seen).toEqual(["http://localhost:20128/v1/models", "Bearer sk-test"]);
  });

  it("names the status of a refused list and never the key", async () => {
    const failure = await listGatewayModels({
      baseUrl: "http://gw/v1",
      apiKey: "sk-secret",
      fetch: answering(401, { error: "bad key" }),
    }).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(GatewayModelListError);
    expect((failure as GatewayModelListError).status).toBe(401);
    expect((failure as Error).message).not.toContain("sk-secret");
  });

  it("refuses a body that is not a model list", async () => {
    await expect(
      listGatewayModels({ baseUrl: "http://gw/v1", fetch: answering(200, { models: [] }) }),
    ).rejects.toThrow(/no data array/);
  });
});
