import { validatePacket } from "./encounter-packet.js";
import { createSimpleHazard as createValidatedSimpleHazard, validateSimpleHazard } from "./hazard-builder.js";
import { PhaseAuthoringStore } from "./encounter-phases.js";

export const GENERATION_RUN_STATES = Object.freeze({
  ACTIVE: "active",
  INTERRUPTED: "interrupted"
});

export const GENERATION_PACKET_SECTIONS = Object.freeze([
  "identity",
  "setup",
  "battlefield",
  "running_guidance",
  "cohesion",
  "information",
  "outcomes",
  "reward_guidance",
  "alternative_resolutions"
]);

const clone = (value) => {
  if (value === undefined) return undefined;
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
};

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);
const text = (value) => typeof value === "string" ? value : value == null ? "" : String(value);
const integer = (value, fallback = null) => {
  const result = Number(value);
  return Number.isInteger(result) ? result : fallback;
};

export class GenerationRunError extends Error {
  constructor(code, message, details = undefined) {
    super(message);
    this.name = "GenerationRunError";
    this.code = code;
    if (details && typeof details === "object" && Object.keys(details).length > 0) this.details = clone(details);
  }
}

function error(code, message, details) {
  return new GenerationRunError(code, message, details);
}

function value(input, camel, snake = camel) {
  return firstDefined(input?.[camel], input?.[snake]);
}

function packetValue(section, valueToSet) {
  const key = section === "running_guidance" ? "runningGuidance" : section === "reward_guidance" ? "rewardGuidance" : section === "alternative_resolutions" ? "alternativeResolutions" : section;
  return [key, valueToSet];
}

function packetFor(draft) {
  return clone(draft.packetV1 ?? draft.packet_v1 ?? draft.packet ?? {});
}

/**
 * Browser-side transactional Generation Run state. The host forwards its
 * semantic commands to Swift, while this controller provides local autosave,
 * interrupted-reload state, and a deterministic UI-facing contract.
 */
export class GenerationRunController {
  constructor({ draft = {}, briefRevision = 0, activity = [] } = {}) {
    this.draft = clone(draft);
    this.briefRevision = integer(briefRevision, 0);
    this.activity = clone(activity);
    this.history = [];
    this.redoHistory = [];
    this.openingSnapshot = null;
    this.lastWarnings = [];
    const generation = this.draft.generation ?? this.draft.generation_state;
    if (generation?.openingDraft) this.openingSnapshot = clone(generation.openingDraft);
    else if (generation?.opening_draft) this.openingSnapshot = clone(generation.opening_draft);
    else if (typeof generation?.openingDraftJSON === "string") {
      try { this.openingSnapshot = JSON.parse(generation.openingDraftJSON); } catch { this.openingSnapshot = null; }
    }
    else if (typeof generation?.opening_draft_json === "string") {
      try { this.openingSnapshot = JSON.parse(generation.opening_draft_json); } catch { this.openingSnapshot = null; }
    }
  }

  get encounterRevision() { return integer(value(this.draft, "revision"), 0); }
  get constraintsRevision() { return integer(value(this.draft, "constraintsRevision", "constraints_revision"), 0); }
  get generation() { return this.draft.generation ?? this.draft.generation_state ?? null; }
  get generationRunID() { return this.generation?.id ?? null; }
  get generationState() { return this.generation?.state ?? null; }
  get manualWritesLocked() { return this.generation !== null; }
  get canUndo() { return this.history.length > 0; }
  get canRedo() { return this.redoHistory.length > 0; }
  get phaseBudget() {
    const document = { ...this.draft, phases: this.draft.structuredPhases ?? this.draft.structured_phases ?? this.draft.phases ?? [] };
    return new PhaseAuthoringStore(document).budget;
  }

  snapshot() {
    return {
      draft: clone(this.draft),
      encounter_revision: this.encounterRevision,
      constraints_revision: this.constraintsRevision,
      brief_revision: this.briefRevision,
      generation_run_id: this.generationRunID,
      generation_state: this.generationState,
      manual_write_locked: this.manualWritesLocked,
      activity: clone(this.activity),
      can_undo: this.canUndo,
      can_redo: this.canRedo,
      warnings: clone(this.lastWarnings),
      phase_budget: clone(this.phaseBudget)
    };
  }

  begin(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    this.checkEncounter(encounterID, integer(value(input, "expectedEncounterRevision", "expected_encounter_revision"), NaN));
    this.checkBrief(integer(value(input, "expectedBriefRevision", "expected_brief_revision"), NaN));
    this.checkConstraints(integer(value(input, "expectedConstraintsRevision", "expected_constraints_revision"), NaN));
    if (value(input, "contentBoundariesAcknowledged", "content_boundaries_acknowledged") !== true) throw error("content_constraint_not_acknowledged", "The agent must acknowledge the GM's Content Boundaries before generation can begin.");
    if (this.generation) throw error("generation_already_active", "A Generation Run is already active.");

    const opening = clone(this.draft);
    const runID = text(value(input, "generationRunID", "generation_run_id")) || `run_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    this.draft.generation = {
      id: runID,
      state: GENERATION_RUN_STATES.ACTIVE,
      openingDraft: clone(opening),
      openingDraftJSON: JSON.stringify(opening),
      intentSummary: text(value(input, "intentSummary", "intent_summary"))
    };
    this.openingSnapshot = opening;
    this.commitRevision(text(value(input, "origin")) || "webmcp");
    this.record("Began Generation Run", text(value(input, "origin")) || "webmcp");
    return { generation_run_id: runID, opening_revision: opening.revision, snapshot: this.snapshot() };
  }

  beginGeneration(input = {}) { return this.begin(input); }

  resume(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    const runID = text(value(input, "generationRunID", "generation_run_id"));
    this.checkEncounter(encounterID, integer(value(input, "expectedEncounterRevision", "expected_encounter_revision"), NaN));
    this.checkConstraints(integer(value(input, "expectedConstraintsRevision", "expected_constraints_revision"), NaN));
    if (!this.generation) throw error("no_active_generation", "There is no interrupted Generation Run to resume.");
    if (runID !== this.generationRunID) throw error("wrong_generation_run", `Generation Run ${runID} is not active.`, { expected_generation_run_id: runID, current_generation_run_id: this.generationRunID });
    if (this.generationState !== GENERATION_RUN_STATES.INTERRUPTED) throw error("generation_not_interrupted", "Only an interrupted Generation Run can be resumed.");
    this.draft.generation.state = GENERATION_RUN_STATES.ACTIVE;
    this.commitRevision(text(value(input, "origin")) || "webmcp");
    this.record("Resumed Generation Run", text(value(input, "origin")) || "webmcp");
    return this.snapshot();
  }

  resumeGeneration(input = {}) { return this.resume(input); }

  mutate(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    const generationRunID = text(value(input, "generationRunID", "generation_run_id"));
    const expectedEncounterRevision = value(input, "expectedEncounterRevision", "expected_encounter_revision");
    const expectedConstraintsRevision = value(input, "expectedConstraintsRevision", "expected_constraints_revision");
    const origin = text(value(input, "origin")) || "webmcp";
    const description = text(value(input, "description")) || "Generation Run mutation";
    const operation = input.operation;
    this.checkActive(encounterID, generationRunID, expectedEncounterRevision, expectedConstraintsRevision);
    if (origin === "gm" || origin === "manual") throw error("manual_write_locked", "Manual writes are locked while a Generation Run is active. Reads remain available.");
    if (typeof operation !== "function") throw error("invalid_request", "A semantic Generation Run operation is required.");
    const next = clone(this.draft);
    operation(next);
    this.draft = next;
    this.commitRevision(origin);
    this.record(description, origin);
    return this.snapshot();
  }

  addExistingParticipantGroup(input = {}) {
    const catalogEntry = value(input, "catalogEntry", "catalog_entry") ?? {};
    const contentID = text(value(input, "contentID", "content_id") ?? catalogEntry.content_id ?? catalogEntry.contentID);
    const name = text(value(input, "name") ?? catalogEntry.name);
    const kind = text(catalogEntry.kind);
    if (kind && kind !== "creature") throw error("invalid_participant_group", "Only Creature Catalog Entries can be added as Participant Groups.");
    if (catalogEntry.completeness && catalogEntry.completeness !== "complete" || catalogEntry.support && catalogEntry.support !== "supported") throw error("catalog_entry_partial", "Only complete, supported Catalog Entries can be added as Existing Participant Groups.");
    const quantity = integer(value(input, "quantity"), 1);
    const level = integer(value(input, "level") ?? catalogEntry.level, 1);
    if (!contentID || !name || quantity < 1) throw error(quantity < 1 ? "invalid_quantity" : "invalid_participant_group", quantity < 1 ? "Participant quantity must be at least 1." : "An Existing Participant Group needs a ContentID and name.");
    const id = text(value(input, "id")) || `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    const participant = {
      id,
      contentID,
      name,
      level,
      quantity,
      adjustment: text(value(input, "adjustment")) || "normal",
      faction: text(value(input, "faction")) || "primary_opposition",
      participation: clone(value(input, "participation")) ?? { mode: text(value(input, "participationMode", "participation_mode")) || "mandatory" },
      encounterRole: text(value(input, "encounterRole", "encounter_role")) || "brute",
      narrativeTier: text(value(input, "narrativeTier", "narrative_tier")) || "incidental",
      startingArea: text(value(input, "startingArea", "starting_area")),
      sharedTactics: text(value(input, "sharedTactics", "shared_tactics")),
      morale: text(value(input, "morale"))
    };
    this.mutate({ ...input, description: `Added Existing Participant Group ${name}`, operation: (draft) => {
      draft.participantGroups = [...(draft.participantGroups ?? []), participant];
    } });
    return { id, snapshot: this.snapshot() };
  }

  upsertPhase(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    const generationRunID = text(value(input, "generationRunID", "generation_run_id"));
    const expectedEncounterRevision = value(input, "expectedEncounterRevision", "expected_encounter_revision");
    const expectedConstraintsRevision = value(input, "expectedConstraintsRevision", "expected_constraints_revision");
    const origin = text(value(input, "origin")) || "webmcp";
    this.checkActive(encounterID, generationRunID, expectedEncounterRevision, expectedConstraintsRevision);
    const phase = clone(value(input, "phase") ?? {});
    const document = { ...this.draft, phases: this.draft.structuredPhases ?? this.draft.structured_phases ?? this.draft.phases ?? [] };
    const authoring = new PhaseAuthoringStore(document);
    authoring.upsert(phase, null, origin);
    const phases = authoring.phases;
    const legacyPhase = item => ({ id: item.id, title: item.title, order: item.order ?? 0, participantIDs: [...(item.participantIDs ?? [])], hazardIDs: [...(item.hazardIDs ?? [])], trigger: item.trigger?.explanation ?? "", runningGuidance: item.runningGuidance ?? "" });
    return this.mutate({ ...input, description: `Authored Phase ${text(phase.title)}`, operation: draft => {
      draft.structuredPhases = clone(phases);
      draft.phases = phases.map(legacyPhase);
    } });
  }

  validateSimpleHazard(hazard) {
    return validateSimpleHazard(clone(hazard));
  }

  createSimpleHazard(input = {}) {
    const hazard = createValidatedSimpleHazard(clone(value(input, "hazard") ?? {}));
    const id = text(hazard.id);
    if (!id) throw error("invalid_hazard", "A Simple Hazard ID is required.");
    this.mutate({ ...input, description: `Created Simple Hazard ${text(hazard.identity?.name)}`, operation: (draft) => {
      const hazards = draft.hazards ?? [];
      const customHazards = draft.customHazards ?? draft.custom_hazards ?? [];
      if (hazards.some((item) => item.id === id) || customHazards.some((item) => item.id === id)) throw error("duplicate_component", "That Hazard is already in the Encounter.");
      const participation = clone(value(input, "participation")) ?? { mode: text(value(input, "participationMode", "participation_mode")) || "avoidable", condition: value(input, "participationCondition", "participation_condition") ?? null };
      const encounterHazard = {
        id,
        contentID: hazard.provenance?.catalogContentID ?? hazard.provenance?.catalog_content_id ?? `hazard/custom/${id}/current`,
        name: text(hazard.identity?.name),
        level: Number(hazard.identity?.level ?? 1),
        complexity: "simple",
        participation,
        placement: text(value(input, "placement"))
      };
      draft.customHazards = [...customHazards, hazard];
      draft.hazards = [...hazards, encounterHazard];
    } });
    return { id, snapshot: this.snapshot() };
  }

  updateSimpleHazard(input = {}) {
    const hazard = createValidatedSimpleHazard(clone(value(input, "hazard") ?? {}));
    const id = text(hazard.id);
    this.mutate({ ...input, description: `Updated Simple Hazard ${text(hazard.identity?.name)}`, operation: (draft) => {
      const customHazards = draft.customHazards ?? draft.custom_hazards ?? [];
      const customIndex = customHazards.findIndex((item) => item.id === id);
      const encounterIndex = (draft.hazards ?? []).findIndex((item) => item.id === id);
      if (customIndex < 0) throw error("unknown_component", "That Simple Hazard is not in the Encounter.");
      if (encounterIndex < 0) throw error("invalid_hazard", "The Simple Hazard placement is missing from the Encounter.");
      const placed = { ...draft.hazards[encounterIndex], name: text(hazard.identity?.name), level: Number(hazard.identity?.level ?? 1), contentID: hazard.provenance?.catalogContentID ?? hazard.provenance?.catalog_content_id ?? `hazard/custom/${id}/current` };
      const participation = value(input, "participation");
      const placement = value(input, "placement");
      if (participation !== undefined) placed.participation = clone(participation);
      if (placement !== undefined) placed.placement = text(placement);
      draft.customHazards = customHazards.map((item, index) => index === customIndex ? hazard : item);
      draft.hazards = draft.hazards.map((item, index) => index === encounterIndex ? placed : item);
    } });
    return this.snapshot();
  }

  removeSimpleHazard(input = {}) {
    const id = text(value(input, "hazardID", "hazard_id") ?? value(input, "componentID", "component_id"));
    if (!id) throw error("invalid_request", "A Hazard ID is required.");
    this.mutate({ ...input, description: `Removed Simple Hazard ${id}`, operation: (draft) => {
      const customHazards = draft.customHazards ?? draft.custom_hazards ?? [];
      if (!customHazards.some((item) => item.id === id) || !(draft.hazards ?? []).some((item) => item.id === id)) throw error("unknown_component", "That Simple Hazard is not in the Encounter.");
      draft.customHazards = customHazards.filter((item) => item.id !== id);
      draft.hazards = draft.hazards.filter((item) => item.id !== id);
    } });
    return this.snapshot();
  }

  setPacketSection(input = {}) {
    const rawSection = text(value(input, "section")).trim();
    const section = rawSection;
    if (!GENERATION_PACKET_SECTIONS.includes(section)) throw error("invalid_packet_section", `Unknown Encounter Packet section: ${rawSection}.`);
    const sectionValue = clone(value(input, "value"));
    if ((sectionValue == null && section !== "reward_guidance") || (typeof sectionValue !== "object" && sectionValue !== null && section !== "reward_guidance")) throw error("invalid_packet_section", "The Encounter Packet section payload is invalid.");
    return this.mutate({ ...input, description: `Updated Encounter Packet ${section}`, operation: (draft) => {
      const packet = packetFor(draft);
      const [key, nextValue] = packetValue(section, sectionValue);
      packet[key] = nextValue;
      draft.packetV1 = packet;
      draft.packet = {
        premise: packet.identity?.premise ?? draft.packet?.premise ?? "",
        objective: packet.identity?.objective ?? draft.packet?.objective ?? "",
        setup: packet.setup?.trigger ?? draft.packet?.setup ?? "",
        runningGuidance: packet.runningGuidance?.openingTactics ?? draft.packet?.runningGuidance ?? "",
        cohesion: packet.cohesion?.participantPresence ?? draft.packet?.cohesion ?? "",
        outcomes: packet.outcomes?.victory ?? draft.packet?.outcomes ?? ""
      };
      if (section === "identity" && sectionValue.title) draft.title = sectionValue.title;
    } });
  }

  finish(input = {}) {
    this.checkActive(input.encounterID ?? input.encounter_id, input.generationRunID ?? input.generation_run_id, input.expectedEncounterRevision ?? input.expected_encounter_revision, input.expectedConstraintsRevision ?? input.expected_constraints_revision);
    const readiness = validatePacket(packetFor(this.draft));
    if (!readiness.isStructurallyReady) throw error("generation_structural_errors", "The Encounter Packet has structural errors that prevent finishing the Generation Run.", { missing_sections: readiness.missingSections, structural_errors: clone(readiness.structuralErrors) });
    if (!this.openingSnapshot) throw error("no_active_generation", "The opening Generation Run snapshot is unavailable.");
    this.history.push(clone(this.openingSnapshot));
    this.redoHistory = [];
    this.draft.generation = null;
    this.draft.reviewState = "needed";
    this.lastWarnings = clone(readiness.designWarnings);
    const origin = text(value(input, "origin")) || "webmcp";
    this.commitRevision(origin);
    this.record("Finished Generation Run", origin);
    this.openingSnapshot = null;
    return { revision: this.encounterRevision, warnings: clone(this.lastWarnings), snapshot: this.snapshot() };
  }

  finishGeneration(input = {}) { return this.finish(input); }

  cancel(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    const expectedRevision = integer(value(input, "expectedEncounterRevision", "expected_encounter_revision"), NaN);
    this.checkEncounter(encounterID, expectedRevision);
    if (!this.generation) throw error("no_active_generation", "There is no active Generation Run.");
    const runID = text(value(input, "generationRunID", "generation_run_id"));
    if (runID !== this.generationRunID) throw error("wrong_generation_run", `Generation Run ${runID} is not active.`, { expected_generation_run_id: runID, current_generation_run_id: this.generationRunID });
    if (!this.openingSnapshot) throw error("no_active_generation", "The opening Generation Run snapshot is unavailable.");
    const restored = clone(this.openingSnapshot);
    restored.revision = this.encounterRevision + 1;
    restored.generation = null;
    this.draft = restored;
    this.openingSnapshot = null;
    const origin = text(value(input, "origin")) || "webmcp";
    this.record("Cancelled Generation Run", origin, expectedRevision, this.encounterRevision);
    return { revision: this.encounterRevision, snapshot: this.snapshot() };
  }

  cancelGeneration(input = {}) { return this.cancel(input); }

  undo({ expectedEncounterRevision, origin = "gm" } = {}) {
    this.checkRevision(expectedEncounterRevision);
    if (this.generation) throw error("manual_write_locked", "Manual writes are locked while a Generation Run is active. Reads remain available.");
    if (!this.history.length) throw error("nothing_to_undo", "There is no completed Mutation to undo.");
    this.redoHistory.push(clone(this.draft));
    const restored = clone(this.history.pop());
    restored.revision = this.encounterRevision + 1;
    restored.generation = null;
    this.draft = restored;
    this.record("Undid the last Mutation", origin);
    return this.snapshot();
  }

  applyTargetedRevision(input = {}) {
    const encounterID = text(value(input, "encounterID", "encounter_id"));
    const expectedEncounterRevision = value(input, "expectedEncounterRevision", "expected_encounter_revision");
    const origin = text(value(input, "origin")) || "webmcp";
    const description = text(value(input, "description")) || "Applied targeted agent revision";
    this.checkEncounter(encounterID, integer(expectedEncounterRevision, NaN));
    if (this.generation) throw error("manual_write_locked", "Manual writes are locked while a Generation Run is active. Reads remain available.");
    if (origin === "gm" || origin === "manual") throw error("manual_write_locked", "A targeted revision is reserved for agent-authored changes.");
    if (typeof input.operation !== "function") throw error("invalid_request", "A targeted revision operation is required.");
    const before = clone(this.draft);
    const next = clone(this.draft);
    input.operation(next);
    this.history.push(before);
    this.redoHistory = [];
    this.draft = next;
    this.commitRevision(origin);
    this.record(description, origin);
    return this.snapshot();
  }

  targetedRevision(input = {}) { return this.applyTargetedRevision(input); }

  redo({ expectedEncounterRevision, origin = "gm" } = {}) {
    this.checkRevision(expectedEncounterRevision);
    if (this.generation) throw error("manual_write_locked", "Manual writes are locked while a Generation Run is active. Reads remain available.");
    if (!this.redoHistory.length) throw error("nothing_to_redo", "There is no undone Mutation to redo.");
    this.history.push(clone(this.draft));
    const restored = clone(this.redoHistory.pop());
    restored.revision = this.encounterRevision + 1;
    restored.generation = null;
    this.draft = restored;
    this.record("Redid the last Mutation", origin);
    return this.snapshot();
  }

  autosave() {
    return {
      format: "sidekickdm-generation-run",
      formatVersion: 1,
      draft: clone(this.draft),
      briefRevision: this.briefRevision,
      activity: clone(this.activity)
    };
  }

  reload(saved) {
    const envelope = saved?.format === "sidekickdm-generation-run" ? saved : { draft: saved };
    const formatVersion = integer(value(envelope, "formatVersion", "format_version"), 1);
    if (formatVersion > 1) throw error("future_schema_version", "The saved Generation Run uses a newer schema version.");
    if (!envelope?.draft || (envelope.format && formatVersion !== 1)) throw error("invalid_persistence", "The saved Generation Run is invalid.");
    this.draft = clone(envelope.draft);
    this.briefRevision = integer(value(envelope, "briefRevision", "brief_revision"), 0);
    this.activity = clone(envelope.activity ?? []);
    this.history = [];
    this.redoHistory = [];
    this.lastWarnings = [];
    const generation = this.draft.generation ?? this.draft.generation_state;
    if (generation) {
      if (generation.openingDraft) this.openingSnapshot = clone(generation.openingDraft);
      else if (generation.opening_draft) this.openingSnapshot = clone(generation.opening_draft);
      else if (typeof generation.openingDraftJSON === "string") {
        try { this.openingSnapshot = JSON.parse(generation.openingDraftJSON); } catch { this.openingSnapshot = null; }
      }
      else if (typeof generation.opening_draft_json === "string") {
        try { this.openingSnapshot = JSON.parse(generation.opening_draft_json); } catch { this.openingSnapshot = null; }
      }
      if (generation.state === GENERATION_RUN_STATES.ACTIVE) generation.state = GENERATION_RUN_STATES.INTERRUPTED;
    } else this.openingSnapshot = null;
    return this.snapshot();
  }

  checkEncounter(encounterID, expectedRevision) {
    if (!encounterID || encounterID !== text(this.draft.id)) throw error("unknown_encounter", "The requested Encounter Draft does not exist.", { encounter_id: encounterID });
    this.checkRevision(expectedRevision);
  }

  checkRevision(expectedRevision) {
    if (!Number.isInteger(expectedRevision) || expectedRevision !== this.encounterRevision) throw error("stale_revision", "The encounter changed after it was inspected.", { expected_revision: expectedRevision, current_revision: this.encounterRevision });
  }

  checkBrief(expectedBriefRevision) {
    if (!Number.isInteger(expectedBriefRevision) || expectedBriefRevision !== this.briefRevision) throw error("stale_brief_revision", "The Encounter Brief changed after it was inspected.", { expected_brief_revision: expectedBriefRevision, current_brief_revision: this.briefRevision });
  }

  checkConstraints(expectedConstraintsRevision) {
    if (!Number.isInteger(expectedConstraintsRevision) || expectedConstraintsRevision !== this.constraintsRevision) throw error("stale_constraints", "The Content Boundaries changed after they were inspected.", { expected_constraints_revision: expectedConstraintsRevision, current_constraints_revision: this.constraintsRevision });
  }

  checkActive(encounterID, generationRunID, expectedRevision, expectedConstraintsRevision) {
    this.checkEncounter(text(encounterID), integer(expectedRevision, NaN));
    this.checkConstraints(integer(expectedConstraintsRevision, NaN));
    if (!this.generation) throw error("no_active_generation", "There is no active Generation Run.");
    if (text(generationRunID) !== this.generationRunID) throw error("wrong_generation_run", `Generation Run ${generationRunID} is not active.`, { expected_generation_run_id: generationRunID, current_generation_run_id: this.generationRunID });
    if (this.generationState !== GENERATION_RUN_STATES.ACTIVE) throw error("generation_interrupted", "The Generation Run was interrupted by a reload. Resume or cancel it before retrying.");
  }

  commitRevision(origin) {
    this.draft.revision = this.encounterRevision + 1;
    this.draft.provenance = { ...(this.draft.provenance ?? {}), lastMutationOrigin: origin, ...(origin === "gm" ? {} : { origin }) };
  }

  record(description, origin, before = this.encounterRevision - 1, after = this.encounterRevision) {
    this.activity.unshift({ id: `generation-${this.activity.length + 1}`, description, origin, beforeRevision: before, afterRevision: after, time: "session" });
    this.activity = this.activity.slice(0, 20);
  }
}

export const GenerationRunStore = GenerationRunController;
export const GenerationRunCoordinator = GenerationRunController;
export const GenerationRun = GenerationRunController;
export function createGenerationRun(options = {}) { return new GenerationRunController(options); }
