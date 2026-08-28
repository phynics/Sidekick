import { fileURLToPath } from "node:url";
import { packageStaticSite } from "./package-static.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
packageStaticSite({ root });
