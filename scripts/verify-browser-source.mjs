import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

for (const file of ["src/app.js", "src/boot.js", "src/wasm-engine.js", "src/catalog-index.js", "src/creature-builder.js", "src/hazard-builder.js", "src/encounter-packet.js", "src/npc-profile.js", "src/webmcp-adapter.js"]) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} failed the source parse check.`)));
  });
}
const app = await readFile("src/app.js", "utf8");
for (const fragment of ["globalThis.sidekickBridge", "globalThis.sidekickDM", "Change Swift state", "loadBootAssets", "Swift-owned value"]) {
  if (!app.includes(fragment)) throw new Error(`Browser boundary contract missing: ${fragment}`);
}
console.log("Browser source boundary passed.");
