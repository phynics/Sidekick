import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";

for (const file of [
  "src/app.js",
  "src/boot.js",
  "src/wasm-engine.js",
  "src/catalog-index.js",
  "src/creature-builder.js",
  "src/creature-generation.js",
  "src/hazard-builder.js",
  "src/encounter-packet.js",
  "src/encounter-file.js",
  "src/print-packet.js",
  "src/npc-profile.js",
  "src/encounter-phases.js",
  "src/generation-run.js",
  "src/run-session.js",
  "src/webmcp-adapter.js"
]) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--check", file], { stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${file} failed the source parse check.`)));
  });
}
const app = await readFile("src/app.js", "utf8");
for (const fragment of ["globalThis.sidekickBridge", "globalThis.sidekickDM", "Change Swift state", "loadBootAssets", "Swift-owned value", "data-modal-open=\"catalog\"", "data-modal-open=\"creature\"", "data-modal-open=\"export\"", "data-pwl-group", "data-creature-remove", "Customize statistics", "data-catalog-filter", "data-catalog-page", "data-catalog-inspect", "Full Creature inspection", "catalogEntryCanAdd", "Add unavailable for unsupported or partial entries", "export-components-json", "export-components-zip", "export-library-json", "export-library-zip", "import-components-zip", "import-library-zip", "migrated v"]) {
  if (!app.includes(fragment)) throw new Error(`Browser boundary contract missing: ${fragment}`);
}

const logoPath = "public/brand/sidekick-logo-v3-transparent.png";
const [index, readme, logo] = await Promise.all([
  readFile("index.html", "utf8"),
  readFile("README.md", "utf8"),
  readFile(logoPath)
]);
if (logo.length === 0) throw new Error("Canonical Sidekick logo is empty.");
if (!app.includes(`./${logoPath}`)) throw new Error("The app does not use the canonical Sidekick logo.");
if (!readme.includes(logoPath)) throw new Error("The README does not show the canonical Sidekick logo.");
for (const fragment of [
  `<link rel="icon" type="image/png" href="./${logoPath}"`,
  `<link rel="apple-touch-icon" href="./${logoPath}"`,
  `https://phynics.github.io/Sidekick/${logoPath}`
]) {
  if (!index.includes(fragment)) throw new Error(`Browser logo metadata missing: ${fragment}`);
}
console.log("Browser source boundary passed.");
