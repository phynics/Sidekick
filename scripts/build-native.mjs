import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("..", import.meta.url));
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
const sdk = toolchain.wasm_sdk;
if (!sdk) throw new Error(".toolchain-version is missing wasm_sdk.");

const toolchainName = `${toolchain.swift_toolchain}.xctoolchain`;
const swiftCandidates = [
  join("/Library/Developer/Toolchains", toolchainName, "usr/bin/swift"),
  join(homedir(), "Library/Developer/Toolchains", toolchainName, "usr/bin/swift")
];
const swift = swiftCandidates.find(existsSync);
if (!swift) throw new Error(`The pinned Swift executable was not found. Install ${toolchain.swift_toolchain} and rerun the build.`);

const buildDirectory = join(root, "native/.build", `${toolchain.swift_toolchain}-${sdk}`);
const moduleCache = join(buildDirectory, "module-cache");
mkdirSync(moduleCache, { recursive: true });

await new Promise((resolvePromise, reject) => {
  const environment = { ...process.env };
  delete environment.SWIFT_EXEC;
  delete environment.SDKROOT;
  delete environment.TOOLCHAINS;
  environment.PATH = `${dirname(swift)}:${environment.PATH ?? ""}`;
  environment.CLANG_MODULE_CACHE_PATH = join(moduleCache, "clang");
  environment.SWIFT_MODULECACHE_PATH = join(moduleCache, "swift");
  const child = spawn(swift, ["build", "--package-path", "native", "--scratch-path", buildDirectory, "--cache-path", join(buildDirectory, "swiftpm-cache"), "--swift-sdk", sdk, "--configuration", "release"], { cwd: root, env: environment, stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolvePromise() : reject(new Error(`Swift Wasm build failed with exit code ${code}.`)));
});

const candidates = [
  join(buildDirectory, "wasm32-unknown-wasi/release/sidekick-engine.wasm"),
  join(buildDirectory, "wasm32-unknown-wasip1/release/sidekick-engine.wasm"),
  join(buildDirectory, "out/Products/release/sidekick-engine.wasm"),
  join(buildDirectory, "out/Products/Release-webassembly-wasm32/sidekick-engine.wasm")
];
const source = candidates.find(existsSync);
if (!source) throw new Error("Swift completed but sidekick-engine.wasm was not found in the expected build outputs.");
mkdirSync(join(root, "public/wasm"), { recursive: true });
const destination = join(root, "public/wasm/sidekick-engine.wasm");
cpSync(source, destination);
const buildID = createHash("sha256").update(readFileSync(destination)).digest("hex");
writeFileSync(join(root, "public/wasm/sidekick-engine.manifest.json"), `${JSON.stringify({
  manifest_version: 1,
  protocol_version: 1,
  interface_version: 2,
  build_id: buildID,
  asset: "sidekick-engine.wasm"
}, null, 2)}\n`);
console.log(`Sidekick DM Wasm built from ${source} (${buildID.slice(0, 12)})`);
