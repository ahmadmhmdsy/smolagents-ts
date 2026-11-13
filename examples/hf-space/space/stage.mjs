// Assemble the folder a static Space serves: the Vite build plus the Space README, whose
// front matter turns on "Sign in with HF". Run `pnpm --filter example-hf-space run build` first.
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const at = (relative) => fileURLToPath(new URL(relative, import.meta.url));
const out = process.argv[2] ?? at("../space-dist");
if (!existsSync(at("../dist/index.html"))) {
  console.error("no dist/index.html: run the build first");
  process.exit(1);
}
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(at("../dist"), out, { recursive: true });
cpSync(at("./README.md"), out + "/README.md");
console.log("staged " + out);
