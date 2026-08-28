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
  const webMCPBudget = await evaluate("globalThis.sidekickDM.webMCP.execute('sidekickdm_get_budget')");
  if (!webMCPBudget?.ok || webMCPBudget.data.construction_budget !== 80) throw new Error("The read-only WebMCP adapter did not expose the current Wasm budget.");
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
  const persisted = await evaluate("globalThis.sidekickDM.persistence.loadSavedDraft()");
  if (!persisted || Object.hasOwn(persisted, "budget") || Object.hasOwn(persisted, "readiness")) throw new Error("IndexedDB persisted derived budget or readiness values as authority.");
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_1]') !== null"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "80 XP");
  await evaluate("const f = document.querySelector('[data-action=search-catalog]'); f.elements.query.value = 'orc'; f.requestSubmit();");
  await waitFor(async () => await evaluate("document.querySelector('[data-catalog-add=\"creature/monster-core/orc-veteran/current\"]') !== null"), true);
  await evaluate("document.querySelector('[data-catalog-add=\"creature/monster-core/orc-veteran/current\"]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_2]')?.textContent.includes('Orc Veteran')"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "95 XP");
  await evaluate("const s = document.querySelector('[data-catalog-component=group_2][data-catalog-field=adjustment]'); s.value = 'elite'; s.dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "100 XP");
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_2]')?.textContent.includes('Orc Veteran')"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "100 XP");
  await evaluate(`(async () => { const values = { name: "Mire Scout", concept: "A shrine guardian", roadmap: "skirmisher", traits: "humanoid", languages: "Common", perception: "9", ac: "18", fortitude: "9", reflex: "12", will: "9", hp: "45", speed: "25", strikeName: "Spear", strikeAttack: "12", strikeDamage: "1d8+4", tactics: "Flank intruders.", morale: "Withdraw when bloodied." }; for (const [key, value] of Object.entries(values)) { const field = document.querySelector('#creature-builder-root [data-field="' + key + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } })()`);
  await waitFor(async () => await evaluate("document.querySelector('#creature-builder-root [data-action=add]')?.disabled"), false);
  await evaluate("document.querySelector('#creature-builder-root [data-action=add]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_3]')?.textContent.includes('Mire Scout')"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "110 XP");
  await evaluate(`(async () => { const values = { name: "Mire Bell Snare", traits: "mechanical", description: "A submerged chain catches trespassers.", detection: "18", disableMethods: "Thievery|17", trigger: "A creature crosses the chain.", effect: "The chain knocks the creature prone.", reset: "Reset the chain in ten minutes." }; for (const [key, value] of Object.entries(values)) { const field = document.querySelector('#hazard-builder-root [data-field="' + key + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } })()`);
  await waitFor(async () => await evaluate("document.querySelector('#hazard-builder-root [data-action=add]')?.disabled"), false);
  await evaluate("document.querySelector('#hazard-builder-root [data-action=add]').click()");
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards.length"), 1);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=avoidable-xp]').textContent.trim()"), "2 XP");
  const packetSections = [
    ["identity", { title: "The Bell Beneath Blackwater", premise: "A drowned cult guards the shrine bell.", objective: "Stop the bell before it calls the flood.", stakes: "The lower district floods if the bell rings." }],
    ["setup", { trigger: "The bell tolls when the party enters.", battlefieldDescription: "A flooded shrine with raised walkways.", startingPositions: "The defenders begin beside the eastern pool.", awarenessState: "The sentries are alert.", immediateFeatures: "Knee-deep water\nA cracked bell rope" }],
    ["running_guidance", { participantRoles: "Sentries screen the captain.", openingTactics: "Delay while the captain reaches the bell.", ongoingTactics: "Push isolated targets toward the water.", coordinationConflict: "Sentries retreat if the captain falls.", triggersReinforcements: "A second wave arrives when the bell is struck.", moraleSummary: "The cultists flee when the captain falls." }],
    ["cohesion", { participantPresence: "The cult is protecting its shrine.", relationships: "The captain rules the sentries through fear.", hazardTerrainFit: "The flooded floor hides the snare." }],
    ["outcomes", { victory: "The party silences the bell.", failure: "The flood reaches the lower district." }]
  ];
  for (const [section, values] of packetSections) {
    const beforeRevision = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.revision");
    await evaluate(`(() => { const form = document.querySelector('[data-packet-form="${section}"]'); const values = ${JSON.stringify(values)}; for (const [name, value] of Object.entries(values)) form.elements[name].value = value; form.requestSubmit(); return true; })()`);
    await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.revision"), beforeRevision + 1);
  }
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=readiness]').textContent.trim()"), "ready_with_warnings");
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_3]')?.textContent.includes('Mire Scout')"), true);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards.length"), 1);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=readiness]').textContent.trim()"), "ready_with_warnings");
  console.log("Chromium browser smoke passed: PF2 budget, Catalog, builders, ready Packet, WebMCP reads, history, and IndexedDB reload succeeded.");
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
