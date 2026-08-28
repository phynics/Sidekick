import test from "node:test";
import assert from "node:assert/strict";
import { createEncounterFile, importEncounterFile, MemoryEncounterStore, EncounterFileError } from "../src/encounter-file.js";

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
  assert.doesNotThrow(() => importEncounterFile(root));
});
