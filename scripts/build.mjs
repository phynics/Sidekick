import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
execFileSync(process.execPath, [join(root, "scripts/build-native.mjs")], { cwd: root, stdio: "inherit" });
const output = join(root, "dist");
mkdirSync(output, { recursive: true });
for (const file of ["index.html", "styles.css"]) cpSync(join(root, file), join(output, file));
cpSync(join(root, "src"), join(output, "src"), { recursive: true });
cpSync(join(root, "public"), join(output, "public"), { recursive: true });
for (const file of ["index.html", "styles.css", "src/app.js", "src/boot.js", "src/wasm-engine.js", "public/data/demo-encounter.v1.json", "public/wasm/sidekick-engine.wasm"]) readFileSync(join(output, file));
writeFileSync(join(output, "build.txt"), "Sidekick DM static build\n");
console.log(`Sidekick DM static assets written to ${output}`);
