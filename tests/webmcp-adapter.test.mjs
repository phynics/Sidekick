import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { CatalogIndex } from "../src/catalog-index.js";
import { createWebMCPAdapter, toolDefinitions } from "../src/webmcp-adapter.js";

const catalogFixture = {
  fixture_version: 1,
  entries: [
    {
      content_id: "creature/test/bog-strider/current",
      kind: "creature",
      name: "Bog Strider",
      level: 5,
      traits: ["amphibious"],
      rarity: "uncommon",
      source: "Monster Core",
      edition: "current",
      environments: ["swamp"],
      roles: ["skirmisher"],
      spellcasting: false,
      completeness: "complete",
      support: "supported",
      summary: "A mobile swamp skirmisher.",
      provenance: { source_title: "Monster Core", notices: ["ORC"] },
      detail: { defenses: { ac: 24 }, tactics: "Circle isolated targets." }
    },
    {
      content_id: "hazard/test/bell-snare/current",
      kind: "hazard",
      name: "Bell Snare",
      level: 4,
      traits: ["mechanical"],
      rarity: "common",
      source: "Monster Core",
      edition: "current",
      environments: ["ruin"],
      roles: [],
      hazard_complexity: "simple",
      completeness: "complete",
      support: "supported",
      summary: "A submerged chain snare.",
      provenance: { source_title: "Monster Core", notices: ["ORC"] },
      detail: { detection: "DC 20", effect: "The bell rings." }
    }
  ]
};

function snapshot(overrides = {}) {
  return {
    protocolVersion: 1,
    encounterRevision: 4,
    briefRevision: 3,
    constraintsRevision: 2,
    budget: {
      targetThreat: "severe",
      baseTargetXP: 120,
      partySizeAdjustment: 30,
      constructionBudget: 150,
      guaranteedXP: 90,
      avoidableXP: 8,
      conditionalXP: 40,
      peakActiveXP: 130,
      totalEncounterXP: 138,
      baseXPAward: 120,
      terrainAdjustment: 0,
      inferredThreat: "severe",
      warnings: []
    },
    readiness: {
      structuralErrors: [],
      designWarnings: ["A short read-aloud can make the opening easier to run."],
      status: "ready_with_warnings",
      isStructurallyReady: true
    },
    encounter: {
      id: "enc_test",
      revision: 4,
      briefRevision: 3,
      constraintsRevision: 2,
      title: "The Bell Beneath Blackwater",
      brief: {
        party: { effectiveLevel: 5, size: 5, capabilities: { strengths: ["healing"], weaknesses: [], notes: "" } },
        threatTarget: { kind: "severe", customXP: null },
        purpose: "Guard the flooded shrine.",
        premise: "Cultists ring a bell beneath the water.",
        environment: "Flooded ruin."
      },
      participantGroups: [{ id: "cmp_1", contentID: "creature/test/bog-strider/current", name: "Bog Strider", level: 5, quantity: 2, adjustment: "normal", faction: "primary_opposition", participation: { mode: "mandatory" }, encounterRole: "skirmisher", narrativeTier: "incidental" }],
      hazards: [],
      phases: [],
      packet: { premise: "Cultists ring a bell beneath the water." },
      reviewState: "needed",
      generation: null
    },
    ...overrides
  };
}

test("defines the version 1 read-only Sidekick surface", () => {
  const reads = toolDefinitions().filter(definition => definition.readOnlyHint);
  assert.deepEqual(reads.slice(0, 8).map(({ name }) => name), [
    "sidekickdm_get_capabilities",
    "sidekickdm_get_encounter_summary",
    "sidekickdm_get_encounter_brief",
    "sidekickdm_get_brief_checklist",
    "sidekickdm_get_budget",
    "sidekickdm_get_readiness",
    "sidekickdm_search_catalog",
    "sidekickdm_get_catalog_entry"
  ]);
  for (const definition of reads.slice(0, 8)) {
    assert.equal(definition.readOnlyHint, true);
    assert.equal(definition.annotations.readOnlyHint, true);
  }
  assert.ok(toolDefinitions().some(({ name, readOnlyHint }) => name === "sidekickdm_begin_generation" && readOnlyHint === false));
  const requiredWrites = ["sidekickdm_upsert_npc_profile", "sidekickdm_add_existing_hazard"];
  for (const name of requiredWrites) assert.ok(toolDefinitions().some(definition => definition.name === name && definition.readOnlyHint === false), `Missing required WebMCP write tool ${name}`);
  assert.deepEqual(toolDefinitions().find(({ name }) => name === "sidekickdm_upsert_npc_profile").inputSchema.required, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "profile"]);
  assert.deepEqual(toolDefinitions().find(({ name }) => name === "sidekickdm_add_existing_hazard").inputSchema.required, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "content_id"]);
  const creatureUpdate = toolDefinitions().find(({ name }) => name === "sidekickdm_update_custom_creature");
  assert.deepEqual(creatureUpdate.inputSchema.required, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "creature"]);
  assert.ok(toolDefinitions().some(({ name, readOnlyHint }) => name === "sidekickdm_upsert_phase" && readOnlyHint === false));
  const targeted = toolDefinitions().find(({ name }) => name === "sidekickdm_apply_targeted_revision");
  assert.deepEqual(targeted.inputSchema.required, ["encounter_id", "expected_encounter_revision", "section", "value"]);
  assert.equal(toolDefinitions().find(({ name }) => name.endsWith("get_encounter_brief")).untrustedContentHint, true);
  assert.equal(toolDefinitions().find(({ name }) => name.endsWith("get_budget")).untrustedContentHint, false);
});

test("projects Hazard Builder benchmarks and complexity-specific attack and damage", async () => {
  const adapter = createWebMCPAdapter({ snapshot: snapshot() });
  const simple = await adapter.execute("sidekickdm_get_hazard_benchmarks", { level: 5, complexity: "simple" });
  assert.equal(simple.ok, true);
  assert.deepEqual(simple.data.statistics.stealth, { low: { minimum: 20, maximum: 20 }, moderate: { minimum: 21, maximum: 21 }, high: { minimum: 23, maximum: 23 }, extreme: { minimum: 26, maximum: 26 } });
  assert.equal(simple.data.statistics.attack, 19);
  assert.equal(simple.data.statistics.damage, "4d8+14 (32)");
  assert.deepEqual(simple.data.statistics.dc, { hard: 23, extreme: 27 });
  const complex = await adapter.execute("sidekickdm_get_hazard_benchmarks", { level: 5, complexity: "complex", statistics: ["attack", "damage"] });
  assert.deepEqual(complex.data.statistics, { attack: 15, damage: "2d8+7 (16)" });
});

test("preflight uses native-equivalent complexity, adjustments, and active phase peak", async () => {
  const adapter = createWebMCPAdapter({ snapshot: snapshot() });
  const result = await adapter.execute("sidekickdm_preflight_generation", {
    encounter_id: "enc_test",
    planned_participants: [{ id: "planned_group", level: 5, quantity: 2, adjustment: "weak", participation: "mandatory" }],
    planned_hazards: [{ id: "planned_hazard", level: 5, complexity: "complex", participation: "avoidable" }],
    planned_phases: [{ id: "phase_one", participant_ids: ["planned_group"], hazard_ids: ["planned_hazard"] }]
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.data, {
    party_level: 5,
    planned_phases: 1,
    guaranteed_xp: 60,
    avoidable_xp: 40,
    conditional_xp: 0,
    total_encounter_xp: 100,
    peak_active_xp: 100,
    construction_budget: 150,
    warnings: []
  });
});

test("requires an active Generation Run and explains its ID requirement", async () => {
  const commands = [];
  const engine = { snapshot: snapshot(), execute(command) { commands.push(command); return { ok: true, snapshot: this.snapshot }; } };
  const adapter = createWebMCPAdapter({ engine, catalog: new CatalogIndex(catalogFixture) });
  const noRun = await adapter.execute("sidekickdm_add_existing_hazard", { encounter_id: "enc_test", generation_run_id: "run_missing", expected_encounter_revision: 4, expected_constraints_revision: 2, content_id: "hazard/test/bell-snare/current" });
  assert.equal(noRun.ok, false);
  assert.equal(noRun.error.code, "no_active_generation");
  assert.equal(commands.length, 0);

  const active = await createWebMCPAdapter({ snapshot: snapshot({ encounter: { ...snapshot().encounter, generation: { id: "run_active", state: "active" } }, generationRunID: "run_active" }), catalog: new CatalogIndex(catalogFixture) }).execute("sidekickdm_add_existing_hazard", { encounter_id: "enc_test", expected_encounter_revision: 4, expected_constraints_revision: 2, content_id: "hazard/test/bell-snare/current" });
  assert.equal(active.ok, false);
  assert.equal(active.error.code, "invalid_request");
  assert.equal(active.error.recovery, "Reuse the generation_run_id returned by sidekickdm_begin_generation.");
  assert.match(toolDefinitions().find(({ name }) => name === "sidekickdm_add_existing_hazard").description, /generation_run_id returned by sidekickdm_begin_generation/);
});

test("rejects interrupted mutations until the agent explicitly resumes", async () => {
  const commands = [];
  const interrupted = snapshot({
    encounter: { ...snapshot().encounter, generation: { id: "run_interrupted", state: "interrupted" } },
    generationRunID: "run_interrupted"
  });
  const engine = { snapshot: interrupted, execute(command) { commands.push(command); return { ok: true, snapshot: this.snapshot }; } };
  const adapter = createWebMCPAdapter({ engine, catalog: new CatalogIndex(catalogFixture) });
  const rejected = await adapter.execute("sidekickdm_update_creative_brief", {
    encounter_id: "enc_test", generation_run_id: "run_interrupted", expected_encounter_revision: 4,
    expected_constraints_revision: 2, purpose: "Should not apply"
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.error.code, "generation_interrupted");
  assert.equal(commands.length, 0);
  assert.ok(toolDefinitions().some(({ name }) => name === "sidekickdm_resume_generation"));
});

test("publishes packet schemas and defaults optional packet arrays", async () => {
  const commands = [];
  const active = snapshot({
    encounter: { ...snapshot().encounter, generation: { id: "run_packet", state: "active" } },
    generationRunID: "run_packet"
  });
  const engine = { snapshot: active, execute(command) { commands.push(command); return { ok: true, snapshot: this.snapshot }; } };
  const adapter = createWebMCPAdapter({ engine, catalog: new CatalogIndex(catalogFixture) });
  const result = await adapter.execute("sidekickdm_set_running_guidance", {
    encounter_id: "enc_test", generation_run_id: "run_packet", expected_encounter_revision: 4, expected_constraints_revision: 2,
    value: {
      participant_roles: "Hold the doorway.", opening_tactics: "Form a shield wall.", ongoing_tactics: "Fall back.",
      coordination_conflict: "Protect the bell.", triggers_reinforcements: "None.", morale_summary: "Retreat at half strength."
    }
  });
  assert.equal(result.ok, true);
  assert.deepEqual(commands[0].value.adjudicationIssues, []);
  const schema = toolDefinitions().find(({ name }) => name === "sidekickdm_set_running_guidance").inputSchema.properties.value;
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.properties.adjudication_issues.default, []);
});

test("read projections preserve missing native fields instead of inventing domain values", async () => {
  const sparse = snapshot({
    budget: {},
    encounter: { id: "enc_test", revision: 4, brief: { party: {}, threatTarget: {} }, participantGroups: [{ id: "group" }], hazards: [{ id: "hazard" }] }
  });
  const adapter = createWebMCPAdapter({ snapshot: sparse });
  const summary = await adapter.execute("sidekickdm_get_encounter_summary", { encounter_id: "enc_test" });
  assert.equal(summary.data.party.effective_level, null);
  assert.equal(summary.data.party.size, null);
  assert.equal(summary.data.target_threat, null);
  assert.equal(summary.data.inferred_threat, null);
  assert.equal(summary.data.participants[0].quantity, null);
  assert.equal(summary.data.hazards[0].complexity, null);
  const capabilities = await adapter.execute("sidekickdm_get_capabilities");
  assert.deepEqual(capabilities.data.catalog, { fixture_version: null, party_level_focus: [] });
  assert.deepEqual(capabilities.data.active_encounter, { encounter_id: "enc_test", title: "", encounter_revision: 4, brief_revision: 3, constraints_revision: 2 });
});

test("returns compact version 1 projections with current revisions", async () => {
  const catalog = new CatalogIndex(catalogFixture);
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog });
  const capabilities = await adapter.execute("sidekickdm_get_capabilities");
  assert.deepEqual(capabilities, {
    protocol_version: 1,
    encounter_revision: 4,
    brief_revision: 3,
    constraints_revision: 2,
    ok: true,
    data: {
      product: "Sidekick DM",
      protocol_version: 1,
      webmcp_available: true,
      features: {
        custom_creatures: true,
        custom_simple_hazards: true,
        custom_complex_hazards: false,
        custom_spellcasting: false,
        alternative_resolutions: true,
        map_attachments: true
      },
      catalog: { fixture_version: 1, party_level_focus: [] },
      active_encounter: { encounter_id: "enc_test", title: "The Bell Beneath Blackwater", encounter_revision: 4, brief_revision: 3, constraints_revision: 2 }
    }
  });
  const brief = await adapter.execute("sidekickdm_get_encounter_brief");
  assert.equal(brief.data.party.effective_level, 5);
  assert.equal(brief.data.creative.environment, "Flooded ruin.");
  const summary = await adapter.execute("sidekickdm_get_encounter_summary", { encounter_id: "enc_test" });
  assert.equal(summary.data.participants[0].quantity, 2);
  assert.equal(summary.data.readiness.status, "ready with warnings");
  assert.deepEqual(summary.data.revisions, { encounter_revision: 4, constraints_revision: 2 });
  const budget = await adapter.execute("sidekickdm_get_budget");
  assert.equal(budget.data.construction_budget, 150);
  assert.deepEqual(budget.data.phase_budget.per_phase, []);
});

test("projects phase budgets and nested XP categories in the read budget", async () => {
  const adapter = createWebMCPAdapter({ snapshot: snapshot({ phaseBudget: {
    perPhase: [{ phaseID: "phase_1", title: "Bell cracks", participantIDs: ["cmp_1"], hazardIDs: [], activeXP: 40, terrainAdjustment: 2, participation: { mandatoryXP: 40, avoidableXP: 0, conditionalXP: 0, reinforcementXP: 0 } }],
    guaranteedXP: 40, avoidableXP: 0, conditionalXP: 0, reinforcementXP: 0, peakActiveXP: 40, totalEncounterXP: 40, terrainAdjustment: 2, overlapWarnings: []
  }}) });
  const budget = await adapter.execute("sidekickdm_get_budget");
  assert.deepEqual(budget.data.phase_budget.per_phase[0], {
    phase_id: "phase_1", title: "Bell cracks", participant_ids: ["cmp_1"], hazard_ids: [], active_xp: 40,
    terrain_adjustment: 2, participation: { mandatory_xp: 40, avoidable_xp: 0, conditional_xp: 0, reinforcement_xp: 0 }
  });
  assert.equal(budget.data.phase_budget.guaranteed_xp, 40);
});

test("keeps catalog reads compact, detailed, and untrusted through tool hints", async () => {
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog: new CatalogIndex(catalogFixture) });
  const search = await adapter.execute("sidekickdm_search_catalog", { query: "bog", kind: "creature" });
  assert.equal(search.ok, true);
  assert.equal(search.data.results[0].content_id, "creature/test/bog-strider/current");
  assert.equal(search.data.has_more, false);
  assert.equal(search.data.results[0].detail, undefined);
  const entry = await adapter.execute("sidekickdm_get_catalog_entry", { content_id: "creature/test/bog-strider/current" });
  assert.equal(entry.ok, true);
  assert.equal(entry.data.detail.tactics, "Circle isolated targets.");
});

test("maps expected domain failures to structured envelopes", async () => {
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog: new CatalogIndex(catalogFixture) });
  const unknownEncounter = await adapter.execute("sidekickdm_get_encounter_summary", { encounter_id: "enc_missing" });
  assert.equal(unknownEncounter.ok, false);
  assert.equal(unknownEncounter.error.code, "unknown_encounter");
  assert.deepEqual(unknownEncounter.error.details, { encounter_id: "enc_missing" });
  const unknownEntry = await adapter.execute("sidekickdm_get_catalog_entry", { content_id: "creature/missing/current" });
  assert.equal(unknownEntry.ok, false);
  assert.equal(unknownEntry.error.code, "unknown_catalog_entry");
  const unknownTool = await adapter.execute("sidekickdm_not_a_tool");
  assert.equal(unknownTool.ok, false);
  assert.equal(unknownTool.error.code, "unknown_tool");
});

test("feature detection and registration are idempotent per model context", async () => {
  const unavailable = await createWebMCPAdapter({ snapshot: snapshot(), modelContext: null }).register();
  assert.deepEqual(unavailable, { available: false, label: "WebMCP unavailable in this browser" });

  const registered = [];
  const modelContext = { async registerTool(definition) { registered.push(definition); } };
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog: new CatalogIndex(catalogFixture), modelContext });
  assert.deepEqual(await adapter.register(), { available: true, label: "WebMCP connected" });
  assert.deepEqual(await adapter.register(), { available: true, label: "WebMCP connected" });
  assert.equal(registered.length, toolDefinitions().length);
  const result = await registered[1].execute({ encounter_id: "enc_test" });
  assert.equal(result.ok, true);
});

test("registration binds tool handles and execution signals to the adapter lifecycle", async () => {
  const registered = [];
  const removed = [];
  const owner = {
    listeners: new Map(),
    addEventListener(name, handler) { this.listeners.set(name, handler); },
    removeEventListener(name) { this.listeners.delete(name); }
  };
  const modelContext = {
    async registerTool(definition) {
      registered.push(definition);
      return { unregister: async () => removed.push(definition.name) };
    }
  };
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog: new CatalogIndex(catalogFixture), modelContext, registrationOwner: owner });
  await adapter.register();
  assert.ok(registered.every(definition => definition.signal instanceof AbortSignal));
  assert.ok(owner.listeners.has("pagehide"));
  await adapter.unregister();
  assert.equal(removed.length, toolDefinitions().length);
  assert.equal(owner.listeners.size, 0);
  assert.deepEqual(await adapter.unregister(), { available: false, label: "WebMCP not registered" });
});

test("write tools route semantic commands through the shared engine and persist the resulting snapshot", async () => {
  const catalog = new CatalogIndex(catalogFixture);
  const commands = [];
  const persisted = [];
  const engine = {
    snapshot: snapshot(),
    execute(command) {
      commands.push(command);
      const next = snapshot({
        encounterRevision: this.snapshot.encounterRevision + 1,
        encounter: {
          ...this.snapshot.encounter,
          revision: this.snapshot.encounterRevision + 1,
          generation: { id: command.generation_run_id ?? "run_test", state: "active" }
        }
      });
      this.snapshot = next;
      return { ok: true, snapshot: next, encounterRevision: next.encounterRevision, briefRevision: 3, constraintsRevision: 2, generationRunID: next.encounter.generation.id };
    }
  };
  const adapter = createWebMCPAdapter({ engine, catalog, onMutation: draft => persisted.push(draft) });
  const begun = await adapter.execute("sidekickdm_begin_generation", { encounter_id: "enc_test", expected_encounter_revision: 4, expected_brief_revision: 3, expected_constraints_revision: 2, content_boundaries_acknowledged: true });
  assert.equal(begun.ok, true);
  assert.equal(begun.generation_run_id, "run_test");
  assert.equal(commands[0].command, "sidekickdm_begin_generation");
  assert.equal(commands[0].origin, "webmcp");
  assert.equal(persisted.length, 1);

  const added = await adapter.execute("sidekickdm_add_existing_participant_group", { encounter_id: "enc_test", generation_run_id: "run_test", expected_encounter_revision: 5, expected_constraints_revision: 2, content_id: "creature/test/bog-strider/current", quantity: 2 });
  assert.equal(added.ok, true);
  assert.equal(commands[1].catalog_entry.content_id, "creature/test/bog-strider/current");
  assert.equal(commands[1].catalog_entry.completeness, "complete");

  const npc = await adapter.execute("sidekickdm_upsert_npc_profile", {
    encounter_id: "enc_test", generation_run_id: "run_test", expected_encounter_revision: 6, expected_constraints_revision: 2,
    profile: { id: "npc_keeper", participant_group_id: "cmp_1", tier: "incidental", encounter_purpose: "Guard the bell.", immediate_goal: "Buy time.", morale_exit: "Flee when cornered." }
  });
  assert.equal(npc.ok, true);
  assert.equal(commands[2].command, "sidekickdm_upsert_npc_profile");
  assert.equal(commands[2].profile.participant_group_id, "cmp_1");

  const hazard = await adapter.execute("sidekickdm_add_existing_hazard", {
    encounter_id: "enc_test", generation_run_id: "run_test", expected_encounter_revision: 7, expected_constraints_revision: 2,
    content_id: "hazard/test/bell-snare/current", participation_mode: "conditional", participation_condition: "When the bell tolls.", placement: "East pool", phase_id: "phase_1"
  });
  assert.equal(hazard.ok, true);
  assert.equal(commands[3].command, "sidekickdm_add_existing_hazard");
  assert.equal(commands[3].catalog_entry.content_id, "hazard/test/bell-snare/current");
  assert.equal(commands[3].participation_mode, "conditional");
  assert.equal(commands[3].phase_id, "phase_1");
  assert.equal(persisted.length, 4);
});

test("keeps every documented WebMCP tool registered and critical schemas contract-complete", () => {
  const contract = readFileSync(fileURLToPath(new URL("../docs/contracts/sidekick-dm-webmcp-v1.md", import.meta.url)), "utf8");
  const required = [...contract.matchAll(/^### \d+(?:\.\d+)? `((?:sidekickdm_)[a-z_]+)`/gm)].map(match => match[1]);
  const definitions = toolDefinitions();
  const names = new Set(definitions.map(definition => definition.name));
  for (const name of required) assert.ok(names.has(name), `Missing documented WebMCP tool ${name}`);
  const schema = name => definitions.find(definition => definition.name === name)?.inputSchema;
  assert.deepEqual(schema("sidekickdm_cancel_generation").required, ["encounter_id", "generation_run_id", "expected_encounter_revision"]);
  assert.deepEqual(schema("sidekickdm_apply_targeted_revision").required, ["encounter_id", "expected_encounter_revision", "section", "value"]);
  assert.deepEqual(schema("sidekickdm_update_creature").required, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision", "creature"]);
  assert.deepEqual(schema("sidekickdm_get_component").required, ["encounter_id", "component_id"]);
  assert.deepEqual(schema("sidekickdm_get_encounter_packet").required, ["encounter_id"]);
  assert.equal(schema("sidekickdm_set_generation_assumptions").properties.generation_run_id.type, "string");
  assert.deepEqual(schema("sidekickdm_resume_generation").required, ["encounter_id", "generation_run_id", "expected_encounter_revision", "expected_constraints_revision"]);
});
