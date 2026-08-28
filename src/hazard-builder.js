// Benchmark-guided Simple Hazard authoring. This module has no browser or WASM dependency.

const levels = Array.from({ length: 15 }, (_, index) => index - 1);
const table = (extreme, high, low) => Object.fromEntries(levels.map((level, index) => [level, {
  extreme: extreme[index], high: high[index], moderate: high[index] - 2, low: low[index]
}]));

const stealth = table([18, 19, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40], [15, 16, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37], [12, 13, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29, 30, 32]);
const disableDC = Object.fromEntries(levels.map((level, index) => [level, { extreme: [18, 19, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35, 36, 38, 40][index], high: [15, 16, 17, 18, 20, 22, 23, 25, 27, 28, 30, 32, 33, 35, 37][index], moderate: [13, 14, 15, 16, 18, 20, 21, 23, 25, 26, 28, 30, 31, 33, 35][index], low: [11, 12, 13, 14, 15, 17, 18, 19, 21, 22, 23, 25, 26, 27, 29][index] }]));
const armorClass = table([18, 19, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34, 36, 37], [15, 16, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31, 33, 34], [12, 13, 13, 15, 16, 18, 19, 21, 22, 24, 25, 27, 28, 30, 31]);
const saves = table([9, 10, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27, 29], [8, 9, 10, 11, 12, 14, 15, 17, 18, 19, 21, 22, 24, 25, 26], [2, 3, 4, 5, 6, 8, 9, 11, 12, 13, 15, 16, 18, 19, 20]);
const hardness = [[2, 4], [3, 5], [5, 7], [7, 9], [10, 12], [11, 13], [12, 14], [13, 15], [14, 16], [15, 17], [16, 18], [17, 19], [19, 21], [20, 22], [21, 23]];
const hitPoints = [[11, 13], [15, 17], [23, 25], [30, 34], [42, 46], [46, 50], [50, 54], [54, 58], [58, 62], [62, 66], [66, 70], [70, 74], [78, 82], [82, 86], [86, 90]];
const simpleAttack = [10, 11, 13, 14, 16, 17, 19, 20, 22, 23, 25, 26, 28, 29, 31];
const complexAttack = [8, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 23, 24, 26, 27];
const simpleDamage = ["2d4+1 (6)", "2d6+3 (10)", "2d6+5 (12)", "2d10+7 (18)", "2d10+13 (24)", "4d8+10 (28)", "4d8+14 (32)", "4d8+18 (36)", "4d10+18 (40)", "4d10+22 (44)", "4d10+26 (48)", "4d12+26 (52)", "4d12+30 (56)", "6d10+27 (60)", "6d10+31 (64)"];
const complexDamage = ["1d4+1 (3)", "1d6+2 (5)", "1d6+3 (6)", "1d10+4 (9)", "1d10+6 (12)", "2d8+5 (14)", "2d8+7 (16)", "2d8+9 (18)", "2d10+9 (20)", "2d10+11 (22)", "2d10+13 (24)", "2d12+13 (26)", "2d12+15 (28)", "3d10+14 (30)", "3d10+16 (32)"];

export const HAZARD_BENCHMARKS = Object.fromEntries(levels.map((level, index) => [level, {
    level,
    stealth: stealth[level],
    disableDC: disableDC[level],
    armorClass: armorClass[level],
    saves: saves[level],
    hardness: { minimum: hardness[index][0], maximum: hardness[index][1] },
    hitPoints: { minimum: hitPoints[index][0], maximum: hitPoints[index][1] },
    simpleAttack: simpleAttack[index],
    complexAttack: complexAttack[index],
    simpleDamage: simpleDamage[index],
    complexDamage: complexDamage[index],
    extremeDC: stealth[level].extreme + 1,
    hardDC: stealth[level].high
  }
]));

export const HAZARD_TYPES = Object.freeze(["trap", "environmental", "haunt"]);
export const HAZARD_COMPLEXITIES = Object.freeze(["simple", "complex"]);
export const HAZARD_BANDS = Object.freeze(["low", "moderate", "high", "extreme"]);

const text = value => typeof value === "string" ? value.trim() : "";
const issue = (code, field, message) => ({ code, field, message });
const range = (value, expected) => value < expected.minimum ? value - expected.minimum : value > expected.maximum ? value - expected.maximum : 0;

export function hazardBenchmarks(level) { return HAZARD_BENCHMARKS[level] ?? null; }

export function createEmptySimpleHazard({ id = `haz_${globalThis.crypto?.randomUUID?.() ?? "draft"}` } = {}) {
  return {
    objectVersion: 1,
    id,
    revision: 0,
    identity: { name: "", level: 1, type: "trap", complexity: "simple", traits: [] },
    description: "",
    detection: { kind: "stealth_dc", band: "high", value: 0, minimumProficiency: null },
    disableMethods: [],
    defenses: null,
    trigger: "",
    effect: { resolution: null, damage: [], conditions: [], text: "" },
    reset: null,
    oneUse: false,
    provenance: { origin: "original", basedOnContentID: null, catalogContentID: null, createdAt: "", mutationOrigin: "gm" }
  };
}

export function validateSimpleHazard(hazard) {
  const value = hazard ?? {};
  const identity = value.identity ?? {};
  const detection = value.detection ?? {};
  const effect = value.effect ?? {};
  const errors = [];
  const deviations = [];
  const holisticWarnings = [];
  const required = (field, message, actual) => { if (!text(actual)) errors.push(issue("required", field, message)); };
  required("identity.name", "A Hazard name is required.", identity.name);
  if (!["trap", "environmental", "haunt"].includes(identity.type)) errors.push(issue("invalid_type", "identity.type", "Hazard type must be trap, environmental, or haunt."));
  if (!["simple", "complex"].includes(identity.complexity)) errors.push(issue("invalid_complexity", "identity.complexity", "Hazard complexity must be simple or complex."));
  required("description", "A Hazard description is required.", value.description);
  if (!Array.isArray(identity.traits) || identity.traits.length === 0) errors.push(issue("required", "identity.traits", "At least one Hazard trait is required."));
  if (!Number.isInteger(identity.level) || identity.level < -1 || identity.level > 20) errors.push(issue("invalid_level", "identity.level", "Hazard level must be between −1 and 20."));
  if (identity.complexity === "complex") { errors.push(issue("unsupported_complex_hazard_generation", "identity.complexity", "Custom Complex Hazard creation is not supported. Use an Existing Complex Hazard from the Catalog.")); return result(errors, deviations, holisticWarnings); }
  required("detection.kind", "Detection information is required.", detection.kind);
  if (!Number.isFinite(detection.value) || detection.value <= 0) errors.push(issue("required", "detection.value", "Detection needs a positive Stealth or Perception DC."));
  if (!Array.isArray(value.disableMethods) || value.disableMethods.length === 0) errors.push(issue("required", "disable_methods", "At least one Disable Method is required."));
  for (const [index, method] of (value.disableMethods ?? []).entries()) { required(`disable_methods[${index}].skill`, "A Disable Method skill is required.", method.skill); if (method.dc != null && (!Number.isFinite(method.dc) || method.dc <= 0)) errors.push(issue("invalid_dc", `disable_methods[${index}].dc`, "A Disable Method DC must be positive.")); }
  required("trigger", "A Hazard trigger is required.", value.trigger);
  required("effect.text", "A runnable Hazard effect is required.", effect.text);
  if (effect.resolution) {
    required("effect.resolution.type", "A resolution type is required.", effect.resolution.type);
    if (effect.resolution.type === "save") required("effect.resolution.save", "A saving throw is required for a save resolution.", effect.resolution.save);
    if (effect.resolution.dc && effect.resolution.dc.value <= 0) errors.push(issue("invalid_dc", "effect.resolution.dc.value", "The effect DC must be positive."));
  }
  if (!value.oneUse) required("reset", "A reusable Hazard needs reset behavior, or mark it one-use.", value.reset);
  const benchmark = hazardBenchmarks(identity.level);
  if (!benchmark) { if (identity.level >= -1 && identity.level <= 20) holisticWarnings.push(issue("unsupported_benchmark_level", "identity.level", "No bundled benchmark table is available above level 13. Review this Hazard manually.")); return result(errors, deviations, holisticWarnings); }
  const check = (statistic, actual, band, expectedTable) => { if (!Number.isFinite(actual) || !expectedTable[band]) return; const expected = expectedTable[band]; const item = { statistic, band, expected, actual, deviation: range(actual, { minimum: expected, maximum: expected }) }; if (item.deviation !== 0) deviations.push(item); };
  check("detection.value", detection.value, detection.band ?? "high", benchmark.stealth);
  for (const [index, method] of (value.disableMethods ?? []).entries()) if (method.dc != null) check(`disable_methods[${index}].dc`, method.dc, detection.band ?? "high", benchmark.disableDC);
  if (value.defenses) {
    if (value.defenses.ac != null) check("defenses.ac", value.defenses.ac, "moderate", benchmark.armorClass);
    if (value.defenses.hp != null) { const expected = benchmark.hitPoints; const deviation = range(value.defenses.hp, expected); if (deviation) deviations.push({ statistic: "defenses.hp", band: "moderate", expected, actual: value.defenses.hp, deviation }); }
    if (value.defenses.hardness != null) { const expected = benchmark.hardness; const deviation = range(value.defenses.hardness, expected); if (deviation) deviations.push({ statistic: "defenses.hardness", band: "moderate", expected, actual: value.defenses.hardness, deviation }); }
  }
  if (effect.resolution?.dc) check("effect.resolution.dc", effect.resolution.dc.value, effect.resolution.dc.band ?? "high", benchmark.stealth);
  return result(errors, deviations, holisticWarnings);
}

function result(structuralErrors, benchmarkDeviations, holisticWarnings) {
  const warnings = [...holisticWarnings, ...benchmarkDeviations.map(deviation => issue("benchmark_deviation", deviation.statistic, `${deviation.statistic} is ${deviation.actual} versus the ${deviation.band} benchmark range ${deviation.expected.minimum}…${deviation.expected.maximum}.`))];
  return { structuralErrors, benchmarkDeviations, holisticWarnings: warnings, status: structuralErrors.length ? "incomplete" : warnings.length ? "ready with warnings" : "ready", isStructurallyReady: structuralErrors.length === 0 };
}

export function createSimpleHazard(hazard) {
  const validation = validateSimpleHazard(hazard);
  if (hazard?.identity?.complexity === "complex") { const error = new Error("Custom Complex Hazard creation is not supported."); error.code = "unsupported_complex_hazard_generation"; throw error; }
  if (validation.structuralErrors.length) { const error = new Error("The Simple Hazard has structural errors."); error.code = "invalid_hazard"; error.details = Object.fromEntries(validation.structuralErrors.map(item => [item.field, item.message])); throw error; }
  return structuredClone(hazard);
}

export function representExistingComplexHazard(catalogHazard) {
  if (!catalogHazard || (catalogHazard.identity?.complexity ?? catalogHazard.complexity) !== "complex") throw new Error("Only Existing Complex Hazards can use this representation.");
  return { ...structuredClone(catalogHazard), origin: "existing", readOnly: true };
}

const hazardXP = { simple: [2, 3, 4, 6, 8, 12, 16, 24, 30], complex: [10, 15, 20, 30, 40, 60, 80, 120, 150] };
export function projectHazardXP(hazardLevel, partyLevel, complexity = "simple", participation = "mandatory") {
  const relativeLevel = hazardLevel - partyLevel;
  const xpPerHazard = relativeLevel < -4 ? 0 : relativeLevel > 4 ? (complexity === "simple" ? 30 : 150) : hazardXP[complexity][relativeLevel + 4];
  return { hazardLevel, partyLevel, relativeLevel, complexity, participation, xpPerHazard, totalXP: xpPerHazard };
}

export class HazardBuilderStore {
  constructor(hazard = {}) { this.hazard = structuredClone(hazard); this.history = []; this.redoHistory = []; }
  get readiness() { return validateSimpleHazard(this.hazard); }
  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.redoHistory.length > 0; }
  update(next, expectedRevision = null, origin = "gm") { if (next?.identity?.complexity !== "simple") { const error = new Error("Custom Complex Hazard creation is not supported."); error.code = "unsupported_complex_hazard_generation"; throw error; } this.check(expectedRevision); this.history.push(this.hazard); this.hazard = { ...structuredClone(next), revision: (this.hazard.revision ?? 0) + 1, provenance: { ...(next.provenance ?? {}), mutationOrigin: origin } }; this.redoHistory = []; return this.hazard.revision; }
  create(expectedRevision = null, origin = "gm") { createSimpleHazard(this.hazard); this.update(this.hazard, expectedRevision, origin); return structuredClone(this.hazard); }
  undo(expectedRevision = null) { this.check(expectedRevision); if (!this.history.length) throw Object.assign(new Error("There is no earlier Hazard to restore."), { code: "nothing_to_undo" }); this.redoHistory.push(this.hazard); this.hazard = { ...this.history.pop(), revision: (this.hazard.revision ?? 0) + 1 }; return this.hazard.revision; }
  redo(expectedRevision = null) { this.check(expectedRevision); if (!this.redoHistory.length) throw Object.assign(new Error("There is no undone Hazard to restore."), { code: "nothing_to_redo" }); this.history.push(this.hazard); this.hazard = { ...this.redoHistory.pop(), revision: (this.hazard.revision ?? 0) + 1 }; return this.hazard.revision; }
  encodedState() { return JSON.stringify({ hazard: this.hazard, history: this.history, redoHistory: this.redoHistory }); }
  restore(encoded) { const state = typeof encoded === "string" ? JSON.parse(encoded) : encoded; this.hazard = structuredClone(state.hazard); this.history = structuredClone(state.history ?? []); this.redoHistory = structuredClone(state.redoHistory ?? []); }
  check(expectedRevision) { if (expectedRevision != null && expectedRevision !== (this.hazard.revision ?? 0)) throw Object.assign(new Error("The Hazard changed after it was inspected."), { code: "stale_revision", details: { expected_revision: String(expectedRevision), current_revision: String(this.hazard.revision ?? 0) } }); }
}

export class HazardCompositionStore {
  constructor(draft = {}, hazards = []) { this.draft = structuredClone(draft); this.hazards = structuredClone(hazards); this.history = []; this.redoHistory = []; }
  get budget() {
    const party = this.draft.brief?.party ?? {};
    const partyLevel = party.effectiveLevel ?? party.effective_level ?? 1;
    const target = this.draft.brief?.threatTarget ?? this.draft.brief?.threat_target ?? {};
    const size = party.size ?? 4;
    const targetXP = { trivial: [40, 10], low: [60, 20], moderate: [80, 20], severe: [120, 30], extreme: [160, 40] }[target.kind ?? "moderate"] ?? [Math.max(0, target.customXP ?? target.custom_xp ?? 0), 0];
    const buckets = { guaranteedXP: 0, avoidableXP: 0, conditionalXP: 0 };
    for (const hazard of this.draft.hazards ?? []) { const xp = projectHazardXP(hazard.level, partyLevel, hazard.complexity ?? "simple").xpPerHazard; const mode = hazard.participation?.mode ?? "mandatory"; if (mode === "mandatory") buckets.guaranteedXP += xp; else if (mode === "avoidable") buckets.avoidableXP += xp; else buckets.conditionalXP += xp; }
    const totalEncounterXP = buckets.guaranteedXP + buckets.avoidableXP + buckets.conditionalXP;
    const constructionBudget = Math.max(0, targetXP[0] + (size - 4) * targetXP[1]);
    return { targetThreat: target.kind ?? "moderate", baseTargetXP: targetXP[0], partySizeAdjustment: (size - 4) * targetXP[1], constructionBudget, ...buckets, peakActiveXP: totalEncounterXP, totalEncounterXP, baseXPAward: targetXP[0], terrainAdjustment: 0, inferredThreat: "custom", warnings: totalEncounterXP > constructionBudget ? ["Peak Active XP exceeds the Construction Budget."] : [] };
  }
  get readiness() {
    const structuralErrors = [];
    const party = this.draft.brief?.party ?? {};
    const level = party.effectiveLevel ?? party.effective_level ?? 1;
    const size = party.size ?? 4;
    if (level < 1 || level > 20) structuralErrors.push("Party effective level must be between 1 and 20.");
    if (size < 1 || size > 8) structuralErrors.push("Party size must be between 1 and 8.");
    const designWarnings = [...this.budget.warnings];
    for (const hazard of this.hazards) { if (hazard.identity?.complexity === "simple") { const validation = validateSimpleHazard(hazard); structuralErrors.push(...validation.structuralErrors.map(item => item.message)); designWarnings.push(...validation.holisticWarnings.map(item => item.message)); } }
    return { structuralErrors, designWarnings, status: structuralErrors.length ? "blocked" : this.draft.hazards?.length ? "ready with warnings" : "incomplete" };
  }
  add(snapshot, { participation = "avoidable", condition = null, placement = "", expectedRevision = null, origin = "gm" } = {}) {
    this.check(expectedRevision); if (snapshot?.identity?.complexity === "simple") createSimpleHazard(snapshot); if (this.draft.hazards?.some(item => item.id === snapshot.id)) throw Object.assign(new Error("That Hazard is already in the Encounter."), { code: "duplicate_component" }); this.record(); this.hazards.push(structuredClone(snapshot)); this.draft.hazards = [...(this.draft.hazards ?? []), { id: snapshot.id, contentID: snapshot.provenance?.catalogContentID ?? `hazard/custom/${snapshot.id}/current`, name: snapshot.identity.name, level: snapshot.identity.level, complexity: snapshot.identity.complexity, participation: { mode: participation, condition }, placement }]; this.commit(origin); return snapshot.id;
  }
  remove(id, expectedRevision = null, origin = "gm") { this.check(expectedRevision); if (!this.draft.hazards?.some(item => item.id === id)) throw Object.assign(new Error("That Hazard is not in the Encounter."), { code: "unknown_component" }); this.record(); this.draft.hazards = this.draft.hazards.filter(item => item.id !== id); this.hazards = this.hazards.filter(item => item.id !== id); this.commit(origin); }
  undo(expectedRevision = null) { this.check(expectedRevision); if (!this.history.length) throw Object.assign(new Error("There is no earlier Encounter composition to restore."), { code: "nothing_to_undo" }); this.redoHistory.push({ draft: this.draft, hazards: this.hazards }); const previous = this.history.pop(); this.draft = { ...previous.draft, revision: (this.draft.revision ?? 0) + 1 }; this.hazards = previous.hazards; }
  redo(expectedRevision = null) { this.check(expectedRevision); if (!this.redoHistory.length) throw Object.assign(new Error("There is no undone Encounter composition to restore."), { code: "nothing_to_redo" }); this.history.push({ draft: this.draft, hazards: this.hazards }); const next = this.redoHistory.pop(); this.draft = { ...next.draft, revision: (this.draft.revision ?? 0) + 1 }; this.hazards = next.hazards; }
  encodedState() { return JSON.stringify({ draft: this.draft, hazards: this.hazards, history: this.history, redoHistory: this.redoHistory }); }
  restore(encoded) { const state = typeof encoded === "string" ? JSON.parse(encoded) : encoded; this.draft = structuredClone(state.draft); this.hazards = structuredClone(state.hazards ?? []); this.history = structuredClone(state.history ?? []); this.redoHistory = structuredClone(state.redoHistory ?? []); }
  record() { this.history.push({ draft: structuredClone(this.draft), hazards: structuredClone(this.hazards) }); }
  commit(origin) { this.draft.revision = (this.draft.revision ?? 0) + 1; this.draft.provenance = { ...(this.draft.provenance ?? {}), lastMutationOrigin: origin }; this.redoHistory = []; }
  check(expectedRevision) { if (expectedRevision != null && expectedRevision !== (this.draft.revision ?? 0)) throw Object.assign(new Error("The Encounter changed after it was inspected."), { code: "stale_revision", details: { expected_revision: String(expectedRevision), current_revision: String(this.draft.revision ?? 0) } }); }
}

function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function parseDisableMethods(value) { return String(value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => { const [skill, dc] = line.split("|").map((part) => part.trim()); return { skill, dc: dc ? Number(dc) : null }; }); }

/** Mount a small, semantic Simple Hazard editor. The host receives mutation commands. */
export function createHazardBuilder({ root, hazard = createEmptySimpleHazard(), partyLevel = 1, participation = "avoidable", onMutation = () => {}, onAutosave = () => {}, onAddToEncounter = () => {} }) {
  if (!root) throw new Error("Simple Hazard builder requires a root element.");
  let current = structuredClone(hazard); let history = []; let redoHistory = [];
  const readiness = () => validateSimpleHazard(current);
  const emit = (origin, expectedRevision) => {
    onMutation({ command: "sidekickdm_create_simple_hazard", hazard: structuredClone(current), expected_hazard_revision: expectedRevision, origin });
    onAutosave({ format: "sidekickdm-simple-hazard", format_version: 1, hazard: structuredClone(current), revision: current.revision, origin });
  };
  const mutate = (operation, origin = "gm") => { const before = structuredClone(current); const expected = Number(current.revision) || 0; const next = structuredClone(current); operation(next); next.revision = expected + 1; next.provenance = { ...(next.provenance ?? {}), mutationOrigin: origin }; history.push(before); redoHistory = []; current = next; emit(origin, expected); render(); };
  const render = () => {
    const result = readiness(); const identity = current.identity ?? {}; const detection = current.detection ?? {}; const effect = current.effect ?? {};
    const methods = (current.disableMethods ?? []).map((method) => `${method.skill ?? ""}${method.dc == null ? "" : `|${method.dc}`}`).join("\n");
    const errors = [...result.structuralErrors, ...result.holisticWarnings].map((item) => `<li data-kind="${item.code === "benchmark_deviation" ? "design-warning" : "hazard-warning"}">${escapeHTML(item.message)}</li>`).join("");
    root.innerHTML = `<section class="hazard-builder"><header><p class="eyebrow">Simple Hazard · GM-owned</p><h2>${escapeHTML(identity.name || "Untitled Hazard")}</h2><span data-testid="hazard-readiness">${escapeHTML(result.status)}</span></header><div class="hazard-fields"><label>Name<input data-field="name" value="${escapeHTML(identity.name)}"></label><label>Level<input data-field="level" type="number" min="-1" max="20" value="${identity.level ?? 1}"></label><label>Type<select data-field="type">${HAZARD_TYPES.map((type) => `<option value="${type}" ${identity.type === type ? "selected" : ""}>${type}</option>`).join("")}</select></label><label>Traits<input data-field="traits" value="${escapeHTML((identity.traits ?? []).join(", "))}"></label><label>Description<textarea data-field="description">${escapeHTML(current.description)}</textarea></label><label>Detection DC<input data-field="detection" type="number" value="${detection.value ?? ""}"></label><label>Detection band<select data-field="detectionBand">${HAZARD_BANDS.map((band) => `<option value="${band}" ${detection.band === band ? "selected" : ""}>${band}</option>`).join("")}</select></label><label>Disable Methods <span>(one Skill|DC per line)</span><textarea data-field="disableMethods">${escapeHTML(methods)}</textarea></label><label>Trigger<textarea data-field="trigger">${escapeHTML(current.trigger)}</textarea></label><label>Effect<textarea data-field="effect">${escapeHTML(effect.text)}</textarea></label><label>Reset<textarea data-field="reset">${escapeHTML(current.reset ?? "")}</textarea></label><label><input data-field="oneUse" type="checkbox" ${current.oneUse ? "checked" : ""}> One-use Hazard</label></div><section class="hazard-benchmark" aria-live="polite"><p>${result.structuralErrors.length} structural error(s), ${result.holisticWarnings.length} design warning(s)</p><ul>${errors}</ul></section><footer><button type="button" data-action="add" ${result.isStructurallyReady ? "" : "disabled"}>Add to encounter</button><button type="button" data-action="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" data-action="redo" ${redoHistory.length ? "" : "disabled"}>Redo</button><span>Revision ${current.revision} · ${escapeHTML(current.provenance?.mutationOrigin ?? "gm")}</span></footer></section>`;
    root.querySelectorAll("[data-field]").forEach((field) => field.addEventListener(field.type === "checkbox" ? "change" : "change", () => mutate((value) => { const key = field.dataset.field; if (key === "name") value.identity.name = field.value; else if (key === "level") value.identity.level = Number(field.value); else if (key === "type") value.identity.type = field.value; else if (key === "traits") value.identity.traits = field.value.split(",").map((item) => item.trim()).filter(Boolean); else if (key === "detection") value.detection.value = Number(field.value); else if (key === "detectionBand") value.detection.band = field.value; else if (key === "disableMethods") value.disableMethods = parseDisableMethods(field.value); else if (key === "oneUse") value.oneUse = field.checked; else if (key === "effect") value.effect.text = field.value; else if (key in value) value[key] = field.value; }, "gm")));
    root.querySelector('[data-action="undo"]').addEventListener("click", () => { if (!history.length) return; const expected = current.revision; redoHistory.push(structuredClone(current)); current = history.pop(); current.revision = expected + 1; emit("gm", expected); render(); });
    root.querySelector('[data-action="redo"]').addEventListener("click", () => { if (!redoHistory.length) return; const expected = current.revision; history.push(structuredClone(current)); current = redoHistory.pop(); current.revision = expected + 1; emit("gm", expected); render(); });
    root.querySelector('[data-action="add"]').addEventListener("click", () => onAddToEncounter({ hazard: structuredClone(current), xp: projectHazardXP(current.identity.level, partyLevel, "simple", participation) }));
  };
  render();
  return {
    get hazard() { return structuredClone(current); }, get revision() { return current.revision; }, get readiness() { return readiness(); }, render,
    setHazard(next, origin = "gm") { mutate((value) => Object.assign(value, structuredClone(next)), origin); },
    snapshot() { return structuredClone(current); },
    autosave() { return { format: "sidekickdm-simple-hazard", format_version: 1, hazard: structuredClone(current), revision: current.revision }; },
    undo() { if (history.length) { const expected = current.revision; redoHistory.push(structuredClone(current)); current = history.pop(); current.revision = expected + 1; emit("gm", expected); render(); } },
    redo() { if (redoHistory.length) { const expected = current.revision; history.push(structuredClone(current)); current = redoHistory.pop(); current.revision = expected + 1; emit("gm", expected); render(); } },
    destroy() { root.replaceChildren(); }
  };
}

export const validateHazard = validateSimpleHazard;
export const createEmptyHazard = createEmptySimpleHazard;
export const createSimpleHazardBuilder = createHazardBuilder;
export const projectXP = projectHazardXP;
