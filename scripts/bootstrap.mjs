import { existsSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
if (process.versions.node !== toolchain.node) throw new Error(`Node ${toolchain.node} is required; found ${process.versions.node}.`);

const toolchainName = `${toolchain.swift_toolchain}.xctoolchain`;
const swiftCandidates = [
  join("/Library/Developer/Toolchains", toolchainName, "usr/bin/swift"),
  join(homedir(), "Library/Developer/Toolchains", toolchainName, "usr/bin/swift")
];
const swift = swiftCandidates.find(existsSync);
if (!swift) throw new Error(`The pinned Swift executable was not found. Install ${toolchain.swift_toolchain} and rerun npm run bootstrap.`);
const swiftPath = existsSync(swift) ? realpathSync(swift) : "";
const swiftVersion = spawnSync(swift, ["--version"], { encoding: "utf8" });
if (!swiftPath.includes(toolchain.swift_toolchain) || swiftVersion.status !== 0) {
  throw new Error(`Swift ${toolchain.swift_toolchain} is required; found ${swiftVersion.stdout?.trim() || "an unknown compiler"}.`);
}
const result = spawnSync(swift, ["sdk", "list"], { encoding: "utf8" });
if (result.error) throw new Error(`Could not run ${swift}: ${result.error.message}`);
if (result.status !== 0 || !result.stdout.includes(toolchain.wasm_sdk)) {
  throw new Error(`Swift SDK ${toolchain.wasm_sdk} is not installed. Install the matching official SDK and rerun npm run bootstrap.`);
}
console.log(`Sidekick DM toolchain selected: Swift ${toolchain.swift_toolchain}, Wasm SDK ${toolchain.wasm_sdk}, Node ${toolchain.node}, Chromium ${toolchain.chromium}`);
