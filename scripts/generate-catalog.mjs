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

function fixedOrder(left, right) {
  const a = String(left ?? "");
  const b = String(right ?? "");
  return a < b ? -1 : a > b ? 1 : 0;
}
const generator = { name: "GenerateSidekickDMCatalog", version: "0.2.0" };
const unofficialNotice = "Sidekick DM is an unofficial product and is not affiliated with, endorsed by, or sponsored by Paizo Inc. or Foundry VTT.";
const orcNotice = "This product is licensed under the ORC License located at the Library of Congress at TX 9-307-067 and available online at various locations including http://azoralaw.com/orclicense/ and others. All warranties are disclaimed as set forth therein.";
const extractionNotice = "Included rules data was extracted from the Foundry VTT PF2e system. The extraction source revision is recorded in the catalog manifest.";
const assetBoundaryNotice = "This catalog contains normalized rules data only. It does not redistribute portraits, art, tokens, maps, attachments, Foundry configuration, macros, or rule-element automation.";
const extractionAttribution = {
  repository: "https://github.com/foundryvtt/pf2e",
  system: "foundryvtt-pf2e",
  notice: extractionNotice,
  method: "Normalized selected Foundry VTT PF2e JSON records into Sidekick Catalog entries."
};
const assetBoundary = {
  included: ["normalized creature and hazard rules data"],
  excluded: ["portraits", "art", "tokens", "maps", "attachments", "Foundry configuration", "macros", "rule-element automation"],
  notice: assetBoundaryNotice
};
const publicationAttributions = {
  "Pathfinder GM Core": {
    title: "Pathfinder GM Core",
    copyright: "© 2023, Paizo Inc.",
    publisher: "Paizo Inc.",
    license: "ORC",
    remaster: true,
    designers: ["Logan Bonner", "Mark Seifter"],
    authors: ["Amirali Attar Olyaee", "Logan Bonner", "Creighton Broadhurst", "Jason Bulmahn", "James Case", "Jesse Decker", "Eleanor Ferron", "Fabby Garza Marroquín", "Jaym Gates", "Matthew Goetz", "James Jacobs", "Brian R. James", "Jenny Jarzabski", "Dustin Knight", "Jason LeMaitre", "Lyz Liddell", "Luis Loza", "Stephen Radney-MacFarland", "David N. Ross", "Michael Sayre", "Mark Seifter", "Owen K.C. Stephens", "Amber Stewart", "Clark Valentine", "Landon Winkler", "Linda Zayas-Palmer"],
    attribution: "Pathfinder GM Core © 2023, Paizo Inc.; Designers: Logan Bonner and Mark Seifter. Authors: Amirali Attar Olyaee, Logan Bonner, Creighton Broadhurst, Jason Bulmahn, James Case, Jesse Decker, Eleanor Ferron, Fabby Garza Marroquín, Jaym Gates, Matthew Goetz, James Jacobs, Brian R. James, Jenny Jarzabski, Dustin Knight, Jason LeMaitre, Lyz Liddell, Luis Loza, Stephen Radney-MacFarland, David N. Ross, Michael Sayre, Mark Seifter, Owen K.C. Stephens, Amber Stewart, Clark Valentine, Landon Winkler, and Linda Zayas-Palmer.",
    source: "pf2e/static/licenses/ORCLicense.md"
  },
  "Pathfinder Monster Core": {
    title: "Pathfinder Monster Core",
    copyright: "© 2024, Paizo Inc.",
    publisher: "Paizo Inc.",
    license: "ORC",
    remaster: true,
    designers: ["Logan Bonner", "Jason Bulmahn", "Stephen Radney-MacFarland", "Mark Seifter"],
    authors: ["Alexander Augunas", "Dennis Baker", "Kate Baker", "Joshua Birdsong", "Joseph Blomquist", "Logan Bonner", "Jason Bulmahn", "James Case", "John Compton", "Paris Crenshaw", "Adam Daigle", "Darrin Drader", "Brian Duckwitz", "Robert N. Emerson", "Scott Fernandez", "Eleanor Ferron", "Leo Glass", "Matthew Goodall", "BJ Hensley", "Thurston Hillman", "Vanessa Hoskins", "James Jacobs", "Jenny Jarzabski", "Miko Kallio", "Jason Keeley", "Jeff Lee", "Lyz Liddell", "Luis Loza", "Robert G. McCreary", "Philippe-Antoine Menard", "Jacob W. Michaels", "Dave Nelson", "Jason Nelson", "Tim Nightengale", "Stephen Radney-MacFarland", "Mikhail Rekun", "Patrick Renie", "Alex Riggs", "David N. Ross", "Michael Sayre", "Mark Seifter", "Chris S. Sims", "Amber Stewart", "Jeffrey Swank", "William Thompson", "Jason Tondro", "Clark Valentine", "Landon Winkler", "Tonya Woldridge", "Linda Zayas-Palmer"],
    attribution: "Pathfinder Monster Core © 2024 Paizo Inc.; Authors: Alexander Augunas, Dennis Baker, Kate Baker, Joshua Birdsong, Joseph Blomquist, Logan Bonner, Jason Bulmahn, James Case, John Compton, Paris Crenshaw, Adam Daigle, Darrin Drader, Brian Duckwitz, Robert N. Emerson, Scott Fernandez, Eleanor Ferron, Leo Glass, Matthew Goodall, BJ Hensley, Thurston Hillman, Vanessa Hoskins, James Jacobs, Jenny Jarzabski, Miko Kallio, Jason Keeley, Jeff Lee, Lyz Liddell, Luis Loza, Robert G. McCreary, Philippe-Antoine Menard, Jacob W. Michaels, Dave Nelson, Jason Nelson, Tim Nightengale, Stephen Radney-MacFarland, Mikhail Rekun, Patrick Renie, Alex Riggs, David N. Ross, Michael Sayre, Mark Seifter, Chris S. Sims, Amber Stewart, Jeffrey Swank, William Thompson, Jason Tondro, Clark Valentine, Landon Winkler, Tonya Woldridge, and Linda Zayas-Palmer.",
    source: "Paizo ORC attribution notice"
  },
  "Pathfinder NPC Core": {
    title: "Pathfinder NPC Core",
    copyright: "© 2025, Paizo Inc.",
    publisher: "Paizo Inc.",
    license: "ORC",
    remaster: true,
    designers: [],
    authors: ["Raychael Allor", "Alexander Augunas", "Rigby Bendele", "Jesse Benner", "John Bennett", "Joshua Birdsong", "Chris Bissette", "Jeremy Blum", "Logan Bonner", "Clinton J. Boomer", "Dan Cascone", "Jessica Catalan", "Paris Crenshaw", "Katina Davis", "Rue Dickey", "Robert N. Emerson", "Chris Eng", "Eleanor Ferron", "Josh Foster", "Matthew Fu", "Andrew D. Geels", "T.H. Gulliver", "Sen H.H.S.", "Kev Hamilton", "Sasha Laranoa Harving", "Katrina Hennessy", "BJ Hensley", "Vanessa Hoskins", "Patrick Hurley", "Sara Jeffers", "Michelle Jones", "Erik Keith", "Michelle Y. Kim", "Jason LeMaitre", "Christiana Lewis", "Luis Loza", "Colm Lundberg", "Maryssa Mari", "Jacob W. Michaels", "Zac Moran", "Matt Morris", "Patchen Mortimer", "K. Tessa Newton", "Stephen Radney-MacFarland", "Jessica Redekop", "Mikhail Rekun", "Alistair Rigg", "David N. Ross", "Tony Saunders", "Shay Snow", "Joel Southall", "Kendra Leigh Speedling", "Levi Steadman", "Christina Stiles", "Kyle Tam", "Jamie Trollope", "Ruvaid Virk", "Grady Wang", "Andrew White", "Jackson Wood", "Isis Wozniakowska", "Basil Wright"],
    attribution: "Pathfinder NPC Core © 2025, Paizo Inc. Authors: Raychael Allor, Alexander Augunas, Rigby Bendele, Jesse Benner, John Bennett, Joshua Birdsong, Chris Bissette, Jeremy Blum, Logan Bonner, Clinton J. Boomer, Dan Cascone, Jessica Catalan, Paris Crenshaw, Katina Davis, Rue Dickey, Robert N. Emerson, Chris Eng, Eleanor Ferron, Josh Foster, Matthew Fu, Andrew D. Geels, T.H. Gulliver, Sen H.H.S., Kev Hamilton, Sasha Laranoa Harving, Katrina Hennessy, BJ Hensley, Vanessa Hoskins, Patrick Hurley, Sara Jeffers, Michelle Jones, Erik Keith, Michelle Y. Kim, Jason LeMaitre, Christiana Lewis, Luis Loza, Colm Lundberg, Maryssa Mari, Jacob W. Michaels, Zac Moran, Matt Morris, Patchen Mortimer, K. Tessa Newton, Stephen Radney-MacFarland, Jessica Redekop, Mikhail Rekun, Alistair Rigg, David N. Ross, Tony Saunders, Shay Snow, Joel Southall, Kendra Leigh Speedling, Levi Steadman, Christina Stiles, Kyle Tam, Jamie Trollope, Ruvaid Virk, Grady Wang, Andrew White, Jackson Wood, Isis Wozniakowska, and Basil Wright.",
    source: "https://pf2orc.d20pfsrd.com/srd-content-source/pathfinder-npc-core/"
  }
};

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
  return value && typeof value === "object" ? { title: value.title || fallback, license: value.license || null, remaster: typeof value.remaster === "boolean" ? value.remaster : null } : { title: fallback, license: null, remaster: null };
}

function nestedPublicationAudit(record, parentPublication) {
  const parentLicense = parentPublication.license || null;
  const parentRemaster = typeof parentPublication.remaster === "boolean" ? parentPublication.remaster : null;
  const nestedItems = (record.items ?? []).map((item, index) => {
    const value = item?.system?.publication;
    const publicationValue = value && typeof value === "object" ? {
      license: value.license || null,
      remaster: typeof value.remaster === "boolean" ? value.remaster : null,
      title: typeof value.title === "string" ? value.title : null
    } : null;
    const issues = [];
    if (!publicationValue) issues.push("nested publication metadata is missing");
    else {
      if (!publicationValue.license) issues.push("nested license is missing");
      else if (!parentLicense || publicationValue.license !== parentLicense) issues.push(`nested license ${publicationValue.license} differs from parent license ${parentLicense || "unknown"}`);
      if (publicationValue.remaster == null) issues.push("nested edition is missing");
      else if (parentRemaster != null && publicationValue.remaster !== parentRemaster) issues.push(`nested edition ${publicationValue.remaster ? "current" : "legacy"} differs from parent edition ${parentRemaster ? "current" : "legacy"}`);
    }
    return {
      index,
      item_id: item?._id || null,
      name: item?.name || null,
      type: item?.type || null,
      path: `items[${index}].system.publication`,
      publication: publicationValue,
      license_basis: publicationValue?.license || "unknown",
      notices: [publicationValue?.license || "Nested publication metadata unavailable"],
      diagnostics: issues
    };
  });
  const mismatches = nestedItems.filter((item) => item.diagnostics.length > 0);
  return { nestedItems, mismatches };
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
    .sort((a, b) => fixedOrder(a.name, b.name));
}

function strikeItems(record) {
  return (record.items ?? [])
    .filter((item) => ["melee", "ranged"].includes(item.type))
    .map((item) => {
      const attack = Number(item.system?.bonus?.value);
      const damage = Object.values(item.system?.damageRolls ?? {}).map((roll) => plain(roll?.damage)).filter(Boolean).join(" + ");
      return {
        attack: Number.isInteger(attack) ? attack : null,
        damage,
        name: item.name,
        traits: [...(item.system?.traits?.value ?? [])].map(String).sort()
      };
    })
    .filter((item) => item.name)
    .sort((a, b) => fixedOrder(a.name, b.name));
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
  const knownPublication = Boolean(publicationAttributions[sourceTitle]);
  const complete = Boolean(record.name && Number.isInteger(level) && sourceTitle && description && pub.license && typeof pub.remaster === "boolean" && knownPublication);
  const nestedAudit = nestedPublicationAudit(record, pub);
  const nestedLicenseMismatches = nestedAudit.mismatches.map((item) => ({
    index: item.index,
    item_id: item.item_id,
    item_name: item.name,
    item_type: item.type,
    path: item.path,
    parent_license: pub.license || "unknown",
    parent_remaster: pub.remaster,
    nested_publication: item.publication,
    diagnostics: item.diagnostics
  }));
  const diagnostics = [
    ...(!knownPublication ? ["Publication attribution is not recorded; license basis is unresolved."] : []),
    ...(!pub.license ? ["Parent publication license is missing; license basis is unresolved."] : []),
    ...(pub.remaster == null ? ["Parent publication edition is missing; edition is unresolved."] : []),
    ...(nestedLicenseMismatches.length > 0 ? ["Nested item publication requires independent license review.", ...nestedLicenseMismatches.map((item) => `${item.path}: ${item.diagnostics.join("; ")}.`)] : [])
  ];
  const publicationAttribution = publicationAttributions[sourceTitle] || {
    title: sourceTitle,
    copyright: null,
    publisher: null,
    license: pub.license || "unknown",
    remaster: pub.remaster,
    designers: [],
    authors: [],
    attribution: "Publication attribution is not recorded in the extraction source.",
    source: "not recorded"
  };
  const extraction = {
    ...extractionAttribution,
    revision: sourceRevision,
    source_file: `packs/${relativeFile}`,
    source_sha256: createHash("sha256").update(raw).digest("hex")
  };
  const notices = ["ORC", publicationAttribution.attribution, extraction.notice, assetBoundary.notice];
  if (nestedLicenseMismatches.length > 0) notices.push("Nested item publication or license metadata does not match the parent record; this entry is not supported for ready encounters.");
  const provenance = {
    diagnostics,
    edition,
    extraction_attribution: extraction,
    generator_revision: generator.version,
    license_basis: pub.license || "unknown",
    nested_items: nestedAudit.nestedItems,
    nested_license_basis: [...new Set(nestedAudit.nestedItems.map((item) => item.license_basis))].sort(),
    nested_license_mismatches: nestedLicenseMismatches,
    notices,
    publication_attribution: publicationAttribution,
    source_page: null,
    source_file: `packs/${relativeFile}`,
    source_revision: sourceRevision,
    source_sha256: extraction.source_sha256,
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
    support: complete && knownPublication && pub.license === "ORC" && pub.remaster !== false && nestedLicenseMismatches.length === 0 ? "supported" : "unsupported",
    summary: summary(record, kind),
    traits: traits(record)
  };
  base.asset_boundary = assetBoundary;
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
      skills: Object.fromEntries(Object.entries(record.system?.skills ?? {}).map(([name, value]) => [name, value.base ?? value.value ?? 0]).sort(([a], [b]) => fixedOrder(a, b))),
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

const entries = selectedFiles.map(([file, kind]) => normalize(file, kind)).sort((a, b) => fixedOrder(a.content_id, b.content_id));
if (new Set(entries.map((entry) => entry.content_id)).size !== entries.length) throw new Error("Catalog ContentIDs must be unique.");
const source = {
  system: extractionAttribution.system,
  repository: extractionAttribution.repository,
  revision: sourceRevision,
  revision_date: "2025-05-31T10:49:04-07:00",
  attribution: "Foundry VTT PF2e system, used as the technical extraction source."
};
const publicationList = Object.values(publicationAttributions).sort((a, b) => fixedOrder(a.title, b.title));
const nestedMismatchEntries = entries.filter((entry) => entry.provenance.nested_license_mismatches.length > 0);
const catalog = {
  asset_boundary: assetBoundary,
  catalog_id: "sidekick-dm-p0",
  entries,
  fixture_version: 1,
  generated_at: generatedAt,
  generator,
  publication_attributions: publicationList,
  source,
  source_revision: sourceRevision
};
const manifest = {
  asset_boundary: assetBoundary,
  catalog_id: catalog.catalog_id,
  counts: { creatures: entries.filter((entry) => entry.kind === "creature").length, hazards: entries.filter((entry) => entry.kind === "hazard").length, supported: entries.filter((entry) => entry.support === "supported").length, unsupported: entries.filter((entry) => entry.support === "unsupported").length, total: entries.length },
  determinism: { encoding: "UTF-8 JSON, recursively sorted keys, stable array order, trailing newline", generated_at: generatedAt, generated_at_policy: "explicit input; never inferred from wall clock for fixture comparison", notice_encoding: "UTF-8 with LF line endings and one trailing newline" },
  entries: entries.map((entry) => ({
    asset_boundary: entry.asset_boundary,
    completeness: entry.completeness,
    content_id: entry.content_id,
    kind: entry.kind,
    name: entry.name,
    level: entry.level,
    diagnostics: entry.provenance.diagnostics,
    extraction_attribution: entry.provenance.extraction_attribution,
    license_basis: entry.provenance.license_basis,
    nested_items: entry.provenance.nested_items,
    nested_license_basis: entry.provenance.nested_license_basis,
    nested_license_mismatches: entry.provenance.nested_license_mismatches,
    notices: entry.provenance.notices,
    publication_attribution: entry.provenance.publication_attribution,
    source_file: entry.provenance.source_file,
    source_page: entry.provenance.source_page,
    source_revision: entry.provenance.source_revision,
    source_sha256: entry.provenance.source_sha256,
    support: entry.support,
    provenance: {
      source_title: entry.provenance.source_title,
      source_page: entry.provenance.source_page,
      source_file: entry.provenance.source_file,
      source_revision: entry.provenance.source_revision,
      source_sha256: entry.provenance.source_sha256,
      edition: entry.provenance.edition,
      publication_attribution: entry.provenance.publication_attribution,
      extraction_attribution: entry.provenance.extraction_attribution,
      nested_items: entry.provenance.nested_items,
      nested_license_mismatches: entry.provenance.nested_license_mismatches,
      notices: entry.provenance.notices,
      diagnostics: entry.provenance.diagnostics
    }
  })),
  fixture_version: 1,
  generator,
  generator_revision: generator.version,
  manifest_version: 1,
  notices: { unofficial_product: unofficialNotice, orc: orcNotice, extraction: extractionNotice, asset_boundary: assetBoundaryNotice },
  publication_attributions: publicationList,
  required_entry_metadata: ["content_id", "kind", "name", "level", "completeness", "support", "provenance.source_title", "provenance.source_page", "provenance.source_file", "provenance.source_revision", "provenance.source_sha256", "provenance.edition", "provenance.publication_attribution", "provenance.extraction_attribution", "provenance.nested_items", "provenance.nested_license_mismatches", "provenance.notices", "provenance.diagnostics", "asset_boundary"],
  source,
  source_revision: sourceRevision,
  nested_license_policy: { action: "unsupported", rule: "A missing or mismatched nested publication/license record cannot enter a ready encounter.", mismatch_count: nestedMismatchEntries.length, mismatch_content_ids: nestedMismatchEntries.map((entry) => entry.content_id).sort() },
  artifacts: ["public/data/sidekickdm-catalog.v1.json", "public/data/catalog-manifest.v1.json", "public/data/NOTICE.txt"]
};
writeJSON(output, catalog);
writeJSON(manifestOutput, manifest);
mkdirSync(dirname(noticeOutput), { recursive: true });
const notice = [
  "Sidekick DM curated catalog",
  "",
  unofficialNotice,
  "",
  orcNotice,
  "",
  "Included publication attribution:",
  ...publicationList.map((publication) => `- ${publication.attribution}`),
  "",
  `${extractionNotice} Source: ${extractionAttribution.repository} at revision ${sourceRevision}.`,
  assetBoundaryNotice,
  "",
  `Generator: ${generator.name} ${generator.version}.`,
  `Catalog entries with unresolved nested publication or license metadata are retained for inspection but marked unsupported: ${nestedMismatchEntries.length}.`,
  ""
].join("\n");
writeFileSync(noticeOutput, notice, "utf8");
console.log(`Generated ${entries.length} Sidekick Catalog entries at ${output}`);
