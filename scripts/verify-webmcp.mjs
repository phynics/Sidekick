import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const result = spawnSync(process.execPath, ["--test", "tests/webmcp-adapter.test.mjs"], {
  cwd: root,
  stdio: "inherit"
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
console.log("WebMCP adapter verification passed: version 1 envelopes, read projections, trust hints, errors, and idempotent registration.");
