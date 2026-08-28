/*
 * Sidekick DM's browser-only, read-only WebMCP adapter.
 *
 * The adapter deliberately depends on projections supplied by the host. It
 * does not know how the Swift/Wasm engine stores or mutates an Encounter.
 */

import { commitCustomCreature, forkExistingCreature, validateCustomCreature } from "./creature-generation.js";
import { createSimpleHazard, validateSimpleHazard } from "./hazard-builder.js";

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

const freeformObject = Object.freeze({ type: "object", additionalProperties: true });

const targetedRevisionProperties = Object.freeze({
  encounter_id: { type: "string", minLength: 1 },
  expected_encounter_revision: { type: "integer", minimum: 0 },
  section: { type: "string", enum: ["encounter_identity", "setup", "battlefield_guidance", "running_guidance", "cohesion", "information_visibility", "outcomes"] },
  value: freeformObject
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
  definition(`${TOOL_PREFIX}get_catalog_entry`, "Read one full game-facing Catalog Entry and its Catalog Provenance.", catalogEntryInput, { untrusted: true })
]);

const WRITE_TOOL_DEFINITIONS = Object.freeze([
  writeDefinition(`${TOOL_PREFIX}begin_generation`, "Begin a revision-checked Generation Run after acknowledging GM-owned Content Boundaries.", { ...revisionProperties, content_boundaries_acknowledged: { type: "boolean" }, intent_summary: { type: "string" } }, ["encounter_id", "expected_encounter_revision", "expected_brief_revision", "expected_constraints_revision", "content_boundaries_acknowledged"]),
  writeDefinition(`${TOOL_PREFIX}add_existing_participant_group`, "Add one complete supported Catalog Creature during a Generation Run.", { ...revisionProperties, content_id: { type: "string", minLength: 1 }, quantity: { type: "integer", minimum: 1 }, adjustment: { type: "string", enum: ["weak", "normal", "elite"] }, faction: { type: "string" }, participation: freeformObject, encounter_role: { type: "string" }, narrative_tier: { type: "string" }, starting_area: { type: "string" }, shared_tactics: { type: "string" }, morale: { type: "string" } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "content_id"]),
  definition(`${TOOL_PREFIX}fork_existing_creature`, "Create a detached Forked Creature draft from a complete supported Catalog Creature while preserving existing spellcasting blocks.", { type: "object", properties: { content_id: { type: "string", minLength: 1 }, id: { type: "string" } }, required: ["content_id"], additionalProperties: false }, { untrusted: true }),
  definition(`${TOOL_PREFIX}validate_custom_creature`, "Validate an Original or Forked Creature without mutating the Encounter.", { type: "object", properties: { creature: freeformObject }, required: ["creature"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_custom_creature`, "Validate, embed, and place an Original or Forked Creature atomically.", { ...revisionProperties, creature: freeformObject, quantity: { type: "integer", minimum: 1 }, starting_area: { type: "string" } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "creature"]),
  writeDefinition(`${TOOL_PREFIX}update_custom_creature`, "Validate and replace an encounter-embedded Original or Forked Creature and update its Participant Group projection atomically.", { ...revisionProperties, creature: freeformObject }, ["encounter_id", "expected_encounter_revision", "expected_constraints_revision", "creature"]),
  definition(`${TOOL_PREFIX}validate_simple_hazard`, "Validate a custom Simple Hazard without mutating the Encounter.", { type: "object", properties: { hazard: freeformObject }, required: ["hazard"], additionalProperties: false }, { untrusted: true }),
  writeDefinition(`${TOOL_PREFIX}create_simple_hazard`, "Validate, embed, and place a custom Simple Hazard atomically.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "hazard"]),
  writeDefinition(`${TOOL_PREFIX}update_hazard`, "Update an encounter-embedded custom Simple Hazard and its participation or placement.", { ...revisionProperties, hazard: freeformObject, participation_mode: { type: "string", enum: ["mandatory", "avoidable", "conditional", "reinforcement"] }, participation_condition: { type: "string" }, placement: { type: "string" } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "hazard"]),
  writeDefinition(`${TOOL_PREFIX}remove_component`, "Remove an encounter placement without deleting reusable library records.", { ...revisionProperties, component_id: { type: "string", minLength: 1 } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "component_id"]),
  writeDefinition(`${TOOL_PREFIX}upsert_phase`, "Validate and add or replace one structured Encounter Phase.", { ...revisionProperties, phase: freeformObject }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "phase"]),
  ...["encounter_identity", "setup", "battlefield_guidance", "running_guidance", "cohesion", "information_visibility", "outcomes"].map(section => writeDefinition(`${TOOL_PREFIX}set_${section}`, `Set the semantic Encounter Packet ${section.replaceAll("_", " ")} section.`, { ...revisionProperties, value: freeformObject }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "value"])),
  writeDefinition(`${TOOL_PREFIX}finish_generation`, "Finish a structurally complete Generation Run and preserve Design Warnings for review.", { ...revisionProperties, completion_note: { type: "string" } }, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision"]),
  writeDefinition(`${TOOL_PREFIX}cancel_generation`, "Cancel a Generation Run and restore its opening Encounter state.", revisionProperties, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision"]),
  writeDefinition(`${TOOL_PREFIX}apply_targeted_revision`, "Apply one named agent-authored revision after a Generation Run; undo restores the finished run first, then the opening Encounter.", targetedRevisionProperties, ["encounter_id", "expected_encounter_revision", "section", "value"]),
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
  const code = text(source?.code) || "application_error";
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
    effective_level: number(firstDefined(party.effective_level, party.effectiveLevel), 1),
    size: number(party.size, 4),
    mixed_level_notes: firstDefined(party.mixed_level_notes, party.mixedLevelNotes) ?? null,
    allied_combatants: array(firstDefined(party.allied_combatants, party.alliedCombatants)),
    capabilities: {
      strengths: array(capabilities.strengths),
      weaknesses: array(capabilities.weaknesses),
      notes: text(capabilities.notes)
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
      kind: firstDefined(target.kind, "moderate"),
      custom_xp: firstDefined(target.custom_xp, target.customXP) ?? null
    },
    creative: {
      purpose: text(firstDefined(creative.purpose, brief.purpose)),
      premise: text(firstDefined(creative.premise, brief.premise)),
      theme: array(firstDefined(creative.theme, brief.theme)),
      environment: text(firstDefined(creative.environment, brief.environment)),
      tone: array(firstDefined(creative.tone, brief.tone)),
      desired_complexity: firstDefined(creative.desired_complexity, creative.desiredComplexity, brief.desiredComplexity) ?? null,
      existing_vs_custom: firstDefined(creative.existing_vs_custom, creative.existingVsCustom, brief.existingVsCustom) ?? null,
      preferred_traits: array(firstDefined(creative.preferred_traits, creative.preferredTraits, brief.preferredTraits)),
      excluded_traits: array(firstDefined(creative.excluded_traits, creative.excludedTraits, brief.excludedTraits)),
      source_restrictions: array(firstDefined(creative.source_restrictions, creative.sourceRestrictions, brief.sourceRestrictions)),
      approximate_play_minutes: firstDefined(creative.approximate_play_minutes, creative.approximatePlayMinutes, brief.approximatePlayMinutes) ?? null
    },
    content_boundaries: {
      lines: array(boundaries.lines),
      veils: array(boundaries.veils),
      excluded_themes: array(firstDefined(boundaries.excluded_themes, boundaries.excludedThemes)),
      tone_limits: clone(boundaries.tone_limits ?? boundaries.toneLimits ?? {}),
      notes: text(boundaries.notes)
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
    target_threat: firstDefined(budget.target_threat, budget.targetThreat, "moderate"),
    base_target_xp: number(firstDefined(budget.base_target_xp, budget.baseTargetXP)),
    party_size_adjustment: number(firstDefined(budget.party_size_adjustment, budget.partySizeAdjustment)),
    construction_budget: number(firstDefined(budget.construction_budget, budget.constructionBudget)),
    guaranteed_xp: number(firstDefined(budget.guaranteed_xp, budget.guaranteedXP)),
    avoidable_xp: number(firstDefined(budget.avoidable_xp, budget.avoidableXP)),
    conditional_xp: number(firstDefined(budget.conditional_xp, budget.conditionalXP)),
    peak_active_xp: number(firstDefined(budget.peak_active_xp, budget.peakActiveXP)),
    total_encounter_xp: number(firstDefined(budget.total_encounter_xp, budget.totalEncounterXP)),
    base_xp_award: number(firstDefined(budget.base_xp_award, budget.baseXPAward)),
    terrain_adjustment: number(firstDefined(budget.terrain_adjustment, budget.terrainAdjustment)),
    inferred_threat: firstDefined(budget.inferred_threat, budget.inferredThreat, "trivial"),
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
      active_xp: number(firstDefined(item.activeXP, item.active_xp)),
      terrain_adjustment: number(firstDefined(item.terrainAdjustment, item.terrain_adjustment)),
      participation: keysToSnake(item.participation ?? {})
    })),
    guaranteed_xp: number(firstDefined(budget.guaranteedXP, budget.guaranteed_xp)),
    avoidable_xp: number(firstDefined(budget.avoidableXP, budget.avoidable_xp)),
    conditional_xp: number(firstDefined(budget.conditionalXP, budget.conditional_xp)),
    reinforcement_xp: number(firstDefined(budget.reinforcementXP, budget.reinforcement_xp)),
    peak_active_xp: number(firstDefined(budget.peakActiveXP, budget.peak_active_xp)),
    total_encounter_xp: number(firstDefined(budget.totalEncounterXP, budget.total_encounter_xp)),
    terrain_adjustment: number(firstDefined(budget.terrainAdjustment, budget.terrain_adjustment)),
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
  const missing = array(firstDefined(readiness.missing_required_packet_sections, readiness.missingRequiredPacketSections, readiness.missingSections));
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

function projectParticipant(group) {
  const participation = group.participation ?? {};
  return {
    id: text(group.id),
    content_id: firstDefined(group.content_id, group.contentID) ?? null,
    name: text(group.name),
    level: number(group.level),
    quantity: number(group.quantity, 1),
    adjustment: firstDefined(group.adjustment, "normal"),
    faction: firstDefined(group.faction, "primary_opposition"),
    participation: {
      mode: firstDefined(participation.mode, "mandatory"),
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
    name: text(hazard.name),
    level: number(hazard.level),
    complexity: firstDefined(hazard.complexity, "simple"),
    participation: {
      mode: firstDefined(participation.mode, "avoidable"),
      condition: firstDefined(participation.condition) ?? null
    },
    placement: text(hazard.placement)
  };
}

function projectPhase(phase) {
  const trigger = phase.trigger && typeof phase.trigger === "object" ? clone(phase.trigger) : { kind: "custom", explanation: text(phase.trigger), value: null, can_overlap: true };
  return {
    id: text(phase.id),
    title: text(phase.title),
    order: number(phase.order),
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
    encounter_id: text(draft.id),
    title: text(draft.title),
    premise: text(firstDefined(draft.packet?.premise, draft.brief?.premise, draft.brief?.creative?.premise)),
    party: {
      effective_level: number(firstDefined(draft.brief?.party?.effectiveLevel, draft.brief?.party?.effective_level), 1),
      size: number(draft.brief?.party?.size, 4)
    },
    target_threat: firstDefined(target.kind, "moderate"),
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
    phases: array(draft.phases).map(projectPhase),
    phase_budget: projectPhaseBudget(snapshot),
    readiness: { status: readiness.status, structural_error_count: readiness.structural_errors.length, design_warning_count: readiness.design_warnings.length },
    review_state: readiness.review_state,
    generation: state.generationRunID ? { id: state.generationRunID, state: firstDefined(draft.generation?.state, "active") } : null,
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
      fixture_version: number(fixture.fixture_version, 1),
      party_level_focus: array(fixture.party_level_focus ?? fixture.partyLevelFocus).length > 0 ? array(fixture.party_level_focus ?? fixture.partyLevelFocus) : [1, 10]
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

function searchCatalog(catalog, input) {
  if (!catalog || typeof catalog.search !== "function") throw Object.assign(new Error("The Sidekick DM Catalog is not available."), { code: "catalog_unavailable" });
  const result = clone(catalog.search(input));
  if (result && typeof result === "object" && "hasMore" in result && !("has_more" in result)) {
    result.has_more = Boolean(result.hasMore);
    delete result.hasMore;
  }
  return result;
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
        case `${TOOL_PREFIX}search_catalog`:
          return envelope(state, searchCatalog(catalog, input));
        case `${TOOL_PREFIX}get_catalog_entry`: {
          const contentID = text(input.content_id);
          if (!contentID) throw Object.assign(new Error("A Catalog ContentID is required."), { code: "invalid_request" });
          return envelope(state, catalogEntry(catalog, contentID));
        }
        case `${TOOL_PREFIX}begin_generation`:
          return await executeMutation(mutationCommand(name, input), next => ({ generation_run_id: next.generationRunID, opening_revision: state.encounterRevision, readiness: projectReadiness(next.snapshot, requireDraft(next)) }));
        case `${TOOL_PREFIX}add_existing_participant_group`: {
          const entry = catalogEntry(catalog, text(input.content_id));
          return await executeMutation(mutationCommand(name, input, { catalog_entry: entry, name: entry.name, level: entry.level }));
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
        case `${TOOL_PREFIX}update_custom_creature`: {
          const creature = commitCustomCreature(keysToCamel(input.creature), { origin: "webmcp" });
          return await executeMutation(mutationCommand(name, { ...input, creature }));
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
