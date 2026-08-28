import { createEmptyOriginalCreature, validateOriginalCreature } from "./creature-builder.js";

const clone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const value = (object, camel, snake = camel) => object?.[camel] ?? object?.[snake];
const statistic = (number) => Number.isFinite(Number(number)) ? { band: "moderate", value: Number(number) } : null;

export class CreatureGenerationError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "CreatureGenerationError";
    this.code = code;
    if (details) this.details = clone(details);
  }
}

/** Read-only semantic validation for Original and Forked Creature DTOs. */
export function validateCustomCreature(creature) {
  return validateOriginalCreature(clone(creature));
}

/**
 * Create an encounter-local Forked Creature from a complete Catalog Entry.
 * Mechanics and existing spellcasting blocks are copied; spell lists are
 * never generated at this boundary.
 */
export function forkExistingCreature(entry, { id = null, createdAt = "", origin = "webmcp" } = {}) {
  if (!entry || entry.kind !== "creature") throw new CreatureGenerationError("unsupported_catalog_entry", "Only Creature Catalog Entries can be forked.");
  if (entry.completeness !== "complete" || entry.support !== "supported") throw new CreatureGenerationError("catalog_entry_partial", "Only complete, supported Catalog Entries can be forked.");
  const detail = entry.detail ?? {};
  const role = entry.roles?.[0] ?? "brute";
  const blocks = [...(value(detail, "spellcastingBlocks", "spellcasting_blocks") ?? [])];
  const strikes = (detail.strikes ?? []).map((strike, index) => ({
    id: `strike_${index + 1}`,
    name: strike.name ?? "",
    actionCost: Number.isInteger(Number(strike.action_cost ?? strike.actionCost)) ? Number(strike.action_cost ?? strike.actionCost) : 1,
    traits: [...(strike.traits ?? [])],
    attack: statistic(strike.attack),
    damage: strike.damage ? [{ expression: String(strike.damage), type: "" }] : [],
    effect: ""
  }));
  const abilities = (detail.abilities ?? []).map((ability, index) => {
    const rawCost = value(ability, "actionCost", "action_cost");
    const kind = ["reaction", "free_action", "passive"].includes(String(rawCost)) ? String(rawCost) : "action";
    return {
      id: `ability_${index + 1}`,
      name: ability.name ?? "",
      kind,
      actionCost: [1, 2, 3].includes(Number(rawCost)) ? Number(rawCost) : null,
      traits: [...(ability.traits ?? [])],
      trigger: null,
      requirements: null,
      target: null,
      range: null,
      area: null,
      resolution: null,
      damage: [],
      conditions: [],
      duration: null,
      frequency: null,
      effectText: ability.text ?? ""
    };
  });
  const creature = createEmptyOriginalCreature();
  creature.id = id ?? `cre_forked_${String(entry.content_id).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").toLowerCase()}`;
  creature.identity = {
    name: entry.name ?? "",
    level: Number(entry.level),
    rarity: entry.rarity ?? "common",
    size: ({ med: "medium", sm: "small", lg: "large", huge: "huge" })[detail.size] ?? detail.size ?? "medium",
    traits: [...(entry.traits ?? [])],
    concept: detail.concept ?? entry.summary ?? "",
    roadmap: role,
    encounterRole: role
  };
  creature.perception = statistic(detail.perception);
  creature.senses = [...(detail.senses ?? [])];
  creature.languages = [...(detail.languages ?? [])];
  creature.skills = { ...(detail.skills ?? {}) };
  creature.defenses = {
    ac: statistic(detail.defenses?.ac),
    fortitude: statistic(detail.defenses?.fortitude),
    reflex: statistic(detail.defenses?.reflex),
    will: statistic(detail.defenses?.will),
    hp: statistic(detail.defenses?.hp),
    immunities: [], weaknesses: [], resistances: []
  };
  creature.speeds = { ...(detail.speeds ?? {}) };
  creature.strikes = strikes;
  creature.abilities = abilities;
  creature.spellcastingStatus = blocks.length || entry.spellcasting ? "preserved_existing" : "none";
  creature.spellcastingBlocks = blocks;
  creature.tactics = detail.tactics ?? "";
  creature.morale = detail.morale ?? "";
  creature.provenance = { origin: "forked", basedOnContentID: entry.content_id, createdAt, mutationOrigin: origin };
  return creature;
}

/** Validate, then return a detached commit snapshot for the host mutation. */
export function commitCustomCreature(creature, { origin = "webmcp" } = {}) {
  const snapshot = clone(creature);
  const readiness = validateCustomCreature(snapshot);
  if (readiness.structuralErrors.length > 0) {
    throw new CreatureGenerationError("creature_structural_errors", "The Creature has structural errors.", { fields: readiness.structuralErrors.map((item) => item.field) });
  }
  snapshot.provenance = { ...(snapshot.provenance ?? {}), origin: snapshot.provenance?.origin || "original", mutationOrigin: origin };
  return snapshot;
}
