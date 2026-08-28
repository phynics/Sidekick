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
  normalizeAttachments(data.attachments ?? []);
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

function normalizeAttachments(attachments = []) {
  if (!Array.isArray(attachments)) throw new EncounterFileError("invalid_payload", "attachments must be an array.");
  return attachments.map((attachment) => {
    if (!isObject(attachment) || typeof attachment.id !== "string" || !attachment.id.trim()) throw new EncounterFileError("invalid_payload", "Attachment metadata requires an id.");
    if (typeof attachment.filename !== "string" || !attachment.filename.trim() || attachment.filename.includes("/") || attachment.filename.includes("\\") || attachment.filename.includes("..")) throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} has an unsafe filename.`);
    if (typeof attachment.mediaType !== "string" && typeof attachment.media_type !== "string") throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} requires a media type.`);
    if (attachment.sha256 !== undefined && !/^[a-f0-9]{64}$/i.test(attachment.sha256)) throw new EncounterFileError("invalid_payload", `Attachment ${attachment.id} has an invalid sha256.`);
    const value = clone(attachment);
    delete value.bytes; delete value.data; delete value.file;
    return transform(value, camelToSnake);
  }).sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

export function createEncounterFile({ encounter, components = {}, attachments = [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
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
  return { draft: remappedEncounter, components: remappedComponents, remappedIDs: Object.fromEntries(remapped), importedAt, sourceFormatVersion: root.format_version, migration: root.__migration ?? { from: root.format_version, to: root.format_version, applied: false } };
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
    const values = source[key] ?? [];
    if (!Array.isArray(values)) throw new EncounterFileError("invalid_payload", `${key} must be an array.`);
    result[key] = values;
  }
  if (!Array.isArray(data.attachments ?? [])) throw new EncounterFileError("invalid_payload", "attachments must be an array.");
  result.attachments = data.attachments;
  return result;
}

function validateComponentIDs(groups) {
  const ids = new Set();
  for (const [kind, values] of Object.entries(groups)) {
    if (kind === "attachments") continue;
    for (const item of values) {
      if (!isObject(item) || typeof item.id !== "string" || !item.id.trim()) throw new EncounterFileError("invalid_payload", `${kind} records require an id.`);
      if (ids.has(item.id)) throw new EncounterFileError("duplicate_id", `Duplicate local ID ${item.id}.`);
      ids.add(item.id);
    }
  }
  return ids;
}

function importedComponents(payload, { existingIDs = [], importedAt = "1970-01-01T00:00:00Z", migration = null } = {}) {
  validateComponentIDs(payload);
  const records = Object.entries(payload).filter(([key]) => key !== "attachments").flatMap(([, values]) => values);
  const occupied = new Set(existingIDs);
  const remapped = new Map();
  for (const id of records.map((item) => item.id).sort()) {
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
  return {
    components,
    attachments: payload.attachments ?? [],
    remappedIDs: Object.fromEntries(remapped),
    importedAt,
    sourceFormatVersion: 1,
    migration: migration ?? { from: 1, to: 1, applied: false }
  };
}

/** Export selected reusable records without replacing the local library. */
export function createComponentsFile({ components = {}, attachments = [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  const normalized = {};
  for (const key of COMPONENT_KEYS) normalized[key] = [...(components[key] ?? components[key === "npc_profiles" ? "npcProfiles" : key === "party_profiles" ? "partyProfiles" : key] ?? [])].map(clone).sort((a, b) => String(a.id).localeCompare(String(b.id)));
  validateComponentIDs(normalized);
  return deterministicJSONString({ format: ENCOUNTER_FILE_FORMAT, format_version: ENCOUNTER_FILE_VERSION, export_kind: "components", exported_at: exportedAt, generator: clone(generator), license_notices: [...licenseNotices], data: { object_type: "components", object_version: 1, components: transform(normalized, camelToSnake), attachments: normalizeAttachments(attachments) } });
}

/** Export the local library as the intentionally flat v1 library envelope. */
export function createLibraryFile({ library = {}, encounters = library.encounters ?? [], creatures = library.creatures ?? [], npcProfiles = library.npcProfiles ?? library.npc_profiles ?? [], hazards = library.hazards ?? [], partyProfiles = library.partyProfiles ?? library.party_profiles ?? [], attachments = library.attachments ?? [], exportedAt = "1970-01-01T00:00:00Z", generator = { product: "Sidekick DM", version: "0.1.0" }, licenseNotices = [] } = {}) {
  const value = { encounters, creatures, npc_profiles: npcProfiles, hazards, party_profiles: partyProfiles };
  validateComponentIDs(value);
  const normalized = Object.fromEntries(Object.entries(value).map(([key, records]) => [key, records.map((item) => transform(stripDerived(item), camelToSnake)).sort((a, b) => String(a.id).localeCompare(String(b.id)))]));
  return deterministicJSONString({ format: ENCOUNTER_FILE_FORMAT, format_version: ENCOUNTER_FILE_VERSION, export_kind: "library", exported_at: exportedAt, generator: clone(generator), license_notices: [...licenseNotices], data: { object_type: "library", object_version: 1, ...normalized, attachments: normalizeAttachments(attachments) } });
}

export function importComponentsFile(input, options = {}) {
  const root = validateEnvelope(asJSON(input));
  if (root.export_kind !== "components") throw new EncounterFileError("unsupported_export_kind", "Only components exports can be loaded as reusable components.");
  const payload = componentPayload(root.data, "components");
  return importedComponents(transform(payload, snakeToCamel), { ...options, migration: root.__migration });
}

export function importLibraryFile(input, options = {}) {
  const root = validateEnvelope(asJSON(input));
  if (root.export_kind !== "library") throw new EncounterFileError("unsupported_export_kind", "Only library exports can be loaded as a local library.");
  const payload = componentPayload(root.data, "library");
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
  const entries = [{ name: "manifest.sidekickdm.json", bytes: bytesFor(manifestText) }, ...attachments.map((attachment) => {
    const metadata = attachment.metadata ?? attachment;
    const filename = metadata.filename;
    if (typeof filename !== "string" || !filename.trim() || filename.includes("/") || filename.includes("\\") || filename.includes("..")) throw new EncounterFileError("invalid_attachment", "ZIP attachment filenames must be safe leaf names.");
    return { name: `attachments/${filename}`, bytes: bytesFor(attachment.bytes ?? attachment.data ?? attachment.file) };
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

export function parseSidekickDMZip(input) {
  const bytes = bytesFor(input); const entries = new Map(); let offset = 0;
  while (offset + 4 <= bytes.length && readU32(bytes, offset) === 0x04034b50) {
    const method = readU16(bytes, offset + 8); const flags = readU16(bytes, offset + 6); const compressedSize = readU32(bytes, offset + 18); const filenameLength = readU16(bytes, offset + 26); const extraLength = readU16(bytes, offset + 28);
    if (flags & 0x08 || method !== 0) throw new EncounterFileError("unsupported_archive", "Only stored ZIP entries are supported.");
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + filenameLength)); const bodyStart = offset + 30 + filenameLength + extraLength; const bodyEnd = bodyStart + compressedSize;
    if (bodyEnd > bytes.length) throw new EncounterFileError("invalid_archive", "ZIP entry extends beyond the archive.");
    entries.set(name, bytes.slice(bodyStart, bodyEnd)); offset = bodyEnd;
  }
  if (!entries.has("manifest.sidekickdm.json")) throw new EncounterFileError("invalid_archive", "ZIP manifest.sidekickdm.json is required.");
  let manifest;
  try { manifest = asJSON(new TextDecoder().decode(entries.get("manifest.sidekickdm.json"))); } catch (error) { if (error instanceof EncounterFileError) throw error; throw new EncounterFileError("invalid_archive", "ZIP manifest is not valid JSON."); }
  return { manifest, entries };
}

async function sha256Hex(bytes) {
  if (!globalThis.crypto?.subtle) throw new EncounterFileError("checksum_unavailable", "This browser cannot verify attachment checksums.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function attachmentMetadataFromManifest(manifest) {
  const data = manifest?.data;
  if (!isObject(data) || !Array.isArray(data.attachments ?? [])) throw new EncounterFileError("invalid_payload", "Archive manifest data.attachments must be an array.");
  return data.attachments;
}

/** Verify required archive metadata and checksums before returning the JSON import. */
export async function importSidekickDMZip(input, options = {}) {
  const { manifest, entries } = parseSidekickDMZip(input); const metadata = attachmentMetadataFromManifest(manifest); const missingOptionalAttachments = [];
  for (const attachment of metadata) {
    if (!isObject(attachment) || typeof attachment.id !== "string" || typeof attachment.filename !== "string" || typeof attachment.sha256 !== "string") throw new EncounterFileError("invalid_payload", "Archive attachments require id, filename, and sha256 metadata.");
    const bytes = entries.get(`attachments/${attachment.filename}`);
    if (!bytes) { if (attachment.required) throw new EncounterFileError("missing_attachment", `Required attachment ${attachment.filename} is missing.`); missingOptionalAttachments.push(attachment.id); continue; }
    const checksum = await sha256Hex(bytes);
    if (checksum.toLowerCase() !== attachment.sha256.toLowerCase()) throw new EncounterFileError("attachment_checksum_mismatch", `Attachment ${attachment.filename} failed checksum verification.`);
  }
  const result = manifest.export_kind === "encounter" ? importEncounterFile(manifest, options) : manifest.export_kind === "components" ? importComponentsFile(manifest, options) : importLibraryFile(manifest, options);
  return { ...result, missingOptionalAttachments, attachments: metadata.map((item) => ({ ...item, bytes: entries.get(`attachments/${item.filename}`) ?? null })) };
}

export async function createEncounterArchive({ encounter, components = {}, attachments = [], ...options } = {}) {
  const metadata = [];
  for (const attachment of attachments) {
    const bytes = bytesFor(attachment.bytes ?? attachment.data ?? attachment.file);
    metadata.push({ ...attachment, sha256: attachment.sha256 ?? await sha256Hex(bytes) });
  }
  const manifest = createEncounterFile({ encounter, components, attachments: metadata, ...options });
  return createSidekickDMZip({ manifest, attachments });
}

export async function createComponentsArchive({ components = {}, attachments = [], ...options } = {}) {
  const metadata = [];
  for (const attachment of attachments) {
    const bytes = bytesFor(attachment.bytes ?? attachment.data ?? attachment.file);
    metadata.push({ ...attachment, sha256: attachment.sha256 ?? await sha256Hex(bytes) });
  }
  const manifest = createComponentsFile({ components, attachments: metadata, ...options });
  return createSidekickDMZip({ manifest, attachments });
}

export async function createLibraryArchive({ library, attachments = [], ...options } = {}) {
  const metadata = [];
  for (const attachment of attachments) {
    const bytes = bytesFor(attachment.bytes ?? attachment.data ?? attachment.file);
    metadata.push({ ...attachment, sha256: attachment.sha256 ?? await sha256Hex(bytes) });
  }
  const manifest = createLibraryFile({ library, attachments: metadata, ...options });
  return createSidekickDMZip({ manifest, attachments });
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

  async importComponents(input, { importedAt = new Date().toISOString() } = {}) {
    const result = importComponentsFile(input, { existingIDs: await this.allIDs(), importedAt });
    const db = await this.open();
    const transaction = db.transaction(["creatures", "npc_profiles", "hazards", "party_profiles", "attachments"], "readwrite");
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
    const transaction = db.transaction(["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments"], "readwrite");
    for (const encounter of result.encounters ?? []) transaction.objectStore("encounters").put(encounter, encounter.id);
    for (const creature of result.components.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const party of result.components.partyProfiles ?? []) transaction.objectStore("party_profiles").put(party, party.id);
    for (const attachment of result.attachments ?? []) transaction.objectStore("attachments").put(attachment, attachment.id);
    await transactionComplete(transaction);
    return result;
  }

  async importArchive(input, { importedAt = new Date().toISOString() } = {}) {
    // ZIP parsing, migration, attachment verification, and ID remapping all
    // finish before this single IndexedDB transaction starts.
    const result = await importSidekickDMZip(input, { existingIDs: await this.allIDs(), importedAt });
    const db = await this.open();
    const transaction = db.transaction(["encounters", "creatures", "npc_profiles", "hazards", "party_profiles", "attachments"], "readwrite");
    if (result.draft) transaction.objectStore("encounters").put(result.draft, result.draft.id);
    for (const encounter of result.encounters ?? []) transaction.objectStore("encounters").put(encounter, encounter.id);
    for (const creature of result.components?.creatures ?? []) transaction.objectStore("creatures").put(creature, creature.id);
    for (const profile of result.components?.npcProfiles ?? []) transaction.objectStore("npc_profiles").put(profile, profile.id);
    for (const hazard of result.components?.hazards ?? []) transaction.objectStore("hazards").put(hazard, hazard.id);
    for (const party of result.components?.partyProfiles ?? []) transaction.objectStore("party_profiles").put(party, party.id);
    for (const attachment of result.attachments ?? []) if (attachment.bytes) transaction.objectStore("attachments").put(attachment, attachment.id);
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
