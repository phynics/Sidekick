import { loadBootAssets } from "./boot.js";
import { loadCatalog } from "./catalog-index.js";
import { createCreatureBuilder, createEmptyOriginalCreature, projectCreatureXP } from "./creature-builder.js";
import { forkExistingCreature } from "./creature-generation.js";
import { createHazardBuilder, createEmptySimpleHazard } from "./hazard-builder.js";
import { createEncounterPacketEditor, createEmptyPacket } from "./encounter-packet.js";
import { createWebMCPAdapter } from "./webmcp-adapter.js";
import { createNPCProfileEditor, createEmptyNPCProfile, fromNativeNPCProfile } from "./npc-profile.js";
import { createEncounterPhaseEditor, createEmptyPhase } from "./encounter-phases.js";
import { createComponentsFile, createComponentsArchive, createEncounterFile, createEncounterArchive, createLibraryFile, createLibraryArchive, IndexedDBEncounterStore } from "./encounter-file.js";
import { createEncounterPrintProjection, renderEncounterPrintProjection } from "./print-packet.js";

const app = document.querySelector("#app");
const STORAGE_DB = "sidekick-dm";
const STORAGE_STORE = "encounters";
const STORAGE_VERSION = 2;
const STORAGE_STORES = ["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments", "library_metadata"];
const encounterStore = new IndexedDBEncounterStore({ database: STORAGE_DB, version: STORAGE_VERSION, stores: STORAGE_STORES });
const uiState = { creature: null, hazard: null, packet: null, npc: null, npcTarget: null, phase: null, phaseID: null, restoredComponents: null, activeModal: null, proficiencyWithoutLevel: new Set(), replacingParticipantID: null, webMCPStatus: "WebMCP unavailable in this browser" };
globalThis.sidekickBridge = Object.freeze({ notifySwiftValue(value) { return `JavaScript bridge received Swift value ${value}.`; } });

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function openStore() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => { const request = indexedDB.open(STORAGE_DB, STORAGE_VERSION); request.onupgradeneeded = () => { for (const store of STORAGE_STORES) if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store); }; request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function loadRecord(key) { try { const db = await openStore(); if (!db) return null; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE).objectStore(STORAGE_STORE).get(key); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); } catch { return null; } }
async function saveRecord(key, value) { try { const db = await openStore(); if (!db) return false; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE, "readwrite").objectStore(STORAGE_STORE).put(value, key); request.onsuccess = () => resolve(true); request.onerror = () => reject(request.error); }); } catch { return false; } }
async function loadSavedDraft() { return loadRecord("current"); }
async function saveDraft(draft) { return saveRecord("current", draft); }

function embeddedCatalogCreatures(draft, catalog) {
  return (draft.participantGroups ?? []).flatMap((group) => {
    const contentID = group.contentID ?? group.content_id;
    if (!contentID || String(contentID).includes("/custom/")) return [];
    const entry = catalog?.get?.(contentID);
    if (!entry) return [];
    return [{ ...structuredClone(entry), id: `catalog_snapshot_${group.id}`, contentID, snapshotKind: "catalog" }];
  });
}

function embeddedCatalogHazards(draft, catalog) {
  return (draft.hazards ?? []).flatMap(hazard => {
    const contentID = hazard.contentID ?? hazard.content_id;
    if (!contentID || String(contentID).includes("/custom/")) return [];
    const entry = catalog?.get?.(contentID);
    return entry ? [{ ...structuredClone(entry), id: `catalog_snapshot_${hazard.id}`, contentID, snapshotKind: "catalog" }] : [];
  });
}

function componentBundle(draft, catalog, restored = {}) {
  const participantContentIDs = new Set((draft.participantGroups ?? []).map(item => item.contentID ?? item.content_id));
  const hazardContentIDs = new Set((draft.hazards ?? []).map(item => item.contentID ?? item.content_id));
  const referenced = (records, contentIDs) => (records ?? []).filter(item => contentIDs.has(item.contentID ?? item.content_id) || contentIDs.has(item.id));
  const unique = records => [...new Map(records.map(record => [record.id, record])).values()];
  const embeddedCatalogEntries = draft.embeddedCatalogEntries ?? draft.embedded_catalog_entries ?? [];
  return {
    creatures: unique([...referenced(restored.creatures, participantContentIDs), ...embeddedCatalogEntries.filter(item => item.kind === "creature"), ...(draft.originalCreatures ?? []), ...embeddedCatalogCreatures(draft, catalog)]),
    npcProfiles: unique([...(restored.npcProfiles ?? []).filter(item => (draft.participantGroups ?? []).some(group => (item.participantGroupID ?? item.participant_group_id) === group.id)), ...(draft.npcProfiles ?? [])]),
    hazards: unique([...referenced(restored.hazards, hazardContentIDs), ...embeddedCatalogEntries.filter(item => item.kind === "hazard"), ...(draft.customHazards ?? []), ...embeddedCatalogHazards(draft, catalog)])
  };
}

function encounterJSON(engine, catalog, restoredComponents = uiState.restoredComponents, attachments = []) {
  const draft = engine.snapshot.encounter ?? engine.snapshot.draft;
  return createEncounterFile({ encounter: draft, components: componentBundle(draft, catalog, restoredComponents), attachments, licenseNotices: ["Unofficial Sidekick DM encounter data.", "Catalog rules data is provided under the ORC License where applicable."] });
}

function encounterPrintHTML(engine, catalog, restoredComponents = uiState.restoredComponents) {
  const draft = engine.snapshot.encounter ?? engine.snapshot.draft;
  return renderEncounterPrintProjection(createEncounterPrintProjection({ ...engine.snapshot, catalog, manifest: catalog?.fixture, embeddedComponents: componentBundle(draft, catalog, restoredComponents) }));
}

function downloadText(filename, contents, type = "application/json") {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function downloadBytes(filename, bytes, type = "application/zip") {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  queueMicrotask(() => URL.revokeObjectURL(url));
}

function attachmentIDsFrom(value, ids = new Set()) {
  if (Array.isArray(value)) value.forEach(item => attachmentIDsFrom(item, ids));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
    if (key.toLowerCase().includes("attachment") && typeof item === "string") ids.add(item);
    else attachmentIDsFrom(item, ids);
  });
  return ids;
}

function attachmentsForRecords(records, attachments) {
  const ids = records.reduce((result, record) => attachmentIDsFrom(record, result), new Set());
  return (attachments ?? []).filter(attachment => ids.has(attachment.id));
}

function importNotice(label, result) {
  const remapped = Object.keys(result?.remappedIDs ?? {}).length;
  const parts = [];
  if (result?.migration?.applied) parts.push(`migrated v${result.migration.from} to v${result.migration.to}`);
  const missing = result?.missingOptionalAttachments?.length ?? 0;
  if (missing) parts.push(`${missing} optional attachment(s) missing`);
  if (remapped) return `${label} imported with ${remapped} remapped ID(s)${parts.length ? ` (${parts.join(", ")})` : ""}.`;
  return `${label} imported${parts.length ? ` (${parts.join(", ")})` : ""}.`;
}

function openPrintPreview(engine, catalog) {
  const url = URL.createObjectURL(new Blob([encounterPrintHTML(engine, catalog)], { type: "text/html" }));
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

const DEFAULT_CATALOG_STATE = Object.freeze({ query: "", kind: "creature", levelMin: "", levelMax: "", traits: "", rarity: "", sources: "", environments: "", roles: "", edition: "current", spellcasting: "", hazardComplexity: "", completeness: "complete", support: "supported", limit: 4, offset: 0, results: null, inspectedContentID: null });

function catalogSearchRequest(state) {
  const list = value => String(value ?? "").split(/[\s,]+/).map(item => item.trim()).filter(Boolean);
  const integer = value => String(value ?? "").trim() === "" ? null : Number(value);
  return {
    query: state.query,
    kind: state.kind || null,
    level_min: integer(state.levelMin),
    level_max: integer(state.levelMax),
    traits: list(state.traits),
    rarity: list(state.rarity),
    sources: list(state.sources),
    environments: list(state.environments),
    roles: list(state.roles),
    edition: state.edition || null,
    spellcasting: state.spellcasting === "" ? null : state.spellcasting === "true",
    hazard_complexity: state.hazardComplexity || null,
    completeness: state.completeness || null,
    support: state.support || null,
    limit: Number(state.limit) || 4,
    offset: Number(state.offset) || 0
  };
}

function catalogValuesMarkup(values) {
  return Object.entries(values ?? {}).map(([key, value]) => `<li><span>${escapeHtml(key)}</span><strong>${escapeHtml(value)}</strong></li>`).join("");
}

function catalogEntryCanAdd(entry) {
  return entry?.completeness === "complete" && entry?.support === "supported";
}

function catalogInspectionMarkup(entry) {
  if (!entry) return "";
  if (entry.kind === "hazard") {
    const detail = entry.detail ?? {};
    const list = values => (values ?? []).map(value => `<li>${escapeHtml(value)}</li>`).join("") || "<li class=empty>None recorded.</li>";
    return `<section class="catalog-inspection" data-testid="catalog-inspection"><div class="panel-heading"><h4>Full Hazard inspection</h4><button type="button" data-catalog-close>Close</button></div><p>${escapeHtml(entry.summary ?? "")}</p><div class="catalog-detail-grid"><div><h5>Identity</h5><ul class="catalog-detail-list"><li><span>Level</span><strong>${escapeHtml(entry.level)}</strong></li><li><span>Complexity</span><strong>${escapeHtml(entry.hazard_complexity ?? "Not recorded")}</strong></li><li><span>Support</span><strong>${escapeHtml(entry.support ?? "Not recorded")}</strong></li></ul></div><div><h5>Traits</h5><ul class="catalog-detail-list"><li>${escapeHtml((entry.traits ?? []).join(", ") || "None recorded")}</li></ul></div><div><h5>Defenses</h5><ul class="catalog-detail-list">${catalogValuesMarkup(detail.defenses)}</ul></div><div><h5>Disable methods</h5><ul class="catalog-detail-list">${list(detail.disable_methods)}</ul></div></div><h5>Trigger</h5><p>${escapeHtml(detail.trigger ?? "Not recorded")}</p><h5>Effect</h5><p>${escapeHtml(detail.effect ?? "Not recorded")}</p><h5>Routine</h5><p>${escapeHtml(detail.routine ?? "Not recorded")}</p><p class="catalog-provenance"><strong>Source:</strong> ${escapeHtml(entry.provenance?.source_title ?? entry.source)} · ${escapeHtml(entry.provenance?.upstream?.identifier ?? "Identifier not recorded")}</p></section>`;
  }
  if (entry.kind !== "creature") return "";
  const detail = entry.detail ?? {};
  const list = values => (values ?? []).map(value => `<li>${escapeHtml(value)}</li>`).join("") || "<li class=empty>None recorded.</li>";
  const strikes = (detail.strikes ?? []).map(strike => `<li><strong>${escapeHtml(strike.name)}</strong>${strike.attack == null ? "" : ` · +${escapeHtml(strike.attack)}`}${strike.damage ? ` · ${escapeHtml(strike.damage)}` : ""}${strike.traits?.length ? ` <small>${escapeHtml(strike.traits.join(", "))}</small>` : ""}</li>`).join("") || "<li class=empty>None recorded.</li>";
  const abilities = (detail.abilities ?? []).map(ability => `<li><strong>${escapeHtml(ability.name)}</strong>${ability.action_cost == null ? "" : ` · ${escapeHtml(ability.action_cost)} action`}${ability.traits?.length ? ` <small>${escapeHtml(ability.traits.join(", "))}</small>` : ""}<p>${escapeHtml(ability.text)}</p></li>`).join("") || "<li class=empty>None recorded.</li>";
  return `<section class="catalog-inspection" data-testid="catalog-inspection"><div class="panel-heading"><h4>Full Creature inspection</h4><button type="button" data-catalog-close>Close</button></div><p>${escapeHtml(entry.summary ?? entry.summary?.summary ?? "")}</p><div class="catalog-detail-grid"><div><h5>Identity</h5><ul class="catalog-detail-list"><li><span>Level</span><strong>${escapeHtml(entry.level)}</strong></li><li><span>Size</span><strong>${escapeHtml(detail.size ?? "Not recorded")}</strong></li><li><span>Perception</span><strong>${escapeHtml(detail.perception ?? "Not recorded")}</strong></li></ul></div><div><h5>Traits</h5><ul class="catalog-detail-list"><li>${escapeHtml((entry.traits ?? []).join(", ") || "None recorded")}</li></ul></div><div><h5>Senses and languages</h5><ul class="catalog-detail-list"><li>${escapeHtml((detail.senses ?? []).join(", ") || "No senses recorded")}</li><li>${escapeHtml((detail.languages ?? []).join(", ") || "No languages recorded")}</li></ul></div><div><h5>Skills</h5><ul class="catalog-detail-list">${catalogValuesMarkup(detail.skills)}</ul></div><div><h5>Defenses</h5><ul class="catalog-detail-list">${catalogValuesMarkup(detail.defenses)}</ul></div><div><h5>Speeds</h5><ul class="catalog-detail-list">${catalogValuesMarkup(detail.speeds)}</ul></div></div><h5>Strikes</h5><ul class="catalog-detail-list">${strikes}</ul><h5>Abilities</h5><ul class="catalog-detail-list">${abilities}</ul><div class="catalog-detail-grid"><div><h5>Spellcasting</h5><ul class="catalog-detail-list">${list(detail.spellcasting_blocks)}</ul></div><div><h5>Tactics</h5><p>${escapeHtml(detail.tactics ?? "Not recorded")}</p></div><div><h5>Morale</h5><p>${escapeHtml(detail.morale ?? "Not recorded")}</p></div></div><p class="catalog-provenance"><strong>Source:</strong> ${escapeHtml(entry.provenance?.source_title ?? entry.source)} · ${escapeHtml(entry.provenance?.upstream?.identifier ?? "Identifier not recorded")}</p></section>`;
}

function statisticNumber(value) {
  const number = typeof value === "object" ? Number(value?.value) : Number(value);
  return Number.isFinite(number) ? number : null;
}

function participantCreature(group, draft, catalog) {
  const contentID = group.contentID ?? group.content_id ?? "";
  const original = (draft.originalCreatures ?? []).find(item => contentID.includes(`/${item.id}/`));
  if (original) return { entry: original, detail: original, custom: true, source: original.provenance?.origin ?? "original" };
  const catalogEntry = catalog?.get?.(contentID);
  if (catalogEntry) return { entry: catalogEntry, detail: catalogEntry.detail ?? {}, custom: false, source: catalogEntry.source ?? "Catalog" };
  const embedded = (draft.embeddedCatalogEntries ?? draft.embedded_catalog_entries ?? []).find(item => (item.contentID ?? item.content_id) === contentID);
  return embedded ? { entry: embedded, detail: embedded.detail ?? {}, custom: false, source: embedded.source ?? "Imported Catalog" } : null;
}

function projectedStatistic(value, group, proficiencyWithoutLevel) {
  const number = statisticNumber(value);
  if (number == null) return "—";
  const adjustment = group.adjustment === "weak" ? -2 : group.adjustment === "elite" ? 2 : 0;
  return number + adjustment - (proficiencyWithoutLevel ? Number(group.level ?? 0) : 0);
}

function participantCardMarkup(group, draft, catalog) {
  const creature = participantCreature(group, draft, catalog);
  const detail = creature?.detail ?? {};
  const defenses = detail.defenses ?? {};
  const proficiencyWithoutLevel = uiState.proficiencyWithoutLevel.has(group.id);
  const original = creature?.custom;
  const stats = [
    ["AC", projectedStatistic(defenses.ac, group, proficiencyWithoutLevel)],
    ["Fort", projectedStatistic(defenses.fortitude, group, proficiencyWithoutLevel)],
    ["Ref", projectedStatistic(defenses.reflex, group, proficiencyWithoutLevel)],
    ["Will", projectedStatistic(defenses.will, group, proficiencyWithoutLevel)],
    ["Per", projectedStatistic(detail.perception, group, proficiencyWithoutLevel)],
    ["HP", statisticNumber(defenses.hp) ?? "—"]
  ].map(([label, value]) => `<div class="stat"><span>${label}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const strikes = (detail.strikes ?? []).map(strike => {
    const attack = projectedStatistic(strike.attack, group, proficiencyWithoutLevel);
    const damage = strike.damage?.[0]?.expression ?? strike.damage ?? "Damage not recorded";
    const traits = strike.traits?.length ? `<small>${escapeHtml(strike.traits.join(" · "))}</small>` : "";
    return `<li><div><strong>${escapeHtml(strike.name ?? "Strike")}</strong>${traits}</div><span>${attack === "—" ? "Attack not recorded" : `+${escapeHtml(attack)}`} · ${escapeHtml(damage)}</span></li>`;
  }).join("");
  const abilities = (detail.abilities ?? []).map(ability => {
    const actionCost = ability.actionCost ?? ability.action_cost;
    const timing = actionCost == null ? ability.kind ?? "feature" : `${actionCost} action${Number(actionCost) === 1 ? "" : "s"}`;
    const text = ability.effectText ?? ability.effect ?? ability.text ?? "No effect text recorded.";
    return `<li><div><strong>${escapeHtml(ability.name ?? "Special feature")}</strong><small>${escapeHtml(timing)}</small></div><p>${escapeHtml(text)}</p></li>`;
  }).join("");
  const speeds = typeof detail.speeds === "object" ? Object.entries(detail.speeds).map(([kind, value]) => `${kind} ${value} ft.`).join(", ") : "";
  const profile = (draft.npcProfiles ?? []).find(item => (item.participantGroupID ?? item.participant_group_id) === group.id);
  const editableEntry = !original && creature?.entry?.kind === "creature" && creature.entry.completeness === "complete" && creature.entry.support === "supported";
  const adjustment = group.adjustment === "weak" ? -1 : group.adjustment === "elite" ? 1 : 0;
  const partyLevel = draft.brief?.party?.effectiveLevel ?? draft.brief?.party?.effective_level ?? 1;
  const xp = projectCreatureXP(Number(group.level) + adjustment, partyLevel, group.quantity);
  return `<article class="creature-card creature-row" data-testid="participant-${escapeHtml(group.id)}">
    <div class="creature-row-main"><header><div class="creature-identity"><p class="card-kicker">Level ${escapeHtml(group.level)}${proficiencyWithoutLevel ? " · proficiency without level" : ""}</p><h3>${escapeHtml(group.name)}</h3><p class="trait-line">${escapeHtml(creature?.entry?.traits?.join?.(" · ") || creature?.source || "Custom participant")}</p></div><aside class="creature-impact" aria-label="${escapeHtml(group.quantity)} creature${Number(group.quantity) === 1 ? "" : "s"} contributing ${escapeHtml(xp.totalXP)} XP"><div><strong data-testid="creature-count-${escapeHtml(group.id)}">×${escapeHtml(group.quantity)}</strong><span>creature${Number(group.quantity) === 1 ? "" : "s"}</span></div><div class="xp-contribution"><strong data-testid="creature-xp-${escapeHtml(group.id)}">${escapeHtml(xp.totalXP)} XP</strong><span>${Number(group.quantity) > 1 ? `${escapeHtml(xp.xpPerCreature)} each` : "encounter share"}</span></div></aside><span class="role-chip">${escapeHtml(group.encounterRole ?? "participant")}</span></header>
    <div class="stat-ribbon">${stats}</div>
    <div class="creature-detail"><section><h4>Attacks</h4><ul class="strike-list" data-testid="creature-attacks-${escapeHtml(group.id)}">${strikes || "<li class=empty-detail><span>No attacks recorded.</span></li>"}</ul></section><section><h4>Special features</h4><ul class="feature-list" data-testid="creature-features-${escapeHtml(group.id)}">${abilities || "<li class=empty-detail><p>No special features recorded.</p></li>"}</ul></section></div>
    <div class="creature-running-note"><strong>Running note</strong><span>${escapeHtml(detail.tactics ?? group.sharedTactics ?? "Use the creature's listed actions and terrain.")}</span>${speeds ? `<small>Speed: ${escapeHtml(speeds)}</small>` : ""}${profile ? `<small>NPC: ${escapeHtml(profile.name ?? "Unnamed")} · ${escapeHtml(profile.tier ?? "incidental")}</small>` : ""}</div>
    <details class="creature-manager"><summary>Manage creature</summary><footer class="card-controls"><label>Count<input data-catalog-component="${escapeHtml(group.id)}" data-catalog-field="quantity" type="number" min="1" value="${escapeHtml(group.quantity)}"></label><label>Template<select data-catalog-component="${escapeHtml(group.id)}" data-catalog-field="adjustment"><option value="weak" ${group.adjustment === "weak" ? "selected" : ""}>Weak</option><option value="normal" ${group.adjustment === "normal" ? "selected" : ""}>Standard</option><option value="elite" ${group.adjustment === "elite" ? "selected" : ""}>Strong</option></select></label><label class="check-control"><input type="checkbox" data-pwl-group="${escapeHtml(group.id)}" ${proficiencyWithoutLevel ? "checked" : ""}>Proficiency without level</label>${original ? `<button type="button" class="button-secondary" data-creature-edit="${escapeHtml(creature.entry.id)}">Edit statistics</button>` : editableEntry ? `<button type="button" class="button-secondary" data-creature-customize="${escapeHtml(group.id)}">Customize statistics</button>` : ""}<button type="button" class="button-ghost" data-npc-open="${escapeHtml(group.id)}">NPC profile</button><button type="button" class="button-danger" data-creature-remove="${escapeHtml(group.id)}">Remove</button></footer></details>
    </div>
  </article>`;
}

function modalMarkup(id, title, body, className = "") {
  return `<dialog class="modal ${className}" data-modal="${id}" aria-labelledby="modal-${id}-title"><div class="modal-frame"><header class="modal-header"><div><p class="eyebrow">Sidekick workspace</p><h2 id="modal-${id}-title">${escapeHtml(title)}</h2></div><button type="button" class="icon-button" data-modal-close aria-label="Close ${escapeHtml(title)}">×</button></header><div class="modal-body">${body}</div></div></dialog>`;
}

function render({ asset, engine, catalog, catalogState = { query: "", results: null }, bridgeMessage = "", notice = "" }) {
  if (!engine.available) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not start</h1><p>${escapeHtml(engine.reason)}</p></section>`; return; }
  const activeCatalogState = { ...DEFAULT_CATALOG_STATE, ...catalogState };
  const snapshot = engine.snapshot; const draft = snapshot.encounter ?? snapshot.draft; const party = draft.brief?.party ?? { effectiveLevel: 1, size: 4 }; const target = draft.brief?.threatTarget ?? { kind: "moderate", customXP: null }; const budget = snapshot.budget ?? { baseTargetXP: 80, constructionBudget: 80, baseXPAward: 80, guaranteedXP: 0, avoidableXP: 0, conditionalXP: 0, peakActiveXP: 0, totalEncounterXP: 0, inferredThreat: "trivial", warnings: [] };
  const generation = draft.generation ?? null;
  const generationState = generation?.state ?? null;
  const manualLocked = Boolean(generation);
  const participants = (draft.participantGroups ?? []).map((group) => participantCardMarkup(group, draft, catalog)).join("");
  const hazards = (draft.hazards ?? []).map((hazard) => `<article class="support-card" data-testid="hazard-${escapeHtml(hazard.id)}"><div><p class="card-kicker">Level ${hazard.level} · ${escapeHtml(hazard.complexity)} · ${escapeHtml(hazard.participation?.mode ?? "avoidable")}</p><h3>${escapeHtml(hazard.name)}</h3><p>${escapeHtml(hazard.placement ?? "Placement not recorded")}</p></div>${(draft.customHazards ?? []).some(item => item.id === hazard.id) ? `<button type="button" class="button-secondary" data-hazard-edit="${escapeHtml(hazard.id)}">Edit hazard</button>` : ""}</article>`).join("");
  const authoredPhases = draft.structuredPhases ?? draft.phases ?? [];
  const phaseProjections = snapshot.phaseBudget?.phases ?? snapshot.phase_budget?.phases ?? [];
  const phases = authoredPhases.map((phase) => { const projection = phaseProjections.find(item => (item.phaseID ?? item.phase_id) === phase.id); return `<article class="support-card" data-testid="phase-${escapeHtml(phase.id)}"><div><p class="card-kicker">${(phase.participantIDs ?? []).length} groups · ${(phase.hazardIDs ?? []).length} hazards${projection ? ` · ${escapeHtml(projection.activeXP ?? projection.active_xp ?? 0)} active XP` : ""}</p><h3>${escapeHtml(phase.title)}</h3><p>${escapeHtml(phase.trigger?.explanation ?? phase.trigger ?? "No trigger")}</p></div><button type="button" class="button-secondary" data-phase-edit="${escapeHtml(phase.id)}">Edit phase</button></article>`; }).join("");
  const activities = (snapshot.activity ?? []).slice(0, 6).map((entry) => `<li><span>${escapeHtml(entry.description)}</span><small>${escapeHtml(entry.origin)} · rev ${entry.afterRevision}</small></li>`).join("");
  const catalogResults = activeCatalogState.results ?? catalog?.search(catalogSearchRequest(activeCatalogState));
  const catalogMarkup = catalogResults?.results?.map((entry) => `<li><div><strong>${escapeHtml(entry.name)}</strong><span>Level ${entry.level} · ${escapeHtml(entry.source)} · ${escapeHtml(entry.kind)}</span><small>${escapeHtml(entry.summary)}</small><div class="catalog-actions">${entry.kind === "creature" ? `<button type="button" data-catalog-inspect="${escapeHtml(entry.content_id)}">Inspect</button>${catalogEntryCanAdd(entry) ? `<button type="button" data-catalog-add="${escapeHtml(entry.content_id)}">Add</button>` : "<span class=\"catalog-unavailable\">Add unavailable for unsupported or partial entries</span>"}` : catalogEntryCanAdd(entry) ? `<button type="button" data-catalog-hazard-add="${escapeHtml(entry.content_id)}">Add Hazard</button>` : "<span class=\"catalog-unavailable\">Add unavailable for unsupported or partial entries</span>"}</div></div></li>`).join("") ?? "";
  const inspectedCatalogEntry = activeCatalogState.inspectedContentID ? catalog?.get(activeCatalogState.inspectedContentID) : null;
  const catalogRangeStart = catalogResults?.total ? catalogResults.offset + 1 : 0;
  const catalogRangeEnd = catalogResults?.offset + (catalogResults?.results?.length ?? 0) || 0;
  const catalogHazards = catalog?.search({ kind: "hazard", query: "", edition: null, completeness: null, support: null, limit: 20 });
  const catalogHazardMarkup = catalogHazards?.results?.map(entry => `<li><div><strong>${escapeHtml(entry.name)}</strong><span>Level ${entry.level} · ${escapeHtml(entry.hazard_complexity ?? "simple")} · ${escapeHtml(entry.source)} · ${escapeHtml(entry.support)}</span><small>${escapeHtml(entry.summary)}</small><div class="catalog-actions"><button type="button" data-catalog-inspect="${escapeHtml(entry.content_id)}">Inspect</button>${catalogEntryCanAdd(entry) ? `<button type="button" data-catalog-hazard-add="${escapeHtml(entry.content_id)}">Add Hazard</button>` : "<span class=\"catalog-unavailable\">Add unavailable while rights or completeness is unresolved</span>"}</div></div></li>`).join("") ?? "";
  const reusableLibrary = {
    creatures: [...new Map([...(uiState.restoredComponents?.creatures ?? []), ...(draft.originalCreatures ?? [])].map(record => [record.id, record])).values()],
    npcProfiles: [...new Map([...(uiState.restoredComponents?.npcProfiles ?? []), ...(draft.npcProfiles ?? [])].map(record => [record.id, record])).values()],
    hazards: [...new Map([...(uiState.restoredComponents?.hazards ?? []), ...(draft.customHazards ?? [])].map(record => [record.id, record])).values()],
    partyProfiles: [...new Map((uiState.restoredComponents?.partyProfiles ?? []).map(record => [record.id, record])).values()]
  };
  const reusableRecords = [
    ...reusableLibrary.creatures.map(record => ({ kind: "creatures", id: record.id, label: record.identity?.name ?? record.name ?? record.id })),
    ...reusableLibrary.npcProfiles.map(record => ({ kind: "npcProfiles", id: record.id, label: record.name ?? record.id })),
    ...reusableLibrary.hazards.map(record => ({ kind: "hazards", id: record.id, label: record.identity?.name ?? record.name ?? record.id })),
    ...reusableLibrary.partyProfiles.map(record => ({ kind: "partyProfiles", id: record.id, label: record.name ?? record.id }))
  ];
  const reusableMarkup = reusableRecords.map(record => `<li><label><input type="checkbox" data-library-select="${escapeHtml(record.kind)}" value="${escapeHtml(record.id)}" checked>${escapeHtml(record.label)} <small>${escapeHtml(record.kind)}</small></label></li>`).join("");
  const npcTarget = (draft.participantGroups ?? []).some((group) => group.id === uiState.npcTarget) ? uiState.npcTarget : draft.participantGroups?.[0]?.id ?? null;
  uiState.npcTarget = npcTarget;
  const npcOptions = (draft.participantGroups ?? []).map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === npcTarget ? "selected" : ""}>${escapeHtml(group.name)}</option>`).join("");
  const catalogBody = `<section class="catalog-panel"><form data-action="search-catalog"><div class="catalog-search-row"><label class="search-field">Search the catalog<input name="query" data-catalog-filter="query" value="${escapeHtml(activeCatalogState.query)}" placeholder="Name, trait, role, or description" autofocus></label><label>Type<select name="kind" data-catalog-filter="kind"><option value="creature" ${activeCatalogState.kind === "creature" ? "selected" : ""}>Creatures</option><option value="hazard" ${activeCatalogState.kind === "hazard" ? "selected" : ""}>Hazards</option></select></label><button type="submit">Search</button></div><details class="filter-drawer"><summary>Filters</summary><div class="catalog-filter-grid"><label>Level min<input name="levelMin" data-catalog-filter="level_min" type="number" min="-1" max="30" value="${escapeHtml(activeCatalogState.levelMin)}"></label><label>Level max<input name="levelMax" data-catalog-filter="level_max" type="number" min="-1" max="30" value="${escapeHtml(activeCatalogState.levelMax)}"></label><label>Trait<input name="traits" data-catalog-filter="traits" value="${escapeHtml(activeCatalogState.traits)}" placeholder="trap, fire"></label><label>Source<input name="sources" data-catalog-filter="sources" value="${escapeHtml(activeCatalogState.sources)}" placeholder="Monster Core"></label><label>Environment<input name="environments" data-catalog-filter="environments" value="${escapeHtml(activeCatalogState.environments)}" placeholder="forest, urban"></label><label>Role<input name="roles" data-catalog-filter="roles" value="${escapeHtml(activeCatalogState.roles)}" placeholder="brute, controller"></label><label>Rarity<select name="rarity" data-catalog-filter="rarity"><option value="" ${!activeCatalogState.rarity ? "selected" : ""}>Any rarity</option><option value="common" ${activeCatalogState.rarity === "common" ? "selected" : ""}>Common</option><option value="uncommon" ${activeCatalogState.rarity === "uncommon" ? "selected" : ""}>Uncommon</option></select></label><label>Edition<select name="edition" data-catalog-filter="edition"><option value="current" ${activeCatalogState.edition === "current" ? "selected" : ""}>Current</option><option value="legacy" ${activeCatalogState.edition === "legacy" ? "selected" : ""}>Legacy</option><option value="adventure" ${activeCatalogState.edition === "adventure" ? "selected" : ""}>Adventure</option></select></label><label>Spellcasting<select name="spellcasting" data-catalog-filter="spellcasting"><option value="" ${activeCatalogState.spellcasting === "" ? "selected" : ""}>Any spellcasting</option><option value="true" ${activeCatalogState.spellcasting === "true" ? "selected" : ""}>Spellcasting</option><option value="false" ${activeCatalogState.spellcasting === "false" ? "selected" : ""}>No spellcasting</option></select></label><label>Hazard complexity<select name="hazardComplexity" data-catalog-filter="hazard_complexity"><option value="" ${!activeCatalogState.hazardComplexity ? "selected" : ""}>Any complexity</option><option value="simple" ${activeCatalogState.hazardComplexity === "simple" ? "selected" : ""}>Simple</option><option value="complex" ${activeCatalogState.hazardComplexity === "complex" ? "selected" : ""}>Complex</option></select></label><label>Completeness<select name="completeness" data-catalog-filter="completeness"><option value="complete" ${activeCatalogState.completeness === "complete" ? "selected" : ""}>Complete</option><option value="partial" ${activeCatalogState.completeness === "partial" ? "selected" : ""}>Partial</option></select></label><label>Support<select name="support" data-catalog-filter="support"><option value="supported" ${activeCatalogState.support === "supported" ? "selected" : ""}>Supported</option><option value="unsupported" ${activeCatalogState.support === "unsupported" ? "selected" : ""}>Unsupported</option></select></label><label>Page size<select name="limit" data-catalog-filter="limit"><option value="4" ${Number(activeCatalogState.limit) === 4 ? "selected" : ""}>4</option><option value="8" ${Number(activeCatalogState.limit) === 8 ? "selected" : ""}>8</option><option value="20" ${Number(activeCatalogState.limit) === 20 ? "selected" : ""}>20</option></select></label></div><button type="button" class="button-ghost" data-catalog-reset>Reset filters</button></details></form><p role="status" data-testid="catalog-status">Showing ${catalogRangeStart}–${catalogRangeEnd} of ${catalogResults?.total ?? 0} supported result(s).</p><ul class="catalog-results">${catalogMarkup || "<li class=empty>No matching supported Catalog Entries.</li>"}</ul><div class="catalog-pagination"><button type="button" class="button-secondary" data-catalog-page="previous" ${!catalogResults || catalogResults.offset < 1 ? "disabled" : ""}>Previous</button><span data-testid="catalog-page">Offset ${catalogResults?.offset ?? 0}</span><button type="button" class="button-secondary" data-catalog-page="next" ${!catalogResults?.hasMore ? "disabled" : ""}>Next</button></div>${catalogInspectionMarkup(inspectedCatalogEntry)}<details class="rights-drawer"><summary>Inspect all existing hazards</summary><p>${catalogHazards?.total ?? 0} entries are available for inspection. Unsupported entries cannot be added.</p><ul class="catalog-results">${catalogHazardMarkup || "<li class=empty>No catalog Hazards.</li>"}</ul></details></section>`;
  const transferBody = `<p class="modal-intro">Choose the records to move between encounters or a reusable library.</p><ul class="transfer-list">${reusableMarkup || "<li class=empty>No reusable records in this Encounter.</li>"}</ul><div class="transfer-groups"><section><h3>Selected components</h3><div class="controls"><button type="button" data-action="export-components-json" ${reusableRecords.length ? "" : "disabled"}>Export selected JSON</button><button type="button" data-action="export-components-zip" ${reusableRecords.length ? "" : "disabled"}>Export selected ZIP</button><label class="file-control">Import components JSON<input type="file" accept="application/json,.json" data-action="import-components"></label><label class="file-control">Import components ZIP<input type="file" accept="application/zip,.zip,.sidekickdm.zip" data-action="import-components-zip"></label></div></section><section><h3>Whole library</h3><div class="controls"><button type="button" data-action="export-library-json">Export library JSON</button><button type="button" data-action="export-library-zip">Export library ZIP</button><label class="file-control">Import library JSON<input type="file" accept="application/json,.json" data-action="import-library"></label><label class="file-control">Import library ZIP<input type="file" accept="application/zip,.zip,.sidekickdm.zip" data-action="import-library-zip"></label></div></section></div>`;
  const exportBody = `<p class="modal-intro">Export a portable encounter, import an earlier version, or prepare the packet for the table.</p><div class="export-grid"><section><p class="card-kicker">Complete encounter</p><h3>Portable files</h3><p>JSON is readable and diffable. ZIP includes referenced attachments.</p><div class="controls"><button type="button" data-action="export-encounter">Export Encounter JSON</button><button type="button" data-action="export-encounter-zip">Export Encounter ZIP</button></div></section><section><p class="card-kicker">Restore</p><h3>Import encounter</h3><p>The native engine validates the encounter before it replaces the current draft.</p><div class="controls"><label class="file-control">Import Encounter JSON<input type="file" accept="application/json,.json" data-action="import-encounter"></label><label class="file-control">Import Encounter ZIP<input type="file" accept="application/zip,.zip,.sidekickdm.zip" data-action="import-encounter-zip"></label></div></section><section><p class="card-kicker">At the table</p><h3>Run-ready packet</h3><p>Open the print layout with participants, phases, guidance, and notices.</p><button type="button" data-action="print-encounter">Print Packet</button></section><section><p class="card-kicker">Reusable records</p><h3>Components and library</h3><p>Move creatures, hazards, profiles, and attachments without replacing the encounter.</p><button type="button" class="button-secondary" data-modal-open="transfer">Open transfer tools</button></section></div>`;
  app.innerHTML = `
    <div class="shell">
      <header class="topbar"><div class="title-block"><p class="eyebrow">Sidekick DM · Encounter control board</p><h1>${escapeHtml(draft.title)}</h1><div class="title-meta"><span class="badge" data-testid="readiness">${escapeHtml(snapshot.readiness?.status ?? "incomplete")}</span><span>Revision <strong data-testid="encounter-revision">${draft.revision}</strong></span><span>${escapeHtml(party.size)} heroes · level ${escapeHtml(party.effectiveLevel)}</span></div></div><nav class="controls command-controls" aria-label="Encounter actions"><div class="history-controls"><button type="button" class="button-quiet" data-action="undo" ${snapshot.canUndo ? "" : "disabled"}>Undo</button><button type="button" class="button-quiet" data-action="redo" ${snapshot.canRedo ? "" : "disabled"}>Redo</button></div><button type="button" class="primary" data-modal-open="packet">Run packet</button><details class="action-menu"><summary>More</summary><div class="action-menu-popover"><button type="button" data-modal-open="export">Export and print</button><button type="button" data-modal-open="npc" ${npcTarget ? "" : "disabled"}>NPC profiles</button><button type="button" data-modal-open="phase">Phases</button><button type="button" data-modal-open="transfer">Library</button><button type="button" data-action="new-encounter">New encounter</button></div></details></nav></header>
      ${generation ? `<div class="generation-banner warning" data-testid="generation-state"><strong>Generation Run ${escapeHtml(generationState ?? "unknown")}</strong><span>${escapeHtml(generation.id ?? "")}</span><p>${generationState === "interrupted" ? "This run was interrupted by reload. GM editing stays locked until WebMCP resumes or cancels it." : "GM editing is locked while the agent run is active. Read and print actions remain available."}</p></div>` : ""}
      <div class="workspace">
        <section class="encounter-stage" aria-labelledby="roster-title"><div class="section-heading"><div><p class="eyebrow">Live encounter</p><h2 id="roster-title">Creatures at the table</h2></div><details class="action-menu add-menu"><summary>Add creature</summary><div class="action-menu-popover"><button type="button" data-modal-open="catalog">Search catalog</button><button type="button" data-modal-open="creature" data-new-creature>Create custom creature</button></div></details></div><div class="creature-roster">${participants || `<section class="empty-state"><p class="eyebrow">The field is clear</p><h3>No creatures in this encounter</h3><p>Search the catalog or create a custom creature. Statistics appear here as soon as you add one.</p><div><button type="button" data-modal-open="catalog">Search catalog</button><button type="button" class="button-secondary" data-modal-open="creature" data-new-creature>Create creature</button></div></section>`}</div>
          <div class="support-grid"><section><div class="section-heading compact"><div><p class="eyebrow">Environment</p><h2>Hazards</h2></div><button type="button" class="button-ghost" data-modal-open="hazard" data-new-hazard>Add hazard</button></div><div class="support-list">${hazards || "<p class=empty>No hazards placed.</p>"}</div></section><section><div class="section-heading compact"><div><p class="eyebrow">Encounter flow</p><h2>Phases</h2></div><button type="button" class="button-ghost" data-action="new-phase">New phase</button></div><div class="support-list">${phases || "<p class=empty>No phases authored.</p>"}</div></section></div>
        </section>
        <aside class="command-rail"><section class="rail-panel budget-panel"><div class="panel-heading"><div><p class="eyebrow">Encounter pressure</p><h2>${escapeHtml(target.kind)} encounter</h2></div><strong class="threat-mark">${escapeHtml(budget.peakActiveXP)} XP</strong></div><div class="budget-hero"><span>Peak active</span><strong>${escapeHtml(budget.peakActiveXP)} <small>/ ${escapeHtml(budget.constructionBudget)} XP</small></strong></div><p class="inferred">Inferred threat: <strong data-testid="inferred-threat">${escapeHtml(budget.inferredThreat)}</strong></p>${budget.warnings.map((warning) => `<p class="warning">${escapeHtml(warning)}</p>`).join("")}<details class="rail-disclosure"><summary>Budget details</summary><div class="budget">${budgetMarkup(budget)}</div></details><details class="rail-disclosure"><summary>Encounter settings</summary><div class="settings-fields"><label>Title<input data-testid="encounter-title" data-field="title" value="${escapeHtml(draft.title)}"></label><div class="party-grid"><label>Party level<input data-testid="party-level" data-field="effective_level" type="number" min="1" max="20" value="${party.effectiveLevel}"></label><label>Party size<input data-testid="party-size" data-field="size" type="number" min="1" max="8" value="${party.size}"></label></div><label>Threat target<select data-testid="threat-target" data-field="threat">${["trivial","low","moderate","severe","extreme","custom"].map((kind) => `<option value="${kind}" ${target.kind === kind ? "selected" : ""}>${kind[0].toUpperCase() + kind.slice(1)}</option>`).join("")}</select></label><label data-testid="custom-xp-field" class="${target.kind === "custom" ? "" : "hidden"}">Custom XP<input data-testid="custom-xp" data-field="custom_xp" type="number" min="0" value="${target.customXP ?? 0}"></label></div></details></section>
          <details class="rail-panel activity-panel"><summary><span>Recent changes</span><span class="connection-dot" title="${escapeHtml(uiState.webMCPStatus)}"></span></summary><ul>${activities || "<li class=empty>No mutations yet.</li>"}</ul></details>
        </aside>
      </div>
      <footer class="statusbar"><p class="status" data-testid="notice">${escapeHtml(notice || "Ready for a semantic mutation.")}</p><p data-testid="webmcp-status">${escapeHtml(uiState.webMCPStatus)}</p><p class="sr-only" data-testid="asset-status">${escapeHtml(asset.asset_message)}</p><p class="sr-only" data-testid="bridge-status">${escapeHtml(bridgeMessage || "JavaScript bridge waiting.")}</p></footer>
      <form data-action="add-participant" class="sr-only"><input name="name" required><input name="level" type="number" value="${party.effectiveLevel}"><input name="quantity" type="number" min="1" value="1"><button type="submit">Add participant</button></form><button type="button" data-action="increment" class="legacy-control">Change Swift state</button><span class="sr-only">Swift-owned value <span data-testid="swift-value">${draft.swiftOwnedValue}</span></span>
      ${modalMarkup("catalog", "Search catalog", catalogBody, "modal-catalog")}
      ${modalMarkup("creature", uiState.replacingParticipantID ? "Customize creature statistics" : "Monster creator", `<div id="creature-builder-root"></div>`, "modal-builder")}
      ${modalMarkup("hazard", "Hazard creator", `<div id="hazard-builder-root"></div>`, "modal-builder")}
      ${modalMarkup("packet", "Encounter packet", `<div id="encounter-packet-root"></div>`, "modal-builder")}
      ${modalMarkup("npc", "NPC profile", npcTarget ? `<label>Participant group<select data-action="npc-target">${npcOptions}</select></label><div id="npc-profile-root"></div>` : "<p>Add a creature before attaching an NPC profile.</p>", "modal-builder")}
      ${modalMarkup("phase", "Encounter phase", `<div id="encounter-phase-root"></div>`, "modal-builder")}
      ${modalMarkup("transfer", "Components and library", transferBody, "modal-wide")}
      ${modalMarkup("export", "Export and print", exportBody, "modal-wide")}
    </div>`;

  const mutate = (command, message = "Saved") => { const result = issue(engine, { ...command, expected_revision: draft.revision, origin: "gm" }); if (!result.ok) { render({ asset, engine: { ...engine, snapshot: result.snapshot }, catalog, catalogState: activeCatalogState, notice: result.error?.message }); return; } engine.snapshot = result.snapshot; render({ asset, engine, catalog, catalogState: activeCatalogState, notice: message }); };
  app.querySelectorAll("[data-modal-open]").forEach(button => button.addEventListener("click", () => {
    if (button.hasAttribute("data-new-creature")) { uiState.creature = createEmptyOriginalCreature(); uiState.replacingParticipantID = null; }
    if (button.hasAttribute("data-new-hazard")) uiState.hazard = createEmptySimpleHazard();
    uiState.activeModal = button.dataset.modalOpen;
    render({ asset, engine, catalog, catalogState: activeCatalogState, notice });
  }));
  app.querySelectorAll("[data-modal-close]").forEach(button => button.addEventListener("click", () => { uiState.activeModal = null; button.closest("dialog")?.close(); }));
  app.querySelectorAll("dialog").forEach(dialog => dialog.addEventListener("cancel", () => { uiState.activeModal = null; }));
  app.querySelectorAll("[data-field]").forEach((field) => field.addEventListener("change", () => {
    const key = field.dataset.field;
    if (key === "effective_level" || key === "size") mutate({ command: "sidekickdm_set_party_snapshot", effective_level: Number(app.querySelector('[data-field="effective_level"]').value), size: Number(app.querySelector('[data-field="size"]').value) }, "Party Snapshot saved");
    else if (key === "threat") mutate({ command: "sidekickdm_set_threat_target", kind: field.value, custom_xp: Number(app.querySelector('[data-testid="custom-xp"]')?.value ?? 0) }, "Threat Target saved");
    else if (key === "custom_xp") mutate({ command: "sidekickdm_set_threat_target", kind: "custom", custom_xp: Number(field.value) }, "Custom Threat Target saved");
    else if (key === "title") mutate({ command: "sidekickdm_set_encounter_identity", title: field.value }, "Encounter identity saved");
  }));
  app.querySelector('[data-action="new-encounter"]').addEventListener("click", () => {
    const threatKind = app.querySelector('[data-field="threat"]').value;
    uiState.creature = null; uiState.hazard = null; uiState.packet = null; uiState.npc = null; uiState.npcTarget = null; uiState.phase = null; uiState.phaseID = null;
    mutate({ command: "sidekickdm_create_encounter", title: app.querySelector('[data-field="title"]').value || "Untitled Encounter", effective_level: Number(app.querySelector('[data-field="effective_level"]').value), size: Number(app.querySelector('[data-field="size"]').value), kind: threatKind, custom_xp: threatKind === "custom" ? Number(app.querySelector('[data-field="custom_xp"]').value) : null }, "New Encounter Draft created");
  });
  app.querySelector('[data-action="add-participant"]').addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutate({ command: "sidekickdm_add_participant_group", name: form.get("name"), level: Number(form.get("level")), quantity: Number(form.get("quantity")), content_id: `creature/custom/${String(form.get("name")).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}/current`, participation_mode: "mandatory" }, "Participant added"); });
  app.querySelector('[data-action="search-catalog"]').addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); const nextState = { ...activeCatalogState, query: String(form.get("query") ?? ""), kind: String(form.get("kind") ?? "creature"), levelMin: String(form.get("levelMin") ?? ""), levelMax: String(form.get("levelMax") ?? ""), traits: String(form.get("traits") ?? ""), rarity: String(form.get("rarity") ?? ""), sources: String(form.get("sources") ?? ""), environments: String(form.get("environments") ?? ""), roles: String(form.get("roles") ?? ""), edition: String(form.get("edition") ?? "current"), spellcasting: String(form.get("spellcasting") ?? ""), hazardComplexity: String(form.get("hazardComplexity") ?? ""), completeness: String(form.get("completeness") ?? "complete"), support: String(form.get("support") ?? "supported"), limit: Number(form.get("limit") ?? 4), offset: 0, inspectedContentID: null }; nextState.results = catalog.search(catalogSearchRequest(nextState)); render({ asset, engine, catalog, catalogState: nextState, notice: "Catalog filters updated" }); });
  app.querySelector('[data-catalog-reset]').addEventListener("click", () => { const nextState = { ...DEFAULT_CATALOG_STATE, results: catalog.search(catalogSearchRequest(DEFAULT_CATALOG_STATE)) }; render({ asset, engine, catalog, catalogState: nextState, notice: "Catalog filters reset" }); });
  app.querySelectorAll("[data-catalog-page]").forEach((button) => button.addEventListener("click", () => { const offset = Math.max(0, activeCatalogState.offset + (button.dataset.catalogPage === "next" ? Number(activeCatalogState.limit) : -Number(activeCatalogState.limit))); const nextState = { ...activeCatalogState, offset, inspectedContentID: null }; nextState.results = catalog.search(catalogSearchRequest(nextState)); render({ asset, engine, catalog, catalogState: nextState, notice: "Catalog page updated" }); }));
  app.querySelectorAll("[data-catalog-inspect]").forEach((button) => button.addEventListener("click", () => { const nextState = { ...activeCatalogState, inspectedContentID: button.dataset.catalogInspect }; render({ asset, engine, catalog, catalogState: nextState, notice: "Catalog entry inspected" }); }));
  app.querySelector("[data-catalog-close]")?.addEventListener("click", () => { const nextState = { ...activeCatalogState, inspectedContentID: null }; render({ asset, engine, catalog, catalogState: nextState, notice: "Catalog inspection closed" }); });
  app.querySelectorAll("[data-catalog-add]").forEach((button) => button.addEventListener("click", () => { const prepared = catalog.addExistingCreatureCommand(button.dataset.catalogAdd); if (!prepared.ok) return render({ asset, engine, catalog, catalogState: activeCatalogState, notice: prepared.error.message }); mutate(prepared.command, `${prepared.entry.name} added from Catalog`); }));
  app.querySelectorAll("[data-catalog-hazard-add]").forEach(button => button.addEventListener("click", () => { const entry = catalog.get(button.dataset.catalogHazardAdd); if (!entry) return render({ asset, engine, catalog, catalogState: activeCatalogState, notice: "Catalog Hazard is no longer available." }); mutate({ command: "sidekickdm_add_existing_hazard", content_id: entry.content_id, name: entry.name, level: entry.level, complexity: entry.hazard_complexity ?? "simple", participation_mode: "avoidable", placement: "Encounter area" }, `${entry.name} added from Catalog`); }));
  app.querySelectorAll("[data-catalog-component]").forEach((field) => field.addEventListener("change", () => { const prepared = catalog.updateParticipantCommand(field.dataset.catalogComponent, { [field.dataset.catalogField]: field.dataset.catalogField === "quantity" ? Number(field.value) : field.value }); if (!prepared.ok) return render({ asset, engine, catalog, catalogState: activeCatalogState, notice: prepared.error.message }); mutate(prepared.command, "Catalog participant updated"); }));
  app.querySelectorAll("[data-pwl-group]").forEach(field => field.addEventListener("change", () => { if (field.checked) uiState.proficiencyWithoutLevel.add(field.dataset.pwlGroup); else uiState.proficiencyWithoutLevel.delete(field.dataset.pwlGroup); render({ asset, engine, catalog, catalogState: activeCatalogState, notice: field.checked ? "Proficiency without level shown" : "Standard proficiency shown" }); }));
  app.querySelectorAll("[data-creature-remove]").forEach(button => button.addEventListener("click", () => mutate({ command: "sidekickdm_remove_component", component_id: button.dataset.creatureRemove }, "Creature removed from encounter")));
  app.querySelectorAll("[data-creature-customize]").forEach(button => button.addEventListener("click", () => { const group = (draft.participantGroups ?? []).find(item => item.id === button.dataset.creatureCustomize); const entry = group ? catalog?.get?.(group.contentID ?? group.content_id) : null; if (!entry) return; uiState.creature = forkExistingCreature(entry, { id: `cre_custom_${group.id}`, origin: "gm" }); uiState.replacingParticipantID = group.id; uiState.activeModal = "creature"; render({ asset, engine, catalog, catalogState: activeCatalogState, notice: `${group.name} opened in the monster creator` }); }));
  app.querySelectorAll("[data-creature-edit]").forEach(button => button.addEventListener("click", () => { const creature = (draft.originalCreatures ?? []).find(item => item.id === button.dataset.creatureEdit); if (creature) { uiState.creature = structuredClone(creature); uiState.replacingParticipantID = null; uiState.activeModal = "creature"; } render({ asset, engine, catalog, catalogState, notice: "Custom creature opened for editing" }); }));
  app.querySelectorAll("[data-hazard-edit]").forEach(button => button.addEventListener("click", () => { const snapshotHazard = (draft.customHazards ?? []).find(item => item.id === button.dataset.hazardEdit); const placement = (draft.hazards ?? []).find(item => item.id === button.dataset.hazardEdit); if (snapshotHazard) { uiState.hazard = { ...structuredClone(snapshotHazard), participation: structuredClone(placement?.participation ?? { mode: "avoidable" }) }; uiState.activeModal = "hazard"; } render({ asset, engine, catalog, catalogState, notice: "Hazard opened for editing" }); }));
  app.querySelectorAll("[data-npc-open]").forEach(button => button.addEventListener("click", () => { uiState.npcTarget = button.dataset.npcOpen; uiState.npc = (draft.npcProfiles ?? []).find(item => (item.participantGroupID ?? item.participant_group_id) === button.dataset.npcOpen) ?? null; uiState.activeModal = "npc"; render({ asset, engine, catalog, catalogState, notice: "NPC profile opened" }); }));
  app.querySelector('[data-action="undo"]').addEventListener("click", () => mutate({ command: "sidekickdm_undo" }, "Undid mutation"));
  app.querySelector('[data-action="redo"]').addEventListener("click", () => mutate({ command: "sidekickdm_redo" }, "Redid mutation"));
  const exportEncounter = async (archive) => {
    try {
      const library = await encounterStore.readLibrary();
      const currentDraft = engine.snapshot.encounter ?? engine.snapshot.draft;
      const components = componentBundle(currentDraft, catalog, uiState.restoredComponents);
      const attachments = attachmentsForRecords([currentDraft, ...Object.values(components).flat()], library?.attachments);
      if (archive) downloadBytes(`${currentDraft.id}.sidekickdm.zip`, await createEncounterArchive({ encounter: currentDraft, components, attachments, exportedAt: new Date().toISOString() }));
      else downloadText(`${currentDraft.id}.sidekickdm.json`, encounterJSON(engine, catalog, uiState.restoredComponents, attachments));
    } catch (error) { render({ asset, engine, catalog, catalogState: activeCatalogState, notice: error instanceof Error ? error.message : String(error) }); }
  };
  app.querySelector('[data-action="export-encounter"]').addEventListener("click", () => void exportEncounter(false));
  app.querySelector('[data-action="export-encounter-zip"]').addEventListener("click", () => void exportEncounter(true));
  app.querySelector('[data-action="print-encounter"]').addEventListener("click", () => openPrintPreview(engine, catalog));
  const selectedComponents = () => {
    const selected = new Map();
    app.querySelectorAll("[data-library-select]:checked").forEach(field => { if (!selected.has(field.dataset.librarySelect)) selected.set(field.dataset.librarySelect, new Set()); selected.get(field.dataset.librarySelect).add(field.value); });
    const pick = (records, kind) => (records ?? []).filter(record => selected.get(kind)?.has(record.id));
    return { creatures: pick(reusableLibrary.creatures, "creatures"), npcProfiles: pick(reusableLibrary.npcProfiles, "npcProfiles"), hazards: pick(reusableLibrary.hazards, "hazards"), partyProfiles: pick(reusableLibrary.partyProfiles, "partyProfiles") };
  };
  const exportSelected = async (archive) => {
    try {
      const library = await encounterStore.readLibrary();
      const components = selectedComponents();
      const records = Object.values(components).flat();
      const attachments = attachmentsForRecords(records, library.attachments);
      if (archive) downloadBytes(`${draft.id}.components.sidekickdm.zip`, await createComponentsArchive({ components, attachments, exportedAt: new Date().toISOString() }));
      else downloadText(`${draft.id}.components.sidekickdm.json`, createComponentsFile({ components, attachments, exportedAt: new Date().toISOString() }));
    } catch (error) { render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) }); }
  };
  app.querySelector('[data-action="export-components-json"]').addEventListener("click", () => void exportSelected(false));
  app.querySelector('[data-action="export-components-zip"]').addEventListener("click", () => void exportSelected(true));
  const exportLibrary = async (archive) => {
    try { const library = await encounterStore.readLibrary(); if (archive) downloadBytes("sidekickdm-library.v1.sidekickdm.zip", await createLibraryArchive({ library, attachments: library.attachments, exportedAt: new Date().toISOString() })); else downloadText("sidekickdm-library.v1.json", createLibraryFile({ library, exportedAt: new Date().toISOString() })); }
    catch (error) { render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) }); }
  };
  app.querySelector('[data-action="export-library-json"]').addEventListener("click", () => void exportLibrary(false));
  app.querySelector('[data-action="export-library-zip"]').addEventListener("click", () => void exportLibrary(true));
  const readTransferFile = async (file) => /\.zip$/i.test(file.name) || file.type === "application/zip" ? new Uint8Array(await file.arrayBuffer()) : await file.text();
  const importReusable = (selector, importer, label) => app.querySelector(selector).addEventListener("change", async event => {
    const file = event.currentTarget.files?.[0]; if (!file) return;
    try { const result = await importer(await readTransferFile(file), { importedAt: new Date().toISOString() }); uiState.restoredComponents = await encounterStore.readLibrary(); render({ asset, engine, catalog, catalogState, notice: importNotice(label, result) }); }
    catch (error) { render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) }); }
  });
  importReusable('[data-action="import-components"]', (contents, options) => encounterStore.importComponents(contents, options), "Components");
  importReusable('[data-action="import-components-zip"]', (contents, options) => encounterStore.importArchive(contents, { ...options, expectedExportKind: "components" }), "Components ZIP");
  importReusable('[data-action="import-library"]', (contents, options) => encounterStore.importLibrary(contents, options), "Library");
  importReusable('[data-action="import-library-zip"]', (contents, options) => encounterStore.importArchive(contents, { ...options, expectedExportKind: "library" }), "Library ZIP");
  app.querySelector('[data-action="import-encounter"]').addEventListener("change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const imported = await encounterStore.prepareEncounter(await file.text(), { importedAt: new Date().toISOString() });
      const restored = issue(engine, { command: "sidekickdm_load_draft", draft_json: JSON.stringify(imported.draft), origin: "import" }, { persist: false });
      if (!restored.ok) throw new Error(restored.error?.message ?? "The Encounter could not be restored.");
      await encounterStore.persistEncounter(imported, { currentKey: "current" });
      uiState.restoredComponents = imported.components;
      engine.snapshot = restored.snapshot;
      render({ asset, engine, catalog, catalogState, notice: importNotice("Encounter", imported) });
    } catch (error) {
      render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) });
    }
  });
  app.querySelector('[data-action="import-encounter-zip"]').addEventListener("change", async event => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const prepared = await encounterStore.prepareArchive(await readTransferFile(file), { importedAt: new Date().toISOString(), expectedExportKind: "encounter" });
      if (!prepared.draft) throw new Error("The archive does not contain an Encounter export.");
      const restored = issue(engine, { command: "sidekickdm_load_draft", draft_json: JSON.stringify(prepared.draft), origin: "import" }, { persist: false });
      if (!restored.ok) throw new Error(restored.error?.message ?? "The Encounter could not be restored.");
      await encounterStore.persistArchive(prepared, { currentKey: "current" });
      engine.snapshot = restored.snapshot;
      uiState.restoredComponents = prepared.components;
      render({ asset, engine, catalog, catalogState, notice: importNotice("Encounter ZIP", prepared) });
    } catch (error) {
      render({ asset, engine, catalog, catalogState, notice: error instanceof Error ? error.message : String(error) });
    }
  });
  app.querySelector('[data-action="increment"]').addEventListener("click", () => { const result = issue(engine, { command: "sidekick_increment", expected_revision: draft.revision, origin: "gm" }); if (!result.ok) return render({ asset, engine: { ...engine, snapshot: result.snapshot }, catalog, catalogState, notice: result.error?.message }); engine.snapshot = result.snapshot; render({ asset, engine, catalog, catalogState, bridgeMessage: globalThis.sidekickBridge.notifySwiftValue(result.snapshot.draft.swiftOwnedValue), notice: "Swift-owned state changed" }); });
  app.querySelectorAll("[data-phase-edit]").forEach(button => button.addEventListener("click", () => { uiState.phaseID = button.dataset.phaseEdit; uiState.phase = null; uiState.activeModal = "phase"; render({ asset, engine, catalog, catalogState, notice: "Phase opened for editing" }); }));
  app.querySelector('[data-action="new-phase"]').addEventListener("click", () => { uiState.phaseID = null; uiState.phase = createEmptyPhase({ order: authoredPhases.length }); uiState.activeModal = "phase"; render({ asset, engine, catalog, catalogState, notice: "New phase ready" }); });
  createCreatureBuilder({
    root: app.querySelector("#creature-builder-root"),
    creature: uiState.creature ?? createEmptyOriginalCreature(),
    partyLevel: party.effectiveLevel,
    onMutation: ({ creature }) => { uiState.creature = creature; },
    onAutosave: (envelope) => { uiState.creature = envelope.creature; void saveRecord("original-creature", envelope); void encounterStore.saveLibraryRecord("creature", envelope.creature).catch(() => false); },
    onAddToEncounter: ({ creature }) => {
      const exists = (draft.originalCreatures ?? []).some(item => item.id === creature.id);
      if (uiState.replacingParticipantID) {
        const removed = issue(engine, { command: "sidekickdm_remove_component", component_id: uiState.replacingParticipantID, expected_revision: draft.revision, origin: "gm" }, { persist: false });
        if (!removed.ok) return render({ asset, engine: { ...engine, snapshot: removed.snapshot }, catalog, catalogState: activeCatalogState, notice: removed.error?.message });
        engine.snapshot = removed.snapshot;
        const nextDraft = removed.snapshot.encounter ?? removed.snapshot.draft;
        const created = issue(engine, { command: "sidekickdm_create_custom_creature", creature, quantity: 1, expected_revision: nextDraft.revision, origin: "gm" }, { persist: false });
        if (!created.ok) {
          const rollback = engine.execute({ command: "sidekickdm_load_draft", draft_json: JSON.stringify(draft), origin: "rollback" });
          if (rollback.ok) engine.snapshot = rollback.snapshot;
          return render({ asset, engine, catalog, catalogState: activeCatalogState, notice: created.error?.message ?? "The custom creature could not replace the catalog creature." });
        }
        engine.snapshot = created.snapshot;
        void saveDraft(created.snapshot.encounter ?? created.snapshot.draft);
        uiState.replacingParticipantID = null;
        uiState.activeModal = null;
        return render({ asset, engine, catalog, catalogState: activeCatalogState, notice: `${creature.identity.name} replaced the catalog creature` });
      }
      uiState.activeModal = null;
      mutate({ command: exists ? "sidekickdm_update_custom_creature" : "sidekickdm_create_custom_creature", creature, quantity: 1 }, `${creature.identity.name} ${exists ? "updated" : "created and added"}`);
    }
  });
  createHazardBuilder({
    root: app.querySelector("#hazard-builder-root"),
    hazard: uiState.hazard ?? createEmptySimpleHazard(),
    partyLevel: party.effectiveLevel,
    participation: uiState.hazard?.participation?.mode ?? "avoidable",
    onMutation: ({ hazard }) => { uiState.hazard = hazard; },
    onAutosave: (envelope) => { uiState.hazard = envelope.hazard; void saveRecord("simple-hazard", envelope); void encounterStore.saveLibraryRecord("hazard", envelope.hazard).catch(() => false); },
    onAddToEncounter: ({ hazard, participationMode, participation }) => mutate({ command: "sidekickdm_create_simple_hazard", hazard, participation_mode: participationMode, participation_condition: participation?.condition, placement: "Encounter area" }, `${hazard.identity.name} created and placed`),
    onEditHazard: ({ hazard, participationMode, participation }) => mutate({ command: "sidekickdm_update_hazard", hazard, participation_mode: participationMode, participation_condition: participation?.condition, placement: (draft.hazards ?? []).find(item => item.id === hazard.id)?.placement ?? "Encounter area" }, `${hazard.identity.name} updated`),
    onRemoveHazard: ({ hazard }) => { mutate({ command: "sidekickdm_remove_component", component_id: hazard.id }, `${hazard.identity.name || "Hazard"} removed`); uiState.hazard = createEmptySimpleHazard(); }
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
      onAutosave: (envelope) => { uiState.npc = envelope.profile; void saveRecord("npc-profile", envelope); void encounterStore.saveLibraryRecord("npcProfile", envelope.profile).catch(() => false); }
    });
  }
  const phaseValue = authoredPhases.find(item => item.id === uiState.phaseID) ?? uiState.phase ?? authoredPhases[0] ?? createEmptyPhase({ order: authoredPhases.length });
  uiState.phaseID = phaseValue.id;
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
  if (manualLocked) {
    app.querySelectorAll("input, select, textarea, button").forEach(control => {
      if (!control.matches('[data-action^="export-"], [data-action="print-encounter"], [data-modal-open], [data-modal-close], [data-catalog-inspect], [data-catalog-close]')) control.disabled = true;
    });
  }
  const activeDialog = uiState.activeModal ? app.querySelector(`[data-modal="${uiState.activeModal}"]`) : null;
  if (activeDialog && !activeDialog.open) activeDialog.showModal();
}

try {
  const [loaded, catalog] = await Promise.all([loadBootAssets(), loadCatalog()]);
  const [saved, savedCreature, savedHazard, savedPacket, savedNPC, savedPhase, savedLibrary] = await Promise.all([loadSavedDraft(), loadRecord("original-creature"), loadRecord("simple-hazard"), loadRecord("encounter-packet"), loadRecord("npc-profile"), loadRecord("encounter-phase"), encounterStore.readLibrary().catch(() => null)]);
  uiState.creature = savedCreature?.creature ?? null;
  uiState.hazard = savedHazard?.hazard ?? null;
  uiState.packet = savedPacket?.packet ?? null;
  uiState.npc = savedNPC?.profile ? fromNativeNPCProfile(savedNPC.profile) : null;
  uiState.phase = savedPhase?.phase ?? null;
  uiState.restoredComponents = savedLibrary;
  if (saved && loaded.engine.available) { const payload = JSON.stringify(saved); const restored = loaded.engine.execute({ command: "sidekick_load_draft", draft_json: payload, origin: "reload" }); if (restored.ok) loaded.engine.snapshot = restored.snapshot; }
  const webMCP = createWebMCPAdapter({ engine: loaded.engine, catalog, onMutation: async draft => { await saveDraft(draft); render({ asset: loaded.asset, engine: loaded.engine, catalog, notice: "WebMCP mutation saved." }); } });
  uiState.webMCPStatus = (await webMCP.register()).label;
  globalThis.sidekickDM = Object.freeze({ asset: loaded.asset, engine: loaded.engine, catalog, webMCP, bridge: globalThis.sidekickBridge, persistence: { loadSavedDraft, saveDraft, loadRecord, saveRecord }, actions: { exportEncounter: () => encounterJSON(loaded.engine, catalog), printEncounter: () => encounterPrintHTML(loaded.engine, catalog) } });
  render({ asset: loaded.asset, engine: loaded.engine, catalog, notice: saved ? "Encounter Draft reloaded from IndexedDB." : "New Encounter Draft ready." });
} catch (error) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not load</h1><p>${escapeHtml(error instanceof Error ? error.message : error)}</p></section>`; }
