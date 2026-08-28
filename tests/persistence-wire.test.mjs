import test from "node:test";
import assert from "node:assert/strict";
import { createCreatureBuilder, createEmptyOriginalCreature } from "../src/creature-builder.js";
import { createHazardBuilder, createEmptySimpleHazard, HazardCompositionStore } from "../src/hazard-builder.js";
import { createNPCProfileEditor, createEmptyNPCProfile } from "../src/npc-profile.js";
import { createEncounterPacketEditor, createEmptyPacket } from "../src/encounter-packet.js";
import { createEncounterPhaseEditor, createEmptyPhase, PhaseAuthoringStore } from "../src/encounter-phases.js";
import { GenerationRunController } from "../src/generation-run.js";
import { createEncounterFile, importEncounterFile } from "../src/encounter-file.js";

function fakeRoot() {
  return {
    set innerHTML(value) { this.html = value; },
    querySelectorAll() { return []; },
    querySelector() { return { addEventListener() {} }; },
    replaceChildren() {}
  };
}

test("portable encounter import preserves acronym-bearing fields", () => {
  const wire = createEncounterFile({ encounter: {
    id: "enc_acronyms",
    title: "Acronyms",
    brief: { party: { effectiveLevel: 1, size: 4 }, threatTarget: { kind: "custom", customXP: 75 } },
    participantGroups: [],
    hazards: [],
    phases: [],
    generation: { id: "run_acronyms", state: "active", openingDraftJSON: "{}" }
  } });
  const imported = importEncounterFile(wire).draft;
  assert.equal(imported.brief.threatTarget.customXP, 75);
  assert.equal(imported.generation.openingDraftJSON, "{}");
});

test("Generation Run autosave uses the Swift envelope keys and reads the old spelling", () => {
  const controller = new GenerationRunController({ draft: { id: "enc_wire", revision: 0 }, briefRevision: 4 });
  const saved = controller.autosave();
  assert.equal(saved.formatVersion, 1);
  assert.equal(saved.briefRevision, 4);
  assert.equal(saved.format_version, undefined);
  const restored = new GenerationRunController();
  restored.reload({ format: saved.format, format_version: 1, draft: saved.draft, brief_revision: 4 });
  assert.equal(restored.briefRevision, 4);
});

test("component autosaves carry full native history shapes", () => {
  const creature = createCreatureBuilder({ root: fakeRoot(), creature: createEmptyOriginalCreature() });
  creature.setCreature({ ...creature.creature, id: "cre_wire" });
  const creatureState = creature.autosave();
  assert.equal(creatureState.formatVersion, 1);
  assert.equal(creatureState.history.length, 1);
  assert.ok(Array.isArray(creatureState.redoHistory));

  const hazard = createHazardBuilder({ root: fakeRoot(), hazard: createEmptySimpleHazard() });
  hazard.setHazard({ ...hazard.hazard, id: "haz_wire" });
  const hazardState = hazard.autosave();
  assert.equal(hazardState.formatVersion, 1);
  assert.equal(hazardState.history.length, 1);
  assert.ok(Array.isArray(hazardState.redoHistory));

  const npc = createNPCProfileEditor({ root: fakeRoot(), profile: createEmptyNPCProfile() });
  npc.setProfile({ ...npc.profile, id: "npc_wire" });
  const npcState = npc.autosave();
  assert.equal(npcState.profile.object_version, 1);
  assert.equal(npcState.profile.objectVersion, undefined);
  assert.equal(npcState.history.length, 1);
  assert.equal(npcState.snapshot.profile.object_version, 1);
});

test("phase and packet autosaves carry the full native document and nested metadata", () => {
  const phase = createEncounterPhaseEditor({ root: fakeRoot(), phase: { ...createEmptyPhase(), title: "Opening", trigger: { kind: "custom", explanation: "When the bell rings.", value: null, canOverlap: true } } });
  const phaseState = phase.autosave();
  assert.equal(phaseState.formatVersion, 1);
  assert.equal(phaseState.document.objectVersion, 1);
  assert.equal(phaseState.document.phases.length, 1);
  assert.equal(phaseState.document.phases[0].title, "Opening");
  assert.equal(phaseState.lastMutationOrigin, "gm");

  const packet = createEncounterPacketEditor({ root: fakeRoot(), packet: createEmptyPacket() });
  const packetState = packet.autosave();
  assert.equal(packetState.formatVersion, 1);
  assert.equal(packetState.metadata.revision, 0);
  assert.equal(packetState.metadata.constraintsRevision, 0);
  assert.equal(packetState.metadata.reviewState, "needed");
  assert.equal(packetState.revision, undefined);

  const phaseStore = new PhaseAuthoringStore({ id: "enc_phase_wire" });
  const restored = new PhaseAuthoringStore();
  restored.restore(phaseStore.encodedState());
  assert.equal(restored.document.encounterID, "enc_phase_wire");
});

test("hazard composition persistence tags snapshots for the native enum and restores old raw snapshots", () => {
  const snapshot = { id: "haz_wire", identity: { name: "Wire", level: 1, complexity: "simple" } };
  const store = new HazardCompositionStore({ id: "enc_hazard_wire", revision: 0, hazards: [] }, [snapshot]);
  const wire = JSON.parse(store.encodedState());
  assert.deepEqual(wire.hazards[0], { kind: "simple", simple: snapshot });
  const restored = new HazardCompositionStore();
  restored.restore(wire);
  assert.deepEqual(restored.hazards[0], snapshot);
});
