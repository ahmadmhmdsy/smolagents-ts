# 10 — Runbook: the MCP client against a live server

**Contract**
- **Role:** the procedure that proves the MCP client still talks to a real server,
  outside the recorded fixture suite.
- **Mutability:** rewrite in place when the pinned server, its command, or the
  client's surface changes.
- **Read when:** after a change to the client, a transport or the tool adapter, or
  before a release.
- **Update when:** the server version moves, or a step fails in a way it did not
  anticipate.

**Why this file exists:** every test in the MCP package drives a recorded fixture
transport, so nothing in the gate opens a subprocess or reaches a socket. This is
the one procedure that does, and it is the only one in the package that needs a
network.

---

## Preconditions

- Node.js 22.12 or newer, and pnpm 12.3.4, both on `PATH`.
- Dependencies installed: `pnpm install --frozen-lockfile`.
- The package built: the script imports `dist`, so run step 1 first.
- Network access on the first run, to install the server package.
- Nothing else is running that would rebuild the package underneath the check.

## Steps

1. Build the package, from the repository root:

       pnpm --filter @smolagents-ts/mcp run build

2. Install the pinned server into a scratch directory, so the check spawns an
   executable that already exists:

       $dir = Join-Path $env:TEMP "mcp-live-check"
       New-Item -ItemType Directory -Force $dir | Out-Null
       Set-Content (Join-Path $dir "package.json") '{"name":"mcp-live-check","private":true,"type":"module"}'
       Push-Location $dir
       npm install @modelcontextprotocol/server-everything@1.0.0 --no-audit --no-fund
       Pop-Location

   Its entry is `node_modules/@modelcontextprotocol/server-everything/dist/index.js`.

3. Write the check beside the checkout, in the directory the repository ignores:

       # .superpowers/mcp-live-check.mjs
       import { MCPClient } from "../packages/mcp/dist/index.js";
       import { stdioClient } from "../packages/mcp/dist/transports/stdio.js";

       const entry = process.argv[2];

       try {
         await MCPClient.create({ command: process.execPath, args: [entry] });
         throw new Error("the root entry accepted a stdio parameter");
       } catch (error) {
         console.log("root entry refused a subprocess: " + error.name);
       }

       const client = await stdioClient({ command: process.execPath, args: [entry] });
       try {
         console.log("protocol " + client.protocolVersion);
         const tools = await client.getTools();
         console.log("tools (" + tools.length + "): " + tools.map((tool) => tool.name).join(", "));
         const echo = tools.find((tool) => tool.name === "echo");
         if (echo === undefined) throw new Error("the server exposed no echo tool");
         const result = await echo.execute(
           { message: "hello from the live check" },
           { signal: new AbortController().signal },
         );
         console.log("echo " + JSON.stringify(result));
       } finally {
         client.disconnect();
       }

   The first block is a check of its own: the root entry must refuse a subprocess,
   because it is the entry a browser bundle loads.

4. Run it, passing the entry from step 2:

       node .superpowers/mcp-live-check.mjs "$env:TEMP\mcp-live-check\node_modules\@modelcontextprotocol\server-everything\dist\index.js"

## Verification

    # expect, in order: the refusal line, a protocol line, a tool list carrying
    # echo, and the echoed text; then exit code 0
    echo $LASTEXITCODE

The refusal is `MCPParameterError`. The protocol line is the revision the server
negotiated, which is one of the revisions `SUPPORTED_PROTOCOL_VERSIONS` lists. The
tool list for the everything server carries `echo` among its tools, and the echo
call answers with the text that was sent.

Last recorded run: 2026-10-14, server-everything 1.0.0 on Node 22.12 through the
stdio subpath, which reported `connected in 410 ms, protocol 2025-11-25`, listed
13 tools, answered `Echo: hello from the live check`, and exited 0.

## Rollback

1. Stop the script. `disconnect()` closes the transport, and the transport ends
   the child process it started.
2. If a child survived the close, end it by its command line:

       Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
         Where-Object { $_.CommandLine -like '*server-everything*' } |
         ForEach-Object { Stop-Process -Id $_.ProcessId }

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| `spawn npx ENOENT` | Windows resolves no extensionless `npx` for a spawn | spawn `process.execPath` with the server's entry, as in step 2 |
| `spawn npx.cmd EINVAL` | Node refuses to spawn a `.cmd` without a shell | same: spawn the executable directly, never the shim |
| a spawn failure that ends the process with an unsettled top-level await | the transport's error did not settle the handshake | fixed 2026-10-14: a transport error or close rejects everything in flight on that connection, so the same command now fails in 8 ms with the spawn error |
| a package-not-found error from the install | the pinned server version is not on the registry | check the version, then move the pin in this runbook |
| a message naming a protocol version this client does not speak | the server moved to a revision outside `SUPPORTED_PROTOCOL_VERSIONS` | compare the two lists before widening the client's set |
| the tool list comes back empty | the server started but listed nothing | run the server by hand with the same arguments and read its stderr |
| `MCPToolError ... reported a failure` | the server rejected the call | the message carries the server's own text |
| the root entry accepted the parameter | the isomorphic boundary moved | the architecture test should have caught it; fix the entry, not the test |

## Notes

- The check drives the stdio subpath, because a subprocess is the transport the
  fixture suite cannot stand in for. The Streamable HTTP transport is covered by
  its own tests against an injected fetch.
- The everything server is a diagnostic server published by the MCP project: it
  exposes a tool per protocol feature rather than a useful service.
- Nothing here belongs in the gate. The gate opens no subprocess and reaches no
  network, which is why the fixture transport exists.
