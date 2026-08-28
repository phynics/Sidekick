function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function tokens(value) {
  return normalized(value).split(/[\s,]+/).filter(Boolean);
}

function freeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freeze(child);
  return Object.freeze(value);
}

function compact(entry) {
  const { detail: _detail, ...summary } = entry;
  return Object.freeze({ ...summary, traits: [...(entry.traits ?? [])], environments: [...(entry.environments ?? [])], roles: [...(entry.roles ?? [])] });
}

export class CatalogIndex {
  constructor(fixture) {
    if (!fixture || fixture.fixture_version !== 1 || !Array.isArray(fixture.entries)) throw new TypeError("A version 1 Sidekick Catalog fixture is required.");
    this.fixture = freeze(structuredClone(fixture));
    this.entries = Object.freeze([...this.fixture.entries].sort((a, b) => a.content_id.localeCompare(b.content_id)));
    this.byId = new Map(this.entries.map((entry) => [entry.content_id, entry]));
  }

  get(contentID) {
    return this.byId.get(contentID) ?? null;
  }

  all() {
    return [...this.entries];
  }

  search({
    query = "",
    kind = null,
    level_min: levelMin = null,
    level_max: levelMax = null,
    traits = [],
    rarity = [],
    sources = [],
    environments = [],
    roles = [],
    edition = "current",
    spellcasting = null,
    hazard_complexity: hazardComplexity = null,
    completeness = "complete",
    support = "supported",
    limit = 20,
    offset = 0
  } = {}) {
    const queryTokens = tokens(query);
    const normalizedTraits = traits.map(normalized);
    const normalizedRarity = rarity.map(normalized);
    const normalizedSources = sources.map(normalized);
    const normalizedEnvironments = environments.map(normalized);
    const normalizedRoles = roles.map(normalized);
    const safeLimit = Math.min(Math.max(Number.isFinite(Number(limit)) ? Math.trunc(Number(limit)) : 20, 1), 50);
    const safeOffset = Math.max(Number.isFinite(Number(offset)) ? Math.trunc(Number(offset)) : 0, 0);
    const matches = this.entries
      .filter((entry) => !kind || entry.kind === kind)
      .filter((entry) => levelMin == null || entry.level >= Number(levelMin))
      .filter((entry) => levelMax == null || entry.level <= Number(levelMax))
      .filter((entry) => !edition || entry.edition === edition)
      .filter((entry) => !completeness || entry.completeness === completeness)
      .filter((entry) => !support || entry.support === support)
      .filter((entry) => normalizedRarity.length === 0 || normalizedRarity.includes(normalized(entry.rarity)))
      .filter((entry) => normalizedSources.length === 0 || normalizedSources.some((source) => normalized(entry.source).includes(source)))
      .filter((entry) => normalizedTraits.every((trait) => (entry.traits ?? []).some((candidate) => normalized(candidate) === trait)))
      .filter((entry) => normalizedEnvironments.every((facet) => (entry.environments ?? []).some((candidate) => normalized(candidate) === facet)))
      .filter((entry) => normalizedRoles.every((role) => (entry.roles ?? []).some((candidate) => normalized(candidate) === role)))
      .filter((entry) => spellcasting == null || entry.spellcasting === Boolean(spellcasting))
      .filter((entry) => hazardComplexity == null || entry.hazard_complexity === hazardComplexity)
      .map((entry) => {
        const haystack = [entry.name, entry.summary, ...(entry.traits ?? []), ...(entry.environments ?? []), ...(entry.roles ?? [])].map(normalized);
        if (!queryTokens.every((token) => haystack.some((value) => value.includes(token)))) return null;
        const name = normalized(entry.name);
        const score = queryTokens.reduce((total, token) => total + (name === token ? 100 : name.startsWith(token) ? 70 : name.split(" ").includes(token) ? 50 : name.includes(token) ? 35 : haystack.some((value) => value.includes(token)) ? 10 : 0), 0);
        return { entry, score };
      })
      .filter(Boolean)
      .sort((left, right) => right.score - left.score || normalized(left.entry.name).localeCompare(normalized(right.entry.name)) || left.entry.content_id.localeCompare(right.entry.content_id));
    return { total: matches.length, offset: safeOffset, limit: safeLimit, hasMore: safeOffset + safeLimit < matches.length, results: matches.slice(safeOffset, safeOffset + safeLimit).map(({ entry }) => compact(entry)) };
  }

  addExistingCreatureCommand(contentID, options = {}) {
    const entry = this.get(contentID);
    if (!entry) return { ok: false, error: { code: "unknown_catalog_entry", message: "That Catalog Entry is not in the Catalog." } };
    if (entry.kind !== "creature") return { ok: false, error: { code: "invalid_participant_kind", message: "Only Creature Catalog Entries can be added as Participant Groups." } };
    if (entry.completeness !== "complete" || entry.support !== "supported") return { ok: false, error: { code: "catalog_entry_partial", message: "Only complete, supported Catalog Entries can be added to a ready Encounter." } };
    const quantity = Number(options.quantity ?? 1);
    if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: { code: "invalid_quantity", message: "Participant quantity must be at least 1." } };
    return {
      ok: true,
      command: {
        command: "sidekickdm_add_existing_participant_group",
        content_id: contentID,
        catalog_entry: {
          content_id: entry.content_id,
          kind: entry.kind,
          name: entry.name,
          level: entry.level,
          completeness: entry.completeness,
          support: entry.support,
          provenance: entry.provenance
        },
        quantity,
        adjustment: options.adjustment ?? "normal",
        faction: options.faction ?? "primary_opposition",
        participation: options.participation ?? { mode: "mandatory" },
        encounter_role: options.encounter_role ?? entry.roles?.[0] ?? "brute",
        starting_area: options.starting_area ?? "",
        shared_tactics: options.shared_tactics ?? "",
        morale: options.morale ?? ""
      },
      entry: compact(entry)
    };
  }

  updateParticipantCommand(componentID, options = {}) {
    if (!componentID) return { ok: false, error: { code: "unknown_component", message: "A Participant Group ID is required." } };
    const command = { command: "sidekickdm_update_participant_group", component_id: componentID };
    if (options.quantity != null) {
      const quantity = Number(options.quantity);
      if (!Number.isInteger(quantity) || quantity < 1) return { ok: false, error: { code: "invalid_quantity", message: "Participant quantity must be at least 1." } };
      command.quantity = quantity;
    }
    if (options.adjustment != null) {
      if (!["normal", "weak", "elite"].includes(options.adjustment)) return { ok: false, error: { code: "invalid_adjustment", message: "Adjustment must be normal, weak, or elite." } };
      command.adjustment = options.adjustment;
    }
    return { ok: true, command };
  }
}

export async function loadCatalog({ url = "./public/data/sidekickdm-catalog.v1.json", fetcher = globalThis.fetch } = {}) {
  const response = await fetcher(url);
  if (!response.ok) throw new Error(`Sidekick Catalog returned HTTP ${response.status}.`);
  const fixture = await response.json();
  return new CatalogIndex(fixture);
}
