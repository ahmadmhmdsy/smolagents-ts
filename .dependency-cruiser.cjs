/** Architecture rules. A violation fails CI, not just review. */
module.exports = {
  forbidden: [
    {
      name: "core-no-node-builtins",
      severity: "error",
      comment: "packages/core must run in Node, browsers, Bun, Deno and Workers.",
      from: { path: "^packages/core/src" },
      to: { dependencyTypes: ["core"] },
    },
    {
      name: "core-no-react",
      severity: "error",
      comment: "core is framework-agnostic (design spec 5.3, layer L0).",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/react" },
    },
    {
      name: "core-no-extra-runtime-deps",
      severity: "error",
      comment: "core may depend only on zod at runtime (design spec 5.2).",
      from: { path: "^packages/core/src" },
      to: { dependencyTypes: ["npm"], pathNot: "^node_modules/zod" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "not-to-dev-dep",
      severity: "error",
      comment: "published source may not import a devDependency.",
      from: { path: "^packages/[^/]+/src" },
      to: { dependencyTypes: ["npm-dev"] },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(dist|coverage|smolagents|reference)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "types"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
