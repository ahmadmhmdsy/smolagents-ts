import { describe, expect, it } from "vitest";
import { AgentExecutionError } from "@smolagents-ts/core";

import type { PyodideRuntime } from "../src/loader.js";
import { PyodideSession } from "../src/runtime.js";

/** A loader that counts its calls and records what the session installed on each runtime. */
function harness() {
  const installs: string[] = [];
  const indexURLs: (string | undefined)[] = [];
  const runtimes: PyodideRuntime[] = [];
  let loads = 0;
  const loader = async (options?: { readonly indexURL?: string }): Promise<PyodideRuntime> => {
    loads += 1;
    indexURLs.push(options?.indexURL);
    const globals = new Map<string, unknown>();
    const runtime: PyodideRuntime = {
      version: "314.0.7-fake",
      globals: {
        get: (name) => globals.get(name),
        set: (name, value) => {
          globals.set(name, value);
        },
        has: (name) => globals.has(name),
        delete: (name) => {
          globals.delete(name);
        },
      },
      runPython: () => undefined,
      runPythonAsync: async () => undefined,
      setStdout: () => {
        installs.push("stdout");
      },
      setStderr: () => {
        installs.push("stderr");
      },
    };
    runtimes.push(runtime);
    return runtime;
  };
  return {
    loader,
    loads: () => loads,
    installs,
    indexURLs,
    runtimes,
  };
}

function sessionFor(h: ReturnType<typeof harness>, indexURL?: string): PyodideSession {
  return new PyodideSession({
    loader: h.loader,
    indexURL,
    onStdout: () => undefined,
    onStderr: () => undefined,
  });
}

describe("PyodideSession", () => {
  it("loads one runtime across three get() calls and installs each handler once", async () => {
    const h = harness();
    const session = sessionFor(h);
    const first = await session.get();
    const second = await session.get();
    const third = await session.get();
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(h.loads()).toBe(1);
    expect(h.installs).toEqual(["stdout", "stderr"]);
    expect(h.runtimes).toHaveLength(1);
  });

  it("hands the loader the indexURL, and nothing when none is set", async () => {
    const withBase = harness();
    await sessionFor(withBase, "https://cdn.example/pyodide/full/").get();
    expect(withBase.indexURLs).toEqual(["https://cdn.example/pyodide/full/"]);

    const withoutBase = harness();
    await sessionFor(withoutBase).get();
    expect(withoutBase.indexURLs).toEqual([undefined]);
  });

  it("invalidate() drops the runtime so the next get() loads another", async () => {
    const h = harness();
    const session = sessionFor(h);
    const first = await session.get();
    session.invalidate();
    const second = await session.get();
    expect(h.loads()).toBe(2);
    expect(second).not.toBe(first);
  });

  it("dispose() is idempotent and a get() after it rejects with a typed error", async () => {
    const h = harness();
    const session = sessionFor(h);
    await session.get();
    await session.dispose();
    await expect(session.dispose()).resolves.toBeUndefined();
    await expect(session.get()).rejects.toBeInstanceOf(AgentExecutionError);
  });

  it("does not load a runtime just because it was constructed", () => {
    const h = harness();
    sessionFor(h);
    expect(h.loads()).toBe(0);
  });
});
