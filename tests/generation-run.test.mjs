import test from "node:test";
import assert from "node:assert/strict";
import { GenerationRunController, GenerationRunError, GENERATION_RUN_STATES } from "../src/generation-run.js";

function controller() {
  return new GenerationRunController({
    briefRevision: 3,
    draft: {
      id: "enc_run",
      revision: 0,
      constraintsRevision: 4,
      title: "Opening encounter",
      packetV1: {
        objectVersion: 1,
        identity: { title: "", premise: "", objective: "", stakes: "" },
        setup: { trigger: "", battlefieldDescription: "", startingPositions: "", awarenessState: "", immediateFeatures: [] },
        battlefield: {},
        runningGuidance: {},
        cohesion: {},
        information: {},
        outcomes: {},
        rewardGuidance: null,
        alternativeResolutions: []
      },
      packet: {},
      participantGroups: [],
      hazards: [],
      phases: [],
      reviewState: "needed",
      provenance: { origin: "gm", lastMutationOrigin: "gm" }
    }
  });
}

function begin(store) {
  return store.begin({
    encounter_id: "enc_run",
    expected_encounter_revision: 0,
    expected_brief_revision: 3,
    expected_constraints_revision: 4,
    content_boundaries_acknowledged: true,
    intent_summary: "Build a swamp ambush.",
    generation_run_id: "run_test"
  });
}

function completePacket() {
  return {
    objectVersion: 1,
    identity: { title: "The Bell", premise: "Cultists ring a drowned bell.", objective: "Stop the ritual.", stakes: "The shrine floods." },
    setup: { trigger: "The bell sounds.", battlefieldDescription: "A flooded shrine.", startingPositions: "The party stands at the east arch.", awarenessState: "The cultists are alert.", immediateFeatures: ["Deep water"], readAloud: null },
    battlefield: {},
    runningGuidance: { participantRoles: "Skirmishers screen the leader.", openingTactics: "Circle isolated targets.", ongoingTactics: "Fall back through the water.", coordinationConflict: "The leader protects the bell.", triggersReinforcements: "Reinforce when the bell cracks.", moraleSummary: "Flee when the leader falls.", adjudicationIssues: [] },
    cohesion: { participantPresence: "The cult guards the shrine.", relationships: "The leader commands the skirmishers.", hazardTerrainFit: "The flooded floor protects the cult.", theme: "Drowned devotion." },
    information: { immediatelyApparent: ["The bell is cracked."], discoverable: ["The ritual route"], gmSecret: ["The bell hides a seal."] },
    outcomes: { victory: "The ritual stops.", partialSuccess: null, failure: "The shrine floods.", partyRetreat: null, enemySurrender: null, enemyEscape: null, longTermConsequence: null },
    rewardGuidance: null,
    alternativeResolutions: []
  };
}

test("begin requires encounter, brief, constraints, and boundary acknowledgement", () => {
  const store = controller();
  assert.throws(() => store.begin({ ...beginInput(), expected_encounter_revision: 1 }), (error) => error instanceof GenerationRunError && error.code === "stale_revision");
  assert.throws(() => store.begin({ ...beginInput(), expected_brief_revision: 2 }), (error) => error instanceof GenerationRunError && error.code === "stale_brief_revision");
  assert.throws(() => store.begin({ ...beginInput(), content_boundaries_acknowledged: false }), (error) => error instanceof GenerationRunError && error.code === "content_constraint_not_acknowledged");
  const result = begin(store);
  assert.equal(result.generation_run_id, "run_test");
  assert.equal(store.encounterRevision, 1);
  assert.equal(store.generationState, GENERATION_RUN_STATES.ACTIVE);
  assert.equal(store.manualWritesLocked, true);
});

function beginInput() {
  return { encounter_id: "enc_run", expected_encounter_revision: 0, expected_brief_revision: 3, expected_constraints_revision: 4, content_boundaries_acknowledged: true, generation_run_id: "run_test" };
}

test("mutations are live, revisioned, provenanced, and lock manual writes", () => {
  const store = controller();
  begin(store);
  assert.throws(() => store.mutate({ encounterID: "enc_run", generationRunID: "run_test", expectedEncounterRevision: 1, expectedConstraintsRevision: 4, origin: "gm", operation: (draft) => { draft.title = "blocked"; } }), (error) => error.code === "manual_write_locked");
  const added = store.addExistingParticipantGroup({
    encounter_id: "enc_run", generation_run_id: "run_test", expected_encounter_revision: 1, expected_constraints_revision: 4,
    content_id: "creature/test/bog/current", name: "Bog Strider", level: 5, quantity: 2,
    catalog_entry: { kind: "creature", completeness: "complete", support: "supported" }
  });
  assert.equal(store.draft.participantGroups[0].id, added.id);
  assert.equal(store.encounterRevision, 2);
  assert.equal(store.draft.provenance.lastMutationOrigin, "webmcp");
  assert.equal(store.activity[0].origin, "webmcp");
});

test("semantic Existing Participant and Packet section tools reject partial content", () => {
  const store = controller();
  begin(store);
  assert.throws(() => store.addExistingParticipantGroup({ ...beginInput(), catalog_entry: { kind: "creature", completeness: "partial", support: "supported" }, content_id: "creature/test/partial/current", name: "Partial" }), (error) => error.code === "catalog_entry_partial");
  const result = store.setPacketSection({ ...beginInput(), expected_encounter_revision: 1, section: "identity", value: { title: "Generated Encounter", premise: "A flooded ruin.", objective: "Break the seal.", stakes: "The valley floods." } });
  assert.equal(result.draft.packetV1.identity.title, "Generated Encounter");
  assert.equal(store.draft.title, "Generated Encounter");
});

test("finish preserves warnings and collapses the whole run into one Undo entry", () => {
  const store = controller();
  begin(store);
  store.mutate({ ...beginInput(), expected_encounter_revision: 1, description: "Authored packet", operation: (draft) => { draft.packetV1 = completePacket(); } });
  const finished = store.finish({ ...beginInput(), expected_encounter_revision: 2 });
  assert.equal(finished.revision, 3);
  assert.equal(store.generationRunID, null);
  assert.equal(store.draft.reviewState, "needed");
  assert.equal(store.canUndo, true);
  store.undo({ expectedEncounterRevision: 3 });
  assert.deepEqual(store.draft.participantGroups, []);
  assert.equal(store.draft.revision, 4);
  assert.equal(store.canUndo, false);
});

test("cancel restores opening content, and reload marks an active run interrupted", () => {
  const store = controller();
  const openingTitle = store.draft.title;
  begin(store);
  store.addExistingParticipantGroup({ ...beginInput(), expected_encounter_revision: 1, content_id: "creature/test/bog/current", name: "Bog Strider", level: 5 });
  const reloaded = new GenerationRunController();
  reloaded.reload(store.autosave());
  assert.equal(reloaded.generationState, GENERATION_RUN_STATES.INTERRUPTED);
  assert.equal(reloaded.manualWritesLocked, true);
  assert.throws(() => reloaded.finish({ ...beginInput(), expected_encounter_revision: 2 }), (error) => error.code === "generation_interrupted");
  reloaded.cancel({ ...beginInput(), expected_encounter_revision: 2 });
  assert.equal(reloaded.draft.title, openingTitle);
  assert.deepEqual(reloaded.draft.participantGroups, []);
  assert.equal(reloaded.draft.generation, null);
  assert.equal(reloaded.encounterRevision, 3);
});
