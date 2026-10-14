import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const FORBIDDEN_CORE_MODULES = [
  "fs", "path", "os", "child_process", "worker_threads", "net", "http", "https",
  "crypto", "stream", "util", "url", "zlib", "vm", "module", "process", "buffer",
  // Subpath specifiers are listed explicitly so coverage does not depend on how a
  // no-restricted-imports group entry matches a module name.
  "timers", "timers/promises",
  "events", "assert", "assert/strict",
  "dns", "dns/promises", "tls", "dgram", "cluster",
  "readline", "readline/promises", "repl", "string_decoder",
  "perf_hooks", "async_hooks", "inspector", "v8", "domain",
  "punycode", "querystring", "trace_events", "tty", "diagnostics_channel",
  "sea", "sqlite", "test", "constants", "sys",
];

const FORBIDDEN_CORE_GLOBALS = [
  { name: "process", message: "core must be isomorphic; pass configuration explicitly." },
  { name: "Buffer", message: "core must be isomorphic; use TextEncoder/TextDecoder." },
  { name: "require", message: "core is ESM-only." },
  { name: "module", message: "core is ESM-only." },
  { name: "__dirname", message: "core must be isomorphic." },
  { name: "__filename", message: "core must be isomorphic." },
  { name: "window", message: "core must be framework-agnostic." },
  { name: "document", message: "core must be framework-agnostic." },
  { name: "localStorage", message: "core must be framework-agnostic." },
  { name: "eval", message: "core must never evaluate code; the executor plugin does that." },
  { name: "Function", message: "the Function constructor is a code-evaluation escape hatch." },
];

export default defineConfig(
  // Throwaway probe trees live under .superpowers/ (the Task 3 tsconfig probe, reviewer scratch) and are
  // gitignored, so they must never be linted: measured, `eslint .` picks up .superpowers/**/*.ts and fails
  // on it, which would make Task 8's gate depend on scratch files that happen to be lying around.
  // The docs site's generated output is gitignored for the same reason, and it carries the example's
  // bundled JavaScript: measured, `eslint .` reports no-unused-expressions inside apps/docs-site/site/
  // once a site build has run, which would make a second `pnpm gate` fail on a tree the first one wrote.
  {
    ignores: [
      "**/dist/**",
      "**/coverage/**",
      "**/.superpowers/**",
      "smolagents/**",
      "reference/**",
      "**/*.d.ts",
      "apps/docs-site/site/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  // Upstream-derived code and the S1 code blocks use a leading underscore for deliberately unused bindings
  // (`_options`, `_ctx`, `_step`). Without this override ESLint reports them as errors, and because `gate`
  // chains `lint` before the tests, one such binding stops the whole gate: measured during S1, three of them
  // in Task 10's files and one each in the code blocks of Tasks 14 and 15.
  {
    files: ["**/*.{ts,tsx,mts,cts}"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        destructuredArrayIgnorePattern: "^_",
      }],
    },
  },
  {
    files: ["packages/core/src/**/*.{ts,tsx,mts,cts}"],
    rules: {
      "no-restricted-imports": ["error", {
        patterns: [
          { group: ["node:*"], message: "core must be isomorphic: no node: imports." },
          { group: FORBIDDEN_CORE_MODULES, message: "core must be isomorphic: no Node builtins." },
          { group: ["react", "react-dom", "react/*"], message: "core must not depend on React." },
        ],
      }],
      "no-restricted-globals": ["error", ...FORBIDDEN_CORE_GLOBALS],
      "no-restricted-syntax": ["error",
        { selector: "NewExpression[callee.name='Function']", message: "no Function constructor in core." },
        { selector: "CallExpression[callee.name='Function']", message: "a bare Function(...) call is the same escape hatch." },
      ],
    },
  },
  // js.configs.recommended applies to every file ESLint lints, and ESLint lints .js, .mjs and .cjs by
  // default. Without Node globals those files fail no-undef: measured, eslint . reports
  // "'module' is not defined" on .dependency-cruiser.cjs and console/process/URL on the .mjs scripts.
  {
    files: ["**/*.cjs"],
    languageOptions: { globals: { ...globals.node } },
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["**/*.test.{ts,tsx,mts,cts}"],
    rules: { "no-restricted-globals": "off", "no-restricted-imports": "off" },
  },
);
