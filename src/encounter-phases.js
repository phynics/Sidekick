/* Structured Phase authoring. This browser module is intentionally pure apart
 * from the optional editor: a host can forward the emitted upsert/undo/redo
 * commands to SidekickDMCore or use the local store for an offline draft. */

export const PHASE_TRIGGER_TYPES = Object.freeze([
  "round", "hit_point_threshold", "alarm", "zone_entry", "hazard_disabled",
  "objective_completed", "gm_action", "custom"
]);
export const PARTICIPATION_MODES = Object.freeze(["mandatory", "avoidable", "conditional", "reinforcement"]);

const clone = value => structuredClone(value);
const text = value => typeof value === "string" && value.trim().length > 0;
const issue = (code, field, message) => ({ code, field, message });
const fixedOrder = (left, right) => { const a = String(left ?? ""); const b = String(right ?? ""); return a < b ? -1 : a > b ? 1 : 0; };

export function createEmptyPhase({ id = `phase_${globalThis.crypto?.randomUUID?.() ?? "draft"}`, order = 0 } = {}) {
  return {
    objectVersion: 1,
    id,
    title: "",
    order,
    trigger: { kind: "custom", explanation: "", value: null, canOverlap: true },
    participantIDs: [],
    hazardIDs: [],
    terrainChanges: [],
    runningGuidance: "",
    terrainAdjustment: 0,
    revision: 0
  };
}

export function validatePhase(phase = createEmptyPhase(), { participantGroups = [], hazards = [] } = {}) {
  const value = phase ?? {};
  const structuralErrors = [];
  const designWarnings = [];
  if (Number(value.objectVersion ?? 1) !== 1) structuralErrors.push(issue("unsupported_version", "objectVersion", "Phase object version must be 1."));
  if (!text(value.id)) structuralErrors.push(issue("required", "id", "A Phase ID is required."));
  if (!text(value.title)) structuralErrors.push(issue("required", "title", "A Phase title is required."));
  const trigger = value.trigger ?? {};
  if (!PHASE_TRIGGER_TYPES.includes(trigger.kind)) structuralErrors.push(issue("invalid_trigger", "trigger.kind", "Phase trigger type is not supported."));
  if (!text(trigger.explanation)) structuralErrors.push(issue("required", "trigger.explanation", "A Phase trigger explanation is required."));
  if (!Array.isArray(value.participantIDs)) structuralErrors.push(issue("invalid_reference_list", "participantIDs", "Active participant references must be a list."));
  if (!Array.isArray(value.hazardIDs)) structuralErrors.push(issue("invalid_reference_list", "hazardIDs", "Active Hazard references must be a list."));
  const groupIDs = new Set((participantGroups ?? []).map(item => item.id));
  const hazardIDs = new Set((hazards ?? []).map(item => item.id));
  const seenParticipants = new Set();
  for (const id of value.participantIDs ?? []) {
    if (!groupIDs.has(id)) structuralErrors.push(issue("unknown_participant_reference", `participantIDs.${id}`, `Phase references unknown Participant Group ${id}.`));
    if (seenParticipants.has(id)) structuralErrors.push(issue("duplicate_participant_reference", `participantIDs.${id}`, `Phase references Participant Group ${id} more than once.`));
    seenParticipants.add(id);
  }
  const seenHazards = new Set();
  for (const id of value.hazardIDs ?? []) {
    if (!hazardIDs.has(id)) structuralErrors.push(issue("unknown_hazard_reference", `hazardIDs.${id}`, `Phase references unknown Hazard ${id}.`));
    if (seenHazards.has(id)) structuralErrors.push(issue("duplicate_hazard_reference", `hazardIDs.${id}`, `Phase references Hazard ${id} more than once.`));
    seenHazards.add(id);
  }
  if (!text(value.runningGuidance)) designWarnings.push(issue("missing_guidance", "runningGuidance", "Phase-specific running guidance will make the packet easier to run."));
  if (!(value.terrainChanges ?? []).length) designWarnings.push(issue("missing_terrain", "terrainChanges", "Document terrain or state changes when this Phase starts."));
  if (!Number.isInteger(value.terrainAdjustment ?? 0)) structuralErrors.push(issue("invalid_terrain_adjustment", "terrainAdjustment", "Terrain adjustment must be an integer."));
  return { structuralErrors, designWarnings, status: structuralErrors.length ? "incomplete" : designWarnings.length ? "ready with warnings" : "ready", isStructurallyReady: structuralErrors.length === 0 };
}

const creatureXP = [10, 15, 20, 30, 40, 60, 80, 120, 160];
const simpleHazardXP = [2, 3, 4, 6, 8, 12, 16, 24, 30];
const complexHazardXP = [10, 15, 20, 30, 40, 60, 80, 120, 150];
function relativeValue(table, relative, above) { return relative < -4 ? 0 : relative > 4 ? above : table[relative + 4]; }
function adjustedLevel(level, adjustment) { return Number(level) + (adjustment === "weak" ? -1 : adjustment === "elite" ? 1 : 0); }

export function hazardXPForLevel(level, partyLevel = 1, complexity = "simple") {
  const table = complexity === "complex" ? complexHazardXP : simpleHazardXP;
  const relative = Number(level ?? partyLevel) - Number(partyLevel);
  return relativeValue(table, relative, complexity === "complex" ? 150 : 30);
}

export function creatureXPForLevel(level, partyLevel = 1, quantity = 1, adjustment = "normal") {
  return relativeValue(creatureXP, adjustedLevel(level ?? partyLevel, adjustment) - Number(partyLevel), 160) * Math.max(0, Number(quantity ?? 1));
}

export function projectPhaseXP(phase, { participantGroups = [], hazards = [], partyLevel = 1 } = {}) {
  const participation = { mandatoryXP: 0, avoidableXP: 0, conditionalXP: 0, reinforcementXP: 0 };
  const add = (xp, mode) => { const key = mode === "mandatory" ? "mandatoryXP" : mode === "avoidable" ? "avoidableXP" : mode === "reinforcement" ? "reinforcementXP" : "conditionalXP"; participation[key] += xp; };
  for (const group of participantGroups ?? []) if ((phase.participantIDs ?? []).includes(group.id)) add(creatureXPForLevel(group.level ?? partyLevel, partyLevel, group.quantity, group.adjustment), group.participation?.mode ?? "mandatory");
  for (const hazard of hazards ?? []) if ((phase.hazardIDs ?? []).includes(hazard.id)) add(hazardXPForLevel(hazard.level ?? partyLevel, partyLevel, hazard.complexity), hazard.participation?.mode ?? "mandatory");
  return { phaseID: phase.id, title: phase.title, participantIDs: [...(phase.participantIDs ?? [])], hazardIDs: [...(phase.hazardIDs ?? [])], participation, activeXP: Object.values(participation).reduce((sum, value) => sum + value, 0), terrainAdjustment: Number(phase.terrainAdjustment ?? 0) };
}

export function projectPhasesToPacket(document = {}) {
  const phases = [...(document.phases ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || fixedOrder(a.id, b.id));
  const perPhase = phases.map(phase => projectPhaseXP(phase, document));
  const groups = document.participantGroups ?? [];
  const hazards = document.hazards ?? [];
  const aggregate = { mandatoryXP: 0, avoidableXP: 0, conditionalXP: 0, reinforcementXP: 0 };
  const add = (xp, mode) => { const key = mode === "mandatory" ? "mandatoryXP" : mode === "avoidable" ? "avoidableXP" : mode === "reinforcement" ? "reinforcementXP" : "conditionalXP"; aggregate[key] += xp; };
  const partyLevel = Number(document.partyLevel ?? document.brief?.party?.effectiveLevel ?? document.brief?.party?.effective_level ?? 1);
  for (const group of groups) add(creatureXPForLevel(group.level ?? partyLevel, partyLevel, group.quantity, group.adjustment), group.participation?.mode ?? "mandatory");
  for (const hazard of hazards) add(hazardXPForLevel(hazard.level ?? partyLevel, partyLevel, hazard.complexity), hazard.participation?.mode ?? "mandatory");
  const warnings = [];
  phases.forEach((phase, index) => phases.slice(index + 1).forEach(other => {
    const shared = [...new Set([...(phase.participantIDs ?? []), ...(phase.hazardIDs ?? [])].filter(id => [...(other.participantIDs ?? []), ...(other.hazardIDs ?? [])].includes(id)))];
    if (shared.length && ((phase.trigger?.canOverlap ?? true) || (other.trigger?.canOverlap ?? true))) warnings.push({ phaseIDs: [phase.id, other.id], componentIDs: shared, message: `Phases ${phase.title} and ${other.title} may be active together; verify simultaneous threat. XP was not rewritten.` });
  }));
  const totalEncounterXP = Object.values(aggregate).reduce((sum, value) => sum + value, 0);
  const budget = { perPhase, guaranteedXP: aggregate.mandatoryXP, avoidableXP: aggregate.avoidableXP, conditionalXP: aggregate.conditionalXP, reinforcementXP: aggregate.reinforcementXP, peakActiveXP: perPhase.length ? Math.max(...perPhase.map(item => item.activeXP)) : totalEncounterXP, totalEncounterXP, terrainAdjustment: phases.reduce((sum, phase) => sum + Number(phase.terrainAdjustment ?? 0), 0), overlapWarnings: warnings };
  return { phases: phases.map((phase, index) => ({ id: phase.id, title: phase.title, order: phase.order ?? index, trigger: clone(phase.trigger ?? {}), participantIDs: [...(phase.participantIDs ?? [])], hazardIDs: [...(phase.hazardIDs ?? [])], terrainChanges: clone(phase.terrainChanges ?? []), runningGuidance: phase.runningGuidance ?? "", projection: perPhase[index] })), budget, designWarnings: warnings };
}

export class PhaseAuthoringStore {
  constructor(document = {}) {
    this.document = clone({ objectVersion: 1, encounterID: document.encounterID ?? document.id ?? "enc_demo", title: document.title ?? "", revision: Number(document.revision ?? 0), partyLevel: Number(document.partyLevel ?? document.brief?.party?.effectiveLevel ?? document.brief?.party?.effective_level ?? 1), partySize: Number(document.partySize ?? document.brief?.party?.size ?? 4), participantGroups: document.participantGroups ?? [], hazards: document.hazards ?? [], phases: document.phases ?? [] });
    this.history = []; this.redoHistory = []; this.origin = "gm"; this.lastMutationOrigin = "gm";
  }
  get revision() { return this.document.revision; }
  get phases() { return clone(this.document.phases); }
  get budget() { return projectPhasesToPacket(this.document).budget; }
  get packetProjection() { return projectPhasesToPacket(this.document); }
  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.redoHistory.length > 0; }
  upsert(phase, expectedRevision = null, origin = "gm") { this.check(expectedRevision); const validation = validatePhase(phase, this.document); if (validation.structuralErrors.length) { const error = new Error(validation.structuralErrors[0].message); error.code = validation.structuralErrors[0].code; error.details = validation.structuralErrors; throw error; } this.history.push(clone(this.document)); const next = clone(phase); next.revision = this.revision + 1; const index = this.document.phases.findIndex(item => item.id === next.id); if (index < 0) this.document.phases.push(next); else this.document.phases[index] = next; this.document.revision += 1; this.document.phases = this.document.phases.map(item => item.id === next.id ? next : item); this.redoHistory = []; this.lastMutationOrigin = origin; return this.revision; }
  remove(phaseID, expectedRevision = null, origin = "gm") { this.check(expectedRevision); const index = this.document.phases.findIndex(item => item.id === phaseID); if (index < 0) { const error = new Error(`Unknown Phase ${phaseID}.`); error.code = "unknown_phase"; throw error; } this.history.push(clone(this.document)); this.document.phases.splice(index, 1); this.document.revision += 1; this.redoHistory = []; this.lastMutationOrigin = origin; return this.revision; }
  undo(expectedRevision = null, origin = "gm") { this.check(expectedRevision); if (!this.history.length) throw Object.assign(new Error("There is no earlier Phase Mutation to restore."), { code: "nothing_to_undo" }); this.redoHistory.push(clone(this.document)); this.document = this.history.pop(); this.document.revision += 1; this.lastMutationOrigin = origin; return this.revision; }
  redo(expectedRevision = null, origin = "gm") { this.check(expectedRevision); if (!this.redoHistory.length) throw Object.assign(new Error("There is no undone Phase Mutation to restore."), { code: "nothing_to_redo" }); this.history.push(clone(this.document)); this.document = this.redoHistory.pop(); this.document.revision += 1; this.lastMutationOrigin = origin; return this.revision; }
  encodedState() { return JSON.stringify({ format: "sidekickdm-encounter-phases", formatVersion: 1, document: this.document, origin: this.origin, lastMutationOrigin: this.lastMutationOrigin }); }
  restore(encoded) { const state = typeof encoded === "string" ? JSON.parse(encoded) : encoded; const formatVersion = Number(state?.formatVersion ?? state?.format_version); if (state?.format !== "sidekickdm-encounter-phases" || formatVersion !== 1 || !state.document) { const error = new Error("The saved Phase authoring state is invalid."); error.code = "future_schema_version"; throw error; } for (const phase of state.document.phases ?? []) { const validation = validatePhase(phase, state.document); if (validation.structuralErrors.length) { const error = new Error(validation.structuralErrors[0].message); error.code = validation.structuralErrors[0].code; throw error; } } this.document = clone(state.document); this.origin = state.origin ?? "gm"; this.lastMutationOrigin = state.lastMutationOrigin ?? this.origin; this.history = []; this.redoHistory = []; }
  check(expectedRevision) { if (expectedRevision != null && Number(expectedRevision) !== this.revision) throw Object.assign(new Error("The Phase authoring changed after it was inspected."), { code: "stale_revision", details: { expected_revision: String(expectedRevision), current_revision: String(this.revision) } }); }
}

function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

/** Mount a semantic Phase editor. All writes are emitted as upsert commands. */
export function createEncounterPhaseEditor({ root, phase = createEmptyPhase(), participantGroups = [], hazards = [], onMutation = () => {}, onAutosave = () => {} }) {
  if (!root) throw new Error("Encounter Phase editor requires a root element.");
  let current = clone(phase); let history = []; let redoHistory = [];
  const readiness = () => validatePhase(current, { participantGroups, hazards });
  const documentForAutosave = () => ({ objectVersion: 1, encounterID: current.encounterID ?? "enc_demo", title: current.encounterTitle ?? current.title ?? "", revision: Number(current.revision ?? 0), partyLevel: Number(current.partyLevel ?? 1), partySize: Number(current.partySize ?? 4), participantGroups: clone(participantGroups), hazards: clone(hazards), phases: [clone(current)] });
  const persistence = (origin = undefined) => ({ format: "sidekickdm-encounter-phases", formatVersion: 1, document: documentForAutosave(), phase: clone(current), revision: current.revision, origin: origin ?? "gm", lastMutationOrigin: origin ?? "gm" });
  const autosave = (origin = "gm") => onAutosave(persistence(origin));
  const updateLocal = (operation, origin = "gm") => {
    const before = clone(current);
    operation(current);
    current.revision = Number(current.revision ?? 0) + 1;
    history.push(before);
    redoHistory = [];
    autosave(origin);
    render();
  };
  const render = () => {
    const result = readiness();
    const errors = [...result.structuralErrors, ...result.designWarnings].map(item => `<li data-kind="${result.structuralErrors.includes(item) ? "structural-error" : "design-warning"}">${escapeHTML(item.message)}</li>`).join("");
    root.innerHTML = `<section class="encounter-phase-editor"><header><p class="eyebrow">Encounter Phase</p><h2>${escapeHTML(current.title || "Untitled Phase")}</h2><span data-testid="phase-readiness">${escapeHTML(result.status)}</span></header><form data-phase-form><label>Title<input name="title" data-field="title" value="${escapeHTML(current.title)}"></label><label>Trigger type<select name="triggerKind" data-field="triggerKind">${PHASE_TRIGGER_TYPES.map(kind => `<option value="${kind}" ${kind === current.trigger?.kind ? "selected" : ""}>${kind}</option>`).join("")}</select></label><label>Trigger explanation<textarea name="triggerExplanation" data-field="triggerExplanation">${escapeHTML(current.trigger?.explanation)}</textarea></label><label>Active Participant Group IDs<input name="participantIDs" data-field="participantIDs" value="${escapeHTML((current.participantIDs ?? []).join(", "))}"></label><label>Active Hazard IDs<input name="hazardIDs" data-field="hazardIDs" value="${escapeHTML((current.hazardIDs ?? []).join(", "))}"></label><label>Terrain changes <span>(one item per line)</span><textarea name="terrainChanges" data-field="terrainChanges">${escapeHTML((current.terrainChanges ?? []).map(item => item.description ?? item).join("\n"))}</textarea></label><label>Running guidance<textarea name="runningGuidance" data-field="runningGuidance">${escapeHTML(current.runningGuidance)}</textarea></label><section aria-live="polite"><p>${result.structuralErrors.length} structural error(s), ${result.designWarnings.length} design warning(s)</p><ul>${errors}</ul></section><footer><button type="submit" ${result.structuralErrors.length ? "disabled" : ""}>Save Phase</button><button type="button" data-action="undo" ${history.length ? "" : "disabled"}>Undo draft edit</button><button type="button" data-action="redo" ${redoHistory.length ? "" : "disabled"}>Redo draft edit</button><span>Draft revision ${current.revision}</span></footer></form></section>`;
    root.querySelectorAll("[data-field]").forEach(field => field.addEventListener("change", () => updateLocal(value => {
      if (field.dataset.field === "title") value.title = field.value;
      else if (field.dataset.field === "triggerKind") value.trigger.kind = field.value;
      else if (field.dataset.field === "triggerExplanation") value.trigger.explanation = field.value;
      else if (field.dataset.field === "participantIDs") value.participantIDs = field.value.split(",").map(item => item.trim()).filter(Boolean);
      else if (field.dataset.field === "hazardIDs") value.hazardIDs = field.value.split(",").map(item => item.trim()).filter(Boolean);
      else if (field.dataset.field === "terrainChanges") value.terrainChanges = field.value.split("\n").map(description => ({ title: "", description: description.trim() })).filter(item => item.description);
      else if (field.dataset.field === "runningGuidance") value.runningGuidance = field.value;
    })));
    root.querySelector("[data-phase-form]").addEventListener("submit", event => {
      event.preventDefault();
      const validation = readiness();
      if (validation.structuralErrors.length) return;
      onMutation({ command: "sidekickdm_upsert_phase", phase: clone(current), origin: "gm" });
    });
    root.querySelector('[data-action="undo"]').addEventListener("click", () => { if (!history.length) return; redoHistory.push(clone(current)); current = history.pop(); current.revision += 1; autosave(); render(); });
    root.querySelector('[data-action="redo"]').addEventListener("click", () => { if (!redoHistory.length) return; history.push(clone(current)); current = redoHistory.pop(); current.revision += 1; autosave(); render(); });
  };
  render();
  return { get phase() { return clone(current); }, get revision() { return current.revision; }, get readiness() { return readiness(); }, render, setPhase(next, origin = "gm") { updateLocal(value => Object.assign(value, clone(next)), origin); }, undo() { if (history.length) { redoHistory.push(clone(current)); current = history.pop(); current.revision += 1; autosave(); render(); } }, redo() { if (redoHistory.length) { history.push(clone(current)); current = redoHistory.pop(); current.revision += 1; autosave(); render(); } }, autosave() { return persistence(); }, destroy() { root.replaceChildren(); } };
}

export const validateEncounterPhase = validatePhase;
export const createEmptyEncounterPhase = createEmptyPhase;
export const projectPhase = projectPhaseXP;
export const projectEncounterPhasesToPacket = projectPhasesToPacket;
export const peakActiveXP = document => projectPhasesToPacket(document).budget.peakActiveXP;
export const totalEncounterXP = document => projectPhasesToPacket(document).budget.totalEncounterXP;
