import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const defaultSourceRoot = resolve(root, "../pf2e");
const selectedFiles = [
  ["pathfinder-monster-core/goblin-warrior.json", "creature"],
  ["pathfinder-monster-core/aapoph-granitescale.json", "creature"],
  ["pathfinder-monster-core/orc-veteran.json", "creature"],
  ["pathfinder-monster-core/phantom-knight.json", "creature"],
  ["pathfinder-monster-core/goblin-pyro.json", "creature"],
  ["pathfinder-monster-core/pixie.json", "creature"],
  ["pathfinder-monster-core/flame-drake.json", "creature"],
  ["pathfinder-npc-core/ancestry-npcs/dwarf/dwarf-smith.json", "creature"],
  ["hazards/electric-latch-rune.json", "hazard"],
  ["hazards/quicksand.json", "hazard"],
  ["hazards/bottomless-pit.json", "hazard"]
];
const args = new Map();
for (let index = 2; index < process.argv.length; index += 1) {
  if (process.argv[index].startsWith("--")) args.set(process.argv[index], process.argv[index + 1] ?? "");
}
const sourceRoot = resolve(args.get("--source-root") || process.env.SIDEKICK_PF2E_SOURCE_ROOT || defaultSourceRoot);
const output = resolve(args.get("--output") || resolve(root, "public/data/sidekickdm-catalog.v1.json"));
const manifestOutput = resolve(args.get("--manifest") || resolve(root, "public/data/catalog-manifest.v1.json"));
const noticeOutput = resolve(args.get("--notice") || resolve(root, "public/data/NOTICE.txt"));
const sourceRevision = args.get("--source-revision") || "4cbdaa37d6c33e9519561bae2c59a23e0288cbce";
const generatedAt = args.get("--generated-at") || "2026-08-28T00:00:00Z";

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]));
}

function writeJSON(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(sorted(value), null, 2)}\n`, "utf8");
}

function slug(value) {
  return String(value).toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function plain(value = "") {
  return String(value)
    .replace(/<[^>]*>/g, " ")
    .replace(/@(?:Check|Damage|UUID|Template|Affliction|Localize)\[[^\]]*\]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/[\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function publication(record, fallback) {
  const value = record?.system?.details?.publication;
  if (typeof value === "string") return { title: value, license: "ORC", remaster: true };
  return value && typeof value === "object" ? value : { title: fallback, license: "ORC", remaster: true };
}

function traits(record) {
  return [...(record?.system?.traits?.value ?? [])].map(String).sort();
}

function roles(record, kind) {
  if (kind === "hazard") return [];
  const names = `${record.name} ${traits(record).join(" ")}`.toLowerCase();
  const result = [];
  if (names.includes("spell") || (record.items ?? []).some((item) => item.type === "spellcastingEntry")) result.push("controller");
  if (names.includes("bow") || names.includes("ranged") || names.includes("sniper")) result.push("sniper");
  if (names.includes("dragon") || names.includes("giant") || names.includes("brute")) result.push("brute");
  if (names.includes("guard") || names.includes("knight") || names.includes("veteran")) result.push("defender");
  if (result.length === 0) result.push("skirmisher");
  return [...new Set(result)].sort();
}

function environments(record, kind) {
  const names = `${record.name} ${traits(record).join(" ")} ${plain(record?.system?.details?.publicNotes ?? record?.system?.details?.description)}`.toLowerCase();
  const result = [];
  if (/bog|swamp|water|aquatic|quicksand|amphibious|fish/.test(names)) result.push("aquatic");
  if (/forest|fey|pixie|goblin|elf/.test(names)) result.push("forest");
  if (/cave|underground|rune|latch|dungeon|dwarf|orc/.test(names)) result.push("underground");
  if (/desert|sand|fire|flame|drake/.test(names)) result.push("desert");
  if (/urban|door|latch|guard|smith/.test(names)) result.push("urban");
  if (kind === "hazard" && result.length === 0) result.push("underground");
  return [...new Set(result)].sort();
}

function summary(record, kind) {
  const text = plain(record?.system?.details?.blurb || record?.system?.details?.publicNotes || record?.system?.details?.description);
  return text.length > 180 ? `${text.slice(0, 177).trimEnd()}...` : text || `${kind === "hazard" ? "Hazard" : "Creature"} entry from the curated PF2 source.`;
}

function abilityItems(record) {
  return (record.items ?? [])
    .filter((item) => ["action", "melee", "ranged", "spellcastingEntry"].includes(item.type))
    .map((item) => ({
      action_cost: item.system?.actions?.value ?? item.system?.actionType?.value ?? null,
      name: item.name,
      text: plain(item.system?.description?.value),
      traits: [...(item.system?.traits?.value ?? [])].map(String).sort()
    }))
    .filter((item) => item.name && item.text)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function strikeItems(record) {
  return (record.items ?? [])
    .filter((item) => ["melee", "ranged"].includes(item.type))
    .map((item) => ({
      damage: plain(item.system?.damage?.damage),
      name: item.name,
      traits: [...(item.system?.traits?.value ?? [])].map(String).sort()
    }))
    .filter((item) => item.name)
    .sort((a, b) => a.name.localeCompare(b.name));
}

function parseHazardEffect(record) {
  const text = plain(record?.items?.[0]?.system?.description?.value);
  const trigger = text.match(/Trigger\s+(.+?)(?:Effect\s+|$)/i)?.[1]?.trim() ?? "";
  const effect = text.match(/Effect\s+(.+)$/i)?.[1]?.trim() ?? text;
  return { trigger, effect };
}

function normalize(relativeFile, expectedKind) {
  const file = resolve(sourceRoot, "packs", relativeFile);
  if (!existsSync(file)) throw new Error(`Catalog source is missing: ${file}`);
  const raw = readFileSync(file);
  const record = JSON.parse(raw);
  const kind = expectedKind;
  const pack = relativeFile.split("/")[0];
  const sourceSlug = { hazards: "gm-core", "pathfinder-monster-core": "monster-core", "pathfinder-npc-core": "npc-core" }[pack] || pack;
  const stable = relativeFile.slice(pack.length + 1, -5).replaceAll("/", "-");
  const pub = publication(record, pack);
  const edition = pub.remaster === false ? "legacy" : "current";
  const contentID = `${kind}/${slug(sourceSlug)}/${slug(stable)}/${edition}`;
  const level = Number(record.system?.details?.level?.value);
  const sourceTitle = pub.title || (pack === "hazards" ? "Pathfinder GM Core" : pack === "pathfinder-npc-core" ? "Pathfinder NPC Core" : "Pathfinder Monster Core");
  const description = plain(record.system?.details?.publicNotes || record.system?.details?.description);
  const complete = Boolean(record.name && Number.isInteger(level) && sourceTitle && description);
  const nestedLicenses = [...new Set((record.items ?? []).map((item) => item.system?.publication?.license).filter(Boolean))].sort();
  const diagnostics = nestedLicenses.some((license) => license !== pub.license) ? ["Nested item publication requires independent license review."] : [];
  const provenance = {
    diagnostics,
    edition,
    license_basis: pub.license || "unknown",
    notices: [pub.license || "unknown"],
    source_page: null,
    source_sha256: createHash("sha256").update(raw).digest("hex"),
    source_title: sourceTitle,
    upstream: { identifier: record._id || stable, pack: `packs/${relativeFile.split("/").slice(0, -1).join("/") || pack}`, system: "foundryvtt-pf2e" }
  };
  const base = {
    completeness: complete ? "complete" : "partial",
    content_id: contentID,
    edition,
    environments: environments(record, kind),
    kind,
    level,
    name: record.name,
    provenance,
    rarity: record.system?.traits?.rarity || "common",
    roles: roles(record, kind),
    source: sourceTitle,
    support: complete && pub.license === "ORC" && pub.remaster !== false ? "supported" : "unsupported",
    summary: summary(record, kind),
    traits: traits(record)
  };
  if (kind === "hazard") {
    const parsed = parseHazardEffect(record);
    return {
      ...base,
      detail: {
        complexity: record.system?.details?.isComplex ? "complex" : "simple",
        defenses: { ac: record.system?.attributes?.ac?.value ?? null, hardness: record.system?.attributes?.hardness ?? null, hp: record.system?.attributes?.hp?.max ?? null },
        detection: `Stealth DC ${record.system?.attributes?.stealth?.value ?? "unknown"}`,
        disable_methods: [plain(record.system?.details?.disable)].filter(Boolean),
        effect: parsed.effect,
        reset: plain(record.system?.details?.reset) || null,
        routine: plain(record.system?.details?.routine) || null,
        trigger: parsed.trigger
      },
      hazard_complexity: record.system?.details?.isComplex ? "complex" : "simple",
      spellcasting: null
    };
  }
  return {
    ...base,
    detail: {
      abilities: abilityItems(record),
      defenses: { ac: record.system?.attributes?.ac?.value ?? null, fortitude: record.system?.saves?.fortitude?.value ?? null, hp: record.system?.attributes?.hp?.max ?? null, reflex: record.system?.saves?.reflex?.value ?? null, will: record.system?.saves?.will?.value ?? null },
      languages: [...(record.system?.details?.languages?.value ?? [])].map(String).sort(),
      perception: record.system?.perception?.mod ?? null,
      senses: (record.system?.perception?.senses ?? []).map((sense) => sense.type).filter(Boolean).sort(),
      size: record.system?.traits?.size?.value ?? "medium",
      skills: Object.fromEntries(Object.entries(record.system?.skills ?? {}).map(([name, value]) => [name, value.base ?? value.value ?? 0]).sort(([a], [b]) => a.localeCompare(b))),
      speeds: { land: record.system?.attributes?.speed?.value ?? null },
      strikes: strikeItems(record),
      tactics: "Use the creature's listed actions and terrain to pursue its role.",
      morale: "Withdraw or surrender when its stated motivation no longer holds.",
      spellcasting_blocks: (record.items ?? []).filter((item) => item.type === "spellcastingEntry").map((item) => item.name).filter(Boolean).sort()
    },
    hazard_complexity: null,
    spellcasting: (record.items ?? []).some((item) => item.type === "spellcastingEntry")
  };
}

const entries = selectedFiles.map(([file, kind]) => normalize(file, kind)).sort((a, b) => a.content_id.localeCompare(b.content_id));
if (new Set(entries.map((entry) => entry.content_id)).size !== entries.length) throw new Error("Catalog ContentIDs must be unique.");
const catalog = { catalog_id: "sidekick-dm-p0", entries, fixture_version: 1, generated_at: generatedAt, generator: { name: "GenerateSidekickDMCatalog", version: "0.1.0" }, source_revision: sourceRevision };
const manifest = {
  catalog_id: catalog.catalog_id,
  counts: { creatures: entries.filter((entry) => entry.kind === "creature").length, hazards: entries.filter((entry) => entry.kind === "hazard").length, total: entries.length },
  determinism: { encoding: "UTF-8 JSON, recursively sorted keys, stable array order, trailing newline", generated_at: generatedAt },
  fixture_version: 1,
  generator: catalog.generator,
  source: { revision: sourceRevision, system: "foundryvtt-pf2e" },
  entries: entries.map((entry) => ({ completeness: entry.completeness, content_id: entry.content_id, license_basis: entry.provenance.license_basis, source_sha256: entry.provenance.source_sha256, support: entry.support }))
};
writeJSON(output, catalog);
writeJSON(manifestOutput, manifest);
mkdirSync(dirname(noticeOutput), { recursive: true });
writeFileSync(noticeOutput, "Sidekick DM curated catalog\n\nSource: Foundry VTT PF2e data, current remaster records selected for the POC.\nLicense basis: ORC where marked in per-entry provenance.\nNo images, portraits, maps, tokens, macros, or Foundry rule-element automation are redistributed.\nReview per-entry provenance and the final release notices before publication.\n", "utf8");
console.log(`Generated ${entries.length} Sidekick Catalog entries at ${output}`);
