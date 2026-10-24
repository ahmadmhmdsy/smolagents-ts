import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import * as dockerEntry from "../src/docker.js";
import * as e2bEntry from "../src/e2b.js";
import * as root from "../src/index.js";
import * as processEntry from "../src/process.js";

/**
 * The runtime surface of each entry, pinned by sorted name. Types are erased by the runner, so
 * only the values a consumer can call are listed here; the compiler checks the rest.
 */
function values(namespace: object): string[] {
  return Object.keys(namespace).sort();
}

describe("the pinned public surface", () => {
  it("the root entry carries the neutral executor and the typed refusals", () => {
    expect(values(root)).toEqual([
      "EgressUnsupportedError",
      "MissingPeerDependencyError",
      "PickleRefusedError",
      "RemoteExecutor",
      "SandboxError",
      "SerializationError",
      "ToolRoundTripUnsupportedError",
      "UnsupportedNodeVersionError",
      "VERSION",
    ]);
  });

  it("the process entry carries the sandbox, the frame prefix and the factory", () => {
    expect(values(processEntry)).toEqual(["FRAME_PREFIX", "ProcessSandbox", "createProcessExecutor"]);
  });

  it("the docker entry carries the sandbox, its image helpers and the factory", () => {
    expect(values(dockerEntry)).toEqual([
      "DOCKERFILE",
      "DockerSandbox",
      "createDockerExecutor",
      "dockerfileTar",
      "imageTagFor",
    ]);
  });

  it("the e2b entry carries the sandbox, the Node floor and the factory", () => {
    expect(values(e2bEntry)).toEqual([
      "E2BSandbox",
      "E2B_NODE_FLOOR",
      "createE2BExecutor",
      "satisfiesNodeFloor",
    ]);
  });

  it("the manifest exposes exactly the four documented subpaths", () => {
    const manifest = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    ) as { exports?: Record<string, unknown>; dependencies?: Record<string, string> };
    expect(Object.keys(manifest.exports ?? {}).sort()).toEqual([".", "./docker", "./e2b", "./process"]);
    // The peers stay optional: a regular dependency would resolve them for every consumer.
    expect(Object.keys(manifest.dependencies ?? {}).sort()).toEqual(["@smolagents-ts/core", "zod"]);
  });
});
