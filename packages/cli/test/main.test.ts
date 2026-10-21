import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { main } from "../src/main.js";
import type { RunSmolagentOptions } from "../src/run.js";
import { createTerminalPrompter } from "../src/terminal.js";

/**
 * The bin's own wiring, which nothing else covers.
 *
 * `runSmolagent` takes the environment as an option and defaults it to an empty map, so its
 * tests never read the host's environment — and that default is what let the bin ship without
 * ever passing the process's own. Measured on 2026-10-14: a probe server on the `--api-base`
 * saw no `authorization` header from `dist/main.js` with `OPENAI_API_KEY` in its environment,
 * and `Bearer probe-key-value` from the same options handed to `runSmolagent` directly. The
 * USAGE text and the component entry both promise that read, so it is pinned here rather than
 * left to the next reader of two files to notice.
 */
describe("main", () => {
  it("hands the parsed flags and the environment it was given to the run", async () => {
    let captured: RunSmolagentOptions | undefined;

    const code = await main(
      [
        "--model-type",
        "OpenAIModel",
        "--api-base",
        "https://example.test/v1",
        "--model-id",
        "probe-model",
        "--tools",
        "--",
        "Say hi",
      ],
      {
        env: { OPENAI_API_KEY: "probe-key-value" },
        run: (options) => {
          captured = options;
          return Promise.resolve(0);
        },
      },
    );

    expect(code).toBe(0);
    expect(captured?.env).toEqual({ OPENAI_API_KEY: "probe-key-value" });
    expect(captured?.prompt).toBe("Say hi");
    expect(captured?.modelType).toBe("OpenAIModel");
    expect(captured?.apiBase).toBe("https://example.test/v1");
    expect(captured?.modelId).toBe("probe-model");
    expect(captured?.tools).toEqual([]);
  });

  it("reads the process's own environment when it is given none", async () => {
    let captured: RunSmolagentOptions | undefined;
    process.env.CLI_ENV_PROBE = "from-the-process";
    try {
      const code = await main(["go"], {
        run: (options) => {
          captured = options;
          return Promise.resolve(0);
        },
      });
      expect(code).toBe(0);
      // Asserted before the variable is removed: the map the run receives is the live
      // `process.env` object, so a later delete would empty it under the assertion.
      expect(captured?.env?.CLI_ENV_PROBE).toBe("from-the-process");
    } finally {
      delete process.env.CLI_ENV_PROBE;
    }
  });

  it("answers 2 for a command line the parser rejects", async () => {
    const code = await main(["--model-type"], { run: () => Promise.resolve(0) });
    expect(code).toBe(2);
  });

  it("answers 130 without running when stdin ends during interactive setup", async () => {
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    let ran = false;
    try {
      const input = new PassThrough();
      input.end();
      const code = await main([], {
        createPrompter: () => createTerminalPrompter({ input, output: new PassThrough() }),
        run: () => {
          ran = true;
          return Promise.resolve(0);
        },
      });
      expect(code).toBe(130);
      expect(ran).toBe(false);
      expect(stderr.mock.calls.map((call) => String(call[0])).join("")).toContain(
        "Interactive setup cancelled.",
      );
    } finally {
      stdout.mockRestore();
      stderr.mockRestore();
    }
  });
});
