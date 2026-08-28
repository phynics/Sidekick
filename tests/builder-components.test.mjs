import test from "node:test";
import assert from "node:assert/strict";
import {
  createEmptyOriginalCreature,
  validateOriginalCreature
} from "../src/creature-builder.js";
import {
  createEmptySimpleHazard,
  createSimpleHazard,
  HAZARD_PARTICIPATION_MODES,
  HazardCompositionStore,
  validateSimpleHazard
} from "../src/hazard-builder.js";

function completeCreature() {
  const creature = createEmptyOriginalCreature();
  creature.identity = {
    ...creature.identity,
    name: "Bell Warden",
    concept: "A drowned shrine guardian.",
    roadmap: "controller",
    traits: ["humanoid", "occult"]
  };
  creature.languages = ["Common"];
  creature.speeds = { land: 25, swim: 20 };
  creature.perception = { band: "high", value: 13 };
  creature.defenses = {
    ac: { band: "moderate", value: 20 },
    fortitude: { band: "low", value: 5 },
    reflex: { band: "moderate", value: 7 },
    will: { band: "high", value: 8 },
    hp: { band: "low", value: 11 },
    immunities: ["sleep"],
    weaknesses: ["fire 5"],
    resistances: ["physical 3"]
  };
  creature.strikes = [{ id: "strike_1", name: "Bell hook", actionCost: 1, attack: { band: "high", value: 8 }, damage: [{ expression: "1d8+2", type: "bludgeoning" }] }];
  creature.abilities = [{ id: "ability_1", name: "Dissonant toll", kind: "reaction", actionCost: null, conditions: ["frightened"], frequency: "once per round", effectText: "The bell tolls." }];
  creature.spellcastingStatus = "preserved_existing";
  creature.spellcastingBlocks = ["Occult innate spells", "Cantrip: daze"];
  creature.tactics = "Control the approach.";
  creature.morale = "Flee when the bell is silenced.";
  return creature;
}

test("Original Creature validation accepts defense, ability, and spellcasting fields", () => {
  const creature = completeCreature();
  const result = validateOriginalCreature(creature);
  assert.equal(result.structuralErrors.length, 0);
  assert.equal(creature.defenses.immunities[0], "sleep");
  assert.deepEqual(creature.spellcastingBlocks, ["Occult innate spells", "Cantrip: daze"]);
});

test("Original Creature readiness keeps structural errors separate from design warnings", () => {
  const creature = completeCreature();
  creature.identity.name = "";
  creature.defenses.ac.value = 30;
  const result = validateOriginalCreature(creature);
  assert.ok(result.structuralErrors.some((item) => item.field === "identity.name"));
  assert.ok(result.holisticWarnings.some((item) => item.code === "benchmark_deviation"));
  assert.equal(result.status, "incomplete");
});

function completeHazard() {
  const hazard = createEmptySimpleHazard({ id: "haz_builder" });
  hazard.identity = { ...hazard.identity, name: "Mire Bell Snare", traits: ["mechanical"] };
  hazard.description = "A chain catches trespassers.";
  hazard.detection = { kind: "stealth_dc", band: "high", value: 18 };
  hazard.disableMethods = [{ skill: "Thievery", dc: 17 }];
  hazard.trigger = "A creature crosses the chain.";
  hazard.effect = { resolution: null, damage: [], conditions: ["prone"], text: "The chain knocks the creature prone." };
  hazard.reset = "Reset the chain in ten minutes.";
  return hazard;
}

test("Simple Hazard supports every participation category and composition edit/remove", () => {
  assert.deepEqual(HAZARD_PARTICIPATION_MODES, ["mandatory", "avoidable", "conditional", "reinforcement"]);
  const hazard = completeHazard();
  assert.equal(validateSimpleHazard(hazard).structuralErrors.length, 0);
  const draft = { revision: 0, brief: { party: { effectiveLevel: 1, size: 4 }, threatTarget: { kind: "moderate" } }, hazards: [] };
  const store = new HazardCompositionStore(draft, []);
  store.add(hazard, { participation: "conditional", placement: "West arch" });
  assert.equal(store.draft.hazards[0].participation.mode, "conditional");
  const edited = completeHazard();
  edited.identity.name = "Mire Bell Snare Revised";
  store.update(edited, { participation: "reinforcement", placement: "North arch", expectedRevision: 1 });
  assert.equal(store.draft.hazards[0].name, "Mire Bell Snare Revised");
  assert.equal(store.draft.hazards[0].participation.mode, "reinforcement");
  store.remove("haz_builder", 2);
  assert.equal(store.draft.hazards.length, 0);
  assert.equal(store.hazards.length, 0);
});

test("Simple Hazard structural errors and warnings remain distinct", () => {
  const hazard = completeHazard();
  hazard.identity.name = "";
  hazard.detection.value = 40;
  const result = validateSimpleHazard(hazard);
  assert.ok(result.structuralErrors.some((item) => item.field === "identity.name"));
  assert.ok(result.holisticWarnings.some((item) => item.code === "benchmark_deviation"));
});

test("Simple Hazard creation returns a detached snapshot", () => {
  const hazard = completeHazard();
  const created = createSimpleHazard(hazard);
  created.identity.name = "Changed after create";
  assert.equal(hazard.identity.name, "Mire Bell Snare");
});
