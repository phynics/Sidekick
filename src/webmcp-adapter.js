/*
 * Sidekick DM's browser-only, read-only WebMCP adapter.
 *
 * The adapter deliberately depends on projections supplied by the host. It
 * does not know how the Swift/Wasm engine stores or mutates an Encounter.
 */

import { commitCustomCreature, forkExistingCreature, validateCustomCreature } from "./creature-generation.js";
import { createSimpleHazard, hazardBenchmarks, validateSimpleHazard } from "./hazard-builder.js";
import { benchmarkFor } from "./creature-builder.js";

export const PROTOCOL_VERSION = 1;
export const TOOL_PREFIX = "sidekickdm_";

const noInput = Object.freeze({
  type: "object",
  properties: {},
  additionalProperties: false
});

const encounterInput = Object.freeze({
  type: "object",
  properties: {
    encounter_id: { type: "string", minLength: 1, description: "The active Encounter Draft ID." }
  },
  required: ["encounter_id"],
  additionalProperties: false
});

const freeformObject = Object.freeze({ type: "object", additionalProperties: true });

const packetSections = Object.freeze(["setup", "running_guidance", "outcomes"]);
const packetInput = Object.freeze({
  type: "object",
  properties: {
    encounter_id: { type: "string", minLength: 1 },
    sections: { type: "array", items: { type: "string", enum: ["encounter_identity", "setup", "battlefield_guidance", "running_guidance", "cohesion", "information_visibility", "outcomes", "reward_guidance", "alternative_resolutions"] } },
    include_stat_blocks: { type: "boolean" }
  },
  required: ["encounter_id"],
  additionalProperties: false
});

const componentInput = Object.freeze({
  type: "object",
  properties: { encounter_id: { type: "string", minLength: 1 }, component_id: { type: "string", minLength: 1 } },
  required: ["encounter_id", "component_id"],
  additionalProperties: false
});

const creatureBenchmarkInput = Object.freeze({
  type: "object",
  properties: { level: { type: "integer", minimum: -1, maximum: 20 }, statistics: { type: "array", items: { type: "string" } } },
  required: ["level"],
  additionalProperties: false
});

const hazardBenchmarkInput = Object.freeze({
  type: "object",
  properties: { level: { type: "integer", minimum: -1, maximum: 20 }, complexity: { type: "string", enum: ["simple", "complex"] }, statistics: { type: "array", items: { type: "string" } } },
  required: ["level"],
  additionalProperties: false
});

const preflightInput = Object.freeze({
  type: "object",
  properties: {
    encounter_id: { type: "string", minLength: 1 },
    planned_participants: { type: "array", items: freeformObject },
    planned_hazards: { type: "array", items: freeformObject },
    planned_phases: { type: ["integer", "array", "object"], minimum: 0, items: freeformObject }
  },
  required: ["encounter_id"],
  additionalProperties: false
});

const catalogSearchInput = Object.freeze({
  type: "object",
  properties: {
    query: { type: "string" },
    kind: { type: "string", enum: ["creature", "hazard"] },
    level_min: { type: "integer", minimum: -1, maximum: 30 },
    level_max: { type: "integer", minimum: -1, maximum: 30 },
    traits: { type: "array", items: { type: "string" } },
    rarity: { type: "array", items: { type: "string" } },
    sources: { type: "array", items: { type: "string" } },
    environments: { type: "array", items: { type: "string" } },
    roles: { type: "array", items: { type: "string" } },
    edition: { type: "string", enum: ["current", "legacy", "adventure"] },
    spellcasting: { type: "boolean" },
    hazard_complexity: { type: "string", enum: ["simple", "complex"] },
    completeness: { type: "string", enum: ["complete", "partial"] },
    support: { type: "string", enum: ["supported", "unsupported"] },
    limit: { type: "integer", minimum: 1, maximum: 50 },
    offset: { type: "integer", minimum: 0 }
  },
  additionalProperties: false
});

const catalogEntryInput = Object.freeze({
  type: "object",
  properties: {
    content_id: { type: "string", minLength: 1, description: "Stable Catalog ContentID." }
  },
  required: ["content_id"],
  additionalProperties: false
});

const revisionProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  generation_run_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 },
  expected_brief_revision: { type: "integer", minimum: 0 },
  expected_constraints_revision: { type: "integer", minimum: 0 }
});

const generationMutationRequired = (fields) => ["encounter_id", "expected_encounter_revision", "expected_constraints_revision", ...fields];

const cancelGenerationProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  generation_run_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 }
});

const targetedRevisionProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 },
  section: { type: "string", enum: ["encounter_identity", "setup", "battlefield_guidance", "running_guidance", "cohesion", "information_visibility", "outcomes"] },
  value: freeformObject
});

const assumptionsProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  generation_run_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 },
  expected_constraints_revision: { type: "integer", minimum: 0 },
  assumptions: { type: "array", items: { type: "string" } }
});

const creativeBriefProperties = Object.freeze({
  ...revisionProperties,
  purpose: { type: "string" }, premise: { type: "string" }, theme: { type: "array", items: { type: "string" } },
  environment: { type: "string" }, tone: { type: "array", items: { type: "string" } },
  desired_complexity: { type: "string" }, existing_vs_custom: { type: "string" }, approximate_play_minutes: { type: "integer", minimum: 0 },
  preferred_traits: { type: "array", items: { type: "string" } }, excluded_traits: { type: "array", items: { type: "string" } }, source_restrictions: { type: "array", items: { type: "string" } }
});

const readAnnotations = Object.freeze({
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false
});

const untrustedAnnotations = Object.freeze({
  ...readAnnotations,
  untrustedContentHint: true
});

function definition(name, description, inputSchema, { untrusted = false } = {}) {
  const annotations = untrusted ? untrustedAnnotations : readAnnotations;
  return Object.freeze({
    name,
    description,
    inputSchema,
    // WebMCP implementations in the wild have exposed these hints both on
    // the definition and under annotations. Keep both forms for detection.
    readOnlyHint: true,
    untrustedContentHint: untrusted,
    annotations
  });
}

function writeDefinition(name, description, properties, required = []) {
  return Object.freeze({
    name,
    description,
    inputSchema: { type: "object", properties, required, additionalProperties: false },
    readOnlyHint: false,
    untrustedContentHint: true,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false, untrustedContentHint: true }
  });
}

const READ_TOOL_DEFINITIONS = Object.freeze([
  definition(`${TOOL_PREFIX}get_capabilities`, "Read Sidekick DM protocol, catalog, and optional feature support.", noInput),
  definition(`${TOOL_PREFIX}get_encounter_summary`, "Read a compact summary of the active Encounter Draft.", encounterInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_encounter_brief`, "Read the Encounter Brief, Party Snapshot, creative preferences, assumptions, and Content Boundaries.", noInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_brief_checklist`, "Read the compact Encounter Brief checklist and the impact of missing fields.", noInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_budget`, "Read the current authoritative encounter budget and inferred threat.", noInput),
  definition(`${TOOL_PREFIX}get_readiness`, "Read structural errors, design warnings, missing packet sections, and review state.", noInput),
  definition(`${TOOL_PREFIX}search_catalog`, "Search the independent Sidekick DM Catalog by text and structured filters.", catalogSearchInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_catalog_entry`, "Read one full game-facing Catalog Entry and its Catalog Provenance.", catalogEntryInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_encounter_packet`, "Read the GM-facing Encounter Packet projection, optionally limited to named sections.", packetInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_component`, "Read one Encounter component by ID without exposing engine serialization.", componentInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_creature_benchmarks`, "Read the official-style Creature Builder benchmark bands for a level.", creatureBenchmarkInput),
  definition(`${TOOL_PREFIX}get_hazard_benchmarks`, "Read the official-style Hazard Builder benchmark bands for a level and complexity.", hazardBenchmarkInput),
  definition(`${TOOL_PREFIX}preflight_generation`, "Estimate a Generation Run outline without mutating the Encounter Draft.", preflightInput, { untrusted: true })
]);

const WRITE_TOOL_DEFINITIONS = Object.freeze([
  writeDefinition(`${TOOL_PREFIX}begin_generation`, "Begin a revision-checked Generation Run after acknowledging GM-owned Content Boundaries.", { ...revisionProperties, content_boundaries_acknowledged: { type: "boolean" }, intent_summary: { type: "string" } }, ["encounter_id", "expected_encounter_revision", "expected_brief_revision", "expected_constraints_revision", "content_boundaries_acknowledged"]),
  writeDefinition(`${TOOL_PREFIX}add_existing_participant_group`, "Add one complete supported Catalog Creature during a Generation Run.", { ...revisionProperties, content_id: { type: "string", minLength: 1 }, quantity: { type: "integer", minimum: 1 }, adjustment: { type: "string", enum: ["weak", "normal", "elite"] }, faction: { type: "string" }, participation: freeformObject, encounter_role: { type: "string" }, narrative_tier: { type: "string" }, starting_area: { type: "string" }, shared_tactics: { type: "string" }, morale: { type: "string" } }, generationMutationRequired(["content_id"])),
  definition(`${TOOL_PREFIX}fork_existing_creature`, "Create a detached Forked Creature draft from a complete supported Catalog Creature while preserving existing spellcasting blocks.", { type: "object", properties: { content_id: { type: "string", minLength: 1 }, id: { type: "string" } }, required: ["content_id"], additionalProperties: false }, { untrusted: true }),
  definition(`${TOOL_PREFIX}validate_custom_creature`, "Validate an Original or Forked Creature without mutating the Encounter.", { type: "object", properties: { creature: freeformObject }, required: ["creature"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_custom_creature`, "Validate, embed, and place an Original or Forked Creature atomically.", { ...revisionProperties, creature: freeformObject, quantity: { type: "integer", minimum: 1 }, starting_area: { type: "string" } }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}update_creature`, "Validate and replace an encounter-embedded Original or Forked Creature and update its Participant Group projection atomically.", { ...revisionProperties, creature: freeformObject }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}update_custom_creature`, "Backward-compatible alias for update_creature.", { ...revisionProperties, creature: freeformObject }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}upsert_npc_profile`, "Create or update one validated NPC Profile associated with an encounter Participant Group.", { ...revisionProperties, profile: freeformObject }, generationMutationRequired(["profile"])),
  writeDefinition(`${TOOL_PREFIX}add_existing_hazard`, "Add one complete supported Catalog Hazard with participation, placement, and optional phase assignment during a Generation Run.", { ...revisionProperties, content_id: { type: "string", minLength: 1 }, id: { type: "string", minLength: 1 }, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" }, phase_id: { type: "string", minLength: 1 }, phase_ids: { type: "array", items: { type: "string", minLength: 1 } } }, generationMutationRequired(["content_id"])),
  definition(`${TOOL_PREFIX}validate_simple_hazard`, "Validate a custom Simple Hazard without mutating the Encounter.", { type: "object", properties: { hazard: freeformObject }, required: ["hazard"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_simple_hazard`, "Validate, embed, and place a custom Simple Hazard atomically.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, generationMutationRequired(["hazard"])),
  writeDefinition(`${TOOL_PREFIX}update_hazard`, "Update an encounter-embedded custom Simple Hazard and its participation or placement.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, generationMutationRequired(["hazard"])),
  writeDefinition(`${TOOL_PREFIX}remove_component`, "Remove an encounter placement without deleting reusable library records.", { ...revisionProperties, component_id: { type: "string", minLength: 1 } }, generationMutationRequired(["component_id"])),
  writeDefinition(`${TOOL_PREFIX}upsert_phase`, "Validate and add or replace one structured Encounter Phase.", { ...revisionProperties, phase: freeformObject }, generationMutationRequired(["phase"])),
  ...["encounter_identity", "setup", "battlefield_guidance", "running_guidance", "cohesion", "information_visibility", "outcomes"].map(section => writeDefinition(`${TOOL_PREFIX}set_${section}`, `Set the semantic Encounter Packet ${section.replaceAll("_", " ")} section.`, { ...revisionProperties, value: freeformObject }, generationMutationRequired(["value"]))),
  writeDefinition(`${TOOL_PREFIX}finish_generation`, "Finish a structurally complete Generation Run and preserve Design Warnings for review.", { ...revisionProperties, completion_note: { type: "string" } }, generationMutationRequired([])),
  writeDefinition(`${TOOL_PREFIX}cancel_generation`, "Cancel a Generation Run and restore its opening Encounter state.", cancelGenerationProperties, ["encounter_id", "expected_encounter_revision"]),
  writeDefinition(`${TOOL_PREFIX}apply_targeted_revision`, "Apply one named agent-authored revision after a Generation Run; undo restores the finished run first, then the opening Encounter.", targetedRevisionProperties, ["encounter_id", "expected_encounter_revision", "section", "value"]),
  writeDefinition(`${TOOL_PREFIX}set_generation_assumptions`, "Record concise assumptions for omitted optional Brief fields during a Generation Run.", assumptionsProperties, generationMutationRequired(["assumptions"])),
  writeDefinition(`${TOOL_PREFIX}update_creative_brief`, "Update agent-editable creative Brief fields without changing Party Snapshot or Content Boundaries.", creativeBriefProperties, ["encounter_id", "expected_encounter_revision", "expected_constraints_revision"]),
  writeDefinition(`${TOOL_PREFIX}set_reward_guidance`, "Set optional narrative reward guidance in the Encounter Packet.", { ...revisionProperties, value: { type: ["string", "null"] } }, ["encounter_id", "expected_encounter_revision", "expected_constraints_revision", "value"]),
  writeDefinition(`${TOOL_PREFIX}set_alternative_resolutions`, "Set optional structured Alternative Resolutions in the Encounter Packet.", { ...revisionProperties, value: { type: "array", items: freeformObject } }, ["encounter_id", "expected_encounter_revision", "expected_constraints_revision", "value"]),
  writeDefinition(`${TOOL_PREFIX}undo`, "Undo the most recent authored mutation or complete finished Generation Run.", { encounter_id: revisionProperties.encounter_id, expected_encounter_revision: revisionProperties.expected_encounter_revision }, ["encounter_id", "expected_encounter_revision"]),
  writeDefinition(`${TOOL_PREFIX}redo`, "Redo the most recently undone mutation.", { encounter_id: revisionProperties.encounter_id, expected_encounter_revision: revisionProperties.expected_encounter_revision }, ["encounter_id", "expected_encounter_revision"])
]);

const TOOL_DEFINITIONS = Object.freeze([...READ_TOOL_DEFINITIONS, ...WRITE_TOOL_DEFINITIONS]);

const RECOVERY = Object.freeze({
  unknown_encounter: "Read the active Encounter Draft again before retrying.",
  unknown_catalog_entry: "Search the Catalog again and use a returned ContentID.",
  catalog_unavailable: "Wait for the Catalog to finish loading, then retry the read.",
  stale_revision: "Read the Encounter again and retry with its current revision.",
  stale_brief_revision: "Read the Encounter Brief again and retry with its current revision.",
  stale_constraints: "Read the GM-owned constraints again before retrying.",
  wrong_generation_run: "Read the active Generation Run ID again before retrying.",
  manual_write_locked: "Use the active Generation Run tools or finish or cancel the run first.",
  structural_errors: "Read Readiness, resolve every Structural Error, and retry finish.",
  invalid_request: "Check the tool input against its schema."
});

const registrationsByContext = new WeakMap();
const registrationLifecyclesByContext = new WeakMap();

const clone = (value) => {
  if (value === undefined) return undefined;
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
};

function camelKey(key) {
  return key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()).replace(/Ids\b/g, "IDs").replace(/Id\b/g, "ID");
}

function keysToCamel(value) {
  if (Array.isArray(value)) return value.map(keysToCamel);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [camelKey(key), keysToCamel(item)]));
}

function snakeKey(key) {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase();
}

function keysToSnake(value) {
  if (Array.isArray(value)) return value.map(keysToSnake);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [snakeKey(key), keysToSnake(item)]));
}

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function array(value) {
  return Array.isArray(value) ? [...value] : [];
}

function text(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function optionalText(value) {
  return value == null ? null : text(value);
}

function optionalNumber(value) {
  return value == null ? null : number(value, null);
}

function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function unwrap(raw) {
  const outer = raw?.snapshot && (raw.snapshot.draft || raw.snapshot.encounter) ? raw.snapshot : raw;
  const snapshot = outer ?? {};
  const draft = snapshot.encounter ?? snapshot.draft ?? snapshot;
  const generation = draft?.generation ?? snapshot.generation ?? null;
  return {
    raw,
    snapshot,
    draft: draft && typeof draft === "object" ? draft : null,
    encounterRevision: number(firstDefined(snapshot.encounterRevision, snapshot.encounter_revision, draft?.revision), 0),
    briefRevision: number(firstDefined(snapshot.briefRevision, snapshot.brief_revision, draft?.briefRevision, draft?.brief_revision), 0),
    constraintsRevision: number(firstDefined(snapshot.constraintsRevision, snapshot.constraints_revision, draft?.constraintsRevision, draft?.constraints_revision), 0),
    generationRunID: firstDefined(snapshot.generationRunID, snapshot.generation_run_id, generation?.id) ?? null
  };
}

function envelope(state, data, error = null) {
  const result = {
    protocol_version: PROTOCOL_VERSION,
    encounter_revision: state.encounterRevision,
    brief_revision: state.briefRevision,
    constraints_revision: state.constraintsRevision,
    ok: !error
  };
  if (state.generationRunID) result.generation_run_id = state.generationRunID;
  if (error) result.error = error;
  else result.data = data;
  return result;
}

function domainError(code, message, details = undefined) {
  const error = { code, message };
  if (details && typeof details === "object" && Object.keys(details).length > 0) error.details = clone(details);
  if (RECOVERY[code]) error.recovery = RECOVERY[code];
  return error;
}

function errorPayload(error) {
  const source = error?.error && typeof error.error === "object" ? error.error : error;
  const rawCode = text(source?.code) || "application_error";
  const code = rawCode === "invalid_creature" || rawCode === "creature_structural_errors" ? "invalid_creature_stat_block" : rawCode;
  const message = text(source?.message) || "Sidekick DM could not complete that read.";
  return domainError(code, message, source?.details);
}

function requireDraft(state) {
  if (!state.draft) throw Object.assign(new Error("The active Encounter Draft is not available."), { code: "unknown_encounter" });
  return state.draft;
}

function checkEncounter(state, input) {
  if (input?.encounter_id == null) return;
  const requested = text(input.encounter_id);
  if (!requested || requested !== text(state.draft?.id)) {
    throw Object.assign(new Error("The requested Encounter Draft does not exist."), {
      code: "unknown_encounter",
      details: { encounter_id: requested }
    });
  }
}

function projectParty(party = {}) {
  const capabilities = party.capabilities ?? {};
  return {
    effective_level: optionalNumber(firstDefined(party.effective_level, party.effectiveLevel)),
    size: optionalNumber(party.size),
    mixed_level_notes: firstDefined(party.mixed_level_notes, party.mixedLevelNotes) ?? null,
    allied_combatants: array(firstDefined(party.allied_combatants, party.alliedCombatants)),
    capabilities: {
      strengths: array(capabilities.strengths),
      weaknesses: array(capabilities.weaknesses),
      notes: optionalText(capabilities.notes)
    },
    player_experience: firstDefined(party.player_experience, party.playerExperience) ?? null,
    resource_state: firstDefined(party.resource_state, party.resourceState) ?? null
  };
}

function projectBrief(draft) {
  const brief = draft.brief ?? {};
  const party = projectParty(brief.party ?? {});
  const target = brief.threatTarget ?? brief.threat_target ?? {};
  const creative = brief.creative ?? {};
  const boundaries = brief.contentBoundaries ?? brief.content_boundaries ?? draft.contentBoundaries ?? draft.content_boundaries ?? {};
  return {
    object_version: number(firstDefined(brief.object_version, brief.objectVersion), 1),
    party,
    threat_target: {
      kind: firstDefined(target.kind) ?? null,
      custom_xp: firstDefined(target.custom_xp, target.customXP) ?? null
    },
    creative: {
      purpose: optionalText(firstDefined(creative.purpose, brief.purpose)),
      premise: optionalText(firstDefined(creative.premise, brief.premise)),
      theme: array(firstDefined(creative.theme, brief.theme)),
      environment: optionalText(firstDefined(creative.environment, brief.environment)),
      tone: array(firstDefined(creative.tone, brief.tone)),
      desired_complexity: firstDefined(creative.desired_complexity, creative.desiredComplexity, brief.desiredComplexity, brief.desired_complexity) ?? null,
      existing_vs_custom: firstDefined(creative.existing_vs_custom, creative.existingVsCustom, brief.existingVsCustom, brief.existing_vs_custom) ?? null,
      preferred_traits: array(firstDefined(creative.preferred_traits, creative.preferredTraits, brief.preferredTraits, brief.preferred_traits)),
      excluded_traits: array(firstDefined(creative.excluded_traits, creative.excludedTraits, brief.excludedTraits, brief.excluded_traits)),
      source_restrictions: array(firstDefined(creative.source_restrictions, creative.sourceRestrictions, brief.sourceRestrictions, brief.source_restrictions)),
      approximate_play_minutes: firstDefined(creative.approximate_play_minutes, creative.approximatePlayMinutes, brief.approximatePlayMinutes, brief.approximate_play_minutes) ?? null
    },
    content_boundaries: {
      lines: array(boundaries.lines),
      veils: array(boundaries.veils),
      excluded_themes: array(firstDefined(boundaries.excluded_themes, boundaries.excludedThemes)),
      tone_limits: clone(boundaries.tone_limits ?? boundaries.toneLimits ?? {}),
      notes: optionalText(boundaries.notes)
    },
    generation_assumptions: array(firstDefined(brief.generation_assumptions, brief.generationAssumptions, draft.generationAssumptions))
  };
}

function fieldMissing(value) {
  return value == null || (typeof value === "string" && value.trim().length === 0) || (Array.isArray(value) && value.length === 0);
}

function projectChecklist(draft) {
  const brief = projectBrief(draft);
  const items = [
    ["party.effective_level", brief.party.effective_level, true, false, "Sets the level used by the encounter budget."],
    ["party.size", brief.party.size, true, false, "Adjusts the Construction Budget for the party size."],
    ["threat_target", brief.threat_target.kind, true, false, "Sets the desired encounter category or custom XP target."],
    ["purpose", brief.creative.purpose, false, true, "Clarifies what the encounter is meant to accomplish."],
    ["premise", brief.creative.premise, false, true, "Gives the encounter a concrete situation for composition and packet writing."],
    ["environment", brief.creative.environment, false, true, "Helps choose fitting creatures, hazards, and terrain."],
    ["content_boundaries", brief.content_boundaries, false, false, "Keeps authored material within the GM's stated limits."]
  ].map(([field, value, required, agentEditable, impact]) => ({
    field,
    status: fieldMissing(value) ? "missing" : "complete",
    required,
    agent_editable: agentEditable,
    impact
  }));
  return { items };
}

function projectBudget(snapshot) {
  const budget = snapshot.budget ?? {};
  return {
    target_threat: firstDefined(budget.target_threat, budget.targetThreat) ?? null,
    base_target_xp: optionalNumber(firstDefined(budget.base_target_xp, budget.baseTargetXP)),
    party_size_adjustment: optionalNumber(firstDefined(budget.party_size_adjustment, budget.partySizeAdjustment)),
    construction_budget: optionalNumber(firstDefined(budget.construction_budget, budget.constructionBudget)),
    guaranteed_xp: optionalNumber(firstDefined(budget.guaranteed_xp, budget.guaranteedXP)),
    avoidable_xp: optionalNumber(firstDefined(budget.avoidable_xp, budget.avoidableXP)),
    conditional_xp: optionalNumber(firstDefined(budget.conditional_xp, budget.conditionalXP)),
    peak_active_xp: optionalNumber(firstDefined(budget.peak_active_xp, budget.peakActiveXP)),
    total_encounter_xp: optionalNumber(firstDefined(budget.total_encounter_xp, budget.totalEncounterXP)),
    base_xp_award: optionalNumber(firstDefined(budget.base_xp_award, budget.baseXPAward)),
    terrain_adjustment: optionalNumber(firstDefined(budget.terrain_adjustment, budget.terrainAdjustment)),
    inferred_threat: firstDefined(budget.inferred_threat, budget.inferredThreat) ?? null,
    warnings: array(budget.warnings),
    phase_budget: projectPhaseBudget(snapshot)
  };
}

function projectPhaseBudget(snapshot) {
  const budget = snapshot.phaseBudget ?? snapshot.phase_budget ?? {};
  return {
    per_phase: array(firstDefined(budget.perPhase, budget.per_phase)).map(item => ({
      phase_id: firstDefined(item.phaseID, item.phase_id),
      title: text(item.title),
      participant_ids: array(firstDefined(item.participantIDs, item.participant_ids)),
      hazard_ids: array(firstDefined(item.hazardIDs, item.hazard_ids)),
      active_xp: optionalNumber(firstDefined(item.activeXP, item.active_xp)),
      terrain_adjustment: optionalNumber(firstDefined(item.terrainAdjustment, item.terrain_adjustment)),
      participation: keysToSnake(item.participation ?? {})
    })),
    guaranteed_xp: optionalNumber(firstDefined(budget.guaranteedXP, budget.guaranteed_xp)),
    avoidable_xp: optionalNumber(firstDefined(budget.avoidableXP, budget.avoidable_xp)),
    conditional_xp: optionalNumber(firstDefined(budget.conditionalXP, budget.conditional_xp)),
    reinforcement_xp: optionalNumber(firstDefined(budget.reinforcementXP, budget.reinforcement_xp)),
    peak_active_xp: optionalNumber(firstDefined(budget.peakActiveXP, budget.peak_active_xp)),
    total_encounter_xp: optionalNumber(firstDefined(budget.totalEncounterXP, budget.total_encounter_xp)),
    terrain_adjustment: optionalNumber(firstDefined(budget.terrainAdjustment, budget.terrain_adjustment)),
    overlap_warnings: array(firstDefined(budget.overlapWarnings, budget.overlap_warnings)).map(keysToSnake)
  };
}

function readinessStatus(value) {
  return ({
    incomplete: "incomplete draft",
    blocked: "incomplete draft",
    ready_with_warnings: "ready with warnings",
    "ready with warnings": "ready with warnings",
    ready: "ready to run",
    "ready to run": "ready to run"
  })[value] ?? value ?? "incomplete draft";
}

function projectReadiness(snapshot, draft) {
  const readiness = snapshot.readiness ?? {};
  const packet = draft.packetV1 ?? draft.packet_v1 ?? draft.packet ?? {};
  const fieldValue = (section, ...names) => firstDefined(...names.map(name => section?.[name]));
  const derivedMissing = [
    ["encounter_identity", packet.identity, [["title"], ["premise"], ["objective"], ["stakes"]]],
    ["setup", packet.setup, [["trigger"], ["battlefieldDescription", "battlefield_description"], ["startingPositions", "starting_positions"], ["awarenessState", "awareness_state"], ["immediateFeatures", "immediate_features"]]],
    ["running_guidance", packet.runningGuidance ?? packet.running_guidance, [["participantRoles", "participant_roles"], ["openingTactics", "opening_tactics"], ["ongoingTactics", "ongoing_tactics"], ["coordinationConflict", "coordination_conflict"], ["triggersReinforcements", "triggers_reinforcements"], ["moraleSummary", "morale_summary"]]],
    ["cohesion", packet.cohesion, [["participantPresence", "participant_presence"], ["relationships"], ["hazardTerrainFit", "hazard_terrain_fit"]]],
    ["outcomes", packet.outcomes, [["victory"]]]
  ].filter(([, section, fields]) => !section || fields.some(names => fieldMissing(fieldValue(section, ...names)))).map(([section]) => section);
  const missing = array(firstDefined(readiness.missing_required_packet_sections, readiness.missingRequiredPacketSections, readiness.missingSections, derivedMissing));
  const structuralErrors = array(firstDefined(readiness.structural_errors, readiness.structuralErrors));
  const designWarnings = array(firstDefined(readiness.design_warnings, readiness.designWarnings));
  const reviewState = firstDefined(draft.review_state, draft.reviewState, "needed");
  let status = readinessStatus(readiness.status);
  if (status === "ready to run" && reviewState === "needed") status = "ready with review needed";
  return {
    structural_errors: structuralErrors,
    design_warnings: designWarnings,
    missing_required_packet_sections: missing,
    review_state: reviewState,
    status,
    is_structurally_ready: Boolean(firstDefined(readiness.is_structurally_ready, readiness.isStructurallyReady, structuralErrors.length === 0))
  };
}

function packetObject(draft) {
  return clone(draft.packetV1 ?? draft.packet_v1 ?? draft.packet ?? {});
}

function projectPacket(draft, input = {}) {
  const packet = packetObject(draft);
  const sections = input.sections == null ? null : new Set(array(input.sections));
  const entries = {
    encounter_identity: packet.identity,
    setup: packet.setup,
    battlefield_guidance: packet.battlefield,
    running_guidance: packet.runningGuidance ?? packet.running_guidance,
    cohesion: packet.cohesion,
    information_visibility: packet.information,
    outcomes: packet.outcomes,
    reward_guidance: firstDefined(packet.rewardGuidance, packet.reward_guidance) ?? null,
    alternative_resolutions: firstDefined(packet.alternativeResolutions, packet.alternative_resolutions) ?? []
  };
  const selected = Object.fromEntries(Object.entries(entries).filter(([name, value]) => (!sections || sections.has(name)) && value !== undefined).map(([name, value]) => [name, keysToSnake(value)]));
  const components = {
    participants: array(draft.participantGroups ?? draft.participant_groups).map(projectParticipant),
    hazards: array(draft.hazards).map(projectHazard),
    phases: array(draft.structuredPhases ?? draft.structured_phases ?? draft.phases).map(projectPhase)
  };
  if (input.include_stat_blocks === true) {
    components.creatures = array(draft.originalCreatures ?? draft.original_creatures).map(keysToSnake);
    components.custom_hazards = array(draft.customHazards ?? draft.custom_hazards).map(keysToSnake);
  }
  return { encounter_id: text(draft.id), sections: selected, components };
}

function projectComponent(draft, componentID) {
  const lists = [
    ["participant_group", array(draft.participantGroups ?? draft.participant_groups)],
    ["hazard", array(draft.hazards)],
    ["phase", array(draft.structuredPhases ?? draft.structured_phases ?? draft.phases)],
    ["npc_profile", array(draft.npcProfiles ?? draft.npc_profiles)],
    ["creature", array(draft.originalCreatures ?? draft.original_creatures)],
    ["custom_hazard", array(draft.customHazards ?? draft.custom_hazards)]
  ];
  for (const [componentType, items] of lists) {
    const found = items.find(item => text(item.id) === componentID);
    if (found) return { component_type: componentType, component: keysToSnake(found) };
  }
  const alternatives = array(packetObject(draft).alternativeResolutions ?? packetObject(draft).alternative_resolutions);
  const alternative = alternatives.find(item => text(item.id) === componentID);
  if (alternative) return { component_type: "alternative_resolution", component: keysToSnake(alternative) };
  throw Object.assign(new Error("That component is not in the Encounter."), { code: "unknown_component", details: { component_id: componentID } });
}

function projectCreatureBenchmarks(input) {
  const benchmark = benchmarkFor(input.level);
  if (!benchmark) return { level: Number(input.level), supported: false, statistics: {} };
  const selected = array(input.statistics);
  const all = { perception: benchmark.perception, ac: benchmark.ac, armor_class: benchmark.ac, saves: benchmark.saves, saving_throws: benchmark.saves, hp: benchmark.hp, hit_points: benchmark.hp, attack: benchmark.attack, damage: benchmark.attack, dc: benchmark.dc };
  const statistics = Object.fromEntries(Object.entries(all).filter(([name]) => selected.length === 0 || selected.includes(name)).map(([name, value]) => [name, clone(value)]));
  return { level: Number(input.level), supported: true, statistics };
}

function projectHazardBenchmarks(input) {
  const level = Number(input.level);
  const benchmark = hazardBenchmarks(level);
  if (!benchmark) return { level, complexity: input.complexity ?? "simple", supported: false, statistics: {} };
  const complexity = input.complexity ?? "simple";
  const ranges = values => Object.fromEntries(Object.entries(values).map(([band, value]) => [band, { minimum: value, maximum: value }]));
  const stats = {
    stealth: ranges(benchmark.stealth),
    disable_dc: ranges(benchmark.disableDC),
    armor_class: ranges(benchmark.armorClass),
    saves: ranges(benchmark.saves),
    hardness: benchmark.hardness,
    hit_points: benchmark.hitPoints,
    attack: complexity === "complex" ? benchmark.complexAttack : benchmark.simpleAttack,
    damage: complexity === "complex" ? benchmark.complexDamage : benchmark.simpleDamage,
    dc: { hard: benchmark.hardDC, extreme: benchmark.extremeDC },
    hard_dc: benchmark.hardDC,
    extreme_dc: benchmark.extremeDC
  };
  const selected = array(input.statistics);
  return { level, complexity, supported: true, statistics: Object.fromEntries(Object.entries(stats).filter(([name]) => selected.length === 0 || selected.includes(name))) };
}

function projectPreflight(snapshot, draft, input) {
  const partyLevel = number(firstDefined(draft.brief?.party?.effectiveLevel, draft.brief?.party?.effective_level), 1);
  const creatureXP = [10, 15, 20, 30, 40, 60, 80, 120, 160];
  const hazardXP = { simple: [2, 3, 4, 6, 8, 12, 16, 24, 30], complex: [10, 15, 20, 30, 40, 60, 80, 120, 150] };
  const xpAtRelativeLevel = (table, relative, above) => relative < -4 ? 0 : relative > 4 ? above : table[relative + 4];
  const participationMode = (item, fallback) => typeof item?.participation === "object" ? firstDefined(item.participation.mode, fallback) : firstDefined(item?.participation, fallback);
  const participantXP = item => xpAtRelativeLevel(creatureXP, Number(item.level ?? partyLevel) + (item.adjustment === "weak" ? -1 : item.adjustment === "elite" ? 1 : 0) - partyLevel, 160) * Math.max(0, Number(item.quantity ?? 1) || 0);
  const hazardXPFor = item => {
    const complexity = item.complexity === "complex" ? "complex" : "simple";
    return xpAtRelativeLevel(hazardXP[complexity], Number(item.level ?? partyLevel) - partyLevel, complexity === "complex" ? 150 : 30);
  };
  const participants = array(input.planned_participants).map((item, index) => ({ item, id: firstDefined(item.id, item.participant_id, item.participantID, `planned_participant_${index}`), xp: participantXP(item) }));
  const hazards = array(input.planned_hazards).map((item, index) => ({ item, id: firstDefined(item.id, item.hazard_id, item.hazardID, `planned_hazard_${index}`), xp: hazardXPFor(item) }));
  let guaranteed = 0, avoidable = 0, conditional = 0;
  const add = (xp, mode) => { if (mode === "mandatory") guaranteed += xp; else if (mode === "avoidable") avoidable += xp; else conditional += xp; };
  for (const { item, xp } of participants) add(xp, participationMode(item, "mandatory"));
  for (const { item, xp } of hazards) add(xp, participationMode(item, "mandatory"));
  const total = guaranteed + avoidable + conditional;
  const plannedPhases = Array.isArray(input.planned_phases)
    ? input.planned_phases
    : input.planned_phases && typeof input.planned_phases === "object"
      ? Object.entries(input.planned_phases).map(([id, phase]) => ({ ...(phase ?? {}), id: firstDefined(phase?.id, id) }))
      : [];
  const phaseCount = Array.isArray(input.planned_phases) || (input.planned_phases && typeof input.planned_phases === "object") ? plannedPhases.length : number(input.planned_phases, 0);
  const byID = new Map([...participants, ...hazards].map(item => [String(item.id), item]));
  const phaseXP = phase => {
    const ids = [...array(firstDefined(phase.participant_ids, phase.participantIDs)), ...array(firstDefined(phase.hazard_ids, phase.hazardIDs))].map(String);
    return [...new Set(ids)].map(id => byID.get(id)).filter(Boolean).reduce((sum, item) => sum + item.xp, 0);
  };
  const phaseXPByID = new Map(plannedPhases.map(phase => [String(phase.id), phaseXP(phase)]));
  for (const entry of [...participants, ...hazards]) {
    for (const phaseID of array(firstDefined(entry.item.phase_ids, entry.item.phaseIDs))) {
      const key = String(phaseID);
      if (!phaseXPByID.has(key)) phaseXPByID.set(key, 0);
      phaseXPByID.set(key, phaseXPByID.get(key) + entry.xp);
    }
  }
  const hasExplicitActivation = plannedPhases.length > 0 || phaseXPByID.size > 0;
  const peak = hasExplicitActivation ? Math.max(...phaseXPByID.values(), 0) : total;
  const budget = projectBudget(snapshot).construction_budget;
  const warnings = [];
  if (peak > budget) warnings.push("The planned outline exceeds the Construction Budget.");
  if (total > 0 && peak < budget / 2 && budget > 0) warnings.push("Peak Active XP is substantially below the Construction Budget.");
  return { party_level: partyLevel, planned_phases: phaseCount, guaranteed_xp: guaranteed, avoidable_xp: avoidable, conditional_xp: conditional, peak_active_xp: peak, total_encounter_xp: total, construction_budget: budget, warnings };
}

function projectParticipant(group) {
  const participation = group.participation ?? {};
  return {
    id: text(group.id),
    content_id: firstDefined(group.content_id, group.contentID) ?? null,
    name: optionalText(group.name),
    level: optionalNumber(group.level),
    quantity: optionalNumber(group.quantity),
    adjustment: firstDefined(group.adjustment) ?? null,
    faction: firstDefined(group.faction) ?? null,
    participation: {
      mode: firstDefined(participation.mode) ?? null,
      condition: firstDefined(participation.condition) ?? null
    },
    encounter_role: firstDefined(group.encounter_role, group.encounterRole) ?? null,
    narrative_tier: firstDefined(group.narrative_tier, group.narrativeTier) ?? null
  };
}

function projectHazard(hazard) {
  const participation = hazard.participation ?? {};
  return {
    id: text(hazard.id),
    content_id: firstDefined(hazard.content_id, hazard.contentID) ?? null,
    name: optionalText(hazard.name),
    level: optionalNumber(hazard.level),
    complexity: firstDefined(hazard.complexity) ?? null,
    participation: {
      mode: firstDefined(participation.mode) ?? null,
      condition: firstDefined(participation.condition) ?? null
    },
    placement: text(hazard.placement)
  };
}

function projectPhase(phase) {
  const trigger = phase.trigger && typeof phase.trigger === "object" ? clone(phase.trigger) : { kind: null, explanation: optionalText(phase.trigger), value: null, can_overlap: null };
  return {
    id: optionalText(phase.id),
    title: optionalText(phase.title),
    order: optionalNumber(phase.order),
    participant_ids: array(firstDefined(phase.participant_ids, phase.participantIDs)),
    hazard_ids: array(firstDefined(phase.hazard_ids, phase.hazardIDs)),
    trigger,
    terrain_changes: clone(firstDefined(phase.terrain_changes, phase.terrainChanges, [])),
    running_guidance: text(firstDefined(phase.running_guidance, phase.runningGuidance))
  };
}

function projectSummary(snapshot, draft, state) {
  const target = draft.brief?.threatTarget ?? draft.brief?.threat_target ?? {};
  const budget = projectBudget(snapshot);
  const readiness = projectReadiness(snapshot, draft);
  return {
    encounter_id: optionalText(draft.id),
    title: optionalText(draft.title),
    premise: optionalText(firstDefined(draft.packet?.premise, draft.packetV1?.identity?.premise, draft.packet_v1?.identity?.premise, draft.brief?.premise, draft.brief?.creative?.premise)),
    party: {
      effective_level: optionalNumber(firstDefined(draft.brief?.party?.effectiveLevel, draft.brief?.party?.effective_level)),
      size: optionalNumber(draft.brief?.party?.size)
    },
    target_threat: firstDefined(target.kind) ?? null,
    inferred_threat: budget.inferred_threat,
    budget: {
      construction_budget: budget.construction_budget,
      guaranteed_xp: budget.guaranteed_xp,
      avoidable_xp: budget.avoidable_xp,
      conditional_xp: budget.conditional_xp,
      peak_active_xp: budget.peak_active_xp,
      total_encounter_xp: budget.total_encounter_xp
    },
    participants: array(draft.participantGroups ?? draft.participant_groups).map(projectParticipant),
    hazards: array(draft.hazards).map(projectHazard),
    phases: array(draft.structuredPhases ?? draft.structured_phases ?? draft.phases).map(projectPhase),
    phase_budget: projectPhaseBudget(snapshot),
    readiness: { status: readiness.status, structural_error_count: readiness.structural_errors.length, design_warning_count: readiness.design_warnings.length },
    review_state: readiness.review_state,
    generation: state.generationRunID ? { id: state.generationRunID, state: firstDefined(draft.generation?.state) ?? null } : null,
    revisions: { encounter_revision: state.encounterRevision, constraints_revision: state.constraintsRevision }
  };
}

function capabilities(catalog) {
  const fixture = catalog?.fixture ?? {};
  return {
    product: "Sidekick DM",
    protocol_version: PROTOCOL_VERSION,
    webmcp_available: true,
    features: {
      custom_creatures: true,
      custom_simple_hazards: true,
      custom_complex_hazards: false,
      custom_spellcasting: false,
      alternative_resolutions: true,
      map_attachments: true
    },
    catalog: {
      fixture_version: optionalNumber(firstDefined(fixture.fixture_version, fixture.fixtureVersion)),
      party_level_focus: array(fixture.party_level_focus ?? fixture.partyLevelFocus)
    }
  };
}

function catalogFor(options) {
  if (typeof options.getCatalog === "function") return options.getCatalog();
  return options.catalog ?? null;
}

function catalogEntry(catalog, contentID) {
  if (!catalog || typeof catalog.get !== "function") throw Object.assign(new Error("The Sidekick DM Catalog is not available."), { code: "catalog_unavailable" });
  const entry = catalog.get(contentID);
  if (!entry) throw Object.assign(new Error("That Catalog Entry is not in the Catalog."), { code: "unknown_catalog_entry", details: { content_id: contentID } });
  return clone(entry);
}

function catalogEntryCommand(catalog, entry) {
  const fixture = catalog?.fixture ?? {};
  return {
    content_id: entry.content_id,
    ...(fixture.catalog_id ? { catalog_id: fixture.catalog_id } : {}),
    ...(fixture.source_revision ? { source_revision: fixture.source_revision } : {}),
    kind: entry.kind,
    name: entry.name,
    level: entry.level,
    completeness: entry.completeness,
    support: entry.support
  };
}

function searchCatalog(catalog, input) {
  if (!catalog || typeof catalog.search !== "function") throw Object.assign(new Error("The Sidekick DM Catalog is not available."), { code: "catalog_unavailable" });
  const result = clone(catalog.search(input));
  if (result && typeof result === "object" && "hasMore" in result && !("has_more" in result)) {
    result.has_more = Boolean(result.hasMore);
    delete result.hasMore;
  }
  return result;
}

function schemaTypeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validateSchemaValue(value, schema, path) {
  if (!schema) return;
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some(type => schemaTypeMatches(value, type))) throw Object.assign(new Error(`${path} has an invalid type.`), { code: "invalid_request", details: { field: path } });
  if (schema.minLength != null && typeof value === "string" && value.length < schema.minLength) throw Object.assign(new Error(`${path} is required.`), { code: "invalid_request", details: { field: path } });
  if (schema.minimum != null && typeof value === "number" && value < schema.minimum) throw Object.assign(new Error(`${path} is below the minimum.`), { code: "invalid_request", details: { field: path } });
  if (schema.maximum != null && typeof value === "number" && value > schema.maximum) throw Object.assign(new Error(`${path} is above the maximum.`), { code: "invalid_request", details: { field: path } });
  if (schema.enum && !schema.enum.includes(value)) throw Object.assign(new Error(`${path} has an unsupported value.`), { code: "invalid_request", details: { field: path } });
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => validateSchemaValue(item, schema.items, `${path}[${index}]`));
  if (schemaTypeMatches(value, "object") && schema.properties) {
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) throw Object.assign(new Error(`${path}.${key} is not supported.`), { code: "invalid_request", details: { field: `${path}.${key}` } });
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) throw Object.assign(new Error(`${path}.${required} is required.`), { code: "invalid_request", details: { field: required } });
    for (const [key, child] of Object.entries(schema.properties)) if (Object.hasOwn(value, key)) validateSchemaValue(value[key], child, `${path}.${key}`);
  }
}

const MUTATION_NAMES = new Set(TOOL_DEFINITIONS.filter(definition => !definition.readOnlyHint).map(definition => definition.name));
const AGENT_CONSTRAINT_MUTATIONS = new Set([...MUTATION_NAMES].filter(name => !new Set([`${TOOL_PREFIX}cancel_generation`, `${TOOL_PREFIX}apply_targeted_revision`, `${TOOL_PREFIX}undo`, `${TOOL_PREFIX}redo`]).has(name)));
const CONDITIONAL_RUN_MUTATIONS = new Set([...MUTATION_NAMES].filter(name => !new Set([`${TOOL_PREFIX}begin_generation`, `${TOOL_PREFIX}apply_targeted_revision`, `${TOOL_PREFIX}undo`, `${TOOL_PREFIX}redo`]).has(name)));

function validateToolInput(name, input) {
  const definition = TOOL_DEFINITIONS.find(item => item.name === name);
  if (!definition) throw Object.assign(new Error(`Unknown Sidekick DM tool: ${name}.`), { code: "unknown_tool" });
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Tool input must be an object."), { code: "invalid_request" });
  validateSchemaValue(input, definition.inputSchema, "input");
}

function validateMutationPreconditions(name, input, state) {
  if (!MUTATION_NAMES.has(name)) return;
  if (!Object.hasOwn(input, "encounter_id") || !Object.hasOwn(input, "expected_encounter_revision")) throw Object.assign(new Error("Mutations require encounter_id and expected_encounter_revision."), { code: "invalid_request" });
  checkEncounter(state, input);
  if (!Number.isInteger(input.expected_encounter_revision)) throw Object.assign(new Error("expected_encounter_revision must be an integer."), { code: "invalid_request" });
  if (AGENT_CONSTRAINT_MUTATIONS.has(name) && !Object.hasOwn(input, "expected_constraints_revision")) throw Object.assign(new Error("This mutation requires expected_constraints_revision."), { code: "invalid_request" });
  if (state.generationRunID && CONDITIONAL_RUN_MUTATIONS.has(name)) {
    if (!Object.hasOwn(input, "generation_run_id")) throw Object.assign(new Error("An active Generation Run requires generation_run_id."), { code: "invalid_request" });
    if (input.generation_run_id !== state.generationRunID) throw Object.assign(new Error("That Generation Run is no longer active."), { code: "wrong_generation_run", details: { current_generation_run_id: state.generationRunID } });
  }
}

function resolveContext(options) {
  if (options.modelContext !== undefined) return options.modelContext;
  return globalThis.navigator?.modelContext ?? globalThis.document?.modelContext ?? null;
}

async function disposeLifecycle(modelContext, lifecycle) {
  if (lifecycle.disposed) return;
  lifecycle.disposed = true;
  lifecycle.abortController?.abort();
  if (lifecycle.owner && lifecycle.ownerHandler && typeof lifecycle.owner.removeEventListener === "function") {
    lifecycle.owner.removeEventListener("pagehide", lifecycle.ownerHandler);
  }
  for (const handle of [...lifecycle.handles].reverse()) await disposeRegistrationHandle(handle);
  lifecycle.handles.length = 0;
  registrationLifecyclesByContext.delete(modelContext);
  registrationsByContext.delete(modelContext);
}

async function disposeRegistrationHandle(handle) {
  const dispose = typeof handle === "function" ? handle : handle?.unregister ?? handle?.dispose;
  if (typeof dispose === "function") {
    try { await dispose.call(handle); } catch { /* A dead registration is already disconnected. */ }
  }
}

export function toolDefinitions() {
  return TOOL_DEFINITIONS;
}

export function createWebMCPAdapter(options = {}) {
  const source = typeof options === "function" ? { execute: options } : options;
  const catalog = catalogFor(source);
  const getSnapshot = source.getSnapshot ?? (() => source.engine?.snapshot ?? source.snapshot);
  const commandExecutor = source.execute ?? (typeof source.engine?.execute === "function" ? source.engine.execute.bind(source.engine) : null);

  async function readState() {
    return unwrap(typeof getSnapshot === "function" ? await getSnapshot() : getSnapshot);
  }

  async function executeMutation(command, project = (state) => ({ encounter: projectSummary(state.snapshot, requireDraft(state), state) })) {
    if (typeof commandExecutor !== "function") throw Object.assign(new Error("The Sidekick DM mutation boundary is unavailable."), { code: "invalid_request" });
    const result = await commandExecutor({ ...command, origin: "webmcp" });
    const next = unwrap(result);
    if (!result?.ok) return envelope(next, undefined, errorPayload(result));
    if (source.engine && result.snapshot) source.engine.snapshot = result.snapshot;
    if (typeof source.onMutation === "function") await source.onMutation(requireDraft(next), result);
    return envelope(next, project(next, result));
  }

  function mutationCommand(name, input, additions = {}) {
    return { ...input, ...additions, command: name };
  }

  async function execute(name, input = {}, signal) {
    let state;
    try {
      state = await readState();
    } catch (error) {
      return envelope(unwrap(null), undefined, errorPayload(error));
    }
    try {
      if (signal?.aborted) throw Object.assign(new Error("The WebMCP registration is no longer active."), { code: "invalid_request" });
      validateToolInput(name, input);
      validateMutationPreconditions(name, input, state);
      switch (name) {
        case `${TOOL_PREFIX}get_capabilities`:
          return envelope(state, capabilities(catalog));
        case `${TOOL_PREFIX}get_encounter_summary`:
          checkEncounter(state, input);
          return envelope(state, projectSummary(state.snapshot, requireDraft(state), state));
        case `${TOOL_PREFIX}get_encounter_brief`:
          return envelope(state, projectBrief(requireDraft(state)));
        case `${TOOL_PREFIX}get_brief_checklist`:
          return envelope(state, projectChecklist(requireDraft(state)));
        case `${TOOL_PREFIX}get_budget`:
          return envelope(state, projectBudget(state.snapshot));
        case `${TOOL_PREFIX}get_readiness`:
          return envelope(state, projectReadiness(state.snapshot, requireDraft(state)));
        case `${TOOL_PREFIX}get_encounter_packet`:
          checkEncounter(state, input);
          return envelope(state, projectPacket(requireDraft(state), input));
        case `${TOOL_PREFIX}get_component`:
          checkEncounter(state, input);
          return envelope(state, projectComponent(requireDraft(state), text(input.component_id)));
        case `${TOOL_PREFIX}search_catalog`:
          return envelope(state, searchCatalog(catalog, input));
        case `${TOOL_PREFIX}get_catalog_entry`: {
          const contentID = text(input.content_id);
          if (!contentID) throw Object.assign(new Error("A Catalog ContentID is required."), { code: "invalid_request" });
          return envelope(state, catalogEntry(catalog, contentID));
        }
        case `${TOOL_PREFIX}get_creature_benchmarks`:
          return envelope(state, projectCreatureBenchmarks(input));
        case `${TOOL_PREFIX}get_hazard_benchmarks`:
          return envelope(state, projectHazardBenchmarks(input));
        case `${TOOL_PREFIX}preflight_generation`:
          checkEncounter(state, input);
          return envelope(state, projectPreflight(state.snapshot, requireDraft(state), input));
        case `${TOOL_PREFIX}begin_generation`:
          return await executeMutation(mutationCommand(name, input), next => ({ generation_run_id: next.generationRunID, opening_revision: state.encounterRevision, readiness: projectReadiness(next.snapshot, requireDraft(next)) }));
        case `${TOOL_PREFIX}add_existing_participant_group`: {
          const entry = catalogEntry(catalog, text(input.content_id));
          return await executeMutation(mutationCommand(name, input, { catalog_entry: catalogEntryCommand(catalog, entry), name: entry.name, level: entry.level }));
        }
        case `${TOOL_PREFIX}fork_existing_creature`: {
          const creature = forkExistingCreature(catalogEntry(catalog, text(input.content_id)), { id: input.id ?? null, origin: "webmcp" });
          return envelope(state, { creature, validation: validateCustomCreature(creature) });
        }
        case `${TOOL_PREFIX}validate_custom_creature`:
          return envelope(state, validateCustomCreature(keysToCamel(input.creature)));
        case `${TOOL_PREFIX}create_custom_creature`: {
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          return await executeMutation(mutationCommand(name, { ...input, creature }));
        }
        case `${TOOL_PREFIX}update_creature`:
        case `${TOOL_PREFIX}update_custom_creature`: {
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          return await executeMutation(mutationCommand(name, { ...input, creature }));
        }
        case `${TOOL_PREFIX}upsert_npc_profile`:
          return await executeMutation(mutationCommand(name, input, { profile: keysToSnake(input.profile) }));
        case `${TOOL_PREFIX}add_existing_hazard`: {
          const entry = catalogEntry(catalog, text(input.content_id));
          return await executeMutation(mutationCommand(name, input, {
            catalog_entry: catalogEntryCommand(catalog, entry),
            name: entry.name,
            level: entry.level,
            complexity: entry.hazard_complexity ?? "simple"
          }));
        }
        case `${TOOL_PREFIX}validate_simple_hazard`:
          return envelope(state, validateSimpleHazard(keysToCamel(input.hazard)));
        case `${TOOL_PREFIX}create_simple_hazard`: {
          const hazard = createSimpleHazard(keysToCamel(input.hazard));
          return await executeMutation(mutationCommand(name, { ...input, hazard }));
        }
        case `${TOOL_PREFIX}update_hazard`: {
          const hazard = createSimpleHazard(keysToCamel(input.hazard));
          return await executeMutation(mutationCommand(name, { ...input, hazard }));
        }
        case `${TOOL_PREFIX}apply_targeted_revision`: {
          const section = text(input.section);
          const value = keysToCamel(input.value);
          return await executeMutation(mutationCommand(name, { ...input, value }, { target_command: `${TOOL_PREFIX}set_${section}` }));
        }
        case `${TOOL_PREFIX}remove_component`:
          return await executeMutation(mutationCommand(name, input));
        case `${TOOL_PREFIX}set_generation_assumptions`:
          return await executeMutation(mutationCommand(name, input, { assumptions: array(input.assumptions) }));
        case `${TOOL_PREFIX}update_creative_brief`: {
          const changes = Object.fromEntries(Object.entries(input).filter(([key]) => !["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_brief_revision", "expected_constraints_revision"].includes(key)));
          return await executeMutation(mutationCommand(name, { ...input, changes }));
        }
        case `${TOOL_PREFIX}upsert_phase`:
          return await executeMutation(mutationCommand(name, { ...input, phase: keysToCamel(input.phase) }));
        case `${TOOL_PREFIX}set_encounter_identity`:
        case `${TOOL_PREFIX}set_setup`:
        case `${TOOL_PREFIX}set_battlefield_guidance`:
        case `${TOOL_PREFIX}set_running_guidance`:
        case `${TOOL_PREFIX}set_cohesion`:
        case `${TOOL_PREFIX}set_information_visibility`:
        case `${TOOL_PREFIX}set_outcomes`:
          return await executeMutation(mutationCommand(name, { ...input, value: keysToCamel(input.value) }));
        case `${TOOL_PREFIX}set_reward_guidance`:
          return await executeMutation(mutationCommand(name, { ...input, value: input.value }));
        case `${TOOL_PREFIX}set_alternative_resolutions`:
          return await executeMutation(mutationCommand(name, { ...input, value: keysToCamel(input.value) }));
        case `${TOOL_PREFIX}finish_generation`:
        case `${TOOL_PREFIX}cancel_generation`:
        case `${TOOL_PREFIX}undo`:
        case `${TOOL_PREFIX}redo`:
          return await executeMutation(mutationCommand(name, input));
        default:
          throw Object.assign(new Error(`Unknown Sidekick DM tool: ${name}.`), { code: "unknown_tool" });
      }
    } catch (error) {
      return envelope(state, undefined, errorPayload(error));
    }
  }

  async function register() {
    const modelContext = resolveContext(source);
    if (!modelContext) return { available: false, label: "WebMCP unavailable in this browser" };
    const registerTool = modelContext.registerTool ?? modelContext.addTool;
    if (typeof registerTool !== "function") return { available: false, label: "WebMCP detected · adapter pending" };
    const existing = registrationsByContext.get(modelContext);
    if (existing) return existing;
    const lifecycle = {
      abortController: typeof AbortController === "function" ? new AbortController() : null,
      handles: [],
      owner: source.registrationOwner ?? (source.modelContext === undefined ? globalThis.document : null),
      ownerHandler: null,
      disposed: false
    };
    registrationLifecyclesByContext.set(modelContext, lifecycle);
    const registration = (async () => {
      try {
        if (lifecycle.owner && typeof lifecycle.owner.addEventListener === "function") {
          lifecycle.ownerHandler = () => { void unregister(); };
          lifecycle.owner.addEventListener("pagehide", lifecycle.ownerHandler, { once: true });
        }
        for (const definition of TOOL_DEFINITIONS) {
          if (lifecycle.disposed) break;
          const handle = await registerTool.call(modelContext, {
            ...definition,
            execute: (input, signal) => execute(definition.name, input, signal ?? lifecycle.abortController?.signal),
            signal: lifecycle.abortController?.signal
          });
          if (handle && lifecycle.disposed) await disposeRegistrationHandle(handle);
          else if (handle) lifecycle.handles.push(handle);
        }
        return lifecycle.disposed ? { available: false, label: "WebMCP disconnected" } : { available: true, label: "WebMCP connected" };
      } catch (error) {
        await disposeLifecycle(modelContext, lifecycle);
        console.warn("Sidekick DM could not register WebMCP tools", error);
        return { available: false, label: "WebMCP unavailable · human mode active" };
      }
    })();
    registrationsByContext.set(modelContext, registration);
    void registration.then(result => {
      if (!result.available && registrationsByContext.get(modelContext) === registration) registrationsByContext.delete(modelContext);
    });
    return registration;
  }

  async function unregister() {
    const modelContext = resolveContext(source);
    const lifecycle = modelContext && registrationLifecyclesByContext.get(modelContext);
    if (!lifecycle) return { available: false, label: "WebMCP not registered" };
    await disposeLifecycle(modelContext, lifecycle);
    return { available: false, label: "WebMCP disconnected" };
  }

  return Object.freeze({ execute, register, unregister, dispose: unregister, toolDefinitions: () => TOOL_DEFINITIONS });
}

export async function registerWebMCP(options = {}) {
  return createWebMCPAdapter(options).register();
}

export const createReadDispatcher = createWebMCPAdapter;
