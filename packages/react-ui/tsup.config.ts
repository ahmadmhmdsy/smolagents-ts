import { copyFileSync } from "node:fs";
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "es2022",
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  // The two workspace packages and React are peers of the consumer, never bundled here.
  external: ["@smolagents-ts/core", "@smolagents-ts/react", "react", "react-dom", "react/jsx-runtime"],
  // The stylesheet is shipped verbatim beside the bundle, not imported by it: a consumer
  // copies dist/styles.css into a sheet it owns.
  onSuccess: async () => {
    copyFileSync("src/styles.css", "dist/styles.css");
  },
});
