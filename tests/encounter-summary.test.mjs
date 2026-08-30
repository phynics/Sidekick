import assert from "node:assert/strict";
import test from "node:test";

import {
  encounterEnemyLabel,
  encounterHazardLabel,
  formatEncounterLevels,
  projectEncounterParticipantSummary
} from "../src/encounter-summary.js";

test("projects enemy, hazard, and combined XP from one encounter shape", () => {
  const record = {
    brief: { party: { effectiveLevel: 11 } },
    participantGroups: [
      { id: "drake", name: "Flame Drake", faction: "primary_opposition", level: 11, quantity: 1 },
      { id: "cultists", display_name: "Dragonblood Cultists", faction: "secondary_opposition", level: 11, quantity: 1 }
    ],
    hazards: [
      { name: "Fraying water", level: 11, complexity: "simple" },
      { name: "Wrong-way current", level: 12, complexity: "simple" },
      { name: "Unstable boundary", level: 9, complexity: "complex" }
    ]
  };

  const summary = projectEncounterParticipantSummary(record, new Map());

  assert.equal(summary.enemyCount, 2);
  assert.equal(summary.creatureXP, 80);
  assert.equal(summary.hazardCount, 3);
  assert.equal(summary.hazardXP, 40);
  assert.equal(summary.totalXP, 120);
  assert.deepEqual(summary.hazardDetails.map(detail => [detail.name, detail.level, detail.complexity, detail.xp]), [
    ["Fraying water", 11, "simple", 8],
    ["Wrong-way current", 12, "simple", 12],
    ["Unstable boundary", 9, "complex", 20]
  ]);
  assert.deepEqual(summary.allLevels, [9, 11, 12]);
});

test("centralizes singular and plural encounter labels", () => {
  assert.equal(encounterEnemyLabel(1), "enemy");
  assert.equal(encounterEnemyLabel(2), "enemies");
  assert.equal(encounterHazardLabel(1), "hazard");
  assert.equal(encounterHazardLabel(3), "hazards");
  assert.equal(formatEncounterLevels([13, 11, 12]), "11–13");
  assert.equal(formatEncounterLevels([]), "?");
});
