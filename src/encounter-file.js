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

function camelToSnake(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replaceAll("i_d", "id");
}

function snakeToCamel(key) {
  return key
    .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    .replace(/Ids\b/g, "IDs")
    .replace(/Id\b/g, "ID");
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
  return embedded;
}

function validatePayload(root) {
  const data = root.data;
  if (root.export_kind !== "encounter") throw new EncounterFileError("unsupported_export_kind", "Only encounter exports can be loaded as an Encounter Draft.");
  if (data.object_type !== "encounter") throw new EncounterFileError("invalid_payload", "data.object_type must be encounter.");
  if (data.object_version !== 1) throw new EncounterFileError("unsupported_schema_version", `Encounter object version ${data.object_version} is not supported.`);
  if (!isObject(data.encounter)) throw new EncounterFileError("invalid_payload", "data.encounter is required.");
  const embedded = componentArrays(data);
  const all = [data.encounter, ...(data.encounter.participant_groups ?? []), ...(data.encounter.hazards ?? []), ...(data.encounter.phases ?? []), ...embedded.creatures, ...embedded.npc_profiles, ...embedded.hazards];
  const ids = new Set();
  for (const item of all) {
    if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) throw new EncounterFileError("invalid_payload", "Every encounter and component object requires an id.");
    if (ids.has(item.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${item.id}.`);
    ids.add(item.id);
  }
  if (!Array.isArray(data.encounter.participant_groups)) throw new EncounterFileError("invalid_payload", "participant_groups must be an array.");
  if (!Array.isArray(data.encounter.hazards)) throw new EncounterFileError("invalid_payload", "hazards must be an array.");
  if (!Array.isArray(data.encounter.phases)) throw new EncounterFileError("invalid_payload", "phases must be an array.");
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
  return root;
}

function stripDerived(encounter) {
  const value = clone(encounter);
  for (const key of ["budget", "readiness", "validation", "warnings", "search_index", "construction_budget", "inferred_threat", "total_encounter_xp", "peak_active_xp"]) delete value[key];
  delete value.revision;
  return value;
}

function embeddedFor(encounter, components = {}) {
  const creatures = [...(components.creatures ?? encounter.originalCreatures ?? [])].map(clone).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const npcProfiles = [...(components.npcProfiles ?? encounter.npcProfiles ?? [])].map(clone).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const hazards = [...(components.hazards ?? encounter.customHazards ?? [])].map(clone).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  return { creatures, npc_profiles: npcProfiles, hazards };
}

export function createEncounterFile({ encounter, components = {}, exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  if (!isObject(encounter) || typeof encounter.id !== "string") throw new EncounterFileError("invalid_payload", "An Encounter Draft with an id is required.");
  const normalized = transform(stripDerived(encounter), camelToSnake);
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
      embedded_components: transform(embeddedFor(encounter, components), camelToSnake),
      attachments: []
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
    if (key === "id" && typeof item === "string") return [key, remapped.get(item) ?? item];
    if (["participant_ids", "hazard_ids", "phase_ids", "active_participant_group_ids", "active_hazard_ids", "participantIDs", "hazardIDs", "phaseIDs", "activeParticipantGroupIDs", "activeHazardIDs"].includes(key) && Array.isArray(item)) return [key, item.map((id) => remapped.get(id) ?? id)];
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
  const ids = [
    encounter,
    ...(encounter.participantGroups ?? []),
    ...(encounter.hazards ?? []),
    ...(encounter.phases ?? []),
    ...embedded.creatures,
    ...embedded.npcProfiles,
    ...embedded.hazards
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
  remappedEncounter.originalCreatures = remappedComponents.creatures.length ? remappedComponents.creatures : remappedEncounter.originalCreatures;
  remappedEncounter.customHazards = remappedComponents.hazards.length ? remappedComponents.hazards : remappedEncounter.customHazards;
  remappedEncounter.revision = 0;
  remappedEncounter.provenance = { ...(remappedEncounter.provenance ?? {}), origin: "imported", imported_at: importedAt, last_changed_by: "import" };
  return { draft: remappedEncounter, components: remappedComponents, remappedIDs: Object.fromEntries(remapped), importedAt, sourceFormatVersion: root.format_version };
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

  async importEncounter(input, { importedAt = new Date().toISOString() } = {}) {
    // This parse/validation pass happens before `transaction("readwrite")`.
    const result = importEncounterFile(input, { existingIDs: await this.allIDs(), importedAt });
    const db = await this.open();
    const transaction = db.transaction(["encounters", "creatures", "npc_profiles", "hazards"], "readwrite");
    transaction.objectStore("encounters").put(result.draft, result.draft.id);
    for (const creature of result.components.creatures) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components.npcProfiles) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components.hazards) transaction.objectStore("hazards").put(hazard, hazard.id);
    await transactionComplete(transaction);
    return result;
  }
}

/** Deterministic adapter useful for tests and non-browser hosts. */
export class MemoryEncounterStore {
  constructor({ encounters = {}, creatures = {}, npcProfiles = {}, hazards = {} } = {}) {
    this.encounters = new Map(Object.entries(encounters));
    this.creatures = new Map(Object.entries(creatures));
    this.npcProfiles = new Map(Object.entries(npcProfiles));
    this.hazards = new Map(Object.entries(hazards));
  }

  importEncounter(input, { importedAt = "1970-01-01T00:00:00Z" } = {}) {
    const existing = new Set([...this.encounters.keys(), ...this.creatures.keys(), ...this.npcProfiles.keys(), ...this.hazards.keys()]);
    const result = importEncounterFile(input, { existingIDs: existing, importedAt });
    this.encounters.set(result.draft.id, result.draft);
    for (const creature of result.components.creatures) this.creatures.set(creature.id, creature);
    for (const profile of result.components.npcProfiles) this.npcProfiles.set(profile.id, profile);
    for (const hazard of result.components.hazards) this.hazards.set(hazard.id, hazard);
    return result;
  }
}

export const exportEncounterFile = createEncounterFile;
export const parseEncounterFile = importEncounterFile;
