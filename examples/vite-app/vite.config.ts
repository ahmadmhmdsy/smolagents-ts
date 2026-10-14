import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const at = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

// The example consumes the published names, so the dev server and the build map them to the
// sources the packages build from: a fresh clone has no dist/ yet, and the whole point of this
// page is that a reader can start it without building the workspace first.
//
// base is relative so the same build works from a project path as well as from a domain root.
export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^smolagents-ts$/, replacement: at("../../packages/core/src/index.ts") },
      { find: /^smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
      { find: /^smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
      { find: /^smolagents-ts\/exec\/quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
      { find: /^smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
      // The sources above import each other by package name, so the internal names need the
      // same mapping: without them the executor's first import resolves to a dist/ that a
      // fresh checkout does not have, and this page is supposed to start without one.
      { find: /^@smolagents-ts\/core$/, replacement: at("../../packages/core/src/index.ts") },
      { find: /^@smolagents-ts\/models$/, replacement: at("../../packages/models/src/index.ts") },
      { find: /^@smolagents-ts\/tools$/, replacement: at("../../packages/tools/src/index.ts") },
      { find: /^@smolagents-ts\/exec-quickjs$/, replacement: at("../../packages/exec-quickjs/src/index.ts") },
      { find: /^@smolagents-ts\/react$/, replacement: at("../../packages/react/src/index.ts") },
    ],
  },
});
