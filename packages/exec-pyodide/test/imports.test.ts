import { beforeAll, describe, expect, it } from "vitest";

import { buildGuestSource } from "../src/guest-source.js";
import {
  DEFAULT_AUTHORIZED_IMPORTS,
  checkImportAuthorized,
  installImportGuard,
} from "../src/imports.js";
import { defaultPyodideLoader, type PyodideRuntime } from "../src/loader.js";

describe("checkImportAuthorized", () => {
  it("authorizes an exact name and refuses an unrelated one", () => {
    expect(checkImportAuthorized("math", DEFAULT_AUTHORIZED_IMPORTS)).toBe(true);
    expect(checkImportAuthorized("os", DEFAULT_AUTHORIZED_IMPORTS)).toBe(false);
  });

  it("does not authorize a name merely because an authorized word prefixes it", () => {
    expect(checkImportAuthorized("itertools2", ["itertools"])).toBe(false);
    expect(checkImportAuthorized("os", ["os"])).toBe(true);
  });

  it("refuses a submodule of a plain authorized module", () => {
    expect(checkImportAuthorized("os.path", ["os"])).toBe(false);
  });

  it("authorizes a package and everything under a wildcard", () => {
    expect(checkImportAuthorized("numpy", ["numpy.*"])).toBe(true);
    expect(checkImportAuthorized("numpy.linalg", ["numpy.*"])).toBe(true);
    expect(checkImportAuthorized("numpyxx", ["numpy.*"])).toBe(false);
  });
});

describe("installImportGuard against the real runtime", () => {
  let runtime: PyodideRuntime;

  beforeAll(async () => {
    runtime = await defaultPyodideLoader();
    // The bootstrap the executor runs before the guard replaces __import__.
    runtime.runPython(buildGuestSource({ toolNames: [] }));
    installImportGuard(runtime, DEFAULT_AUTHORIZED_IMPORTS);
  }, 120_000);

  it("imports and calls every module upstream allows", async () => {
    for (const name of DEFAULT_AUTHORIZED_IMPORTS) {
      await runtime.runPythonAsync("import " + name);
    }
    const mean = await runtime.runPythonAsync("import statistics\nstatistics.mean([1, 2, 3])");
    expect(Number(mean)).toBe(2);
    const counted = await runtime.runPythonAsync(
      "from collections import Counter\nCounter('aab')['a']",
    );
    expect(Number(counted)).toBe(2);
    const now = await runtime.runPythonAsync("import datetime\ndatetime.datetime.now().year");
    expect(Number(now)).toBeGreaterThan(2000);
  });

  it("refuses a disallowed module with upstream's wording", async () => {
    const error = (await runtime.runPythonAsync("import os").catch((caught: unknown) => caught)) as {
      type?: string;
      message?: string;
    };
    expect(error.type).toBe("ImportError");
    expect(String(error.message)).toContain(
      "Import of os is not allowed. Authorized imports are:",
    );
  });

  it("refuses a disallowed submodule, a from-import and a relative import", async () => {
    const submodule = (await runtime.runPythonAsync("import os.path").catch((e) => e)) as Error;
    expect(String(submodule.message)).toContain("os.path is not allowed");
    const fromImport = (await runtime.runPythonAsync("from socket import socket").catch((e) => e)) as Error;
    expect(String(fromImport.message)).toContain("socket is not allowed");
    const relative = (await runtime.runPythonAsync("from . import thing").catch((e) => e)) as Error;
    expect(String(relative.message)).toContain("not allowed");
  });

  it("records the restore of builtins.__import__ as the known bypass", async () => {
    await runtime.runPythonAsync("_builtins.__import__ = __original_import__");
    const cwd = await runtime.runPythonAsync("import os\nos.getcwd()");
    expect(typeof cwd).toBe("string");
    // Put the guard back so it stays the state later assertions meet.
    installImportGuard(runtime, DEFAULT_AUTHORIZED_IMPORTS);
    const refused = (await runtime.runPythonAsync("import os").catch((e) => e)) as Error;
    expect(String(refused.message)).toContain("Import of os is not allowed");
  });
});
