import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";

const FORBIDDEN_CORE_MODULES = [
  "fs", "path", "os", "child_process", "worker_threads", "net", "http", "https",
  "crypto", "stream", "util", "url", "zlib", "vm", "module", "process", "buffer",
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
  { ignores: ["**/dist/**", "**/coverage/**", "smolagents/**", "reference/**", "**/*.d.ts"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["packages/core/src/**/*.ts"],
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
    files: ["**/*.test.ts", "**/*.test.tsx"],
    rules: { "no-restricted-globals": "off", "no-restricted-imports": "off" },
  },
);
