/** NPC Profile authoring with tier-based progressive disclosure. The host
 * remains the source of truth and receives semantic upsert/undo/redo events. */

export const NPC_PROFILE_TIERS = Object.freeze(["incidental", "supporting", "prominent"]);
export const NPC_PROFILE_FIELDS = Object.freeze({
  encounterPurpose: "encounter_purpose",
  immediateGoal: "immediate_goal",
  moraleExit: "morale_exit",
  appearanceHook: "appearance_hook",
  voiceManner: "voice_manner",
  deeperMotivation: "deeper_motivation",
  fear: "fear",
  leverage: "leverage",
  combatObjective: "combat_objective",
  attitude: "attitude",
  peacefulResponse: "peaceful_response",
  knowledge: "knowledge",
  futureConsequence: "future_consequence"
});

const BASE_FIELDS = Object.freeze([NPC_PROFILE_FIELDS.encounterPurpose, NPC_PROFILE_FIELDS.immediateGoal, NPC_PROFILE_FIELDS.moraleExit]);
const TIER_FIELDS = Object.freeze({
  incidental: BASE_FIELDS,
  supporting: Object.freeze([...BASE_FIELDS, NPC_PROFILE_FIELDS.appearanceHook, NPC_PROFILE_FIELDS.combatObjective, NPC_PROFILE_FIELDS.peacefulResponse]),
  prominent: Object.freeze([...BASE_FIELDS, NPC_PROFILE_FIELDS.appearanceHook, NPC_PROFILE_FIELDS.combatObjective, NPC_PROFILE_FIELDS.peacefulResponse, NPC_PROFILE_FIELDS.voiceManner, NPC_PROFILE_FIELDS.deeperMotivation, NPC_PROFILE_FIELDS.fear, NPC_PROFILE_FIELDS.leverage, NPC_PROFILE_FIELDS.knowledge, NPC_PROFILE_FIELDS.attitude, NPC_PROFILE_FIELDS.futureConsequence])
});

const text = (value) => typeof value === "string" && value.trim().length > 0;
const clone = (value) => structuredClone(value);
const issue = (code, field, message) => ({ code, field, message });

const NATIVE_PROFILE_KEYS = Object.freeze({
  objectVersion: "object_version",
  participantGroupID: "participant_group_id",
  encounterPurpose: "encounter_purpose",
  appearanceHook: "appearance_hook",
  voiceManner: "voice_manner",
  immediateGoal: "immediate_goal",
  deeperMotivation: "deeper_motivation",
  combatObjective: "combat_objective",
  moraleExit: "morale_exit",
  peacefulResponse: "peaceful_response",
  futureConsequence: "future_consequence"
});

/** Convert the browser profile spelling to NPCProfile's explicit Swift keys. */
export function toNativeNPCProfile(profile = createEmptyNPCProfile()) {
  const value = clone(profile);
  for (const [camel, snake] of Object.entries(NATIVE_PROFILE_KEYS)) {
    if (value[camel] !== undefined) {
      value[snake] = value[camel];
      delete value[camel];
    }
  }
  return value;
}

/** Convert an NPCProfile decoded by Swift back to the browser spelling. */
export function fromNativeNPCProfile(profile = {}) {
  const value = clone(profile);
  for (const [camel, snake] of Object.entries(NATIVE_PROFILE_KEYS)) {
    if (value[snake] !== undefined) {
      value[camel] = value[snake];
      delete value[snake];
    }
  }
  return value;
}

function toNativeNPCSnapshot(snapshot) {
  const value = clone(snapshot);
  if (value.profile) value.profile = toNativeNPCProfile(value.profile);
  return value;
}

export function requiredNPCProfileFields(tier = "incidental") {
  void tier;
  return [...BASE_FIELDS];
}

export function disclosedNPCProfileFields(tier = "incidental") {
  return [...(TIER_FIELDS[tier] ?? TIER_FIELDS.incidental)];
}

export function createEmptyNPCProfile({ id = `npc_${globalThis.crypto?.randomUUID?.() ?? "draft"}`, participantGroupID = null } = {}) {
  return {
    objectVersion: 1,
    id,
    revision: 0,
    participantGroupID,
    tier: "incidental",
    name: "",
    encounterPurpose: "",
    appearanceHook: null,
    voiceManner: null,
    immediateGoal: "",
    deeperMotivation: null,
    fear: null,
    leverage: null,
    attitude: null,
    combatObjective: null,
    moraleExit: "",
    peacefulResponse: null,
    knowledge: [],
    futureConsequence: null,
    provenance: { origin: "original", basedOnProfileID: null, source: null, createdAt: "", lastMutationOrigin: "gm" }
  };
}

export function validateNPCProfile(profile = createEmptyNPCProfile()) {
  const structuralErrors = [];
  const designWarnings = [];
  if (!text(profile.id)) structuralErrors.push(issue("required", "id", "An NPC Profile ID is required."));
  if (Number(profile.objectVersion) !== 1) structuralErrors.push(issue("unsupported_version", "objectVersion", "NPC Profile object version must be 1."));
  if (!text(profile.encounterPurpose)) structuralErrors.push(issue("required", NPC_PROFILE_FIELDS.encounterPurpose, "NPC Profiles require an encounter purpose."));
  if (!text(profile.immediateGoal ?? profile.motivation)) structuralErrors.push(issue("required", NPC_PROFILE_FIELDS.immediateGoal, "NPC Profiles require a one-line motivation."));
  if (!text(profile.moraleExit ?? profile.moraleOrExitCondition ?? profile.morale ?? profile.exitCondition)) structuralErrors.push(issue("required", NPC_PROFILE_FIELDS.moraleExit, "NPC Profiles require a morale or exit condition."));
  const tier = profile.tier ?? profile.narrativeTier ?? "incidental";
  if (tier !== "incidental" && !text(profile.peacefulResponse)) designWarnings.push(issue("missing_progressive_detail", NPC_PROFILE_FIELDS.peacefulResponse, `A peaceful response can make a ${tier} NPC easier to run without combat.`));
  if (tier === "prominent" && !(profile.knowledge?.length) && !text(profile.appearanceHook ?? profile.characterization)) designWarnings.push(issue("thin_prominent_profile", NPC_PROFILE_FIELDS.knowledge, "A prominent NPC usually benefits from knowledge or characterization."));
  const status = structuralErrors.length ? "incomplete" : designWarnings.length ? "ready with warnings" : "ready";
  return { structuralErrors, designWarnings, disclosedFields: disclosedNPCProfileFields(tier), status, isStructurallyReady: structuralErrors.length === 0 };
}

export function discloseNPCProfile(profile = createEmptyNPCProfile()) {
  const visible = new Set(disclosedNPCProfileFields(profile.tier ?? profile.narrativeTier));
  const disclosed = clone(profile);
  Object.entries(NPC_PROFILE_FIELDS).forEach(([key, field]) => {
    if (!visible.has(field)) disclosed[key] = key === "knowledge" ? [] : key === "encounterPurpose" || key === "immediateGoal" || key === "moraleExit" ? disclosed[key] : null;
  });
  disclosed.disclosedFields = [...visible];
  return disclosed;
}

export function createNPCProfileSnapshot(profile, capturedAt = "") {
  const value = clone(profile);
  return { objectVersion: value.objectVersion ?? 1, profileID: value.id, profileRevision: Number(value.revision) || 0, capturedAt, profile: value, provenance: clone(value.provenance ?? {}) };
}

export function linkNPCProfileToParticipant(profile, participantGroupID, capturedAt = "") {
  if (!text(participantGroupID)) throw new Error("NPC Profile links require a participant group ID.");
  const linked = clone(profile);
  linked.participantGroupID = participantGroupID;
  return { participantGroupID, profileID: linked.id, snapshot: createNPCProfileSnapshot(linked, capturedAt) };
}

export function projectNPCProfilesToPacket(links = [], participantGroups = []) {
  const names = new Map(participantGroups.map((group) => [group.id, group.name ?? group.id]));
  return { profiles: links.filter((link) => text(link?.participantGroupID) && link.snapshot?.profile).map((link) => ({ participantGroupID: link.participantGroupID, participantName: names.get(link.participantGroupID) ?? link.participantGroupID, profileID: link.profileID, tier: link.snapshot.profile.tier ?? link.snapshot.profile.narrativeTier, profile: discloseNPCProfile(link.snapshot.profile), snapshot: clone(link.snapshot) })) };
}

function fieldValue(profile, field, form) {
  const values = [...form.elements].filter((element) => element.name === field);
  const value = values[0]?.value ?? "";
  return field === "knowledge" ? value.split("\n").map((item) => item.trim()).filter(Boolean).map((item) => ({ topic: "", state: "knows_and_will_tell", text: item })) : (value.trim() || null);
}

const labels = Object.freeze({ encounterPurpose: "Encounter purpose", immediateGoal: "Immediate goal", appearanceHook: "Appearance hook", voiceManner: "Voice / manner", deeperMotivation: "Deeper motivation", fear: "Fear", leverage: "Leverage", combatObjective: "Combat objective", attitude: "Attitude", moraleExit: "Morale / exit", peacefulResponse: "Peaceful response", knowledge: "Knowledge", futureConsequence: "Future consequence" });
const fieldFor = (key, value) => key === "knowledge" ? `<label>${labels[key]} <span>(one item per line)</span><textarea name="${key}" rows="3">${escapeHTML((value ?? []).map((entry) => typeof entry === "string" ? entry : entry.text ?? "").join("\n"))}</textarea></label>` : `<label>${labels[key]}<textarea name="${key}" rows="2">${escapeHTML(value ?? "")}</textarea></label>`;
function escapeHTML(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }

/** Mount a GM-owned profile editor. Only fields accepted by the selected tier
 * are rendered, while the saved profile retains all fields for snapshots. */
export function createNPCProfileEditor({ root, profile = createEmptyNPCProfile(), participantGroupID = null, onMutation = () => {}, onAutosave = () => {} }) {
  if (!root) throw new Error("NPC Profile editor requires a root element.");
  let current = clone(profile);
  let currentRevision = Number(current.revision) || 0;
  let history = [];
  let redoHistory = [];
  if (!current.narrativeTier) current.narrativeTier = current.tier ?? "incidental";
  if (participantGroupID) current.participantGroupID = participantGroupID;

  const persistence = (origin = undefined) => ({
    format: "sidekickdm-npc-profile",
    formatVersion: 1,
    profile: toNativeNPCProfile(current),
    participantGroupID: current.participantGroupID,
    snapshot: toNativeNPCSnapshot(createNPCProfileSnapshot(current)),
    history: history.map(toNativeNPCProfile),
    redoHistory: redoHistory.map(toNativeNPCProfile),
    ...(origin === undefined ? {} : { origin })
  });

  const emit = (command, origin, expectedRevision) => {
    onMutation({ command: "sidekickdm_upsert_npc_profile", profile: clone(current), participant_group_id: current.participantGroupID, tier: current.tier ?? current.narrativeTier, expected_npc_revision: expectedRevision, origin });
    onAutosave(persistence(origin));
  };
  const render = () => {
    const result = validateNPCProfile(current);
    const fields = Object.keys(NPC_PROFILE_FIELDS).filter((key) => result.disclosedFields.includes(NPC_PROFILE_FIELDS[key]));
    const formFields = fields.map((key) => fieldFor(key, current[key])).join("");
    const errors = [...result.structuralErrors, ...result.designWarnings].map((item) => `<li data-kind="${item.code === "required" || item.code === "unsupported_version" ? "structural-error" : "design-warning"}">${escapeHTML(item.message)}</li>`).join("");
    root.innerHTML = `<section class="npc-profile-editor"><header><p class="eyebrow">NPC Profile · GM-owned</p><h2>${escapeHTML(current.id || "Untitled NPC")}</h2><span data-testid="npc-profile-tier">${escapeHTML(current.narrativeTier)}</span><span data-testid="npc-profile-readiness">${escapeHTML(result.status)}</span></header><label>Narrative detail tier<select data-field="narrativeTier">${NPC_PROFILE_TIERS.map((tier) => `<option value="${tier}" ${tier === current.narrativeTier ? "selected" : ""}>${tier}</option>`).join("")}</select></label><p data-testid="npc-profile-participant">Participant Group: ${escapeHTML(current.participantGroupID ?? "Not linked")}</p><form data-npc-profile-form>${formFields}<button type="submit">Save NPC Profile</button></form><section class="npc-profile-readiness" aria-live="polite"><p>${result.structuralErrors.length} structural error(s), ${result.designWarnings.length} design warning(s)</p><ul>${errors}</ul></section><footer><button type="button" data-action="undo" ${history.length ? "" : "disabled"}>Undo</button><button type="button" data-action="redo" ${redoHistory.length ? "" : "disabled"}>Redo</button><span>Revision ${currentRevision} · ${escapeHTML(current.provenance?.lastMutationOrigin ?? "gm")}</span></footer></section>`;
    root.querySelector('[data-field="narrativeTier"]').addEventListener("change", (event) => mutate((value) => { value.narrativeTier = event.target.value; value.tier = event.target.value; }, "gm"));
    root.querySelector("[data-npc-profile-form]").addEventListener("submit", (event) => { event.preventDefault(); mutate((value) => fields.forEach((key) => { value[key] = fieldValue(current, key, event.currentTarget); }), "gm"); });
    root.querySelector('[data-action="undo"]').addEventListener("click", () => { if (!history.length) return; const expected = currentRevision; redoHistory.push(clone(current)); current = history.pop(); currentRevision += 1; current.revision = currentRevision; emit("sidekickdm_undo", "gm", expected); render(); });
    root.querySelector('[data-action="redo"]').addEventListener("click", () => { if (!redoHistory.length) return; const expected = currentRevision; history.push(clone(current)); current = redoHistory.pop(); currentRevision += 1; current.revision = currentRevision; emit("sidekickdm_redo", "gm", expected); render(); });
  };
  const mutate = (operation, origin) => { const before = clone(current); const expected = currentRevision; const next = clone(current); operation(next); next.revision = expected + 1; next.provenance = { ...(next.provenance ?? {}), lastMutationOrigin: origin }; history.push(before); redoHistory = []; current = next; currentRevision = next.revision; emit("sidekickdm_upsert_npc_profile", origin, expected); render(); };
  render();
  return {
    get profile() { return clone(current); },
    get revision() { return currentRevision; },
    get readiness() { return validateNPCProfile(current); },
    get participantGroupID() { return current.participantGroupID; },
    render,
    setProfile(next, origin = "gm") { mutate((value) => Object.assign(value, clone(next)), origin); },
    attachToParticipant(id, origin = "gm") { mutate((value) => { if (!text(id)) throw new Error("NPC Profile links require a participant group ID."); value.participantGroupID = id; }, origin); },
    snapshot(capturedAt = "") { return createNPCProfileSnapshot(current, capturedAt); },
    autosave() { return persistence(); },
    undo() { if (history.length) { const expected = currentRevision; redoHistory.push(clone(current)); current = history.pop(); currentRevision += 1; current.revision = currentRevision; emit("sidekickdm_undo", "gm", expected); render(); } },
    redo() { if (redoHistory.length) { const expected = currentRevision; history.push(clone(current)); current = redoHistory.pop(); currentRevision += 1; current.revision = currentRevision; emit("sidekickdm_redo", "gm", expected); render(); } },
    destroy() { root.replaceChildren(); }
  };
}

export const validateNPC = validateNPCProfile;
export const createEmptyNPC = createEmptyNPCProfile;
export const createEmptyNpcProfile = createEmptyNPCProfile;
export const validateNpcProfile = validateNPCProfile;
export const discloseNpcProfile = discloseNPCProfile;
export const createNpcProfileSnapshot = createNPCProfileSnapshot;
export const linkNpcProfileToParticipant = linkNPCProfileToParticipant;
export const projectNpcProfilesToPacket = projectNPCProfilesToPacket;
export const createNpcProfileEditor = createNPCProfileEditor;
