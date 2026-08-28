import { createServer } from "node:http";
import { rmSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve, relative, isAbsolute, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { createSidekickDMZip } from "../src/encounter-file.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = join(root, "dist");
const requestedBasePath = process.env.SIDEKICK_BASE_PATH ?? "/";
const basePath = `/${requestedBasePath.replace(/^\/+|\/+$/g, "")}${requestedBasePath === "/" ? "" : "/"}`;
const toolchain = Object.fromEntries(readFileSync(join(root, ".toolchain-version"), "utf8").split(/\r?\n/).filter(Boolean).map((line) => line.split("=", 2)));
const contentTypes = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm" };

const server = createServer(async (request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  if (!pathname.startsWith(basePath)) { response.writeHead(404).end(); return; }
  const requestPath = pathname.slice(basePath.length).replace(/^\/+/, "") || "index.html";
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
const pageURL = `http://127.0.0.1:${address.port}${basePath}`;
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
const transferData = mkdtempSync(join(tmpdir(), "sidekick-acceptance-transfer-"));
const debugPort = await freePort();
const browser = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-first-run", "--no-default-browser-check", `--user-data-dir=${userData}`, `--remote-debugging-port=${debugPort}`, "about:blank"], { stdio: "ignore" });
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
  await command("DOM.enable");
  const networkRequests = new Set();
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Network.requestWillBeSent" && message.params?.request?.url) networkRequests.add(message.params.request.url);
  });
  const unexpectedStaticRequests = () => [...networkRequests].filter((requestURL) => {
    const parsed = new URL(requestURL);
    if (parsed.origin !== new URL(pageURL).origin) return true;
    const path = parsed.pathname.slice(basePath.length - 1);
    return !(parsed.pathname === basePath || parsed.pathname === "/favicon.ico" || path === "/index.html" || path === "/styles.css" || path === "/favicon.ico" || path.startsWith("/src/") || path.startsWith("/public/"));
  });
  await command("Network.enable");
  await command("Page.navigate", { url: pageURL });
  const setFileInput = async (selector, path) => {
    const document = await command("DOM.getDocument", { depth: -1 });
    const node = await command("DOM.querySelector", { nodeId: document.root.nodeId, selector });
    if (!node.nodeId) throw new Error(`File input ${selector} was not found.`);
    await command("DOM.setFileInputFiles", { nodeId: node.nodeId, files: [path] });
  };

  await waitFor(async () => await evaluate("document.querySelector('[data-testid=swift-value]')?.textContent.trim()"), "7");
  const initial = await evaluate("({ value: document.querySelector('[data-testid=swift-value]').textContent.trim(), budget: document.querySelector('[data-testid=construction-budget]').textContent.trim(), asset: document.querySelector('[data-testid=asset-status]').textContent.trim(), bridge: document.querySelector('[data-testid=bridge-status]').textContent.trim() })");
  if (initial.value !== "7" || initial.budget !== "80 XP" || !initial.asset.includes("Static Encounter Brief")) throw new Error("Chromium did not render the initial Swift value, budget, and JSON asset.");
  const bootUnexpectedRequests = unexpectedStaticRequests();
  if (bootUnexpectedRequests.length) throw new Error(`Boot-time runtime made unexpected network request(s): ${bootUnexpectedRequests.join(", ")}`);
  const webMCPBudget = await evaluate("globalThis.sidekickDM.webMCP.execute('sidekickdm_get_budget')");
  if (!webMCPBudget?.ok || webMCPBudget.data.construction_budget !== 80) throw new Error("The read-only WebMCP adapter did not expose the current Wasm budget.");
  await evaluate("document.querySelector('[data-action=new-encounter]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"), "New Encounter Draft created");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=construction-budget]')?.textContent.trim()"), "80 XP");
  await evaluate("document.querySelector('[data-action=increment]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=swift-value]')?.textContent.trim()"), "8");
  const updated = await evaluate("({ value: document.querySelector('[data-testid=swift-value]').textContent.trim(), bridge: document.querySelector('[data-testid=bridge-status]').textContent.trim() })");
  if (updated.value !== "8" || !updated.bridge.includes("JavaScript bridge received Swift value 8")) throw new Error("Chromium did not render the changed Swift state and bridge result.");
  await evaluate("document.querySelector('[data-testid=party-level]').value = '5'; document.querySelector('[data-testid=party-level]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=encounter-revision]').textContent.trim()"), "3");
  await evaluate("document.querySelector('[data-testid=party-size]').value = '5'; document.querySelector('[data-testid=party-size]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=construction-budget]').textContent.trim()"), "100 XP");
  await evaluate("document.querySelector('[data-testid=threat-target]').value = 'severe'; document.querySelector('[data-testid=threat-target]').dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=base-target]').textContent.trim()"), "120 XP");
  await evaluate("const f = document.querySelector('[data-action=add-participant]'); f.elements.name.value = 'Fixture Creature'; f.elements.level.value = '5'; f.elements.quantity.value = '2'; f.requestSubmit();");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "80 XP");
  await evaluate("document.querySelector('.controls [data-action=undo]').click()");
  await waitFor(async () => await evaluate("document.querySelectorAll('[data-testid^=participant-]').length"), 0);
  await evaluate("document.querySelector('.controls [data-action=redo]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_1]') !== null"), true);
  const persisted = await evaluate("globalThis.sidekickDM.persistence.loadSavedDraft()");
  if (!persisted || Object.hasOwn(persisted, "budget") || Object.hasOwn(persisted, "readiness")) throw new Error("IndexedDB persisted derived budget or readiness values as authority.");
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.readyState"), "complete");
  await waitFor(async () => await evaluate("Boolean(globalThis.sidekickDM?.engine?.snapshot?.encounter)"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=participant-group_1]') !== null"), true);
  const runPacketSurface = await evaluate("(() => { const trigger = document.querySelector('[data-modal-open=run]'); trigger?.click(); const dialog = document.querySelector('[data-modal=run]'); return { trigger: Boolean(trigger), open: Boolean(dialog?.open), view: Boolean(dialog?.querySelector('[data-testid=run-packet-view]')), authoringButtons: [...(dialog?.querySelectorAll('button') ?? [])].some(button => button.textContent.includes('Save Identity')), printButton: [...(dialog?.querySelectorAll('button') ?? [])].some(button => button.textContent.trim() === 'Print packet') }; })()");
  if (!runPacketSurface.trigger || !runPacketSurface.open || !runPacketSurface.view || runPacketSurface.authoringButtons || !runPacketSurface.printButton) throw new Error(`Run packet did not open a focused run-facing view: ${JSON.stringify(runPacketSurface)}`);
  await evaluate("document.querySelector('[data-modal=run] [data-modal-close]').click()");
  const menuDismissal = await evaluate("(() => { const menu = document.querySelector('.command-controls .action-menu'); menu.open = true; document.querySelector('h1').click(); return { openAfterOutsideClick: menu.open, editPacketAction: [...menu.querySelectorAll('button')].some(button => button.textContent.trim() === 'Edit packet') }; })()");
  if (menuDismissal.openAfterOutsideClick || !menuDismissal.editPacketAction) throw new Error(`Encounter action menu did not dismiss or expose packet authoring separately: ${JSON.stringify(menuDismissal)}`);
  await evaluate("const f = document.querySelector('[data-action=search-catalog]'); f.elements.query.value = 'orc'; f.requestSubmit();");
  await waitFor(async () => await evaluate("document.querySelector('[data-catalog-add=\"creature/monster-core/orc-veteran/current\"]') !== null"), true);
  await evaluate("document.querySelector('[data-catalog-add=\"creature/monster-core/orc-veteran/current\"]').click()");
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.some(group => group.contentID === 'creature/monster-core/orc-veteran/current')"), true).catch(async error => { throw new Error(`${error.message} Catalog notice: ${await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()")} revision: ${await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.revision")}`); });
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "90 XP");
  await evaluate("const s = document.querySelector('[data-catalog-component=group_2][data-catalog-field=adjustment]'); s.value = 'elite'; s.dispatchEvent(new Event('change', { bubbles: true }))");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "95 XP");
  const catalogCreatureLedger = await evaluate("({ count: document.querySelector('[data-testid=creature-count-group_2]')?.textContent.trim(), xp: document.querySelector('[data-testid=creature-xp-group_2]')?.textContent.trim(), attacks: document.querySelector('[data-testid=creature-attacks-group_2]')?.textContent.trim(), features: document.querySelector('[data-testid=creature-features-group_2]')?.textContent.trim() })");
  if (catalogCreatureLedger.count !== "×1" || catalogCreatureLedger.xp !== "15 XP" || !catalogCreatureLedger.attacks || !catalogCreatureLedger.features) throw new Error(`Creature ledger did not emphasize count and XP or list mechanics: ${JSON.stringify(catalogCreatureLedger)}`);
  const workspaceBeforeStart = await evaluate("(() => { document.querySelector('[data-mode=library]').click(); const library = { visible: getComputedStyle(document.querySelector('[data-testid=library-workspace]')).display !== 'none', encounters: document.querySelectorAll('[data-library-select-record]').length, preview: Boolean(document.querySelector('[data-testid=library-preview]')) }; document.querySelector('[data-mode=run]').click(); return { library, beforeStart: { combatants: document.querySelectorAll('[data-run-select]').length, start: Boolean(document.querySelector('[data-start-encounter]')) } }; })()");
  await evaluate("document.querySelector('[data-start-encounter]').click()");
  await waitFor(async () => await evaluate("document.querySelectorAll('[data-run-select]').length >= 3"), true);
  const workspaceRun = await evaluate("({ visible: getComputedStyle(document.querySelector('[data-testid=run-workspace]')).display !== 'none', combatants: document.querySelectorAll('[data-run-select]').length, sheet: document.querySelector('.combatant-sheet h2')?.textContent.trim() })");
  const workspaceModes = { ...workspaceBeforeStart, run: workspaceRun };
  if (!workspaceModes.library.visible || workspaceModes.library.encounters < 1 || !workspaceModes.library.preview || workspaceModes.beforeStart.combatants !== 0 || !workspaceModes.beforeStart.start || !workspaceModes.run.visible || workspaceModes.run.combatants < 3 || !workspaceModes.run.sheet) throw new Error(`Library, Build, and explicit Run start failed: ${JSON.stringify(workspaceModes)}`);
  const shelfFlow = await evaluate("(() => { const shelf = document.querySelector('[data-testid=agent-shelf]'); const initial = shelf?.className; const status = document.querySelector('[data-testid=webmcp-status]')?.textContent; document.querySelector('[data-agent-dismiss]')?.click(); const dismissed = document.querySelector('[data-testid=agent-shelf]')?.classList.contains('is-dismissed'); document.querySelector('.sidekick-toggle')?.click(); const recalled = document.querySelector('[data-testid=agent-shelf]')?.classList.contains('is-compact'); document.querySelector('[data-agent-expand]')?.click(); const expanded = document.querySelector('[data-testid=agent-shelf]')?.classList.contains('is-expanded'); return { initial, status, dismissed, recalled, expanded }; })()");
  const expectedInitialShelf = shelfFlow.status?.includes("connected") ? shelfFlow.initial?.includes("is-compact") : shelfFlow.initial?.includes("is-dismissed");
  if (!expectedInitialShelf || !shelfFlow.dismissed || !shelfFlow.recalled || !shelfFlow.expanded) throw new Error(`Sidekick shelf could not dismiss, recall, and expand: ${JSON.stringify(shelfFlow)}`);
  const runCombatantID = await evaluate("[...document.querySelectorAll('.initiative-entry [data-run-select]')].find(entry => entry.textContent.includes('Orc Veteran'))?.dataset.runSelect");
  if (!runCombatantID) throw new Error(`Live run did not expose the catalog creature: ${JSON.stringify(await evaluate("[...document.querySelectorAll('.initiative-entry [data-run-select]')].map(entry => ({ id: entry.dataset.runSelect, text: entry.textContent.trim() }))"))}`);
  await evaluate(`(() => { const initiative = document.querySelector('[data-run-initiative="${runCombatantID}"]'); initiative.value = '22'; initiative.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await waitFor(async () => await evaluate(`document.querySelector('[data-run-initiative="${runCombatantID}"]')?.value`), "22");
  await evaluate("document.querySelector('[data-run-action=next_turn]').click()");
  await waitFor(async () => await evaluate("document.querySelector('.initiative-entry.is-active strong')?.textContent.trim()"), "Orc Veteran");
  await evaluate(`document.querySelector('[data-run-select="${runCombatantID}"]').click()`);
  await waitFor(async () => await evaluate("document.querySelector('.combatant-sheet h2')?.textContent.trim()"), "Orc Veteran");
  const hpBefore = await evaluate("Number(document.querySelector('.hp-display strong')?.textContent)");
  await evaluate("(() => { const amount = document.querySelector('[data-run-hp-form] input[name=amount]'); amount.value = '7'; document.querySelector('[data-run-hp-form] button[value=damage]').click(); })()");
  await waitFor(async () => await evaluate("Number(document.querySelector('.hp-display strong')?.textContent)"), hpBefore - 7);
  await evaluate("(() => { const condition = document.querySelector('[data-run-condition-form]'); condition.elements.name.value = 'frightened'; condition.elements.value.value = '1'; condition.requestSubmit(); })()");
  await waitFor(async () => Boolean((await evaluate("document.querySelector('.condition-chip')?.textContent.trim()"))?.includes("frightened 1")), true);
  await evaluate("document.querySelector('[data-run-roll]').click()");
  await waitFor(async () => Boolean(await evaluate("document.querySelector('.roll-log .log-roll')?.textContent.trim()")), true);
  const runInteraction = await evaluate(`({ combatantID: "${runCombatantID}", active: document.querySelector('.initiative-entry.is-active strong')?.textContent, hpBefore: ${hpBefore}, hpAfter: Number(document.querySelector('.hp-display strong')?.textContent), condition: document.querySelector('.condition-chip')?.textContent, roll: document.querySelector('.roll-log .log-roll')?.textContent })`);
  if (!runInteraction.combatantID || !runInteraction.active || runInteraction.hpAfter !== runInteraction.hpBefore - 7 || !runInteraction.condition?.includes("frightened 1") || !runInteraction.roll) throw new Error(`Live run interaction failed: ${JSON.stringify(runInteraction)}`);
  await evaluate("document.querySelector('[data-mode=build]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "95 XP");
  const collapsedCreatureManager = await evaluate("(() => { const card = document.querySelector('[data-testid=participant-group_2]'); const manager = card?.querySelector('.creature-manager'); return { open: manager?.open, summary: manager?.querySelector('summary')?.textContent.trim() }; })()");
  if (collapsedCreatureManager.open || collapsedCreatureManager.summary !== "Manage creature") throw new Error(`Creature editing competed with run-facing mechanics: ${JSON.stringify(collapsedCreatureManager)}`);
  await evaluate("document.querySelector('[data-testid=participant-group_2] .creature-manager').open = true");
  if (!await evaluate("document.querySelector('[data-testid=participant-group_2] .creature-manager').open")) throw new Error("Creature management controls did not reveal on request");
  await command("Emulation.setDeviceMetricsOverride", { width: 720, height: 900, deviceScaleFactor: 1, mobile: false });
  const narrowLedger = await evaluate("(() => { const card = document.querySelector('[data-testid=participant-group_2]'); const impact = card?.querySelector('.creature-impact'); const identity = card?.querySelector('.creature-identity'); if (!card || !impact || !identity) return null; const impactRect = impact.getBoundingClientRect(); const identityRect = identity.getBoundingClientRect(); return { impactWidth: Math.round(impactRect.width), cardWidth: Math.round(card.getBoundingClientRect().width), impactBelowIdentity: impactRect.top >= identityRect.bottom - 1 }; })()");
  if (!narrowLedger || narrowLedger.impactWidth >= narrowLedger.cardWidth * 0.7 || !narrowLedger.impactBelowIdentity) throw new Error(`Creature impact controls did not reflow at narrow width: ${JSON.stringify(narrowLedger)}`);
  const mobileShelf = await evaluate("(() => { const shelf = document.querySelector('[data-testid=agent-shelf]'); const rect = shelf?.getBoundingClientRect(); return rect ? { left: Math.round(rect.left), right: Math.round(rect.right), bottom: Math.round(rect.bottom), viewport: innerWidth, height: innerHeight } : null; })()");
  if (!mobileShelf || mobileShelf.left < 0 || mobileShelf.right > mobileShelf.viewport || mobileShelf.bottom > mobileShelf.height) throw new Error(`Sidekick shelf escaped the mobile viewport: ${JSON.stringify(mobileShelf)}`);
  await command("Emulation.clearDeviceMetricsOverride");
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.readyState"), "complete");
  await waitFor(async () => await evaluate("Boolean(globalThis.sidekickDM?.engine?.snapshot?.encounter)"), true);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.some(group => group.contentID === 'creature/monster-core/orc-veteran/current')"), true);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "95 XP");
  const initialBuilderSections = await evaluate("[...document.querySelectorAll('#creature-builder-root details[open][data-builder-section]')].map(section => section.dataset.builderSection)");
  if (JSON.stringify(initialBuilderSections) !== JSON.stringify(["identity"])) throw new Error(`New Monster Creator did not progressively disclose its sections: ${JSON.stringify(initialBuilderSections)}`);
  await evaluate(`(async () => { const values = { name: "Mire Scout", level: "5", concept: "A shrine guardian", roadmap: "skirmisher", traits: "humanoid", languages: "Common", perception: "21", ac: "20", fortitude: "11", reflex: "14", will: "11", hp: "75", speed: "25", strikeName: "Spear", strikeAttack: "15", strikeDamage: "1d8+4", tactics: "Flank intruders.", morale: "Withdraw when bloodied." }; for (const [key, value] of Object.entries(values)) { const field = document.querySelector('#creature-builder-root [data-field="' + key + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } })()`);
  const synchronizedCreatureControls = await evaluate(`(async () => {
    const change = async (field, value) => {
      const control = document.querySelector('#creature-builder-root [data-field="' + field + '"]');
      control.value = value;
      control.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(requestAnimationFrame);
    };
    await change('acBand', 'high');
    const categoryToValue = document.querySelector('#creature-builder-root [data-field=ac]').value;
    await change('ac', '24');
    const valueToCategory = document.querySelector('#creature-builder-root [data-field=acBand]').value;
    const acGuidance = document.querySelector('[data-testid=benchmark-guidance-ac]').textContent.trim();
    await change('strikeDamageBand', 'high');
    const categoryToDamage = document.querySelector('#creature-builder-root [data-field=strikeDamage]').value;
    await change('strikeDamage', '2d6+7');
    const damageToCategory = document.querySelector('#creature-builder-root [data-field=strikeDamageBand]').value;
    const damageGuidance = document.querySelector('[data-testid=benchmark-guidance-damage-0]').textContent.trim();
    await change('roadmap', 'controller');
    const controller = {
      attack: document.querySelector('#creature-builder-root [data-field=strikeAttack]').value,
      damage: document.querySelector('#creature-builder-root [data-field=strikeDamage]').value
    };
    await change('roadmap', 'skirmisher');
    return { categoryToValue, valueToCategory, acGuidance, categoryToDamage, damageToCategory, damageGuidance, controller };
  })()`);
  if (JSON.stringify(synchronizedCreatureControls) !== JSON.stringify({ categoryToValue: "22", valueToCategory: "extreme", acGuidance: "Extreme · 1 below 25", categoryToDamage: "2d8+7", damageToCategory: "moderate", damageGuidance: "Moderate · 1 above 13", controller: { attack: "13", damage: "2d4+6" } })) throw new Error(`Creature statistic synchronization failed: ${JSON.stringify(synchronizedCreatureControls)}`);
  await waitFor(async () => await evaluate("document.querySelector('#creature-builder-root [data-action=add]')?.disabled"), false);
  await evaluate("document.querySelector('#creature-builder-root [data-action=add]').click()");
  const originalParticipantID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.at(-1).id");
  await waitFor(async () => await evaluate(`document.querySelector('[data-testid=participant-${originalParticipantID}]')?.textContent.includes('Mire Scout')`), true);
  const originalCreatureLedger = await evaluate(`({ count: document.querySelector('[data-testid=creature-count-${originalParticipantID}]')?.textContent.trim(), xp: document.querySelector('[data-testid=creature-xp-${originalParticipantID}]')?.textContent.trim(), attacks: document.querySelector('[data-testid=creature-attacks-${originalParticipantID}]')?.textContent.trim(), features: document.querySelector('[data-testid=creature-features-${originalParticipantID}]')?.textContent.trim() })`);
  if (originalCreatureLedger.count !== "×1" || originalCreatureLedger.xp !== "40 XP" || !originalCreatureLedger.attacks.includes("Spear") || !originalCreatureLedger.features.includes("No special features recorded")) throw new Error(`Original Creature ledger projection failed: ${JSON.stringify(originalCreatureLedger)}`);
  const editCreatureLabel = await evaluate(`(() => { document.querySelector('[data-testid=participant-${originalParticipantID}] .creature-manager').open = true; document.querySelector('[data-testid=participant-${originalParticipantID}] [data-creature-edit]').click(); return document.querySelector('#creature-builder-root [data-action=add]')?.textContent.trim(); })()`);
  if (editCreatureLabel !== "Save changes") throw new Error(`Existing Creature editor used the wrong completion label: ${editCreatureLabel}`);
  await evaluate("document.querySelector('[data-modal=creature] [data-modal-close]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=guaranteed-xp]').textContent.trim()"), "135 XP");
  await evaluate(`(async () => { const values = { name: "Mire Bell Snare", traits: "mechanical", description: "A submerged chain catches trespassers.", detection: "18", disableMethods: "Thievery|17", trigger: "A creature crosses the chain.", effect: "The chain knocks the creature prone.", reset: "Reset the chain in ten minutes.", participation: "conditional", participationCondition: "When the bell tolls." }; for (const [key, value] of Object.entries(values)) { const field = document.querySelector('#hazard-builder-root [data-field="' + key + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } })()`);
  await waitFor(async () => await evaluate("document.querySelector('#hazard-builder-root [data-action=add]')?.disabled"), false);
  await evaluate("document.querySelector('#hazard-builder-root [data-action=add]').click()");
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards.length"), 1);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=conditional-xp]').textContent.trim()"), "2 XP");
  const npcValues = { encounterPurpose: "Protect the drowned shrine.", immediateGoal: "Drive intruders away from the bell.", moraleExit: "Flee when the captain falls." };
  await evaluate(`(() => { const form = document.querySelector('[data-npc-profile-form]'); const values = ${JSON.stringify(npcValues)}; for (const [name, value] of Object.entries(values)) form.elements[name].value = value; form.requestSubmit(); return true; })()`);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.npcProfiles?.length"), 1);
  const phaseHazardID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards[0].id");
  const phaseValues = { title: "The Bell Rings", triggerExplanation: "When the shrine bell is struck.", participantIDs: originalParticipantID, hazardIDs: phaseHazardID, terrainChanges: "Floodwater rises around the bell.", runningGuidance: "Push isolated targets toward the flooded floor." };
  await evaluate(`(async () => { const values = ${JSON.stringify(phaseValues)}; for (const [name, value] of Object.entries(values)) { const field = document.querySelector('[data-phase-form] [name="' + name + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } document.querySelector('[data-phase-form]').requestSubmit(); return true; })()`);
  await waitFor(async () => await evaluate("document.querySelector('[data-phase-form] button[type=submit]')?.disabled"), false);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.phases?.length"), 1);
  const phaseTwoParticipantIDs = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.filter(group => ['Fixture Creature', 'Orc Veteran'].includes(group.name)).map(group => group.id).join(', ')");
  await evaluate("document.querySelector('[data-action=new-phase]').click()");
  await waitFor(async () => await evaluate("document.querySelector('[data-phase-form] [name=title]')?.value"), "");
  const phaseTwoValues = { title: "The Flood Rises", triggerKind: "round", triggerExplanation: "At the start of the third round.", participantIDs: phaseTwoParticipantIDs, hazardIDs: "", terrainChanges: "The eastern walkway collapses.", runningGuidance: "The sentries hold the walkway while the veteran presses the bell." };
  await evaluate(`(async () => { const values = ${JSON.stringify(phaseTwoValues)}; for (const [name, value] of Object.entries(values)) { const field = document.querySelector('[data-phase-form] [name="' + name + '"]'); field.value = value; field.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(requestAnimationFrame); } document.querySelector('[data-phase-form]').requestSubmit(); return true; })()`);
  await waitFor(async () => await evaluate("document.querySelector('[data-phase-form] button[type=submit]')?.disabled"), false);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.phases?.length"), 2);
  await waitFor(async () => await evaluate("(globalThis.sidekickDM.engine.snapshot.phaseBudget ?? globalThis.sidekickDM.engine.snapshot.phase_budget)?.perPhase?.length"), 2);
  const phaseBudget = await evaluate("(() => { const value = globalThis.sidekickDM.engine.snapshot.phaseBudget ?? globalThis.sidekickDM.engine.snapshot.phase_budget ?? {}; return { peak: value.peakActiveXP ?? value.peak_active_xp, total: value.totalEncounterXP ?? value.total_encounter_xp }; })()");
  if (phaseBudget.peak !== 95 || phaseBudget.total !== 137) throw new Error(`Phase budget projection was not authoritative: ${JSON.stringify(phaseBudget)}`);
  const packetSections = [
    ["identity", { title: "The Bell Beneath Blackwater", premise: "A drowned cult guards the shrine bell.", objective: "Stop the bell before it calls the flood.", stakes: "The lower district floods if the bell rings." }],
    ["setup", { trigger: "The bell tolls when the party enters.", battlefieldDescription: "A flooded shrine with raised walkways.", startingPositions: "The defenders begin beside the eastern pool.", awarenessState: "The sentries are alert.", immediateFeatures: "Knee-deep water\nA cracked bell rope" }],
    ["running_guidance", { participantRoles: "Sentries screen the captain.", openingTactics: "Delay while the captain reaches the bell.", ongoingTactics: "Push isolated targets toward the water.", coordinationConflict: "Sentries retreat if the captain falls.", triggersReinforcements: "A second wave arrives when the bell is struck.", moraleSummary: "The cultists flee when the captain falls." }],
    ["cohesion", { participantPresence: "The cult is protecting its shrine.", relationships: "The captain rules the sentries through fear.", hazardTerrainFit: "The flooded floor hides the snare.", theme: "Drowning pressure and divided loyalty." }],
    ["outcomes", { victory: "The party silences the bell.", failure: "The flood reaches the lower district." }]
  ];
  for (const [section, values] of packetSections) {
    const beforeRevision = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.revision");
    const packetSubmit = await evaluate(`(() => { const form = document.querySelector('[data-packet-form="${section}"]'); const values = ${JSON.stringify(values)}; for (const [name, value] of Object.entries(values)) form.elements[name].value = value; form.requestSubmit(); return { found: Boolean(form), submitted: true, revision: globalThis.sidekickDM.engine.snapshot.encounter.revision, notice: document.querySelector('[data-testid=notice]')?.textContent }; })()`);
    if (!packetSubmit?.submitted || packetSubmit.revision !== beforeRevision + 1) throw new Error(`Packet ${section} submit failed: ${JSON.stringify(packetSubmit)} (expected revision ${beforeRevision + 1})`);
    await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.revision"), beforeRevision + 1);
  }
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=readiness]').textContent.trim()"), "ready_with_warnings");
  const exported = await evaluate("(() => { const raw = globalThis.sidekickDM.actions.exportEncounter(); const print = globalThis.sidekickDM.actions.printEncounter(); return { raw, print }; })()");
  const exportedRoot = JSON.parse(exported.raw);
  const exportedEncounter = exportedRoot.data?.encounter;
  if (exportedRoot.format !== "sidekickdm" || exportedEncounter?.participant_groups?.length < 3 || exportedEncounter?.hazards?.length !== 1 || exportedEncounter?.phases?.length !== 2 || exportedRoot.data?.embedded_components?.npc_profiles?.length !== 1) throw new Error("Manual acceptance export did not include the complete P0 Encounter.");
  if (exportedEncounter.budget !== undefined || exportedEncounter.readiness !== undefined) throw new Error("Encounter export leaked derived budget or readiness values.");
  if (!exported.print.includes("Component mechanics") || !exported.print.includes("Notices and provenance")) throw new Error("Manual acceptance print projection is missing runnable sections or rights notices.");
  const portableRaw = exported.raw;
  const selfContainedImport = await evaluate(`(async () => { try { const { importEncounterFile } = await import("./src/encounter-file.js"); const imported = importEncounterFile(${JSON.stringify(portableRaw)}, { existingIDs: [] }); return { groups: imported.draft.participantGroups?.length, hazards: imported.draft.hazards?.length, phases: imported.draft.phases?.length, creatures: imported.components.creatures?.length, npcProfiles: imported.components.npcProfiles?.length, customHazards: imported.draft.customHazards?.length }; } catch (error) { const root = JSON.parse(${JSON.stringify(portableRaw)}); const encounter = root.data.encounter; return { error: error.message, stack: error.stack, code: error.code, details: error.details, placedIDs: [encounter, ...(encounter.participant_groups ?? []), ...(encounter.hazards ?? []), ...(encounter.phases ?? [])].map(item => item.id), embeddedIDs: Object.values(root.data.embedded_components).flat().map(item => item.id) }; } })()`);
  if (selfContainedImport?.groups !== 3 || selfContainedImport?.hazards !== 1 || selfContainedImport?.phases !== 2 || selfContainedImport?.creatures !== 2 || selfContainedImport?.npcProfiles !== 1 || selfContainedImport?.customHazards !== 1) throw new Error(`Self-contained Encounter import was incomplete: ${JSON.stringify(selfContainedImport)}`);
  const encounterPath = join(transferData, "encounter.sidekickdm.json");
  writeFileSync(encounterPath, portableRaw, "utf8");
  const importEngineCheck = await evaluate(`(async () => { const { importEncounterFile } = await import("./src/encounter-file.js"); const imported = importEncounterFile(${JSON.stringify(portableRaw)}, { existingIDs: [] }); return globalThis.sidekickDM.engine.execute({ command: "sidekick_load_draft", draft_json: JSON.stringify(imported.draft), origin: "acceptance-check" }); })()`);
  if (!importEngineCheck?.ok) throw new Error(`Portable import could not reload into the engine: ${JSON.stringify(importEngineCheck)}`);
  await setFileInput('[data-action="import-encounter"]', encounterPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.startsWith("Encounter imported"), true).catch(async error => { throw new Error(`${error.message} Notice: ${await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()")}`); });
  await evaluate("document.querySelector('[data-action=import-encounter]').value = ''");
  await setFileInput('[data-action="import-encounter"]', encounterPath);
  await waitFor(async () => { const notice = await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"); return Boolean(notice?.includes("remapped ID(s)")); }, true).catch(async error => { throw new Error(`${error.message} Notice: ${await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()")}`); });
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups?.length"), 3);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards?.length"), 1);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.phases?.length"), 2);
  const uiPrintOpened = await evaluate("(() => { const previous = globalThis.open; let opened = false; globalThis.open = () => ({ addEventListener() { opened = true; } }); document.querySelector('[data-action=print-encounter]').click(); globalThis.open = previous; return opened; })()");
  if (!uiPrintOpened) throw new Error("Print Packet control did not open a print projection.");
  const encounterZipPath = join(transferData, "encounter.sidekickdm.zip");
  writeFileSync(encounterZipPath, createSidekickDMZip({ manifest: portableRaw }));
  await setFileInput('[data-action="import-encounter-zip"]', encounterZipPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.startsWith("Encounter ZIP imported"), true);
  const persistedZipImport = await evaluate(`(async () => { const db = await new Promise((resolve, reject) => { const request = indexedDB.open("sidekick-dm", 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); return await new Promise((resolve, reject) => { const request = db.transaction(["encounters"], "readonly").objectStore("encounters").get("current"); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); })()`);
  const zipEngineID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.id");
  if (!persistedZipImport || persistedZipImport.id !== zipEngineID) throw new Error("Accepted Encounter ZIP was not persisted under the current key after native engine acceptance.");
  await evaluate("document.querySelector('[data-action=import-encounter-zip]').value = ''");
  const invalidArchiveRoot = JSON.parse(portableRaw);
  invalidArchiveRoot.data.encounter.brief.party.effective_level = "not-an-integer";
  const invalidEncounterZipPath = join(transferData, "invalid-encounter.sidekickdm.zip");
  writeFileSync(invalidEncounterZipPath, createSidekickDMZip({ manifest: JSON.stringify(invalidArchiveRoot) }));
  await setFileInput('[data-action="import-encounter-zip"]', invalidEncounterZipPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.includes("invalid"), true);
  const rejectedZipImport = await evaluate(`(async () => { const db = await new Promise((resolve, reject) => { const request = indexedDB.open("sidekick-dm", 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); return await new Promise((resolve, reject) => { const request = db.transaction(["encounters"], "readonly").objectStore("encounters").get("current"); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); })()`);
  const rejectedZipEngineID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.id");
  if (!rejectedZipImport || rejectedZipImport.id !== zipEngineID || rejectedZipEngineID !== zipEngineID) throw new Error("Rejected Encounter ZIP changed the native engine or current IndexedDB record before acceptance.");
  const componentsRaw = await evaluate(`(async () => { const { createComponentsFile } = await import("./src/encounter-file.js"); const draft = globalThis.sidekickDM.engine.snapshot.encounter; const db = await new Promise((resolve, reject) => { const request = indexedDB.open("sidekick-dm", 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); const tx = db.transaction(["npc_profiles"], "readonly"); const profiles = await new Promise((resolve, reject) => { const request = tx.objectStore("npc_profiles").getAll(); request.onsuccess = () => resolve(request.result ?? []); request.onerror = () => reject(request.error); }); return createComponentsFile({ components: { creatures: draft.originalCreatures ?? [], npcProfiles: profiles, hazards: draft.customHazards ?? [] } }); })()`);
  const componentsPath = join(transferData, "components.sidekickdm.json");
  writeFileSync(componentsPath, componentsRaw, "utf8");
  await setFileInput('[data-action="import-components"]', componentsPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.startsWith("Components imported"), true);
  const componentsZipPath = join(transferData, "components.sidekickdm.zip");
  writeFileSync(componentsZipPath, createSidekickDMZip({ manifest: componentsRaw }));
  await setFileInput('[data-action="import-components-zip"]', componentsZipPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.startsWith("Components ZIP imported"), true);
  await evaluate("document.querySelector('[data-action=import-components]').value = ''");
  await setFileInput('[data-action="import-components"]', componentsPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.includes("remapped ID(s)"), true);
  const libraryRaw = await evaluate(`(async () => { const { createLibraryFile } = await import("./src/encounter-file.js"); const db = await new Promise((resolve, reject) => { const request = indexedDB.open("sidekick-dm", 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); const names = ["encounters", "creatures", "npc_profiles", "hazards"]; const tx = db.transaction(names, "readonly"); const getAll = name => new Promise((resolve, reject) => { const request = tx.objectStore(name).getAll(); request.onsuccess = () => resolve(request.result ?? []); request.onerror = () => reject(request.error); }); const [encounters, creatures, npcProfiles, hazards] = await Promise.all(names.map(getAll)); const unique = records => [...new Map(records.filter(record => record?.id).map(record => [record.id, record])).values()]; return createLibraryFile({ library: { encounters: unique(encounters), creatures: unique(creatures), npcProfiles: unique(npcProfiles), hazards: unique(hazards) } }); })()`);
  const libraryPath = join(transferData, "library.sidekickdm.json");
  writeFileSync(libraryPath, libraryRaw, "utf8");
  await setFileInput('[data-action="import-library"]', libraryPath);
  await waitFor(async () => {
    const notice = await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()");
    if (notice?.startsWith("Library imported")) return true;
    if (notice && !notice.startsWith("Components imported")) {
      const duplicateID = notice.match(/^Duplicate local ID (.+)\.$/)?.[1];
      const occurrences = [];
      const visit = (value, path = "$") => {
        if (!value || typeof value !== "object") return;
        if (value.id === duplicateID) occurrences.push({ path, value });
        if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${index}]`));
        else Object.entries(value).forEach(([key, item]) => visit(item, `${path}.${key}`));
      };
      if (duplicateID) visit(JSON.parse(libraryRaw));
      throw new Error(`Library import failed: ${notice}${occurrences.length ? ` ${JSON.stringify(occurrences)}` : ""}`);
    }
    return false;
  }, true);
  const libraryZipPath = join(transferData, "library.sidekickdm.zip");
  writeFileSync(libraryZipPath, createSidekickDMZip({ manifest: libraryRaw }));
  await setFileInput('[data-action="import-library-zip"]', libraryZipPath);
  await waitFor(async () => (await evaluate("document.querySelector('[data-testid=notice]')?.textContent.trim()"))?.startsWith("Library ZIP imported"), true);
  const transferredCounts = await evaluate(`(async () => { const db = await new Promise((resolve, reject) => { const request = indexedDB.open("sidekick-dm", 3); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); const names = ["encounters", "creatures", "npc_profiles", "hazards"]; const counts = {}; const tx = db.transaction(names, "readonly"); await Promise.all(names.map(name => new Promise((resolve, reject) => { const request = tx.objectStore(name).count(); request.onsuccess = () => { counts[name] = request.result; resolve(); }; request.onerror = () => reject(request.error); }))); return counts; })()`);
  if ((transferredCounts?.creatures ?? 0) < 1 || (transferredCounts?.npc_profiles ?? 0) < 1 || (transferredCounts?.hazards ?? 0) < 1 || (transferredCounts?.encounters ?? 0) < 1) throw new Error(`Component/library transfer did not persist records: ${JSON.stringify(transferredCounts)}`);

  const runCall = (tool, fields = {}) => evaluate(`(async () => { const snapshot = globalThis.sidekickDM.engine.snapshot; return globalThis.sidekickDM.webMCP.execute(${JSON.stringify(tool)}, ${JSON.stringify(fields)}); })()`);
  const runCallWithRevision = (tool, fields = {}) => evaluate(`(async () => { const snapshot = globalThis.sidekickDM.engine.snapshot; return globalThis.sidekickDM.webMCP.execute(${JSON.stringify(tool)}, { ...${JSON.stringify(fields)}, encounter_id: snapshot.encounter.id, generation_run_id: snapshot.generationRunID, expected_encounter_revision: snapshot.encounter.revision, expected_constraints_revision: snapshot.constraintsRevision ?? snapshot.encounter.constraintsRevision ?? 0 }); })()`);
  const generationOpening = await evaluate("structuredClone(globalThis.sidekickDM.engine.snapshot.encounter)");
  const generationStart = await evaluate(`(async () => {
    const snapshot = globalThis.sidekickDM.engine.snapshot;
    return globalThis.sidekickDM.webMCP.execute("sidekickdm_begin_generation", {
      encounter_id: snapshot.encounter.id,
      expected_encounter_revision: snapshot.encounter.revision,
      expected_brief_revision: snapshot.briefRevision ?? snapshot.encounter.briefRevision ?? 0,
      expected_constraints_revision: snapshot.constraintsRevision ?? snapshot.encounter.constraintsRevision ?? 0,
      content_boundaries_acknowledged: true,
      intent_summary: "Verify the complete Encounter Run lifecycle."
    });
  })()`);
  if (!generationStart?.ok || !generationStart.generation_run_id) throw new Error(`WebMCP Generation Run did not begin: ${JSON.stringify(generationStart)}`);

  const participantMutation = await runCallWithRevision("sidekickdm_add_existing_participant_group", {
    content_id: "creature/monster-core/goblin-warrior/current",
    quantity: 1,
    adjustment: "normal",
    faction: "secondary_opposition",
    participation: { mode: "reinforcement" },
    encounter_role: "skirmisher",
    starting_area: "North stair",
    shared_tactics: "Harass isolated targets.",
    morale: "Withdraw when the captain falls."
  });
  if (!participantMutation?.ok) throw new Error(`WebMCP Generation Run participant mutation failed: ${JSON.stringify(participantMutation)}`);
  const generationParticipantID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.at(-1).id");

  const generationHazard = await evaluate(`(() => { const source = globalThis.sidekickDM.engine.snapshot.encounter.customHazards?.[0]; if (!source) return null; const hazard = structuredClone(source); hazard.id = "generation_hazard"; hazard.identity = { ...(hazard.identity ?? {}), name: "Generation Run Snare" }; return hazard; })()`);
  if (!generationHazard) throw new Error("The acceptance encounter did not contain a reusable custom Hazard for the Generation Run.");
  const hazardMutation = await runCallWithRevision("sidekickdm_create_simple_hazard", { hazard: generationHazard, participation_mode: "conditional", participation_condition: "When the bell tolls.", placement: "South arch" });
  if (!hazardMutation?.ok) throw new Error(`WebMCP Generation Run Hazard mutation failed: ${JSON.stringify(hazardMutation)}`);
  const generationHazardID = generationHazard.id;

  const phaseMutation = await runCallWithRevision("sidekickdm_upsert_phase", {
    phase: {
      id: "generation_phase",
      title: "Generation Run Phase",
      order: 99,
      trigger: { kind: "round", explanation: "At the start of the third round.", canOverlap: true },
      participantIDs: [generationParticipantID],
      hazardIDs: [generationHazardID],
      terrainChanges: [{ title: "Collapsed arch", description: "The southern arch collapses.", affectedArea: "South arch" }],
      runningGuidance: "The reinforcement drives targets toward the snare.",
      terrainAdjustment: 0
    }
  });
  if (!phaseMutation?.ok) throw new Error(`WebMCP Generation Run Phase mutation failed: ${JSON.stringify(phaseMutation)}`);

  const packetMutation = await runCallWithRevision("sidekickdm_set_encounter_identity", {
    value: { ...(await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.packetV1?.identity ?? {}")), title: "The Bell Beneath Blackwater · Generated" }
  });
  if (!packetMutation?.ok) throw new Error(`WebMCP Generation Run Packet mutation failed: ${JSON.stringify(packetMutation)}`);
  const mutatedGenerationState = await evaluate("structuredClone(globalThis.sidekickDM.engine.snapshot.encounter)");
  const generationCounts = await evaluate("({ participants: globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.length, hazards: globalThis.sidekickDM.engine.snapshot.encounter.hazards.length, phases: (globalThis.sidekickDM.engine.snapshot.encounter.structuredPhases ?? globalThis.sidekickDM.engine.snapshot.encounter.phases ?? []).length, title: globalThis.sidekickDM.engine.snapshot.encounter.title })");
  if (generationCounts.participants !== generationOpening.participantGroups.length + 1 || generationCounts.hazards !== generationOpening.hazards.length + 1 || generationCounts.phases !== (generationOpening.structuredPhases ?? generationOpening.phases ?? []).length + 1 || generationCounts.title !== "The Bell Beneath Blackwater · Generated") throw new Error(`Generation Run mutations did not produce the complete non-empty state: ${JSON.stringify(generationCounts)}`);

  const generationFinish = await evaluate(`(async () => {
    const snapshot = globalThis.sidekickDM.engine.snapshot;
    return globalThis.sidekickDM.webMCP.execute("sidekickdm_finish_generation", {
      encounter_id: snapshot.encounter.id,
      generation_run_id: snapshot.generationRunID,
      expected_encounter_revision: snapshot.encounter.revision,
      expected_constraints_revision: snapshot.constraintsRevision ?? snapshot.encounter.constraintsRevision ?? 0,
      completion_note: "Browser acceptance run finished."
    });
  })()`);
  if (!generationFinish?.ok || generationFinish.generation_run_id) throw new Error(`WebMCP Generation Run did not finish: ${JSON.stringify(generationFinish)}`);
  const finishedGenerationState = await evaluate("structuredClone(globalThis.sidekickDM.engine.snapshot.encounter)");
  const targetedTitle = "The Bell Beneath Blackwater · Targeted Revision";
  const targeted = await evaluate(`(async () => {
    const snapshot = globalThis.sidekickDM.engine.snapshot;
    const identity = { ...(snapshot.encounter.packetV1?.identity ?? snapshot.encounter.packet_v1?.identity ?? {}), title: ${JSON.stringify(targetedTitle)} };
    return globalThis.sidekickDM.webMCP.execute("sidekickdm_apply_targeted_revision", {
      encounter_id: snapshot.encounter.id,
      expected_encounter_revision: snapshot.encounter.revision,
      section: "encounter_identity",
      value: identity
    });
  })()`);
  if (!targeted?.ok || targeted.data?.encounter?.title !== targetedTitle) throw new Error(`WebMCP targeted revision did not apply: ${JSON.stringify(targeted)}`);
  const comparableEncounter = (encounter) => {
    const value = structuredClone(encounter);
    delete value.revision;
    delete value.generation;
    if (value.provenance) { delete value.provenance.origin; delete value.provenance.lastMutationOrigin; }
    return value;
  };
  const undoTargeted = await evaluate(`(async () => { const snapshot = globalThis.sidekickDM.engine.snapshot; return globalThis.sidekickDM.webMCP.execute("sidekickdm_undo", { encounter_id: snapshot.encounter.id, expected_encounter_revision: snapshot.encounter.revision }); })()`);
  if (!undoTargeted?.ok || undoTargeted.data?.encounter?.title === targetedTitle) throw new Error("WebMCP targeted revision was not independently undoable.");
  const afterTargetedUndo = await evaluate("structuredClone(globalThis.sidekickDM.engine.snapshot.encounter)");
  if (JSON.stringify(comparableEncounter(afterTargetedUndo)) !== JSON.stringify(comparableEncounter(finishedGenerationState))) throw new Error("WebMCP targeted Undo did not restore the exact finished Generation Run state.");
  const undoRun = await evaluate(`(async () => { const snapshot = globalThis.sidekickDM.engine.snapshot; return globalThis.sidekickDM.webMCP.execute("sidekickdm_undo", { encounter_id: snapshot.encounter.id, expected_encounter_revision: snapshot.encounter.revision }); })()`);
  if (!undoRun?.ok || undoRun.data?.encounter?.title === targetedTitle) throw new Error("WebMCP whole-run rollback did not complete after the targeted revision rollback.");
  const afterWholeRunUndo = await evaluate("structuredClone(globalThis.sidekickDM.engine.snapshot.encounter)");
  if (JSON.stringify(comparableEncounter(afterWholeRunUndo)) !== JSON.stringify(comparableEncounter(generationOpening))) throw new Error("WebMCP whole-run Undo did not restore the exact opening Encounter state.");
  const renderedPrint = await evaluate("globalThis.sidekickDM.actions.printEncounter()");
  if (typeof renderedPrint !== "string" || !renderedPrint.includes("data-print-packet=\"1\"") || !renderedPrint.includes("print-running-header") || !renderedPrint.includes("Notices and provenance")) throw new Error("Print Packet HTML did not contain the runnable packet, repeated header, and notice sections.");
  const frameTree = await command("Page.getFrameTree");
  await command("Page.setDocumentContent", { frameId: frameTree.frameTree.frame.id, html: renderedPrint });
  await waitFor(async () => await evaluate("document.querySelectorAll('[data-print-section]').length"), 6);
  await command("Emulation.setEmulatedMedia", { media: "print" });
  const renderedPrintState = await evaluate("({ sections: document.querySelectorAll('[data-print-section]').length, header: Boolean(document.querySelector('.print-running-header')), notices: document.querySelector('.print-notices')?.textContent.includes('ORC License'), headerDisplay: getComputedStyle(document.querySelector('.print-running-header')).display })");
  if (renderedPrintState.sections !== 6 || !renderedPrintState.header || !renderedPrintState.notices || renderedPrintState.headerDisplay === "none") throw new Error(`Rendered print projection did not apply its print stylesheet: ${JSON.stringify(renderedPrintState)}`);
  const pdf = await command("Page.printToPDF", { printBackground: true, preferCSSPageSize: true });
  const pdfBytes = Buffer.from(pdf.data ?? "", "base64");
  if (pdfBytes.length < 1000 || pdfBytes.subarray(0, 5).toString() !== "%PDF-") throw new Error(`Chrome print-to-PDF did not produce a valid PDF (${pdfBytes.length} bytes).`);
  writeFileSync(join(transferData, "encounter-print.pdf"), pdfBytes);
  await command("Emulation.setEmulatedMedia", { media: "screen" });
  await command("Page.reload");
  await waitFor(async () => await evaluate("document.readyState"), "complete");
  await waitFor(async () => await evaluate("Boolean(globalThis.sidekickDM?.engine?.snapshot?.encounter)"), true);
  await waitFor(async () => await evaluate("Boolean(globalThis.sidekickDM?.engine?.snapshot?.encounter?.participantGroups?.some(group => group.name === 'Mire Scout'))"), true);
  const importedOriginalParticipantID = await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.participantGroups.find(group => group.name === 'Mire Scout')?.id");
  await waitFor(async () => await evaluate(`document.querySelector('[data-testid=participant-${importedOriginalParticipantID}]')?.textContent.includes('Mire Scout')`), true);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.hazards.length"), 1);
  await waitFor(async () => await evaluate("document.querySelector('[data-library-select=npcProfiles]') !== null"), true);
  await waitFor(async () => await evaluate("globalThis.sidekickDM.engine.snapshot.encounter.phases?.length"), 2);
  await waitFor(async () => await evaluate("document.querySelector('[data-testid=readiness]').textContent.trim()"), "ready_with_warnings");
  const unexpectedRequests = unexpectedStaticRequests();
  if (unexpectedRequests.length) throw new Error(`Static-only runtime made unexpected network request(s): ${unexpectedRequests.join(", ")}`);
  console.log("Chromium browser smoke passed: PF2 budget, Catalog, builders, NPC, Phase, ready Packet, print/export, WebMCP Generation Run + targeted/whole-run rollback, history, IndexedDB reload, and static-only runtime succeeded.");
} finally {
  socket?.close();
  browser.kill("SIGTERM");
  await waitForExit(browser, 3_000);
  server.close();
  rmSync(userData, { recursive: true, force: true });
  rmSync(transferData, { recursive: true, force: true });
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
  let lastValue;
  while (Date.now() < deadline) {
    const value = await read();
    lastValue = value;
    if (expected === undefined ? value : value === expected) return value;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expected ?? "the browser target"}; last value was ${JSON.stringify(lastValue)}.`);
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
