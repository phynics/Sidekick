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
  createEncounterArchive,
  createLibraryArchive,
  importSidekickDMZip
} from "../src/encounter-file.js";

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
    existingIDs: ["enc_1", "cmp_1", "cre_1", "phase_1"],
    importedAt: "2026-08-28T12:00:00Z"
  });
  assert.equal(result.remappedIDs.enc_1, "enc_imported");
  assert.equal(result.remappedIDs.cmp_1, "cmp_imported");
  assert.equal(result.draft.id, "enc_imported");
  assert.equal(result.draft.phases[0].participantIDs[0], "cmp_imported");
  assert.equal(result.components.creatures[0].provenance.imported_from_id, "cre_1");
  assert.equal(result.draft.revision, 0);
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
      creatures: [{ id: "cre_1", name: "Mire Captain" }],
      npcProfiles: [],
      hazards: [{ id: "haz_1", name: "Bell Snare" }],
      partyProfiles: [{ id: "party_1", name: "River Wardens" }]
    }
  });
  const root = JSON.parse(file);
  assert.equal(root.data.object_type, "library");
  assert.ok(Array.isArray(root.data.encounters));
  assert.equal(root.data.components, undefined);
  const result = importLibraryFile(file, { existingIDs: ["enc_1", "cre_1"], importedAt: "2026-08-28T12:00:00Z" });
  assert.equal(result.encounters[0].id, "enc_imported");
  assert.equal(result.components.creatures[0].id, "cre_imported");
  assert.equal(result.encounters[0].provenance.origin, "imported");
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
