import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { CatalogIndex } from "../src/catalog-index.js";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const fixturePath = join(root, "public/data/sidekickdm-catalog.v1.json");
const manifestPath = join(root, "public/data/catalog-manifest.v1.json");
const noticePath = join(root, "public/data/NOTICE.txt");
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const notice = await readFile(noticePath, "utf8");
assert.equal(fixture.fixture_version, 1);
assert.equal(fixture.catalog_id, manifest.catalog_id);
assert.equal(fixture.source_revision, manifest.source.revision);
assert.equal(fixture.source_revision, manifest.source_revision);
assert.ok(fixture.generated_at);
assert.ok(Array.isArray(fixture.entries) && fixture.entries.length > 0);
assert.equal(manifest.manifest_version, 1);
assert.equal(manifest.generator_revision, manifest.generator.version);
assert.ok(Array.isArray(manifest.required_entry_metadata) && manifest.required_entry_metadata.length > 0);
assert.equal(new Set(manifest.required_entry_metadata).size, manifest.required_entry_metadata.length, "required_entry_metadata must not contain duplicate paths");
assert.deepEqual(manifest.artifacts, ["public/data/sidekickdm-catalog.v1.json", "public/data/catalog-manifest.v1.json", "public/data/NOTICE.txt"]);
assert.ok(Array.isArray(manifest.entries) && manifest.entries.length === fixture.entries.length, "manifest must describe every catalog entry");
for (const field of ["unofficial_product", "orc", "extraction", "asset_boundary"]) assert.ok(manifest.notices[field], `manifest notices missing ${field}`);
assert.ok(manifest.source.repository && manifest.source.revision_date && manifest.source.attribution);
assert.ok(manifest.asset_boundary.notice && manifest.asset_boundary.included.length > 0 && manifest.asset_boundary.excluded.length > 0);
assert.deepEqual(manifest.publication_attributions.map(({ title }) => title), ["Pathfinder GM Core", "Pathfinder Monster Core", "Pathfinder NPC Core"]);
for (const publication of manifest.publication_attributions) {
  assert.ok(publication.attribution && publication.copyright && publication.publisher && publication.license, `${publication.title} publication attribution is incomplete`);
}
for (const field of ["Sidekick DM is an unofficial product", "ORC License", "Foundry VTT PF2e", "portraits", "rule-element automation"]) assert.match(notice, new RegExp(field, "i"), `NOTICE.txt missing ${field}`);
assert.equal(notice.includes("\r"), false, "NOTICE.txt must use LF line endings");
assert.equal(notice.endsWith("\n"), true, "NOTICE.txt must end with one newline");
assert.equal(notice.endsWith("\n\n"), false, "NOTICE.txt must not contain extra trailing blank lines");

const ids = new Set();
function pathValue(value, path) {
  return path.split(".").reduce((current, key) => current == null ? undefined : current[key], value);
}

function assertManifestEntryMetadata(entry, fixtureEntry) {
  for (const path of manifest.required_entry_metadata) {
    const actual = pathValue(entry, path);
    assert.notEqual(actual, undefined, `${entry.content_id ?? "manifest entry"} missing required metadata ${path}`);
    assert.deepEqual(actual, pathValue(fixtureEntry, path), `${entry.content_id} metadata drifted at ${path}`);
  }
}

for (const entry of fixture.entries) {
  assert.match(entry.content_id, /^(creature|hazard)\/[a-z0-9-]+\/[a-z0-9-]+\/(current|legacy|adventure)$/);
  assert.equal(ids.has(entry.content_id), false, `duplicate ContentID ${entry.content_id}`);
  ids.add(entry.content_id);
  for (const field of ["name", "source", "summary", "provenance", "detail"]) assert.ok(entry[field] != null, `${entry.content_id} missing ${field}`);
  assert.ok(["complete", "partial"].includes(entry.completeness));
  assert.ok(["supported", "unsupported"].includes(entry.support));
  assert.ok(entry.provenance.source_title && entry.provenance.upstream?.system && entry.provenance.upstream?.pack && entry.provenance.upstream?.identifier && entry.provenance.source_sha256 && entry.provenance.license_basis);
  assert.ok(entry.provenance.source_file && entry.provenance.source_revision === fixture.source_revision);
  assert.ok(entry.provenance.publication_attribution?.title && entry.provenance.publication_attribution?.attribution);
  assert.ok(entry.provenance.extraction_attribution?.repository && entry.provenance.extraction_attribution?.revision === fixture.source_revision);
  assert.ok(entry.asset_boundary?.notice && Array.isArray(entry.asset_boundary.excluded));
  assert.ok(Array.isArray(entry.provenance.nested_items) && Array.isArray(entry.provenance.nested_license_mismatches) && Array.isArray(entry.provenance.notices) && Array.isArray(entry.provenance.diagnostics));
  for (const item of entry.provenance.nested_items) assert.ok(Object.hasOwn(item, "publication") && item.path.startsWith("items["), `${entry.content_id} nested item provenance is incomplete`);
  if (entry.provenance.nested_license_mismatches.length > 0) {
    assert.equal(entry.support, "unsupported", `${entry.content_id} must be unsupported when nested licensing is unresolved`);
    assert.match(entry.provenance.diagnostics.join("\n"), /Nested item publication requires independent license review/);
  }
  assert.equal(/(?:^|_)(img|image|portrait|token|map)(?:$|_)/i.test(JSON.stringify(entry)), false, `${entry.content_id} contains art/token fields`);
  assert.equal(/<\/?[a-z][^>]*>|javascript:|on[a-z]+\s*=/i.test(JSON.stringify(entry)), false, `${entry.content_id} contains unsafe markup`);
}
assert.equal(ids.size, fixture.entries.length);
assert.equal(manifest.counts.total, fixture.entries.length);
assert.deepEqual(manifest.entries.map(({ content_id }) => content_id), fixture.entries.map(({ content_id }) => content_id));
for (const [index, entry] of manifest.entries.entries()) {
  assertManifestEntryMetadata(entry, fixture.entries[index]);
  assert.ok(entry.source_revision === fixture.source_revision && entry.source_sha256 && entry.publication_attribution?.attribution && entry.extraction_attribution?.revision === fixture.source_revision, `${entry.content_id} manifest provenance is incomplete`);
}

const catalog = new CatalogIndex(fixture);
const all = catalog.search();
assert.equal(all.limit, 20);
assert.ok(all.results.length <= 20);
assert.equal(catalog.search({ query: "orc", kind: "creature" }).results[0].name, "Orc Veteran");
assert.deepEqual(catalog.search({ query: "electric", kind: "hazard", hazard_complexity: "simple", traits: ["trap"], environments: ["urban"], support: null }).results.map((entry) => entry.name), ["Electric Latch Rune"]);
assert.equal(catalog.search({ limit: 999 }).limit, 50);
assert.equal(catalog.search({ kind: "creature", limit: 1, offset: 1 }).results.length, 1);
const added = catalog.addExistingCreatureCommand("creature/monster-core/goblin-warrior/current", { quantity: 2, adjustment: "elite" });
assert.equal(added.ok, true);
assert.equal(added.command.quantity, 2);
assert.equal(added.command.catalog_entry.catalog_id, fixture.catalog_id);
assert.equal(added.command.catalog_entry.source_revision, fixture.source_revision);
assert.equal(catalog.addExistingCreatureCommand("hazard/gm-core/electric-latch-rune/current").error.code, "invalid_participant_kind");
assert.equal(catalog.addExistingCreatureCommand("missing").error.code, "unknown_catalog_entry");
const blocked = structuredClone(fixture);
blocked.entries = blocked.entries.map((entry, index) => index === 0 ? { ...entry, support: "unsupported" } : entry);
assert.equal(new CatalogIndex(blocked).addExistingCreatureCommand(blocked.entries[0].content_id).error.code, "catalog_entry_partial");
assert.equal(catalog.addExistingCreatureCommand("hazard/gm-core/electric-latch-rune/current").error.code, "invalid_participant_kind");
assert.deepEqual(catalog.search({ kind: "creature", level_min: 1, level_max: 4, traits: ["humanoid"], environments: ["underground"], roles: ["defender"], limit: 50 }).results.map(({ name }) => name), ["Orc Veteran"]);
assert.equal(catalog.get("creature/monster-core/flame-drake/current").detail.strikes.length, 2, "full Creature details must remain available for inspection");

const temp = await mkdtemp(join(tmpdir(), "sidekick-catalog-"));
try {
  const regenerated = join(temp, "catalog.json");
  const regeneratedManifest = join(temp, "manifest.json");
  const regeneratedNotice = join(temp, "NOTICE.txt");
  const result = spawnSync(process.execPath, [join(root, "scripts/generate-catalog.mjs"), "--output", regenerated, "--manifest", regeneratedManifest, "--notice", regeneratedNotice], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(regenerated), readFileSync(fixturePath), "catalog generation is not byte deterministic");
  assert.deepEqual(readFileSync(regeneratedManifest), readFileSync(manifestPath), "catalog manifest generation is not byte deterministic");
  assert.deepEqual(readFileSync(regeneratedNotice), readFileSync(noticePath), "NOTICE.txt generation is not byte deterministic");
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(`Catalog verification passed: ${fixture.entries.length} deterministic entries, bounded search, provenance, safe text, and add-existing command contract.`);
