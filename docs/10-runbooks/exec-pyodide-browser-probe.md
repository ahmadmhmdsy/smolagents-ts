# 10 — Runbook: the exec-pyodide browser cold-start probe

**Contract**
- **Role:** the procedure that measures the Pyodide runtime's browser bundle and cold
  start, which the in-process test suite cannot measure.
- **Mutability:** rewrite in place when the CDN base, the Pyodide version, or the
  package's public surface changes.
- **Read when:** after a change to the loader, the executor or the capability
  object, or before a release that ships a browser bundle.
- **Update when:** a step fails in a way it did not anticipate, or the headline
  numbers move.

**Why this file exists:** every test in `packages/exec-pyodide` loads the runtime
from the workspace with no network, so nothing in the gate measures what a page
pays. This is the one procedure that downloads the runtime from a CDN, builds a
page and drives a real browser. It is not a gate stage: the gate must stay
offline.

---

## Preconditions

- Node.js 22.12 or newer and pnpm 12.3.4 on `PATH`.
- Dependencies installed: `pnpm install --frozen-lockfile`.
- The package built: the scratch page imports `dist`, so run step 1 first.
- Network access to `cdn.jsdelivr.net` for the runtime assets.
- A Chromium-based browser. This runbook was verified with Google Chrome 155.
- Nothing else is running that would rebuild the package underneath the probe.
- **Do not** stop every `chrome.exe` on the machine: the rollback matches only
  the profile this runbook creates.

## Steps

Run every step from a PowerShell prompt. Step 2 puts the scratch project outside
the repository, under the temp directory, so the probe leaves no tracked file.

1. Build the package, from the repository root:

       pnpm --filter @smolagents-ts/exec-pyodide run build

2. Create the scratch project. Set the two paths first, then write the files:

       $root  = (Resolve-Path .).Path
       $probe = Join-Path $env:TEMP "exec-pyodide-browser-probe"
       Remove-Item $probe -Recurse -Force -ErrorAction SilentlyContinue
       New-Item -ItemType Directory -Force $probe | Out-Null

   `$probe\index.html`:

       <!doctype html>
       <html lang="en">
         <head><meta charset="utf-8" /><title>exec-pyodide probe</title></head>
         <body>
           <pre id="out">loading</pre>
           <script type="module" src="./main.ts"></script>
         </body>
       </html>

   `$probe\main.ts` — the CDN loader, the run, and a beacon so an operator can
   read the result without a DevTools session:

       import { PyodideExecutor } from "@smolagents-ts/exec-pyodide";
       import { ToolRegistry, noopLogger } from "@smolagents-ts/core";

       const CDN = "https://cdn.jsdelivr.net/pyodide/v314.0.7/full/";

       async function cdnLoader(options?: { indexURL?: string }) {
         const indexURL = options?.indexURL ?? CDN;
         const runtime = await import(/* @vite-ignore */ indexURL + "pyodide.mjs");
         return runtime.loadPyodide({ indexURL: indexURL });
       }

       function resources() {
         return performance
           .getEntriesByType("resource")
           .filter((entry) => entry.name.includes("jsdelivr"))
           .map((entry) => {
             const e = entry as PerformanceResourceTiming;
             return {
               name: e.name.split("/").pop(),
               transferSize: e.transferSize,
               decodedBodySize: e.decodedBodySize,
               durationMs: Math.round(e.duration),
             };
           });
       }

       function report(state: Record<string, unknown>) {
         (window as unknown as Record<string, unknown>).__probe = state;
         const out = document.getElementById("out");
         if (out !== null) out.textContent = JSON.stringify(state);
         void fetch("/done", { method: "POST", body: JSON.stringify(state) });
       }

       async function main() {
         const started = performance.now();
         const executor = new PyodideExecutor({ loader: cdnLoader as never, indexURL: CDN });
         try {
           const result = await executor.execute('print("hello from the guest")', {
             tools: new ToolRegistry([]),
             finalAnswer: { name: "final_answer", submit: () => undefined },
             signal: new AbortController().signal,
             timeoutMs: 60000,
             stepIndex: 0,
             logger: noopLogger,
           });
           report({
             status: "ok",
             coldStartMs: Math.round(performance.now() - started),
             logs: result.logs,
             error: result.error ?? null,
             resources: resources(),
             userAgent: navigator.userAgent,
           });
         } catch (error) {
           report({
             status: "error",
             coldStartMs: Math.round(performance.now() - started),
             error: String(error),
             resources: resources(),
             userAgent: navigator.userAgent,
           });
         }
       }

       void main();

   `$probe\vite.config.mjs` — `optimizeDeps.exclude` keeps pyodide out of the dev
   prebundle, and `rollupOptions.external` keeps the runtime out of the build, so
   the page fetches it from the CDN base the loader is given:

       const repo = "E:/python_projects/smolagents_ts";

       export default {
         root: ".",
         optimizeDeps: { exclude: ["pyodide"] },
         resolve: {
           alias: {
             "@smolagents-ts/exec-pyodide": repo + "/packages/exec-pyodide/dist/index.js",
             "@smolagents-ts/core": repo + "/packages/core/dist/index.js",
             pyodide: repo + "/packages/exec-pyodide/node_modules/pyodide/pyodide.mjs",
             zod: repo + "/packages/core/node_modules/zod",
           },
         },
         build: {
           outDir: "dist",
           emptyOutDir: true,
           minify: false,
           sourcemap: false,
           rollupOptions: { external: ["pyodide"] },
         },
       };

   `$probe\serve.mjs` — a static server that also records the beacon:

       import { createReadStream, existsSync, statSync, writeFileSync } from "node:fs";
       import { createServer } from "node:http";
       import { extname, join, normalize } from "node:path";

       const [root, portArg, resultPath] = process.argv.slice(2);
       const port = Number(portArg ?? 4178);
       const TYPES = {
         ".html": "text/html; charset=utf-8",
         ".js": "text/javascript; charset=utf-8",
         ".json": "application/json",
         ".wasm": "application/wasm",
         ".zip": "application/zip",
       };

       createServer((req, res) => {
         if (req.url !== undefined && req.url.startsWith("/done")) {
           let body = "";
           req.on("data", (chunk) => { body += chunk; });
           req.on("end", () => {
             writeFileSync(resultPath, body);
             res.writeHead(204);
             res.end();
             setTimeout(() => process.exit(0), 250);
           });
           return;
         }
         const pathname = decodeURIComponent(new URL(req.url ?? "/", "http://127.0.0.1").pathname);
         const target = pathname === "/" ? join(root, "index.html") : join(root, normalize(pathname));
         if (!existsSync(target) || statSync(target).isDirectory()) {
           res.writeHead(404);
           res.end("not found");
           return;
         }
         res.writeHead(200, { "content-type": TYPES[extname(target)] ?? "application/octet-stream" });
         createReadStream(target).pipe(res);
       }).listen(port, "127.0.0.1");

3. Build the page, and record the bundle it emitted:

       Push-Location $probe
       node "$root/node_modules/vite/bin/vite.js" build --config vite.config.mjs
       Get-ChildItem dist -Recurse -File |
         ForEach-Object { "{0,10}  {1}" -f $_.Length, $_.Name }
       Pop-Location

4. Start the server, then a headless browser against it, then wait for the beacon.
   The browser is started with its own profile so nothing else on the machine is
   touched:

       $result = Join-Path $probe "result.json"
       Remove-Item -LiteralPath $result -ErrorAction SilentlyContinue
       $server = Start-Process -FilePath (Get-Command node).Source -PassThru -WindowStyle Hidden -ArgumentList @(
         (Join-Path $probe "serve.mjs"),
         (Join-Path $probe "dist"),
         "4178",
         $result,
       )
       Start-Sleep -Seconds 2

       $profile = Join-Path $probe "chrome-profile"
       $chrome  = Start-Process -FilePath "C:/Program Files/Google/Chrome/Application/chrome.exe" -PassThru -WindowStyle Hidden -ArgumentList @(
         "--headless=new", "--disable-gpu", "--no-sandbox", "--disable-dev-shm-usage",
         "--no-first-run", "--no-default-browser-check", "--disable-extensions",
         "--user-data-dir=$profile", "http://127.0.0.1:4178/",
       )

       $deadline = (Get-Date).AddSeconds(140)
       while (-not (Test-Path $result) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
       Get-Content -LiteralPath $result -Raw

5. Stop only the browser this step started, matching its profile, and the server:

       Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe'" |
         Where-Object { $_.CommandLine -like "*exec-pyodide-browser-probe*chrome-profile*" } |
         ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
       Stop-Process -Id $server.Id -Force

## Verification

    # expect one line of JSON, then exit code 0
    # {"status":"ok","coldStartMs":<number>,"logs":"hello from the guest","error":null,
    #  "resources":[ ... five jsdelivr entries ... ],"userAgent":"...HeadlessChrome/..."}

The page reports `status: "ok"` only after `execute()` returns with
`logs === "hello from the guest"`. `coldStartMs` is the wall-clock span from
constructing the executor to the run's completion in the page, so it includes the
runtime download, the WASM compile and the first Python run. `resources` is the
browser's own accounting of what the CDN sent. A `status: "error"` result carries
the message and the resources harvested up to that point.

Last recorded run: 2026-10-14, on Windows with Node 24.18.0, Vite 6.4.4 and
HeadlessChrome 155.0.8059.40 against
`https://cdn.jsdelivr.net/pyodide/v314.0.7/full/`. The run reported
`status: "ok"`, `coldStartMs: 2912`, `logs: "hello from the guest"`, and five
CDN resources totalling 6,289,377 bytes over the wire (pyodide.mjs 7,599;
pyodide-lock.json 25,008; python_stdlib.zip 2,505,613; pyodide.asm.wasm
3,438,816; pyodide.asm.mjs 262,341) and 13,531,207 bytes decoded. The page built
to 29,375 bytes on disk (index.html 266; assets/index 29,109), 8.5 kB of it
gzipped.

## Rollback

1. The server exits on its own after the beacon lands; if it did not, stop the
   process whose command line names the scratch `serve.mjs`.
2. Stop the browser by its profile command line, exactly as step 5 does. Never
   stop `chrome.exe` by name: that ends the operator's own windows.
3. Delete the scratch directory: `Remove-Item $probe -Recurse -Force`. Nothing
   inside the repository changed, so there is nothing else to undo.

## Failure modes

| Symptom | Cause | Action |
|---|---|---|
| no `result.json` before the deadline | the page threw before its first report, or the browser never loaded the module | open `http://127.0.0.1:4178/` in a headed browser and read the console |
| `status: "error"` naming a module-resolution failure | the workspace path in `vite.config.mjs` is wrong, or the package was not built | fix `repo`, then re-run step 1 and step 3 |
| `status: "error"` naming a fetch or CORS failure | the CDN base is wrong for the pinned version, or the machine is offline | check the version against the package, and the base against the CDN's layout |
| the bundle contains pyodide's wasm | `rollupOptions.external` was dropped | restore it; the runtime belongs to the CDN, not the app bundle |
| Vite warns that a Node module is externalized for the browser | build A resolves pyodide, whose glue imports `node:*` for its Node path | expected when `external` is absent; the warnings disappear once pyodide is external |
| the build resolves no `pyodide` alias | the workspace's installed copy moved | point the alias at the path `packages/exec-pyodide/node_modules/pyodide` resolves to |
| the browser exits before the beacon | `--headless=new` is unsupported by that Chrome | upgrade Chrome, or use Edge with the same flags |
| a stray headless Chrome survives | the profile match in step 5 did not run | re-run step 5's first block |

## Notes

- The probe is deliberately outside the repository: the page is disposable, and
  the only durable output is the numbers in this runbook and in the plan's
  measured results.
- `optimizeDeps.exclude: ["pyodide"]` matters for a dev server, not for a build;
  the build is what the bundle figure comes from. Both are set so the same config
  serves either.
- `coldStartMs` is a single sample on one machine over one network. Treat it as
  an order of magnitude, not a budget.
