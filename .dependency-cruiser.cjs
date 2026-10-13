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
      to: { dependencyTypes: ["npm"], pathNot: "node_modules/zod/" },
    },
    {
      name: "core-no-models",
      severity: "error",
      comment: "core owns the interface; an adapter implements it, never the reverse.",
      from: { path: "^packages/core/src" },
      to: { path: "^packages/models" },
    },
    {
      name: "no-circular",
      severity: "error",
      from: {},
      to: { circular: true },
    },
    {
      name: "no-undeclared-deps-from-src",
      severity: "error",
      comment:
        "packages/*/src may only import a package its own manifest declares as a dependency or a peer.",
      from: { path: "^packages/[^/]+/src" },
      to: {
        // A peer dependency is declared, but dependency-cruiser reports it as npm-dev and
        // npm-no-pkg as well when the package is only a peer at runtime, so importing one has
        // to be distinguished from importing a dev-only or transitive package.
        dependencyTypes: ["npm-dev", "npm-optional", "npm-bundled", "npm-no-pkg", "npm-unknown"],
        dependencyTypesNot: ["npm", "npm-peer"],
      },
    },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "^packages/[^/]+/(?:dist|coverage)/|^(?:dist|coverage|smolagents|reference)/" },
    tsConfig: { fileName: "tsconfig.base.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "types"] },
    reporterOptions: { text: { highlightFocused: true } },
  },
};
