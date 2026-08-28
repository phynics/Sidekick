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
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
assert.equal(fixture.fixture_version, 1);
assert.equal(fixture.catalog_id, manifest.catalog_id);
assert.equal(fixture.source_revision, manifest.source.revision);
assert.ok(fixture.generated_at);
assert.ok(Array.isArray(fixture.entries) && fixture.entries.length > 0);

const ids = new Set();
for (const entry of fixture.entries) {
  assert.match(entry.content_id, /^(creature|hazard)\/[a-z0-9-]+\/[a-z0-9-]+\/(current|legacy|adventure)$/);
  assert.equal(ids.has(entry.content_id), false, `duplicate ContentID ${entry.content_id}`);
  ids.add(entry.content_id);
  for (const field of ["name", "source", "summary", "provenance", "detail"]) assert.ok(entry[field] != null, `${entry.content_id} missing ${field}`);
  assert.ok(["complete", "partial"].includes(entry.completeness));
  assert.ok(["supported", "unsupported"].includes(entry.support));
  assert.ok(entry.provenance.source_title && entry.provenance.upstream?.system && entry.provenance.upstream?.pack && entry.provenance.upstream?.identifier && entry.provenance.source_sha256 && entry.provenance.license_basis);
  assert.equal(/(?:^|_)(img|image|portrait|token|map)(?:$|_)/i.test(JSON.stringify(entry)), false, `${entry.content_id} contains art/token fields`);
  assert.equal(/<\/?[a-z][^>]*>|javascript:|on[a-z]+\s*=/i.test(JSON.stringify(entry)), false, `${entry.content_id} contains unsafe markup`);
}
assert.equal(ids.size, fixture.entries.length);
assert.equal(manifest.counts.total, fixture.entries.length);

const catalog = new CatalogIndex(fixture);
const all = catalog.search();
assert.equal(all.limit, 20);
assert.ok(all.results.length <= 20);
assert.equal(catalog.search({ query: "orc", kind: "creature" }).results[0].name, "Orc Veteran");
assert.deepEqual(catalog.search({ query: "electric", kind: "hazard", hazard_complexity: "simple", traits: ["trap"], environments: ["urban"] }).results.map((entry) => entry.name), ["Electric Latch Rune"]);
assert.equal(catalog.search({ limit: 999 }).limit, 50);
assert.equal(catalog.search({ kind: "creature", limit: 1, offset: 1 }).results.length, 1);
const added = catalog.addExistingCreatureCommand("creature/monster-core/goblin-warrior/current", { quantity: 2, adjustment: "elite" });
assert.equal(added.ok, true);
assert.equal(added.command.quantity, 2);
assert.equal(catalog.addExistingCreatureCommand("hazard/gm-core/electric-latch-rune/current").error.code, "invalid_participant_kind");
assert.equal(catalog.addExistingCreatureCommand("missing").error.code, "unknown_catalog_entry");

const temp = await mkdtemp(join(tmpdir(), "sidekick-catalog-"));
try {
  const regenerated = join(temp, "catalog.json");
  const regeneratedManifest = join(temp, "manifest.json");
  const regeneratedNotice = join(temp, "NOTICE.txt");
  const result = spawnSync(process.execPath, [join(root, "scripts/generate-catalog.mjs"), "--output", regenerated, "--manifest", regeneratedManifest, "--notice", regeneratedNotice], { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(readFileSync(regenerated), readFileSync(fixturePath), "catalog generation is not byte deterministic");
  assert.deepEqual(readFileSync(regeneratedManifest), readFileSync(manifestPath), "catalog manifest generation is not byte deterministic");
} finally {
  await rm(temp, { recursive: true, force: true });
}
console.log(`Catalog verification passed: ${fixture.entries.length} deterministic entries, bounded search, provenance, safe text, and add-existing command contract.`);
