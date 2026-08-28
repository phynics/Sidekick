import test from "node:test";
import assert from "node:assert/strict";
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
    }
  ]
};

function snapshot(overrides = {}) {
  return {
    protocolVersion: 1,
    encounterRevision: 4,
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
  assert.deepEqual(toolDefinitions().map(({ name }) => name), [
    "sidekickdm_get_capabilities",
    "sidekickdm_get_encounter_summary",
    "sidekickdm_get_encounter_brief",
    "sidekickdm_get_brief_checklist",
    "sidekickdm_get_budget",
    "sidekickdm_get_readiness",
    "sidekickdm_search_catalog",
    "sidekickdm_get_catalog_entry"
  ]);
  for (const definition of toolDefinitions()) {
    assert.equal(definition.readOnlyHint, true);
    assert.equal(definition.annotations.readOnlyHint, true);
  }
  assert.equal(toolDefinitions().find(({ name }) => name.endsWith("get_encounter_brief")).untrustedContentHint, true);
  assert.equal(toolDefinitions().find(({ name }) => name.endsWith("get_budget")).untrustedContentHint, false);
});

test("returns compact version 1 projections with current revisions", async () => {
  const catalog = new CatalogIndex(catalogFixture);
  const adapter = createWebMCPAdapter({ snapshot: snapshot(), catalog });
  const capabilities = await adapter.execute("sidekickdm_get_capabilities");
  assert.deepEqual(capabilities, {
    protocol_version: 1,
    encounter_revision: 4,
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
      catalog: { fixture_version: 1, party_level_focus: [1, 10] }
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
  assert.equal(registered.length, 8);
  const result = await registered[1].execute({ encounter_id: "enc_test" });
  assert.equal(result.ok, true);
});
