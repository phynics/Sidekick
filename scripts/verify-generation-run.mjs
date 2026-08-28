import assert from "node:assert/strict";
import { GenerationRunController } from "../src/generation-run.js";
import { createWebMCPAdapter } from "../src/webmcp-adapter.js";

const packet = {
  objectVersion: 1,
  identity: { title: "The Bell", premise: "Cultists ring a drowned bell.", objective: "Stop the ritual.", stakes: "The shrine floods." },
  setup: { trigger: "The bell sounds.", battlefieldDescription: "A flooded shrine.", startingPositions: "The party stands at the east arch.", awarenessState: "The cultists are alert.", immediateFeatures: ["Deep water"] },
  battlefield: {},
  runningGuidance: { participantRoles: "Skirmishers screen the leader.", openingTactics: "Circle isolated targets.", ongoingTactics: "Fall back through the water.", coordinationConflict: "The leader protects the bell.", triggersReinforcements: "Reinforce when the bell cracks.", moraleSummary: "Flee when the leader falls.", adjudicationIssues: [] },
  cohesion: { participantPresence: "The cult guards the shrine.", relationships: "The leader commands the skirmishers.", hazardTerrainFit: "The flooded floor protects the cult.", theme: "Drowned devotion." },
  information: { immediatelyApparent: ["The bell is cracked."], discoverable: ["The ritual route"], gmSecret: ["The bell hides a seal."] },
  outcomes: { victory: "The ritual stops.", partialSuccess: null, failure: "The shrine floods.", partyRetreat: null, enemySurrender: null, enemyEscape: null, longTermConsequence: null },
  rewardGuidance: null,
  alternativeResolutions: []
};

const controller = new GenerationRunController({
  briefRevision: 3,
  draft: {
    id: "enc_acceptance",
    revision: 0,
    constraintsRevision: 4,
    title: "Opening encounter",
    packetV1: packet,
    packet: {},
    participantGroups: [],
    hazards: [],
    phases: [],
    reviewState: "needed",
    provenance: { origin: "gm", lastMutationOrigin: "gm" }
  }
});

function bridge(command) {
  try {
    let result;
    switch (command.command) {
      case "sidekickdm_begin_generation":
        result = controller.begin(command);
        break;
      case "sidekickdm_set_encounter_identity":
        result = controller.setPacketSection({ ...command, section: "identity" });
        break;
      case "sidekickdm_finish_generation":
        result = controller.finish(command);
        break;
      case "sidekickdm_undo":
        result = controller.undo({ expectedEncounterRevision: command.expected_encounter_revision, origin: command.origin });
        break;
      default:
        throw Object.assign(new Error(`Unsupported acceptance command ${command.command}.`), { code: "unknown_command" });
    }
    return { ok: true, ...(result ?? {}), snapshot: controller.snapshot() };
  } catch (error) {
    return { ok: false, snapshot: controller.snapshot(), error: { code: error.code ?? "application_error", message: error.message } };
  }
}

const adapter = createWebMCPAdapter({ getSnapshot: () => controller.snapshot(), execute: bridge });
const begin = await adapter.execute("sidekickdm_begin_generation", {
  encounter_id: "enc_acceptance",
  expected_encounter_revision: 0,
  expected_brief_revision: 3,
  expected_constraints_revision: 4,
  content_boundaries_acknowledged: true,
  intent_summary: "Verify a complete Generation Run.",
  generation_run_id: "run_acceptance"
});
assert.equal(begin.ok, true, JSON.stringify(begin));
assert.equal(begin.generation_run_id, "run_acceptance");

const authored = await adapter.execute("sidekickdm_set_encounter_identity", {
  encounter_id: "enc_acceptance",
  generation_run_id: "run_acceptance",
  expected_encounter_revision: 1,
  expected_constraints_revision: 4,
  value: packet.identity
});
assert.equal(authored.ok, true, JSON.stringify(authored));

const finished = await adapter.execute("sidekickdm_finish_generation", {
  encounter_id: "enc_acceptance",
  generation_run_id: "run_acceptance",
  expected_encounter_revision: 2,
  expected_constraints_revision: 4,
  completion_note: "Acceptance run finished."
});
assert.equal(finished.ok, true, JSON.stringify(finished));
assert.equal(finished.generation_run_id, undefined);
assert.equal(controller.generationRunID, null);

const finishedTitle = controller.draft.title;
controller.applyTargetedRevision({
  encounter_id: "enc_acceptance",
  expected_encounter_revision: 3,
  origin: "webmcp",
  description: "Acceptance targeted title revision",
  operation: draft => { draft.title = "The Bell · Targeted Revision"; }
});
assert.equal(controller.draft.title, "The Bell · Targeted Revision");

const undoneTarget = await adapter.execute("sidekickdm_undo", { encounter_id: "enc_acceptance", expected_encounter_revision: 4 });
assert.equal(undoneTarget.ok, true, JSON.stringify(undoneTarget));
assert.equal(undoneTarget.data.encounter.title, finishedTitle);
const undoneRun = await adapter.execute("sidekickdm_undo", { encounter_id: "enc_acceptance", expected_encounter_revision: 5 });
assert.equal(undoneRun.ok, true, JSON.stringify(undoneRun));
assert.equal(undoneRun.data.encounter.title, "Opening encounter");
assert.equal(controller.draft.revision, 6);

console.log("WebMCP Generation Run verification passed: begin, packet mutation, finish, targeted revision, targeted undo, and whole-run rollback.");
