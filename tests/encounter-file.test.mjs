import test from "node:test";
import assert from "node:assert/strict";
import {
  createEncounterFile,
  importEncounterFile,
  MemoryEncounterStore,
  MemoryLibraryStore,
  EncounterFileError,
  createComponentsFile,
  importComponentsFile,
  createLibraryFile,
  importLibraryFile,
  createSidekickDMZip,
  parseSidekickDMZip,
  createEncounterArchive,
  createLibraryArchive,
  importSidekickDMZip,
  IndexedDBEncounterStore
} from "../src/encounter-file.js";

function signature(bytes, value) {
  const wanted = Uint8Array.from(value);
  for (let offset = 0; offset <= bytes.length - wanted.length; offset += 1) {
    if (wanted.every((byte, index) => bytes[offset + index] === byte)) return offset;
  }
  return -1;
}

function fakeIndexedDB() {
  const records = new Map();
  const transactions = [];
  const names = { contains: name => records.has(name) };
  const db = {
    objectStoreNames: names,
    createObjectStore(name) { records.set(name, new Map()); return {}; },
    transaction(storeNames, mode) {
      let completeHandler = null;
      const transaction = { mode, pending: 0, onerror: null, onabort: null, objectStore(name) {
        const data = records.get(name);
        return {
          getAllKeys() { return request(data ? [...data.keys()] : []); },
          getAll() { return request(data ? [...data.values()] : []); },
          put(value, key) { if (!data) throw new Error(`Unknown fake store ${name}`); data.set(key, structuredClone(value)); return request(undefined, transaction); }
        };
      } };
      Object.defineProperty(transaction, "oncomplete", { get: () => completeHandler, set: handler => { completeHandler = handler; if (transaction.pending === 0) queueMicrotask(() => completeHandler?.()); } });
      transactions.push(transaction);
      return transaction;
    }
  };
  function request(value, transaction = null) {
    const result = {};
    if (transaction) transaction.pending += 1;
    queueMicrotask(() => {
      result.result = value;
      result.onsuccess?.();
      if (transaction) {
        transaction.pending -= 1;
        if (transaction.pending === 0) transaction.oncomplete?.();
      }
    });
    return result;
  }
  return {
    factory: { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onupgradeneeded?.(); request.onsuccess?.(); }); return request; } },
    records,
    transactions
  };
}

function fixture() {
  return {
    id: "enc_1",
    revision: 7,
    title: "Blackwater Bell",
    brief: { party: { effectiveLevel: 5, size: 4 }, threatTarget: { kind: "severe", customXP: null } },
    participantGroups: [{ id: "cmp_1", contentID: "creature/custom/mire/current", name: "Mire Captain", level: 5, quantity: 1, phaseIDs: ["phase_1"] }],
    hazards: [{ id: "ehaz_1", contentID: "hazard/custom/bell/current", name: "Bell Snare", level: 5 }],
    phases: [{ id: "phase_1", participantIDs: ["cmp_1"], hazardIDs: ["ehaz_1"] }],
    originalCreatures: [{ id: "cre_1", identity: { name: "Mire Captain", level: 5 }, provenance: { origin: "forked" } }],
    customHazards: [{ id: "haz_1", identity: { name: "Bell Snare", level: 5 }, provenance: { origin: "original" } }],
    npcProfiles: [{ id: "npc_1", participantGroupID: "cmp_1", encounterPurpose: "Guard the bell.", immediateGoal: "Buy time.", moraleExit: "Flee when cornered." }],
    budget: { peakActiveXP: 999 },
    readiness: { status: "ready" },
    provenance: { origin: "webmcp" }
  };
}

test("Encounter export is deterministic, embeds components, and excludes derived values", () => {
  const first = createEncounterFile({ encounter: fixture() });
  const second = createEncounterFile({ encounter: fixture() });
  assert.equal(first, second);
  const root = JSON.parse(first);
  assert.equal(root.format, "sidekickdm");
  assert.equal(root.format_version, 1);
  assert.equal(root.data.embedded_components.creatures.length, 1);
  assert.equal(root.data.embedded_components.hazards.length, 1);
  assert.equal(root.data.encounter.budget, undefined);
  assert.equal(root.data.encounter.readiness, undefined);
});

test("import remaps collisions, references, and records provenance", () => {
  const result = importEncounterFile(createEncounterFile({ encounter: fixture() }), {
    existingIDs: ["enc_1", "cmp_1", "cre_1", "npc_1", "phase_1"],
    importedAt: "2026-08-28T12:00:00Z"
  });
  assert.equal(result.remappedIDs.enc_1, "enc_imported");
  assert.equal(result.remappedIDs.cmp_1, "cmp_imported");
  assert.equal(result.draft.id, "enc_imported");
  assert.equal(result.draft.phases[0].participantIDs[0], "cmp_imported");
  assert.equal(result.components.creatures[0].provenance.imported_from_id, "cre_1");
  assert.equal(result.remappedIDs.npc_1, "npc_imported");
  assert.equal(result.draft.npcProfiles[0].id, "npc_imported");
  assert.equal(result.draft.npcProfiles[0].participantGroupID, "cmp_imported");
  assert.equal(result.draft.revision, 0);
});

test("import round-trips remapped NPC Profiles from the authoritative draft", () => {
  const imported = importEncounterFile(createEncounterFile({ encounter: fixture() }), { existingIDs: ["npc_1", "cmp_1"] });
  assert.deepEqual(imported.draft.npcProfiles, imported.components.npcProfiles);
  const roundTrip = JSON.parse(createEncounterFile({ encounter: imported.draft }));
  assert.equal(roundTrip.data.embedded_components.npc_profiles[0].id, "npc_imported");
  assert.equal(roundTrip.data.embedded_components.npc_profiles[0].participant_group_id, "cmp_imported");
});

test("import accepts the placed Hazard and embedded custom Hazard mirror", () => {
  const encounter = fixture();
  encounter.hazards[0].id = encounter.customHazards[0].id;
  encounter.phases[0].hazardIDs = [encounter.customHazards[0].id];
  const imported = importEncounterFile(createEncounterFile({ encounter }), { existingIDs: ["haz_1"] });
  assert.equal(imported.remappedIDs.haz_1, "haz_imported");
  assert.equal(imported.draft.hazards[0].id, "haz_imported");
  assert.equal(imported.draft.customHazards[0].id, "haz_imported");
});

test("import rejects an embedded custom Hazard that duplicates another local kind", () => {
  const root = JSON.parse(createEncounterFile({ encounter: fixture() }));
  root.data.embedded_components.hazards[0].id = "cmp_1";
  assert.throws(() => importEncounterFile(root), (error) => error instanceof EncounterFileError && error.code === "duplicate_id");
});

test("import preserves native dedicated embedded Catalog Entries and remaps their IDs", () => {
  const root = JSON.parse(createEncounterFile({ encounter: fixture() }));
  root.data.embedded_components.embedded_catalog_entries = [{ id: "catalog_1", kind: "hazard", content_id: "hazard/test/bell-snare/current", detail: { effect: "The bell rings." } }];
  const imported = importEncounterFile(root, { existingIDs: ["catalog_1"] });
  assert.equal(imported.remappedIDs.catalog_1, "catalog_imported");
  assert.equal(imported.draft.embeddedCatalogEntries[0].id, "catalog_imported");
  assert.equal(imported.draft.embeddedCatalogEntries[0].contentID, "hazard/test/bell-snare/current");
});

test("Catalog snapshots stay self-contained without becoming Original Creature drafts", () => {
  const encounter = fixture();
  encounter.participantGroups = [{ id: "cmp_catalog", contentID: "creature/monster-core/bog-strider/current", name: "Bog Strider", level: 5, quantity: 1 }];
  encounter.phases = [];
  encounter.originalCreatures = [];
  const catalogSnapshot = { id: "catalog_snapshot_cmp_catalog", contentID: "creature/monster-core/bog-strider/current", kind: "creature", name: "Bog Strider", level: 5, detail: { speeds: { land: 25 } }, provenance: { origin: "existing" } };
  const result = importEncounterFile(createEncounterFile({ encounter, components: { creatures: [catalogSnapshot] } }));
  assert.deepEqual(result.draft.originalCreatures, []);
  assert.equal(result.draft.embeddedCatalogEntries[0].contentID, "creature/monster-core/bog-strider/current");
  assert.equal(result.components.creatures[0].provenance.origin, "imported");
});

test("future major versions are rejected before memory-store writes", () => {
  const root = JSON.parse(createEncounterFile({ encounter: fixture() }));
  root.format_version = 2;
  const store = new MemoryEncounterStore({ encounters: { enc_existing: fixture() } });
  assert.throws(() => store.importEncounter(root), (error) => error instanceof EncounterFileError && error.code === "future_schema_version");
  assert.equal(store.encounters.size, 1);
});

test("known v0 envelope migrates explicitly", () => {
  const root = JSON.parse(createEncounterFile({ encounter: fixture() }));
  delete root.format_version;
  root.version = 0;
  const result = importEncounterFile(root);
  assert.deepEqual(result.migration, { from: 0, to: 1, applied: true });
});

test("selected component export imports as a non-destructive library merge", () => {
  const components = {
    creatures: [{ id: "cre_1", name: "Mire Captain", provenance: { origin: "forked" } }],
    npcProfiles: [{ id: "npc_1", participantGroupID: "cmp_1", encounterPurpose: "Warn the party", immediateGoal: "Get help", moraleExit: "Flee" }],
    hazards: [{ id: "haz_1", name: "Bell Snare" }],
    partyProfiles: [{ id: "party_1", name: "River Wardens" }]
  };
  const file = createComponentsFile({ components, attachments: [{ id: "att_1", filename: "map.webp", mediaType: "image/webp", required: false }] });
  const root = JSON.parse(file);
  assert.equal(root.export_kind, "components");
  assert.deepEqual(Object.keys(root.data.components), ["creatures", "hazards", "npc_profiles", "party_profiles"]);
  const store = new MemoryLibraryStore({ creatures: { cre_existing: { id: "cre_existing" } } });
  const first = store.importComponents(file, { importedAt: "2026-08-28T12:00:00Z" });
  assert.equal(first.components.creatures[0].id, "cre_1");
  assert.equal(first.components.creatures[0].provenance.origin, "imported");
  assert.equal(store.npcProfiles.get("npc_1").participantGroupID, "cmp_1");
  const second = store.importComponents(file, { importedAt: "2026-08-28T12:01:00Z" });
  assert.equal(second.remappedIDs.cre_1, "cre_imported");
  assert.equal(store.creatures.has("cre_imported"), true);
  assert.equal(store.attachments.has("att_1"), true);
});

test("library export is flat and import reports remapped records", () => {
  const file = createLibraryFile({
    library: {
      encounters: [fixture()],
      creatures: [{ id: "library_cre_1", name: "Mire Captain" }],
      npcProfiles: [],
      hazards: [{ id: "library_haz_1", name: "Bell Snare" }],
      partyProfiles: [{ id: "party_1", name: "River Wardens" }]
    }
  });
  const root = JSON.parse(file);
  assert.equal(root.data.object_type, "library");
  assert.ok(Array.isArray(root.data.encounters));
  assert.equal(root.data.components, undefined);
  const result = importLibraryFile(file, { existingIDs: ["enc_1", "library_cre_1"], importedAt: "2026-08-28T12:00:00Z" });
  assert.equal(result.encounters[0].id, "enc_imported");
  assert.equal(result.components.creatures[0].id, "library_imported");
  assert.equal(result.encounters[0].provenance.origin, "imported");
});

test("library import keeps independent Encounter ID namespaces", () => {
  const first = fixture();
  const second = structuredClone(first);
  second.id = "enc_2";
  second.title = "Second Encounter";
  const file = createLibraryFile({ library: { encounters: [first, second] } });

  const result = importLibraryFile(file, { importedAt: "2026-08-28T12:00:00Z" });

  assert.deepEqual(result.encounters.map((encounter) => encounter.id), ["enc_1", "enc_2"]);
  assert.equal(result.encounters[0].participantGroups[0].id, "cmp_1");
  assert.equal(result.encounters[1].participantGroups[0].id, "cmp_1");
});

test("library import accepts an exact reusable Catalog snapshot mirror", () => {
  const encounter = fixture();
  const snapshot = { id: "catalog_1", revision: 18, snapshotKind: "catalog", kind: "creature", contentID: "creature/monster-core/orc-veteran/current", name: "Orc Veteran", level: 1 };
  encounter.embeddedCatalogEntries = [snapshot];
  const file = createLibraryFile({ library: { encounters: [encounter], creatures: [snapshot] } });

  const result = importLibraryFile(file, { importedAt: "2026-08-28T12:00:00Z" });

  assert.equal(result.encounters[0].embeddedCatalogEntries[0].id, "catalog_1");
  assert.equal(result.components.creatures[0].id, "catalog_1");
});

test("library import rejects nested and top-level duplicate IDs atomically", () => {
  const file = createLibraryFile({
    library: {
      encounters: [fixture()],
      creatures: [{ id: "cre_1", name: "Duplicate Mire Captain" }],
      npcProfiles: [],
      hazards: [],
      partyProfiles: []
    }
  });
  const store = new MemoryLibraryStore({ creatures: { existing: { id: "existing" } } });
  assert.throws(() => store.importLibrary(file), (error) => error instanceof EncounterFileError && error.code === "duplicate_id");
  assert.deepEqual([...store.creatures.keys()], ["existing"]);
  assert.equal(store.encounters.size, 0);
});

test("ZIP archive verifies attachment metadata and permits missing optional files", async () => {
  const bytes = new TextEncoder().encode("map bytes");
  const file = await createEncounterArchive({ encounter: fixture(), attachments: [{ id: "att_1", filename: "map.webp", mediaType: "image/webp", bytes }] });
  const result = await importSidekickDMZip(file, { existingIDs: [] });
  assert.deepEqual(result.missingOptionalAttachments, []);
  assert.deepEqual([...result.attachments[0].bytes], [...bytes]);

  const manifest = createEncounterFile({ encounter: fixture(), attachments: [{ id: "att_optional", filename: "missing.webp", mediaType: "image/webp", sha256: "a".repeat(64), required: false }] });
  const optional = await importSidekickDMZip(createSidekickDMZip({ manifest }), { existingIDs: [] });
  assert.deepEqual(optional.missingOptionalAttachments, ["att_optional"]);

  const required = createEncounterFile({ encounter: fixture(), attachments: [{ id: "att_required", filename: "missing.webp", mediaType: "image/webp", sha256: "a".repeat(64), required: true }] });
  await assert.rejects(() => importSidekickDMZip(createSidekickDMZip({ manifest: required })), (error) => error instanceof EncounterFileError && error.code === "missing_attachment");
});

test("ZIP parser rejects trailing bytes, duplicate names, corrupt CRC, and unsupported compression", async () => {
  const manifest = createEncounterFile({ encounter: fixture() });
  const attachment = { id: "att_1", filename: "abcdefghijkl", mediaType: "text/plain", bytes: new TextEncoder().encode("payload") };
  const archive = createSidekickDMZip({ manifest, attachments: [attachment] });
  const trailing = new Uint8Array([...archive, 0xde, 0xad]);
  assert.throws(() => parseSidekickDMZip(trailing), (error) => error instanceof EncounterFileError && error.code === "invalid_archive");

  const duplicate = new Uint8Array(archive);
  const central = signature(duplicate, [0x50, 0x4b, 0x01, 0x02]);
  assert.notEqual(central, -1);
  const firstNameLength = duplicate[central + 28] | (duplicate[central + 29] << 8);
  const secondCentral = signature(duplicate.slice(central + 46 + firstNameLength), [0x50, 0x4b, 0x01, 0x02]) + central + 46 + firstNameLength;
  assert.notEqual(secondCentral, -1);
  assert.equal(duplicate[secondCentral + 28] | (duplicate[secondCentral + 29] << 8), firstNameLength);
  duplicate.set(duplicate.slice(central + 46, central + 46 + firstNameLength), secondCentral + 46);
  assert.throws(() => parseSidekickDMZip(duplicate), (error) => error instanceof EncounterFileError && error.code === "duplicate_entry");

  const corruptCRC = new Uint8Array(archive);
  const local = signature(corruptCRC, [0x50, 0x4b, 0x03, 0x04]);
  const localNameLength = corruptCRC[local + 26] | (corruptCRC[local + 27] << 8);
  const localExtraLength = corruptCRC[local + 28] | (corruptCRC[local + 29] << 8);
  corruptCRC[local + 30 + localNameLength + localExtraLength] ^= 0xff;
  assert.throws(() => parseSidekickDMZip(corruptCRC), (error) => error instanceof EncounterFileError && error.code === "checksum_mismatch");

  const unsupported = new Uint8Array(archive);
  let cursor = 0;
  while (true) {
    const found = signature(unsupported.slice(cursor), [0x50, 0x4b, 0x01, 0x02]);
    if (found === -1) break;
    cursor += found;
    unsupported[cursor + 10] = 99; unsupported[cursor + 11] = 0; cursor += 46;
  }
  assert.throws(() => parseSidekickDMZip(unsupported), (error) => error instanceof EncounterFileError && error.code === "unsupported_archive");
});

test("Encounter archive engine acceptance precedes its single IndexedDB write transaction", async () => {
  const fake = fakeIndexedDB();
  const archive = await createEncounterArchive({ encounter: fixture(), attachments: [{ id: "att_1", filename: "map.txt", mediaType: "text/plain", bytes: new TextEncoder().encode("map") }] });
  const store = new IndexedDBEncounterStore({ indexedDBFactory: fake.factory });
  const rejectingEngine = { execute() { return { ok: false, error: { message: "native rejected draft" } }; } };
  await assert.rejects(() => store.importArchive(archive, { engine: rejectingEngine }), (error) => error instanceof EncounterFileError && error.code === "engine_rejected");
  assert.equal(fake.transactions.filter(transaction => transaction.mode === "readwrite").length, 0);
  assert.equal(fake.records.get("encounters")?.size ?? 0, 0);

  const acceptedEngine = { execute(command) { assert.equal(command.command, "sidekickdm_load_draft"); return { ok: true, snapshot: { encounter: JSON.parse(command.draft_json) } }; } };
  const result = await store.importArchive(archive, { engine: acceptedEngine });
  assert.equal(fake.transactions.filter(transaction => transaction.mode === "readwrite").length, 1);
  assert.equal(fake.records.get("encounters").has(result.draft.id), true);
  assert.equal(fake.records.get("encounters").has("current"), true);
  assert.equal(fake.records.get("attachments").has(result.attachments[0].id), true);
});

test("library archive verifies before the memory library is changed", async () => {
  const bytes = new TextEncoder().encode("library map");
  const archive = await createLibraryArchive({
    library: { creatures: [{ id: "cre_1", name: "Mire Captain" }] },
    attachments: [{ id: "att_1", filename: "library.webp", mediaType: "image/webp", bytes }]
  });
  const store = new MemoryLibraryStore();
  const result = await store.importArchive(archive, { importedAt: "2026-08-28T12:00:00Z" });
  assert.equal(result.components.creatures[0].id, "cre_1");
  assert.equal(store.creatures.has("cre_1"), true);
  assert.equal(store.attachments.get("att_1").bytes.length, bytes.length);
});

test("component attachments validate paths, remap collisions, and preserve references", () => {
  const file = createComponentsFile({
    components: { creatures: [{ id: "cre_1", attachmentID: "att_1" }] },
    attachments: [{ id: "att_1", filename: "map.webp", mediaType: "image/webp", sha256: "a".repeat(64), required: false }]
  });
  const result = importComponentsFile(file, { existingIDs: ["att_1"] });
  assert.equal(result.remappedIDs.att_1, "att_imported");
  assert.equal(result.components.creatures[0].attachmentID, "att_imported");
  assert.equal(result.attachments[0].id, "att_imported");
  const unsafe = JSON.parse(file);
  unsafe.data.attachments[0].filename = "../map.webp";
  assert.throws(() => importComponentsFile(unsafe), (error) => error instanceof EncounterFileError && error.code === "invalid_payload");
});
