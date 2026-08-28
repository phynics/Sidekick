import { loadBootAssets } from "./boot.js";

const app = document.querySelector("#app");
const STORAGE_DB = "sidekick-dm";
const STORAGE_STORE = "encounters";
globalThis.sidekickBridge = Object.freeze({ notifySwiftValue(value) { return `JavaScript bridge received Swift value ${value}.`; } });

function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function openStore() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return new Promise((resolve, reject) => { const request = indexedDB.open(STORAGE_DB, 1); request.onupgradeneeded = () => request.result.createObjectStore(STORAGE_STORE); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
}
async function loadSavedDraft() { try { const db = await openStore(); if (!db) return null; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE).objectStore(STORAGE_STORE).get("current"); request.onsuccess = () => resolve(request.result ?? null); request.onerror = () => reject(request.error); }); } catch { return null; } }
async function saveDraft(draft) { try { const db = await openStore(); if (!db) return false; return await new Promise((resolve, reject) => { const request = db.transaction(STORAGE_STORE, "readwrite").objectStore(STORAGE_STORE).put(draft, "current"); request.onsuccess = () => resolve(true); request.onerror = () => reject(request.error); }); } catch { return false; } }

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

function render({ asset, engine, bridgeMessage = "", notice = "" }) {
  if (!engine.available) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not start</h1><p>${escapeHtml(engine.reason)}</p></section>`; return; }
  const snapshot = engine.snapshot; const draft = snapshot.encounter ?? snapshot.draft; const party = draft.brief?.party ?? { effectiveLevel: 1, size: 4 }; const target = draft.brief?.threatTarget ?? { kind: "moderate", customXP: null }; const budget = snapshot.budget ?? { baseTargetXP: 80, constructionBudget: 80, baseXPAward: 80, guaranteedXP: 0, avoidableXP: 0, conditionalXP: 0, peakActiveXP: 0, totalEncounterXP: 0, inferredThreat: "trivial", warnings: [] };
  const participants = (draft.participantGroups ?? []).map((group) => `<li data-testid="participant-${escapeHtml(group.id)}"><strong>${escapeHtml(group.quantity)} × ${escapeHtml(group.name)}</strong><span>Level ${group.level} · ${escapeHtml(group.participation?.mode ?? "mandatory")}</span></li>`).join("");
  const activities = (snapshot.activity ?? []).slice(0, 6).map((entry) => `<li><span>${escapeHtml(entry.description)}</span><small>${escapeHtml(entry.origin)} · rev ${entry.afterRevision}</small></li>`).join("");
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
          <form data-action="add-participant" class="add-form"><input name="name" placeholder="Creature name" required><input name="level" type="number" value="${party.effectiveLevel}" aria-label="Creature level"><input name="quantity" type="number" min="1" value="1" aria-label="Quantity"><button type="submit">Add participant</button></form>
          <div class="controls"><button type="button" data-action="undo" ${snapshot.canUndo ? "" : "disabled"}>Undo</button><button type="button" data-action="redo" ${snapshot.canRedo ? "" : "disabled"}>Redo</button><button type="button" data-action="increment" class="legacy-control">Change Swift state</button></div><span class="sr-only">Swift-owned value <span data-testid="swift-value">${draft.swiftOwnedValue}</span></span>
          <p class="status" data-testid="notice">${escapeHtml(notice || "Ready for a semantic mutation.")}</p>
        </section>
        <aside class="panel activity-panel"><h2>Activity</h2><ul>${activities || "<li class=empty>No mutations yet.</li>"}</ul><p class="status" data-testid="asset-status">${escapeHtml(asset.asset_message)}</p><p class="status" data-testid="bridge-status">${escapeHtml(bridgeMessage || "JavaScript bridge waiting.")}</p></aside>
      </div>
    </main>`;

  const mutate = (command, message = "Saved") => { const result = issue(engine, { ...command, expected_revision: draft.revision, origin: "gm" }); if (!result.ok) { render({ asset, engine: { ...engine, snapshot: result.snapshot }, notice: result.error?.message }); return; } engine.snapshot = result.snapshot; render({ asset, engine, notice: message }); };
  app.querySelectorAll("[data-field]").forEach((field) => field.addEventListener("change", () => {
    const key = field.dataset.field;
    if (key === "effective_level" || key === "size") mutate({ command: "sidekickdm_set_party_snapshot", effective_level: Number(app.querySelector('[data-field="effective_level"]').value), size: Number(app.querySelector('[data-field="size"]').value) }, "Party Snapshot saved");
    else if (key === "threat") mutate({ command: "sidekickdm_set_threat_target", kind: field.value, custom_xp: Number(app.querySelector('[data-testid="custom-xp"]')?.value ?? 0) }, "Threat Target saved");
    else if (key === "custom_xp") mutate({ command: "sidekickdm_set_threat_target", kind: "custom", custom_xp: Number(field.value) }, "Custom Threat Target saved");
    else if (key === "title") mutate({ command: "sidekickdm_set_encounter_identity", title: field.value }, "Encounter identity saved");
  }));
  app.querySelector('[data-action="add-participant"]').addEventListener("submit", (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutate({ command: "sidekickdm_add_participant_group", name: form.get("name"), level: Number(form.get("level")), quantity: Number(form.get("quantity")), content_id: `creature/custom/${String(form.get("name")).toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}/current`, participation_mode: "mandatory" }, "Participant added"); });
  app.querySelector('[data-action="undo"]').addEventListener("click", () => mutate({ command: "sidekickdm_undo" }, "Undid mutation"));
  app.querySelector('[data-action="redo"]').addEventListener("click", () => mutate({ command: "sidekickdm_redo" }, "Redid mutation"));
  app.querySelector('[data-action="increment"]').addEventListener("click", () => { const result = issue(engine, { command: "sidekick_increment", expected_revision: draft.revision, origin: "gm" }); if (!result.ok) return render({ asset, engine: { ...engine, snapshot: result.snapshot }, notice: result.error?.message }); engine.snapshot = result.snapshot; render({ asset, engine, bridgeMessage: globalThis.sidekickBridge.notifySwiftValue(result.snapshot.draft.swiftOwnedValue), notice: "Swift-owned state changed" }); });
}

try {
  const loaded = await loadBootAssets();
  const saved = await loadSavedDraft();
  if (saved && loaded.engine.available) { const payload = JSON.stringify(saved); const restored = loaded.engine.execute({ command: "sidekick_load_draft", draft_json: payload, origin: "reload" }); if (restored.ok) loaded.engine.snapshot = restored.snapshot; }
  globalThis.sidekickDM = Object.freeze({ asset: loaded.asset, engine: loaded.engine, bridge: globalThis.sidekickBridge, persistence: { loadSavedDraft, saveDraft } });
  render({ asset: loaded.asset, engine: loaded.engine, notice: saved ? "Encounter Draft reloaded from IndexedDB." : "New Encounter Draft ready." });
} catch (error) { app.innerHTML = `<section class="panel error"><h1>Sidekick DM could not load</h1><p>${escapeHtml(error instanceof Error ? error.message : error)}</p></section>`; }
