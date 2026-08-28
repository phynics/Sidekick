import test from "node:test";
import assert from "node:assert/strict";
import { generationCancellationCommand, generationProgress, runSessionMatchesEncounter, summarizeAgentCommand } from "../src/agent-experience.js";

test("run sessions only match the exact encounter revision", () => {
  assert.equal(runSessionMatchesEncounter({ encounterID: "enc", encounterRevision: 4 }, { id: "enc", revision: 4 }), true);
  assert.equal(runSessionMatchesEncounter({ encounterID: "enc", encounterRevision: 3 }, { id: "enc", revision: 4 }), false);
});

test("generation progress uses human-facing authoring milestones", () => {
  const result = generationProgress({ brief: { creative: { premise: "A mugging" } }, participantGroups: [{}], packetV1: { setup: { readAloud: "Stop there" }, runningGuidance: { openingTactics: "Surround them" }, outcomes: { victory: "The gang flees" } } }, { status: "ready" });
  assert.equal(result.percent, 100);
  assert.equal(result.current, "Ready to review");
  assert.equal(result.outcomesReady, true);
});

test("agent activity describes table changes rather than revisions", () => {
  assert.deepEqual(summarizeAgentCommand({ command: "sidekickdm_add_existing_participant_group", quantity: 4 }, { title: "Street Trouble" }, { name: "Coins District Knives", quantity: 4 }, { peakActiveXP: 80, constructionBudget: 80 }), { description: "Added 4 × Coins District Knives", detail: "80 of 80 XP" });
});

test("published packet tool names receive specific activity summaries", () => {
  assert.equal(summarizeAgentCommand({ command: "sidekickdm_update_creative_brief" }).description, "Refined the premise, place, and tone");
  assert.equal(summarizeAgentCommand({ command: "sidekickdm_set_encounter_identity" }).description, "Wrote the objective and stakes");
  assert.equal(summarizeAgentCommand({ command: "sidekickdm_set_battlefield_guidance" }).description, "Added battlefield features");
  assert.equal(summarizeAgentCommand({ command: "sidekickdm_set_information_visibility" }).description, "Added clues and DM information");
});

test("the shelf stop action crosses the generation boundary as an agent cancellation", () => {
  assert.deepEqual(generationCancellationCommand({ revision: 12 }, { id: "run_1" }), { command: "sidekickdm_cancel_generation", generation_run_id: "run_1", expected_revision: 12, origin: "agent" });
});
