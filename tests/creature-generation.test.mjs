import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { commitCustomCreature, CreatureGenerationError, forkExistingCreature, validateCustomCreature } from "../src/creature-generation.js";

function entry() {
  return {
    kind: "creature",
    content_id: "creature/test/bell-adept/current",
    name: "Bell Adept",
    level: 5,
    rarity: "uncommon",
    traits: ["humanoid", "occult"],
    roles: ["controller"],
    spellcasting: true,
    completeness: "complete",
    support: "supported",
    summary: "A drowned ritualist.",
    detail: {
      size: "med",
      concept: "A drowned ritualist",
      perception: 13,
      languages: ["Common"],
      skills: { Occultism: 15 },
      defenses: { ac: 22, fortitude: 13, reflex: 12, will: 16, hp: 65 },
      speeds: { land: 25 },
      strikes: [{ name: "Staff", attack: 15, damage: "2d6+5", traits: ["magical"] }],
      abilities: [{ name: "Dissonant hymn", action_cost: 2, traits: ["auditory"], text: "Unsettle nearby creatures." }],
      spellcasting_blocks: ["Occult innate spells", "Cantrip: daze"],
      tactics: "Control the approach.",
      morale: "Flee when the bell is silenced."
    }
  };
}

test("fork preserves Catalog provenance and existing spellcasting blocks", () => {
  const creature = forkExistingCreature(entry(), { id: "cre_fork", createdAt: "2026-08-28T00:00:00Z" });
  assert.equal(creature.identity.size, "medium");
  assert.equal(creature.provenance.origin, "forked");
  assert.equal(creature.provenance.basedOnContentID, entry().content_id);
  assert.equal(creature.spellcastingStatus, "preserved_existing");
  assert.deepEqual(creature.spellcastingBlocks, ["Occult innate spells", "Cantrip: daze"]);
});

test("validation is read-only and commit blocks structural errors", () => {
  const partial = { ...entry(), completeness: "partial" };
  assert.throws(() => forkExistingCreature(partial), (error) => error instanceof CreatureGenerationError && error.code === "catalog_entry_partial");
  const invalid = forkExistingCreature(entry());
  invalid.identity.name = "";
  const before = structuredClone(invalid);
  const result = validateCustomCreature(invalid);
  assert.ok(result.structuralErrors.length > 0);
  assert.deepEqual(invalid, before);
  assert.throws(() => commitCustomCreature(invalid), (error) => error.code === "creature_structural_errors");
});

test("bundled supported Creatures fork with complete Strike mechanics", () => {
  const catalog = JSON.parse(readFileSync(fileURLToPath(new URL("../public/data/sidekickdm-catalog.v1.json", import.meta.url)), "utf8"));
  const orc = catalog.entries.find(({ content_id }) => content_id === "creature/monster-core/orc-veteran/current");
  const creature = forkExistingCreature(orc, { id: "cre_orc_veteran_fork" });
  const validation = validateCustomCreature(creature);
  assert.equal(validation.isStructurallyReady, true, JSON.stringify(validation.structuralErrors));
  assert.ok(creature.strikes.length > 0);
  for (const strike of creature.strikes) {
    assert.ok(Number.isInteger(strike.attack?.value), `${strike.name} is missing its attack statistic`);
    assert.ok(strike.damage.length > 0, `${strike.name} is missing damage`);
    assert.ok(strike.damage.every(({ expression }) => expression.length > 0), `${strike.name} has an empty damage expression`);
  }
});
