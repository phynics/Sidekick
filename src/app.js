import { loadBootAssets } from "./boot.js";
import { loadCatalog } from "./catalog-index.js";
import { createCreatureBuilder, createEmptyOriginalCreature } from "./creature-builder.js";
import { createHazardBuilder, createEmptySimpleHazard } from "./hazard-builder.js";
import { createEncounterPacketEditor, createEmptyPacket } from "./encounter-packet.js";
import { createWebMCPAdapter } from "./webmcp-adapter.js";
import { createNPCProfileEditor, createEmptyNPCProfile } from "./npc-profile.js";
import { createEncounterPhaseEditor, createEmptyPhase } from "./encounter-phases.js";
import { createEncounterFile, importEncounterFile } from "./encounter-file.js";
import { createEncounterPrintProjection, renderEncounterPrintProjection } from "./print-packet.js";

const app = document.querySelector("#app");
const STORAGE_DB = "sidekick-dm";
const STORAGE_STORE = "encounters";
const uiState = { creature: null, hazard: null, packet: null, npc: null, npcTarget: null, phase: null, webMCPStatus: "WebMCP unavailable in this browser" };
globalThis.sidekickBridge = Object.freeze({ notifySwiftValue(value) { return `JavaScript bridge received Swift value ${value}.`; } });

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function openStore() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => { const request = indexedDB.open(STORAGE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORAGE_STORE); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function loadRecord(key) { try { const db = await openStore(); if (!db) return null; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE).objectStore(STORAGE_STORE).get(key); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); } catch { return null; } }
async function saveRecord(key, value) { try { const db = await openStore(); if (!db) return false; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE, "readwrite").objectStore(STORAGE_STORE).put(value, key); request.onsuccess = () => resolve(true); request.onerror = () => reject(request.error); }); } catch { return false; } }
async function loadSavedDraft() { return loadRecord("current"); }
async function saveDraft(draft) { return saveRecord("current", draft); }

function encounterJSON(engine) {
  const draft = engine.snapshot.encounter ?? engine.snapshot.draft;
  return createEncounterFile({ encounter: draft, licenseNotices: ["Unofficial Sidekick DM encounter data.", "Catalog rules data is provided under the ORC License where applicable."] });
}

function encounterPrintHTML(engine) {
  return renderEncounterPrintProjection(createEncounterPrintProjection(engine.snapshot));
}

function downloadText(filename, contents, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function openPrintPreview(engine) {
  const url = URL.createObjectURL(new Blob([encounterPrintHTML(engine)], { type: "text/html" }));
  const preview = globalThis.open(url, "sidekickdm-print");
  if (preview) preview.addEventListener("load", () => preview.print(), { once: true });
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function issue(engine, command, { persist = true } = {}) {
  const result = engine.execute(command);
  if (result?.ok && persist) void saveDraft(result.snapshot.encounter ?? result.snapshot.draft);
  return result;
}

function budgetMarkup(budget) {
  const values = [
    ["Base target", `${budget.baseTargetXP} XP`, "base-target"], ["Construction Budget", `${budget.constructionBudget} XP`, "construction-budget"],
    ["Base XP Award", `${budget.baseXPAward} XP`, "base-xp-award"], ["Guaranteed", `${budget.guaranteedXP} XP`, "guaranteed-xp"],
    ["Avoidable Hazards", `${budget.avoidableXP} XP`, "avoidable-xp"], ["Conditional", `${budget.conditionalXP} XP`, "conditional-xp"],
    ["Peak Active", `${budget.peakActiveXP} XP`, "peak-active-xp"], ["Total Encounter", `${budget.totalEncounterXP} XP`, "total-encounter-xp"]
  ];
  return values.map(([label, value, id]) => `<div class="metric"><span>${label}</span><strong data-testid="${id}">${value}</strong></div>`).join("");
}

function npcProfileForCore(profile) {
  return {
    id: profile.id,
    object_version: profile.objectVersion ?? 1,
    revision: profile.revision ?? 0,
    participant_group_id: profile.participantGroupID,
    tier: profile.tier ?? profile.narrativeTier ?? "incidental",
    name: profile.name ?? "",
    encounter_purpose: profile.encounterPurpose ?? "",
    appearance_hook: profile.appearanceHook ?? null,
    voice_manner: profile.voiceManner ?? null,
    immediate_goal: profile.immediateGoal ?? "",
    deeper_motivation: profile.deeperMotivation ?? null,
    fear: profile.fear ?? null,
    leverage: profile.leverage ?? null,
    knowledge: profile.knowledge ?? [],
    attitude: profile.attitude ?? null,
    combat_objective: profile.combatObjective ?? null,
    morale_exit: profile.moraleExit ?? "",
    peaceful_response: profile.peacefulResponse ?? null,
    future_consequence: profile.futureConsequence ?? null,
    provenance: profile.provenance ?? { origin: "original", basedOnProfileID: null, source: null, createdAt: "", lastMutationOrigin: "gm" }
  };
}

function render({ asset, engine, catalog, catalogState = { query: "", results: null }, bridgeMessage = "", notice = "" }) {
  if (!engine.available) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not start</h1><p>${escapeHtml(engine.reason)}</p></section>`; return; }
  const snapshot = engine.snapshot; const draft = snapshot.encounter ?? snapshot.draft; const party = draft.brief?.party ?? { effectiveLevel: 1, size: 4 }; const target = draft.brief?.threatTarget ?? { kind: "moderate", customXP: null }; const budget = snapshot.budget ?? { baseTargetXP: 80, constructionBudget: 80, baseXPAward: 80, guaranteedXP: 0, avoidableXP: 0, conditionalXP: 0, peakActiveXP: 0, totalEncounterXP: 0, inferredThreat: "trivial", warnings: [] };
  const participants = (draft.participantGroups ?? []).map((group) => `<li data-testid="participant-${escapeHtml(group.id)}"><strong>${escapeHtml(group.quantity)} × ${escapeHtml(group.name)}</strong><span>Level ${group.level} · ${escapeHtml(group.participation?.mode ?? "mandatory")}</span>${String(group.contentID ?? "").startsWith("creature/") && !String(group.contentID).startsWith("creature/custom/") ? `<label>Quantity<input data-catalog-component="${escapeHtml(group.id)}" data-catalog-field="quantity" type="number" min="1" value="${group.quantity}"></label><label>Adjustment<select data-catalog-component="${escapeHtml(group.id)}" data-catalog-field="adjustment">${["normal", "weak", "elite"].map((value) => `<option value="${value}" ${group.adjustment === value ? "selected" : ""}>${value}</option>`).join("")}</select></label>` : ""}</li>`).join("");
  const hazards = (draft.hazards ?? []).map((hazard) => `<li data-testid="hazard-${escapeHtml(hazard.id)}"><strong>${escapeHtml(hazard.name)}</strong><span>Level ${hazard.level} · ${escapeHtml(hazard.complexity)} · ${escapeHtml(hazard.participation?.mode ?? "avoidable")}</span></li>`).join("");
  const authoredPhases = draft.structuredPhases ?? draft.phases ?? [];
  const phases = authoredPhases.map((phase) => `<li data-testid="phase-${escapeHtml(phase.id)}"><strong>${escapeHtml(phase.title)}</strong><span>${escapeHtml(phase.trigger?.explanation ?? phase.trigger ?? "No trigger")} · ${(phase.participantIDs ?? []).length} participant group(s) · ${(phase.hazardIDs ?? []).length} Hazard(s)</span></li>`).join("");
  const activities = (snapshot.activity ?? []).slice(0, 6).map((entry) => `<li><span>${escapeHtml(entry.description)}</span><small>${escapeHtml(entry.origin)} · rev ${entry.afterRevision}</small></li>`).join("");
  const catalogResults = catalogState.results ?? catalog?.search({ kind: "creature", query: catalogState.query });
  const catalogMarkup = catalogResults?.results?.map((entry) => `<li><div><strong>${escapeHtml(entry.name)}</strong><span>Level ${entry.level} · ${escapeHtml(entry.source)}</span><small>${escapeHtml(entry.summary)}</small></div><button type="button" data-catalog-add="${escapeHtml(entry.content_id)}">Add</button></li>`).join("") ?? "";
  const npcTarget = (draft.participantGroups ?? []).some((group) => group.id === uiState.npcTarget) ? uiState.npcTarget : draft.participantGroups?.[0]?.id ?? null;
  uiState.npcTarget = npcTarget;
  const npcOptions = (draft.participantGroups ?? []).map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === npcTarget ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
  app.innerHTML = `
    <main class="shell">
      <header class="topbar"><div><p class="eyebrow">Sidekick DM · Encounter Builder</p><h1>${escapeHtml(draft.title)}</h1></div><div class="revision">Encounter Revision <strong data-testid="encounter-revision">${draft.revision}</strong></div></header>
      <div class="columns">
      <section class="panel brief-panel"><h2>Party Snapshot</h2>
          <label>Effective Party Level<input data-testid="party-level" data-field="effective_level" type="number" min="1" max="20" value="${party.effectiveLevel}"></label>
          <label>Party Size<input data-testid="party-size" data-field="size" type="number" min="1" max="8" value="${party.size}"></label>
          <label>Threat Target<select data-testid="threat-target" data-field="threat">${["trivial","low","moderate","severe","extreme","custom"].map((kind) => `<option value="${kind}" ${target.kind === kind ? "selected" : ""}>${kind[0].toUpperCase() + kind.slice(1)}</option>`).join("")}</select></label>
          <label data-testid="custom-xp-field" class="${target.kind === "custom" ? "" : "hidden"}">Custom XP<input data-testid="custom-xp" data-field="custom_xp" type="number" min="0" value="${target.customXP ?? 0}"></label>
          <div class="budget"><h3>Authoritative budget</h3>${budgetMarkup(budget)}<p class="inferred">Inferred threat: <strong data-testid="inferred-threat">${escapeHtml(budget.inferredThreat)}</strong></p>${budget.warnings.map((warning) => `<p class="warning">${escapeHtml(warning)}</p>`).join("")}</div>
        </section>
        <section class="panel encounter-panel"><div class="panel-heading"><h2>Encounter Draft</h2><span class="badge" data-testid="readiness">${escapeHtml(snapshot.readiness?.status ?? "incomplete")}</span></div>
          <label>Encounter title<input data-testid="encounter-title" data-field="title" value="${escapeHtml(draft.title)}"></label>
          <h3>Participants</h3><ul class="participants">${participants || "<li class=empty>No participants yet. Add one to see PF2 XP math.</li>"}</ul>
          <h3>Hazards</h3><ul class="participants">${hazards || "<li class=empty>No Hazards placed.</li>"}</ul>
          <h3>Phases</h3><ul class="participants">${phases || "<li class=empty>No Phases authored.</li>"}</ul>
          <section class="catalog-panel"><h3>Existing Creatures</h3><form data-action="search-catalog" class="add-form"><input name="query" value="${escapeHtml(catalogState.query)}" placeholder="Search the curated Catalog"><button type="submit">Search</button></form><p>${catalogResults?.total ?? 0} supported result(s)</p><ul class="catalog-results">${catalogMarkup || "<li class=empty>No matching supported creatures.</li>"}</ul></section>
          <details class="builder-panel"><summary>Create an Original Creature</summary><div id="creature-builder-root"></div></details>
          <details class="builder-panel"><summary>Create a Simple Hazard</summary><div id="hazard-builder-root"></div></details>
          <details class="builder-panel"><summary>Author the Encounter Packet</summary><div id="encounter-packet-root"></div></details>
          <details class="builder-panel"><summary>Attach an NPC Profile</summary>${npcTarget ? `<label>Participant Group<select data-action="npc-target">${npcOptions}</select></label><div id="npc-profile-root"></div>` : "<p>Add a participant before attaching an NPC Profile.</p>"}</details>
          <details class="builder-panel"><summary>Stage an Encounter Phase</summary><div id="encounter-phase-root"></div></details>
          <form data-action="add-participant" class="add-form"><input name="name" placeholder="Creature name" required><input name="level" type="number" value="${party.effectiveLevel}" aria-label="Creature level"><input name="quantity" type="number" min="1" value="1" aria-label="Quantity"><button type="submit">Add participant</button></form>
          <div class="controls"><button type="button" data-action="undo" ${snapshot.canUndo ? "" : "disabled"}>Undo</button><button type="button" data-action="redo" ${snapshot.canRedo ? "" : "disabled"}>Redo</button><button type="button" data-action="export-encounter">Export Encounter</button><label class="file-control">Import Encounter<input type="file" accept="application/json,.json" data-action="import-encounter"></label><button type="button" data-action="print-encounter">Print Packet</button><button type="button" data-action="increment" class="legacy-control">Change Swift state</button></div><span class="sr-only">Swift-owned value <span data-testid="swift-value">${draft.swiftOwnedValue}</span></span>
          <p class="status" data-testid="notice">${escapeHtml(notice || "Ready for a semantic mutation.")}</p>
        </section>
        <aside class="panel activity-panel"><h2>Activity</h2><ul>${activities || "<li class=empty>No mutations yet.</li>"}</ul><p class="status" data-testid="asset-status">${escapeHtml(asset.asset_message)}</p><p class="status" data-testid="bridge-status">${escapeHtml(bridgeMessage || "JavaScript bridge waiting.")}</p><p class="status" data-testid="webmcp-status">${escapeHtml(uiState.webMCPStatus)}</p></aside>
      </div>
    </main>`;

  const mutate = (command, message = "Saved") => { const result = issue(engine, { ...command, expected_revision: draft.revision, origin: "gm" }); if (!result.ok) { render({ asset, engine: { ...engine, snapshot: result.snapshot }, catalog, catalogState, notice: result.error?.message }); return; } engine.snapshot = result.snapshot; render({ asset, engine, catalog, catalogState, notice: message }); };
  app.querySelectorAll("[data-field]").forEach((field) => field.addEventListener("change", () => {
    const key = field.dataset.field;
    if (key === "effective_level" || key === "size") mutate({ command: "sidekickdm_set_party_snapshot", effective_level: Number(app.querySelector('[data-field="effective_level"]').value), size: Number(app.querySelector('[data-field="size"]').value) }, "Party Snapshot saved");
    else if (key === "threat") mutate({ command: "sidekickdm_set_threat_target", kind: field.value, custom_xp: Number(app.querySelector('[data-testid="custom-xp"]')?.value ?? 0) }, "Threat Target saved");
    else if (key === "custom_xp") mutate({ command: "sidekickdm_set_threat_target", kind: "custom", custom_xp: Number(field.value) }, "Custom Threat Target saved");
    else if (key === "title") mutate({ command: "sidekickdm_set_encounter_identity", title: field.value }, "Encounter identity saved");
  }));
  app.querySelector('[data-action="add-participant"]').addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutate({ command: "sidekickdm_add_participant_group", name: form.get("name"), level: Number(form.get("level")), quantity: Number(form.get("quantity")), content_id: `creature/custom/${String(form.get("name")).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}/current`, participation_mode: "mandatory" }, "Participant added"); });
  app.querySelector('[data-action="search-catalog"]').addEventListener("submit", (event) => { event.preventDefault(); const query = String(new FormData(event.currentTarget).get("query") ?? ""); render({ asset, engine, catalog, catalogState: { query, results: catalog.search({ query, kind: "creature" }) }, notice: "Catalog search updated" }); });
  app.querySelectorAll("[data-catalog-add]").forEach((button) => button.addEventListener("click", () => { const prepared = catalog.addExistingCreatureCommand(button.dataset.catalogAdd); if (!prepared.ok) return render({ asset, engine, catalog, catalogState, notice: prepared.error.message }); mutate(prepared.command, `${prepared.entry.name} added from Catalog`); }));
  app.querySelectorAll("[data-catalog-component]").forEach((field) => field.addEventListener("change", () => { const prepared = catalog.updateParticipantCommand(field.dataset.catalogComponent, { [field.dataset.catalogField]: field.dataset.catalogField === "quantity" ? Number(field.value) : field.value }); if (!prepared.ok) return render({ asset, engine, catalog, catalogState, notice: prepared.error.message }); mutate(prepared.command, "Catalog participant updated"); }));
  app.querySelector('[data-action="undo"]').addEventListener("click", () => mutate({ command: "sidekickdm_undo" }, "Undid mutation"));
  app.querySelector('[data-action="redo"]').addEventListener("click", () => mutate({ command: "sidekickdm_redo" }, "Redid mutation"));
  app.querySelector('[data-action="export-encounter"]').addEventListener("click", () => downloadText(`${draft.id}.sidekickdm.json`, encounterJSON(engine)));
  app.querySelector('[data-action="print-encounter"]').addEventListener("click", () => openPrintPreview(engine));
  app.querySelector('[data-action="import-encounter"]').addEventListener("change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const existingIDs = [draft.id, ...(draft.participantGroups ?? []).map(item => item.id), ...(draft.hazards ?? []).map(item => item.id), ...(draft.phases ?? []).map(item => item.id)];
      const imported = importEncounterFile(await file.text(), { existingIDs, importedAt: new Date().toISOString() });
      const restored = issue(engine, { command: "sidekickdm_load_draft", draft_json: JSON.stringify(imported.draft), origin: "import" });
      if (!restored.ok) throw new Error(restored.error?.message ?? "The Encounter could not be restored.");
      engine.snapshot = restored.snapshot;
      await saveDraft(imported.draft);
      const remapped = Object.keys(imported.remappedIDs).length;
      render({ asset, engine, catalog, catalogState, notice: `Encounter imported${remapped ? ` with ${remapped} remapped ID(s)` : ""}.` });
    } catch (error) {
      render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) });
    }
  });
  app.querySelector('[data-action="increment"]').addEventListener("click", () => { const result = issue(engine, { command: "sidekick_increment", expected_revision: draft.revision, origin: "gm" }); if (!result.ok) return render({ asset, engine: { ...engine, snapshot: result.snapshot }, catalog, catalogState, notice: result.error?.message }); engine.snapshot = result.snapshot; render({ asset, engine, catalog, catalogState, bridgeMessage: globalThis.sidekickBridge.notifySwiftValue(result.snapshot.draft.swiftOwnedValue), notice: "Swift-owned state changed" }); });
  createCreatureBuilder({
    root: app.querySelector("#creature-builder-root"),
    creature: uiState.creature ?? createEmptyOriginalCreature(),
    partyLevel: party.effectiveLevel,
    onMutation: ({ creature }) => { uiState.creature = creature; },
    onAutosave: (envelope) => { uiState.creature = envelope.creature; void saveRecord("original-creature", envelope); },
    onAddToEncounter: ({ creature }) => mutate({ command: "sidekickdm_create_custom_creature", creature, quantity: 1 }, `${creature.identity.name} created and added`)
  });
  createHazardBuilder({
    root: app.querySelector("#hazard-builder-root"),
    hazard: uiState.hazard ?? createEmptySimpleHazard(),
    partyLevel: party.effectiveLevel,
    participation: "avoidable",
    onMutation: ({ hazard }) => { uiState.hazard = hazard; },
    onAutosave: (envelope) => { uiState.hazard = envelope.hazard; void saveRecord("simple-hazard", envelope); },
    onAddToEncounter: ({ hazard }) => mutate({ command: "sidekickdm_create_simple_hazard", hazard, participation_mode: "avoidable", placement: "Encounter area" }, `${hazard.identity.name} created and placed`)
  });
  createEncounterPacketEditor({
    root: app.querySelector("#encounter-packet-root"),
    packet: draft.packetV1 ?? uiState.packet ?? createEmptyPacket(),
    boundaries: draft.contentBoundaries ?? {},
    revision: draft.revision,
    constraintsRevision: draft.constraintsRevision,
    onMutation: (command) => mutate(command, "Encounter Packet section saved"),
    onAutosave: (envelope) => { uiState.packet = envelope.packet; void saveRecord("encounter-packet", envelope); }
  });
  const npcTargetField = app.querySelector('[data-action="npc-target"]');
  if (npcTargetField) {
    npcTargetField.addEventListener("change", () => { uiState.npcTarget = npcTargetField.value; if (uiState.npc) uiState.npc.participantGroupID = npcTargetField.value; render({ asset, engine, catalog, catalogState, notice: "NPC Profile participant changed" }); });
    const profile = uiState.npc ?? createEmptyNPCProfile({ participantGroupID: npcTarget });
    profile.participantGroupID = npcTarget;
    createNPCProfileEditor({
      root: app.querySelector("#npc-profile-root"),
      profile,
      participantGroupID: npcTarget,
      onMutation: ({ profile: next }) => { uiState.npc = next; mutate({ command: "sidekickdm_upsert_npc_profile", profile: npcProfileForCore(next) }, "NPC Profile saved"); },
      onAutosave: (envelope) => { uiState.npc = envelope.profile; void saveRecord("npc-profile", envelope); }
    });
  }
  const phaseValue = authoredPhases[0] ?? uiState.phase ?? createEmptyPhase({ order: authoredPhases.length });
  const phaseDraft = {
    ...phaseValue,
    trigger: typeof phaseValue.trigger === "object" ? phaseValue.trigger : { kind: "custom", explanation: String(phaseValue.trigger ?? ""), value: null, canOverlap: true },
    terrainChanges: phaseValue.terrainChanges ?? [],
    participantIDs: phaseValue.participantIDs ?? [],
    hazardIDs: phaseValue.hazardIDs ?? []
  };
  createEncounterPhaseEditor({
    root: app.querySelector("#encounter-phase-root"),
    phase: phaseDraft,
    participantGroups: draft.participantGroups ?? [],
    hazards: draft.hazards ?? [],
    onMutation: command => mutate(command, "Encounter Phase saved"),
    onAutosave: envelope => { uiState.phase = envelope.phase; void saveRecord("encounter-phase", envelope); }
  });
}

try {
  const [loaded, catalog] = await Promise.all([loadBootAssets(), loadCatalog()]);
  const [saved, savedCreature, savedHazard, savedPacket, savedNPC, savedPhase] = await Promise.all([loadSavedDraft(), loadRecord("original-creature"), loadRecord("simple-hazard"), loadRecord("encounter-packet"), loadRecord("npc-profile"), loadRecord("encounter-phase")]);
  uiState.creature = savedCreature?.creature ?? null;
  uiState.hazard = savedHazard?.hazard ?? null;
  uiState.packet = savedPacket?.packet ?? null;
  uiState.npc = savedNPC?.profile ?? null;
  uiState.phase = savedPhase?.phase ?? null;
  if (saved && loaded.engine.available) { const payload = JSON.stringify(saved); const restored = loaded.engine.execute({ command: "sidekick_load_draft", draft_json: payload, origin: "reload" }); if (restored.ok) loaded.engine.snapshot = restored.snapshot; }
  const webMCP = createWebMCPAdapter({ engine: loaded.engine, catalog, onMutation: draft => saveDraft(draft) });
  uiState.webMCPStatus = (await webMCP.register()).label;
  globalThis.sidekickDM = Object.freeze({ asset: loaded.asset, engine: loaded.engine, catalog, webMCP, bridge: globalThis.sidekickBridge, persistence: { loadSavedDraft, saveDraft, loadRecord, saveRecord }, actions: { exportEncounter: () => encounterJSON(loaded.engine), printEncounter: () => encounterPrintHTML(loaded.engine) } });
  render({ asset: loaded.asset, engine: loaded.engine, catalog, notice: saved ? "Encounter Draft reloaded from IndexedDB." : "New Encounter Draft ready." });
} catch (error) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not load</h1><p>${escapeHtml(error instanceof Error ? error.message : error)}</p></section>`; }
