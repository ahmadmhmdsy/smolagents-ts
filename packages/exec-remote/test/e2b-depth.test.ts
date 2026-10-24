import { describe, expect, it } from "vitest";
import {
  E2BSandbox,
  type E2BClient,
  type E2BRunOptions,
  type E2BSandboxLike,
} from "../src/backends/e2b.js";
import { ProcessSandbox } from "../src/backends/process.js";
import { UnsupportedOptionError } from "../src/errors.js";

/** What one fake sandbox remembers about the calls it received. */
interface Recorded {
  readonly create: { metadata?: Record<string, string>; timeoutMs: number }[];
  readonly runs: { timeoutMs: number | undefined; contextId: string | undefined }[];
  readonly refreshes: number[];
}

function fakeClient(
  options: { readonly keepAlive?: boolean; readonly metrics?: unknown } = {},
): { client: E2BClient; recorded: Recorded } {
  const recorded: Recorded = { create: [], runs: [], refreshes: [] };
  const sandbox: E2BSandboxLike = {
    sandboxId: "sbx-1",
    async runCode(code, runOptions?: E2BRunOptions) {
      // The prelude install is not a step; only steps are interesting to these assertions.
      if (code !== "PRELUDE") {
        recorded.runs.push({ timeoutMs: runOptions?.timeoutMs, contextId: runOptions?.contextId });
      }
      runOptions?.onStdout?.('{"__smolagents":"final_answer","value":"ok"}');
      return {};
    },
    async kill() {
      // Nothing to release in a double.
    },
  };
  if (options.keepAlive === true) {
    sandbox.setTimeout = async (timeoutMs: number) => {
      recorded.refreshes.push(timeoutMs);
    };
  }
  if (options.metrics !== undefined) {
    sandbox.getMetrics = async () => options.metrics;
  }
  const client: E2BClient = {
    async create(createOptions) {
      recorded.create.push({
        ...(createOptions.metadata === undefined ? {} : { metadata: { ...createOptions.metadata } }),
        timeoutMs: createOptions.timeoutMs,
      });
      return sandbox;
    },
  };
  return { client, recorded };
}

function signal(): AbortSignal {
  return new AbortController().signal;
}

describe("the E2B backend in depth", () => {
  it("carries metadata and the lifetime at create, and keeps sandboxId readable", async () => {
    const { client, recorded } = fakeClient();
    const sandbox = new E2BSandbox({
      client,
      nodeVersion: "24.0.0",
      timeoutMs: 240_000,
      metadata: { run: "r-1" },
    });
    await sandbox.start({ shimSource: "PRELUDE" });
    expect(recorded.create).toEqual([{ metadata: { run: "r-1" }, timeoutMs: 240_000 }]);
    expect(sandbox.sandboxId).toBe("sbx-1");
    await sandbox.dispose();
  });

  it("uses the execution deadline for a step that names none, never the sandbox lifetime", async () => {
    const { client, recorded } = fakeClient();
    const sandbox = new E2BSandbox({
      client,
      nodeVersion: "24.0.0",
      timeoutMs: 240_000,
      executionTimeoutMs: 7_000,
    });
    await sandbox.start({ shimSource: "PRELUDE" });
    await sandbox.run({ code: "1 + 1", timeoutMs: 0, signal: signal() });
    await sandbox.run({ code: "1 + 1", timeoutMs: 1_500, signal: signal() });
    expect(recorded.create[0]?.timeoutMs).toBe(240_000);
    expect(recorded.runs.map((run) => run.timeoutMs)).toEqual([7_000, 1_500]);
    await sandbox.dispose();
  });

  it("defaults the execution deadline to sixty seconds", async () => {
    const { client, recorded } = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0" });
    await sandbox.start({ shimSource: "PRELUDE" });
    await sandbox.run({ code: "1 + 1", timeoutMs: 0, signal: signal() });
    expect(recorded.runs[0]?.timeoutMs).toBe(60_000);
    await sandbox.dispose();
  });

  it("refreshes the lifetime before a step that outlived keepAliveMs", async () => {
    const { client, recorded } = fakeClient({ keepAlive: true });
    const sandbox = new E2BSandbox({
      client,
      nodeVersion: "24.0.0",
      timeoutMs: 240_000,
      keepAliveMs: 1,
    });
    await sandbox.start({ shimSource: "PRELUDE" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await sandbox.run({ code: "1 + 1", timeoutMs: 1_000, signal: signal() });
    expect(recorded.refreshes).toEqual([240_000]);
    await sandbox.dispose();
  });

  it("refuses keepAliveMs at start when the sandbox seam lacks setTimeout", async () => {
    const { client, recorded } = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0", keepAliveMs: 1_000 });
    const failure = await sandbox.start({ shimSource: "PRELUDE" }).then(
      () => undefined,
      (error: unknown) => error,
    );
    expect(failure).toBeInstanceOf(UnsupportedOptionError);
    expect((failure as Error).message).toContain("keepAliveMs");
    expect(recorded.create).toHaveLength(1);
    await sandbox.dispose();
  });

  it("forwards the step's contextId, falling back to the declared one", async () => {
    const { client, recorded } = fakeClient();
    const sandbox = new E2BSandbox({ client, nodeVersion: "24.0.0", contextId: "declared" });
    await sandbox.start({ shimSource: "PRELUDE" });
    await sandbox.run({ code: "1", timeoutMs: 1_000, contextId: "step", signal: signal() });
    await sandbox.run({ code: "2", timeoutMs: 1_000, signal: signal() });
    expect(recorded.runs.map((run) => run.contextId)).toEqual(["step", "declared"]);
    await sandbox.dispose();
  });

  it("reports guest metrics when the seam has them and undefined when it does not", async () => {
    const withMetrics = fakeClient({ metrics: { cpu: 0.5 } });
    const measured = new E2BSandbox({ client: withMetrics.client, nodeVersion: "24.0.0" });
    await measured.start({ shimSource: "PRELUDE" });
    await expect(measured.guestMetrics()).resolves.toEqual({ cpu: 0.5 });
    await measured.dispose();

    const withoutMetrics = fakeClient();
    const bare = new E2BSandbox({ client: withoutMetrics.client, nodeVersion: "24.0.0" });
    await bare.start({ shimSource: "PRELUDE" });
    await expect(bare.guestMetrics()).resolves.toBeUndefined();
    await bare.dispose();
  });

  it("refuses a contextId on a backend that has one namespace", async () => {
    const sandbox = new ProcessSandbox();
    await sandbox.start({ shimSource: "pass" });
    await expect(
      sandbox.run({ code: "1 + 1", timeoutMs: 1_000, contextId: "ctx", signal: signal() }),
    ).rejects.toBeInstanceOf(UnsupportedOptionError);
    await sandbox.dispose();
  });
});
