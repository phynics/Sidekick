import test from "node:test";
import assert from "node:assert/strict";

import { applyRunAction, createRunSession, rollDice } from "../src/run-session.js";

const creature = {
  id: "cre_stalker",
  identity: { name: "Blightbark Stalker", level: 6 },
  defenses: { hp: { value: 75 }, ac: { value: 23 }, fortitude: { value: 14 }, reflex: { value: 17 }, will: { value: 11 } },
  perception: { value: 24 },
  strikes: [{ id: "strike_tendril", name: "Hooked Tendril", attack: { value: 17 }, damage: [{ expression: "2d8+8", type: "piercing" }] }],
  abilities: [{ id: "ability_step", name: "Mulchstep", effectText: "Step twice through fungal terrain." }]
};

const encounter = {
  id: "enc_forest",
  revision: 12,
  title: "Rotheart Infestation",
  brief: { party: { effectiveLevel: 7, size: 2 } },
  participantGroups: [{
    id: "group_stalkers",
    contentID: "creature/custom/cre_stalker/current",
    name: "Blightbark Stalker",
    level: 6,
    quantity: 2,
    adjustment: "normal"
  }],
  originalCreatures: [creature]
};

test("creates individual live combatants from party members and encounter groups", () => {
  const session = createRunSession({ encounter, now: "2026-08-28T10:00:00.000Z" });

  assert.equal(session.encounterID, "enc_forest");
  assert.equal(session.encounterRevision, 12);
  assert.equal(session.round, 1);
  assert.deepEqual(session.combatants.map(item => item.id), ["hero_1", "hero_2", "group_stalkers_1", "group_stalkers_2"]);
  assert.deepEqual(session.combatants.slice(2).map(item => [item.name, item.currentHP, item.maxHP]), [
    ["Blightbark Stalker A", 75, 75],
    ["Blightbark Stalker B", 75, 75]
  ]);
  assert.equal(session.selectedCombatantID, "group_stalkers_1");
});

test("tracks initiative, turn order, rounds, HP, and conditions without changing the encounter", () => {
  const original = structuredClone(encounter);
  let session = createRunSession({ encounter, now: "2026-08-28T10:00:00.000Z" });
  session = applyRunAction(session, { type: "set_initiative", combatantID: "hero_1", value: 21 });
  session = applyRunAction(session, { type: "set_initiative", combatantID: "group_stalkers_1", value: 24 });
  session = applyRunAction(session, { type: "set_initiative", combatantID: "group_stalkers_2", value: 16 });
  session = applyRunAction(session, { type: "next_turn" });
  assert.equal(session.selectedCombatantID, "group_stalkers_1");
  session = applyRunAction(session, { type: "next_turn" });
  assert.equal(session.selectedCombatantID, "hero_1");

  session = applyRunAction(session, { type: "apply_damage", combatantID: "group_stalkers_1", amount: 18 });
  session = applyRunAction(session, { type: "add_condition", combatantID: "group_stalkers_1", name: "sickened", value: 2 });
  session = applyRunAction(session, { type: "add_condition", combatantID: "group_stalkers_1", name: "sickened", value: 1 });
  let stalker = session.combatants.find(item => item.id === "group_stalkers_1");
  assert.equal(stalker.currentHP, 57);
  assert.deepEqual(stalker.conditions, [{ name: "sickened", value: 1 }]);

  session = applyRunAction(session, { type: "apply_healing", combatantID: "group_stalkers_1", amount: 100 });
  session = applyRunAction(session, { type: "remove_condition", combatantID: "group_stalkers_1", name: "sickened" });
  stalker = session.combatants.find(item => item.id === "group_stalkers_1");
  assert.equal(stalker.currentHP, 75);
  assert.deepEqual(stalker.conditions, []);
  assert.deepEqual(encounter, original);
  assert.ok(session.log.some(entry => entry.kind === "damage" && entry.amount === 18));
});

test("rolls dice deterministically and records attack and damage results", () => {
  assert.deepEqual(rollDice("2d8+8", () => 0), { expression: "2d8+8", rolls: [1, 1], modifier: 8, total: 10 });
  assert.throws(() => rollDice("fireball"), /dice expression/i);

  let session = createRunSession({ encounter, now: "2026-08-28T10:00:00.000Z" });
  session = applyRunAction(session, { type: "roll", combatantID: "group_stalkers_1", label: "Hooked Tendril attack", expression: "1d20+17" }, { random: () => 0.5 });
  const entry = session.log.at(-1);
  assert.equal(entry.kind, "roll");
  assert.equal(entry.total, 28);
  assert.equal(entry.targetID, "group_stalkers_1");
  assert.equal(session.lastTargetID, "group_stalkers_1");
});
