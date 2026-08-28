export const PACKET_SECTIONS = Object.freeze([
  "identity",
  "setup",
  "battlefield",
  "running_guidance",
  "cohesion",
  "information",
  "outcomes"
]);

const SECTION_TITLES = Object.freeze({
  identity: "Identity",
  setup: "Setup",
  battlefield: "Battlefield guidance",
  running_guidance: "Running guidance",
  cohesion: "Cohesion",
  information: "Information visibility",
  outcomes: "Outcomes"
});

const text = (value) => typeof value === "string" && value.trim().length > 0;
const list = (value) => Array.isArray(value) && value.some(text);
const cleanList = (value) => String(value ?? "").split("\n").map((item) => item.trim()).filter(Boolean);

export function createEmptyPacket() {
  return {
    objectVersion: 1,
    identity: { title: "", premise: "", objective: "", stakes: "" },
    setup: { trigger: "", battlefieldDescription: "", startingPositions: "", awarenessState: "", immediateFeatures: [], readAloud: null },
    battlefield: { dimensions: "", zones: [], elevations: [], cover: [], concealment: [], difficultTerrain: [], entryPoints: [], escapeRoutes: [], interactiveObjects: [], hazardPlacement: [], recommendedDistances: [], mapGenerationPrompt: null, attachmentID: null },
    runningGuidance: { participantRoles: "", openingTactics: "", ongoingTactics: "", coordinationConflict: "", triggersReinforcements: "", moraleSummary: "", adjudicationIssues: [] },
    cohesion: { participantPresence: "", relationships: "", hazardTerrainFit: "", theme: "" },
    information: { immediatelyApparent: [], discoverable: [], gmSecret: [] },
    outcomes: { victory: "", partialSuccess: null, failure: null, partyRetreat: null, enemySurrender: null, enemyEscape: null, longTermConsequence: null },
    rewardGuidance: null,
    alternativeResolutions: []
  };
}

function structuralError(section, field, message) { return { section, field, message }; }
function designWarning(section, field, message) { return { section, field, message }; }

/** Validate only structural usability here. Narrative quality remains advisory. */
export function validatePacket(packet = createEmptyPacket()) {
  const structuralErrors = [];
  const designWarnings = [];
  const requiredText = (section, field, message) => { if (!text(packet[section]?.[field])) structuralErrors.push(structuralError(section, field, message)); };
  const requiredList = (section, field, message) => { if (!list(packet[section]?.[field])) structuralErrors.push(structuralError(section, field, message)); };

  requiredText("identity", "title", "Identity needs a title.");
  requiredText("identity", "premise", "Identity needs a premise.");
  requiredText("identity", "objective", "Identity needs an objective.");
  requiredText("identity", "stakes", "Identity needs stakes.");
  requiredText("setup", "trigger", "Setup needs an encounter trigger.");
  requiredText("setup", "battlefieldDescription", "Setup needs a battlefield description.");
  requiredText("setup", "startingPositions", "Setup needs starting positions.");
  requiredText("setup", "awarenessState", "Setup needs an awareness or detection state.");
  requiredList("setup", "immediateFeatures", "Setup needs at least one immediate environmental feature.");
  requiredText("runningGuidance", "participantRoles", "Running guidance needs participant roles.");
  requiredText("runningGuidance", "openingTactics", "Running guidance needs opening tactics.");
  requiredText("runningGuidance", "ongoingTactics", "Running guidance needs ongoing tactics.");
  requiredText("runningGuidance", "coordinationConflict", "Running guidance needs coordination or conflict guidance.");
  requiredText("runningGuidance", "triggersReinforcements", "Running guidance needs phase or reinforcement triggers.");
  requiredText("runningGuidance", "moraleSummary", "Running guidance needs morale or exit conditions.");
  requiredText("cohesion", "participantPresence", "Cohesion needs why participants are present.");
  requiredText("cohesion", "relationships", "Cohesion needs participant relationships.");
  requiredText("cohesion", "hazardTerrainFit", "Cohesion needs why hazards and terrain fit.");
  requiredText("outcomes", "victory", "Outcomes need a success result.");
  const outcome = packet.outcomes ?? {};
  if (![outcome.partialSuccess, outcome.failure, outcome.partyRetreat, outcome.enemySurrender, outcome.enemyEscape, outcome.longTermConsequence].some(text)) structuralErrors.push(structuralError("outcomes", "failureOrAftermath", "Outcomes need at least one failure, retreat, surrender, escape, or aftermath branch."));

  if (!text(packet.setup?.readAloud)) designWarnings.push(designWarning("setup", "readAloud", "A short read-aloud can make the opening easier to run."));
  if (!list(packet.information?.discoverable)) designWarnings.push(designWarning("information", "discoverable", "No discoverable information is documented for investigation or successful checks."));
  if (!list(packet.information?.gmSecret)) designWarnings.push(designWarning("information", "gmSecret", "No DM-secret information is documented."));
  if (!text(packet.cohesion?.theme)) designWarnings.push(designWarning("cohesion", "theme", "A concise theme would help keep the encounter cohesive."));
  if (!list(packet.runningGuidance?.adjudicationIssues)) designWarnings.push(designWarning("running_guidance", "adjudicationIssues", "Consider noting one likely adjudication question for the DM."));
  if (!list(packet.battlefield?.zones) && !list(packet.battlefield?.interactiveObjects)) designWarnings.push(designWarning("battlefield", "zones", "Optional zones or interactive objects could make battlefield decisions clearer."));

  const missingSections = PACKET_SECTIONS.filter((section) => structuralErrors.some((error) => error.section === section));
  const status = structuralErrors.length > 0 ? "incomplete draft" : designWarnings.length > 0 ? "ready with warnings" : "ready to run";
  return { structuralErrors, designWarnings, missingSections, status, isStructurallyReady: structuralErrors.length === 0 };
}

function escapeHTML(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

const textField = (name, label, value, { optional = false } = {}) => `<label class="packet-field">${label}${optional ? " <span>(optional)</span>" : ""}<textarea name="${name}" rows="2">${escapeHTML(value)}</textarea></label>`;
const listField = (name, label, value) => `<label class="packet-field">${label} <span>(one item per line)</span><textarea name="${name}" rows="3">${escapeHTML((value ?? []).join("\n"))}</textarea></label>`;

function formFor(section, packet) {
  const value = packet[section] ?? {};
  if (section === "identity") return [textField("title", "Title", value.title), textField("premise", "Premise", value.premise), textField("objective", "Objective", value.objective), textField("stakes", "Stakes", value.stakes)].join("");
  if (section === "setup") return [textField("trigger", "Encounter trigger", value.trigger), textField("battlefieldDescription", "Battlefield description", value.battlefieldDescription), textField("startingPositions", "Starting positions", value.startingPositions), textField("awarenessState", "Awareness / detection", value.awarenessState), listField("immediateFeatures", "Immediate environmental features", value.immediateFeatures), textField("readAloud", "Read-aloud", value.readAloud, { optional: true })].join("");
  if (section === "battlefield") return [textField("dimensions", "Dimensions", value.dimensions, { optional: true }), listField("zones", "Zones", value.zones), listField("elevations", "Elevations", value.elevations), listField("cover", "Cover", value.cover), listField("concealment", "Concealment", value.concealment), listField("difficultTerrain", "Difficult terrain", value.difficultTerrain), listField("entryPoints", "Entry points", value.entryPoints), listField("escapeRoutes", "Escape routes", value.escapeRoutes), listField("interactiveObjects", "Interactive objects", value.interactiveObjects), listField("hazardPlacement", "Hazard placement", value.hazardPlacement), listField("recommendedDistances", "Recommended distances", value.recommendedDistances), textField("mapGenerationPrompt", "Map generation prompt", value.mapGenerationPrompt, { optional: true })].join("");
  if (section === "running_guidance") return [textField("participantRoles", "Participant roles", value.participantRoles), textField("openingTactics", "Opening tactics", value.openingTactics), textField("ongoingTactics", "Ongoing tactics", value.ongoingTactics), textField("coordinationConflict", "Coordination / conflict", value.coordinationConflict), textField("triggersReinforcements", "Phase / reinforcement triggers", value.triggersReinforcements), textField("moraleSummary", "Morale / exit conditions", value.moraleSummary), listField("adjudicationIssues", "Likely adjudication issues", value.adjudicationIssues)].join("");
  if (section === "cohesion") return [textField("participantPresence", "Why participants are present", value.participantPresence), textField("relationships", "Participant relationships", value.relationships), textField("hazardTerrainFit", "Why hazards / terrain fit", value.hazardTerrainFit), textField("theme", "Theme", value.theme, { optional: true })].join("");
  if (section === "information") return [listField("immediatelyApparent", "Immediately apparent", value.immediatelyApparent), listField("discoverable", "Discoverable", value.discoverable), listField("gmSecret", "DM secret", value.gmSecret)].join("");
  return [textField("victory", "Success / victory", value.victory), textField("partialSuccess", "Partial success", value.partialSuccess, { optional: true }), textField("failure", "Failure", value.failure, { optional: true }), textField("partyRetreat", "Party retreat", value.partyRetreat, { optional: true }), textField("enemySurrender", "Enemy surrender", value.enemySurrender, { optional: true }), textField("enemyEscape", "Enemy escape", value.enemyEscape, { optional: true }), textField("longTermConsequence", "Long-term consequence", value.longTermConsequence, { optional: true })].join("");
}

function readForm(section, form) {
  const value = {};
  [...form.elements].filter((element) => element.name).forEach((element) => {
    value[element.name] = element.name === "immediateFeatures" || element.name === "zones" || element.name === "elevations" || element.name === "cover" || element.name === "concealment" || element.name === "difficultTerrain" || element.name === "entryPoints" || element.name === "escapeRoutes" || element.name === "interactiveObjects" || element.name === "hazardPlacement" || element.name === "recommendedDistances" || element.name === "adjudicationIssues" || element.name === "immediatelyApparent" || element.name === "discoverable" || element.name === "gmSecret" ? cleanList(element.value) : (element.value.trim() || null);
  });
  return { ...value };
}

/**
 * Mount a semantic packet editor. The core/WebMCP adapter remains the source
 * of truth; callbacks let a host forward each section command to Swift.
 */
export function createEncounterPacketEditor({ root, packet = createEmptyPacket(), boundaries = {}, revision = 0, constraintsRevision = 0, onMutation = () => {}, onAutosave = () => {} }) {
  if (!root) throw new Error("Encounter Packet editor requires a root element.");
  let current = structuredClone(packet);
  const ownedBoundaries = structuredClone(boundaries);
  let currentRevision = revision;
  const constraintRevision = constraintsRevision;
  let lastMutationOrigin = "gm";
  let history = [];
  let redoHistory = [];

  const nativeOrigin = (origin) => ["gm", "agent", "webmcp", "reload"].includes(origin) ? origin : "gm";
  const metadata = () => ({ revision: currentRevision, constraintsRevision: constraintRevision, origin: nativeOrigin(lastMutationOrigin), lastMutationOrigin: nativeOrigin(lastMutationOrigin), reviewState: "needed", readiness: validatePacket(current) });
  const persistence = (origin = lastMutationOrigin) => {
    const safeOrigin = nativeOrigin(origin);
    lastMutationOrigin = safeOrigin;
    return { format: "sidekickdm-encounter-packet", formatVersion: 1, packet: structuredClone(current), boundaries: structuredClone(ownedBoundaries), metadata: { revision: currentRevision, constraintsRevision: constraintRevision, origin: safeOrigin, lastMutationOrigin: safeOrigin, reviewState: "needed" } };
  };
  const commandFor = (section) => ({ identity: "sidekickdm_set_encounter_identity", setup: "sidekickdm_set_setup", battlefield: "sidekickdm_set_battlefield_guidance", running_guidance: "sidekickdm_set_running_guidance", cohesion: "sidekickdm_set_cohesion", information: "sidekickdm_set_information_visibility", outcomes: "sidekickdm_set_outcomes", undo: "sidekickdm_undo", redo: "sidekickdm_redo" }[section] ?? "sidekickdm_set_encounter_packet");
  const emit = (section, value, origin, expectedRevision) => {
    onMutation({ command: commandFor(section), section, value, expected_encounter_revision: expectedRevision, expected_constraints_revision: constraintRevision, origin });
    onAutosave(persistence(origin));
  };
  const render = () => {
    const readiness = validatePacket(current);
    const errorMarkup = readiness.structuralErrors.map((error) => `<li data-kind="structural-error">${escapeHTML(error.message)}</li>`).join("");
    const warningMarkup = readiness.designWarnings.map((warning) => `<li data-kind="design-warning">${escapeHTML(warning.message)}</li>`).join("");
    const sections = PACKET_SECTIONS.map((section) => `<section class="packet-section" data-packet-section="${section}"><h3>${SECTION_TITLES[section]}</h3><form data-packet-form="${section}">${formFor(section, current)}<button type="submit">Save ${SECTION_TITLES[section]}</button></form></section>`).join("");
    const boundaryMarkup = ["lines", "veils", "excludedThemes"].map((key) => `<li>${escapeHTML(key.replace(/[A-Z]/g, (letter) => ` ${letter.toLowerCase()}`))}: ${escapeHTML((ownedBoundaries[key] ?? []).join(", ") || "none recorded")}</li>`).join("");
    root.innerHTML = `<div class="encounter-packet-editor"><header class="packet-heading"><div><p class="eyebrow">DM-owned Encounter Packet</p><h2>Encounter Packet</h2></div><span class="badge" data-testid="packet-readiness">${escapeHTML(readiness.status)}</span></header><section class="packet-readiness" aria-live="polite"><h3>Readiness</h3><p>${readiness.structuralErrors.length} structural error(s), ${readiness.designWarnings.length} design warning(s)</p><ul>${errorMarkup}${warningMarkup}</ul></section><fieldset class="content-boundaries" disabled data-owner="gm"><legend>Content Boundaries · DM-owned</legend><p>Agents can see these constraints but cannot edit them from packet authoring.</p><ul>${boundaryMarkup}</ul></fieldset>${sections}<footer class="packet-history"><button type="button" data-packet-action="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" data-packet-action="redo" ${redoHistory.length ? "" : "disabled"}>Redo</button><span>Revision ${currentRevision}</span></footer></div>`;
    root.querySelectorAll("[data-packet-form]").forEach((form) => form.addEventListener("submit", (event) => {
      event.preventDefault();
      const section = form.dataset.packetForm;
      const before = structuredClone(current);
      const beforeRevision = currentRevision;
      current = { ...current, [section === "running_guidance" ? "runningGuidance" : section]: { ...(current[section === "running_guidance" ? "runningGuidance" : section] ?? {}), ...readForm(section, form) } };
      history.push(before);
      redoHistory = [];
      currentRevision += 1;
      emit(section, current[section === "running_guidance" ? "runningGuidance" : section], "gm", beforeRevision);
      render();
    }));
    root.querySelector('[data-packet-action="undo"]').addEventListener("click", () => { if (!history.length) return; const beforeRevision = currentRevision; redoHistory.push(structuredClone(current)); current = history.pop(); currentRevision += 1; emit("undo", current, "gm", beforeRevision); render(); });
    root.querySelector('[data-packet-action="redo"]').addEventListener("click", () => { if (!redoHistory.length) return; const beforeRevision = currentRevision; history.push(structuredClone(current)); current = redoHistory.pop(); currentRevision += 1; emit("redo", current, "gm", beforeRevision); render(); });
  };
  render();
  return {
    get packet() { return structuredClone(current); },
    get revision() { return currentRevision; },
    get readiness() { return validatePacket(current); },
    get metadata() { return metadata(); },
    render,
    setPacket(next, origin = "gm") { const beforeRevision = currentRevision; history.push(structuredClone(current)); current = structuredClone(next); redoHistory = []; currentRevision += 1; emit("packet", current, origin, beforeRevision); render(); },
    autosave() { return persistence(); },
    destroy() { root.replaceChildren(); }
  };
}
