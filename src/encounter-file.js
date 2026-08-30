/* Sidekick DM v1 Encounter file boundary.
 *
 * The browser adapter intentionally owns file/IndexedDB concerns. The Swift
 * engine remains the source of truth for encounter math and readiness; those
 * derived projections are removed from portable data and recalculated after
 * import by the engine.
 */

export const ENCOUNTER_FILE_FORMAT = "sidekickdm";
export const ENCOUNTER_FILE_VERSION = 1;

export class EncounterFileError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "EncounterFileError";
    this.code = code;
    this.details = details;
  }
}

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const clone = (value) => structuredClone(value);
const fixedOrder = (left, right) => { const a = String(left ?? ""); const b = String(right ?? ""); return a < b ? -1 : a > b ? 1 : 0; };

function camelToSnake(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replaceAll("i_d", "id");
}

function snakeToCamel(key) {
  const acronyms = { id: "ID", ids: "IDs", xp: "XP", json: "JSON" };
  return key.split("_").map((part, index) => {
    if (index === 0) return part;
    return acronyms[part] ?? `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`;
  }).join("");
}

function transform(value, keyTransform) {
  if (Array.isArray(value)) return value.map((item) => transform(item, keyTransform));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [keyTransform(key), transform(item, keyTransform)]));
}

function sortJSON(value) {
  if (Array.isArray(value)) return value.map(sortJSON);
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJSON(value[key])]));
}

export function deterministicJSONString(value) {
  return JSON.stringify(sortJSON(value));
}

function asJSON(input) {
  if (typeof input === "string") {
    try { return JSON.parse(input); } catch { throw new EncounterFileError("invalid_json", "Encounter file is not valid JSON."); }
  }
  if (input instanceof Uint8Array || input instanceof ArrayBuffer) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    return asJSON(new TextDecoder().decode(bytes));
  }
  if (isObject(input)) return clone(input);
  throw new EncounterFileError("invalid_json", "Encounter file must be JSON text, bytes, or an object.");
}

function migrateEnvelope(root) {
  const migrated = clone(root);
  const version = migrated.format_version ?? migrated.version;
  if (!Number.isInteger(version)) throw new EncounterFileError("invalid_envelope", "format_version is required.");
  if (version > ENCOUNTER_FILE_VERSION) throw new EncounterFileError("future_schema_version", `Encounter file version ${version} is newer than supported version ${ENCOUNTER_FILE_VERSION}.`);
  if (version < 0) throw new EncounterFileError("unsupported_schema_version", `Encounter file version ${version} is invalid.`);
  // Explicit v0 -> v1 migration. This is intentionally pure and happens
  // before IDs are read or an IndexedDB transaction is opened.
  if (version === 0) {
    migrated.format_version = ENCOUNTER_FILE_VERSION;
    delete migrated.version;
    migrated.__migration = { from: 0, to: ENCOUNTER_FILE_VERSION, applied: true };
  }
  return migrated;
}

function validateEnvelope(root) {
  const migrated = migrateEnvelope(root);
  if (migrated.format !== ENCOUNTER_FILE_FORMAT) throw new EncounterFileError("invalid_envelope", "format must be sidekickdm.");
  if (migrated.format_version !== ENCOUNTER_FILE_VERSION) throw new EncounterFileError("unsupported_schema_version", `Encounter file version ${migrated.format_version} is not supported.`);
  if (!["encounter", "components", "library"].includes(migrated.export_kind)) throw new EncounterFileError("invalid_envelope", "export_kind must be encounter, components, or library.");
  if (typeof migrated.exported_at !== "string" || !migrated.exported_at) throw new EncounterFileError("invalid_envelope", "exported_at is required.");
  if (!isObject(migrated.data)) throw new EncounterFileError("invalid_envelope", "data is required.");
  return migrated;
}

function componentArrays(data) {
  const embedded = data.embedded_components;
  if (!isObject(embedded)) throw new EncounterFileError("invalid_payload", "embedded_components must be an object.");
  for (const key of ["creatures", "npc_profiles", "hazards"]) {
    if (!Array.isArray(embedded[key])) throw new EncounterFileError("invalid_payload", `embedded_components.${key} must be an array.`);
  }
  if (embedded.embedded_catalog_entries !== undefined && !Array.isArray(embedded.embedded_catalog_entries)) throw new EncounterFileError("invalid_payload", "embedded_components.embedded_catalog_entries must be an array.");
  return embedded;
}

function requiredObject(value, label) {
  if (!isObject(value)) throw new EncounterFileError("invalid_payload", `${label} must be an object.`);
  return value;
}

function optionalArray(value, label, itemCheck = null) {
  if (value === undefined || value === null) return;
  if (!Array.isArray(value)) throw new EncounterFileError("invalid_payload", `${label} must be an array.`);
  value.forEach((item, index) => itemCheck?.(item, `${label}[${index}]`));
}

function optionalString(value, label) {
  if (value !== undefined && value !== null && typeof value !== "string") throw new EncounterFileError("invalid_payload", `${label} must be a string or null.`);
}

function optionalInteger(value, label) {
  if (value !== undefined && value !== null && !Number.isInteger(value)) throw new EncounterFileError("invalid_payload", `${label} must be an integer or null.`);
}

function validateStatistic(value, label) {
  if (value === undefined || value === null) return;
  const statistic = requiredObject(value, label);
  optionalString(statistic.band, `${label}.band`);
  optionalInteger(statistic.value, `${label}.value`);
}

function validateCreatureRecord(value, label = "Creature") {
  const creature = requiredObject(value, label);
  if (typeof creature.id !== "string" || !creature.id.trim()) throw new EncounterFileError("invalid_payload", `${label} records require a non-empty id.`);
  if (creature.identity !== undefined) {
    const identity = requiredObject(creature.identity, `${label} ${creature.id}.identity`);
    optionalString(identity.name, `${label} ${creature.id}.identity.name`); optionalInteger(identity.level, `${label} ${creature.id}.identity.level`);
    optionalString(identity.rarity, `${label} ${creature.id}.identity.rarity`); optionalString(identity.size, `${label} ${creature.id}.identity.size`); optionalString(identity.concept, `${label} ${creature.id}.identity.concept`); optionalString(identity.roadmap, `${label} ${creature.id}.identity.roadmap`); optionalString(identity.encounterRole, `${label} ${creature.id}.identity.encounterRole`); optionalArray(identity.traits, `${label} ${creature.id}.identity.traits`, (item, path) => optionalString(item, path));
  }
  validateStatistic(creature.perception, `${label} ${creature.id}.perception`);
  optionalArray(creature.senses, `${label} ${creature.id}.senses`, (item, path) => optionalString(item, path)); optionalArray(creature.languages, `${label} ${creature.id}.languages`, (item, path) => optionalString(item, path));
  if (creature.skills !== undefined) { const skills = requiredObject(creature.skills, `${label} ${creature.id}.skills`); for (const [key, item] of Object.entries(skills)) optionalInteger(item, `${label} ${creature.id}.skills.${key}`); }
  if (creature.defenses !== undefined) { const defenses = requiredObject(creature.defenses, `${label} ${creature.id}.defenses`); for (const key of ["ac", "fortitude", "reflex", "will", "hp"]) validateStatistic(defenses[key], `${label} ${creature.id}.defenses.${key}`); for (const key of ["immunities", "weaknesses", "resistances"]) optionalArray(defenses[key], `${label} ${creature.id}.defenses.${key}`, (item, path) => optionalString(item, path)); }
  if (creature.speeds !== undefined) { const speeds = requiredObject(creature.speeds, `${label} ${creature.id}.speeds`); for (const [key, item] of Object.entries(speeds)) optionalInteger(item, `${label} ${creature.id}.speeds.${key}`); }
  optionalArray(creature.strikes, `${label} ${creature.id}.strikes`, (strike, path) => { const item = requiredObject(strike, path); optionalString(item.id, `${path}.id`); optionalString(item.name, `${path}.name`); optionalInteger(item.actionCost, `${path}.actionCost`); optionalArray(item.traits, `${path}.traits`, (entry, entryPath) => optionalString(entry, entryPath)); validateStatistic(item.attack, `${path}.attack`); optionalArray(item.damage, `${path}.damage`, (damage, damagePath) => { const entry = requiredObject(damage, damagePath); optionalString(entry.expression, `${damagePath}.expression`); optionalString(entry.type, `${damagePath}.type`); }); optionalString(item.effect, `${path}.effect`); });
  optionalArray(creature.abilities, `${label} ${creature.id}.abilities`, (ability, path) => { const item = requiredObject(ability, path); optionalString(item.id, `${path}.id`); optionalString(item.name, `${path}.name`); optionalString(item.kind, `${path}.kind`); optionalInteger(item.actionCost, `${path}.actionCost`); optionalArray(item.traits, `${path}.traits`, (entry, entryPath) => optionalString(entry, entryPath)); optionalString(item.trigger, `${path}.trigger`); optionalString(item.requirements, `${path}.requirements`); optionalString(item.target, `${path}.target`); optionalString(item.range, `${path}.range`); optionalString(item.area, `${path}.area`); optionalString(item.duration, `${path}.duration`); optionalString(item.frequency, `${path}.frequency`); optionalString(item.effectText ?? item.effect_text, `${path}.effectText`); validateStatistic(item.resolution?.dc, `${path}.resolution.dc`); optionalArray(item.damage, `${path}.damage`, (damage, damagePath) => { const entry = requiredObject(damage, damagePath); optionalString(entry.expression, `${damagePath}.expression`); optionalString(entry.type, `${damagePath}.type`); }); optionalArray(item.conditions, `${path}.conditions`, (entry, entryPath) => optionalString(entry, entryPath)); });
  optionalString(creature.spellcastingStatus ?? creature.spellcasting_status, `${label} ${creature.id}.spellcastingStatus`); optionalArray(creature.spellcastingBlocks ?? creature.spellcasting_blocks, `${label} ${creature.id}.spellcastingBlocks`, (item, path) => optionalString(item, path)); optionalString(creature.tactics, `${label} ${creature.id}.tactics`); optionalString(creature.morale, `${label} ${creature.id}.morale`);
}

function validateNPCProfileRecord(value, label = "NPC Profile") {
  const profile = requiredObject(value, label);
  if (typeof profile.id !== "string" || !profile.id.trim()) throw new EncounterFileError("invalid_payload", `${label} records require a non-empty id.`);
  optionalInteger(profile.objectVersion ?? profile.object_version, `${label} ${profile.id}.objectVersion`); optionalInteger(profile.revision, `${label} ${profile.id}.revision`); optionalString(profile.participantGroupID ?? profile.participant_group_id, `${label} ${profile.id}.participantGroupID`); optionalString(profile.tier, `${label} ${profile.id}.tier`); optionalString(profile.name, `${label} ${profile.id}.name`);
  for (const key of ["encounterPurpose", "encounter_purpose", "immediateGoal", "immediate_goal", "moraleExit", "morale_exit", "appearanceHook", "appearance_hook", "voiceManner", "voice_manner", "deeperMotivation", "deeper_motivation", "fear", "leverage", "attitude", "combatObjective", "combat_objective", "peacefulResponse", "peaceful_response", "futureConsequence", "future_consequence"]) optionalString(profile[key], `${label} ${profile.id}.${key}`);
  optionalArray(profile.knowledge, `${label} ${profile.id}.knowledge`, (item, path) => { if (typeof item === "string") return; const note = requiredObject(item, path); optionalString(note.topic, `${path}.topic`); optionalString(note.state, `${path}.state`); optionalString(note.text, `${path}.text`); });
  if (profile.provenance !== undefined) requiredObject(profile.provenance, `${label} ${profile.id}.provenance`);
}

function validateHazardRecord(value, label = "Hazard") {
  const hazard = requiredObject(value, label);
  if (typeof hazard.id !== "string" || !hazard.id.trim()) throw new EncounterFileError("invalid_payload", `${label} records require a non-empty id.`);
  if (hazard.identity !== undefined) { const identity = requiredObject(hazard.identity, `${label} ${hazard.id}.identity`); optionalString(identity.name, `${label} ${hazard.id}.identity.name`); optionalInteger(identity.level, `${label} ${hazard.id}.identity.level`); optionalString(identity.type, `${label} ${hazard.id}.identity.type`); optionalString(identity.complexity, `${label} ${hazard.id}.identity.complexity`); optionalArray(identity.traits, `${label} ${hazard.id}.identity.traits`, (item, path) => optionalString(item, path)); }
  optionalString(hazard.description, `${label} ${hazard.id}.description`); optionalString(hazard.trigger, `${label} ${hazard.id}.trigger`); optionalString(hazard.reset, `${label} ${hazard.id}.reset`); if (hazard.detection !== undefined) { const detection = requiredObject(hazard.detection, `${label} ${hazard.id}.detection`); optionalString(detection.kind, `${label} ${hazard.id}.detection.kind`); optionalString(detection.band, `${label} ${hazard.id}.detection.band`); optionalInteger(detection.value, `${label} ${hazard.id}.detection.value`); optionalString(detection.minimumProficiency ?? detection.minimum_proficiency, `${label} ${hazard.id}.detection.minimumProficiency`); }
  optionalArray(hazard.disableMethods ?? hazard.disable_methods, `${label} ${hazard.id}.disableMethods`, (method, path) => { const item = requiredObject(method, path); optionalString(item.skill, `${path}.skill`); optionalInteger(item.dc, `${path}.dc`); });
  if (hazard.defenses !== undefined && hazard.defenses !== null) { const defenses = requiredObject(hazard.defenses, `${label} ${hazard.id}.defenses`); for (const key of ["ac", "hardness", "hp", "fortitude", "reflex", "will"]) optionalInteger(defenses[key], `${label} ${hazard.id}.defenses.${key}`); }
  if (hazard.effect !== undefined) { const effect = requiredObject(hazard.effect, `${label} ${hazard.id}.effect`); optionalString(effect.text, `${label} ${hazard.id}.effect.text`); optionalArray(effect.conditions, `${label} ${hazard.id}.effect.conditions`, (item, path) => optionalString(item, path)); optionalArray(effect.damage, `${label} ${hazard.id}.effect.damage`, (damage, path) => { const item = requiredObject(damage, path); optionalString(item.expression, `${path}.expression`); optionalString(item.type, `${path}.type`); }); }
}

function validatePartyProfileRecord(value, label = "Party Profile") {
  const profile = requiredObject(value, label);
  if (typeof profile.id !== "string" || !profile.id.trim()) throw new EncounterFileError("invalid_payload", `${label} records require a non-empty id.`);
}

function validateCatalogRecord(value, label = "Embedded catalog entry") {
  const entry = requiredObject(value, label);
  if (entry.id !== undefined && (typeof entry.id !== "string" || !entry.id.trim())) throw new EncounterFileError("invalid_payload", `${label} requires a non-empty id.`);
}

function validatePayload(root) {
  const data = root.data;
  if (root.export_kind !== "encounter") throw new EncounterFileError("unsupported_export_kind", "Only encounter exports can be loaded as an Encounter Draft.");
  if (data.object_type !== "encounter") throw new EncounterFileError("invalid_payload", "data.object_type must be encounter.");
  if (data.object_version !== 1) throw new EncounterFileError("unsupported_schema_version", `Encounter object version ${data.object_version} is not supported.`);
  if (!isObject(data.encounter)) throw new EncounterFileError("invalid_payload", "data.encounter is required.");
  const embedded = componentArrays(data);
  for (const creature of embedded.creatures) if (!isCatalogSnapshot(creature)) validateCreatureRecord(creature, "Embedded Creature");
  for (const profile of embedded.npc_profiles) validateNPCProfileRecord(profile, "Embedded NPC Profile");
  for (const hazard of embedded.hazards) if (!isCatalogSnapshot(hazard)) validateHazardRecord(hazard, "Embedded Hazard");
  for (const entry of embedded.embedded_catalog_entries ?? []) validateCatalogRecord(entry);
  if (!Array.isArray(data.encounter.participant_groups)) throw new EncounterFileError("invalid_payload", "participant_groups must be an array.");
  if (!Array.isArray(data.encounter.hazards)) throw new EncounterFileError("invalid_payload", "hazards must be an array.");
  if (!Array.isArray(data.encounter.phases)) throw new EncounterFileError("invalid_payload", "phases must be an array.");
  const placed = [data.encounter, ...data.encounter.participant_groups, ...data.encounter.hazards, ...data.encounter.phases];
  const placedIDs = new Set();
  for (const item of placed) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) throw new EncounterFileError("invalid_payload", "Every encounter and component object requires an id.");
    if (placedIDs.has(item.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${item.id}.`);
    placedIDs.add(item.id);
  }
  const embeddedIDs = new Set();
  for (const item of [...embedded.creatures, ...embedded.npc_profiles, ...embedded.hazards, ...(embedded.embedded_catalog_entries ?? [])]) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) throw new EncounterFileError("invalid_payload", "Every embedded component requires an id.");
    if (embeddedIDs.has(item.id) && !mirroredCatalogEntry(item, embedded)) throw new EncounterFileError("duplicate_id", `Duplicate embedded Component ID ${item.id}.`);
    embeddedIDs.add(item.id);
  }
  const attachmentIDs = new Set(normalizeAttachments(data.attachments ?? []).map((attachment) => attachment.id));
  const groupIDs = new Set(data.encounter.participant_groups.map((group) => group.id));
  const hazardIDs = new Set(data.encounter.hazards.map((hazard) => hazard.id));
  const phaseIDs = new Set(data.encounter.phases.map((phase) => phase.id));
  for (const group of data.encounter.participant_groups) {
    if (!isObject(group) || typeof group.id !== "string") throw new EncounterFileError("invalid_payload", "Participant Groups require IDs.");
    if (!Number.isInteger(group.quantity) || group.quantity < 1) throw new EncounterFileError("invalid_payload", `Participant Group ${group.id} has an invalid quantity.`);
    if (group.phase_ids && (!Array.isArray(group.phase_ids) || group.phase_ids.some((id) => !phaseIDs.has(id)))) throw new EncounterFileError("invalid_reference", `Participant Group ${group.id} references an unknown Phase.`);
  }
  for (const phase of data.encounter.phases) {
    for (const id of phase.active_participant_group_ids ?? phase.participant_ids ?? []) if (!groupIDs.has(id)) throw new EncounterFileError("invalid_reference", `Phase ${phase.id} references unknown Participant Group ${id}.`);
    for (const id of phase.active_hazard_ids ?? phase.hazard_ids ?? []) if (!hazardIDs.has(id)) throw new EncounterFileError("invalid_reference", `Phase ${phase.id} references unknown Hazard ${id}.`);
  }
  validateAttachmentReferences(data.encounter, attachmentIDs);
  validateGlobalEncounterIDs(data.encounter, embedded, data.attachments ?? []);
  return root;
}

function isCatalogSnapshot(value) {
  return isObject(value) && (value.snapshotKind === "catalog" || value.snapshot_kind === "catalog" || ((typeof (value.contentID ?? value.content_id) === "string") && value.detail !== undefined));
}

function mirroredCatalogEntry(value, embedded) {
  return isCatalogSnapshot(value) && [...embedded.embedded_catalog_entries ?? []].some((entry) => isCatalogSnapshot(entry) && deterministicJSONString(entry) === deterministicJSONString(value));
}

function encounterArray(encounter, ...keys) {
  for (const key of keys) if (encounter[key] !== undefined) return encounter[key];
  return undefined;
}

function recordID(value, label) {
  if (!isObject(value) || typeof value.id !== "string" || !value.id.trim()) throw new EncounterFileError("invalid_payload", `${label} records require a non-empty id.`);
  return value.id;
}

function registerID(registry, id, label) {
  if (registry.has(id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${id}.`);
  registry.add(id);
}

function collectEncounterIDs(encounter, registry, { allowMirroredPhases = true, tolerateExisting = false } = {}) {
  requiredObject(encounter, "Encounter");
  const register = (value, label) => tolerateExisting && registry.has(value) ? undefined : registerID(registry, value, label);
  register(recordID(encounter, "Encounter"), "Encounter");
  const groups = encounterArray(encounter, "participant_groups", "participantGroups") ?? [];
  const hazards = encounterArray(encounter, "hazards") ?? [];
  const phases = encounterArray(encounter, "phases") ?? [];
  const structured = encounterArray(encounter, "structured_phases", "structuredPhases") ?? [];
  for (const item of groups) register(recordID(item, "Participant Group"), "Participant Group");
  for (const item of hazards) register(recordID(item, "Encounter Hazard"), "Encounter Hazard");
  for (const item of phases) register(recordID(item, "Phase"), "Phase");
  for (const item of structured) {
    const id = recordID(item, "Structured Phase");
    if (!allowMirroredPhases || !phases.some((phase) => phase?.id === id)) register(id, "Structured Phase");
  }
  for (const item of encounterArray(encounter, "original_creatures", "originalCreatures") ?? []) { validateCreatureRecord(item, "Original Creature"); register(recordID(item, "Original Creature"), "Original Creature"); }
  const placedHazardIDs = new Set(hazards.map((item) => item?.id));
  const customHazardIDs = new Set();
  for (const item of encounterArray(encounter, "custom_hazards", "customHazards") ?? []) {
    validateHazardRecord(item, "Simple Hazard");
    const id = recordID(item, "Simple Hazard");
    if (customHazardIDs.has(id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${id}.`);
    customHazardIDs.add(id);
    // A custom Hazard is embedded alongside its placed Encounter Hazard in
    // self-contained drafts. They are one logical record, not two IDs.
    if (!placedHazardIDs.has(id)) register(id, "Simple Hazard");
  }
  for (const item of encounterArray(encounter, "npc_profiles", "npcProfiles") ?? []) { validateNPCProfileRecord(item, "NPC Profile"); register(recordID(item, "NPC Profile"), "NPC Profile"); }
  for (const item of encounterArray(encounter, "embedded_catalog_entries", "embeddedCatalogEntries") ?? []) { validateCatalogRecord(item); register(recordID(item, "Catalog Entry"), "Catalog Entry"); }
  const generation = encounter.generation ?? encounter.generation_metadata;
  const opening = generation?.openingDraftJSON ?? generation?.opening_draft_json;
  if (typeof opening === "string") {
    try { const parsed = JSON.parse(opening); if (isObject(parsed)) collectEncounterIDs(parsed, registry, { allowMirroredPhases, tolerateExisting: true }); } catch { /* Native leaves an undecodable opening snapshot opaque. */ }
  }
}

function validateGlobalEncounterIDs(encounter, embedded, attachments) {
  const ids = new Set();
  collectEncounterIDs(encounter, ids);
  const placedHazardIDs = new Set((encounterArray(encounter, "hazards") ?? []).map((item) => item?.id));
  const embeddedCustomHazardIDs = new Set();
  for (const item of [...embedded.creatures, ...embedded.npc_profiles, ...embedded.hazards]) {
    if (!isCatalogSnapshot(item)) {
      const id = recordID(item, "Embedded component");
      if (embedded.hazards.includes(item)) {
        if (embeddedCustomHazardIDs.has(id)) throw new EncounterFileError("duplicate_id", `Duplicate embedded Component ID ${id}.`);
        embeddedCustomHazardIDs.add(id);
        if (placedHazardIDs.has(id)) continue;
      }
      registerID(ids, id, "Embedded component");
    }
    else if (!mirroredCatalogEntry(item, embedded)) registerID(ids, recordID(item, "Catalog snapshot"), "Catalog snapshot");
  }
  for (const item of embedded.embedded_catalog_entries ?? []) {
    const mirrored = [...embedded.creatures, ...embedded.hazards].some((candidate) => candidate !== item && mirroredCatalogEntry(candidate, { embedded_catalog_entries: [item] }));
    if (!mirrored) registerID(ids, recordID(item, "Catalog Entry"), "Catalog Entry");
  }
  for (const item of normalizeAttachments(attachments)) registerID(ids, recordID(item, "Attachment"), "Attachment");
}

function validateAttachmentReferences(value, attachmentIDs) {
  if (Array.isArray(value)) return value.forEach((item) => validateAttachmentReferences(item, attachmentIDs));
  if (!isObject(value)) return;
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:attachment_id|attachmentID)$/i.test(key) && item !== null && item !== undefined && (!attachmentIDs.has(item))) throw new EncounterFileError("invalid_reference", `Unknown attachment reference ${item}.`);
    if (/(?:attachment_ids|attachmentIDs)$/i.test(key) && Array.isArray(item)) for (const id of item) if (!attachmentIDs.has(id)) throw new EncounterFileError("invalid_reference", `Unknown attachment reference ${id}.`);
    validateAttachmentReferences(item, attachmentIDs);
  }
}

function stripDerived(encounter) {
  const value = clone(encounter);
  for (const key of ["budget", "readiness", "validation", "warnings", "search_index", "construction_budget", "inferred_threat", "total_encounter_xp", "peak_active_xp"]) delete value[key];
  delete value.revision;
  return value;
}

function embeddedFor(encounter, components = {}) {
  const catalogEntries = [...(encounter.embeddedCatalogEntries ?? encounter.embedded_catalog_entries ?? [])].map(clone);
  const catalogCreatures = catalogEntries.filter((entry) => catalogEntryKind(entry) === "creature");
  const catalogHazards = catalogEntries.filter((entry) => catalogEntryKind(entry) === "hazard");
  const unique = (values) => [...new Map(values.map((item) => [deterministicJSONString(item), item])).values()];
  const creatures = unique([...(components.creatures ?? encounter.originalCreatures ?? []), ...catalogCreatures]).map(clone).sort((a, b) => fixedOrder(a.id, b.id));
  const npcProfiles = [...(components.npcProfiles ?? encounter.npcProfiles ?? [])].map(clone).sort((a, b) => fixedOrder(a.id, b.id));
  const hazards = unique([...(components.hazards ?? encounter.customHazards ?? []), ...catalogHazards]).map(clone).sort((a, b) => fixedOrder(a.id, b.id));
  return { creatures, npc_profiles: npcProfiles, hazards, embedded_catalog_entries: catalogEntries.sort((a, b) => fixedOrder(a.id, b.id)) };
}

function catalogEntryKind(entry) {
  if (!isObject(entry)) return null;
  if (entry.kind === "creature" || entry.kind === "hazard") return entry.kind;
  if (entry.summary?.kind === "creature" || entry.summary?.kind === "hazard") return entry.summary.kind;
  return null;
}

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) throw new EncounterFileError("invalid_payload", "attachments must be an array.");
  const ids = new Set();
  const filenames = new Set();
  const result = attachments.map((attachment) => {
    if (!isObject(attachment) || typeof attachment.id !== "string" || !attachment.id.trim()) throw new EncounterFileError("invalid_payload", "Attachment metadata requires an id.");
    if (ids.has(attachment.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${attachment.id}.`);
    ids.add(attachment.id);
    if (typeof attachment.filename !== "string" || !attachment.filename.trim() || attachment.filename === "." || attachment.filename === ".." || attachment.filename.includes("/") || attachment.filename.includes("\\") || attachment.filename.includes("..") || /[\u0000-\u001f\u007f]/.test(attachment.filename)) throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} has an unsafe filename.`);
    if (filenames.has(attachment.filename)) throw new EncounterFileError("invalid_payload", `Attachment filename ${attachment.filename} is duplicated.`);
    filenames.add(attachment.filename);
    if (typeof attachment.mediaType !== "string" && typeof attachment.media_type !== "string") throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} requires a media type.`);
    if (attachment.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(attachment.sha256)) throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} has an invalid sha256.`);
    const value = clone(attachment);
    delete value.bytes; delete value.data; delete value.file;
    return transform(value, camelToSnake);
  }).sort((a, b) => fixedOrder(a.id, b.id));
  return result;
}

function normalizeImportedAttachments(attachments = []) {
  return normalizeAttachments(attachments).map((attachment) => transform(attachment, snakeToCamel));
}

export function createEncounterFile({ encounter, components = {}, attachments = [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  if (!isObject(encounter) || typeof encounter.id !== "string") throw new EncounterFileError("invalid_payload", "An Encounter Draft with an id is required.");
  const embedded = transform(embeddedFor(encounter, components), camelToSnake);
  const normalized = transform(stripDerived(encounter), camelToSnake);
  for (const key of ["original_creatures", "custom_hazards", "npc_profiles", "embedded_catalog_entries"]) delete normalized[key];
  normalized.object_version = 1;
  normalized.created_at ??= exportedAt;
  normalized.modified_at = exportedAt;
  normalized.tags ??= [];
  normalized.npc_only_participants ??= [];
  normalized.generation_metadata ??= normalized.generation ?? {};
  const root = {
    format: ENCOUNTER_FILE_FORMAT,
    format_version: ENCOUNTER_FILE_VERSION,
    export_kind: "encounter",
    exported_at: exportedAt,
    generator: clone(generator),
    license_notices: [...licenseNotices],
    data: {
      object_type: "encounter",
      object_version: 1,
      encounter: normalized,
      embedded_components: embedded,
      attachments: normalizeAttachments(attachments)
    }
  };
  return deterministicJSONString(root);
}

function freshID(original, occupied) {
  const prefix = String(original).split("_", 1)[0] || "id";
  let candidate = `${prefix}_imported`;
  let index = 2;
  while (occupied.has(candidate)) candidate = `${prefix}_imported_${index++}`;
  return candidate;
}

function remapObjectIDs(value, remapped) {
  if (Array.isArray(value)) return value.map((item) => remapObjectIDs(item, remapped));
  if (!isObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if ((key === "openingDraftJSON" || key === "opening_draft_json") && typeof item === "string") {
      try { return [key, JSON.stringify(remapObjectIDs(JSON.parse(item), remapped))]; } catch { return [key, item]; }
    }
    if (key === "id" && typeof item === "string") return [key, remapped.get(item) ?? item];
    if (["participant_ids", "hazard_ids", "phase_ids", "active_participant_group_ids", "active_hazard_ids", "participantIDs", "hazardIDs", "phaseIDs", "activeParticipantGroupIDs", "activeHazardIDs"].includes(key) && Array.isArray(item)) return [key, item.map((id) => remapped.get(id) ?? id)];
    if (Array.isArray(item) && /(?:_ids|IDs)$/.test(key) && !key.toLowerCase().includes("content")) return [key, item.map((id) => typeof id === "string" ? remapped.get(id) ?? id : remapObjectIDs(id, remapped))];
    if (typeof item === "string" && /(?:_id|ID|Id)$/.test(key) && !key.toLowerCase().includes("content")) return [key, remapped.get(item) ?? item];
    return [key, remapObjectIDs(item, remapped)];
  }));
}

function markImported(value, importedAt, originalID) {
  const result = clone(value);
  result.provenance = { ...(result.provenance ?? {}), origin: "imported", imported_from_id: originalID, imported_at: importedAt, last_changed_by: "import" };
  return result;
}

export function importEncounterFile(input, { existingIDs = [], importedAt = "1970-01-01T00:00:00Z" } = {}) {
  const root = validateEnvelope(asJSON(input));
  validatePayload(root);
  const data = root.data;
  const encounter = transform(stripDerived(data.encounter), snakeToCamel);
  const embedded = transform(data.embedded_components, snakeToCamel);
  const dedicatedCatalogEntries = embedded.embeddedCatalogEntries ?? [];
  const attachments = normalizeImportedAttachments(data.attachments ?? []);
  const ids = [
    encounter,
    ...(encounter.participantGroups ?? []),
    ...(encounter.hazards ?? []),
    ...(encounter.phases ?? []),
    ...(encounter.structuredPhases ?? []),
    ...(encounter.originalCreatures ?? []),
    ...(encounter.customHazards ?? []),
    ...(encounter.npcProfiles ?? []),
    ...(encounter.embeddedCatalogEntries ?? []),
    ...embedded.creatures,
    ...embedded.npcProfiles,
    ...embedded.hazards,
    ...dedicatedCatalogEntries,
    ...attachments
  ].map((item) => item.id);
  const occupied = new Set(existingIDs);
  const remapped = new Map();
  for (const id of [...new Set(ids)].sort()) {
    if (occupied.has(id)) { const replacement = freshID(id, occupied); remapped.set(id, replacement); occupied.add(replacement); }
    else occupied.add(id);
  }
  const originalByID = new Map(ids.map((id, index) => [id, id]));
  const remappedEncounter = remapObjectIDs(encounter, remapped);
  const remappedComponents = {
    creatures: embedded.creatures.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, originalByID.get(item.id) ?? item.id)),
    npcProfiles: embedded.npcProfiles.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, originalByID.get(item.id) ?? item.id)),
    hazards: embedded.hazards.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, originalByID.get(item.id) ?? item.id))
  };
  const remappedAttachments = attachments.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, item.id));
  const isCatalogSnapshot = item => item.snapshotKind === "catalog" || item.snapshot_kind === "catalog" || ((typeof item.contentID === "string" || typeof item.content_id === "string") && item.detail !== undefined);
  const originalCreatures = remappedComponents.creatures.filter(item => !isCatalogSnapshot(item));
  const catalogCreatureSnapshots = remappedComponents.creatures.filter(item => !originalCreatures.includes(item));
  const customHazards = remappedComponents.hazards.filter(item => !isCatalogSnapshot(item));
  const catalogHazardSnapshots = remappedComponents.hazards.filter(item => !customHazards.includes(item));
  remappedEncounter.originalCreatures = originalCreatures.length ? originalCreatures : (remappedEncounter.originalCreatures ?? []);
  remappedEncounter.customHazards = customHazards.length ? customHazards : (remappedEncounter.customHazards ?? []);
  // NPC Profiles are encounter-owned component records too. Keep the
  // remapped copies on the draft itself so the engine snapshot, browser
  // persistence, and a subsequent export all agree on the same IDs.
  remappedEncounter.npcProfiles = remappedComponents.npcProfiles;
  const remappedDedicatedCatalogEntries = dedicatedCatalogEntries.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, item.id));
  remappedEncounter.embeddedCatalogEntries = remappedDedicatedCatalogEntries.length > 0
    ? remappedDedicatedCatalogEntries
    : [...catalogCreatureSnapshots, ...catalogHazardSnapshots];
  remappedEncounter.revision = 0;
  remappedEncounter.provenance = { ...(remappedEncounter.provenance ?? {}), origin: "imported", imported_at: importedAt, last_changed_by: "import" };
  return { draft: remappedEncounter, components: remappedComponents, attachments: remappedAttachments, remappedIDs: Object.fromEntries(remapped), importedAt, sourceFormatVersion: root.format_version, migration: root.__migration ?? { from: root.format_version, to: root.format_version, applied: false } };
}

const COMPONENT_KEYS = Object.freeze(["creatures", "npc_profiles", "hazards", "party_profiles"]);
const LIBRARY_KEYS = Object.freeze(["encounters", ...COMPONENT_KEYS]);

function componentPayload(data, exportKind) {
  if (data.object_type !== exportKind) throw new EncounterFileError("invalid_payload", `data.object_type must be ${exportKind}.`);
  if (data.object_version !== 1) throw new EncounterFileError("unsupported_schema_version", `Data object version ${data.object_version} is not supported.`);
  const source = exportKind === "library" ? data : data.components;
  if (!isObject(source)) throw new EncounterFileError("invalid_payload", `${exportKind === "library" ? "library" : "components"} data is required.`);
  const result = {};
  for (const key of exportKind === "library" ? LIBRARY_KEYS : COMPONENT_KEYS) {
    const values = source[key];
    if (!Array.isArray(values)) throw new EncounterFileError("invalid_payload", `${key} must be an array.`);
    result[key] = values;
  }
  if (!Array.isArray(data.attachments)) throw new EncounterFileError("invalid_payload", "attachments must be an array.");
  result.attachments = data.attachments;
  return result;
}

function validateEncounterRecord(encounter) {
  if (!isObject(encounter) || typeof encounter.id !== "string" || !encounter.id.trim()) throw new EncounterFileError("invalid_payload", "Encounter records require an id.");
  if (encounter.object_version !== undefined && encounter.object_version !== 1) throw new EncounterFileError("unsupported_schema_version", `Encounter object version ${encounter.object_version} is not supported.`);
  const groups = encounter.participant_groups ?? encounter.participantGroups;
  const hazards = encounter.hazards;
  const phases = encounter.phases;
  const structuredPhases = encounter.structured_phases ?? encounter.structuredPhases;
  if (groups === undefined && hazards === undefined && phases === undefined && structuredPhases === undefined) return;
  if (!Array.isArray(groups) || !Array.isArray(hazards) || !Array.isArray(phases)) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id} has invalid component arrays.`);
  const groupIDs = new Set(groups.map((item) => item?.id));
  const hazardIDs = new Set(hazards.map((item) => item?.id));
  const phaseIDs = new Set(phases.map((item) => item?.id));
  groups.forEach((group, index) => {
    if (!isObject(group) || typeof group.id !== "string" || !group.id.trim()) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id} has an invalid participant group.`);
    const phaseReferences = group.phase_ids ?? group.active_phase_ids ?? group.phaseIDs ?? group.activePhaseIDs;
    if (phaseReferences !== undefined && (!Array.isArray(phaseReferences) || phaseReferences.some((id) => typeof id !== "string" || !phaseIDs.has(id)))) throw new EncounterFileError("invalid_reference", `Participant Group ${group.id} references an unknown Phase.`);
    optionalInteger(group.level, `Encounter ${encounter.id}.participant_groups[${index}].level`); optionalInteger(group.quantity, `Encounter ${encounter.id}.participant_groups[${index}].quantity`); optionalString(group.content_id ?? group.contentID, `Encounter ${encounter.id}.participant_groups[${index}].contentID`); optionalString(group.name, `Encounter ${encounter.id}.participant_groups[${index}].name`);
    for (const key of ["adjustment", "faction", "encounter_role", "encounterRole", "narrative_tier", "narrativeTier", "starting_area", "startingArea", "shared_tactics", "sharedTactics", "morale"]) optionalString(group[key], `Encounter ${encounter.id}.participant_groups[${index}].${key}`);
    if (group.participation !== undefined) { const participation = requiredObject(group.participation, `Encounter ${encounter.id}.participant_groups[${index}].participation`); optionalString(participation.mode, `Encounter ${encounter.id}.participant_groups[${index}].participation.mode`); optionalString(participation.condition, `Encounter ${encounter.id}.participant_groups[${index}].participation.condition`); }
  });
  hazards.forEach((hazard, index) => { if (!isObject(hazard) || typeof hazard.id !== "string" || !hazard.id.trim()) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id} has an invalid Hazard.`); optionalInteger(hazard.level, `Encounter ${encounter.id}.hazards[${index}].level`); optionalString(hazard.content_id ?? hazard.contentID, `Encounter ${encounter.id}.hazards[${index}].contentID`); optionalString(hazard.name, `Encounter ${encounter.id}.hazards[${index}].name`); optionalString(hazard.complexity, `Encounter ${encounter.id}.hazards[${index}].complexity`); if (hazard.participation !== undefined) { const participation = requiredObject(hazard.participation, `Encounter ${encounter.id}.hazards[${index}].participation`); optionalString(participation.mode, `Encounter ${encounter.id}.hazards[${index}].participation.mode`); optionalString(participation.condition, `Encounter ${encounter.id}.hazards[${index}].participation.condition`); } });
  phases.forEach((phase, index) => {
    if (!isObject(phase) || typeof phase.id !== "string" || !phase.id.trim()) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id} has an invalid Phase.`);
    for (const id of phase.active_participant_group_ids ?? phase.participant_ids ?? phase.activeParticipantGroupIDs ?? phase.participantIDs ?? []) if (!groupIDs.has(id)) throw new EncounterFileError("invalid_reference", `Phase ${phase.id} references unknown Participant Group ${id}.`);
    for (const id of phase.active_hazard_ids ?? phase.hazard_ids ?? phase.activeHazardIDs ?? phase.hazardIDs ?? []) if (!hazardIDs.has(id)) throw new EncounterFileError("invalid_reference", `Phase ${phase.id} references unknown Hazard ${id}.`);
    optionalInteger(phase.order, `Encounter ${encounter.id}.phases[${index}].order`); optionalString(phase.title, `Encounter ${encounter.id}.phases[${index}].title`);
  });
  if (structuredPhases !== undefined) {
    if (!Array.isArray(structuredPhases)) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id}.structured_phases must be an array.`);
    const seen = new Set();
    structuredPhases.forEach((phase, index) => {
      if (!isObject(phase) || typeof phase.id !== "string" || !phase.id.trim()) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id} has an invalid Structured Phase.`);
      if (seen.has(phase.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${phase.id}.`);
      seen.add(phase.id);
      if (!phaseIDs.has(phase.id)) { /* Native allows a distinct structured phase ID. */ }
      for (const id of phase.participant_ids ?? phase.active_participant_group_ids ?? phase.participantIDs ?? phase.activeParticipantGroupIDs ?? []) if (!groupIDs.has(id)) throw new EncounterFileError("invalid_reference", `Structured Phase ${phase.id} references unknown Participant Group ${id}.`);
      for (const id of phase.hazard_ids ?? phase.active_hazard_ids ?? phase.hazardIDs ?? phase.activeHazardIDs ?? []) if (!hazardIDs.has(id)) throw new EncounterFileError("invalid_reference", `Structured Phase ${phase.id} references unknown Hazard ${id}.`);
      optionalInteger(phase.order, `Encounter ${encounter.id}.structured_phases[${index}].order`);
    });
  }
  const profiles = encounter.npc_profiles ?? encounter.npcProfiles;
  if (profiles !== undefined && !Array.isArray(profiles)) throw new EncounterFileError("invalid_payload", `Encounter ${encounter.id}.npc_profiles must be an array.`);
  if (profiles !== undefined) for (const profile of profiles) {
    const participantID = profile?.participant_group_id ?? profile?.participantGroupID;
    if (participantID !== undefined && participantID !== null && !groupIDs.has(participantID)) throw new EncounterFileError("invalid_reference", `NPC Profile ${profile?.id ?? "(unknown)"} references unknown Participant Group ${participantID}.`);
  }
  optionalArray(encounter.original_creatures ?? encounter.originalCreatures, `Encounter ${encounter.id}.originalCreatures`, (item, path) => validateCreatureRecord(item, path));
  optionalArray(encounter.custom_hazards ?? encounter.customHazards, `Encounter ${encounter.id}.customHazards`, (item, path) => validateHazardRecord(item, path));
  optionalArray(encounter.npc_profiles ?? encounter.npcProfiles, `Encounter ${encounter.id}.npcProfiles`, (item, path) => validateNPCProfileRecord(item, path));
  optionalArray(encounter.embedded_catalog_entries ?? encounter.embeddedCatalogEntries, `Encounter ${encounter.id}.embeddedCatalogEntries`, (item, path) => validateCatalogRecord(item, path));
}

function validateLibraryRecords(payload) {
  if (!Array.isArray(payload.encounters ?? [])) throw new EncounterFileError("invalid_payload", "encounters must be an array.");
  for (const encounter of payload.encounters ?? []) validateEncounterRecord(encounter);
  const attachments = normalizeAttachments(payload.attachments ?? []);
  const attachmentIDs = new Set(attachments.map((attachment) => attachment.id));
  for (const creature of payload.creatures ?? []) validateCreatureRecord(creature);
  for (const profile of payload.npc_profiles ?? []) validateNPCProfileRecord(profile);
  for (const hazard of payload.hazards ?? []) validateHazardRecord(hazard);
  for (const profile of payload.party_profiles ?? []) validatePartyProfileRecord(profile);
  const ids = new Set();
  const nestedIDs = new Set();
  const nestedRecords = new Map();
  for (const encounter of payload.encounters ?? []) {
    const encounterIDs = new Set();
    collectEncounterIDs(encounter, encounterIDs);
    registerID(ids, recordID(encounter, "Encounter"), "Encounter");
    for (const id of encounterIDs) nestedIDs.add(id);
    for (const record of [
      ...(encounter.original_creatures ?? encounter.originalCreatures ?? []),
      ...(encounter.custom_hazards ?? encounter.customHazards ?? []),
      ...(encounter.npc_profiles ?? encounter.npcProfiles ?? []),
      ...(encounter.embedded_catalog_entries ?? encounter.embeddedCatalogEntries ?? [])
    ]) {
      const id = recordID(record, "Embedded library record");
      if (!nestedRecords.has(id)) nestedRecords.set(id, []);
      nestedRecords.get(id).push(record);
    }
  }
  const registerLibraryID = (record, label) => {
    const id = recordID(record, label);
    const mirrors = nestedRecords.get(id) ?? [];
    if (nestedIDs.has(id) && (!mirrors.length || mirrors.some((mirror) => deterministicJSONString(stripDerived(mirror)) !== deterministicJSONString(stripDerived(record))))) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${id}.`);
    registerID(ids, id, label);
  };
  for (const [kind, values] of [["Creature", payload.creatures], ["NPC Profile", payload.npc_profiles], ["Hazard", payload.hazards], ["Party Profile", payload.party_profiles]]) for (const record of values ?? []) registerLibraryID(record, kind);
  for (const attachment of attachments) registerLibraryID(attachment, "Attachment");
  for (const values of Object.values(payload)) if (Array.isArray(values)) for (const record of values) if (isObject(record)) validateAttachmentReferences(record, attachmentIDs);
  return ids;
}

function validateComponentIDs(groups) {
  const ids = new Set();
  for (const [kind, values] of Object.entries(groups)) {
    for (const item of values) {
      if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) throw new EncounterFileError("invalid_payload", `${kind} records require an id.`);
      if (ids.has(item.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${item.id}.`);
      ids.add(item.id);
    }
  }
  return ids;
}

function importedComponents(payload, { existingIDs = [], importedAt = "1970-01-01T00:00:00Z", migration = null } = {}) {
  const attachments = normalizeImportedAttachments(payload.attachments ?? []);
  validateComponentIDs({ ...payload, attachments });
  const records = Object.entries({ ...payload, attachments }).flatMap(([, values]) => values);
  const nestedIDs = new Set();
  for (const encounter of payload.encounters ?? []) {
    const encounterIDs = new Set();
    collectEncounterIDs(encounter, encounterIDs);
    for (const id of encounterIDs) nestedIDs.add(id);
  }
  const allIDs = new Set(records.map((item) => item.id));
  for (const id of nestedIDs) allIDs.add(id);
  const occupied = new Set(existingIDs);
  const remapped = new Map();
  for (const id of [...allIDs].sort()) {
    if (occupied.has(id)) {
      const replacement = freshID(id, occupied);
      remapped.set(id, replacement);
      occupied.add(replacement);
    } else occupied.add(id);
  }
  const components = {};
  for (const key of Object.keys(payload).filter((key) => key !== "attachments")) {
    components[key === "npc_profiles" ? "npcProfiles" : key === "party_profiles" ? "partyProfiles" : key] = payload[key].map((item) => markImported(remapObjectIDs(item, remapped), importedAt, item.id));
  }
  const importedAttachments = attachments.map((item) => markImported(remapObjectIDs(item, remapped), importedAt, item.id));
  return {
    components,
    attachments: importedAttachments,
    remappedIDs: Object.fromEntries(remapped),
    importedAt,
    sourceFormatVersion: 1,
    migration: migration ?? { from: 1, to: 1, applied: false }
  };
}

/** Export selected reusable records without replacing the local library. */
export function createComponentsFile({ components = {}, attachments = [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  const normalized = {};
  for (const key of COMPONENT_KEYS) normalized[key] = [...(components[key] ?? components[key === "npc_profiles" ? "npcProfiles" : key === "party_profiles" ? "partyProfiles" : key] ?? [])].map(clone).sort((a, b) => fixedOrder(a.id, b.id));
  validateComponentIDs(normalized);
  return deterministicJSONString({ format: ENCOUNTER_FILE_FORMAT, format_version: ENCOUNTER_FILE_VERSION, export_kind: "components", exported_at: exportedAt, generator: clone(generator), license_notices: [...licenseNotices], data: { object_type: "components", object_version: 1, components: transform(normalized, camelToSnake), attachments: normalizeAttachments(attachments) } });
}

/** Export the local library as the intentionally flat v1 library envelope. */
export function createLibraryFile({ library = {}, encounters = library.encounters ?? [], creatures = library.creatures ?? [], npcProfiles = library.npcProfiles ?? library.npc_profiles ?? [], hazards = library.hazards ?? [], partyProfiles = library.partyProfiles ?? library.party_profiles ?? [], attachments = library.attachments ?? [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  const value = { encounters, creatures, npc_profiles: npcProfiles, hazards, party_profiles: partyProfiles };
  validateComponentIDs(value);
  const normalized = Object.fromEntries(Object.entries(value).map(([key, records]) => [key, records.map((item) => transform(stripDerived(item), camelToSnake)).sort((a, b) => fixedOrder(a.id, b.id))]));
  return deterministicJSONString({ format: ENCOUNTER_FILE_FORMAT, format_version: ENCOUNTER_FILE_VERSION, export_kind: "library", exported_at: exportedAt, generator: clone(generator), license_notices: [...licenseNotices], data: { object_type: "library", object_version: 1, ...normalized, attachments: normalizeAttachments(attachments) } });
}

export function importComponentsFile(input, options = {}) {
  const root = validateEnvelope(asJSON(input));
  if (root.export_kind !== "components") throw new EncounterFileError("unsupported_export_kind", "Only components exports can be loaded as reusable components.");
  const payload = componentPayload(root.data, "components");
  validateLibraryRecords(payload);
  return importedComponents(transform(payload, snakeToCamel), { ...options, migration: root.__migration });
}

export function importLibraryFile(input, options = {}) {
  const root = validateEnvelope(asJSON(input));
  if (root.export_kind !== "library") throw new EncounterFileError("unsupported_export_kind", "Only library exports can be loaded as a local library.");
  const payload = componentPayload(root.data, "library");
  validateLibraryRecords(payload);
  const imported = importedComponents(transform(payload, snakeToCamel), { ...options, migration: root.__migration });
  imported.encounters = imported.components.encounters ?? [];
  delete imported.components.encounters;
  return imported;
}

export const exportComponentsFile = createComponentsFile;
export const exportLibraryFile = createLibraryFile;
export const parseComponentsFile = importComponentsFile;
export const parseLibraryFile = importLibraryFile;

function bytesFor(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (typeof value === "string") return new TextEncoder().encode(value);
  if (Array.isArray(value)) return Uint8Array.from(value);
  throw new EncounterFileError("invalid_attachment", "Attachment data must be bytes, an ArrayBuffer, or text.");
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function u16(value) { return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]); }
function u32(value) { return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]); }
function concatBytes(...parts) { const result = new Uint8Array(parts.reduce((total, part) => total + part.length, 0)); let offset = 0; for (const part of parts) { result.set(part, offset); offset += part.length; } return result; }

/**
 * Creates a stored ZIP archive. The manifest is always at the root and
 * attachment payloads always live below `attachments/`, as required by v1.
 * Compression is deliberately omitted so this adapter works without a
 * dependency in the static browser build.
 */
export function createSidekickDMZip({ manifest, attachments = [] } = {}) {
  const manifestText = typeof manifest === "string" ? manifest : deterministicJSONString(manifest);
  const names = new Set(["manifest.sidekickdm.json"]);
  const entries = [{ name: "manifest.sidekickdm.json", bytes: bytesFor(manifestText) }, ...attachments.filter((attachment) => attachment.bytes !== undefined || attachment.data !== undefined || attachment.file !== undefined).map((attachment) => {
    const metadata = attachment.metadata ?? attachment;
    const filename = metadata.filename;
    if (typeof filename !== "string" || !filename.trim() || filename.includes("/") || filename.includes("\\") || filename.includes("..")) throw new EncounterFileError("invalid_attachment", "ZIP attachment filenames must be safe leaf names.");
    const archiveName = `attachments/${filename}`;
    if (names.has(archiveName)) throw new EncounterFileError("invalid_attachment", `ZIP attachment filename ${filename} is duplicated.`);
    names.add(archiveName);
    return { name: archiveName, bytes: bytesFor(attachment.bytes ?? attachment.data ?? attachment.file) };
  })];
  const local = []; const central = []; let offset = 0;
  for (const entry of entries) {
    const name = bytesFor(entry.name); const checksum = crc32(entry.bytes);
    const header = concatBytes(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(checksum), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), name);
    local.push(header, entry.bytes);
    const directory = concatBytes(Uint8Array.from([0x50, 0x4b, 0x01, 0x02]), u16(20), u16(20), u16(0x800), u16(0), u16(0), u16(0), u32(checksum), u32(entry.bytes.length), u32(entry.bytes.length), u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), name);
    central.push(directory);
    offset += header.length + entry.bytes.length;
  }
  const centralBytes = concatBytes(...central); const localBytes = concatBytes(...local);
  const end = concatBytes(Uint8Array.from([0x50, 0x4b, 0x05, 0x06]), u16(0), u16(0), u16(entries.length), u16(entries.length), u32(centralBytes.length), u32(localBytes.length), u16(0));
  return concatBytes(localBytes, centralBytes, end);
}

function readU16(bytes, offset) { return bytes[offset] | (bytes[offset + 1] << 8); }
function readU32(bytes, offset) { return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0; }

function archiveError(code, message, details = {}) { return new EncounterFileError(code, message, details); }

function decodeZipName(bytes) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { throw archiveError("invalid_archive", "ZIP entry filename is not valid UTF-8."); }
}

function locateEOCD(bytes) {
  const minimum = 22;
  const start = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - minimum; offset >= start; offset -= 1) {
    if (readU32(bytes, offset) !== 0x06054b50) continue;
    const commentLength = readU16(bytes, offset + 20);
    if (offset + minimum + commentLength !== bytes.length) continue;
    return offset;
  }
  throw archiveError("invalid_archive", "ZIP end-of-central-directory record is missing or has trailing garbage.");
}

function parseZipDirectory(input, { allowDeflate = false } = {}) {
  const bytes = bytesFor(input);
  if (bytes.length < 22) throw archiveError("invalid_archive", "ZIP archive is truncated.");
  const eocd = locateEOCD(bytes);
  const disk = readU16(bytes, eocd + 4); const directoryDisk = readU16(bytes, eocd + 6);
  const entriesOnDisk = readU16(bytes, eocd + 8); const entriesTotal = readU16(bytes, eocd + 10);
  const directorySize = readU32(bytes, eocd + 12); const directoryOffset = readU32(bytes, eocd + 16);
  if (disk !== 0 || directoryDisk !== 0 || entriesOnDisk !== entriesTotal) throw archiveError("unsupported_archive", "Multi-disk ZIP archives are not supported.");
  if (directoryOffset + directorySize !== eocd || directoryOffset > bytes.length) throw archiveError("invalid_archive", "ZIP central directory bounds are invalid.");
  const central = []; const names = new Set(); let cursor = directoryOffset;
  for (let index = 0; index < entriesTotal; index += 1) {
    if (cursor + 46 > eocd || readU32(bytes, cursor) !== 0x02014b50) throw archiveError("invalid_archive", "ZIP central directory is corrupt.");
    const flags = readU16(bytes, cursor + 8); const method = readU16(bytes, cursor + 10); const checksum = readU32(bytes, cursor + 16);
    const compressedSize = readU32(bytes, cursor + 20); const uncompressedSize = readU32(bytes, cursor + 24); const filenameLength = readU16(bytes, cursor + 28); const extraLength = readU16(bytes, cursor + 30); const commentLength = readU16(bytes, cursor + 32); const localOffset = readU32(bytes, cursor + 42);
    const end = cursor + 46 + filenameLength + extraLength + commentLength;
    if (end > eocd || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff || localOffset === 0xffffffff) throw archiveError("unsupported_archive", "ZIP64 archives are not supported.");
    if (flags & 0x01 || flags & 0x08) throw archiveError("unsupported_archive", "Encrypted ZIP entries and data descriptors are not supported.");
    if (method !== 0 && method !== 8) throw archiveError("unsupported_archive", `ZIP compression method ${method} is not supported.`);
    if (method === 8 && !allowDeflate) throw archiveError("unsupported_archive", "Deflated ZIP entries require the asynchronous archive importer.");
    const name = decodeZipName(bytes.slice(cursor + 46, cursor + 46 + filenameLength));
    if (!name || names.has(name)) throw archiveError("duplicate_entry", `ZIP entry ${name || "(empty)"} is duplicated.`);
    names.add(name);
    central.push({ name, flags, method, checksum, compressedSize, uncompressedSize, localOffset });
    cursor = end;
  }
  if (cursor !== eocd) throw archiveError("invalid_archive", "ZIP central directory has trailing bytes.");
  const localOffsets = [...central].sort((a, b) => a.localOffset - b.localOffset);
  if (localOffsets.length && localOffsets[0].localOffset !== 0) throw archiveError("invalid_archive", "ZIP local entries do not start at the beginning of the archive.");
  const entries = new Map();
  for (let index = 0; index < localOffsets.length; index += 1) {
    const item = localOffsets[index]; const offset = item.localOffset;
    if (offset + 30 > directoryOffset || readU32(bytes, offset) !== 0x04034b50) throw archiveError("invalid_archive", "ZIP local entry is corrupt.");
    const localFlags = readU16(bytes, offset + 6); const localMethod = readU16(bytes, offset + 8); const localChecksum = readU32(bytes, offset + 14); const localCompressedSize = readU32(bytes, offset + 18); const localUncompressedSize = readU32(bytes, offset + 22); const filenameLength = readU16(bytes, offset + 26); const extraLength = readU16(bytes, offset + 28);
    if (localFlags !== item.flags || localMethod !== item.method || localChecksum !== item.checksum || localCompressedSize !== item.compressedSize || localUncompressedSize !== item.uncompressedSize) throw archiveError("invalid_archive", `ZIP local header for ${item.name} does not match its central directory entry.`);
    const localName = decodeZipName(bytes.slice(offset + 30, offset + 30 + filenameLength));
    if (localName !== item.name) throw archiveError("invalid_archive", `ZIP local filename for ${item.name} does not match its central directory entry.`);
    const bodyStart = offset + 30 + filenameLength + extraLength; const bodyEnd = bodyStart + item.compressedSize;
    const expectedNext = index + 1 < localOffsets.length ? localOffsets[index + 1].localOffset : directoryOffset;
    if (bodyEnd !== expectedNext || bodyEnd > directoryOffset) throw archiveError("invalid_archive", `ZIP entry ${item.name} has invalid bounds.`);
    const compressed = bytes.slice(bodyStart, bodyEnd);
    if (item.method === 0 && (crc32(compressed) !== item.checksum || item.uncompressedSize !== compressed.length)) throw archiveError("checksum_mismatch", `ZIP entry ${item.name} failed CRC validation.`);
    entries.set(item.name, { ...item, compressed });
  }
  if (!entries.has("manifest.sidekickdm.json")) throw archiveError("invalid_archive", "ZIP manifest.sidekickdm.json is required.");
  return { bytes, entries };
}

function materializeStoredDirectory(directory) {
  const entries = new Map();
  for (const [name, item] of directory.entries) {
    if (item.method !== 0) throw archiveError("unsupported_archive", "Deflated ZIP entries require the asynchronous archive importer.");
    entries.set(name, item.compressed);
  }
  let manifest;
  try { manifest = asJSON(new TextDecoder("utf-8", { fatal: true }).decode(entries.get("manifest.sidekickdm.json"))); }
  catch (error) { if (error instanceof EncounterFileError) throw error; throw archiveError("invalid_archive", "ZIP manifest is not valid JSON."); }
  return { manifest, entries };
}

export function parseSidekickDMZip(input) { return materializeStoredDirectory(parseZipDirectory(input)); }

async function inflateRaw(bytes) {
  if (typeof globalThis.DecompressionStream !== "function") throw archiveError("unsupported_archive", "This browser cannot read deflated ZIP entries.");
  try {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  } catch { throw archiveError("invalid_archive", "ZIP deflated entry is corrupt."); }
}

async function parseSidekickDMZipAsync(input) {
  const directory = parseZipDirectory(input, { allowDeflate: true }); const entries = new Map();
  for (const [name, item] of directory.entries) {
    const value = item.method === 0 ? item.compressed : await inflateRaw(item.compressed);
    if (value.length !== item.uncompressedSize || crc32(value) !== item.checksum) throw archiveError("checksum_mismatch", `ZIP entry ${name} failed CRC validation.`);
    entries.set(name, value);
  }
  let manifest;
  try { manifest = asJSON(new TextDecoder("utf-8", { fatal: true }).decode(entries.get("manifest.sidekickdm.json"))); }
  catch (error) { if (error instanceof EncounterFileError) throw error; throw archiveError("invalid_archive", "ZIP manifest is not valid JSON."); }
  return { manifest, entries };
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new EncounterFileError("checksum_unavailable", "This browser cannot verify attachment checksums.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function archiveAttachmentInputs(attachments) {
  const metadata = [];
  const payloads = [];
  for (const attachment of attachments) {
    const value = { ...attachment };
    const raw = value.bytes ?? value.data ?? value.file;
    if (raw === undefined) {
      if (value.required) throw new EncounterFileError("missing_attachment", `Required attachment ${value.filename ?? value.id} has no file data.`);
      if (!value.sha256) throw new EncounterFileError("invalid_attachment", `Optional attachment ${value.filename ?? value.id} requires a sha256 when its file data is missing.`);
      metadata.push(value);
      continue;
    }
    const bytes = bytesFor(raw);
    const computed = await sha256Hex(bytes);
    if (value.sha256 !== undefined && String(value.sha256).toLowerCase() !== computed) throw new EncounterFileError("attachment_checksum_mismatch", `Attachment ${value.filename ?? value.id} failed checksum verification.`);
    metadata.push({ ...value, sha256: computed });
    payloads.push({ ...value, bytes });
  }
  normalizeAttachments(metadata);
  return { metadata, payloads };
}

function attachmentMetadataFromManifest(manifest) {
  const data = manifest?.data;
  if (!isObject(data) || !Array.isArray(data.attachments ?? [])) throw new EncounterFileError("invalid_payload", "Archive manifest data.attachments must be an array.");
  return normalizeImportedAttachments(data.attachments);
}

/** Verify required archive metadata and checksums before returning the JSON import. */
export async function importSidekickDMZip(input, options = {}) {
  const { manifest, entries } = await parseSidekickDMZipAsync(input); const metadata = attachmentMetadataFromManifest(manifest); const missingOptionalAttachments = [];
  for (const name of entries.keys()) if (name !== "manifest.sidekickdm.json" && (!name.startsWith("attachments/") || name.slice("attachments/".length).includes("/") || name.slice("attachments/".length) === "")) throw new EncounterFileError("invalid_archive", `ZIP entry ${name} is not a valid attachment path.`);
  const metadataNames = new Set(metadata.map((attachment) => `attachments/${attachment.filename}`));
  for (const name of entries.keys()) if (name !== "manifest.sidekickdm.json" && !metadataNames.has(name)) throw new EncounterFileError("invalid_archive", `ZIP entry ${name} is not declared by the manifest.`);
  for (const attachment of metadata) {
    if (!isObject(attachment) || typeof attachment.id !== "string" || typeof attachment.filename !== "string" || typeof attachment.sha256 !== "string") throw new EncounterFileError("invalid_payload", "Archive attachments require id, filename, and sha256 metadata.");
    const bytes = entries.get(`attachments/${attachment.filename}`);
    if (!bytes) { if (attachment.required) throw new EncounterFileError("missing_attachment", `Required attachment ${attachment.filename} is missing.`); missingOptionalAttachments.push(attachment.id); continue; }
    const checksum = await sha256Hex(bytes);
    if (checksum.toLowerCase() !== attachment.sha256.toLowerCase()) throw new EncounterFileError("attachment_checksum_mismatch", `Attachment ${attachment.filename} failed checksum verification.`);
  }
  const result = manifest.export_kind === "encounter" ? importEncounterFile(manifest, options) : manifest.export_kind === "components" ? importComponentsFile(manifest, options) : importLibraryFile(manifest, options);
  const importedAttachments = (result.attachments ?? []).map((item) => {
    const originalID = item.provenance?.imported_from_id ?? item.id;
    const source = metadata.find((metadataItem) => metadataItem.id === originalID) ?? item;
    return { ...item, bytes: entries.get(`attachments/${source.filename}`) ?? null };
  });
  return { ...result, sourceExportKind: manifest.export_kind, missingOptionalAttachments, attachments: importedAttachments };
}

export async function createEncounterArchive({ encounter, components = {}, attachments = [], ...options } = {}) {
  const prepared = await archiveAttachmentInputs(attachments);
  const manifest = createEncounterFile({ encounter, components, attachments: prepared.metadata, ...options });
  return createSidekickDMZip({ manifest, attachments: prepared.payloads });
}

export async function createComponentsArchive({ components = {}, attachments = [], ...options } = {}) {
  const prepared = await archiveAttachmentInputs(attachments);
  const manifest = createComponentsFile({ components, attachments: prepared.metadata, ...options });
  return createSidekickDMZip({ manifest, attachments: prepared.payloads });
}

export async function createLibraryArchive({ library, attachments = [], ...options } = {}) {
  const prepared = await archiveAttachmentInputs(attachments);
  const manifest = createLibraryFile({ library, attachments: prepared.metadata, ...options });
  return createSidekickDMZip({ manifest, attachments: prepared.payloads });
}

function request(requestObject) {
  return new Promise((resolve, reject) => {
    requestObject.onsuccess = () => resolve(requestObject.result);
    requestObject.onerror = () => reject(requestObject.error ?? new Error("IndexedDB request failed."));
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed."));
    transaction.onabort = () => reject(transaction.error ?? new Error("IndexedDB transaction aborted."));
  });
}

/** IndexedDB adapter: validation and remapping happen before one readwrite transaction. */
export class IndexedDBEncounterStore {
  constructor({ database = "sidekick-dm", version = 1, indexedDBFactory = globalThis.indexedDB, stores = ["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments", "library_metadata"] } = {}) {
    this.database = database;
    this.version = version;
    this.indexedDBFactory = indexedDBFactory;
    this.stores = stores;
  }

  async open() {
    if (!this.indexedDBFactory) throw new EncounterFileError("indexeddb_unavailable", "IndexedDB is not available in this browser.");
    const db = await new Promise((resolve, reject) => {
      const openRequest = this.indexedDBFactory.open(this.database, this.version);
      openRequest.onupgradeneeded = () => { for (const store of this.stores) if (!openRequest.result.objectStoreNames.contains(store)) openRequest.result.createObjectStore(store); };
      openRequest.onsuccess = () => resolve(openRequest.result);
      openRequest.onerror = () => reject(openRequest.error);
    });
    return db;
  }

  async clearLocalData() {
    const db = await this.open();
    try {
      const names = this.stores.filter(name => db.objectStoreNames.contains(name));
      if (!names.length) return;
      const transaction = db.transaction(names, "readwrite");
      for (const name of names) transaction.objectStore(name).clear();
      await transactionComplete(transaction);
    } finally {
      db.close?.();
    }
  }

  async allIDs() {
    const db = await this.open();
    const transaction = db.transaction(this.stores, "readonly");
    const ids = new Set();
    for (const storeName of this.stores) {
      const store = transaction.objectStore(storeName);
      const keys = await request(store.getAllKeys());
      for (const key of keys) if (typeof key === "string") ids.add(key);
      const values = await request(store.getAll());
      for (const value of values ?? []) if (value?.id) ids.add(value.id);
    }
    await transactionComplete(transaction);
    return ids;
  }

  async readLibrary() {
    const db = await this.open();
    const names = ["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments"].filter(name => this.stores.includes(name));
    const transaction = db.transaction(names, "readonly");
    const values = {};
    for (const name of names) values[name] = await request(transaction.objectStore(name).getAll());
    await transactionComplete(transaction);
    const unique = records => [...new Map((records ?? []).filter(record => record?.id).map(record => [record.id, record])).values()];
    return {
      encounters: unique(values.encounters),
      creatures: unique(values.creatures),
      npcProfiles: unique(values.npc_profiles),
      hazards: unique(values.hazards),
      partyProfiles: unique(values.party_profiles),
      attachments: unique(values.attachments)
    };
  }

  async saveLibraryRecord(kind, value) {
    const stores = { creature: "creatures", npcProfile: "npc_profiles", hazard: "hazards", partyProfile: "party_profiles" };
    const storeName = stores[kind];
    if (!storeName || !this.stores.includes(storeName)) throw new EncounterFileError("invalid_library_kind", `Unsupported library record kind ${kind}.`);
    if (!isObject(value) || typeof value.id !== "string" || !value.id) throw new EncounterFileError("invalid_payload", "A reusable library record with an id is required.");
    const db = await this.open();
    const transaction = db.transaction([storeName], "readwrite");
    transaction.objectStore(storeName).put(clone(value), value.id);
    await transactionComplete(transaction);
    return clone(value);
  }

  async prepareEncounter(input, { importedAt = new Date().toISOString() } = {}) {
    return importEncounterFile(input, { existingIDs: await this.allIDs(), importedAt });
  }

  async prepareArchive(input, { importedAt = new Date().toISOString(), expectedExportKind = null } = {}) {
    const result = await importSidekickDMZip(input, { existingIDs: await this.allIDs(), importedAt });
    if (expectedExportKind && result.sourceExportKind !== expectedExportKind) throw new EncounterFileError("unsupported_export_kind", `This control only accepts ${expectedExportKind} archives.`);
    return result;
  }

  async persistEncounter(result, { currentKey = null } = {}) {
    if (!result?.draft || !result?.components) throw new EncounterFileError("invalid_import_result", "A prepared Encounter import is required.");
    const db = await this.open();
    const names = ["encounters", "creatures", "npc_profiles", "hazards", "attachments"].filter(name => this.stores.includes(name));
    const transaction = db.transaction(names, "readwrite");
    transaction.objectStore("encounters").put(result.draft, result.draft.id);
    if (currentKey) transaction.objectStore("encounters").put(result.draft, currentKey);
    for (const creature of result.components.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const attachment of result.attachments ?? []) if (this.stores.includes("attachments")) transaction.objectStore("attachments").put(attachment, attachment.id);
    await transactionComplete(transaction);
  }

  async persistArchive(result, { currentKey = null } = {}) {
    if (!result || (!result.draft && !result.components && !result.encounters)) throw new EncounterFileError("invalid_import_result", "A prepared archive import is required.");
    const db = await this.open();
    const names = ["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments"].filter(name => this.stores.includes(name));
    const transaction = db.transaction(names, "readwrite");
    if (result.draft) {
      transaction.objectStore("encounters").put(result.draft, result.draft.id);
      if (currentKey) transaction.objectStore("encounters").put(result.draft, currentKey);
    }
    for (const encounter of result.encounters ?? []) transaction.objectStore("encounters").put(encounter, encounter.id);
    for (const creature of result.components?.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components?.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components?.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const party of result.components?.partyProfiles ?? []) transaction.objectStore("party_profiles").put(party, party.id);
    for (const attachment of result.attachments ?? []) if (attachment.bytes && this.stores.includes("attachments")) transaction.objectStore("attachments").put(attachment, attachment.id);
    await transactionComplete(transaction);
  }

  async importEncounter(input, { importedAt = new Date().toISOString(), currentKey = null } = {}) {
    // Parsing, validation, and ID remapping finish before one transaction starts.
    const result = await this.prepareEncounter(input, { importedAt });
    await this.persistEncounter(result, { currentKey });
    return result;
  }

  async importComponents(input, { importedAt = new Date().toISOString() } = {}) {
    const result = importComponentsFile(input, { existingIDs: await this.allIDs(), importedAt });
    const db = await this.open();
    const names = ["creatures", "npc_profiles", "hazards", "party_profiles", "attachments"].filter(name => this.stores.includes(name));
    const transaction = db.transaction(names, "readwrite");
    for (const creature of result.components.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const party of result.components.partyProfiles ?? []) transaction.objectStore("party_profiles").put(party, party.id);
    for (const attachment of result.attachments ?? []) transaction.objectStore("attachments").put(attachment, attachment.id);
    await transactionComplete(transaction);
    return result;
  }

  async importLibrary(input, { importedAt = new Date().toISOString() } = {}) {
    const result = importLibraryFile(input, { existingIDs: await this.allIDs(), importedAt });
    const db = await this.open();
    const names = ["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments"].filter(name => this.stores.includes(name));
    const transaction = db.transaction(names, "readwrite");
    for (const encounter of result.encounters ?? []) transaction.objectStore("encounters").put(encounter, encounter.id);
    for (const creature of result.components.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const party of result.components.partyProfiles ?? []) transaction.objectStore("party_profiles").put(party, party.id);
    for (const attachment of result.attachments ?? []) transaction.objectStore("attachments").put(attachment, attachment.id);
    await transactionComplete(transaction);
    return result;
  }

  async importArchive(input, { importedAt = new Date().toISOString(), expectedExportKind = null, engine = null, currentKey = null } = {}) {
    // ZIP parsing, migration, attachment verification, and ID remapping all
    // finish before this single IndexedDB transaction starts.
    const result = await this.prepareArchive(input, { importedAt, expectedExportKind });
    if (result.draft && engine) {
      let restored;
      try { restored = engine.execute({ command: "sidekickdm_load_draft", draft_json: JSON.stringify(result.draft), origin: "import" }); }
      catch (error) { throw new EncounterFileError("engine_rejected", error instanceof Error ? error.message : String(error)); }
      if (!restored?.ok) throw new EncounterFileError("engine_rejected", restored?.error?.message ?? "The native engine rejected the imported Encounter.");
      engine.snapshot = restored.snapshot;
    }
    await this.persistArchive(result, { currentKey: result.draft ? (currentKey ?? "current") : null });
    return result;
  }
}

/** Deterministic adapter useful for tests and non-browser hosts. */
export class MemoryEncounterStore {
  constructor({ encounters = {}, creatures = {}, npcProfiles = {}, hazards = {}, attachments = {} } = {}) {
    this.encounters = new Map(Object.entries(encounters));
    this.creatures = new Map(Object.entries(creatures));
    this.npcProfiles = new Map(Object.entries(npcProfiles));
    this.hazards = new Map(Object.entries(hazards));
    this.attachments = new Map(Object.entries(attachments));
  }

  importEncounter(input, { importedAt = "1970-01-01T00:00:00Z" } = {}) {
    const existing = new Set([...this.encounters.keys(), ...this.creatures.keys(), ...this.npcProfiles.keys(), ...this.hazards.keys(), ...this.attachments.keys()]);
    const result = importEncounterFile(input, { existingIDs: existing, importedAt });
    this.encounters.set(result.draft.id, result.draft);
    for (const creature of result.components.creatures) this.creatures.set(creature.id, creature);
    for (const profile of result.components.npcProfiles) this.npcProfiles.set(profile.id, profile);
    for (const hazard of result.components.hazards) this.hazards.set(hazard.id, hazard);
    for (const attachment of result.attachments ?? []) this.attachments.set(attachment.id, attachment);
    return result;
  }
}

/** In-memory reference implementation of the non-destructive library merge. */
export class MemoryLibraryStore {
  constructor({ encounters = {}, creatures = {}, npcProfiles = {}, hazards = {}, partyProfiles = {}, attachments = {} } = {}) {
    const records = (value) => value instanceof Map ? new Map(value) : new Map(Array.isArray(value) ? value.map((item) => [item.id, item]) : Object.entries(value));
    this.encounters = records(encounters); this.creatures = records(creatures); this.npcProfiles = records(npcProfiles); this.hazards = records(hazards); this.partyProfiles = records(partyProfiles); this.attachments = records(attachments);
  }

  allIDs() { return new Set([this.encounters, this.creatures, this.npcProfiles, this.hazards, this.partyProfiles, this.attachments].flatMap((store) => [...store.keys()])); }

  importComponents(input, options = {}) {
    const result = importComponentsFile(input, { ...options, existingIDs: this.allIDs() });
    this.#merge(result.components); this.#mergeAttachments(result.attachments);
    return result;
  }

  importLibrary(input, options = {}) {
    const result = importLibraryFile(input, { ...options, existingIDs: this.allIDs() });
    this.#merge({ ...result.components, encounters: result.encounters }); this.#mergeAttachments(result.attachments);
    return result;
  }

  async importArchive(input, options = {}) {
    const result = await importSidekickDMZip(input, { ...options, existingIDs: this.allIDs() });
    if (result.draft) {
      this.encounters.set(result.draft.id, result.draft);
      this.#merge(result.components);
    } else {
      this.#merge({ ...result.components, encounters: result.encounters });
    }
    this.#mergeAttachments(result.attachments);
    return result;
  }

  #merge(components) { for (const [key, store] of [["encounters", this.encounters], ["creatures", this.creatures], ["npcProfiles", this.npcProfiles], ["hazards", this.hazards], ["partyProfiles", this.partyProfiles]]) for (const item of components[key] ?? []) store.set(item.id, item); }
  #mergeAttachments(attachments) { for (const item of attachments ?? []) this.attachments.set(item.id, item); }
}

export const exportEncounterFile = createEncounterFile;
export const parseEncounterFile = importEncounterFile;
