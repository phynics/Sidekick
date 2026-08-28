import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const requiredFiles = [
  "index.html",
  "styles.css",
  "styles/print.css",
  "src/app.js",
  "src/boot.js",
  "src/wasm-engine.js",
  "public/data/demo-encounter.v1.json",
  "public/wasm/sidekick-engine.wasm"
];

export function packageStaticSite({ root, output = join(root, "dist") }) {
  rmSync(output, { recursive: true, force: true });
  mkdirSync(output, { recursive: true });
  for (const file of ["index.html", "styles.css"]) cpSync(join(root, file), join(output, file));
  mkdirSync(join(output, "styles"), { recursive: true });
  cpSync(join(root, "styles/print.css"), join(output, "styles/print.css"));
  cpSync(join(root, "src"), join(output, "src"), { recursive: true });
  cpSync(join(root, "public"), join(output, "public"), { recursive: true });
  for (const file of requiredFiles) readFileSync(join(output, file));
  writeFileSync(join(output, ".nojekyll"), "");
  writeFileSync(join(output, "build.txt"), "Sidekick DM static build\n");
  console.log(`Sidekick DM static assets written to ${output}`);
}
