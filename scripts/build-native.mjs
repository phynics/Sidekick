import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
const sdk = toolchain.wasm_sdk;
const swift = process.env.SWIFT_EXEC ?? "swift";
if (!sdk) throw new Error(".toolchain-version is missing wasm_sdk.");

await new Promise((resolvePromise, reject) => {
  const environment = { ...process.env };
  delete environment.SWIFT_EXEC;
  const child = spawn(swift, ["build", "--package-path", "native", "--swift-sdk", sdk, "--configuration", "release"], { cwd: root, env: environment, stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Swift Wasm build failed with exit code ${code}.`)));
});

const candidates = [
  join(root, "native/.build/wasm32-unknown-wasi/release/sidekick-engine.wasm"),
  join(root, "native/.build/wasm32-unknown-wasip1/release/sidekick-engine.wasm"),
  join(root, "native/.build/out/Products/release/sidekick-engine.wasm"),
  join(root, "native/.build/out/Products/Release-webassembly-wasm32/sidekick-engine.wasm")
];
const source = candidates.find(existsSync);
if (!source) throw new Error("Swift completed but sidekick-engine.wasm was not found in the expected build outputs.");
mkdirSync(join(root, "public/wasm"), { recursive: true });
cpSync(source, join(root, "public/wasm/sidekick-engine.wasm"));
console.log(`Sidekick DM Wasm built from ${source}`);
