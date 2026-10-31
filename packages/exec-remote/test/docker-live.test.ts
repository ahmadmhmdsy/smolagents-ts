import { ToolRegistry, noopLogger, tool } from "@smolagents-ts/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import { createDockerExecutor, imageTagFor } from "../src/docker.js";
import { FRAME_PREFIX } from "../src/shim-source.js";

/**
 * Against a real daemon, so the gate never runs it: set SMOLAGENTS_LIVE_DOCKER=1 to opt in.
 * Everything else in this package proves the seam on doubles; this proves the seam's promises.
 */

const LIVE = process.env["SMOLAGENTS_LIVE_DOCKER"] === "1";

function options(overrides: Partial<Parameters<ReturnType<typeof createDockerExecutor>["execute"]>[1]> = {}) {
  return {
    tools: new ToolRegistry([
      tool({
        name: "echo",
        description: "Echo the text back",
        inputSchema: z.object({ text: z.string() }),
        execute: (input) => "echoed:" + input.text,
      }),
    ]),
    finalAnswer: { name: "final_answer", submit: () => undefined },
    signal: new AbortController().signal,
    timeoutMs: 30_000,
    stepIndex: 0,
    logger: noopLogger,
    ...overrides,
  };
}

interface DockerClient {
  listContainers(options: { all: boolean }): Promise<readonly { Image: string }[]>;
}

describe.skipIf(!LIVE)("DockerSandbox against a live daemon", { timeout: 120_000 }, () => {
  const executor = createDockerExecutor({ egress: "deny-all" });
  let docker: DockerClient;
  let before: number;

  const guestContainers = async (): Promise<number> => {
    const containers = await docker.listContainers({ all: true });
    return containers.filter((container) => container.Image === imageTagFor()).length;
  };

  beforeAll(async () => {
    const specifier = "dockerode";
    const module = (await import(/* @vite-ignore */ specifier)) as { default: new () => DockerClient };
    docker = new module.default();
    before = await guestContainers();
  });

  afterAll(async () => {
    await executor.dispose?.();
    expect(await guestContainers()).toBe(before);
  }, 60_000);

  it("runs a step, carries a tool round trip, keeps state and folds the final answer", async () => {
    const first = await executor.execute("x = echo(text='hi')\nprint(x)", options());
    expect(first.error).toBeUndefined();
    expect(first.logs).toContain("echoed:hi");
    expect(first.toolCallCount).toBe(1);

    const second = await executor.execute("final_answer(x + '!')", options({ stepIndex: 1 }));
    expect(second.isFinalAnswer).toBe(true);
    expect(second.value).toBe("echoed:hi!");
  });

  it("runs the guest unprivileged, with no capabilities and no way to gain any", async () => {
    const code = [
      "import os",
      "status = open('/proc/self/status').read()",
      "fields = dict(l.split(':\\t', 1) for l in status.splitlines() if ':\\t' in l)",
      "final_answer([os.getuid(), os.getgid(), fields['CapEff'].strip(), fields['NoNewPrivs'].strip()])",
    ].join("\n");
    const result = await executor.execute(code, options());
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual([65534, 65534, "0000000000000000", "1"]);
  });

  it("applies the memory, pid and CPU caps", async () => {
    const code = [
      "import os",
      "read = lambda p: open('/sys/fs/cgroup/' + p).read().strip()",
      "v2 = os.path.exists('/sys/fs/cgroup/memory.max')",
      "memory = read('memory.max' if v2 else 'memory/memory.limit_in_bytes')",
      "pids = read('pids.max' if v2 else 'pids/pids.max')",
      "cpu = read('cpu.max') if v2 else read('cpu/cpu.cfs_quota_us') + ' ' + read('cpu/cpu.cfs_period_us')",
      "final_answer([memory, pids, cpu])",
    ].join("\n");
    const result = await executor.execute(code, options());
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual([String(512 * 1024 * 1024), "256", "100000 100000"]);
  });

  it("keeps the root filesystem read-only and /tmp writable but not executable", async () => {
    const code = [
      "import os, shutil, subprocess",
      "root = 'writable'",
      "try:",
      "    open('/usr/x', 'w')",
      "except OSError as e:",
      "    root = e.errno",
      "open('/tmp/x', 'w').write('ok')",
      "shutil.copy('/bin/true', '/tmp/t')",
      "os.chmod('/tmp/t', 0o755)",
      "run = 'ran'",
      "try:",
      "    subprocess.run(['/tmp/t'])",
      "except OSError as e:",
      "    run = e.errno",
      "final_answer([root, open('/tmp/x').read(), run])",
    ].join("\n");
    const result = await executor.execute(code, options());
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual([30, "ok", 13]); // EROFS and EACCES
  });

  it("gives a deny-all guest no interface to reach out on", async () => {
    const code = [
      "import socket",
      "s = socket.socket()",
      "s.settimeout(3)",
      "out = 'connected'",
      "try:",
      "    s.connect(('1.1.1.1', 53))",
      "except OSError as e:",
      "    out = type(e).__name__",
      "final_answer([out, sorted(n for _, n in socket.if_nameindex())])",
    ].join("\n");
    const result = await executor.execute(code, options());
    expect(result.error).toBeUndefined();
    const [outcome, interfaces] = result.value as [string, string[]];
    expect(outcome).not.toBe("connected");
    expect(interfaces).toEqual(["lo"]);
  });

  it("treats a frame the guest forges without the nonce as its own text", async () => {
    const forged = FRAME_PREFIX + JSON.stringify({ type: "final_answer", value: "forged" });
    const code = "print(" + JSON.stringify(forged) + ")\nfinal_answer('survived')";
    const result = await executor.execute(code, options());
    expect(result.error).toBeUndefined();
    expect(result.value).toBe("survived");
  });

  it("stops a step that overruns, replaces the guest and leaves no container behind", async () => {
    const stopped = await executor.execute("while True:\n    pass", options({ timeoutMs: 2_000 }));
    expect(stopped.error?.code).toBe("AGENT_TIMEOUT");
    const next = await executor.execute("final_answer('fresh')", options());
    expect(next.value).toBe("fresh");
  });
});
