import { describe, expect, it } from "vitest";
import { MCPClient } from "../src/client.js";
import { MCPError } from "../src/errors.js";
import { mcpTools, withMCPClient } from "../src/tools.js";
import { FixtureTransport } from "./fixture-transport.js";
import { loadFixture, recordingLogger } from "./helpers.js";

const URL = "http://fixture.invalid/mcp";

describe("withMCPClient", () => {
  it("connects, hands the callback the tools, and disconnects", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const seen: string[] = [];
    const result = await withMCPClient(
      [{ url: URL }],
      (tools) => {
        seen.push(...tools.map((entry) => entry.name));
        return tools.length;
      },
      { transportFactory: () => transport },
    );

    expect(seen).toEqual(["echo", "add"]);
    expect(result).toBe(2);
    expect(transport.closed).toBe(true);
  });

  it("disconnects after the callback throws, and rethrows", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    await expect(
      withMCPClient(
        [{ url: URL }],
        () => {
          throw new Error("the callback failed");
        },
        { transportFactory: () => transport },
      ),
    ).rejects.toThrow("the callback failed");
    expect(transport.closed).toBe(true);
  });

  it("awaits an async callback before disconnecting", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const result = await withMCPClient(
      [{ url: URL }],
      async (tools) => {
        await Promise.resolve();
        return tools.map((entry) => entry.name).join(",");
      },
      { transportFactory: () => transport },
    );
    expect(result).toBe("echo,add");
    expect(transport.closed).toBe(true);
  });
});

describe("mcpTools", () => {
  it("refuses without the trust acknowledgement, in upstream's wording", async () => {
    await expect(mcpTools([{ url: URL }])).rejects.toThrow(MCPError);
    await expect(mcpTools([{ url: URL }])).rejects.toThrow(
      /acknowledge you trust the MCP server.*execute code on your local machine.*trustRemoteCode: true/s,
    );
  });

  it("connects, returns the tools and disconnects when trusted", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const tools = await mcpTools([{ url: URL }], {
      trustRemoteCode: true,
      transportFactory: () => transport,
    });
    expect(tools.map((entry) => entry.name)).toEqual(["echo", "add"]);
    expect(transport.closed).toBe(true);
  });

  it("threads the logger and structuredOutput through to the client", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const logger = recordingLogger();
    const tools = await mcpTools([{ url: URL }], {
      trustRemoteCode: true,
      structuredOutput: false,
      logger,
      transportFactory: () => transport,
    });
    expect(tools).toHaveLength(2);
    // Explicitly set, so upstream's notice must not appear.
    expect(logger.messages.some((message) => message.includes("structuredOutput"))).toBe(false);
  });
});

describe("the manual lifecycle", () => {
  it("connects during construction, as upstream does", async () => {
    const transport = new FixtureTransport(loadFixture("client-flow"));
    const client = await MCPClient.create([{ url: URL }], { transportFactory: () => transport });
    expect(transport.closed).toBe(false);
    expect((await client.getTools()).map((entry) => entry.name)).toEqual(["echo", "add"]);
    client.disconnect();
    expect(transport.closed).toBe(true);
  });
});
