/*
 * Sidekick DM's browser-only WebMCP adapter.
 *
 * The adapter deliberately depends on projections supplied by the host. It
 * does not know how the Swift/Wasm engine stores or mutates an Encounter.
 */

import { commitCustomCreature, forkExistingCreature, validateCustomCreature } from "./creature-generation.js";
import { createSimpleHazard, hazardBenchmarks, validateSimpleHazard } from "./hazard-builder.js";
import { benchmarkFor, CREATURE_ROADMAPS, recommendedBands, createEmptyOriginalCreature } from "./creature-builder.js";
import { projectRunSession } from "./run-session.js";
import { projectEncounterParticipantSummary } from "./encounter-summary.js";

export const PROTOCOL_VERSION = 1;
export const TOOL_PREFIX = "sidekickdm_";
export const REQUIRED_NATIVE_COMMANDS = Object.freeze([
  "sidekickdm_add_hazard", "sidekickdm_add_existing_hazard", "sidekickdm_add_participant_group",
  "sidekickdm_add_existing_participant_group", "sidekickdm_apply_generation_step", "sidekickdm_begin_generation",
  "sidekickdm_cancel_generation", "sidekickdm_create_custom_creature", "sidekickdm_create_simple_hazard",
  "sidekickdm_finish_generation", "sidekickdm_remove_component", "sidekickdm_resume_generation",
  "sidekickdm_set_alternative_resolutions", "sidekickdm_set_battlefield_guidance", "sidekickdm_set_cohesion",
  "sidekickdm_set_encounter_identity", "sidekickdm_set_encounter_packet", "sidekickdm_set_generation_assumptions",
  "sidekickdm_set_information_visibility", "sidekickdm_set_outcomes", "sidekickdm_set_party_snapshot",
  "sidekickdm_set_reward_guidance", "sidekickdm_set_running_guidance", "sidekickdm_set_setup",
  "sidekickdm_set_threat_target", "sidekickdm_undo", "sidekickdm_update_creative_brief", "sidekickdm_update_creature",
  "sidekickdm_update_custom_creature", "sidekickdm_update_hazard", "sidekickdm_update_participant_group",
  "sidekickdm_upsert_npc_profile", "sidekickdm_upsert_phase", "sidekickdm_redo"
]);

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

const statisticSchema = Object.freeze({ type: ["object", "null"], properties: { band: { type: "string" }, value: { type: "number" } }, required: ["band", "value"], additionalProperties: false });
const statisticReference = Object.freeze({ $ref: "#/$defs/statistic" });
const creatureSchema = Object.freeze({
  type: "object",
  properties: {
    object_version: { type: "integer", minimum: 1 }, id: { type: "string", minLength: 1 }, revision: { type: "integer", minimum: 0 },
    identity: { type: "object", properties: { name: { type: "string", minLength: 1 }, level: { type: "integer", minimum: -1, maximum: 20 }, rarity: { type: "string" }, size: { type: "string" }, traits: { type: "array", items: { type: "string" } }, concept: { type: "string" }, roadmap: { type: ["string", "null"], enum: [...CREATURE_ROADMAPS, null] }, encounter_role: { type: "string" } }, required: ["name", "level", "traits", "concept"], additionalProperties: true },
    perception: statisticReference,
    senses: { type: "array", items: { type: "string" } }, languages: { type: "array", items: { type: "string" } }, skills: { type: "object", additionalProperties: { type: "number" } },
    defenses: { type: "object", properties: { ac: statisticReference, fortitude: statisticReference, reflex: statisticReference, will: statisticReference, hp: statisticReference, immunities: { type: "array", items: { type: "string" } }, weaknesses: { type: "array", items: { type: "string" } }, resistances: { type: "array", items: { type: "string" } } }, required: ["ac", "fortitude", "reflex", "will", "hp"], additionalProperties: true },
    speeds: { type: "object", additionalProperties: { type: "number" } }, strikes: { type: "array", items: { type: "object", additionalProperties: true } }, abilities: { type: "array", items: { type: "object", additionalProperties: true } },
    spellcasting_status: { type: "string" }, spellcasting_blocks: { type: "array", items: { type: "object", additionalProperties: true } }, tactics: { type: "string" }, morale: { type: "string" }, provenance: { type: "object", additionalProperties: true }
  },
  required: ["id", "identity", "defenses", "strikes", "abilities"],
  additionalProperties: true
});

const participationSchema = Object.freeze({
  type: "object",
  properties: {
    mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] },
    condition: { type: ["string", "null"] }
  },
  additionalProperties: false
});

const participantCompositionSchema = Object.freeze({
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 },
    content_id: { type: "string", minLength: 1 },
    catalog_entry: freeformObject,
    creature: creatureSchema,
    name: { type: "string", minLength: 1 },
    level: { type: "integer", minimum: -1, maximum: 20 },
    quantity: { type: "integer", minimum: 1 },
    adjustment: { type: "string", enum: ["weak", "normal", "elite"] },
    faction: { type: "string", enum: ["party", "primary_opposition", "secondary_opposition", "allied", "neutral"] },
    participation: participationSchema,
    participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] },
    participation_condition: { type: "string" },
    encounter_role: { type: "string", enum: ["brute", "defender", "skirmisher", "sniper", "controller", "support", "ambusher", "leader", "solo_boss"] },
    narrative_tier: { type: "string", enum: ["incidental", "supporting", "prominent"] },
    display_name: { type: "string" },
    starting_area: { type: "string" },
    shared_tactics: { type: "string" },
    morale: { type: "string" }
  },
  additionalProperties: false
});

const hazardCompositionSchema = Object.freeze({
  type: "object",
  properties: {
    id: { type: "string", minLength: 1 }, content_id: { type: "string", minLength: 1 }, catalog_entry: freeformObject, hazard: freeformObject,
    complexity: { type: "string", enum: ["simple", "complex"] }, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" }
  },
  additionalProperties: false
});

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
  properties: { level: { type: "integer", minimum: -1, maximum: 20 }, statistics: { type: "array", items: { type: "string" } }, role: { type: "string", enum: CREATURE_ROADMAPS } },
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
    queries: { type: "array", items: { type: "string", minLength: 1 }, minItems: 1, maxItems: 12 },
    match_mode: { type: "string", enum: ["all", "any"] },
    party_level: { type: "integer", minimum: -1, maximum: 30 },
    remaining_xp: { type: "integer", minimum: 0 },
    include_budget: { type: "boolean" },
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

const planEncounterInput = Object.freeze({
  type: "object",
  properties: { encounter_id: { type: "string", minLength: 1 }, concepts: { type: "array", items: { type: "string", minLength: 1 }, maxItems: 12 }, candidate_count: { type: "integer", minimum: 1, maximum: 12 }, include_hazards: { type: "boolean" } },
  required: ["encounter_id"], additionalProperties: false
});

const draftCreatureInput = Object.freeze({
  type: "object",
  properties: { name: { type: "string", minLength: 1 }, level: { type: "integer", minimum: -1, maximum: 20 }, concept: { type: "string", minLength: 1 }, role: { type: "string", enum: CREATURE_ROADMAPS }, traits: { type: "array", items: { type: "string" } } },
  required: ["name", "level", "concept", "role"], additionalProperties: false
});

const catalogEntryInput = Object.freeze({
  type: "object",
  properties: {
    content_id: { type: "string", minLength: 1, description: "Stable Catalog ContentID." }
  },
  required: ["content_id"],
  additionalProperties: false
});

const libraryInput = Object.freeze({
  type: "object",
  properties: { kind: { type: "string", enum: ["encounters", "creatures"] } },
  additionalProperties: false
});

const runInput = Object.freeze({
  type: "object",
  properties: { run_id: { type: "string", minLength: 1 } },
  required: ["run_id"],
  additionalProperties: false
});

const runMutationProperties = Object.freeze({
  run_id: { type: "string", minLength: 1 },
  expected_run_revision: { type: "integer", minimum: 0 },
  combatant_id: { type: "string", minLength: 1 }
});

const revisionProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  generation_run_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 },
  expected_brief_revision: { type: "integer", minimum: 0 },
  expected_constraints_revision: { type: "integer", minimum: 0 }
});

const packetSectionSchemas = Object.freeze({
  encounter_identity: { type: "object", properties: { title: { type: "string" }, premise: { type: "string" }, objective: { type: "string" }, stakes: { type: "string" } }, required: ["title", "premise", "objective", "stakes"], additionalProperties: false },
  setup: { type: "object", properties: { trigger: { type: "string" }, battlefield_description: { type: "string" }, starting_positions: { type: "string" }, awareness_state: { type: "string" }, immediate_features: { type: "array", items: { type: "string" } }, read_aloud: { type: ["string", "null"], default: null } }, required: ["trigger", "battlefield_description", "starting_positions", "awareness_state", "immediate_features"], additionalProperties: false },
  battlefield_guidance: { type: "object", properties: { dimensions: { type: "string", default: "" }, zones: { type: "array", items: { type: "string" }, default: [] }, elevations: { type: "array", items: { type: "string" }, default: [] }, cover: { type: "array", items: { type: "string" }, default: [] }, concealment: { type: "array", items: { type: "string" }, default: [] }, difficult_terrain: { type: "array", items: { type: "string" }, default: [] }, entry_points: { type: "array", items: { type: "string" }, default: [] }, escape_routes: { type: "array", items: { type: "string" }, default: [] }, interactive_objects: { type: "array", items: { type: "string" }, default: [] }, hazard_placement: { type: "array", items: { type: "string" }, default: [] }, recommended_distances: { type: "array", items: { type: "string" }, default: [] }, map_generation_prompt: { type: ["string", "null"], default: null }, attachment_id: { type: ["string", "null"], default: null } }, additionalProperties: false },
  running_guidance: { type: "object", properties: { participant_roles: { type: "string" }, opening_tactics: { type: "string" }, ongoing_tactics: { type: "string" }, coordination_conflict: { type: "string" }, triggers_reinforcements: { type: "string" }, morale_summary: { type: "string" }, adjudication_issues: { type: "array", items: { type: "string" }, default: [] } }, required: ["participant_roles", "opening_tactics", "ongoing_tactics", "coordination_conflict", "triggers_reinforcements", "morale_summary"], additionalProperties: false },
  cohesion: { type: "object", properties: { theme: { type: "string", default: "" }, participant_presence: { type: "string" }, relationships: { type: "string" }, hazard_terrain_fit: { type: "string" } }, required: ["participant_presence", "relationships", "hazard_terrain_fit"], additionalProperties: false },
  information_visibility: { type: "object", properties: { immediately_apparent: { type: "array", items: { type: "string" }, default: [] }, discoverable: { type: "array", items: { type: "string" }, default: [] }, gm_secret: { type: "array", items: { type: "string" }, default: [] } }, additionalProperties: false },
  outcomes: { type: "object", properties: { victory: { type: "string" }, partial_success: { type: ["string", "null"], default: null }, failure: { type: ["string", "null"], default: null }, party_retreat: { type: ["string", "null"], default: null }, enemy_surrender: { type: ["string", "null"], default: null }, enemy_escape: { type: ["string", "null"], default: null }, long_term_consequence: { type: ["string", "null"], default: null } }, required: ["victory"], additionalProperties: false }
});

const generationStepSectionSchemas = Object.freeze({
  ...packetSectionSchemas,
  reward_guidance: { type: ["string", "null"] },
  alternative_resolutions: { type: "array", items: freeformObject }
});

const packetSectionDefaults = Object.freeze({
  encounter_identity: {},
  setup: { read_aloud: null },
  battlefield_guidance: { dimensions: "", zones: [], elevations: [], cover: [], concealment: [], difficult_terrain: [], entry_points: [], escape_routes: [], interactive_objects: [], hazard_placement: [], recommended_distances: [], map_generation_prompt: null, attachment_id: null },
  running_guidance: { adjudication_issues: [] },
  cohesion: { theme: "" },
  information_visibility: { immediately_apparent: [], discoverable: [], gm_secret: [] },
  outcomes: { partial_success: null, failure: null, party_retreat: null, enemy_surrender: null, enemy_escape: null, long_term_consequence: null },
  reward_guidance: null,
  alternative_resolutions: []
});

const generationStepInput = Object.freeze({
  type: "object",
  properties: {
    ...revisionProperties,
    step: { type: "string", enum: ["composition", "guidance"] },
    participants: { type: "array", items: participantCompositionSchema, maxItems: 20 },
    hazards: { type: "array", items: hazardCompositionSchema, maxItems: 20 },
    sections: { type: "object", properties: Object.fromEntries(Object.entries(generationStepSectionSchemas).map(([name, schema]) => [name, schema])), additionalProperties: false }
  },
  required: ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "step"],
  additionalProperties: false
});

const generationMutationRequired = (fields) => ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", ...fields];

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
  ...revisionProperties,
  assumptions: { type: "array", items: { type: "string" } }
});

const createEncounterProperties = Object.freeze({
  title: { type: "string", minLength: 1 },
  effective_level: { type: "integer", minimum: 1, maximum: 20 },
  size: { type: "integer", minimum: 1, maximum: 8 },
  kind: { type: "string", enum: ["trivial", "low", "moderate", "severe", "extreme", "custom"] },
  custom_xp: { type: ["integer", "null"], minimum: 0 }
});

const partySnapshotProperties = Object.freeze({
  encounter_id: revisionProperties.encounter_id,
  expected_encounter_revision: revisionProperties.expected_encounter_revision,
  effective_level: { type: "integer", minimum: 1, maximum: 20 },
  size: { type: "integer", minimum: 1, maximum: 8 }
});

const threatTargetProperties = Object.freeze({
  encounter_id: revisionProperties.encounter_id,
  expected_encounter_revision: revisionProperties.expected_encounter_revision,
  kind: { type: "string", enum: ["trivial", "low", "moderate", "severe", "extreme", "custom"] },
  custom_xp: { type: ["integer", "null"], minimum: 0 }
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
  openWorldHint: false
});

const untrustedAnnotations = Object.freeze({
  ...readAnnotations,
  untrustedContentHint: true
});

function containsStatisticReference(schema, visited = new Set()) {
  if (!schema || typeof schema !== "object" || visited.has(schema)) return false;
  if (schema === statisticReference) return true;
  visited.add(schema);
  return Object.values(schema).some(value => containsStatisticReference(value, visited));
}

function publishInputSchema(schema) {
  if (!containsStatisticReference(schema)) return schema;
  return Object.freeze({ ...schema, $defs: Object.freeze({ statistic: statisticSchema }) });
}

function definition(name, description, inputSchema, { untrusted = false } = {}) {
  const annotations = untrusted ? untrustedAnnotations : readAnnotations;
  return Object.freeze({
    name,
    description,
    inputSchema: publishInputSchema(inputSchema),
    // WebMCP implementations in the wild have exposed these hints both on
    // the definition and under annotations. Keep both forms for detection.
    readOnlyHint: true,
    untrustedContentHint: untrusted,
    annotations
  });
}

function writeDefinition(name, description, properties, required = [], { destructive = false } = {}) {
  return Object.freeze({
    name,
    description,
    inputSchema: publishInputSchema({ type: "object", properties, required, additionalProperties: false }),
    readOnlyHint: false,
    untrustedContentHint: true,
    annotations: { readOnlyHint: false, destructiveHint: destructive, openWorldHint: false, untrustedContentHint: true }
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
  definition(`${TOOL_PREFIX}get_encounter_packet`, "Read the DM-facing Encounter Packet projection, optionally limited to named sections.", packetInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_component`, "Read one Encounter component by ID without exposing engine serialization.", componentInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}get_creature_benchmarks`, "Read the official-style Creature Builder benchmark bands for a level.", creatureBenchmarkInput),
  definition(`${TOOL_PREFIX}get_hazard_benchmarks`, "Read the official-style Hazard Builder benchmark bands for a level and complexity.", hazardBenchmarkInput),
  definition(`${TOOL_PREFIX}preflight_generation`, "Estimate a Generation Run outline without mutating the Encounter Draft.", preflightInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}plan_encounter`, "Plan opposition options against the active brief and budget without changing the Encounter Draft.", planEncounterInput, { untrusted: true }),
  definition(`${TOOL_PREFIX}draft_custom_creature`, "Draft a complete benchmarked custom Creature without changing the Encounter Draft.", draftCreatureInput, { untrusted: true })
  ,definition(`${TOOL_PREFIX}list_library`, "List saved encounters or custom creatures in the Sidekick library.", libraryInput, { untrusted: true })
  ,definition(`${TOOL_PREFIX}get_run_state`, "Read the active live encounter state, combatants, initiative, HP, conditions, and recent rolls.", runInput, { untrusted: true })
]);

const WRITE_TOOL_DEFINITIONS = Object.freeze([
  writeDefinition(`${TOOL_PREFIX}create_encounter`, "Create a new Encounter Draft with its Party Snapshot and Threat Target before beginning generation.", createEncounterProperties, ["title", "effective_level", "size", "kind"], { destructive: true }),
  writeDefinition(`${TOOL_PREFIX}set_party_snapshot`, "Set the DM-confirmed effective party level and size before beginning generation.", partySnapshotProperties, ["encounter_id", "expected_encounter_revision", "effective_level", "size"]),
  writeDefinition(`${TOOL_PREFIX}set_threat_target`, "Set the DM-confirmed Threat Target before beginning generation.", threatTargetProperties, ["encounter_id", "expected_encounter_revision", "kind"]),
  writeDefinition(`${TOOL_PREFIX}begin_generation`, "Begin a revision-checked Generation Run after acknowledging DM-owned Content Boundaries.", { ...revisionProperties, content_boundaries_acknowledged: { type: "boolean" }, intent_summary: { type: "string" } }, ["encounter_id", "expected_encounter_revision", "expected_brief_revision", "expected_constraints_revision", "content_boundaries_acknowledged"]),
  writeDefinition(`${TOOL_PREFIX}add_existing_participant_group`, "Add one complete supported Catalog Creature during an active Generation Run. Pass the generation_run_id returned by sidekickdm_begin_generation.", { ...revisionProperties, content_id: { type: "string", minLength: 1 }, quantity: { type: "integer", minimum: 1 }, adjustment: { type: "string", enum: ["weak", "normal", "elite"] }, faction: { type: "string", enum: ["party", "primary_opposition", "secondary_opposition", "allied", "neutral"] }, participation: { type: "object", properties: { mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, condition: { type: ["string", "null"] } }, additionalProperties: false }, encounter_role: { type: "string", enum: ["brute", "defender", "skirmisher", "sniper", "controller", "support", "ambusher", "leader", "solo_boss"] }, narrative_tier: { type: "string", enum: ["incidental", "supporting", "prominent"] }, display_name: { type: "string" }, starting_area: { type: "string" }, shared_tactics: { type: "string" }, morale: { type: "string" } }, generationMutationRequired(["content_id"])),
  writeDefinition(`${TOOL_PREFIX}apply_generation_step`, "Apply one validated composition or guidance step as a single Generation Run mutation.", generationStepInput.properties, generationStepInput.required),
  definition(`${TOOL_PREFIX}fork_existing_creature`, "Create a detached Forked Creature draft from a complete supported Catalog Creature while preserving existing spellcasting blocks.", { type: "object", properties: { content_id: { type: "string", minLength: 1 }, id: { type: "string" } }, required: ["content_id"], additionalProperties: false }, { untrusted: true }),
  definition(`${TOOL_PREFIX}validate_custom_creature`, "Validate an Original or Forked Creature without mutating the Encounter.", { type: "object", properties: { creature: creatureSchema }, required: ["creature"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_custom_creature`, "Validate, embed, and place an Original or Forked Creature atomically.", { ...revisionProperties, creature: creatureSchema, quantity: { type: "integer", minimum: 1 }, starting_area: { type: "string" } }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}update_creature`, "Validate and replace an encounter-embedded Original or Forked Creature and update its Participant Group projection atomically.", { ...revisionProperties, creature: creatureSchema }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}update_custom_creature`, "Backward-compatible alias for update_creature.", { ...revisionProperties, creature: creatureSchema }, generationMutationRequired(["creature"])),
  writeDefinition(`${TOOL_PREFIX}upsert_npc_profile`, "Create or update one validated NPC Profile associated with an encounter Participant Group.", { ...revisionProperties, profile: freeformObject }, generationMutationRequired(["profile"])),
  writeDefinition(`${TOOL_PREFIX}add_existing_hazard`, "Add one complete supported Catalog Hazard during an active Generation Run. Pass the generation_run_id returned by sidekickdm_begin_generation.", { ...revisionProperties, content_id: { type: "string", minLength: 1 }, id: { type: "string", minLength: 1 }, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" }, phase_id: { type: "string", minLength: 1 }, phase_ids: { type: "array", items: { type: "string", minLength: 1 } } }, generationMutationRequired(["content_id"])),
  definition(`${TOOL_PREFIX}validate_simple_hazard`, "Validate a custom Simple Hazard without mutating the Encounter.", { type: "object", properties: { hazard: freeformObject }, required: ["hazard"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_simple_hazard`, "Validate, embed, and place a custom Simple Hazard atomically.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, generationMutationRequired(["hazard"])),
  writeDefinition(`${TOOL_PREFIX}update_hazard`, "Update an encounter-embedded custom Simple Hazard and its participation or placement.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, generationMutationRequired(["hazard"])),
  writeDefinition(`${TOOL_PREFIX}remove_component`, "Remove an encounter placement without deleting reusable library records.", { ...revisionProperties, component_id: { type: "string", minLength: 1 } }, generationMutationRequired(["component_id"])),
  writeDefinition(`${TOOL_PREFIX}upsert_phase`, "Validate and add or replace one structured Encounter Phase.", { ...revisionProperties, phase: freeformObject }, generationMutationRequired(["phase"])),
  ...Object.entries(packetSectionSchemas).map(([section, schema]) => writeDefinition(`${TOOL_PREFIX}set_${section}`, `Set the semantic Encounter Packet ${section.replaceAll("_", " ")} section during an active Generation Run. Pass the generation_run_id returned by sidekickdm_begin_generation.`, { ...revisionProperties, value: schema }, generationMutationRequired(["value"]))),
  writeDefinition(`${TOOL_PREFIX}finish_generation`, "Finish a structurally complete Generation Run and preserve Design Warnings for review.", { ...revisionProperties, completion_note: { type: "string" } }, generationMutationRequired([])),
  writeDefinition(`${TOOL_PREFIX}resume_generation`, "Explicitly resume a Generation Run that reload marked interrupted.", revisionProperties, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision"]),
  writeDefinition(`${TOOL_PREFIX}cancel_generation`, "Cancel a Generation Run and restore its opening Encounter state.", cancelGenerationProperties, ["encounter_id", "generation_run_id", "expected_encounter_revision"]),
  writeDefinition(`${TOOL_PREFIX}apply_targeted_revision`, "Apply one named agent-authored revision after a Generation Run; undo restores the finished run first, then the opening Encounter.", targetedRevisionProperties, ["encounter_id", "expected_encounter_revision", "section", "value"]),
  writeDefinition(`${TOOL_PREFIX}set_generation_assumptions`, "Record concise assumptions for omitted optional Brief fields during a Generation Run.", assumptionsProperties, generationMutationRequired(["assumptions"])),
  writeDefinition(`${TOOL_PREFIX}update_creative_brief`, "Update agent-editable creative Brief fields during an active Generation Run without changing Party Snapshot or Content Boundaries.", creativeBriefProperties, generationMutationRequired([])),
  writeDefinition(`${TOOL_PREFIX}set_reward_guidance`, "Set optional narrative reward guidance in the Encounter Packet during an active Generation Run.", { ...revisionProperties, value: { type: ["string", "null"] } }, generationMutationRequired(["value"])),
  writeDefinition(`${TOOL_PREFIX}set_alternative_resolutions`, "Set optional structured Alternative Resolutions in the Encounter Packet during an active Generation Run.", { ...revisionProperties, value: { type: "array", items: freeformObject } }, generationMutationRequired(["value"])),
  writeDefinition(`${TOOL_PREFIX}undo`, "Undo the most recent authored mutation or complete finished Generation Run.", { encounter_id: revisionProperties.encounter_id, expected_encounter_revision: revisionProperties.expected_encounter_revision }, ["encounter_id", "expected_encounter_revision"]),
  writeDefinition(`${TOOL_PREFIX}redo`, "Redo the most recently undone mutation.", { encounter_id: revisionProperties.encounter_id, expected_encounter_revision: revisionProperties.expected_encounter_revision }, ["encounter_id", "expected_encounter_revision"])
  ,writeDefinition(`${TOOL_PREFIX}save_custom_creature`, "Validate and save a creature to the reusable custom creature library without adding it to an encounter.", { creature: creatureSchema }, ["creature"])
  ,writeDefinition(`${TOOL_PREFIX}save_encounter`, "Save the active Encounter Draft to the encounter library.", { encounter_id: { type: "string", minLength: 1 } }, ["encounter_id"])
  ,writeDefinition(`${TOOL_PREFIX}start_run`, "Start or resume live encounter tracking for the active Encounter.", { encounter_id: { type: "string", minLength: 1 } }, ["encounter_id"])
  ,writeDefinition(`${TOOL_PREFIX}set_initiative`, "Set one combatant's initiative in the active live encounter.", { ...runMutationProperties, value: { type: "integer" } }, ["run_id", "expected_run_revision", "combatant_id", "value"])
  ,writeDefinition(`${TOOL_PREFIX}advance_turn`, "Advance to the next combatant and increment the round after the final turn.", { run_id: runMutationProperties.run_id, expected_run_revision: runMutationProperties.expected_run_revision }, ["run_id", "expected_run_revision"])
  ,writeDefinition(`${TOOL_PREFIX}apply_damage`, "Apply damage to one live combatant without changing its library or Encounter statistics.", { ...runMutationProperties, amount: { type: "integer", minimum: 0 } }, ["run_id", "expected_run_revision", "combatant_id", "amount"])
  ,writeDefinition(`${TOOL_PREFIX}apply_healing`, "Apply healing to one live combatant, capped at its maximum HP.", { ...runMutationProperties, amount: { type: "integer", minimum: 0 } }, ["run_id", "expected_run_revision", "combatant_id", "amount"])
  ,writeDefinition(`${TOOL_PREFIX}add_condition`, "Add or update a named condition on one live combatant.", { ...runMutationProperties, name: { type: "string", minLength: 1 }, value: { type: ["integer", "null"], minimum: 0 } }, ["run_id", "expected_run_revision", "combatant_id", "name"])
  ,writeDefinition(`${TOOL_PREFIX}remove_condition`, "Remove a named condition from one live combatant.", { ...runMutationProperties, name: { type: "string", minLength: 1 } }, ["run_id", "expected_run_revision", "combatant_id", "name"])
  ,writeDefinition(`${TOOL_PREFIX}roll`, "Roll a supported dice expression and append the result to the live encounter log.", { ...runMutationProperties, label: { type: "string", minLength: 1 }, expression: { type: "string", minLength: 2 } }, ["run_id", "expected_run_revision", "label", "expression"])
]);

const TOOL_DEFINITIONS = Object.freeze([...READ_TOOL_DEFINITIONS, ...WRITE_TOOL_DEFINITIONS]);

const RECOVERY = Object.freeze({
  unknown_encounter: "Read the active Encounter Draft again before retrying.",
  unknown_catalog_entry: "Search the Catalog again and use a returned ContentID.",
  catalog_unavailable: "Wait for the Catalog to finish loading, then retry the read.",
  stale_revision: "Read the Encounter again and retry with its current revision.",
  stale_brief_revision: "Read the Encounter Brief again and retry with its current revision.",
  stale_constraints: "Read the DM-owned constraints again before retrying.",
  wrong_generation_run: "Read the active Generation Run ID again before retrying.",
  no_active_generation: "Begin a Generation Run before using composition or packet mutation tools.",
  generation_interrupted: "Call sidekickdm_resume_generation with the current revisions and Generation Run ID, or cancel the run.",
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
    generationRunID: firstDefined(snapshot.generationRunID, snapshot.generation_run_id, generation?.id) ?? null,
    generationState: firstDefined(snapshot.generationState, snapshot.generation_state, generation?.state) ?? null
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
  const payload = domainError(code, message, source?.details);
  if (source?.recovery) payload.recovery = text(source.recovery);
  return payload;
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
    ["content_boundaries", brief.content_boundaries, false, false, "Keeps authored material within the DM's stated limits."]
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
  const generationStatus = firstDefined(draft.generation?.state, snapshot.generationState, snapshot.generation_state) ?? "idle";
  const briefPremise = firstDefined(draft.brief?.creative?.premise, draft.brief?.premise);
  const packetPremise = firstDefined(packet.identity?.premise, draft.packet?.premise);
  let status = readinessStatus(readiness.status);
  if (status === "ready to run" && reviewState === "needed") status = "ready with review needed";
  return {
    structural_errors: structuralErrors,
    design_warnings: designWarnings,
    missing_required_packet_sections: missing,
    review_state: reviewState,
    generation_status: generationStatus,
    structural_status: generationStatus === "interrupted" ? "blocked" : structuralErrors.length ? "incomplete" : "ready",
    review_status: reviewState,
    brief_premise: optionalText(briefPremise),
    packet_premise: optionalText(packetPremise),
    display_premise: optionalText(firstDefined(packetPremise, briefPremise)),
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
  const all = { perception: benchmark.perception, ac: benchmark.ac, armor_class: benchmark.ac, saves: benchmark.saves, saving_throws: benchmark.saves, hp: benchmark.hp, hit_points: benchmark.hp, attack: benchmark.attack, damage: benchmark.damage, dc: benchmark.dc };
  const statistics = Object.fromEntries(Object.entries(all).filter(([name]) => selected.length === 0 || selected.includes(name)).map(([name, value]) => [name, clone(value)]));
  return { level: Number(input.level), supported: true, statistics, ...(input.role ? { role_guidance: { role: input.role, recommended_bands: recommendedBands(input.role) } } : {}) };
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
    display_name: optionalText(firstDefined(group.display_name, group.displayName)),
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
    xp: optionalNumber(hazard.xp),
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

function projectSummary(snapshot, draft, state, catalog = null) {
  const target = draft.brief?.threatTarget ?? draft.brief?.threat_target ?? {};
  const budget = projectBudget(snapshot);
  const readiness = projectReadiness(snapshot, draft);
  const encounterProjection = projectEncounterParticipantSummary(draft, catalog);
  return {
    encounter_id: optionalText(draft.id),
    title: optionalText(draft.title),
    premise: optionalText(firstDefined(draft.packet?.premise, draft.packetV1?.identity?.premise, draft.packet_v1?.identity?.premise, draft.brief?.premise, draft.brief?.creative?.premise)),
    brief_premise: optionalText(firstDefined(draft.brief?.creative?.premise, draft.brief?.premise)),
    packet_premise: optionalText(firstDefined(draft.packetV1?.identity?.premise, draft.packet_v1?.identity?.premise, draft.packet?.premise)),
    display_premise: optionalText(firstDefined(draft.packetV1?.identity?.premise, draft.packet_v1?.identity?.premise, draft.packet?.premise, draft.brief?.creative?.premise, draft.brief?.premise)),
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
      total_encounter_xp: budget.total_encounter_xp,
      creature_xp: encounterProjection.creatureXP,
      hazard_xp: encounterProjection.hazardXP,
      combined_xp: encounterProjection.totalXP
    },
    enemy_count: encounterProjection.enemyCount,
    hazard_count: encounterProjection.hazardCount,
    creature_xp: encounterProjection.creatureXP,
    hazard_xp: encounterProjection.hazardXP,
    combined_xp: encounterProjection.totalXP,
    creature_levels: encounterProjection.levels,
    hazard_levels: encounterProjection.hazardDetails.map(detail => detail.level),
    participants: array(draft.participantGroups ?? draft.participant_groups).map(projectParticipant),
    hazards: array(draft.hazards).map(hazard => {
      const projected = projectHazard(hazard);
      const detail = encounterProjection.hazardDetails.find(item => String(item.hazard?.id) === projected.id);
      return { ...projected, xp: detail?.xp ?? projected.xp };
    }),
    phases: array(draft.structuredPhases ?? draft.structured_phases ?? draft.phases).map(projectPhase),
    phase_budget: projectPhaseBudget(snapshot),
    readiness: { status: readiness.status, generation_status: readiness.generation_status, structural_status: readiness.structural_status, review_status: readiness.review_status, structural_error_count: readiness.structural_errors.length, design_warning_count: readiness.design_warnings.length },
    review_state: readiness.review_state,
    generation: state.generationRunID ? { id: state.generationRunID, state: firstDefined(draft.generation?.state) ?? null } : null,
    revisions: { encounter_revision: state.encounterRevision, constraints_revision: state.constraintsRevision }
  };
}

function capabilities(catalog, state) {
  const fixture = catalog?.fixture ?? {};
  const draft = requireDraft(state);
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
      map_attachments: true,
      reusable_library: true,
      live_encounter_tracking: true
    },
    catalog: {
      fixture_version: optionalNumber(firstDefined(fixture.fixture_version, fixture.fixtureVersion)),
      party_level_focus: array(fixture.party_level_focus ?? fixture.partyLevelFocus)
    },
    active_encounter: {
      encounter_id: text(draft.id),
      title: text(draft.title),
      encounter_revision: state.encounterRevision,
      brief_revision: state.briefRevision,
      constraints_revision: state.constraintsRevision
    }
  };
}

function catalogFor(options) {
  if (typeof options.getCatalog === "function") return options.getCatalog();
  return options.catalog ?? null;
}

function nativeCompatibility(engine) {
  if (!engine || (!Object.prototype.hasOwnProperty.call(engine, "capabilities") && !engine.compatibility)) return null;
  if (engine.compatibility === "update_required") return { state: "update_required", label: "WebMCP update required", reason: engine.reason ?? "The native engine is out of date." };
  if (!engine.available) return { state: "unavailable", label: "WebMCP unavailable", reason: engine.reason ?? "The native engine is unavailable." };
  const capabilities = engine.capabilities;
  if (Object.prototype.hasOwnProperty.call(engine, "capabilities") && !capabilities) return { state: "update_required", label: "WebMCP update required", reason: "The native engine did not report its capabilities." };
  const supported = new Set(capabilities?.supportedCommands ?? capabilities?.supported_commands ?? []);
  const missing = REQUIRED_NATIVE_COMMANDS.filter(command => !supported.has(command));
  if (capabilities && (Number(capabilities.protocolVersion ?? capabilities.protocol_version) !== PROTOCOL_VERSION || Number(capabilities.interfaceVersion ?? capabilities.interface_version) !== 2 || missing.length)) {
    return { state: "update_required", label: "WebMCP update required", reason: missing.length ? `The native engine is missing ${missing.join(", ")}.` : "The native engine interface is incompatible." };
  }
  return { state: "compatible", label: "WebMCP connected" };
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

const CONCEPT_ALIASES = Object.freeze({
  draconic: ["dragon"], dragonkin: ["dragon"], cultist: ["humanoid"], cultists: ["humanoid"], bandit: ["humanoid"], bandits: ["humanoid"], guard: ["defender"], guards: ["defender"]
});

function planEncounter(catalog, draft, snapshot, input = {}) {
  if (!catalog || typeof catalog.search !== "function") throw Object.assign(new Error("The Sidekick DM Catalog is not available."), { code: "catalog_unavailable" });
  const partyLevel = number(firstDefined(draft.brief?.party?.effectiveLevel, draft.brief?.party?.effective_level), 1);
  const target = draft.brief?.threatTarget ?? draft.brief?.threat_target ?? {};
  const budget = projectBudget(snapshot);
  const rawConcepts = array(input.concepts).map(value => text(value).trim().toLowerCase()).filter(Boolean);
  const concepts = rawConcepts.length
    ? [...new Set(rawConcepts.flatMap(concept => {
      const terms = concept.split(/[^a-z0-9]+/).filter(token => token.length > 2);
      return terms.length > 1 ? terms : [concept];
    }))]
    : [draft.brief?.creative?.premise, draft.brief?.premise, draft.brief?.creative?.environment, draft.brief?.environment].flatMap(value => text(value).toLowerCase().split(/[^a-z0-9]+/)).filter(token => token.length > 2);
  const expanded = [...new Set(concepts.flatMap(concept => [concept, ...(CONCEPT_ALIASES[concept] ?? [])]))];
  const candidates = new Map();
  const hazards = new Map();
  const addMatches = (result, target, sourceQuery) => {
    for (const entry of result.results ?? []) {
      const item = target.get(entry.content_id) ?? { ...entry, match_reasons: [], matched_concepts: [] };
      const sourceConcept = concepts.find(concept => concept === sourceQuery || (CONCEPT_ALIASES[concept] ?? []).includes(sourceQuery));
      const direct = sourceConcept === sourceQuery;
      const reason = direct ? "direct catalog match" : `usable basis for ${sourceConcept ?? sourceQuery}`;
      if (!item.match_reasons.includes(reason)) item.match_reasons.push(reason);
      if (sourceConcept && !item.matched_concepts.includes(sourceConcept)) item.matched_concepts.push(sourceConcept);
      target.set(entry.content_id, item);
    }
  };
  for (const query of expanded) {
    const result = catalog.search({ query, kind: "creature", level_min: partyLevel - 4, level_max: partyLevel + 4, limit: Math.min(Number(input.candidate_count ?? 6), 12) });
    addMatches(result, candidates, query);
    if (input.include_hazards !== false) addMatches(catalog.search({ query, kind: "hazard", level_min: partyLevel - 4, level_max: partyLevel + 4, limit: Math.min(Number(input.candidate_count ?? 6), 12) }), hazards, query);
  }
  const creatureXP = [10, 15, 20, 30, 40, 60, 80, 120, 160];
  const hazardXP = { simple: [2, 3, 4, 6, 8, 12, 16, 24, 30], complex: [10, 15, 20, 30, 40, 60, 80, 120, 150] };
  const relativeXP = (table, level, above) => { const relative = Number(level) - partyLevel; return relative < -4 ? 0 : relative > 4 ? above : table[relative + 4]; };
  const xpFor = level => relativeXP(creatureXP, level, 160);
  const rank = (items, xp) => [...items.values()].map(entry => {
    const xpPerCandidate = xp(entry);
    return { ...entry, xp_per_candidate: xpPerCandidate, ...(entry.kind === "creature" ? { xp_per_creature: xpPerCandidate } : {}), fits_remaining_budget: xpPerCandidate <= Math.max(0, budget.construction_budget - budget.guaranteed_xp) };
  }).sort((left, right) => right.matched_concepts.length - left.matched_concepts.length || left.xp_per_candidate - right.xp_per_candidate || String(left.name).localeCompare(String(right.name))).slice(0, Math.min(Number(input.candidate_count ?? 6), 12));
  const ranked = rank(candidates, entry => xpFor(entry.level));
  const rankedHazards = rank(hazards, entry => relativeXP(hazardXP[entry.hazard_complexity === "complex" ? "complex" : "simple"], entry.level, entry.hazard_complexity === "complex" ? 150 : 30));
  const unmatched = concepts.filter(concept => !ranked.some(entry => entry.matched_concepts.includes(concept)));
  const fallbacks = [];
  if (unmatched.some(concept => ["cultist", "cultists", "bandit", "bandits"].includes(concept))) fallbacks.push({ concept: "cultist", recommendation: "Create a custom humanoid creature or fork a humanoid catalog entry." });
  if (unmatched.some(concept => ["kobold", "kobolds"].includes(concept))) fallbacks.push({ concept: "kobold", recommendation: "No Kobold entry is bundled. Create a custom creature or choose a goblin as a mechanical basis." });
  for (const concept of unmatched) if (!fallbacks.some(item => item.concept === concept)) fallbacks.push({ concept, recommendation: "Search by a related trait, environment, or role, or draft a custom creature for this concept." });
  return { encounter_id: text(draft.id), target_threat: target.kind ?? null, party_level: partyLevel, budget: { construction_budget: budget.construction_budget, guaranteed_xp: budget.guaranteed_xp, remaining_xp: Math.max(0, budget.construction_budget - budget.guaranteed_xp) }, useful_level_range: { minimum: Math.max(-1, partyLevel - 2), maximum: Math.min(20, partyLevel + 2) }, concepts, candidates: ranked, hazards: rankedHazards, unmatched_concepts: unmatched, fallbacks, include_hazards: input.include_hazards !== false };
}

function draftCustomCreature(input) {
  const creature = createEmptyOriginalCreature();
  const level = Number(input.level);
  const benchmark = benchmarkFor(level);
  const bands = recommendedBands(input.role);
  const value = (table, band) => table?.[band]?.minimum ?? table?.[band]?.maximum ?? null;
  creature.identity = { ...creature.identity, name: input.name, level, concept: input.concept, traits: [...(input.traits ?? [])], roadmap: input.role, encounterRole: input.role };
  creature.languages = ["Common"];
  creature.speeds = { land: 25 };
  creature.tactics = `Use the ${input.role} role to control the encounter space.`;
  creature.morale = "Withdraw when bloodied or when the objective is secured.";
  if (benchmark) {
    creature.perception = { band: bands.perception, value: value(benchmark.perception, bands.perception) };
    creature.defenses = { ...creature.defenses, ac: { band: bands.ac, value: value(benchmark.ac, bands.ac) }, fortitude: { band: bands.fortitude, value: value(benchmark.saves, bands.fortitude) }, reflex: { band: bands.reflex, value: value(benchmark.saves, bands.reflex) }, will: { band: bands.will, value: value(benchmark.saves, bands.will) }, hp: { band: bands.hp, value: value(benchmark.hp, bands.hp) } };
    creature.strikes = [{ id: "strike_1", name: "Strike", actionCost: 1, traits: [], attack: { band: bands.attack, value: value(benchmark.attack, bands.attack) }, damage: [{ expression: benchmark.damage?.[bands.damage]?.expression ?? "1d6", type: "" }], effect: "" }];
  }
  return { creature, benchmarked_role: input.role, recommended_bands: bands, validation: validateCustomCreature(creature) };
}

function schemaTypeMatches(value, type) {
  if (type === "null") return value === null;
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "array") return Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function resolveSchemaReference(schema, rootSchema) {
  if (!schema?.$ref) return schema;
  if (!schema.$ref.startsWith("#/$defs/")) throw Object.assign(new Error(`Unsupported schema reference: ${schema.$ref}.`), { code: "invalid_schema" });
  const definition = rootSchema?.$defs?.[schema.$ref.slice("#/$defs/".length)];
  if (!definition) throw Object.assign(new Error(`Unknown schema reference: ${schema.$ref}.`), { code: "invalid_schema" });
  return definition;
}

function validateSchemaValue(value, schema, path, rootSchema = schema) {
  if (!schema) return;
  schema = resolveSchemaReference(schema, rootSchema);
  const types = Array.isArray(schema.type) ? schema.type : [schema.type];
  if (types.length && !types.some(type => schemaTypeMatches(value, type))) throw Object.assign(new Error(`${path} has an invalid type.`), { code: "invalid_request", details: { field: path } });
  if (schema.minLength != null && typeof value === "string" && value.length < schema.minLength) throw Object.assign(new Error(`${path} is required.`), { code: "invalid_request", details: { field: path } });
  if (schema.minimum != null && typeof value === "number" && value < schema.minimum) throw Object.assign(new Error(`${path} is below the minimum.`), { code: "invalid_request", details: { field: path } });
  if (schema.maximum != null && typeof value === "number" && value > schema.maximum) throw Object.assign(new Error(`${path} is above the maximum.`), { code: "invalid_request", details: { field: path } });
  if (schema.minItems != null && Array.isArray(value) && value.length < schema.minItems) throw Object.assign(new Error(`${path} needs at least ${schema.minItems} item${schema.minItems === 1 ? "" : "s"}.`), { code: "invalid_request", details: { field: path } });
  if (schema.maxItems != null && Array.isArray(value) && value.length > schema.maxItems) throw Object.assign(new Error(`${path} supports at most ${schema.maxItems} items.`), { code: "invalid_request", details: { field: path } });
  if (schema.enum && !schema.enum.includes(value)) throw Object.assign(new Error(`${path} has an unsupported value.`), { code: "invalid_request", details: { field: path, value, allowed_values: [...schema.enum] } });
  if (Array.isArray(value) && schema.items) value.forEach((item, index) => validateSchemaValue(item, schema.items, `${path}[${index}]`, schema.items.$defs ? schema.items : rootSchema));
  if (schemaTypeMatches(value, "object") && schema.properties) {
    if (schema.additionalProperties === false) for (const key of Object.keys(value)) if (!Object.hasOwn(schema.properties, key)) throw Object.assign(new Error(`${path}.${key} is not supported.`), { code: "invalid_request", details: { field: `${path}.${key}` } });
    for (const required of schema.required ?? []) if (!Object.hasOwn(value, required)) throw Object.assign(new Error(`${path}.${required} is required.`), { code: "invalid_request", details: { field: required }, ...(required === "generation_run_id" ? { recovery: "Reuse the generation_run_id returned by sidekickdm_begin_generation." } : {}) });
    for (const [key, child] of Object.entries(schema.properties)) if (Object.hasOwn(value, key)) validateSchemaValue(value[key], child, `${path}.${key}`, child.$defs ? child : rootSchema);
  }
}

const MUTATION_NAMES = new Set(TOOL_DEFINITIONS.filter(definition => !definition.readOnlyHint).map(definition => definition.name));
const SETUP_MUTATIONS = new Set([`${TOOL_PREFIX}create_encounter`, `${TOOL_PREFIX}set_party_snapshot`, `${TOOL_PREFIX}set_threat_target`]);
const INDEPENDENT_MUTATIONS = new Set(["save_custom_creature", "save_encounter", "start_run", "set_initiative", "advance_turn", "apply_damage", "apply_healing", "add_condition", "remove_condition", "roll"].map(name => `${TOOL_PREFIX}${name}`));
const AGENT_CONSTRAINT_MUTATIONS = new Set([...MUTATION_NAMES].filter(name => !new Set([...SETUP_MUTATIONS, ...INDEPENDENT_MUTATIONS, `${TOOL_PREFIX}cancel_generation`, `${TOOL_PREFIX}apply_targeted_revision`, `${TOOL_PREFIX}undo`, `${TOOL_PREFIX}redo`]).has(name)));
const GENERATION_MUTATIONS = new Set([...MUTATION_NAMES].filter(name => !new Set([...SETUP_MUTATIONS, ...INDEPENDENT_MUTATIONS, `${TOOL_PREFIX}begin_generation`, `${TOOL_PREFIX}resume_generation`, `${TOOL_PREFIX}cancel_generation`, `${TOOL_PREFIX}apply_targeted_revision`, `${TOOL_PREFIX}undo`, `${TOOL_PREFIX}redo`]).has(name)));
const RUN_BOUND_MUTATIONS = new Set([...GENERATION_MUTATIONS, `${TOOL_PREFIX}resume_generation`, `${TOOL_PREFIX}cancel_generation`]);

function validateToolInput(name, input) {
  const definition = TOOL_DEFINITIONS.find(item => item.name === name);
  if (!definition) throw Object.assign(new Error(`Unknown Sidekick DM tool: ${name}.`), { code: "unknown_tool" });
  if (!input || typeof input !== "object" || Array.isArray(input)) throw Object.assign(new Error("Tool input must be an object."), { code: "invalid_request" });
  validateSchemaValue(input, definition.inputSchema, "input");
}

function validateMutationPreconditions(name, input, state) {
  if (!MUTATION_NAMES.has(name)) return;
  if (INDEPENDENT_MUTATIONS.has(name)) return;
  if (name === `${TOOL_PREFIX}create_encounter`) {
    if (state.generationRunID) throw Object.assign(new Error("Finish or cancel the active Generation Run before replacing the Encounter Draft."), { code: "manual_write_locked" });
    return;
  }
  if (!Object.hasOwn(input, "encounter_id") || !Object.hasOwn(input, "expected_encounter_revision")) throw Object.assign(new Error("Mutations require encounter_id and expected_encounter_revision."), { code: "invalid_request" });
  checkEncounter(state, input);
  if (!Number.isInteger(input.expected_encounter_revision)) throw Object.assign(new Error("expected_encounter_revision must be an integer."), { code: "invalid_request" });
  if (SETUP_MUTATIONS.has(name) && state.generationRunID) throw Object.assign(new Error("Finish or cancel the active Generation Run before changing setup."), { code: "manual_write_locked" });
  if (AGENT_CONSTRAINT_MUTATIONS.has(name) && !Object.hasOwn(input, "expected_constraints_revision")) throw Object.assign(new Error("This mutation requires expected_constraints_revision."), { code: "invalid_request" });
  if (GENERATION_MUTATIONS.has(name) && !state.generationRunID) throw Object.assign(new Error("This mutation requires an active Generation Run."), { code: "no_active_generation" });
  if (RUN_BOUND_MUTATIONS.has(name)) {
    if (!state.generationRunID) throw Object.assign(new Error("There is no active Generation Run."), { code: "no_active_generation" });
    if (!Object.hasOwn(input, "generation_run_id")) throw Object.assign(new Error("An active Generation Run requires generation_run_id."), { code: "invalid_request", recovery: "Reuse the generation_run_id returned by sidekickdm_begin_generation." });
    if (input.generation_run_id !== state.generationRunID) throw Object.assign(new Error("That Generation Run is no longer active."), { code: "wrong_generation_run", details: { current_generation_run_id: state.generationRunID } });
  }
  if (state.generationState === "interrupted" && GENERATION_MUTATIONS.has(name)) throw Object.assign(new Error("The Generation Run was interrupted by a reload."), { code: "generation_interrupted" });
  if (name === `${TOOL_PREFIX}resume_generation` && state.generationState !== "interrupted") throw Object.assign(new Error("Only an interrupted Generation Run can be resumed."), { code: "generation_not_interrupted" });
}

function packetValue(section, value) {
  return keysToCamel({ ...clone(packetSectionDefaults[section]), ...clone(value) });
}

function generationSectionValue(section, value) {
  if (section === "reward_guidance") return value;
  if (section === "alternative_resolutions") return keysToCamel(value);
  return packetValue(section, value);
}

function resolveContext(options) {
  if (options.modelContext !== undefined) return options.modelContext;
  return globalThis.document?.modelContext ?? globalThis.navigator?.modelContext ?? null;
}

async function disposeLifecycle(modelContext, lifecycle) {
  if (lifecycle.disposed) return;
  lifecycle.disposed = true;
  lifecycle.abortController?.abort();
  if (lifecycle.owner && lifecycle.ownerHandler && typeof lifecycle.owner.removeEventListener === "function") {
    lifecycle.owner.removeEventListener("pagehide", lifecycle.ownerHandler);
  }
  if (lifecycle.toolChangeHandler && typeof modelContext?.removeEventListener === "function") {
    modelContext.removeEventListener("toolchange", lifecycle.toolChangeHandler);
  }
  for (const handle of [...lifecycle.handles].reverse()) await disposeRegistrationHandle(handle);
  lifecycle.handles.length = 0;
  registrationLifecyclesByContext.delete(modelContext);
  registrationsByContext.delete(modelContext);
  lifecycle.updateConnection?.({ state: "disconnected", available: false, label: "WebMCP disconnected" });
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
  const engineStatus = nativeCompatibility(source.engine);
  let connectionStatus = { state: "unavailable", available: false, label: "WebMCP unavailable in this browser" };
  const connectionListeners = new Set(typeof source.onConnectionChange === "function" ? [source.onConnectionChange] : []);
  const updateConnection = next => {
    if (connectionStatus.state === next.state && connectionStatus.label === next.label) return connectionStatus;
    connectionStatus = Object.freeze({ ...next });
    for (const listener of connectionListeners) listener(connectionStatus);
    return connectionStatus;
  };
  const registrationResult = status => ({ available: status.available, label: status.label });

  async function refreshConnection(modelContext, lifecycle) {
    if (lifecycle.disposed) return updateConnection({ state: "disconnected", available: false, label: "WebMCP disconnected" });
    if (typeof modelContext.getTools !== "function") return updateConnection({ state: "connected", available: true, label: "WebMCP connected" });
    try {
      const tools = await modelContext.getTools();
      const names = new Set((tools ?? []).map(tool => tool?.name));
      const connected = TOOL_DEFINITIONS.every(definition => names.has(definition.name));
      return updateConnection(connected
        ? { state: "connected", available: true, label: "WebMCP connected" }
        : { state: "disconnected", available: false, label: "WebMCP disconnected" });
    } catch {
      return updateConnection({ state: "disconnected", available: false, label: "WebMCP disconnected" });
    }
  }

  async function readState() {
    return unwrap(typeof getSnapshot === "function" ? await getSnapshot() : getSnapshot);
  }

  async function executeMutation(command, project = (state) => ({ encounter: projectSummary(state.snapshot, requireDraft(state), state, catalog) })) {
    if (typeof commandExecutor !== "function") throw Object.assign(new Error("The Sidekick DM mutation boundary is unavailable."), { code: "invalid_request" });
    const result = await commandExecutor({ ...command, origin: "webmcp" });
    const next = unwrap(result);
    if (!result?.ok) return envelope(next, undefined, errorPayload(result));
    if (source.engine && result.snapshot) source.engine.snapshot = result.snapshot;
    const data = project(next, result);
    if (typeof source.onMutation === "function") await source.onMutation(requireDraft(next), result, command, data);
    return envelope(next, data);
  }

  async function readRun(input) {
    if (typeof source.getRunSession !== "function") throw Object.assign(new Error("Live encounter tracking is not available."), { code: "run_unavailable" });
    const session = await source.getRunSession();
    if (!session) throw Object.assign(new Error("There is no active live encounter."), { code: "no_active_run" });
    if (input.run_id !== session.id) throw Object.assign(new Error("That live encounter is no longer active."), { code: "unknown_run", details: { run_id: input.run_id, active_run_id: session.id } });
    return session;
  }

  async function executeRunAction(input, action) {
    const session = await readRun(input);
    if (input.expected_run_revision !== session.revision) throw Object.assign(new Error("The live encounter changed before this action was applied."), { code: "stale_run_revision", details: { expected_run_revision: input.expected_run_revision, current_run_revision: session.revision } });
    if (typeof source.runAction !== "function") throw Object.assign(new Error("Live encounter mutations are not available."), { code: "run_unavailable" });
    const next = await source.runAction(action);
    return envelope(await readState(), projectRunSession(next));
  }

  function mutationCommand(name, input, additions = {}) {
    return { ...input, ...additions, command: name };
  }

  async function executeCommand(name, input = {}, signal) {
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
          return envelope(state, {
            ...capabilities(catalog, state),
            engine: source.engine ? {
              build_id: source.engine.buildID ?? source.engine.build_id ?? null,
              interface_version: source.engine.capabilities?.interfaceVersion ?? source.engine.capabilities?.interface_version ?? null,
              compatibility: engineStatus?.state === "update_required" ? "update_required" : source.engine.compatibility ?? "unknown"
            } : { build_id: null, interface_version: null, compatibility: "unknown" }
          });
        case `${TOOL_PREFIX}get_encounter_summary`:
          checkEncounter(state, input);
          return envelope(state, projectSummary(state.snapshot, requireDraft(state), state, catalog));
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
        case `${TOOL_PREFIX}plan_encounter`:
          checkEncounter(state, input);
          return envelope(state, planEncounter(catalog, requireDraft(state), state.snapshot, input));
        case `${TOOL_PREFIX}draft_custom_creature`:
          return envelope(state, draftCustomCreature(input));
        case `${TOOL_PREFIX}list_library`: {
          if (typeof source.getLibrary !== "function") throw Object.assign(new Error("The reusable library is not available."), { code: "library_unavailable" });
          const library = clone(await source.getLibrary());
          if (input.kind === "encounters") return envelope(state, { encounters: array(library.encounters) });
          if (input.kind === "creatures") return envelope(state, { creatures: array(library.creatures) });
          return envelope(state, { encounters: array(library.encounters), creatures: array(library.creatures) });
        }
        case `${TOOL_PREFIX}get_run_state`:
          return envelope(state, projectRunSession(await readRun(input)));
        case `${TOOL_PREFIX}save_custom_creature`: {
          if (typeof source.saveLibraryCreature !== "function") throw Object.assign(new Error("The custom creature library is not available."), { code: "library_unavailable" });
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          await source.saveLibraryCreature(creature);
          return envelope(state, { creature: keysToSnake(creature), validation: validateCustomCreature(creature), ui_target: { kind: "library_creature", id: creature.id, label: creature.identity?.name ?? creature.id } });
        }
        case `${TOOL_PREFIX}save_encounter`: {
          checkEncounter(state, input);
          if (typeof source.saveEncounter !== "function") throw Object.assign(new Error("The encounter library is not available."), { code: "library_unavailable" });
          const encounter = requireDraft(state);
          await source.saveEncounter(encounter);
          return envelope(state, { encounter_id: encounter.id, saved_revision: state.encounterRevision, ui_target: { kind: "library_encounter", id: encounter.id, label: encounter.title } });
        }
        case `${TOOL_PREFIX}start_run`: {
          checkEncounter(state, input);
          if (typeof source.startRun !== "function") throw Object.assign(new Error("Live encounter tracking is not available."), { code: "run_unavailable" });
          return envelope(state, projectRunSession(await source.startRun(requireDraft(state))));
        }
        case `${TOOL_PREFIX}set_initiative`:
          return await executeRunAction(input, { type: "set_initiative", combatantID: input.combatant_id, value: input.value });
        case `${TOOL_PREFIX}advance_turn`:
          return await executeRunAction(input, { type: "next_turn" });
        case `${TOOL_PREFIX}apply_damage`:
          return await executeRunAction(input, { type: "apply_damage", combatantID: input.combatant_id, amount: input.amount });
        case `${TOOL_PREFIX}apply_healing`:
          return await executeRunAction(input, { type: "apply_healing", combatantID: input.combatant_id, amount: input.amount });
        case `${TOOL_PREFIX}add_condition`:
          return await executeRunAction(input, { type: "add_condition", combatantID: input.combatant_id, name: input.name, value: input.value });
        case `${TOOL_PREFIX}remove_condition`:
          return await executeRunAction(input, { type: "remove_condition", combatantID: input.combatant_id, name: input.name });
        case `${TOOL_PREFIX}roll`:
          return await executeRunAction(input, { type: "roll", combatantID: input.combatant_id ?? null, label: input.label, expression: input.expression });
        case `${TOOL_PREFIX}create_encounter`:
        case `${TOOL_PREFIX}set_party_snapshot`:
        case `${TOOL_PREFIX}set_threat_target`:
          return await executeMutation(mutationCommand(name, input));
        case `${TOOL_PREFIX}begin_generation`:
          return await executeMutation(mutationCommand(name, input), next => ({ generation_run_id: next.generationRunID, opening_revision: state.encounterRevision, readiness: projectReadiness(next.snapshot, requireDraft(next)) }));
        case `${TOOL_PREFIX}apply_generation_step`: {
          if (input.step === "composition" && !array(input.participants).length && !array(input.hazards).length) throw Object.assign(new Error("A composition step must include participants or hazards."), { code: "invalid_request", details: { field: "participants" } });
          if (input.step === "guidance" && (!input.sections || typeof input.sections !== "object" || Object.keys(input.sections).length === 0)) throw Object.assign(new Error("A guidance step must include at least one packet section."), { code: "invalid_request", details: { field: "sections" } });
          const participants = array(input.participants).map(item => {
            const contentID = text(item.content_id ?? item.contentID);
            const entry = contentID ? catalogEntry(catalog, contentID) : null;
            return entry ? { ...item, content_id: contentID, catalog_entry: catalogEntryCommand(catalog, entry), name: entry.name, level: entry.level } : { ...item, ...(item.creature ? { creature: keysToCamel(item.creature) } : {}) };
          });
          const hazards = array(input.hazards).map(item => ({ ...item, ...(item.hazard ? { hazard: keysToCamel(item.hazard) } : {}) }));
          return await executeMutation(mutationCommand(name, { ...input, participants, hazards, sections: input.sections ? Object.fromEntries(Object.entries(input.sections).map(([section, value]) => [section, generationSectionValue(section, value)])) : undefined }), next => {
            const groups = array(next.draft?.participantGroups ?? next.snapshot?.encounter?.participantGroups).map(projectParticipant);
            const placedHazards = array(next.draft?.hazards ?? next.snapshot?.encounter?.hazards).map(projectHazard);
            const priorGroups = new Set(array(state.draft?.participantGroups).map(group => text(group.id)));
            const priorHazards = new Set(array(state.draft?.hazards).map(hazard => text(hazard.id)));
            const appliedParticipants = groups.filter(group => !priorGroups.has(group.id));
            const appliedHazards = placedHazards.filter(hazard => !priorHazards.has(hazard.id));
            const uiTargets = [
              ...appliedParticipants.map(participant => ({ kind: "participant_group", id: participant.id, label: participant.display_name ?? participant.name })),
              ...appliedHazards.map(hazard => ({ kind: "hazard", id: hazard.id, label: hazard.name }))
            ];
            return { applied: true, step: input.step, participants: appliedParticipants, hazards: appliedHazards, ui_target: uiTargets[0] ?? { kind: "encounter", id: requireDraft(next).id, label: requireDraft(next).title }, ui_targets: uiTargets, readiness: projectReadiness(next.snapshot, requireDraft(next)) };
          });
        }
        case `${TOOL_PREFIX}resume_generation`:
          return await executeMutation(mutationCommand(name, input), next => ({ generation_run_id: next.generationRunID, state: next.generationState }));
        case `${TOOL_PREFIX}add_existing_participant_group`: {
          const entry = catalogEntry(catalog, text(input.content_id));
          return await executeMutation(mutationCommand(name, input, { catalog_entry: catalogEntryCommand(catalog, entry), name: entry.name, level: entry.level }), next => {
            const groups = array(next.draft?.participantGroups ?? next.snapshot?.encounter?.participantGroups);
            const applied = (input.id ? groups.find(group => group.id === input.id) : [...groups].reverse().find(group => (group.contentID ?? group.content_id) === input.content_id)) ?? null;
            return { participant: applied ? projectParticipant(applied) : null, encounter: projectSummary(next.snapshot, requireDraft(next), next, catalog), ui_target: applied ? { kind: "participant_group", id: applied.id, label: applied.displayName ?? applied.name } : null };
          });
        }
        case `${TOOL_PREFIX}fork_existing_creature`: {
          const creature = forkExistingCreature(catalogEntry(catalog, text(input.content_id)), { id: input.id ?? null, origin: "webmcp" });
          return envelope(state, { creature, validation: validateCustomCreature(creature) });
        }
        case `${TOOL_PREFIX}validate_custom_creature`:
          return envelope(state, validateCustomCreature(keysToCamel(input.creature)));
        case `${TOOL_PREFIX}create_custom_creature`: {
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          return await executeMutation(mutationCommand(name, { ...input, creature }), next => {
            const draft = requireDraft(next);
            const participant = [...array(draft.participantGroups)].reverse().find(group => (group.contentID ?? group.content_id) === `creature/original/${creature.id}/current`);
            return { participant: participant ? projectParticipant(participant) : null, encounter: projectSummary(next.snapshot, draft, next, catalog), ui_target: participant ? { kind: "participant_group", id: participant.id, label: participant.displayName ?? participant.name } : null };
          });
        }
        case `${TOOL_PREFIX}update_creature`:
        case `${TOOL_PREFIX}update_custom_creature`: {
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          return await executeMutation(mutationCommand(name, { ...input, creature }), next => {
            const draft = requireDraft(next);
            const participant = array(draft.participantGroups).find(group => (group.contentID ?? group.content_id) === `creature/original/${creature.id}/current`);
            return { participant: participant ? projectParticipant(participant) : null, encounter: projectSummary(next.snapshot, draft, next, catalog), ui_target: participant ? { kind: "participant_group", id: participant.id, label: participant.displayName ?? participant.name } : null };
          });
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
          }), next => {
            const hazards = array(next.draft?.hazards ?? next.snapshot?.encounter?.hazards);
            const applied = (input.id ? hazards.find(hazard => hazard.id === input.id) : [...hazards].reverse().find(hazard => (hazard.contentID ?? hazard.content_id) === input.content_id)) ?? null;
            return { hazard: applied ? projectHazard(applied) : null, encounter: projectSummary(next.snapshot, requireDraft(next), next, catalog), ui_target: applied ? { kind: "hazard", id: applied.id, label: applied.name } : null };
          });
        }
        case `${TOOL_PREFIX}validate_simple_hazard`:
          return envelope(state, validateSimpleHazard(keysToCamel(input.hazard)));
        case `${TOOL_PREFIX}create_simple_hazard`: {
          const hazard = createSimpleHazard(keysToCamel(input.hazard));
          return await executeMutation(mutationCommand(name, { ...input, hazard }), next => {
            const draft = requireDraft(next);
            const applied = array(draft.hazards).find(item => item.id === hazard.id);
            return { hazard: applied ? projectHazard(applied) : null, encounter: projectSummary(next.snapshot, draft, next, catalog), ui_target: applied ? { kind: "hazard", id: applied.id, label: applied.name } : null };
          });
        }
        case `${TOOL_PREFIX}update_hazard`: {
          const hazard = createSimpleHazard(keysToCamel(input.hazard));
          return await executeMutation(mutationCommand(name, { ...input, hazard }), next => {
            const draft = requireDraft(next);
            const applied = array(draft.hazards).find(item => item.id === hazard.id);
            return { hazard: applied ? projectHazard(applied) : null, encounter: projectSummary(next.snapshot, draft, next, catalog), ui_target: applied ? { kind: "hazard", id: applied.id, label: applied.name } : null };
          });
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
          return await executeMutation(mutationCommand(name, { ...input, value: packetValue(name.slice(`${TOOL_PREFIX}set_`.length), input.value) }));
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

  const activityPhase = (name, input = {}) => {
    if (name.includes("apply_generation_step")) return input.step === "composition" ? "creating monsters" : "writing tactics";
    if (name.includes("search_catalog") || name.includes("plan_encounter") || name.includes("preflight")) return "finding opposition";
    if (name.includes("budget") || name.includes("threat_target")) return "balancing";
    if (name.includes("creature") || name.includes("participant")) return "creating monsters";
    if (name.includes("battlefield") || name.includes("hazard") || name.includes("phase")) return "designing the battlefield";
    if (name.includes("running_guidance") || name.includes("cohesion")) return "writing tactics";
    if (name.includes("information")) return "writing clues";
    if (name.includes("outcomes") || name.includes("reward") || name.includes("alternative")) return "writing outcomes";
    if (name.includes("finish") || name.includes("readiness")) return "reviewing";
    if (name.includes("save")) return "saving";
    if (name.includes("create_encounter") || name.includes("brief") || name.includes("identity")) return "planning";
    return "planning";
  };
  const activityID = () => globalThis.crypto?.randomUUID?.() ?? `activity_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const activityTarget = (name, input = {}, state = {}, result = null) => {
    const authoritative = result?.data?.ui_target ?? result?.ui_target;
    if (authoritative) return authoritative;
    const kind = input.component_id ? "component" : input.content_id ? "catalog_entry" : input.encounter_id ? "encounter" : "workspace";
    const id = input.component_id ?? input.content_id ?? input.encounter_id ?? state.draft?.id ?? null;
    const encounterLabel = kind === "encounter" && String(id) === String(state.draft?.id) ? state.draft?.title : null;
    return { kind, id, label: input.display_name ?? input.name ?? encounterLabel ?? input.content_id ?? state.draft?.title ?? "Sidekick" };
  };
  const activityPresentation = Object.freeze({
    sidekickdm_get_capabilities: ["Checking Sidekick compatibility", "Checked Sidekick compatibility"],
    sidekickdm_get_encounter_summary: ["Reading the encounter overview", "Read the encounter overview"],
    sidekickdm_get_encounter_brief: ["Reading the creative brief", "Read the creative brief"],
    sidekickdm_get_brief_checklist: ["Checking the creative brief", "Checked the creative brief"],
    sidekickdm_get_budget: ["Checking encounter balance", "Checked encounter balance"],
    sidekickdm_get_readiness: ["Checking encounter readiness", "Checked encounter readiness"],
    sidekickdm_get_catalog_entry: ["Inspecting a catalog entry", "Inspected the catalog entry"],
    sidekickdm_get_encounter_packet: ["Reading the encounter packet", "Read the encounter packet"],
    sidekickdm_get_component: ["Inspecting an encounter element", "Inspected the encounter element"],
    sidekickdm_get_creature_benchmarks: ["Checking creature benchmarks", "Prepared creature benchmark guidance"],
    sidekickdm_get_hazard_benchmarks: ["Checking hazard benchmarks", "Prepared hazard benchmark guidance"],
    sidekickdm_preflight_generation: ["Checking the generation plan", "Checked the generation plan"],
    sidekickdm_draft_custom_creature: ["Drafting custom opposition", "Prepared a custom creature draft"],
    sidekickdm_list_library: ["Reading the library", "Read the Sidekick library"],
    sidekickdm_get_run_state: ["Reading the live encounter", "Read the live encounter"],
    sidekickdm_create_encounter: ["Creating an encounter", "Created the encounter"],
    sidekickdm_set_party_snapshot: ["Updating the party", "Updated the party"],
    sidekickdm_set_threat_target: ["Setting encounter difficulty", "Set encounter difficulty"],
    sidekickdm_begin_generation: ["Starting encounter generation", "Started encounter generation"],
    sidekickdm_fork_existing_creature: ["Adapting a catalog creature", "Prepared an editable creature draft"],
    sidekickdm_validate_custom_creature: ["Checking the creature draft", "Checked the creature draft"],
    sidekickdm_update_creature: ["Updating creature statistics", "Updated creature statistics"],
    sidekickdm_update_custom_creature: ["Updating creature statistics", "Updated creature statistics"],
    sidekickdm_upsert_npc_profile: ["Writing an NPC profile", "Wrote the NPC profile"],
    sidekickdm_validate_simple_hazard: ["Checking the hazard draft", "Checked the hazard draft"],
    sidekickdm_update_hazard: ["Updating a hazard", "Updated the hazard"],
    sidekickdm_remove_component: ["Removing an encounter element", "Removed the encounter element"],
    sidekickdm_upsert_phase: ["Designing an encounter phase", "Designed the encounter phase"],
    sidekickdm_set_encounter_identity: ["Defining the encounter", "Named the encounter"],
    sidekickdm_set_setup: ["Writing the opening", "Wrote the opening"],
    sidekickdm_set_battlefield_guidance: ["Designing the battlefield", "Designed the battlefield"],
    sidekickdm_set_running_guidance: ["Writing running tactics", "Wrote running tactics"],
    sidekickdm_set_cohesion: ["Connecting encounter elements", "Connected encounter elements"],
    sidekickdm_set_information_visibility: ["Writing information clues", "Wrote information clues"],
    sidekickdm_set_outcomes: ["Writing encounter outcomes", "Wrote encounter outcomes"],
    sidekickdm_finish_generation: ["Reviewing the encounter", "Finished encounter generation"],
    sidekickdm_resume_generation: ["Resuming encounter generation", "Resumed encounter generation"],
    sidekickdm_cancel_generation: ["Stopping encounter generation", "Stopped encounter generation"],
    sidekickdm_apply_targeted_revision: ["Revising encounter guidance", "Applied the targeted revision"],
    sidekickdm_set_generation_assumptions: ["Recording assumptions", "Recorded generation assumptions"],
    sidekickdm_update_creative_brief: ["Updating the creative brief", "Updated the creative brief"],
    sidekickdm_set_reward_guidance: ["Writing reward guidance", "Wrote reward guidance"],
    sidekickdm_set_alternative_resolutions: ["Writing alternative resolutions", "Added alternative resolutions"],
    sidekickdm_undo: ["Restoring the previous change", "Restored the previous change"],
    sidekickdm_redo: ["Restoring the repeated change", "Restored the repeated change"],
    sidekickdm_save_custom_creature: ["Saving the custom creature", "Saved to the creature library"],
    sidekickdm_save_encounter: ["Saving the encounter", "Saved to the encounter library"],
    sidekickdm_start_run: ["Starting the live encounter", "Started the live encounter"],
    sidekickdm_set_initiative: ["Setting initiative", "Set initiative"],
    sidekickdm_advance_turn: ["Advancing the turn", "Advanced the turn"],
    sidekickdm_apply_damage: ["Applying damage", "Applied damage"],
    sidekickdm_apply_healing: ["Applying healing", "Applied healing"],
    sidekickdm_add_condition: ["Adding a condition", "Added the condition"],
    sidekickdm_remove_condition: ["Removing a condition", "Removed the condition"],
    sidekickdm_roll: ["Rolling dice", "Rolled the dice"]
  });
  const activitySummary = (name, input = {}, status = "started", result = null, target = null) => {
    const subject = target?.label ?? input.display_name ?? input.name ?? input.content_id ?? "the encounter";
    if (status === "failed") return `Needs attention · ${subject}`;
    const data = result?.data ?? {};
    const item = data.participant ?? data.hazard ?? null;
    const authoritativeItem = item ?? data.encounter?.hazards?.find?.(hazard => String(hazard.id) === String(target?.id));
    if (status === "completed" && ["sidekickdm_create_simple_hazard", "sidekickdm_add_existing_hazard"].includes(name)) {
      const label = authoritativeItem?.name ?? subject;
      return `Added ${label}${Number.isFinite(Number(authoritativeItem?.xp)) ? ` · +${Number(authoritativeItem.xp)} XP` : ""}`;
    }
    if (status === "completed" && name === "sidekickdm_create_custom_creature") return `Added ${authoritativeItem?.display_name ?? authoritativeItem?.name ?? subject}`;
    if (status === "canceled" && !name.includes("cancel_generation")) return `Canceled ${name.replace("sidekickdm_", "").replaceAll("_", " ")}`;
    if (name.includes("begin_generation")) return status === "completed" ? "Started encounter generation" : "Starting encounter generation";
    if (name.includes("finish_generation")) return status === "completed" ? "Finished encounter generation" : "Reviewing the encounter";
    if (name.includes("cancel_generation")) return status === "canceled" ? "Stopped encounter generation" : "Stopping encounter generation";
    if (name.includes("apply_generation_step")) {
      const count = array(data.participants).length + array(data.hazards).length;
      return status === "completed" ? input.step === "composition" ? `Added ${count} encounter element${count === 1 ? "" : "s"}` : "Wrote encounter guidance" : input.step === "composition" ? "Building the encounter roster" : "Writing encounter guidance";
    }
    if (name.includes("add_existing_participant")) return status === "completed" ? `Added ${subject}` : `Adding ${subject}`;
    const presentation = activityPresentation[name];
    if (presentation) return presentation[status === "completed" ? 1 : 0];
    if (name.includes("set_") || name.includes("update_")) return status === "completed" ? `Updated ${subject}` : `Updating ${subject}`;
    if (name.includes("save_")) return status === "completed" ? `Saved ${subject}` : `Saving ${subject}`;
    if (name.includes("plan_encounter")) {
      const creatureCount = result?.data?.candidates?.length ?? null;
      const hazardCount = result?.data?.hazards?.length ?? null;
      if (status !== "completed") return "Finding encounter options";
      if (creatureCount === 0 && hazardCount === 0) return "No catalog matches · Drafting custom opposition";
      if (creatureCount === 0 && hazardCount > 0) return `Found ${hazardCount} hazard option${hazardCount === 1 ? "" : "s"}`;
      return `Found ${creatureCount == null ? "opposition options" : `${creatureCount} opposition option${creatureCount === 1 ? "" : "s"}`}`;
    }
    if (name.includes("search_catalog")) {
      const count = result?.data?.results?.length ?? null;
      const kind = input.kind === "hazard" || input.include_hazards && input.kind !== "creature" ? "hazard" : "opposition";
      if (status === "completed" && count === 0) return kind === "hazard" ? "No matching hazards found · Creating custom hazards" : "No matching opposition found · Creating custom creatures";
      return status === "completed" ? `Found ${count == null ? `${kind} options` : `${count} ${kind} option${count === 1 ? "" : "s"}`}` : `Finding ${kind} options`;
    }
    return status === "completed" ? `Finished work on ${subject}` : `Working on ${subject}`;
  };
  const activityPreview = (name, status, result = null) => {
    if (status !== "completed") return null;
    const data = result?.data;
    if (!data) return null;
    if (name === "sidekickdm_draft_custom_creature" || name === "sidekickdm_fork_existing_creature") {
      const creature = data.creature ?? data.draft ?? data;
      return { kind: "creature", title: creature.identity?.name ?? "Custom creature draft", summary: `Level ${creature.identity?.level ?? "?"} · ${creature.identity?.encounter_role ?? creature.identity?.roadmap ?? "custom role"}`, note: "Preview only · the encounter has not changed" };
    }
    if (name === "sidekickdm_get_creature_benchmarks") return { kind: "guidance", title: `Level ${data.level ?? "?"} creature guidance`, summary: "Benchmark bands are ready for comparison.", note: "Reference only · the encounter has not changed" };
    if (name === "sidekickdm_get_hazard_benchmarks") return { kind: "guidance", title: `Level ${data.level ?? "?"} hazard guidance`, summary: `${data.complexity ?? "Simple"} hazard benchmarks are ready.`, note: "Reference only · the encounter has not changed" };
    if (name === "sidekickdm_preflight_generation" || name === "sidekickdm_plan_encounter") {
      const creatureCount = data.candidates?.length ?? 0;
      const hazardCount = data.hazards?.length ?? 0;
      const optionCount = creatureCount + hazardCount;
      return { kind: "plan", title: "Encounter plan preview", summary: `${optionCount} catalog option${optionCount === 1 ? "" : "s"} · ${data.budget?.construction_budget ?? data.construction_budget ?? "?"} XP budget`, note: "Preview only · the encounter has not changed" };
    }
    return null;
  };
  const activityDetail = (name, status, result = null, error = null) => {
    if (status === "failed") return error?.message ?? null;
    if (status === "canceled") return "Opening encounter restored.";
    const data = result?.data ?? {};
    const item = data.participant ?? data.hazard ?? null;
    if (item) {
      const facts = [];
      if (item.level != null) facts.push(`Level ${item.level}`);
      if (item.adjustment && item.adjustment !== "normal") facts.push(String(item.adjustment).replace(/^./, letter => letter.toUpperCase()));
      if (item.faction) facts.push(String(item.faction).replaceAll("_", " "));
      if (item.encounter_role) facts.push(String(item.encounter_role).replaceAll("_", " "));
      if (item.participation?.mode) facts.push(item.participation.mode);
      return facts.join(" · ") || null;
    }
    if (name.includes("search_catalog") || name.includes("plan_encounter")) {
      const count = data.results?.length ?? data.candidates?.length;
      if (count === 0) return "No direct match in the bundled catalog.";
      if (count != null) return `${count} catalog option${count === 1 ? "" : "s"} reviewed.`;
    }
    if (name.includes("save_")) return "Available from the Library.";
    return data.detail ?? result?.detail ?? null;
  };

  async function execute(name, input = {}, signal) {
    const eventID = activityID();
    const phase = activityPhase(name, input);
    const runID = input?.generation_run_id ?? null;
    const emit = (status, state, error = null, result = null) => {
      const target = activityTarget(name, input, state, result);
      const event = { event_id: eventID, tool_name: name, generation_run_id: runID ?? state?.generationRunID ?? null, timestamp: new Date().toISOString(), status, phase, encounter_label: state?.draft?.title ?? null, target_label: target.label, target, ui_target: target, summary: activitySummary(name, input, status, result, target), detail: activityDetail(name, status, result, error), preview: activityPreview(name, status, result), ...(error ? { error } : {}) };
      if (typeof source.onToolActivity === "function") source.onToolActivity(event);
      return event;
    };
    let preflightState = {};
    try {
      preflightState = await readState();
      if (signal?.aborted) throw Object.assign(new Error("The WebMCP registration is no longer active."), { code: "invalid_request" });
      validateToolInput(name, input);
      validateMutationPreconditions(name, input, preflightState);
    } catch (error) {
      const failed = emit(signal?.aborted ? "canceled" : "failed", preflightState, errorPayload(error));
      const result = envelope(preflightState, undefined, errorPayload(error));
      return { ...result, activity: { ...failed, started_at: failed.timestamp } };
    }
    const started = emit("started", preflightState);
    const result = await executeCommand(name, input, signal);
    const state = await readState().catch(() => ({}));
    const finished = emit(result?.ok ? (name === `${TOOL_PREFIX}cancel_generation` ? "canceled" : "completed") : (signal?.aborted ? "canceled" : "failed"), state, result?.error ?? null, result);
    return { ...result, activity: { ...finished, started_at: started.timestamp } };
  }

  async function register() {
    if (engineStatus?.state === "update_required") return registrationResult(updateConnection({ state: "update_required", available: false, label: engineStatus.label }));
    if (engineStatus?.state === "unavailable") return registrationResult(updateConnection({ state: "unavailable", available: false, label: engineStatus.label }));
    const modelContext = resolveContext(source);
    if (!modelContext) return registrationResult(updateConnection({ state: "unavailable", available: false, label: "WebMCP unavailable in this browser" }));
    const registerTool = modelContext.registerTool ?? modelContext.addTool;
    if (typeof registerTool !== "function") return registrationResult(updateConnection({ state: "unavailable", available: false, label: "WebMCP detected · adapter pending" }));
    const existing = registrationsByContext.get(modelContext);
    if (existing) {
      const result = await existing;
      updateConnection({ state: result.available ? "connected" : "disconnected", ...result });
      return result;
    }
    updateConnection({ state: "connecting", available: false, label: "WebMCP connecting" });
    const lifecycle = {
      abortController: typeof AbortController === "function" ? new AbortController() : null,
      handles: [],
      owner: source.registrationOwner ?? (source.modelContext === undefined ? globalThis.document : null),
      ownerHandler: null,
      toolChangeHandler: null,
      updateConnection,
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
          }, { signal: lifecycle.abortController?.signal });
          if (handle && lifecycle.disposed) await disposeRegistrationHandle(handle);
          else if (handle) lifecycle.handles.push(handle);
        }
        if (lifecycle.disposed) return registrationResult(updateConnection({ state: "disconnected", available: false, label: "WebMCP disconnected" }));
        if (typeof modelContext.addEventListener === "function") {
          lifecycle.toolChangeHandler = () => { void refreshConnection(modelContext, lifecycle); };
          modelContext.addEventListener("toolchange", lifecycle.toolChangeHandler);
        }
        return registrationResult(await refreshConnection(modelContext, lifecycle));
      } catch (error) {
        await disposeLifecycle(modelContext, lifecycle);
        console.warn("Sidekick DM could not register WebMCP tools", error);
        return registrationResult(updateConnection({ state: "unavailable", available: false, label: "WebMCP unavailable · human mode active" }));
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
    if (!lifecycle) return registrationResult(updateConnection({ state: "disconnected", available: false, label: "WebMCP not registered" }));
    await disposeLifecycle(modelContext, lifecycle);
    return { available: false, label: "WebMCP disconnected" };
  }

  function onConnectionChange(listener) {
    if (typeof listener !== "function") throw new TypeError("A WebMCP connection listener is required.");
    connectionListeners.add(listener);
    listener(connectionStatus);
    return () => connectionListeners.delete(listener);
  }

  return Object.freeze({ execute, register, unregister, dispose: unregister, getConnectionStatus: () => connectionStatus, onConnectionChange, toolDefinitions: () => TOOL_DEFINITIONS });
}

export async function registerWebMCP(options = {}) {
  return createWebMCPAdapter(options).register();
}

export const createReadDispatcher = createWebMCPAdapter;
