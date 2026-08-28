import { createServer } from "node:http";
import { rmSync, existsSync, mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
const contentTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };

const server = createServer(async (request, response) => {
  const requestPath = decodeURIComponent(new URL(request.url, "http://localhost").pathname).replace(/^\/+/, "") || "index.html";
  const file = resolve(dist, requestPath);
  const outside = relative(dist, file);
  if (outside.startsWith("..") || isAbsolute(outside)) { response.writeHead(404).end(); return; }
  try {
    const body = await readFile(file);
    response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const pageURL = `http://127.0.0.1:${address.port}/`;
const chromeCandidates = [
  process.env.CHROMIUM_BIN,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "/usr/bin/google-chrome"
].filter(Boolean);
const chrome = chromeCandidates.find(existsSync);
if (!chrome) {
  server.close();
  throw new Error("Chromium was not found. Set CHROMIUM_BIN to the Chromium executable.");
}
const browserVersion = spawnSync(chrome, ["--version"], { encoding: "utf8" });
if (browserVersion.status !== 0 || !browserVersion.stdout.includes(toolchain.chromium)) {
  server.close();
  throw new Error(`Chromium ${toolchain.chromium} is required; found ${browserVersion.stdout.trim() || "an unknown version"}.`);
}

const userData = mkdtempSync(join(tmpdir(), "sidekick-chromium-"));
const debugPort = await freePort();
const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${userData}`, `--remote-debugging-port=${debugPort}`, pageURL], { stdio: "ignore" });
let socket;
try {
  const target = await waitForTarget(debugPort);
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await withTimeout(new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; }), 5_000, "WebSocket connection");
  let nextID = 0;
  const command = (method, params = {}) => withTimeout(new Promise((resolve, reject) => {
    const id = ++nextID;
    const handler = (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== id) return;
      socket.removeEventListener("message", handler);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    };
    socket.addEventListener("message", handler);
    socket.send(JSON.stringify({ id, method, params }));
  }), 5_000, `DevTools command ${method}`);
  const evaluate = (expression) => command("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }).then((result) => result?.result?.value);
  await command("Page.enable");
  await command("Runtime.enable");

  await waitFor(async () => await evaluate("document.querySelector('[data-testid=swift-value]')?.textContent.trim()"), "7");
  const initial = await evaluate("({ value: document.querySelector('[data-testid=swift-value]').textContent.trim(), budget: document.querySelector('[data-testid=construction-budget]').textContent.trim(), asset: document.querySelector('[data-testid=asset-status]').textContent.trim(), bridge: document.querySelector('[data-testid=bridge-status]').textContent.trim() })");
  if (initial.value !== "7" || initial.budget !== "80 XP" || !initial.asset.includes("Static Encounter Brief")) throw new Error("Chromium did not render the initial Swift value, budget, and JSON asset.");
  await evaluate("document.querySelector('[data-action=increment]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=swift-value]')?.textContent.trim()"), "8");
  const updated = await evaluate("({ value: document.querySelector('[data-testid=swift-value]').textContent.trim(), bridge: document.querySelector('[data-testid=bridge-status]').textContent.trim() })");
  if (updated.value !== "8" || !updated.bridge.includes("JavaScript bridge received Swift value 8")) throw new Error("Chromium did not render the changed Swift state and bridge result.");
  await evaluate("document.querySelector('[data-testid=party-level]').value = '5'; document.querySelector('[data-testid=party-level]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=encounter-revision]').textContent.trim()"), "2");
  await evaluate("document.querySelector('[data-testid=party-size]').value = '5'; document.querySelector('[data-testid=party-size]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=construction-budget]').textContent.trim()"), "100 XP");
  await evaluate("document.querySelector('[data-testid=threat-target]').value = 'severe'; document.querySelector('[data-testid=threat-target]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=base-target]').textContent.trim()"), "120 XP");
  await evaluate("const f = document.querySelector('[data-action=add-participant]'); f.elements.name.value = 'Fixture Creature'; f.elements.level.value = '5'; f.elements.quantity.value = '2'; f.requestSubmit();");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "80 XP");
  await evaluate("document.querySelector('[data-action=undo]').click()");
  await waitFor(async () => await evaluate("document.querySelector('.participants').textContent.includes('No participants')"), true);
  await evaluate("document.querySelector('[data-action=redo]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_1]') !== null"), true);
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_1]') !== null"), true);
  console.log("Chromium browser smoke passed: PF2 budget, semantic mutation, stale-safe history, and IndexedDB reload succeeded.");
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await waitForExit(browser, 3_000);
  server.close();
  rmSync(userData, { recursive: true, force: true });
}

async function freePort() {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  return port;
}

async function waitForTarget(port) {
  return waitFor(async () => {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      return (await response.json()).find((entry) => entry.type === "page");
    } catch {
      return null;
    }
  });
}

async function waitFor(read, expected = undefined) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const value = await read();
    if (expected === undefined ? value : value === expected) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expected ?? "the browser target"}.`);
}

function withTimeout(promise, timeout, label) {
  let timer;
  const limit = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}.`)), timeout);
  });
  return Promise.race([promise, limit]).finally(() => clearTimeout(timer));
}

async function waitForExit(process, timeout) {
  if (process.exitCode !== null) return;
  const exited = new Promise((resolve) => process.once("exit", resolve));
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeout))]);
  if (process.exitCode !== null) return;
  process.kill("SIGKILL");
  await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, timeout))]);
}
