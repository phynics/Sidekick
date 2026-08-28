/*
 * Pure, offline projection for a runnable Encounter Packet.
 *
 * This module deliberately accepts both the native BoundarySnapshot shape and
 * the snake_case sidekickdm JSON export shape. It only reads its arguments;
 * it never fetches a Catalog or mutates the restored Encounter.
 */

export const PRINT_PACKET_VERSION = 1;
export const PRINT_SECTION_ORDER = Object.freeze([
  "summary",
  "setup",
  "phases",
  "component_mechanics",
  "outcomes",
  "notices"
]);

const UNOFFICIAL_NOTICE = "Sidekick DM is an unofficial product and is not affiliated with, endorsed by, or sponsored by Paizo Inc. or Foundry VTT.";
const ORC_NOTICE = "This product is licensed under the ORC License located at the Library of Congress at TX 9-307-067 and available online at various locations including http://azoralaw.com/orclicense/ and others. All warranties are disclaimed as set forth therein.";
const EXTRACTION_NOTICE = "Included rules data was extracted from the Foundry VTT PF2e system; the extraction source and revision are listed below.";
const NO_ASSET_RIGHTS_NOTICE = "No rights to portraits, art, tokens, maps, attachments, Foundry configuration, macros, or rule-element automation are implied by this packet.";
const PUBLICATION_ATTRIBUTIONS = Object.freeze([
  "Pathfinder Monster Core",
  "Pathfinder NPC Core",
  "Pathfinder GM Core"
]);

// Use code-point order for persisted projections. `localeCompare` varies with
// the host locale and can change packet output between machines.
function fixedOrder(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
}

const hasText = (value) => typeof value === "string" && value.trim().length > 0;
const valueOr = (value, fallback = "Not recorded") => hasText(String(value ?? "")) ? String(value).trim() : fallback;
const clone = (value) => value == null ? value : structuredClone(value);
const array = (value) => Array.isArray(value) ? value : [];
const first = (...values) => values.find((value) => value !== undefined && value !== null && value !== "");
const key = (object, ...keys) => first(...keys.map((name) => object?.[name]));
const normalizedArray = (value) => array(value).map((item) => typeof item === "object" && item !== null ? item : String(item)).filter((item) => hasText(typeof item === "string" ? item : JSON.stringify(item)));
const object = (value) => value && typeof value === "object" && !Array.isArray(value) ? value : {};

function cleanText(value) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value).trim();
  return "";
}

function listValues(value) {
  if (Array.isArray(value)) return value.flatMap((item) => {
    if (item == null) return [];
    if (typeof item === "string" || typeof item === "number") return [String(item).trim()].filter(Boolean);
    if (typeof item === "object") return [cleanText(first(item.text, item.description, item.name, item.title, item.value))].filter(Boolean);
    return [];
  });
  if (hasText(String(value ?? ""))) return String(value).split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
  return [];
}

function displayLabel(name) {
  return String(name ?? "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function packetFrom(encounter) {
  const packet = key(encounter, "packetV1", "packet_v1", "packet");
  if (packet?.identity || packet?.setup || packet?.runningGuidance || packet?.running_guidance) return packet;
  const legacy = object(packet);
  return {
    objectVersion: 1,
    identity: { title: encounter?.title ?? "", premise: legacy.premise ?? encounter?.brief?.premise ?? "", objective: legacy.objective ?? "", stakes: legacy.stakes ?? "" },
    setup: { trigger: legacy.setup ?? "", battlefieldDescription: "", startingPositions: "", awarenessState: "", immediateFeatures: [], readAloud: null },
    battlefield: {},
    runningGuidance: { participantRoles: "", openingTactics: legacy.runningGuidance ?? legacy.running_guidance ?? "", ongoingTactics: "", coordinationConflict: "", triggersReinforcements: "", moraleSummary: "", adjudicationIssues: [] },
    cohesion: { participantPresence: legacy.cohesion ?? "", relationships: "", hazardTerrainFit: "", theme: "" },
    information: {},
    outcomes: { victory: legacy.outcomes ?? "" },
    rewardGuidance: null,
    alternativeResolutions: []
  };
}

function sourceProvenance(entry) {
  const provenance = key(entry, "provenance", "catalogProvenance", "catalog_provenance") ?? {};
  const upstream = key(provenance, "upstream") ?? {};
  const licenseBasis = key(provenance, "license_basis", "licenseBasis");
  return {
    contentID: valueOr(key(entry, "content_id", "contentID", "id"), "Not recorded"),
    sourceTitle: valueOr(key(provenance, "source_title", "sourceTitle") ?? key(entry, "source"), "Not recorded"),
    sourcePage: key(provenance, "source_page", "sourcePage") ?? "Not known",
    edition: valueOr(key(provenance, "edition") ?? key(entry, "edition"), "Not recorded"),
    upstreamSystem: valueOr(key(upstream, "system") ?? key(provenance, "upstreamSystem"), "Not recorded"),
    upstreamPack: valueOr(key(upstream, "pack") ?? key(provenance, "upstreamPack"), "Not recorded"),
    upstreamIdentifier: valueOr(key(upstream, "identifier") ?? key(provenance, "upstreamIdentifier"), "Not recorded"),
    sourceSHA256: valueOr(key(provenance, "source_sha256", "sourceSHA256"), "Not recorded"),
    licenseBasis: valueOr(licenseBasis, "Not recorded"),
    licenseResolved: hasText(String(licenseBasis ?? "")) && !["unknown", "unresolved", "not recorded", "none"].includes(normalizedLicense(licenseBasis)),
    notices: listValues(key(provenance, "notices")),
    diagnostics: listValues(key(provenance, "diagnostics"))
  };
}

function normalizedLicense(value) { return String(value ?? "").trim().toLowerCase(); }

function publicationTitle(title) {
  const value = String(title ?? "").trim();
  const normalized = value.toLowerCase();
  if (normalized === "monster core" || normalized === "pathfinder monster core") return "Pathfinder Monster Core";
  if (normalized === "npc core" || normalized === "pathfinder npc core") return "Pathfinder NPC Core";
  if (normalized === "gm core" || normalized === "pathfinder gm core") return "Pathfinder GM Core";
  return value;
}

function catalogEntry(catalog, contentID) {
  if (!catalog || !contentID) return null;
  if (typeof catalog.get === "function") return catalog.get(contentID) ?? null;
  const entries = array(catalog.entries ?? catalog.data?.entries);
  return entries.find((entry) => key(entry, "content_id", "contentID", "id") === contentID) ?? null;
}

function embeddedComponents(encounter, extra = {}) {
  const embedded = key(encounter, "embedded_components", "embeddedComponents") ?? {};
  const catalogEntries = array(key(encounter, "embeddedCatalogEntries", "embedded_catalog_entries"));
  return {
    creatures: [...array(key(encounter, "originalCreatures", "original_creatures")), ...catalogEntries.filter(item => key(item, "kind") === "creature"), ...array(embedded.creatures), ...array(extra.creatures)],
    npcProfiles: [...array(key(encounter, "npcProfiles", "npc_profiles")), ...array(embedded.npc_profiles ?? embedded.npcProfiles), ...array(extra.npcProfiles ?? extra.npc_profiles)],
    hazards: [...array(key(encounter, "customHazards", "custom_hazards")), ...catalogEntries.filter(item => key(item, "kind") === "hazard"), ...array(embedded.hazards), ...array(extra.hazards)]
  };
}

function componentByID(items, id) {
  return items.find((item) => key(item, "id", "profileID", "profile_id") === id || key(item, "participantGroupID", "participant_group_id") === id) ?? null;
}

function contentIDFor(item) { return key(item, "contentID", "content_id", "catalogContentID", "catalog_content_id"); }

function normalizeEncounter(input) {
  const source = input?.snapshot ?? input;
  return source?.encounter ?? source?.draft ?? source?.data?.encounter ?? source?.data?.draft ?? source?.data ?? source ?? {};
}

function normalizeBudget(input, encounter) {
  const budget = input?.budget ?? input?.snapshot?.budget ?? encounter?.budget;
  if (!budget) return null;
  return {
    targetThreat: valueOr(key(budget, "targetThreat", "target_threat"), "Not recorded"),
    constructionBudget: key(budget, "constructionBudget", "construction_budget"),
    guaranteedXP: key(budget, "guaranteedXP", "guaranteed_xp"),
    avoidableXP: key(budget, "avoidableXP", "avoidable_xp"),
    conditionalXP: key(budget, "conditionalXP", "conditional_xp"),
    peakActiveXP: key(budget, "peakActiveXP", "peak_active_xp"),
    totalEncounterXP: key(budget, "totalEncounterXP", "total_encounter_xp"),
    inferredThreat: key(budget, "inferredThreat", "inferred_threat"),
    warnings: listValues(key(budget, "warnings"))
  };
}

function normalizeReadiness(input, encounter) {
  const readiness = input?.readiness ?? input?.snapshot?.readiness ?? encounter?.readiness;
  if (!readiness) return null;
  return {
    status: valueOr(key(readiness, "status"), "Not calculated"),
    structuralErrors: listValues(key(readiness, "structuralErrors", "structural_errors")),
    designWarnings: listValues(key(readiness, "designWarnings", "design_warnings"))
  };
}

function normalizeParticipant(group, { catalog, embedded, index }) {
  const contentID = contentIDFor(group);
  const entry = catalogEntry(catalog, contentID);
  const embeddedCreature = componentByID(embedded.creatures, key(group, "creatureSnapshotID", "creature_snapshot_id")) ?? embedded.creatures.find((item) => contentIDFor(item) === contentID || key(item, "id") === contentID?.split("/")[2]);
  const detail = object(key(embeddedCreature, "detail") ?? key(entry, "detail"));
  const embeddedIsCatalog = key(embeddedCreature, "snapshotKind", "snapshot_kind") === "catalog" || Boolean(key(embeddedCreature, "catalogProvenance", "catalog_provenance"));
  const hasCatalogProvenance = Boolean(entry || embeddedIsCatalog);
  const provenance = sourceProvenance(embeddedIsCatalog ? embeddedCreature : entry);
  provenance.isCatalog = hasCatalogProvenance;
  return {
    id: valueOr(key(group, "id"), `participant_${index + 1}`),
    kind: "creature",
    name: valueOr(key(group, "name") ?? key(embeddedCreature?.identity, "name") ?? key(embeddedCreature, "name") ?? key(entry, "name"), "Unnamed creature"),
    quantity: key(group, "quantity") ?? 1,
    level: key(group, "level") ?? key(embeddedCreature?.identity, "level") ?? key(entry, "level"),
    adjustment: valueOr(key(group, "adjustment"), "normal"),
    faction: valueOr(key(group, "faction"), "Not recorded"),
    participation: object(key(group, "participation")),
    encounterRole: valueOr(key(group, "encounterRole", "encounter_role") ?? key(entry, "roles")?.[0], "Not recorded"),
    narrativeTier: valueOr(key(group, "narrativeTier", "narrative_tier"), "Not recorded"),
    startingArea: valueOr(key(group, "startingArea", "starting_area"), "Not recorded"),
    tactics: valueOr(key(group, "sharedTactics", "shared_tactics") ?? key(embeddedCreature, "tactics") ?? key(detail, "tactics"), "Not recorded"),
    morale: valueOr(key(group, "morale") ?? key(embeddedCreature, "morale") ?? key(detail, "morale"), "Not recorded"),
    mechanics: {
      concept: key(embeddedCreature?.identity, "concept") ?? key(detail, "concept") ?? key(entry, "summary"),
      perception: key(embeddedCreature, "perception") ?? key(detail, "perception"),
      senses: listValues(key(embeddedCreature, "senses") ?? key(detail, "senses")),
      languages: listValues(key(embeddedCreature, "languages") ?? key(detail, "languages")),
      skills: object(key(embeddedCreature, "skills") ?? key(detail, "skills")),
      defenses: object(key(embeddedCreature, "defenses") ?? key(detail, "defenses")),
      speeds: object(key(embeddedCreature, "speeds") ?? key(detail, "speeds")),
      strikes: normalizedArray(key(embeddedCreature, "strikes") ?? key(detail, "strikes")),
      abilities: normalizedArray(key(embeddedCreature, "abilities") ?? key(detail, "abilities")),
      spellcasting: normalizedArray(key(embeddedCreature, "spellcasting_blocks", "spellcastingBlocks") ?? key(detail, "spellcasting_blocks", "spellcastingBlocks") ?? key(entry?.detail, "spellcasting_blocks", "spellcastingBlocks")),
      provenance
    },
    provenance,
    source: valueOr(key(entry, "source") ?? publicationTitle(provenance.sourceTitle), "Not recorded")
  };
}

function normalizeHazard(hazard, { catalog, embedded, index }) {
  const contentID = contentIDFor(hazard);
  const entry = catalogEntry(catalog, contentID);
  const embeddedHazard = componentByID(embedded.hazards, key(hazard, "hazardSnapshotID", "hazard_snapshot_id")) ?? embedded.hazards.find((item) => contentIDFor(item) === contentID || key(item, "id") === key(hazard, "id"));
  const detail = object(key(embeddedHazard, "detail") ?? key(entry, "detail"));
  const embeddedIsCatalog = key(embeddedHazard, "snapshotKind", "snapshot_kind") === "catalog" || Boolean(key(embeddedHazard, "catalogProvenance", "catalog_provenance"));
  const hasCatalogProvenance = Boolean(entry || embeddedIsCatalog);
  const provenance = sourceProvenance(embeddedIsCatalog ? embeddedHazard : entry);
  provenance.isCatalog = hasCatalogProvenance;
  const identity = object(key(embeddedHazard, "identity"));
  const effect = object(key(embeddedHazard, "effect") ?? key(detail, "effect"));
  return {
    id: valueOr(key(hazard, "id"), `hazard_${index + 1}`),
    kind: "hazard",
    name: valueOr(key(hazard, "name") ?? key(identity, "name") ?? key(entry, "name"), "Unnamed hazard"),
    level: key(hazard, "level") ?? key(identity, "level") ?? key(entry, "level"),
    complexity: valueOr(key(hazard, "complexity") ?? key(identity, "complexity") ?? key(entry, "hazard_complexity", "hazardComplexity"), "simple"),
    participation: object(key(hazard, "participation")),
    placement: valueOr(key(hazard, "placement"), "Not recorded"),
    mechanics: {
      description: key(embeddedHazard, "description") ?? key(detail, "description") ?? key(entry, "summary"),
      detection: key(embeddedHazard, "detection") ?? key(detail, "detection"),
      disableMethods: normalizedArray(key(embeddedHazard, "disableMethods", "disable_methods") ?? key(detail, "disable_methods", "disableMethods")),
      defenses: object(key(embeddedHazard, "defenses") ?? key(detail, "defenses")),
      trigger: key(embeddedHazard, "trigger") ?? key(detail, "trigger"),
      effect: first(key(effect, "text", "effectText", "effect_text"), key(embeddedHazard, "effect"), key(detail, "effect")),
      routine: key(embeddedHazard, "routine") ?? key(detail, "routine"),
      reset: key(embeddedHazard, "reset") ?? key(detail, "reset"),
      oneUse: key(embeddedHazard, "oneUse", "one_use"),
      provenance
    },
    provenance,
    source: valueOr(key(entry, "source") ?? publicationTitle(provenance.sourceTitle), "Not recorded")
  };
}

function normalizePhase(phase, { participantGroups, hazards, index }) {
  const participantIDs = listValues(key(phase, "participantIDs", "participant_ids", "activeParticipantGroupIds", "active_participant_group_ids"));
  const hazardIDs = listValues(key(phase, "hazardIDs", "hazard_ids", "activeHazardIds", "active_hazard_ids"));
  const trigger = key(phase, "trigger");
  return {
    id: valueOr(key(phase, "id"), `phase_${index + 1}`),
    order: key(phase, "order") ?? index,
    title: valueOr(key(phase, "title", "name"), `Phase ${index + 1}`),
    trigger: typeof trigger === "object" ? valueOr(key(trigger, "explanation", "description", "value", "type"), "Not recorded") : valueOr(trigger, "Not recorded"),
    participantIDs,
    hazardIDs,
    participants: participantIDs.map((id) => participantGroups.find((group) => group.id === id)).filter(Boolean),
    hazards: hazardIDs.map((id) => hazards.find((hazard) => hazard.id === id)).filter(Boolean),
    terrainChanges: listValues(key(phase, "terrainChanges", "terrain_changes")),
    runningGuidance: valueOr(key(phase, "runningGuidance", "running_guidance"), "Not recorded"),
    projection: key(phase, "projection") ?? null
  };
}

function uniqueStrings(values) {
  return [...new Set(values.flatMap((value) => listValues(value)).filter(Boolean))];
}

function buildNotices(input, encounter, components, manifest) {
  const explicit = uniqueStrings([
    key(input, "licenseNotices", "license_notices"),
    key(input?.export, "licenseNotices", "license_notices"),
    key(encounter, "licenseNotices", "license_notices"),
    key(input, "notices"),
    key(encounter, "notices")
  ]);
  const provenances = [...components.participants, ...components.hazards].map((component) => component.provenance).filter((provenance) => provenance?.isCatalog);
  const provenanceMap = new Map();
  for (const provenance of provenances) {
    const fingerprint = JSON.stringify([provenance.contentID, provenance.sourceTitle, provenance.sourcePage, provenance.sourceSHA256]);
    if (!provenanceMap.has(fingerprint)) provenanceMap.set(fingerprint, provenance);
  }
  const catalogProvenance = [...provenanceMap.values()].sort((a, b) => fixedOrder(`${a.sourceTitle}|${a.contentID}`, `${b.sourceTitle}|${b.contentID}`));
  const sourceRevision = key(manifest, "source")?.revision ?? key(manifest, "source_revision") ?? key(input, "sourceRevision", "source_revision") ?? "Not recorded";
  const sourceSystem = key(manifest, "source")?.system ?? key(manifest, "source_system") ?? "foundryvtt-pf2e";
  const embeddedNoticeTexts = uniqueStrings(catalogProvenance.map((item) => item.notices));
  const publicationTitles = [...new Set(catalogProvenance.map((item) => publicationTitle(item.sourceTitle)).filter((title) => title !== "Not recorded"))];
  const attributions = [...PUBLICATION_ATTRIBUTIONS.filter((title) => publicationTitles.includes(title)), ...publicationTitles.filter((title) => !PUBLICATION_ATTRIBUTIONS.includes(title))];
  const diagnostics = uniqueStrings(catalogProvenance.map((item) => item.diagnostics));
  const unresolvedLicenses = catalogProvenance.filter((item) => !item.licenseResolved).map((item) => `License basis is unresolved for ${item.contentID}.`);
  const catalogID = key(manifest, "catalog_id", "catalogID") ?? key(input, "catalogID", "catalog_id") ?? "Not recorded";
  const generatedAt = key(manifest, "generated_at", "generatedAt") ?? "Not recorded";
  const generator = key(manifest, "generator") ?? {};
  const counts = key(manifest, "counts") ?? {};
  return {
    general: [UNOFFICIAL_NOTICE, ORC_NOTICE, EXTRACTION_NOTICE, NO_ASSET_RIGHTS_NOTICE],
    publicationAttributions: attributions,
    explicit: [...explicit, ...embeddedNoticeTexts],
    diagnostics,
    unresolvedLicenses,
    source: { catalogID, system: sourceSystem, revision: sourceRevision, generatedAt, generatorName: key(generator, "name"), generatorVersion: key(generator, "version"), counts },
    catalogProvenance,
    generatedProvenance: {
      origin: valueOr(key(encounter, "provenance")?.origin, "Not recorded"),
      lastMutationOrigin: valueOr(key(encounter, "provenance")?.lastMutationOrigin ?? key(encounter, "provenance")?.last_changed_by, "Not recorded"),
      reviewState: valueOr(key(encounter, "reviewState", "review_state"), "Not recorded")
    }
  };
}

export function createEncounterPrintProjection(input = {}) {
  const encounter = normalizeEncounter(input);
  const packet = packetFrom(encounter);
  const catalog = input.catalog ?? input.snapshot?.catalog;
  const embedded = embeddedComponents(encounter, input.embeddedComponents ?? input.embedded_components);
  const participants = array(key(encounter, "participantGroups", "participant_groups")).map((group, index) => normalizeParticipant(group, { catalog, embedded, index }));
  const hazards = array(key(encounter, "hazards")).map((hazard, index) => normalizeHazard(hazard, { catalog, embedded, index }));
  const phases = array(key(encounter, "structuredPhases", "structured_phases", "phases")).map((phase, index) => normalizePhase(phase, { participantGroups: participants, hazards, index })).sort((a, b) => a.order - b.order || fixedOrder(a.id, b.id));
  const components = { participants, hazards, npcProfiles: embedded.npcProfiles.map((profile, index) => ({ id: valueOr(key(profile, "id", "profileID"), `npc_${index + 1}`), name: valueOr(key(profile, "name") ?? key(profile?.profile, "name"), "Unnamed NPC Profile"), tier: valueOr(key(profile, "tier", "narrativeTier") ?? key(profile?.profile, "tier", "narrativeTier"), "Not recorded"), profile: clone(profile) })) };
  const manifest = input.manifest ?? input.catalogManifest ?? input.catalog_manifest;
  return {
    version: PRINT_PACKET_VERSION,
    title: valueOr(key(packet.identity, "title") ?? key(encounter, "title"), "Untitled Encounter"),
    offline: true,
    sectionOrder: [...PRINT_SECTION_ORDER],
    summary: {
      identity: clone(object(packet.identity)),
      purpose: key(encounter?.brief, "purpose"),
      environment: key(encounter?.brief, "environment"),
      party: clone(key(encounter?.brief, "party")),
      threatTarget: clone(key(encounter?.brief, "threatTarget", "threat_target")),
      cohesion: clone(object(packet.cohesion)),
      budget: normalizeBudget(input, encounter),
      readiness: normalizeReadiness(input, encounter),
      boundaries: clone(key(encounter, "contentBoundaries", "content_boundaries"))
    },
    setup: { setup: clone(object(packet.setup)), battlefield: clone(object(packet.battlefield)), information: clone(object(packet.information)) },
    phases,
    componentMechanics: components,
    outcomes: { outcomes: clone(object(packet.outcomes)), rewardGuidance: key(packet, "rewardGuidance", "reward_guidance"), alternativeResolutions: clone(key(packet, "alternativeResolutions", "alternative_resolutions") ?? []) },
    notices: buildNotices(input, encounter, components, manifest)
  };
}

function renderValue(value) {
  if (value == null || value === "") return "<span class=\"print-empty\">Not recorded</span>";
  return escapeHTML(typeof value === "object" ? JSON.stringify(value) : value);
}

function renderList(values, className = "print-list") {
  const list = listValues(values);
  return list.length ? `<ul class="${className}">${list.map((item) => `<li>${renderValue(item)}</li>`).join("")}</ul>` : `<p class="print-empty">Not recorded</p>`;
}

function renderPairs(values, { className = "print-facts" } = {}) {
  const entries = Object.entries(object(values)).filter(([, value]) => value != null && value !== "" && !(Array.isArray(value) && value.length === 0));
  if (!entries.length) return `<p class="print-empty">Not recorded</p>`;
  return `<dl class="${className}">${entries.map(([name, value]) => `<div><dt>${escapeHTML(displayLabel(name))}</dt><dd>${Array.isArray(value) ? renderList(value) : renderValue(value)}</dd></div>`).join("")}</dl>`;
}

function renderField(label, value) { return `<div class="print-field"><h4>${escapeHTML(label)}</h4>${Array.isArray(value) ? renderList(value) : `<p>${renderValue(value)}</p>`}</div>`; }

function renderSection(id, title, body) { return `<section class="print-section print-${id.replaceAll("_", "-")}" data-print-section="${id}"><h2>${escapeHTML(title)}</h2>${body}</section>`; }

function renderComponentMechanics(components) {
  const creatures = components.participants.map((component) => `<article class="print-stat-block" data-component-kind="creature"><h3>${renderValue(component.quantity)} × ${renderValue(component.name)}</h3><p class="print-meta">Level ${renderValue(component.level)} · ${renderValue(component.adjustment)} · ${renderValue(component.encounterRole)} · ${renderValue(component.participation?.mode)}</p>${renderField("Starting area", component.startingArea)}${renderField("Tactics", component.tactics)}${renderField("Morale", component.morale)}${renderField("Mechanics", component.mechanics.concept)}${renderPairs({ perception: component.mechanics.perception, senses: component.mechanics.senses, languages: component.mechanics.languages, skills: component.mechanics.skills, defenses: component.mechanics.defenses, speeds: component.mechanics.speeds })}${component.mechanics.strikes.length ? renderField("Strikes", component.mechanics.strikes) : ""}${component.mechanics.abilities.length ? renderField("Abilities", component.mechanics.abilities) : ""}${component.mechanics.spellcasting.length ? renderField("Spellcasting", component.mechanics.spellcasting) : ""}${renderField("Catalog Provenance", component.provenance)}</article>`).join("");
  const hazards = components.hazards.map((component) => `<article class="print-stat-block" data-component-kind="hazard"><h3>${renderValue(component.name)}</h3><p class="print-meta">Level ${renderValue(component.level)} · ${renderValue(component.complexity)} · ${renderValue(component.participation?.mode)} · placed ${renderValue(component.placement)}</p>${renderField("Description", component.mechanics.description)}${renderField("Detection", component.mechanics.detection)}${renderField("Disable methods", component.mechanics.disableMethods)}${renderField("Defenses", component.mechanics.defenses)}${renderField("Trigger", component.mechanics.trigger)}${renderField("Effect", component.mechanics.effect)}${renderField("Routine", component.mechanics.routine)}${renderField("Reset", component.mechanics.reset)}${renderField("Catalog Provenance", component.provenance)}</article>`).join("");
  const npcs = components.npcProfiles.map((profile) => `<article class="print-stat-block" data-component-kind="npc-profile"><h3>${renderValue(profile.name)}</h3><p class="print-meta">NPC Profile · ${renderValue(profile.tier)}</p>${renderPairs(profile.profile)}</article>`).join("");
  return `${creatures}${npcs}${hazards}` || `<p class="print-empty">No embedded component mechanics recorded.</p>`;
}

export function renderEncounterPrintProjection(projectionOrInput = {}, options = {}) {
  const projection = projectionOrInput?.version === PRINT_PACKET_VERSION && projectionOrInput?.sectionOrder ? projectionOrInput : createEncounterPrintProjection(projectionOrInput);
  const summary = projection.summary;
  const setup = projection.setup;
  const identity = object(summary.identity);
  const setupValue = object(setup.setup);
  const battlefield = object(setup.battlefield);
  const information = object(setup.information);
  const outcomes = object(projection.outcomes.outcomes);
  const css = options.inlineStyles === false ? "<link rel=\"stylesheet\" href=\"./styles/print.css\">" : `<style>${PRINT_CSS}</style>`;
  const phases = projection.phases.map((phase) => `<article class="print-phase"><h3>${renderValue(phase.title)}</h3>${renderField("Trigger", phase.trigger)}${renderField("Active participants", phase.participants.map((item) => `${item.quantity} × ${item.name}`))}${renderField("Active hazards", phase.hazards.map((item) => item.name))}${renderField("Terrain changes", phase.terrainChanges)}${renderField("Running guidance", phase.runningGuidance)}</article>`).join("") || `<p class="print-empty">No phases recorded.</p>`;
  const budget = summary.budget ? renderPairs(summary.budget) : `<p class="print-empty">Budget was not included in this restored snapshot.</p>`;
  const readiness = summary.readiness ? `<div class="print-readiness"><p><strong>Status:</strong> ${renderValue(summary.readiness.status)}</p>${renderField("Structural errors", summary.readiness.structuralErrors)}${renderField("Design warnings", summary.readiness.designWarnings)}</div>` : "";
  const notice = projection.notices;
  const provenanceRows = notice.catalogProvenance.map((item) => `<tr><th scope="row">${renderValue(item.contentID)}</th><td>${renderValue(item.sourceTitle)}</td><td>${renderValue(item.sourcePage)}</td><td>${renderValue(item.edition)}</td><td>${renderValue(item.licenseBasis)}</td><td>${renderValue(item.sourceSHA256)}</td><td>${renderList(item.notices)}</td><td>${renderList(item.diagnostics)}</td></tr>`).join("");
  const alternative = array(projection.outcomes.alternativeResolutions).map((item) => `<article class="print-stat-block"><h3>${renderValue(key(item, "title"))}</h3>${renderPairs(item)}</article>`).join("");
  const summaryBody = [
    renderField("Premise", identity.premise), renderField("Objective", identity.objective), renderField("Stakes", identity.stakes),
    renderField("Purpose", summary.purpose), renderField("Environment", summary.environment),
    `<div class="print-subsection"><h3>Party and threat</h3>${renderPairs({ party: summary.party, threatTarget: summary.threatTarget })}</div>`,
    `<div class="print-subsection"><h3>Cohesion</h3>${renderPairs(summary.cohesion)}</div>`,
    `<div class="print-subsection"><h3>Budget and readiness</h3>${budget}${readiness}</div>`,
    `<div class="print-subsection"><h3>Content Boundaries · GM-owned</h3>${renderPairs(summary.boundaries)}</div>`
  ].join("");
  const setupBody = [
    renderField("Trigger", setupValue.trigger), renderField("Battlefield description", setupValue.battlefieldDescription), renderField("Starting positions", setupValue.startingPositions),
    renderField("Awareness / detection", setupValue.awarenessState), renderField("Immediate features", setupValue.immediateFeatures), renderField("Read-aloud", setupValue.readAloud),
    `<div class="print-subsection"><h3>Battlefield guidance</h3>${renderPairs(battlefield)}</div>`,
    `<div class="print-subsection"><h3>Information visibility</h3>${renderField("Immediately apparent", information.immediatelyApparent)}${renderField("Discoverable", information.discoverable)}${renderField("GM secret", information.gmSecret)}</div>`
  ].join("");
  const outcomeBody = [
    renderField("Victory", outcomes.victory), renderField("Partial success", outcomes.partialSuccess), renderField("Failure", outcomes.failure), renderField("Party retreat", outcomes.partyRetreat),
    renderField("Enemy surrender", outcomes.enemySurrender), renderField("Enemy escape", outcomes.enemyEscape), renderField("Long-term consequence", outcomes.longTermConsequence), renderField("Reward guidance", projection.outcomes.rewardGuidance),
    alternative ? `<div class="print-subsection"><h3>Alternative resolutions</h3>${alternative}</div>` : ""
  ].join("");
  const noticeBody = [
    `<div class="print-notice-copy">${notice.general.map((item) => `<p>${renderValue(item)}</p>`).join("")}</div>`,
    notice.publicationAttributions.length ? `<h3>Included publication attributions</h3>${renderList(notice.publicationAttributions)}` : "",
    notice.explicit.length ? `<h3>Embedded-content notices</h3>${renderList(notice.explicit)}` : "",
    `<h3>Catalog extraction source</h3>${renderPairs(notice.source)}`,
    notice.diagnostics.length ? `<h3>Catalog diagnostics</h3>${renderList(notice.diagnostics)}` : "",
    notice.unresolvedLicenses.length ? `<h3>Unresolved license warnings</h3>${renderList(notice.unresolvedLicenses)}` : "",
    `<h3>Generated provenance</h3>${renderPairs(notice.generatedProvenance)}`,
    `<h3>Catalog Provenance</h3>${provenanceRows ? `<div class="print-table-wrap"><table><thead><tr><th scope="col">Content ID</th><th scope="col">Source</th><th scope="col">Page</th><th scope="col">Edition</th><th scope="col">License</th><th scope="col">SHA-256</th><th scope="col">Entry notices</th><th scope="col">Diagnostics</th></tr></thead><tbody>${provenanceRows}</tbody></table></div>` : `<p class="print-empty">No embedded catalog provenance recorded.</p>`}`
  ].join("");
  const sections = [
    renderSection("summary", "Summary", summaryBody),
    renderSection("setup", "Setup", setupBody),
    renderSection("phases", "Phases", phases),
    renderSection("component_mechanics", "Component mechanics", renderComponentMechanics(projection.componentMechanics)),
    renderSection("outcomes", "Outcomes", outcomeBody),
    renderSection("notices", "Notices and provenance", noticeBody)
  ].join("");
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHTML(projection.title)} · Sidekick DM</title>${css}</head><body><main class="print-packet" data-print-packet="${PRINT_PACKET_VERSION}"><header class="print-running-header" aria-hidden="true"><span>Sidekick DM · Runnable Encounter Packet</span><span>${renderValue(projection.title)}</span></header><header class="print-cover"><p class="eyebrow">Sidekick DM · Runnable Encounter Packet</p><h1>${renderValue(projection.title)}</h1><p class="print-meta">Offline print projection · content and notices restored from local data</p></header>${sections}<footer class="print-footer"><p>Sidekick DM · Encounter Packet v${PRINT_PACKET_VERSION}</p></footer></main></body></html>`;
}

/** Mount a print projection into a document without fetching a restored file. */
export function mountEncounterPrintProjection({ root, input = {}, options = {} } = {}) {
  if (!root || typeof root !== "object") throw new TypeError("A print projection root element is required.");
  const projection = createEncounterPrintProjection(input);
  const html = renderEncounterPrintProjection(projection, options);
  const body = html.match(/<body>([\s\S]*)<\/body>/i)?.[1] ?? html;
  root.innerHTML = `${options.inlineStyles === false ? "" : `<style>${PRINT_CSS}</style>`}${body}`;
  return { projection, html, destroy() { root.replaceChildren(); } };
}

// Exported so the application host can mount this stylesheet without a
// network request when it opens a print-only view.
const PRINT_CSS_BASE = `@page{margin:14mm 13mm;size:auto}*{box-sizing:border-box}.print-packet{color:#17202a;background:#fff;font:11pt/1.45 Georgia,"Times New Roman",serif;max-width:210mm;margin:0 auto}.print-packet h1,.print-packet h2,.print-packet h3,.print-packet h4{font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;line-height:1.15}.print-packet h1{font-size:26pt;margin:.2em 0 .35em}.print-packet h2{font-size:17pt;border-bottom:1px solid #8a9299;padding-bottom:.18em;margin:1.2em 0 .6em}.print-packet h3{font-size:13pt;margin:1em 0 .35em}.print-packet h4{font-size:10pt;margin:.65em 0 .15em;text-transform:uppercase;letter-spacing:.04em}.print-cover{border-bottom:2px solid #17202a;padding-bottom:9mm}.print-running-header{display:none}.print-meta,.print-empty{color:#52606d;font-size:9pt}.print-field p{margin:.15em 0 .5em;white-space:pre-wrap}.print-list{margin:.15em 0 .6em;padding-left:1.3em}.print-field,.print-subsection,.print-phase,.print-stat-block,.print-readiness{break-inside:avoid;page-break-inside:avoid}.print-phase,.print-stat-block,.print-subsection{border:1px solid #bbc2c8;border-radius:3px;padding:4mm;margin:0 0 4mm}.print-stat-block{border-left:4px solid #34495e}.print-facts{margin:.2em 0 .6em}.print-facts>div{display:grid;grid-template-columns:minmax(30mm,42mm) 1fr;gap:2mm;border-bottom:1px solid #e1e5e8;padding:1.2mm 0}.print-facts dt{font-weight:700}.print-facts dd{margin:0;white-space:pre-wrap}.print-facts .print-list{margin:0}.print-table-wrap{overflow:visible}.print-packet table{border-collapse:collapse;width:100%;font-size:8pt;table-layout:fixed;word-break:break-word}.print-packet th,.print-packet td{border:1px solid #aeb7bf;padding:1.5mm;vertical-align:top;text-align:left}.print-packet thead{display:table-header-group}.print-packet tr{break-inside:avoid;page-break-inside:avoid}.print-footer{border-top:1px solid #bbc2c8;margin-top:8mm;padding-top:3mm;color:#52606d;font-size:8pt}@media screen{.print-packet{padding:12mm}.print-packet .print-section{margin-bottom:12mm}}@media print{.print-running-header{display:flex;justify-content:space-between;gap:8mm;position:running(sidekick-print-header);border-bottom:1px solid #bbc2c8;padding-bottom:2mm;color:#52606d;font:8pt/1.2 Inter,system-ui,sans-serif}.print-packet{max-width:none}.print-packet a{color:inherit;text-decoration:none}.print-packet .controls,.print-packet button,.print-packet input,.print-packet select,.print-packet textarea,.print-packet form,.print-packet summary,.print-packet details,.print-packet [data-editing-control],.print-packet [data-action]{display:none!important}.print-packet h1,.print-packet h2,.print-packet h3{break-after:avoid;page-break-after:avoid}.print-section{break-before:auto;page-break-before:auto}.print-section:first-of-type{break-before:avoid;page-break-before:avoid}.print-notices{break-before:page;page-break-before:always}.print-notice-copy{break-inside:avoid;page-break-inside:avoid}}`;
export const PRINT_CSS = `${PRINT_CSS_BASE.replace("@page{margin:14mm 13mm;size:auto}", "@page{margin:14mm 13mm;size:auto}@page{@top-center{content:element(sidekick-print-header)}}")}`;

export const buildPrintPacket = createEncounterPrintProjection;
export const renderPrintPacket = renderEncounterPrintProjection;
export const createPrintPacketProjection = createEncounterPrintProjection;
