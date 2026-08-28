import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { packageStaticSite } from "./package-static.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
execFileSync(process.execPath, [join(root, "scripts/build-native.mjs")], { cwd: root, stdio: "inherit" });
packageStaticSite({ root });
