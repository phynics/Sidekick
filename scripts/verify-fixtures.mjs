import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function object(value, label) {
  assert.ok(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object`);
  return value;
}

function nonEmpty(value, label) {
  assert.equal(typeof value, "string", `${label} must be text`);
  assert.ok(value.trim(), `${label} must not be empty`);
}

const rulesPath = resolve(root, "docs/compatibility/pf2-rules-golden.v1.json");
const demoPath = resolve(root, "public/data/demo-encounter.v1.json");
const noticePath = resolve(root, "public/data/NOTICE.txt");
const releaseNoticePath = resolve(root, "docs/compatibility/release-notices.md");
const catalogAuditManifestPath = resolve(root, "docs/compatibility/catalog-manifest.v1.json");

const [rulesRaw, demoRaw, notice, releaseNotice, catalogAuditManifestRaw] = await Promise.all([
  readFile(rulesPath, "utf8"),
  readFile(demoPath, "utf8"),
  readFile(noticePath, "utf8"),
  readFile(releaseNoticePath, "utf8"),
  readFile(catalogAuditManifestPath, "utf8")
]);

const rules = object(JSON.parse(rulesRaw), "rules fixture");
assert.equal(rules.fixture_version, 1);
assert.equal(rules.ruleset, "pf2-remaster");
assert.equal(rules.status, "verified-against-published-rules");
assert.ok(Array.isArray(rules.sources) && rules.sources.length >= 1, "rules fixture needs published sources");
for (const [index, source] of rules.sources.entries()) {
  object(source, `rules source ${index}`);
  nonEmpty(source.title, `rules source ${index}.title`);
  assert.ok(Array.isArray(source.tables) && source.tables.length > 0, `rules source ${index}.tables must not be empty`);
  assert.match(source.url, /^https:\/\//, `rules source ${index}.url must be HTTPS`);
}

const threatBudgets = rules.threat_budgets;
assert.deepEqual(threatBudgets, [
  { threat: "trivial", base_budget: 40, per_character_adjustment: 10, published_maximum: true },
  { threat: "low", base_budget: 60, per_character_adjustment: 20 },
  { threat: "moderate", base_budget: 80, per_character_adjustment: 20 },
  { threat: "severe", base_budget: 120, per_character_adjustment: 30 },
  { threat: "extreme", base_budget: 160, per_character_adjustment: 40 }
], "threat budget fixture changed");
assert.deepEqual(rules.party_size_adjustments.party_sizes, [1, 2, 3, 4, 5, 6, 7, 8]);
assert.equal(rules.party_size_adjustments.base_xp_award_uses_four_character_encounter, true);
assert.deepEqual(rules.creature_xp_by_relative_level.map(({ relative_level, xp }) => [relative_level, xp]), [
  [-4, 10], [-3, 15], [-2, 20], [-1, 30], [0, 40], [1, 60], [2, 80], [3, 120], [4, 160]
]);
assert.deepEqual(rules.hazard_xp_by_relative_level.simple.map(({ relative_level, xp }) => [relative_level, xp]), [
  [-4, 2], [-3, 3], [-2, 4], [-1, 6], [0, 8], [1, 12], [2, 16], [3, 24], [4, 30]
]);
assert.deepEqual(rules.hazard_xp_by_relative_level.complex.at(-1), { relative_level: 4, xp: 150 });
const invariants = new Set(rules.invariants.map(({ id }) => id));
for (const id of ["party-size-budget", "party-size-xp", "hazard-below-minus-four", "complex-hazard-xp", "simple-hazard-xp"]) assert.ok(invariants.has(id), `missing rules invariant ${id}`);

const demo = object(JSON.parse(demoRaw), "demo fixture");
assert.deepEqual(demo, {
  format: "sidekickdm",
  format_version: 1,
  export_kind: "encounter",
  title: "The Bell Beneath Blackwater",
  asset_message: "Static Encounter Brief loaded from JSON."
}, "demo fixture changed; update this assertion and review determinism");
assert.equal(demoRaw, `${JSON.stringify(demo, null, 2)}\n`, "demo fixture must use stable JSON formatting");
assert.equal(/(?:generated_at|exported_at|modified_at|created_at)\s*:/i.test(demoRaw), false, "demo fixture must not contain wall-clock fields");

for (const [label, text] of [["catalog notice", notice], ["release notice", releaseNotice]]) {
  nonEmpty(text, label);
  assert.equal(/(?:portrait|art|token|map|macro|rule-element automation)/i.test(text), true, `${label} must state the asset boundary`);
}
assert.match(notice, /ORC/i);
assert.match(releaseNotice, /Foundry/i);
const catalogAuditManifest = object(JSON.parse(catalogAuditManifestRaw), "catalog audit manifest");
assert.equal(catalogAuditManifest.manifest_version, 1);
assert.equal(catalogAuditManifest.status, "generated");
assert.equal(catalogAuditManifest.source?.system, "foundryvtt-pf2e");
assert.ok(catalogAuditManifest.source?.repository && catalogAuditManifest.source?.revision && catalogAuditManifest.generator_revision);
assert.deepEqual(catalogAuditManifest.publication_attributions, ["Pathfinder GM Core", "Pathfinder Monster Core", "Pathfinder NPC Core"]);
assert.ok(catalogAuditManifest.asset_boundary?.excluded?.includes("rule-element automation"));
assert.equal(catalogAuditManifest.nested_license_policy?.action, "unsupported");

console.log("Fixture and source-notice verification passed: PF2 rules vectors, deterministic demo asset, and checked-in rights boundaries.");
