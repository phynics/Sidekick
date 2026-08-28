import { existsSync, readFileSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
const toolchainName = `${toolchain.swift_toolchain}.xctoolchain`;
const swift = [
  join("/Library/Developer/Toolchains", toolchainName, "usr/bin/swift"),
  join(homedir(), "Library/Developer/Toolchains", toolchainName, "usr/bin/swift")
].find(existsSync);
if (!swift) throw new Error(`The pinned Swift executable was not found. Install ${toolchain.swift_toolchain} and rerun npm run acceptance.`);

function run(label, executable, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(executable, args, { cwd: root, env: process.env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed with exit code ${result.status ?? 1}.`);
}

run("toolchain bootstrap", process.execPath, [join(root, "scripts/bootstrap.mjs")]);
run("rules fixtures and source notices", process.execPath, [join(root, "scripts/verify-fixtures.mjs")]);
run("catalog fixture and provenance", process.execPath, [join(root, "scripts/verify-catalog.mjs")]);
run("browser WebMCP contract", process.execPath, [join(root, "scripts/verify-webmcp.mjs")]);
run("WebMCP Generation Run lifecycle and rollback", process.execPath, [join(root, "scripts/verify-generation-run.mjs")]);

const browserTests = readdirSync(join(root, "tests"))
  .filter((file) => file.endsWith(".test.mjs"))
  .sort()
  .map((file) => join("tests", file));
run("JavaScript domain and browser-boundary tests", process.execPath, ["--test", ...browserTests]);

run("static Wasm and browser build", process.execPath, [join(root, "scripts/build.mjs")]);
run("native Swift package tests", swift, ["test", "--package-path", "native"]);
run("Wasm artifact verification", process.execPath, [join(root, "scripts/verify-native.mjs")]);
run("browser source contract", process.execPath, [join(root, "scripts/verify-browser-source.mjs")]);
run("Chromium manual and WebMCP acceptance scenario", process.execPath, [join(root, "scripts/chromium-smoke.mjs")]);

console.log("\nSidekick DM acceptance passed: fixtures, rules, catalog, native tests, Wasm, static build, manual browser flow, and agent boundary scenario.");
