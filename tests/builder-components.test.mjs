import test from "node:test";
import assert from "node:assert/strict";
import {
  applyCreatureRole,
  benchmarkFor,
  classifyBenchmark,
  createEmptyOriginalCreature,
  damageBenchmarkFor,
  setStatisticBand,
  setStatisticValue,
  validateOriginalCreature
} from "../src/creature-builder.js";
import { commitCustomCreature } from "../src/creature-generation.js";
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

test("Creature save benchmarks stay aligned with the native engine", () => {
  assert.deepEqual(benchmarkFor(6).saves, {
    terrible: { minimum: 9, maximum: 9 },
    low: { minimum: 11, maximum: 11 },
    moderate: { minimum: 14, maximum: 14 },
    high: { minimum: 17, maximum: 17 },
    extreme: { minimum: 18, maximum: 18 }
  });
  assert.deepEqual(benchmarkFor(8).saves, {
    terrible: { minimum: 11, maximum: 11 },
    low: { minimum: 13, maximum: 13 },
    moderate: { minimum: 16, maximum: 16 },
    high: { minimum: 19, maximum: 19 },
    extreme: { minimum: 20, maximum: 20 }
  });
});

test("Creature stat bands and values synchronize in both directions", () => {
  const benchmark = benchmarkFor(6);
  assert.deepEqual(setStatisticBand({ band: "low", value: 9 }, "moderate", benchmark.saves), { band: "moderate", value: 14 });
  assert.deepEqual(setStatisticValue({ band: "moderate", value: 14 }, 19, benchmark.saves), { band: "extreme", value: 19 });
  assert.deepEqual(classifyBenchmark(16, benchmark.saves), {
    band: "high",
    expected: { minimum: 17, maximum: 17 },
    offset: -1,
    relation: "below",
    guidance: "High · 1 below 17"
  });
});

test("Creature roles apply benchmark bands to statistics, attacks, and damage", () => {
  const creature = completeCreature();
  creature.identity.level = 6;
  creature.strikes[0].damage[0].expression = "1d4";
  const updated = applyCreatureRole(creature, "controller");
  assert.equal(updated.identity.roadmap, "controller");
  assert.equal(updated.identity.encounterRole, "controller");
  assert.deepEqual(updated.defenses.fortitude, { band: "low", value: 11 });
  assert.deepEqual(updated.defenses.will, { band: "high", value: 17 });
  assert.deepEqual(updated.strikes[0].attack, { band: "moderate", value: 15 });
  assert.equal(updated.strikes[0].damage[0].expression, "2d4+7");
  assert.deepEqual(damageBenchmarkFor(6).low, { expression: "2d4+7", average: 12 });
});

test("Creature validation returns the same benchmark guidance used by the editor", () => {
  const creature = completeCreature();
  creature.identity.level = 6;
  creature.defenses.ac = { band: "moderate", value: 25 };
  creature.strikes[0].attack = { band: "high", value: 18 };
  creature.strikes[0].damage[0].expression = "2d8+10";
  const result = validateOriginalCreature(creature);
  assert.equal(result.benchmarkGuidance.statistics.ac.guidance, "High · 1 above 24");
  assert.equal(result.benchmarkGuidance.strikes[0].attack.guidance, "High · 1 above 17");
  assert.equal(result.benchmarkGuidance.strikes[0].damage.guidance, "High · 1 above 18");
  assert.equal(result.benchmarkGuidance.role.recommended.attack, "moderate");
});

test("custom Creature commits reject native enum mismatches and fill decoder-required fields", () => {
  const invalid = completeCreature();
  invalid.identity.encounterRole = "boss controller";
  assert.throws(
    () => commitCustomCreature(invalid),
    (error) => error.code === "creature_structural_errors" && error.details.fields.includes("identity.encounterRole")
  );

  const sparse = completeCreature();
  sparse.strikes[0] = { ...sparse.strikes[0], traits: undefined, effect: undefined };
  sparse.abilities[0] = {
    id: "ability_1",
    name: "Dissonant toll",
    kind: "reaction",
    actionCost: null,
    effectText: "The bell tolls."
  };
  const committed = commitCustomCreature(sparse);
  assert.deepEqual(committed.strikes[0].traits, []);
  assert.equal(committed.strikes[0].effect, "");
  assert.deepEqual(committed.abilities[0].traits, []);
  assert.deepEqual(committed.abilities[0].damage, []);
  assert.deepEqual(committed.abilities[0].conditions, []);
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
