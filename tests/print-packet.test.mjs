import test from "node:test";
import assert from "node:assert/strict";
import {
  PRINT_CSS,
  PRINT_SECTION_ORDER,
  createEncounterPrintProjection,
  renderEncounterPrintProjection
} from "../src/print-packet.js";

const catalog = {
  fixture_version: 1,
  entries: [{
    content_id: "creature/monster-core/bog-strider/current",
    kind: "creature",
    name: "Bog Strider",
    level: 5,
    source: "Pathfinder Monster Core",
    provenance: {
      source_title: "Pathfinder Monster Core",
      source_page: null,
      edition: "current",
      upstream: { system: "foundryvtt-pf2e", pack: "packs/pathfinder-monster-core", identifier: "bog-strider" },
      source_sha256: "a".repeat(64),
      license_basis: "ORC",
      notices: ["ORC"],
      diagnostics: []
    },
    detail: {
      defenses: { ac: 24, fortitude: 17 },
      tactics: "Circle isolated targets.",
      strikes: [{ name: "Spear", attack: 14, damage: "1d8+4" }]
    }
  }]
};

function restoredExport() {
  return {
    format: "sidekickdm",
    format_version: 1,
    export_kind: "encounter",
    license_notices: ["Export-specific notice"],
    data: {
      encounter: {
        id: "enc_print",
        title: "The <Bell> & Blackwater",
        review_state: "needed",
        provenance: { origin: "webmcp", last_changed_by: "gm" },
        brief: {
          party: { effective_level: 5, size: 5 },
          threat_target: { kind: "severe", custom_xp: null },
          purpose: "Stop the bell.",
          environment: "Flooded ruin"
        },
        participant_groups: [{
          id: "cmp_bog",
          content_id: "creature/monster-core/bog-strider/current",
          name: "Bog Strider",
          level: 5,
          quantity: 2,
          adjustment: "normal",
          participation: { mode: "mandatory" },
          encounter_role: "skirmisher",
          starting_area: "Eastern pools"
        }],
        hazards: [],
        phases: [{
          id: "phase_2",
          order: 2,
          title: "Bell rings",
          trigger: { type: "alarm_raised", description: "When the bell is struck." },
          active_participant_group_ids: ["cmp_bog"],
          active_hazard_ids: [],
          terrain_changes: ["East gate closes."],
          running_guidance: "Push intruders toward the water."
        }],
        packet: {
          identity: { title: "The <Bell> & Blackwater", premise: "A bell calls the flood.", objective: "Silence it.", stakes: "The district floods." },
          setup: { trigger: "The party enters.", battlefield_description: "A flooded shrine.", starting_positions: "Beside the eastern pool.", awareness_state: "Sentries are alert.", immediate_features: ["Knee-deep water"], read_aloud: "The bell sways above black water." },
          battlefield: { zones: ["Eastern pools"], cover: ["Broken pillars"] },
          running_guidance: { opening_tactics: "Delay the party.", morale_summary: "Flee when the captain falls." },
          cohesion: { participant_presence: "They guard the shrine.", relationships: "The captain commands.", hazard_terrain_fit: "Water hides the chain.", theme: "Dread" },
          information: { immediately_apparent: ["The bell"], discoverable: ["A hidden chain"], gm_secret: ["The cult is divided"] },
          outcomes: { victory: "The bell falls silent.", failure: "The district floods." }
        }
      }
    }
  };
}

test("projects a restored snake_case encounter in runnable print order", () => {
  const input = restoredExport();
  input.budget = { target_threat: "severe", construction_budget: 150, guaranteed_xp: 80, peak_active_xp: 80, total_encounter_xp: 80, warnings: [] };
  input.readiness = { status: "ready_with_warnings", structural_errors: [], design_warnings: ["Review the opening."] };
  const projection = createEncounterPrintProjection({ ...input, catalog, manifest: { source: { revision: "fixture-revision", system: "foundryvtt-pf2e" } } });
  assert.deepEqual(projection.sectionOrder, PRINT_SECTION_ORDER);
  assert.equal(projection.phases[0].title, "Bell rings");
  assert.deepEqual(projection.phases[0].participants.map(({ name }) => name), ["Bog Strider"]);
  assert.equal(projection.componentMechanics.participants[0].mechanics.defenses.ac, 24);
  assert.equal(projection.notices.catalogProvenance[0].sourceTitle, "Pathfinder Monster Core");
  assert.equal(projection.notices.catalogProvenance[0].sourcePage, "Not known");
  assert.equal(projection.notices.source.revision, "fixture-revision");

  const html = renderEncounterPrintProjection(projection);
  const order = ["Summary", "Setup", "Phases", "Component mechanics", "Outcomes", "Notices and provenance"].map((heading) => html.indexOf(`>${heading}<`));
  assert.ok(order.every((position, index) => position >= 0 && (index === 0 || position > order[index - 1])));
  assert.match(html, /The &lt;Bell&gt; &amp; Blackwater/);
  assert.match(html, /Catalog Provenance/);
  assert.match(html, /Export-specific notice/);
  assert.doesNotMatch(html, /<button\b|<input\b|<select\b|<textarea\b|<form\b/);
});

test("print projection is deterministic and carries required rights notices", () => {
  const input = { ...restoredExport(), catalog, manifest: { source: { revision: "r1", system: "foundryvtt-pf2e" } } };
  assert.deepEqual(createEncounterPrintProjection(input), createEncounterPrintProjection(input));
  assert.equal(renderEncounterPrintProjection(input), renderEncounterPrintProjection(input));
  const html = renderEncounterPrintProjection(input);
  assert.match(html, /unofficial product/);
  assert.match(html, /ORC License located at the Library of Congress/);
  assert.match(html, /Foundry VTT PF2e system/);
  assert.match(html, /No rights to portraits, art, tokens, maps/);
  assert.match(html, /fixture-revision|Not recorded/);
  assert.match(PRINT_CSS, /@media print/);
  assert.match(PRINT_CSS, /display:none!important/);
  assert.match(PRINT_CSS, /break-inside:avoid/);
  assert.match(PRINT_CSS, /page-break-inside:avoid/);
});

test("original components remain printable without inventing catalog provenance", () => {
  const projection = createEncounterPrintProjection({
    encounter: {
      title: "Original Encounter",
      originalCreatures: [{ id: "cre_1", identity: { name: "Mire Scout", level: 3 }, tactics: "Flank.", morale: "Withdraw." }],
      participantGroups: [{ id: "g1", contentID: "creature/original/cre_1/current", name: "Mire Scout", level: 3, quantity: 1 }],
      hazards: [], phases: [], packetV1: { identity: { title: "Original Encounter" }, setup: {}, battlefield: {}, cohesion: {}, information: {}, outcomes: {} }
    }
  });
  assert.equal(projection.componentMechanics.participants[0].name, "Mire Scout");
  assert.equal(projection.notices.catalogProvenance.length, 0);
  assert.match(renderEncounterPrintProjection(projection), /No embedded catalog provenance recorded/);
});

test("restored embedded Catalog snapshots print without a runtime Catalog", () => {
  const entry = { ...catalog.entries[0], id: "catalog_snapshot_cmp_bog", contentID: catalog.entries[0].content_id, snapshotKind: "catalog" };
  const projection = createEncounterPrintProjection({
    encounter: restoredExport().data.encounter,
    embeddedComponents: { creatures: [entry], npcProfiles: [], hazards: [] }
  });
  assert.equal(projection.componentMechanics.participants[0].mechanics.defenses.ac, 24);
  assert.equal(projection.notices.catalogProvenance[0].contentID, catalog.entries[0].content_id);
});

test("prints existing spellcasting blocks, Catalog diagnostics, and unresolved-license warnings", () => {
  const spellcaster = {
    ...catalog.entries[0],
    content_id: "creature/monster-core/spellcaster/current",
    name: "Spellcaster",
    provenance: {
      ...catalog.entries[0].provenance,
      license_basis: null,
      diagnostics: ["Nested item publication requires independent license review."]
    },
    detail: { ...catalog.entries[0].detail, spellcasting_blocks: ["Arcane Spontaneous Spells"] }
  };
  const input = {
    catalog: { ...catalog, catalog_id: "catalog-proof", source_revision: "source-proof", entries: [catalog.entries[0], spellcaster] },
    manifest: {
      catalog_id: "catalog-proof",
      generated_at: "2026-08-28T00:00:00Z",
      generator: { name: "Catalog Generator", version: "9.1.0" },
      counts: { creatures: 2, hazards: 0, total: 2 },
      source: { revision: "source-proof", system: "foundryvtt-pf2e" }
    },
    encounter: {
      id: "enc_proof",
      participantGroups: [
        { id: "spellcaster_1", contentID: spellcaster.content_id, name: "Spellcaster", level: 5, quantity: 1 },
        { id: "bog_1", contentID: catalog.entries[0].content_id, name: "Bog Strider", level: 5, quantity: 1 }
      ],
      hazards: [],
      phases: [],
      packetV1: { identity: { title: "Print proof" }, setup: {}, battlefield: {}, cohesion: {}, information: {}, outcomes: {} }
    }
  };
  const projection = createEncounterPrintProjection(input);
  assert.deepEqual(projection.componentMechanics.participants[0].mechanics.spellcasting, ["Arcane Spontaneous Spells"]);
  assert.deepEqual(projection.notices.diagnostics, ["Nested item publication requires independent license review."]);
  assert.deepEqual(projection.notices.unresolvedLicenses, ["License basis is unresolved for creature/monster-core/spellcaster/current."]);
  assert.deepEqual(projection.notices.source, {
    catalogID: "catalog-proof",
    system: "foundryvtt-pf2e",
    revision: "source-proof",
    generatedAt: "2026-08-28T00:00:00Z",
    generatorName: "Catalog Generator",
    generatorVersion: "9.1.0",
    counts: { creatures: 2, hazards: 0, total: 2 }
  });
  const html = renderEncounterPrintProjection(projection);
  assert.match(html, /Arcane Spontaneous Spells/);
  assert.match(html, /Catalog diagnostics/);
  assert.match(html, /Nested item publication requires independent license review/);
  assert.match(html, /Unresolved license warnings/);
  assert.match(html, /License basis is unresolved/);
  assert.match(html, /Catalog Generator/);
  assert.match(html, /print-running-header/);
  assert.match(html, /position:running\(sidekick-print-header\)/);
  assert.match(renderEncounterPrintProjection(projection, { inlineStyles: false }), /styles\/print\.css/);
});
